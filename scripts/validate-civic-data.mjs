#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MANIFEST_SCHEMA_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  assertIsoTimestamp,
  assertNoSecretMaterial,
  parsePositiveInteger,
  readJsonIfPresent,
  sha256Canonical,
} from "./lib/civic-data.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_DATA_DIRECTORY = path.join(REPOSITORY_ROOT, "data", "raw");

function usage() {
  return `Usage: node scripts/validate-civic-data.mjs [options]

Options:
  --data-directory <path>       Snapshot directory (default: data/raw)
  --election-cycle <year>       Expected FEC election cycle
  --providers <all|list>        Required providers (default: all)
  --help                        Show this help message
`;
}

function parseArguments(argv) {
  const values = {
    dataDirectory: DEFAULT_DATA_DIRECTORY,
    electionCycle: null,
    providers: ["openstates", "fec"],
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
      case "--data-directory":
        values.dataDirectory = path.resolve(nextValue());
        break;
      case "--election-cycle":
        values.electionCycle = parsePositiveInteger(nextValue(), argument);
        break;
      case "--providers": {
        const providerValue = nextValue();
        values.providers =
          providerValue === "all"
            ? ["openstates", "fec"]
            : providerValue.split(",").map((provider) => provider.trim());
        break;
      }
      case "--help":
        process.stdout.write(usage());
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  const allowedProviders = new Set(["openstates", "fec"]);
  if (
    values.providers.length === 0 ||
    values.providers.some((provider) => !allowedProviders.has(provider))
  ) {
    throw new Error("--providers must be all or a comma-separated subset of openstates,fec.");
  }

  return values;
}

function assertUniqueSorted(records, idField, provider) {
  const ids = records.map((record) => record?.[idField]);
  if (ids.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error(`${provider} records contain an invalid ${idField}.`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${provider} records contain duplicate ${idField} values.`);
  }

  const sortedIds = [...ids].sort((left, right) => left.localeCompare(right, "en"));
  if (ids.some((id, index) => id !== sortedIds[index])) {
    throw new Error(`${provider} records are not sorted by ${idField}.`);
  }
}

function assertSnapshot(snapshot, provider, expectedCycle) {
  if (snapshot?.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`${provider} snapshot uses an unsupported schema version.`);
  }
  if (snapshot.provider !== provider || !Array.isArray(snapshot.records)) {
    throw new Error(`${provider} snapshot has an unexpected shape.`);
  }
  if (snapshot.recordCount !== snapshot.records.length || snapshot.recordCount < 1) {
    throw new Error(`${provider} snapshot record count is invalid.`);
  }
  if (snapshot.contentHash !== sha256Canonical(snapshot.records)) {
    throw new Error(`${provider} snapshot content hash is invalid.`);
  }

  assertIsoTimestamp(snapshot.freshness?.checkedAt, `${provider}.freshness.checkedAt`);
  assertIsoTimestamp(
    snapshot.freshness?.contentChangedAt,
    `${provider}.freshness.contentChangedAt`,
  );
  if (snapshot.freshness.sourceUpdatedAt !== null) {
    assertIsoTimestamp(
      snapshot.freshness.sourceUpdatedAt,
      `${provider}.freshness.sourceUpdatedAt`,
    );
  }

  if (provider === "openstates") {
    assertUniqueSorted(snapshot.records, "id", provider);
    if (
      snapshot.records.some(
        (person) => person?.jurisdiction?.name !== "Massachusetts",
      )
    ) {
      throw new Error("Open States snapshot contains a non-Massachusetts record.");
    }
  }

  if (provider === "fec") {
    assertUniqueSorted(snapshot.records, "candidate_id", provider);
    if (snapshot.records.some((candidate) => candidate?.state !== "MA")) {
      throw new Error("FEC snapshot contains a non-Massachusetts record.");
    }
    if (expectedCycle && snapshot.scope?.electionCycle !== expectedCycle) {
      throw new Error(
        `FEC snapshot cycle ${snapshot.scope?.electionCycle} does not match ${expectedCycle}.`,
      );
    }
  }

  assertNoSecretMaterial(snapshot, [
    process.env.OPENSTATES_API_KEY,
    process.env.DATA_GOV_API_KEY,
  ]);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifestPath = path.join(options.dataDirectory, "manifest.json");
  const manifest = await readJsonIfPresent(manifestPath);
  if (!manifest) {
    throw new Error(`Missing data manifest at ${manifestPath}.`);
  }
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error("Data manifest uses an unsupported schema version.");
  }
  assertIsoTimestamp(manifest.checkedAt, "manifest.checkedAt");
  assertIsoTimestamp(manifest.contentChangedAt, "manifest.contentChangedAt");
  assertNoSecretMaterial(manifest, [
    process.env.OPENSTATES_API_KEY,
    process.env.DATA_GOV_API_KEY,
  ]);

  for (const requestedProvider of options.providers) {
    if (!manifest.providers?.[requestedProvider]) {
      throw new Error(`Manifest is missing requested provider ${requestedProvider}.`);
    }
  }

  const providersToValidate = Object.keys(manifest.providers ?? {}).sort();
  const expectedCycle = options.electionCycle ?? manifest.scope?.electionCycle;

  const providerHashes = {};
  for (const provider of providersToValidate) {
    const entry = manifest.providers?.[provider];
    if (!entry || entry.status !== "ok" || typeof entry.file !== "string") {
      throw new Error(`Manifest is missing a successful ${provider} entry.`);
    }

    const snapshotPath = path.resolve(options.dataDirectory, entry.file);
    const relativePath = path.relative(options.dataDirectory, snapshotPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(`${provider} snapshot path escapes the data directory.`);
    }

    const snapshotText = await readFile(snapshotPath, "utf8");
    const snapshot = JSON.parse(snapshotText);
    assertSnapshot(snapshot, provider, expectedCycle);

    if (
      entry.contentHash !== snapshot.contentHash ||
      entry.recordCount !== snapshot.recordCount ||
      entry.checkedAt !== snapshot.freshness.checkedAt
    ) {
      throw new Error(`${provider} manifest metadata does not match its snapshot.`);
    }
    providerHashes[provider] = snapshot.contentHash;
  }

  const expectedDatasetHash = sha256Canonical(
    Object.fromEntries(
      Object.entries(providerHashes).sort(([left], [right]) =>
        left.localeCompare(right, "en"),
      ),
    ),
  );
  if (manifest.datasetHash !== expectedDatasetHash) {
    throw new Error("Manifest dataset hash does not match provider snapshots.");
  }

  process.stdout.write(
    `Validated ${providersToValidate.join(", ")} snapshots in ${options.dataDirectory}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Civic data validation failed: ${error.message}\n`);
  process.exitCode = 1;
});
