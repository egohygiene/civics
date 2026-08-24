#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { candidates } from "../src/data/seed.js";
import {
  assertPortraitDataset,
  materializePortraitDataset,
} from "./lib/portraits.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"));
}

async function main() {
  const snapshot = await readJson("data/raw/portraits/ma-primary-2026.json");
  const registry = await readJson("data/sources/portrait-candidate-registry.json");
  const dataset = materializePortraitDataset({
    candidates,
    snapshot,
    registry,
    generatedAt: snapshot.checkedAt,
    codeRevision: "portrait-registry-v1",
  });
  assertPortraitDataset(dataset, candidates.map((candidate) => candidate.id));
  const outputPath = path.join(
    REPOSITORY_ROOT,
    "public",
    "data",
    "portraits",
    "ma-primary-2026.json",
  );
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Materialized ${dataset.coverage.publishedCount} verified portraits and ${dataset.coverage.initialsFallbackCount} initials fallbacks.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Portrait materialization failed: ${error.message}\n`);
  process.exitCode = 1;
});
