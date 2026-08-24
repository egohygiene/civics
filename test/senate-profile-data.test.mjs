import assert from "node:assert/strict";
import test from "node:test";
import {
  senateCandidateProfileRecords,
  senateCandidateProfilesById,
  senateProfileSources,
} from "../src/data/senate-candidate-profiles.js";
import {
  buildCareerTimelineData,
  buildElectionHistoryData,
  getSenateCandidateProfile,
  materializeProfileViewData,
} from "../src/lib/senate-profile-data.js";

const EXPECTED_IDS = new Map([
  ["edward-markey", ["M000133", "S4MA00028", "C00196774"]],
  ["seth-moulton", ["M001196", "S6MA00296", "H4MA06090", "P00011866", "C00547240"]],
  ["john-deaton", ["S6MA00304", "S4MA00358", "C00926139", "C00870337"]],
]);

function sourcedRecords(profile) {
  return [
    ...profile.identifiers,
    ...profile.links,
    ...profile.facts,
    ...profile.careerTimeline,
    ...profile.electionHistory,
  ];
}

test("Senate profile registry covers the three seeded candidates with exact public IDs", () => {
  assert.equal(senateCandidateProfileRecords.length, 3);
  assert.deepEqual(Object.keys(senateCandidateProfilesById).sort(), [...EXPECTED_IDS.keys()].sort());

  for (const [candidateId, expectedValues] of EXPECTED_IDS) {
    const profile = getSenateCandidateProfile(candidateId);
    assert.ok(profile);
    assert.deepEqual(profile.identifiers.map(({ value }) => value), expectedValues);
  }
  assert.equal(getSenateCandidateProfile("not-a-candidate"), null);
});

test("every substantive profile record carries a resolvable full citation and review state", () => {
  assert.ok(Object.values(senateProfileSources).every(({ url }) => (
    !url.includes("sec.state.ma.us") && !url.includes("electionstats.state.ma.us")
  )), "this slice must not automate Massachusetts Secretary result pages");

  for (const profile of senateCandidateProfileRecords) {
    assert.equal(profile.reviewState, "needs-maintainer-review");
    for (const record of sourcedRecords(profile)) {
      assert.equal(record.sourceIds.length, 1, `${profile.candidateId}/${record.id} source count`);
      const source = senateProfileSources[record.citation.sourceId];
      assert.ok(source, `${profile.candidateId}/${record.id} source resolves`);
      assert.equal(record.citation.url, source.url);
      assert.equal(record.citation.checkedAt, "2026-08-24");
      assert.equal(record.citation.reviewState, "needs-maintainer-review");
      assert.match(record.citation.url, /^https:\/\//);
      for (const option of record.options ?? []) {
        assert.deepEqual(option.sourceIds, record.sourceIds);
        assert.deepEqual(option.citation, record.citation);
      }
    }
  }
});

test("election result records reconcile exactly to their declared candidate-vote pools", () => {
  for (const profile of senateCandidateProfileRecords) {
    for (const election of profile.electionHistory) {
      const optionTotal = election.options
        .filter(({ countsTowardShare }) => countsTowardShare)
        .reduce((total, { votes }) => total + votes, 0);
      assert.equal(optionTotal, election.totals.candidateVotePool, election.id);
      assert.ok(election.options.some(({ id }) => id === election.candidateOptionId), election.id);
      if (election.totals.ballotsCast !== null) {
        assert.equal(
          election.totals.candidateVotePool + election.totals.blankBallots,
          election.totals.ballotsCast,
          election.id,
        );
      }
    }
  }
});

test("career timeline transformation sorts imprecise dates without inventing day precision", () => {
  const markey = buildCareerTimelineData(getSenateCandidateProfile("edward-markey"));
  assert.deepEqual(markey.entries.map(({ id }) => id), [
    "edward-markey-ma-house",
    "edward-markey-us-house",
    "edward-markey-us-senate",
  ]);
  assert.equal(markey.entries[0].temporal.start.precision, "year");
  assert.equal(markey.entries[0].period.start, "1973");
  assert.equal(markey.entries[2].temporal.isCurrent, true);
  assert.equal(markey.unresolved.length, 0);
  assert.deepEqual(Object.keys(markey.lanes), ["public-office"]);
});

test("election history transformation derives shares and preserves comparability cautions", () => {
  const deaton = buildElectionHistoryData(getSenateCandidateProfile("john-deaton"));
  assert.equal(deaton.elections.length, 1);
  assert.equal(deaton.elections[0].candidateVotes, 1365440);
  assert.equal(deaton.elections[0].shareDenominator, 3413329);
  assert.ok(Math.abs(deaton.elections[0].candidateShare - (1365440 / 3413329)) < Number.EPSILON);
  assert.equal(deaton.elections[0].nonCandidateBallots.blank, 99601);
  assert.equal(deaton.elections[0].comparability.status, "same-office-different-stage");

  const moulton = buildElectionHistoryData(getSenateCandidateProfile("seth-moulton"));
  assert.deepEqual(moulton.elections.map(({ date }) => date), ["2014-09-09", "2014-11-04", "2024-11-05"]);
  assert.equal(moulton.elections.at(-1).comparability.status, "different-office-uncontested");
  assert.equal(moulton.elections.at(-1).visualizationRole, "historical-context-only");
});

test("materialized profile data remains source-complete and geometry-free", () => {
  const view = materializeProfileViewData(getSenateCandidateProfile("edward-markey"));
  assert.equal(view.candidateId, "edward-markey");
  assert.ok(view.sources.length >= 5);
  assert.equal(view.elections[1].voteShare, (782694 / 1413988) * 100);
  assert.ok(view.elections.every((election) => !Object.hasOwn(election, "width")));
  assert.ok(view.timeline.every((entry) => !Object.hasOwn(entry, "offsetPercent")));

  const serialized = JSON.stringify(view);
  assert.doesNotMatch(serialized, /candidateScore|compatibilityScore|recommendation/i);
});
