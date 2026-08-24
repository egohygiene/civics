#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RequestBudget,
  assertExistingSnapshotIntegrity,
  assertNoSecretMaterial,
  buildSnapshot,
  fetchJson,
  parsePositiveInteger,
  readJsonIfPresent,
  writeJsonFilesAtomically,
} from "./lib/civic-data.mjs";
import {
  OCPF_API_BASE_URL,
  OCPF_PROVIDER_ID,
  assertFinanceDataset,
  assertOcpfRawRecord,
  assertOcpfRegistry,
  materializeOcpfFinanceDataset,
  sanitizeOcpfPayload,
} from "./lib/ocpf-finance.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const DEFAULT_REGISTRY_PATH = path.join(
  REPOSITORY_ROOT,
  "data",
  "sources",
  "ocpf-candidate-registry.json",
);
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
const REQUEST_DELAY_MILLISECONDS = 100;

function usage() {
  return `Usage: node scripts/refresh-ocpf-finance.mjs [options]

Options:
  --registry <path>          Reviewed CPF identity registry
  --snapshot <path>          Sanitized provider snapshot output
  --output <path>            Materialized finance JSON output
  --max-requests <number>    Hard OCPF request cap (default: 30)
  --now <ISO timestamp>      Fixed retrieval timestamp
  --code-revision <value>    Git revision recorded in provenance
  --help                     Show this help message
`;
}

function parseArguments(argv) {
  const values = {
    registryPath: DEFAULT_REGISTRY_PATH,
    snapshotPath: DEFAULT_SNAPSHOT_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    maxRequests: 30,
    now: null,
    codeRevision: process.env.GITHUB_SHA?.trim() || null,
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
      case "--registry":
        values.registryPath = path.resolve(nextValue());
        break;
      case "--snapshot":
        values.snapshotPath = path.resolve(nextValue());
        break;
      case "--output":
        values.outputPath = path.resolve(nextValue());
        break;
      case "--max-requests":
        values.maxRequests = parsePositiveInteger(nextValue(), argument);
        break;
      case "--now":
        values.now = nextValue();
        break;
      case "--code-revision":
        values.codeRevision = nextValue();
        break;
      case "--help":
        process.stdout.write(usage());
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  const now = values.now ? new Date(values.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("--now must be an ISO-8601 timestamp.");
  }
  values.now = now.toISOString();
  if (values.maxRequests < 18) {
    throw new Error("--max-requests must allow at least one request per mapped candidate.");
  }
  return values;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retrieveOcpfRecords(registry, requestLimit) {
  const budget = new RequestBudget("OCPF", requestLimit);
  const records = [];

  for (const [index, mapping] of registry.candidates.entries()) {
    const url = new URL(`/filer/payload/${mapping.cpfId}`, OCPF_API_BASE_URL);
    const payload = await fetchJson({
      provider: "OCPF",
      url,
      budget,
    });
    const record = sanitizeOcpfPayload(payload, mapping);
    assertOcpfRawRecord(record);
    records.push(record);
    if (index < registry.candidates.length - 1) {
      await delay(REQUEST_DELAY_MILLISECONDS);
    }
  }

  return {
    records,
    requestsUsed: budget.used,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const registry = await readJsonIfPresent(options.registryPath);
  if (!registry) {
    throw new Error(`Missing OCPF candidate registry at ${options.registryPath}.`);
  }
  assertOcpfRegistry(registry);

  const previousSnapshot = await readJsonIfPresent(options.snapshotPath);
  assertExistingSnapshotIntegrity(previousSnapshot, OCPF_PROVIDER_ID);
  previousSnapshot?.records.forEach((record) => assertOcpfRawRecord(record));
  const previousDataset = await readJsonIfPresent(options.outputPath);
  if (previousDataset) assertFinanceDataset(previousDataset);

  const result = await retrieveOcpfRecords(registry, options.maxRequests);
  const snapshot = buildSnapshot({
    provider: OCPF_PROVIDER_ID,
    dataset: "massachusetts-candidate-finance-ytd",
    scope: {
      country: "US",
      state: "MA",
      electionCycle: registry.electionCycle,
      identityRegistryCheckedAt: registry.checkedAt,
    },
    source: {
      name: "Massachusetts Office of Campaign and Political Finance Public API",
      endpoint: `${OCPF_API_BASE_URL}/filer/payload/{cpfId}`,
      parameters: {
        cpfIds: registry.candidates.map((candidate) => candidate.cpfId),
      },
    },
    records: result.records,
    checkedAt: options.now,
    sourceUpdatedAt: null,
    previousSnapshot,
  });
  const dataset = materializeOcpfFinanceDataset(snapshot, options.codeRevision);
  assertNoSecretMaterial(snapshot);
  assertNoSecretMaterial(dataset);

  await writeJsonFilesAtomically(
    new Map([
      [options.snapshotPath, snapshot],
      [options.outputPath, dataset],
    ]),
  );

  const unchanged = previousSnapshot?.contentHash === snapshot.contentHash;
  process.stdout.write(
    `OCPF finance refresh completed: ${dataset.candidates.length} candidates, ${result.requestsUsed} request(s), ${unchanged ? "unchanged" : "changed"} content, ${snapshot.contentHash}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`OCPF finance refresh failed: ${error.message}\n`);
  process.exitCode = 1;
});
