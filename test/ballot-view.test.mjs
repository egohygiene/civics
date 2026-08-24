import assert from "node:assert/strict";
import test from "node:test";
import { candidates, races } from "../src/data/seed.js";
import {
  EVIDENCE_KEYS,
  buildBallotRows,
  describeEvidence,
  filterBallotRows,
  summarizeBallotRows,
} from "../src/lib/ballot-view.js";

test("ballot atlas preserves the statewide and Wilmington race split", () => {
  assert.equal(filterBallotRows(races, "statewide").length, 7);
  assert.equal(filterBallotRows(races, "local").length, 6);
  assert.equal(filterBallotRows(races).length, 13);
});

test("ballot atlas resolves every candidate and summarizes roster lanes", () => {
  const rows = buildBallotRows(races, candidates);
  const summary = summarizeBallotRows(rows);

  assert.deepEqual(summary, {
    choiceRaces: 4,
    emptyLanes: 6,
    listings: 28,
  });
  assert.equal(rows[0].democraticCandidates[0].id, "edward-markey");
  assert.equal(rows[0].republicanCandidates[0].id, "john-deaton");
});

test("compact evidence descriptions retain all four non-scoring states", () => {
  const labels = Object.fromEntries(EVIDENCE_KEYS.map((key) => [key, key]));
  const statuses = {
    available: "Available",
    queued: "Queued",
    researching: "Researching",
    verified: "Verified",
  };
  const description = describeEvidence(candidates[0].evidence, labels, statuses);

  for (const key of EVIDENCE_KEYS) {
    assert.match(description, new RegExp(`${key}:`, "i"));
  }
  assert.doesNotMatch(description, /score|percent|rank/i);
});
