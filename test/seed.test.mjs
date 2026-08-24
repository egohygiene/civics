import assert from "node:assert/strict";
import test from "node:test";
import { candidates, countyNames, election, races, sources } from "../src/data/seed.js";

test("seed candidates have unique stable identifiers", () => {
  const ids = candidates.map((candidate) => candidate.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every race candidate resolves to a candidate record", () => {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  for (const race of races) {
    for (const id of [...race.democratic, ...race.republican]) {
      assert.ok(candidateIds.has(id), `${race.id} references missing candidate ${id}`);
    }
  }
});

test("every candidate exposes the same evidence layers", () => {
  const expected = ["ballot", "finance", "positions", "record"];
  for (const candidate of candidates) {
    assert.deepEqual(Object.keys(candidate.evidence).sort(), expected);
  }
});

test("seed election retains authoritative sources and Massachusetts counties", () => {
  assert.ok(election.sourceIds.includes(sources.ballot.id));
  assert.ok(election.sourceIds.includes(sources.calendar.id));
  assert.equal(Object.keys(countyNames).length, 14);
});

test("Wilmington proof includes 13 races and 28 listed candidates", () => {
  assert.equal(races.length, 13);
  assert.equal(candidates.length, 28);
  assert.equal(candidates.filter((candidate) => candidate.party === "democratic").length, 20);
  assert.equal(candidates.filter((candidate) => candidate.party === "republican").length, 8);
  assert.equal(races.filter((race) => race.scope === "statewide").length, 7);
  assert.equal(races.filter((race) => race.scope === "Wilmington proof").length, 6);
});
