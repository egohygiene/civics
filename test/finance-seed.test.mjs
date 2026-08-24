import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { candidates, races } from "../src/data/seed.js";
import {
  adaptOcpfFinanceDataset,
  financeRecords,
  financeSynthesisByRace,
  getFinanceRecord,
  getRaceFinanceRecords,
} from "../src/data/finance.js";

const ocpfDataset = JSON.parse(await readFile(
  new URL("../public/data/finance/ocpf-ma-2026.json", import.meta.url),
  "utf8",
));

test("finance records resolve to known candidates and preserve exact composition totals", () => {
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));

  for (const record of financeRecords) {
    assert.equal(candidateIds.has(record.candidateId), true, `${record.candidateId} must resolve`);
    assert.match(record.source.url, /^https:\/\/www\.fec\.gov\/data\//);
    assert.ok(record.source.recordIds.length > 0);
    assert.ok(record.period.startDate <= record.period.endDate);

    const compositionTotal = record.receiptComposition.reduce((sum, item) => sum + item.amount, 0);
    assert.ok(
      Math.abs(compositionTotal - record.totals.receipts) < 0.005,
      `${record.candidateId} receipt composition must equal total receipts`,
    );
  }
});

test("the U.S. Senate finance view includes all three candidates and discloses period mismatch", () => {
  const senateRace = races.find((race) => race.id === "us-senate");
  const records = getRaceFinanceRecords(senateRace);

  assert.deepEqual(
    records.map((record) => record.candidateId).sort(),
    ["edward-markey", "john-deaton", "seth-moulton"],
  );
  assert.equal(records.some((record) => record.period.comparability === "different-start-date"), true);
});

test("candidate lookup and AI-assisted synthesis keep explicit review state", () => {
  assert.equal(getFinanceRecord("edward-markey")?.externalIdentifiers.candidateId, "S4MA00028");
  assert.equal(getFinanceRecord("unknown-candidate"), null);

  const synthesis = financeSynthesisByRace["us-senate"];
  assert.equal(synthesis.status, "ai-assisted-draft");
  assert.equal(synthesis.reviewedAt, null);
  assert.ok(synthesis.method.includes("AI-assisted"));
  assert.ok(synthesis.limitations.length >= 3);
});

test("the static OCPF view adapts all state and county candidates without inventing missing metrics", () => {
  const records = adaptOcpfFinanceDataset(ocpfDataset);

  assert.equal(records.length, 18);
  assert.equal(records.every((record) => record.provider === "ocpf"), true);
  assert.equal(records.every((record) => record.status === "partial"), true);

  const campbell = getFinanceRecord("andrea-campbell", records);
  assert.equal(campbell.externalIdentifiers.cpfId, "15931");
  assert.equal(campbell.totals.receipts, 576755.15);
  assert.equal(campbell.totals.debtsOwed, null);
  assert.equal(campbell.receiptComposition.length, 0);
  assert.ok(campbell.limitations.some((limitation) => limitation.includes("does not expose debts")));
});
