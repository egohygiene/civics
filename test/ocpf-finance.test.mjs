import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildSnapshot, sha256Canonical } from "../scripts/lib/civic-data.mjs";
import {
  assertFinanceDataset,
  assertOcpfRawRecord,
  assertOcpfRegistry,
  materializeOcpfFinanceDataset,
  parseOcpfDate,
  sanitizeOcpfPayload,
} from "../scripts/lib/ocpf-finance.mjs";

const checkedAt = "2026-08-24T13:30:00.000Z";
const mapping = {
  candidateId: "maura-healey",
  raceId: "governor",
  cpfId: 15710,
  expectedFilerName: "Maura T. Healey",
  expectedOffice: "Governor",
  expectedCity: "Arlington",
  matchStatus: "automated_checks_passed",
};

function providerPayload() {
  return {
    filer: {
      cpfId: 15710,
      isActive: true,
      fullName: "Maura T. Healey",
      committeeName: "Healey Committee",
      officeSoughtDescription: "Governor",
      partyAffiliation: "Democratic",
      filerPhotoUrl: "https://example.invalid/photo.jpg",
      candidate: {
        city: "Arlington",
        streetAddress: "not retained",
        phoneNumber: "not retained",
        emailAddress: "not-retained@example.invalid",
      },
      treasurer: {
        fullName: "not retained",
      },
    },
    ytdReport: {
      cpfId: 15710,
      bankReportId: 1036462,
      reportYearFirstDayDate: "1/1/2026",
      bankReportEndDate: "7/31/2026",
      receiptsYtdNumeric: 3049534.44,
      expendituresYtdNumeric: 1071288.16,
      currentCashOnHandNumeric: 6602136.91,
      startBalanceNumeric: 2640397.35,
    },
    raceActivityReports: [
      {
        cpfId: 15710,
        expendituresYtdNumeric: 2071288.16,
      },
    ],
  };
}

function snapshotFor(record, retrievalTime = checkedAt, previousSnapshot = null) {
  return buildSnapshot({
    provider: "ocpf",
    dataset: "massachusetts-candidate-finance-ytd",
    scope: {
      country: "US",
      state: "MA",
      electionCycle: 2026,
    },
    source: {
      name: "Massachusetts Office of Campaign and Political Finance Public API",
      endpoint: "https://api.ocpf.us/filer/payload/{cpfId}",
      parameters: {
        cpfIds: [15710],
      },
    },
    records: [record],
    checkedAt: retrievalTime,
    sourceUpdatedAt: null,
    previousSnapshot,
  });
}

test("the checked OCPF identity registry is deterministic and fuzzy matching is disabled", async () => {
  const registry = JSON.parse(
    await readFile("data/sources/ocpf-candidate-registry.json", "utf8"),
  );
  const coverage = JSON.parse(
    await readFile("data/reviewed/ocpf-candidate-coverage.json", "utf8"),
  );
  const snapshot = JSON.parse(
    await readFile("data/raw/ocpf/ma-candidate-finance-2026.json", "utf8"),
  );
  assert.doesNotThrow(() => assertOcpfRegistry(registry));
  assert.equal(registry.candidates.length, 18);
  assert.equal(registry.matchPolicy.automaticFuzzyMatchingAllowed, false);
  assert.equal(registry.matchPolicy.humanReviewRequiredForPublication, true);
  assert.deepEqual(
    registry.candidates.map(({ candidateId, cpfId }) => ({ candidateId, cpfId })),
    coverage.candidates
      .filter((candidate) => candidate.matchStatus === "exact_current")
      .map(({ candidateId, cpfId }) => ({ candidateId, cpfId }))
      .sort((left, right) => left.candidateId.localeCompare(right.candidateId, "en")),
  );
  for (const mapping of registry.candidates) {
    const record = snapshot.records.find(
      (candidate) => candidate.candidateId === mapping.candidateId,
    );
    assert.ok(record, `Missing snapshot record for ${mapping.candidateId}`);
    assert.equal(record.cpfId, mapping.cpfId);
    assert.equal(record.filerName, mapping.expectedFilerName);
    assert.equal(record.office, mapping.expectedOffice);
  }
});

test("OCPF dates normalize without applying a runner timezone", () => {
  assert.equal(parseOcpfDate("7/31/2026", "endDate"), "2026-07-31");
  assert.equal(parseOcpfDate("2026-07-31T00:00:00", "endDate"), "2026-07-31");
  assert.equal(parseOcpfDate("", "endDate"), null);
  assert.throws(() => parseOcpfDate("July 31", "endDate"), /unsupported date format/);
});

test("sanitization retains only bounded finance and identity fields", () => {
  const record = sanitizeOcpfPayload(providerPayload(), mapping);
  assert.doesNotThrow(() => assertOcpfRawRecord(record));
  assert.deepEqual(record.ytdReport, {
    reportId: "1036462",
    startDate: "2026-01-01",
    endDate: "2026-07-31",
    receipts: 3049534.44,
    disbursements: 1071288.16,
    cashOnHand: 6602136.91,
    startingBalance: 2640397.35,
  });
  const serialized = JSON.stringify(record);
  for (const forbidden of [
    "streetAddress",
    "phoneNumber",
    "emailAddress",
    "treasurer",
    "raceActivityReports",
    "filerPhotoUrl",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.equal(record.contentHash, sha256Canonical({
    candidateId: record.candidateId,
    raceId: record.raceId,
    cpfId: record.cpfId,
    filerName: record.filerName,
    committeeName: record.committeeName,
    office: record.office,
    party: record.party,
    isActive: record.isActive,
    matchStatus: record.matchStatus,
    ytdReport: record.ytdReport,
  }));
});

test("identity drift fails closed instead of attaching finance to the wrong candidate", () => {
  const payload = providerPayload();
  payload.filer.fullName = "A Different Person";
  assert.throws(
    () => sanitizeOcpfPayload(payload, mapping),
    /name changed/,
  );
});

test("materialization exposes comparable YTD totals and explicit research gaps", () => {
  const record = sanitizeOcpfPayload(providerPayload(), mapping);
  const snapshot = snapshotFor(record);
  const dataset = materializeOcpfFinanceDataset(snapshot, "test-revision");
  assert.doesNotThrow(() => assertFinanceDataset(dataset));

  const candidate = dataset.candidates[0];
  assert.equal(candidate.candidateId, "maura-healey");
  assert.equal(candidate.status, "partial");
  assert.equal(candidate.period.basis, "year_to_date");
  assert.equal(candidate.period.asOf, "2026-07-31");
  assert.equal(candidate.totals.receipts.value, 3049534.44);
  assert.equal(candidate.totals.disbursements.value, 1071288.16);
  assert.equal(candidate.totals.debtsOwed.status, "not_available");
  assert.equal(candidate.receiptComposition.status, "not_researched");
  assert.equal(candidate.outsideSpending.status, "not_researched");
  assert.equal(candidate.timeSeries.receipts.status, "not_researched");
  assert.equal(candidate.comparability.status, "limited");
  assert.deepEqual(candidate.synthesisRefs, []);
  assert.equal(candidate.review.status, "needs_review");
});

test("tampered raw and materialized hashes are rejected", () => {
  const record = sanitizeOcpfPayload(providerPayload(), mapping);
  const tamperedRecord = structuredClone(record);
  tamperedRecord.ytdReport.receipts += 1;
  assert.throws(() => assertOcpfRawRecord(tamperedRecord), /content hash is invalid/);

  const dataset = materializeOcpfFinanceDataset(snapshotFor(record), null);
  dataset.candidates[0].totals.receipts.value += 1;
  assert.throws(() => assertFinanceDataset(dataset), /content hash is invalid/);
});

test("a source check without changed provider records preserves semantic hashes", () => {
  const record = sanitizeOcpfPayload(providerPayload(), mapping);
  const firstSnapshot = snapshotFor(record);
  const secondSnapshot = snapshotFor(
    record,
    "2026-08-25T13:30:00.000Z",
    firstSnapshot,
  );
  const firstDataset = materializeOcpfFinanceDataset(firstSnapshot, "revision-a");
  const secondDataset = materializeOcpfFinanceDataset(secondSnapshot, "revision-b");

  assert.equal(secondSnapshot.contentHash, firstSnapshot.contentHash);
  assert.equal(
    secondSnapshot.freshness.contentChangedAt,
    firstSnapshot.freshness.contentChangedAt,
  );
  assert.equal(secondDataset.contentHash, firstDataset.contentHash);
  assert.notEqual(
    secondDataset.freshness.checkedAt,
    firstDataset.freshness.checkedAt,
  );
});
