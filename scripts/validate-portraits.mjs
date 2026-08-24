#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { candidates } from "../src/data/seed.js";
import {
  assertPortraitDataset,
  assertPortraitRegistry,
  assertPortraitSourceSnapshot,
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
  const published = await readJson("public/data/portraits/ma-primary-2026.json");
  assertPortraitSourceSnapshot(snapshot);
  assertPortraitRegistry(registry, snapshot);
  assertPortraitDataset(published, candidates.map((candidate) => candidate.id));

  const expected = materializePortraitDataset({
    candidates,
    snapshot,
    registry,
    generatedAt: snapshot.checkedAt,
    codeRevision: "portrait-registry-v1",
  });
  if (JSON.stringify(published) !== JSON.stringify(expected)) {
    throw new Error("Published portrait view is stale; run node scripts/materialize-portraits.mjs.");
  }
  process.stdout.write(
    `Validated ${published.coverage.candidateCount} portrait states with ${published.coverage.publishedCount} publishable images.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Portrait validation failed: ${error.message}\n`);
  process.exitCode = 1;
});
