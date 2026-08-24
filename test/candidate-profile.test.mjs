import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { financeRecords } from "../src/data/finance.js";
import {
  adaptPortraitDataset,
  getCandidatePortrait,
} from "../src/data/portraits.js";
import { candidates, sources } from "../src/data/seed.js";
import { buildCandidateProfile } from "../src/lib/candidate-profile.js";
import {
  getSenateCandidateProfile,
  materializeProfileViewData,
} from "../src/lib/senate-profile-data.js";

async function portraitRecords() {
  const dataset = JSON.parse(await readFile(
    new URL("../public/data/portraits/ma-primary-2026.json", import.meta.url),
    "utf8",
  ));
  return adaptPortraitDataset(dataset);
}

test("candidate profile composition keeps roster, portrait, finance, and history provenance separate", async () => {
  const candidate = candidates.find(({ id }) => id === "edward-markey");
  const portrait = getCandidatePortrait(candidate, await portraitRecords());
  const financeRecord = financeRecords.find(({ candidateId }) => candidateId === candidate.id);
  const profile = buildCandidateProfile({
    ballotSource: sources.democraticCandidates,
    candidate,
    financeRecord,
    portrait,
    senateProfile: materializeProfileViewData(getSenateCandidateProfile(candidate.id)),
  });

  assert.equal(profile.photo.publicationStatus, "published");
  assert.equal(profile.facts[0].id, "edward-markey-roster-listing");
  assert.ok(profile.sources.some(({ id }) => id === sources.democraticCandidates.id));
  assert.ok(profile.sources.some(({ id }) => id === financeRecord.source.id));
  assert.deepEqual(profile.evidence.map(({ id }) => id), [
    "ballot",
    "record",
    "finance",
    "positions",
    "biography",
    "elections",
  ]);
  assert.ok(profile.evidence.find(({ id }) => id === "finance").sourceIds.includes(financeRecord.source.id));
  assert.doesNotMatch(JSON.stringify(profile), /candidateScore|compatibilityScore|recommendation/i);
});

test("unenriched candidates receive explicit empty-state limitations and initials", async () => {
  const candidate = candidates.find(({ id }) => id === "maura-healey");
  const portrait = getCandidatePortrait(candidate, await portraitRecords());
  const profile = buildCandidateProfile({
    ballotSource: sources.democraticCandidates,
    candidate,
    portrait,
  });

  assert.equal(profile.photo.display.kind, "initials");
  assert.match(profile.limitations.join(" "), /not been materialized/);
  assert.match(profile.limitations.join(" "), /initials are shown/);
  assert.equal(profile.evidence.find(({ id }) => id === "finance").sourceIds.length, 0);
});
