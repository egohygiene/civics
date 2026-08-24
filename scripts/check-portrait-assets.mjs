#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPortraitRegistry,
  assertPortraitSourceSnapshot,
} from "./lib/portraits.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"));
}

async function fetchAndHash(rendition, sourceRecordId) {
  const response = await fetch(rendition.url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    headers: {
      accept: rendition.mimeType,
      "user-agent": "egohygiene-civics-portrait-integrity-check/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`${sourceRecordId} ${rendition.purpose} returned HTTP ${response.status}.`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (contentType !== rendition.mimeType) {
    throw new Error(
      `${sourceRecordId} ${rendition.purpose} returned ${contentType ?? "no content type"}.`,
    );
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    throw new Error(`${sourceRecordId} ${rendition.purpose} exceeds the image size limit.`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`${sourceRecordId} ${rendition.purpose} exceeds the image size limit.`);
  }
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== rendition.sha256) {
    throw new Error(
      `${sourceRecordId} ${rendition.purpose} changed: expected ${rendition.sha256}, received ${actualHash}.`,
    );
  }
}

async function main() {
  const snapshot = await readJson("data/raw/portraits/ma-primary-2026.json");
  const registry = await readJson("data/sources/portrait-candidate-registry.json");
  assertPortraitSourceSnapshot(snapshot);
  assertPortraitRegistry(registry, snapshot);

  let checked = 0;
  for (const sourceRecord of snapshot.records) {
    for (const rendition of sourceRecord.renditions) {
      await fetchAndHash(rendition, sourceRecord.id);
      checked += 1;
    }
  }
  process.stdout.write(`Verified ${checked} remote portrait renditions against recorded hashes.\n`);
}

main().catch((error) => {
  process.stderr.write(`Portrait asset check failed: ${error.message}\n`);
  process.exitCode = 1;
});
