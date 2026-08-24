import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { candidates, races } from "../src/data/seed.js";

const coverage = JSON.parse(
  await readFile(new URL("../data/reviewed/ocpf-candidate-coverage.json", import.meta.url), "utf8"),
);
const registry = JSON.parse(
  await readFile(new URL("../data/sources/ocpf-candidate-registry.json", import.meta.url), "utf8"),
);

test("OCPF coverage accounts for every seed candidate exactly once", () => {
  const seedCandidateIds = candidates.map((candidate) => candidate.id).sort();
  const coveredCandidateIds = coverage.candidates.map((candidate) => candidate.candidateId).sort();

  assert.deepEqual(coveredCandidateIds, seedCandidateIds);
  assert.equal(new Set(coveredCandidateIds).size, coveredCandidateIds.length);
  assert.equal(coverage.coverage.seedCandidates, candidates.length);
});

test("OCPF current matches are explicit, unique, and never auto-published", () => {
  const exactMatches = coverage.candidates.filter(
    (candidate) => candidate.matchStatus === "exact_current",
  );
  const cpfIds = exactMatches.map((candidate) => candidate.cpfId);

  assert.equal(coverage.review.autoPublish, false);
  assert.equal(coverage.review.fuzzyMatchingAllowed, false);
  assert.equal(exactMatches.length, coverage.coverage.exactCurrentMatches);
  assert.equal(new Set(cpfIds).size, cpfIds.length);

  for (const candidate of exactMatches) {
    assert.equal(candidate.currentFinanceProvider, "ocpf");
    assert.ok(Number.isSafeInteger(candidate.cpfId));
    assert.match(candidate.sourceUrls[0], new RegExp(`/filer/${candidate.cpfId}$`));
  }
});

test("federal races remain routed to FEC for current-race finance", () => {
  const federalRaceIds = new Set(
    races
      .filter((race) => race.office.startsWith("U.S."))
      .map((race) => race.id),
  );
  const federalCandidates = coverage.candidates.filter((candidate) =>
    federalRaceIds.has(candidate.raceId),
  );

  assert.equal(federalCandidates.length, coverage.coverage.notApplicableCurrentRace);
  for (const candidate of federalCandidates) {
    assert.equal(candidate.matchStatus, "not_applicable_current_race");
    assert.equal(candidate.currentFinanceProvider, "fec");
    assert.equal(candidate.cpfId, undefined);
  }
});

test("review coverage agrees with the adapter's fail-closed OCPF registry", () => {
  // Both ledgers pin the exact identity returned by the filer payload endpoint;
  // display labels from the separate listing endpoint are not used here.
  const exactMatches = new Map(
    coverage.candidates
      .filter((candidate) => candidate.matchStatus === "exact_current")
      .map((candidate) => [candidate.candidateId, candidate]),
  );

  assert.equal(exactMatches.size, registry.candidates.length);
  for (const mapping of registry.candidates) {
    const reviewed = exactMatches.get(mapping.candidateId);
    assert.ok(reviewed, `Missing reviewed mapping for ${mapping.candidateId}`);
    assert.equal(reviewed.cpfId, mapping.cpfId);
    assert.equal(reviewed.ocpfName, mapping.expectedFilerName);
    assert.equal(reviewed.ocpfOffice, mapping.expectedOffice);
    assert.equal(reviewed.ocpfCity, mapping.expectedCity);
    assert.ok(reviewed.sourceUrls.some((url) => url.endsWith(`/filer/${mapping.cpfId}`)));
  }
});
