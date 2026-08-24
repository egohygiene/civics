import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinanceView,
  buildLinePoints,
  dollarsToCents,
  formatExactUsd,
  normalizeFinanceView,
  normalizeFinanceMetric,
  percentageOf,
  pointsToPath,
} from "../src/features/finance/finance-view.js";

const candidates = [
  { id: "candidate-a", name: "Candidate A", initials: "CA", party: "Democratic" },
  { id: "candidate-b", name: "Candidate B", initials: "CB", party: "Republican" },
  { id: "candidate-c", name: "Candidate C", initials: "CC", party: "Independent" },
];

const records = [
  {
    candidateId: "candidate-a",
    status: "available",
    provider: "Test regulator",
    period: { startDate: "2025-01-01", endDate: "2026-06-30", cycle: 2026, asOf: "2026-08-24T12:00:00Z" },
    totals: { receipts: "1234.56", disbursements: 700, cashOnHand: 534.56, debtsOwed: 0 },
    receiptComposition: [{ id: "individuals", label: "Individuals", amount: "1234.56" }],
    outsideSpending: { status: "available", support: 125, oppose: 50 },
    series: [
      { date: "2025-06-30", receipts: 500, disbursements: 200 },
      { date: "2026-06-30", receipts: 1234.56, disbursements: 700 },
      { date: "2026-09-30", receipts: 1500, disbursements: 900 },
    ],
    source: { label: "Candidate filing", url: "https://example.test/a", checkedAt: "2026-08-24", recordIds: ["A-1"] },
  },
  {
    candidateId: "candidate-b",
    status: "available",
    provider: "Test regulator",
    period: { startDate: "2025-01-01", endDate: "2026-06-30", cycle: 2026, asOf: "2026-08-24T12:00:00Z" },
    totals: { receipts: 900, disbursements: 450, cashOnHand: 450, debtsOwed: null },
    series: [{ date: "2026-06-30", receipts: 900, disbursements: 450 }],
    source: { label: "Candidate filing", url: "https://example.test/b", checkedAt: "2026-08-24", recordIds: ["B-1"] },
  },
  {
    candidateId: "candidate-c",
    status: "partial",
    provider: "Test regulator",
    period: { startDate: "2026-01-01", endDate: "2026-06-30", cycle: 2026, asOf: "2026-08-24T12:00:00Z" },
    totals: { receipts: 500, disbursements: 100, cashOnHand: 400, debtsOwed: 0 },
    source: { label: "Candidate filing", url: "https://example.test/c", checkedAt: "2026-08-24", recordIds: ["C-1"] },
  },
];

test("finance money values preserve exact cents and visible zeroes", () => {
  assert.equal(dollarsToCents("1234.56"), 123456);
  assert.equal(dollarsToCents(534.56), 53456);
  assert.deepEqual(normalizeFinanceMetric(0), { amountCents: 0, status: "available" });
  assert.equal(formatExactUsd(123456), "$1,234.56");
  assert.equal(formatExactUsd(null), "Unknown");
});

test("race finance view joins records and excludes mismatched periods", () => {
  const normalized = normalizeFinanceView(buildFinanceView({
    candidates,
    records,
    id: "test-race-finance",
    title: "Test race finance",
  }));

  assert.deepEqual(normalized.comparableCandidates.map(({ candidateId }) => candidateId), [
    "candidate-a",
    "candidate-b",
  ]);
  assert.equal(normalized.candidates[2].comparison.hasSameCutoff, true);
  assert.equal(normalized.candidates[2].comparison.hasSameStart, false);
  assert.match(normalized.candidates[2].comparison.reason, /starts 2026-01-01/);
  assert.equal(normalized.candidates[0].series.length, 2, "post-cutoff points are removed");
  assert.equal(normalized.candidates[1].totals.debts.amountCents, null, "unknown is not converted to zero");
  assert.equal(normalized.sources.length, 3);
});

test("line helpers use one scale and produce deterministic SVG paths", () => {
  const points = buildLinePoints(
    [
      { date: "2025-01-01", receiptsCents: 0 },
      { date: "2026-01-01", receiptsCents: 10000 },
    ],
    "receipts",
    { width: 200, height: 100, top: 10, right: 10, bottom: 10, left: 20 },
    { start: "2025-01-01", end: "2026-01-01" },
    10000,
  );

  assert.equal(points.length, 2);
  assert.equal(pointsToPath(points), "M 20.00 90.00 L 190.00 10.00");
  assert.equal(percentageOf(2500, 10000), 25);
});
