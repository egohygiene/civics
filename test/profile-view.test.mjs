import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCareerTimelineView,
  buildElectionHistoryView,
  buildProfileView,
  calculateVoteShare,
  formatProfileNumber,
  formatProfilePercent,
  normalizeProfilePhoto,
  resolveProfileSources,
} from "../src/features/profile/profile-view.js";
import {
  emptyProfileFixture,
  profileCandidateFixture,
  profileFixture,
} from "../src/features/profile/profile.fixture.js";

test("candidate photos fail closed until identity and publication are reviewed", () => {
  assert.deepEqual(normalizeProfilePhoto({
    url: "https://example.test/photo.jpg",
  }), {
    url: "https://example.test/photo.jpg",
    thumbnailUrl: "https://example.test/photo.jpg",
    alt: "",
    verificationStatus: "unverified",
    rightsStatus: "unreviewed",
    sourceId: null,
    checkedAt: null,
    embeddedSource: null,
  });

  assert.equal(normalizeProfilePhoto({
    url: "https://example.test/photo.jpg",
    verificationStatus: "verified",
  }).verificationStatus, "unverified", "identity review without rights review stays off");

  assert.equal(normalizeProfilePhoto({
    url: "https://example.test/photo.jpg",
    verificationStatus: "verified",
    rightsStatus: "publishable",
  }).verificationStatus, "verified");

  assert.equal(normalizeProfilePhoto(null).verificationStatus, "unverified");
});

test("vote-share bars prefer exact counts and preserve unknowns", () => {
  assert.equal(calculateVoteShare(25, 100, 99), 25, "exact counts override a supplied rounded share");
  assert.equal(calculateVoteShare(0, 100), 0, "a sourced zero remains a visible zero");
  assert.equal(calculateVoteShare(null, null, 42.4), 42.4, "supplied share is a fallback without counts");
  assert.equal(calculateVoteShare(null, null), null, "missing is not converted to zero");
  assert.equal(formatProfilePercent(null), "Unknown");
  assert.equal(formatProfileNumber(null), "Unknown");
});

test("election history uses one common axis with exact table values", () => {
  const view = buildElectionHistoryView([
    {
      id: "newer",
      date: "2024-11-05",
      office: "Office B",
      electionType: "General",
      candidateVotes: 800,
      totalVotes: 2_000,
      sourceIds: ["results"],
    },
    {
      id: "unknown",
      date: "2022-11-08",
      office: "Office A",
      electionType: "General",
      candidateVotes: null,
      totalVotes: null,
      sourceIds: ["results"],
    },
  ]);

  assert.deepEqual(view.axisTicks, [0, 25, 50, 75, 100]);
  assert.deepEqual(view.rows.map(({ id }) => id), ["unknown", "newer"]);
  assert.equal(view.chartRows[0].candidateWidth, 40);
  assert.equal(view.chartRows[0].otherWidth, 60);
  assert.equal(view.unknownRows[0].voteShare, null);
  assert.match(view.note, /not directly predictive/);
});

test("career ranges share one deterministic review cutoff", () => {
  const view = buildCareerTimelineView([
    { id: "past", title: "Past role", startDate: "2010-01-01", endDate: "2015-01-01" },
    { id: "current", title: "Current role", startDate: "2020-01-01", endDate: null },
    { id: "undated", title: "Undated role", startDate: null, endDate: null },
  ], "2026-08-24");

  assert.equal(view.domain.startDate, "2010-01-01");
  assert.equal(view.domain.endDate, "2026-08-24");
  assert.equal(view.bars.length, 2);
  assert.equal(view.bars.find(({ id }) => id === "current").isCurrent, true);
  assert.equal(view.unrangedRows[0].id, "undated");
  assert.equal(view.axisTicks.length, 5);
  assert.match(view.note, /Aug 24, 2026/);
});

test("imprecise career dates stay visibly imprecise while remaining plottable", () => {
  const view = buildCareerTimelineView([
    { id: "year-role", title: "Year-only role", startDate: "1973", endDate: "1976" },
  ], "2026-08-24");

  assert.equal(view.bars.length, 1);
  assert.equal(view.bars[0].startPrecision, "year");
  assert.equal(view.bars[0].endPrecision, "year");
  assert.equal(view.domain.startDate, "1973-01-01");
  assert.equal(view.domain.endDate, "1976-12-31");
});

test("profile view keeps coverage categorical and source relationships inspectable", () => {
  const view = buildProfileView({ candidate: profileCandidateFixture, profile: profileFixture });

  assert.equal(view.photo.verificationStatus, "verified");
  assert.equal(view.photo.source.id, "official-biography");
  assert.equal(view.facts.length, 4);
  assert.equal(view.timeline.bars.length, 3);
  assert.equal(view.elections.chartRows.length, 3);
  assert.equal(view.evidence.availableCount, 4);
  assert.equal(view.evidence.partialCount, 1);
  assert.equal(view.evidence.openCount, 1);
  assert.equal(Object.hasOwn(view.evidence, "score"), false, "coverage never becomes a candidate score");
  assert.deepEqual(
    resolveProfileSources(["official-biography", "missing"], view.sourceById).map(({ id }) => id),
    ["official-biography"],
  );
});

test("empty profiles render honest empty view models", () => {
  const view = buildProfileView({ candidate: profileCandidateFixture, profile: emptyProfileFixture });

  assert.equal(view.photo.url, null);
  assert.equal(view.photo.verificationStatus, "unverified");
  assert.deepEqual(view.timeline.bars, []);
  assert.deepEqual(view.elections.chartRows, []);
  assert.deepEqual(view.sources, []);
  assert.equal(view.limitations[0], "Profile enrichment has not started.");
});

test("missing fact values remain unknown instead of becoming available", () => {
  const view = buildProfileView({
    candidate: profileCandidateFixture,
    profile: { facts: [{ id: "missing", label: "Missing fact" }] },
  });

  assert.equal(view.facts[0].value, "Unknown");
  assert.equal(view.facts[0].status, "unknown");
});

test("public identifiers retain system, scope, currency, and source joins", () => {
  const view = buildProfileView({
    candidate: profileCandidateFixture,
    profile: {
      identifiers: [{
        id: "fec-id",
        system: "fec-candidate",
        value: "S00000000",
        scope: "Example candidacy",
        current: false,
        sourceId: "fec-source",
      }],
      sources: [{ id: "fec-source", label: "FEC", kind: "finance-regulator", url: "https://example.test/fec" }],
    },
  });

  assert.deepEqual(view.identifiers[0], {
    id: "fec-id",
    system: "fec-candidate",
    systemLabel: "FEC candidate",
    value: "S00000000",
    scope: "Example candidacy",
    current: false,
    sourceIds: ["fec-source"],
  });
  assert.equal(resolveProfileSources(view.identifiers[0].sourceIds, view.sourceById)[0].id, "fec-source");
});
