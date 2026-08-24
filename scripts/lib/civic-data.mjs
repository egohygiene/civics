import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const SNAPSHOT_SCHEMA_VERSION = "1.0.0";
export const MANIFEST_SCHEMA_VERSION = "1.0.0";

const DEFAULT_TIMEOUT_MILLISECONDS = 30_000;
const MAX_RETRY_DELAY_MILLISECONDS = 15_000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export class RequestBudget {
  constructor(provider, limit) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error(`${provider} request budget must be a positive integer.`);
    }

    this.provider = provider;
    this.limit = limit;
    this.used = 0;
  }

  take() {
    if (this.used >= this.limit) {
      throw new Error(
        `${this.provider} request budget exhausted (${this.used}/${this.limit}).`,
      );
    }

    this.used += 1;
  }

  assertCanFetchPages(totalPages) {
    if (!Number.isSafeInteger(totalPages) || totalPages < 1) {
      throw new Error(`${this.provider} returned an invalid page count.`);
    }

    const remainingPages = totalPages - 1;
    const remainingBudget = this.limit - this.used;
    if (remainingPages > remainingBudget) {
      throw new Error(
        `${this.provider} requires ${totalPages} page requests, exceeding the configured limit of ${this.limit}.`,
      );
    }
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseRetryDelay(response, attempt) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isSafeInteger(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MILLISECONDS);
    }
  }

  return Math.min(1_000 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MILLISECONDS);
}

export async function fetchJson({
  provider,
  url,
  headers = {},
  budget,
  timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS,
  maxAttempts = 3,
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    budget.take();

    let response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "egohygiene-civics-data-pipeline/0.1",
          ...headers,
        },
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch (error) {
      if (attempt < maxAttempts && budget.used < budget.limit) {
        await delay(Math.min(1_000 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MILLISECONDS));
        continue;
      }

      throw new Error(`${provider} request failed without a response.`, {
        cause: error,
      });
    }

    if (response.ok) {
      try {
        return await response.json();
      } catch (error) {
        throw new Error(`${provider} returned a non-JSON response.`, {
          cause: error,
        });
      }
    }

    if (
      RETRYABLE_STATUS_CODES.has(response.status) &&
      attempt < maxAttempts &&
      budget.used < budget.limit
    ) {
      await delay(parseRetryDelay(response, attempt));
      continue;
    }

    throw new Error(
      `${provider} returned HTTP ${response.status} ${response.statusText}.`,
    );
  }

  throw new Error(`${provider} request failed after ${maxAttempts} attempts.`);
}

export function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableJson(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((key) => [key, stableJson(value[key])]),
    );
  }

  return value;
}

export function sha256Canonical(value) {
  const canonical = JSON.stringify(stableJson(value));
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw new Error(`Unable to read JSON file ${filePath}.`, { cause: error });
  }
}

export async function writeJsonFilesAtomically(entries) {
  const temporaryEntries = [];

  try {
    for (const [filePath, value] of entries) {
      await mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.tmp-${process.pid}`;
      await writeFile(temporaryPath, serializeJson(value), {
        encoding: "utf8",
        mode: 0o644,
      });
      temporaryEntries.push([temporaryPath, filePath]);
    }

    for (const [temporaryPath, filePath] of temporaryEntries) {
      await rename(temporaryPath, filePath);
    }
  } catch (error) {
    await Promise.all(
      temporaryEntries.map(([temporaryPath]) =>
        rm(temporaryPath, { force: true }).catch(() => undefined),
      ),
    );
    throw error;
  }
}

export function requireSecret(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Configure it as a GitHub Actions repository secret or local environment variable.`,
    );
  }

  return value;
}

export function parsePositiveInteger(value, optionName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || String(parsed) !== String(value)) {
    throw new Error(`${optionName} must be a positive integer.`);
  }

  return parsed;
}

export function assertIsoTimestamp(value, fieldName) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} must be an ISO-8601 timestamp.`);
  }
}

export function maxIsoTimestamp(values) {
  const validValues = values
    .filter((value) => typeof value === "string" && !Number.isNaN(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  // Preserve the provider's timestamp verbatim. Some civic APIs omit an offset;
  // converting those values would silently apply the runner's local timezone.
  return validValues[0] ?? null;
}

export function buildSnapshot({
  provider,
  dataset,
  scope,
  source,
  records,
  checkedAt,
  sourceUpdatedAt,
  previousSnapshot,
}) {
  const contentHash = sha256Canonical(records);
  const unchanged = previousSnapshot?.contentHash === contentHash;
  const contentChangedAt = unchanged
    ? previousSnapshot.freshness.contentChangedAt
    : checkedAt;

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    provider,
    dataset,
    scope,
    source,
    freshness: {
      checkedAt,
      contentChangedAt,
      sourceUpdatedAt,
    },
    contentHash,
    recordCount: records.length,
    records,
  };
}

export function assertExistingSnapshotIntegrity(snapshot, expectedProvider) {
  if (!snapshot) {
    return;
  }

  if (snapshot.provider !== expectedProvider || !Array.isArray(snapshot.records)) {
    throw new Error(`Existing ${expectedProvider} snapshot has an unexpected shape.`);
  }

  const actualHash = sha256Canonical(snapshot.records);
  if (snapshot.contentHash !== actualHash) {
    throw new Error(
      `Existing ${expectedProvider} snapshot content hash does not match its records.`,
    );
  }

  assertIsoTimestamp(
    snapshot.freshness?.contentChangedAt,
    `${expectedProvider}.freshness.contentChangedAt`,
  );
}

export function assertNoSecretMaterial(value, secretValues = []) {
  const serialized = JSON.stringify(value);
  const forbiddenKeyPattern =
    /"(?:api[_-]?key|apikey|x-api-key|authorization|secret|access[_-]?token)"\s*:/i;
  const forbiddenQueryPattern = /[?&](?:api[_-]?key|apikey|key|token)=/i;

  if (forbiddenKeyPattern.test(serialized) || forbiddenQueryPattern.test(serialized)) {
    throw new Error("Generated data contains secret-like keys or query parameters.");
  }

  for (const secret of secretValues.filter(Boolean)) {
    if (secret.length >= 8 && serialized.includes(secret)) {
      throw new Error("Generated data contains a configured secret value.");
    }
  }
}
