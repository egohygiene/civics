#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SNAPSHOT_SCHEMA_VERSION,
  assertIsoTimestamp,
  assertNoSecretMaterial,
  readJsonIfPresent,
  sha256Canonical,
} from "./lib/civic-data.mjs";
import {
  OCPF_PROVIDER_ID,
  assertFinanceDataset,
  assertOcpfRawRecord,
} from "./lib/ocpf-finance.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_SNAPSHOT_PATH = path.join(
  REPOSITORY_ROOT,
  "data",
  "raw",
  "ocpf",
  "ma-candidate-finance-2026.json",
);
const DEFAULT_OUTPUT_PATH = path.join(
  REPOSITORY_ROOT,
  "public",
  "data",
  "finance",
  "ocpf-ma-2026.json",
);

function usage() {
  return `Usage: node scripts/validate-ocpf-finance.mjs [options]

Options:
  --snapshot <path>    Sanitized OCPF snapshot
  --output <path>      Materialized finance JSON
  --help               Show this help message
`;
}

function parseArguments(argv) {
  const values = {
    snapshotPath: DEFAULT_SNAPSHOT_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
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
      case "--snapshot":
        values.snapshotPath = path.resolve(nextValue());
        break;
      case "--output":
        values.outputPath = path.resolve(nextValue());
        break;
      case "--help":
        process.stdout.write(usage());
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }
  return values;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const snapshot = await readJsonIfPresent(options.snapshotPath);
  if (!snapshot) throw new Error(`Missing OCPF snapshot at ${options.snapshotPath}.`);
  if (
    snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION ||
    snapshot.provider !== OCPF_PROVIDER_ID ||
    !Array.isArray(snapshot.records) ||
    snapshot.recordCount !== snapshot.records.length
  ) {
    throw new Error("OCPF snapshot metadata is invalid.");
  }
  if (snapshot.contentHash !== sha256Canonical(snapshot.records)) {
    throw new Error("OCPF snapshot content hash is invalid.");
  }
  assertIsoTimestamp(snapshot.freshness?.checkedAt, "OCPF snapshot checkedAt");
  assertIsoTimestamp(
    snapshot.freshness?.contentChangedAt,
    "OCPF snapshot contentChangedAt",
  );
  snapshot.records.forEach((record) => assertOcpfRawRecord(record));
  const candidateIds = snapshot.records.map((record) => record.candidateId);
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new Error("OCPF snapshot contains duplicate candidate IDs.");
  }

  const dataset = await readJsonIfPresent(options.outputPath);
  if (!dataset) throw new Error(`Missing OCPF finance view at ${options.outputPath}.`);
  assertFinanceDataset(dataset);
  if (
    dataset.candidates.length !== snapshot.recordCount ||
    dataset.source.contentHash !== snapshot.contentHash
  ) {
    throw new Error("OCPF finance view does not match its sanitized snapshot.");
  }
  for (let index = 0; index < snapshot.records.length; index += 1) {
    const record = snapshot.records[index];
    const candidate = dataset.candidates[index];
    if (
      candidate.candidateId !== record.candidateId ||
      candidate.provider.entityId !== String(record.cpfId) ||
      candidate.source.contentHash !== record.contentHash
    ) {
      throw new Error(`OCPF finance view identity mismatch at ${record.candidateId}.`);
    }
  }
  assertNoSecretMaterial(snapshot);
  assertNoSecretMaterial(dataset);
  process.stdout.write(
    `Validated ${dataset.candidates.length} sanitized OCPF finance records and materialized views.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`OCPF finance validation failed: ${error.message}\n`);
  process.exitCode = 1;
});
