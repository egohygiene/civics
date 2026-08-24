import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { candidates } from "../src/data/seed.js";
import {
  adaptPortraitDataset,
  getCandidatePortrait,
  getPortraitAttribution,
  isPublishablePortrait,
} from "../src/data/portraits.js";
import {
  assertPortraitDataset,
  assertPortraitRegistry,
  assertPortraitSourceSnapshot,
  materializePortraitDataset,
} from "../scripts/lib/portraits.mjs";

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8"));
}

test("portrait source, registry, and public view pass fail-closed validation", async () => {
  const snapshot = await readJson("data/raw/portraits/ma-primary-2026.json");
  const registry = await readJson("data/sources/portrait-candidate-registry.json");
  const published = await readJson("public/data/portraits/ma-primary-2026.json");

  assert.doesNotThrow(() => assertPortraitSourceSnapshot(snapshot));
  assert.doesNotThrow(() => assertPortraitRegistry(registry, snapshot));
  assert.doesNotThrow(() =>
    assertPortraitDataset(published, candidates.map((candidate) => candidate.id)),
  );
  assert.equal(published.coverage.candidateCount, candidates.length);
  assert.equal(published.coverage.publishedCount, 2);
  assert.equal(published.coverage.reviewRequiredCount, 1);
  assert.equal(published.coverage.initialsFallbackCount, 26);
});

test("only exact Bioguide joins are initially publishable", async () => {
  const published = await readJson("public/data/portraits/ma-primary-2026.json");
  const publishableIds = published.portraits
    .filter((portrait) => portrait.publicationStatus === "published")
    .map((portrait) => portrait.candidateId)
    .sort();

  assert.deepEqual(publishableIds, ["edward-markey", "seth-moulton"]);
  for (const portrait of published.portraits.filter(
    (record) => record.publicationStatus === "published",
  )) {
    assert.equal(isPublishablePortrait(portrait), true);
    assert.equal(portrait.identityVerification.scope, "portrait_subject_only");
    assert.equal(portrait.rights.status, "verified");
    assert.ok(portrait.rights.license);
    assert.ok(portrait.rights.attribution);
    assert.match(portrait.source.checkedAt, /^2026-08-24T/);
  }
});

test("Deaton research lead is retained without exposing an unreviewed face", async () => {
  const snapshot = await readJson("data/raw/portraits/ma-primary-2026.json");
  const published = await readJson("public/data/portraits/ma-primary-2026.json");
  const rawDeaton = snapshot.records.find((record) => record.id.includes("john-deaton"));
  const publicDeaton = published.portraits.find(
    (portrait) => portrait.candidateId === "john-deaton",
  );

  assert.equal(rawDeaton.rightsDeclaration.license, "CC BY 3.0");
  assert.equal(publicDeaton.publicationStatus, "review_required");
  assert.equal(publicDeaton.identityVerification.status, "needs_review");
  assert.equal(publicDeaton.display.kind, "initials");
  assert.equal(publicDeaton.display.imageUrl, null);
  assert.equal(publicDeaton.display.thumbnailUrl, null);
  assert.equal(isPublishablePortrait(publicDeaton), false);
});

test("materialized portrait view is deterministic", async () => {
  const snapshot = await readJson("data/raw/portraits/ma-primary-2026.json");
  const registry = await readJson("data/sources/portrait-candidate-registry.json");
  const published = await readJson("public/data/portraits/ma-primary-2026.json");
  const generated = materializePortraitDataset({
    candidates,
    snapshot,
    registry,
    generatedAt: snapshot.checkedAt,
    codeRevision: "portrait-registry-v1",
  });

  assert.deepEqual(generated, published);
});

test("client adapter downgrades a malformed published record to initials", async () => {
  const published = await readJson("public/data/portraits/ma-primary-2026.json");
  const unsafe = structuredClone(published);
  const markey = unsafe.portraits.find((portrait) => portrait.candidateId === "edward-markey");
  markey.rights.attribution = null;
  const adapted = adaptPortraitDataset(unsafe);
  const adaptedMarkey = adapted.find((portrait) => portrait.candidateId === "edward-markey");

  assert.equal(adaptedMarkey.publicationStatus, "review_required");
  assert.equal(adaptedMarkey.display.kind, "initials");
  assert.equal(adaptedMarkey.display.imageUrl, null);
  assert.equal(adaptedMarkey.identityVerification.status, "unverified");
});

test("candidate helper preserves attribution for verified images and initials otherwise", async () => {
  const published = await readJson("public/data/portraits/ma-primary-2026.json");
  const adapted = adaptPortraitDataset(published);
  const markeyCandidate = candidates.find((candidate) => candidate.id === "edward-markey");
  const deatonCandidate = candidates.find((candidate) => candidate.id === "john-deaton");
  const markey = getCandidatePortrait(markeyCandidate, adapted);
  const deaton = getCandidatePortrait(deatonCandidate, adapted);

  assert.equal(markey.display.kind, "image");
  assert.match(markey.display.imageUrl, /M000133\.jpg$/);
  assert.equal(getPortraitAttribution(markey).license, "Public domain in the United States");
  assert.equal(deaton.display.kind, "initials");
  assert.equal(deaton.display.imageUrl, null);
  assert.equal(getPortraitAttribution(deaton), null);
});

test("registry cannot publish a portrait with an unverified identity join", async () => {
  const snapshot = await readJson("data/raw/portraits/ma-primary-2026.json");
  const registry = await readJson("data/sources/portrait-candidate-registry.json");
  const unsafe = structuredClone(registry);
  const deaton = unsafe.records.find((record) => record.candidateId === "john-deaton");
  deaton.publicationDecision = "publish";

  assert.throws(
    () => assertPortraitRegistry(unsafe, snapshot),
    /cannot publish without verified identity and rights/,
  );
});
