#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MANIFEST_SCHEMA_VERSION,
  RequestBudget,
  assertExistingSnapshotIntegrity,
  assertNoSecretMaterial,
  buildSnapshot,
  fetchJson,
  maxIsoTimestamp,
  parsePositiveInteger,
  readJsonIfPresent,
  requireSecret,
  sha256Canonical,
  writeJsonFilesAtomically,
} from "./lib/civic-data.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_OUTPUT_DIRECTORY = path.join(REPOSITORY_ROOT, "data", "raw");
const OPENSTATES_ENDPOINT = "https://v3.openstates.org/people";
const FEC_ENDPOINT = "https://api.open.fec.gov/v1/candidates/";

function usage() {
  return `Usage: node scripts/refresh-civic-data.mjs [options]

Options:
  --mode <bootstrap|refresh>            Refresh mode (default: refresh)
  --providers <all|openstates,fec>      Providers to refresh (default: all)
  --election-cycle <year>               FEC election cycle (default: current even year)
  --output-directory <path>             Snapshot output directory (default: data/raw)
  --max-openstates-requests <number>    Hard Open States request cap (default: 8)
  --max-fec-requests <number>           Hard FEC request cap (default: 5)
  --now <ISO timestamp>                 Fixed timestamp for reproducible tests
  --help                                Show this help message
`;
}

function currentElectionCycle(date = new Date()) {
  const year = date.getUTCFullYear();
  return year % 2 === 0 ? year : year + 1;
}

function parseArguments(argv) {
  const values = {
    mode: "refresh",
    providers: ["openstates", "fec"],
    electionCycle: null,
    outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
    maxOpenstatesRequests: 8,
    maxFecRequests: 5,
    now: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = () => {
      index += 1;
      if (index >= argv.length || argv[index].startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      return argv[index];
    };

    switch (argument) {
      case "--mode":
        values.mode = nextValue();
        break;
      case "--providers": {
        const providerValue = nextValue();
        values.providers =
          providerValue === "all"
            ? ["openstates", "fec"]
            : providerValue.split(",").map((provider) => provider.trim());
        break;
      }
      case "--election-cycle":
        values.electionCycle = parsePositiveInteger(nextValue(), argument);
        break;
      case "--output-directory":
        values.outputDirectory = path.resolve(nextValue());
        break;
      case "--max-openstates-requests":
        values.maxOpenstatesRequests = parsePositiveInteger(nextValue(), argument);
        break;
      case "--max-fec-requests":
        values.maxFecRequests = parsePositiveInteger(nextValue(), argument);
        break;
      case "--now":
        values.now = nextValue();
        break;
      case "--help":
        process.stdout.write(usage());
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (!new Set(["bootstrap", "refresh"]).has(values.mode)) {
    throw new Error("--mode must be bootstrap or refresh.");
  }

  const allowedProviders = new Set(["openstates", "fec"]);
  if (
    values.providers.length === 0 ||
    new Set(values.providers).size !== values.providers.length ||
    values.providers.some((provider) => !allowedProviders.has(provider))
  ) {
    throw new Error("--providers must be all or a comma-separated subset of openstates,fec.");
  }

  const now = values.now ? new Date(values.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("--now must be an ISO-8601 timestamp.");
  }

  values.now = now.toISOString();
  values.electionCycle ??= currentElectionCycle(now);
  if (values.electionCycle < 1976 || values.electionCycle % 2 !== 0) {
    throw new Error("--election-cycle must be an even-numbered federal election year.");
  }

  return values;
}

function sortRecords(records, idField) {
  return [...records].sort((left, right) =>
    String(left[idField]).localeCompare(String(right[idField]), "en"),
  );
}

function assertOpenStatesPage(page) {
  if (
    !page ||
    !Array.isArray(page.results) ||
    !Number.isSafeInteger(page.pagination?.max_page) ||
    page.pagination.max_page < 1
  ) {
    throw new Error("Open States returned an unexpected people response.");
  }

  for (const person of page.results) {
    if (
      typeof person?.id !== "string" ||
      typeof person?.name !== "string" ||
      person?.jurisdiction?.name !== "Massachusetts"
    ) {
      throw new Error("Open States returned an invalid Massachusetts person record.");
    }
  }
}

function openStatesUrl(page) {
  const url = new URL(OPENSTATES_ENDPOINT);
  url.searchParams.set("jurisdiction", "Massachusetts");
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", "50");
  for (const include of [
    "other_names",
    "other_identifiers",
    "links",
    "sources",
    "offices",
  ]) {
    url.searchParams.append("include", include);
  }
  return url;
}

async function retrieveOpenStates({ apiKey, requestLimit }) {
  const budget = new RequestBudget("Open States", requestLimit);
  const requestPage = (page) =>
    fetchJson({
      provider: "Open States",
      url: openStatesUrl(page),
      headers: { "X-API-KEY": apiKey },
      budget,
    });

  const firstPage = await requestPage(1);
  assertOpenStatesPage(firstPage);
  budget.assertCanFetchPages(firstPage.pagination.max_page);

  const records = [...firstPage.results];
  for (let page = 2; page <= firstPage.pagination.max_page; page += 1) {
    const response = await requestPage(page);
    assertOpenStatesPage(response);
    if (response.pagination.page !== page) {
      throw new Error(`Open States returned page ${response.pagination.page} while requesting ${page}.`);
    }
    records.push(...response.results);
  }

  const sortedRecords = sortRecords(records, "id");
  if (new Set(sortedRecords.map((person) => person.id)).size !== sortedRecords.length) {
    throw new Error("Open States returned duplicate person identifiers.");
  }

  return {
    records: sortedRecords,
    requestsUsed: budget.used,
    sourceUpdatedAt: maxIsoTimestamp(sortedRecords.map((person) => person.updated_at)),
  };
}

function assertFecPage(page) {
  if (
    !page ||
    !Array.isArray(page.results) ||
    !Number.isSafeInteger(page.pagination?.pages) ||
    page.pagination.pages < 1
  ) {
    throw new Error("FEC returned an unexpected candidates response.");
  }

  for (const candidate of page.results) {
    if (
      typeof candidate?.candidate_id !== "string" ||
      typeof candidate?.name !== "string" ||
      candidate?.state !== "MA"
    ) {
      throw new Error("FEC returned an invalid Massachusetts candidate record.");
    }
  }
}

function fecUrl(page, electionCycle, apiKey) {
  const url = new URL(FEC_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("state", "MA");
  url.searchParams.set("election_year", String(electionCycle));
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", "100");
  return url;
}

async function retrieveFec({ apiKey, electionCycle, requestLimit }) {
  const budget = new RequestBudget("FEC", requestLimit);
  const requestPage = (page) =>
    fetchJson({
      provider: "FEC",
      url: fecUrl(page, electionCycle, apiKey),
      budget,
    });

  const firstPage = await requestPage(1);
  assertFecPage(firstPage);
  budget.assertCanFetchPages(firstPage.pagination.pages);

  const records = [...firstPage.results];
  for (let page = 2; page <= firstPage.pagination.pages; page += 1) {
    const response = await requestPage(page);
    assertFecPage(response);
    if (response.pagination.page !== page) {
      throw new Error(`FEC returned page ${response.pagination.page} while requesting ${page}.`);
    }
    records.push(...response.results);
  }

  const sortedRecords = sortRecords(records, "candidate_id");
  if (
    new Set(sortedRecords.map((candidate) => candidate.candidate_id)).size !==
    sortedRecords.length
  ) {
    throw new Error("FEC returned duplicate candidate identifiers.");
  }

  return {
    records: sortedRecords,
    requestsUsed: budget.used,
    sourceUpdatedAt: maxIsoTimestamp(sortedRecords.map((candidate) => candidate.load_date)),
  };
}

function providerManifestEntry(snapshot, relativeFile, requestsUsed) {
  return {
    status: "ok",
    file: relativeFile.split(path.sep).join("/"),
    dataset: snapshot.dataset,
    recordCount: snapshot.recordCount,
    contentHash: snapshot.contentHash,
    checkedAt: snapshot.freshness.checkedAt,
    contentChangedAt: snapshot.freshness.contentChangedAt,
    sourceUpdatedAt: snapshot.freshness.sourceUpdatedAt,
    requestsUsed,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const outputDirectory = options.outputDirectory;
  const manifestPath = path.join(outputDirectory, "manifest.json");
  const previousManifest = await readJsonIfPresent(manifestPath);
  const pendingFiles = new Map();
  const providerEntries = { ...(previousManifest?.providers ?? {}) };
  const secretValues = [];

  if (options.providers.includes("openstates")) {
    const apiKey = requireSecret("OPENSTATES_API_KEY");
    secretValues.push(apiKey);
    const snapshotPath = path.join(outputDirectory, "openstates", "ma-people.json");
    const previousSnapshot = await readJsonIfPresent(snapshotPath);
    assertExistingSnapshotIntegrity(previousSnapshot, "openstates");

    const result = await retrieveOpenStates({
      apiKey,
      requestLimit: options.maxOpenstatesRequests,
    });
    const snapshot = buildSnapshot({
      provider: "openstates",
      dataset: "current-state-legislators",
      scope: {
        country: "US",
        state: "MA",
        jurisdiction: "Massachusetts",
      },
      source: {
        name: "Plural Open / Open States API v3",
        endpoint: OPENSTATES_ENDPOINT,
        parameters: {
          jurisdiction: "Massachusetts",
          perPage: 50,
          includes: [
            "other_names",
            "other_identifiers",
            "links",
            "sources",
            "offices",
          ],
        },
      },
      records: result.records,
      checkedAt: options.now,
      sourceUpdatedAt: result.sourceUpdatedAt,
      previousSnapshot,
    });
    assertNoSecretMaterial(snapshot, secretValues);
    pendingFiles.set(snapshotPath, snapshot);
    providerEntries.openstates = providerManifestEntry(
      snapshot,
      path.relative(outputDirectory, snapshotPath),
      result.requestsUsed,
    );
  }

  if (options.providers.includes("fec")) {
    const apiKey = requireSecret("DATA_GOV_API_KEY");
    secretValues.push(apiKey);
    const snapshotPath = path.join(
      outputDirectory,
      "fec",
      `ma-federal-candidates-${options.electionCycle}.json`,
    );
    const previousSnapshot = await readJsonIfPresent(snapshotPath);
    assertExistingSnapshotIntegrity(previousSnapshot, "fec");

    const result = await retrieveFec({
      apiKey,
      electionCycle: options.electionCycle,
      requestLimit: options.maxFecRequests,
    });
    const snapshot = buildSnapshot({
      provider: "fec",
      dataset: "federal-candidates",
      scope: {
        country: "US",
        state: "MA",
        electionCycle: options.electionCycle,
      },
      source: {
        name: "Federal Election Commission OpenFEC API",
        endpoint: FEC_ENDPOINT,
        parameters: {
          state: "MA",
          electionYear: options.electionCycle,
          perPage: 100,
        },
      },
      records: result.records,
      checkedAt: options.now,
      sourceUpdatedAt: result.sourceUpdatedAt,
      previousSnapshot,
    });
    assertNoSecretMaterial(snapshot, secretValues);
    pendingFiles.set(snapshotPath, snapshot);
    providerEntries.fec = providerManifestEntry(
      snapshot,
      path.relative(outputDirectory, snapshotPath),
      result.requestsUsed,
    );
  }

  const providerContentHashes = Object.fromEntries(
    Object.entries(providerEntries)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([provider, entry]) => [provider, entry.contentHash]),
  );
  const datasetHash = sha256Canonical(providerContentHashes);
  const unchanged = previousManifest?.datasetHash === datasetHash;
  const electionCycle = options.providers.includes("fec")
    ? options.electionCycle
    : (previousManifest?.scope?.electionCycle ?? options.electionCycle);
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    mode: options.mode,
    scope: {
      country: "US",
      state: "MA",
      electionCycle,
    },
    checkedAt: options.now,
    contentChangedAt: unchanged
      ? previousManifest.contentChangedAt
      : options.now,
    datasetHash,
    providers: providerEntries,
  };
  assertNoSecretMaterial(manifest, secretValues);
  pendingFiles.set(manifestPath, manifest);

  await writeJsonFilesAtomically(pendingFiles);

  const report = Object.entries(providerEntries)
    .map(
      ([provider, entry]) =>
        `${provider}: ${entry.recordCount} records, ${entry.requestsUsed} request(s), ${entry.contentHash}`,
    )
    .join("\n");
  process.stdout.write(
    `Civic data ${options.mode} completed at ${options.now}.\n${report}\nDataset: ${datasetHash}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Civic data refresh failed: ${error.message}\n`);
  process.exitCode = 1;
});
