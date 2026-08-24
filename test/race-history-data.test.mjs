import assert from "node:assert/strict";
import test from "node:test";

import { candidates } from "../src/data/seed.js";
import {
  HISTORICAL_CONTEXT_TRANSFORM,
  buildRaceHistoryView,
  selectClosestHistoricalContext,
} from "../src/lib/race-history-data.js";
import {
  buildElectionHistoryData,
  getSenateCandidateProfile,
} from "../src/lib/senate-profile-data.js";

const senateCandidateIds = new Set(["edward-markey", "seth-moulton", "john-deaton"]);
const senateCandidates = candidates.filter(({ id }) => senateCandidateIds.has(id));

test("closest historical context uses a disclosed office-stage-recency rule", () => {
  const moultonHistory = buildElectionHistoryData(getSenateCandidateProfile("seth-moulton"));
  const selected = selectClosestHistoricalContext(moultonHistory.elections, {
    targetOfficeId: "us-senate-massachusetts",
    targetStage: "primary",
  });

  assert.equal(selected.election.id, "seth-moulton-2014-primary");
  assert.equal(selected.kind, "different-office-same-stage");
  assert.match(HISTORICAL_CONTEXT_TRANSFORM.selectionRule, /same office and stage/);
});

test("race history preserves exact vote pools and explicit non-comparability", () => {
  const view = buildRaceHistoryView({ candidates: senateCandidates });
  const byId = new Map(view.rows.map((row) => [row.candidateId, row]));

  assert.deepEqual(view.axisTicks, [0, 25, 50, 75, 100]);
  assert.equal(view.availableRows.length, 3);
  assert.equal(byId.get("edward-markey").context.id, "edward-markey-2020-primary");
  assert.equal(byId.get("seth-moulton").context.id, "seth-moulton-2014-primary");
  assert.equal(byId.get("john-deaton").context.id, "john-deaton-2024-general");
  assert.equal(byId.get("john-deaton").context.totalVotes, 3413329);
  assert.match(byId.get("john-deaton").context.caution, /not directly comparable/);
  assert.equal(Object.hasOwn(byId.get("john-deaton").context, "score"), false);
  assert.doesNotMatch(JSON.stringify(view), /candidateScore|compatibilityScore|recommendation/i);
});

test("candidates without sourced election history remain unavailable instead of zero", () => {
  const view = buildRaceHistoryView({ candidates: [candidates.find(({ id }) => id === "maura-healey")] });

  assert.equal(view.availableRows.length, 0);
  assert.equal(view.unavailableRows.length, 1);
  assert.equal(view.rows[0].context, null);
});
