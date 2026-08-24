import { assertIsoTimestamp, sha256Canonical } from "./civic-data.mjs";

export const OCPF_PROVIDER_ID = "ocpf";
export const OCPF_SOURCE_ID = "source:ocpf-public-api";
export const OCPF_API_BASE_URL = "https://api.ocpf.us";
export const OCPF_DEVELOPER_GUIDE_URL = `${OCPF_API_BASE_URL}/developers/guide`;
export const FINANCE_SCHEMA_VERSION = "1.0.0";

const ENTITY_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*[a-z0-9]$/;
const AVAILABILITY_STATES = new Set([
  "known",
  "unknown",
  "not_applicable",
  "not_available",
  "not_researched",
  "conflicting",
]);
const FINANCE_STATUSES = new Set([
  "complete",
  "partial",
  "unknown",
  "not_applicable",
]);
const IDENTITY_MATCH_STATUSES = new Set([
  "automated_checks_passed",
  "human_reviewed",
  "needs_review",
]);
const SENSITIVE_PROVIDER_KEYS = new Set([
  "chairman",
  "emailAddress",
  "fullAddress",
  "phoneNumber",
  "streetAddress",
  "treasurer",
  "zip",
  "zipCode",
]);

function assertObject(value, fieldName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }
}

function assertEntityId(value, fieldName) {
  if (
    typeof value !== "string" ||
    value.length < 3 ||
    value.length > 200 ||
    !ENTITY_ID_PATTERN.test(value)
  ) {
    throw new Error(`${fieldName} must be a valid Civics entity ID.`);
  }
}

function assertOptionalString(value, fieldName, maximumLength = 500) {
  if (
    value !== null &&
    (typeof value !== "string" || value.length > maximumLength)
  ) {
    throw new Error(`${fieldName} must be null or a string.`);
  }
}

function assertFiniteNumberOrNull(value, fieldName) {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`${fieldName} must be null or a finite number.`);
  }
}

function assertIsoDateOrNull(value, fieldName) {
  if (value === null) return;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  ) {
    throw new Error(`${fieldName} must be null or an ISO-8601 calendar date.`);
  }
}

function assertSha256(value, fieldName) {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${fieldName} must be a canonical SHA-256 digest.`);
  }
}

function sortedUniqueStrings(values, fieldName) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`${fieldName} must not contain duplicates.`);
  }
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

export function parseOcpfDate(value, fieldName) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string or null.`);
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoMatch) {
    const date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    assertIsoDateOrNull(date, fieldName);
    return date;
  }

  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!usMatch) {
    throw new Error(`${fieldName} uses an unsupported date format.`);
  }
  const date = `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
  assertIsoDateOrNull(date, fieldName);
  return date;
}

export function assertOcpfRegistry(registry) {
  assertObject(registry, "OCPF registry");
  if (
    registry.schemaVersion !== FINANCE_SCHEMA_VERSION ||
    registry.provider !== OCPF_PROVIDER_ID ||
    registry.sourceId !== OCPF_SOURCE_ID ||
    !Number.isSafeInteger(registry.electionCycle)
  ) {
    throw new Error("OCPF registry metadata is invalid.");
  }
  assertIsoTimestamp(registry.checkedAt, "OCPF registry checkedAt");
  if (registry.matchPolicy?.automaticFuzzyMatchingAllowed !== false) {
    throw new Error("OCPF registry must prohibit automatic fuzzy matching.");
  }
  if (!Array.isArray(registry.candidates) || registry.candidates.length === 0) {
    throw new Error("OCPF registry must contain candidate mappings.");
  }

  const candidateIds = [];
  const cpfIds = [];
  for (const [index, mapping] of registry.candidates.entries()) {
    const prefix = `OCPF registry candidates[${index}]`;
    assertObject(mapping, prefix);
    assertEntityId(mapping.candidateId, `${prefix}.candidateId`);
    assertEntityId(mapping.raceId, `${prefix}.raceId`);
    if (!Number.isSafeInteger(mapping.cpfId) || mapping.cpfId < 1) {
      throw new Error(`${prefix}.cpfId must be a positive integer.`);
    }
    for (const field of ["expectedFilerName", "expectedOffice", "expectedCity"]) {
      if (typeof mapping[field] !== "string" || mapping[field].length === 0) {
        throw new Error(`${prefix}.${field} must be a non-empty string.`);
      }
    }
    if (!IDENTITY_MATCH_STATUSES.has(mapping.matchStatus)) {
      throw new Error(`${prefix}.matchStatus is invalid.`);
    }
    candidateIds.push(mapping.candidateId);
    cpfIds.push(mapping.cpfId);
  }

  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new Error("OCPF registry contains duplicate candidate IDs.");
  }
  if (new Set(cpfIds).size !== cpfIds.length) {
    throw new Error("OCPF registry contains duplicate CPF IDs.");
  }
  const sortedCandidateIds = [...candidateIds].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  if (candidateIds.some((candidateId, index) => candidateId !== sortedCandidateIds[index])) {
    throw new Error("OCPF registry mappings must be sorted by candidateId.");
  }
}

function assertNoSensitiveKeys(value, path = "record") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_PROVIDER_KEYS.has(key)) {
      throw new Error(`Sanitized OCPF ${path} contains forbidden field ${key}.`);
    }
    assertNoSensitiveKeys(child, `${path}.${key}`);
  }
}

function sanitizedYtdReport(ytdReport, cpfId) {
  if (ytdReport === null || ytdReport === undefined) return null;
  assertObject(ytdReport, `OCPF ${cpfId} ytdReport`);
  if (ytdReport.cpfId !== cpfId) {
    throw new Error(`OCPF ${cpfId} YTD report belongs to CPF ${ytdReport.cpfId}.`);
  }

  const report = {
    reportId:
      Number.isSafeInteger(ytdReport.bankReportId) && ytdReport.bankReportId > 0
        ? String(ytdReport.bankReportId)
        : null,
    startDate: parseOcpfDate(
      ytdReport.reportYearFirstDayDate,
      `OCPF ${cpfId} reportYearFirstDayDate`,
    ),
    endDate: parseOcpfDate(
      ytdReport.bankReportEndDate,
      `OCPF ${cpfId} bankReportEndDate`,
    ),
    receipts: ytdReport.receiptsYtdNumeric ?? null,
    disbursements: ytdReport.expendituresYtdNumeric ?? null,
    cashOnHand: ytdReport.currentCashOnHandNumeric ?? null,
    startingBalance: ytdReport.startBalanceNumeric ?? null,
  };
  for (const [field, value] of Object.entries(report)) {
    if (["receipts", "disbursements", "cashOnHand", "startingBalance"].includes(field)) {
      assertFiniteNumberOrNull(value, `OCPF ${cpfId} ytdReport.${field}`);
    }
  }
  if (report.startDate && report.endDate && report.startDate > report.endDate) {
    throw new Error(`OCPF ${cpfId} YTD report starts after it ends.`);
  }
  return report;
}

export function sanitizeOcpfPayload(payload, mapping) {
  assertObject(payload, `OCPF ${mapping.cpfId} payload`);
  assertObject(payload.filer, `OCPF ${mapping.cpfId} filer`);
  const filer = payload.filer;
  if (filer.cpfId !== mapping.cpfId) {
    throw new Error(
      `OCPF response CPF ${filer.cpfId} does not match mapped CPF ${mapping.cpfId}.`,
    );
  }
  if (filer.isActive !== true) {
    throw new Error(`OCPF CPF ${mapping.cpfId} is no longer active.`);
  }
  if (filer.fullName !== mapping.expectedFilerName) {
    throw new Error(
      `OCPF CPF ${mapping.cpfId} name changed from ${mapping.expectedFilerName} to ${filer.fullName}.`,
    );
  }
  if (filer.officeSoughtDescription !== mapping.expectedOffice) {
    throw new Error(
      `OCPF CPF ${mapping.cpfId} office changed from ${mapping.expectedOffice} to ${filer.officeSoughtDescription}.`,
    );
  }
  if (filer.candidate?.city !== mapping.expectedCity) {
    throw new Error(
      `OCPF CPF ${mapping.cpfId} locality no longer matches the reviewed registry context.`,
    );
  }

  const stableRecord = {
    candidateId: mapping.candidateId,
    raceId: mapping.raceId,
    cpfId: mapping.cpfId,
    filerName: filer.fullName,
    committeeName: filer.committeeName || null,
    office: filer.officeSoughtDescription || null,
    party: filer.partyAffiliation || null,
    isActive: filer.isActive,
    matchStatus: mapping.matchStatus,
    ytdReport: sanitizedYtdReport(payload.ytdReport, mapping.cpfId),
  };
  assertNoSensitiveKeys(stableRecord);
  const contentHash = sha256Canonical(stableRecord);
  return { ...stableRecord, contentHash };
}

export function assertOcpfRawRecord(record) {
  assertObject(record, "OCPF record");
  assertEntityId(record.candidateId, "OCPF record candidateId");
  assertEntityId(record.raceId, "OCPF record raceId");
  if (!Number.isSafeInteger(record.cpfId) || record.cpfId < 1) {
    throw new Error("OCPF record cpfId must be a positive integer.");
  }
  if (typeof record.filerName !== "string" || record.filerName.length === 0) {
    throw new Error("OCPF record filerName must be a non-empty string.");
  }
  assertOptionalString(record.committeeName, "OCPF record committeeName", 300);
  assertOptionalString(record.office, "OCPF record office", 300);
  assertOptionalString(record.party, "OCPF record party", 100);
  if (record.isActive !== true || !IDENTITY_MATCH_STATUSES.has(record.matchStatus)) {
    throw new Error("OCPF record identity state is invalid.");
  }
  if (record.ytdReport !== null) {
    assertObject(record.ytdReport, "OCPF record ytdReport");
    assertOptionalString(record.ytdReport.reportId, "OCPF record reportId", 200);
    assertIsoDateOrNull(record.ytdReport.startDate, "OCPF record startDate");
    assertIsoDateOrNull(record.ytdReport.endDate, "OCPF record endDate");
    for (const field of ["receipts", "disbursements", "cashOnHand", "startingBalance"]) {
      assertFiniteNumberOrNull(record.ytdReport[field], `OCPF record ${field}`);
    }
  }
  const { contentHash, ...stableRecord } = record;
  if (contentHash !== sha256Canonical(stableRecord)) {
    throw new Error(`OCPF record ${record.candidateId} content hash is invalid.`);
  }
  assertNoSensitiveKeys(record);
}

function metric(value, sourceRecordRef, unavailableNote = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      status: "known",
      value,
      currency: "USD",
      sourceRecordRefs: [sourceRecordRef],
      note: null,
    };
  }
  return {
    status: "unknown",
    value: null,
    currency: "USD",
    sourceRecordRefs: [],
    note: unavailableNote ?? "The selected provider record did not establish this value.",
  };
}

function unavailableMetric(status, note) {
  return {
    status,
    value: null,
    currency: "USD",
    sourceRecordRefs: [],
    note,
  };
}

function unavailableStructuredField(status, note) {
  return {
    status,
    value: null,
    sourceRecordRefs: [],
    note,
  };
}

function unavailableSeries(status, note) {
  return {
    status,
    value: null,
    currency: "USD",
    sourceRecordRefs: [],
    note,
  };
}

export function candidateFinanceFromOcpfRecord(record, snapshot, codeRevision = null) {
  assertOcpfRawRecord(record);
  assertObject(snapshot, "OCPF snapshot");
  if (snapshot.provider !== OCPF_PROVIDER_ID) {
    throw new Error("Candidate finance materialization requires an OCPF snapshot.");
  }
  assertIsoTimestamp(snapshot.freshness?.checkedAt, "OCPF snapshot checkedAt");
  assertIsoTimestamp(
    snapshot.freshness?.contentChangedAt,
    "OCPF snapshot contentChangedAt",
  );

  const report = record.ytdReport;
  const sourceRecordRef = report?.reportId
    ? `ocpf:${record.cpfId}:report:${report.reportId}`
    : `ocpf:${record.cpfId}:ytd`;
  const hasAnyKnownTotal = [
    report?.receipts,
    report?.disbursements,
    report?.cashOnHand,
  ].some((value) => typeof value === "number" && Number.isFinite(value));
  const sourceUrl = `${OCPF_API_BASE_URL}/filer/payload/${record.cpfId}`;

  return {
    candidateId: record.candidateId,
    status: hasAnyKnownTotal ? "partial" : "unknown",
    provider: {
      id: OCPF_PROVIDER_ID,
      entityId: String(record.cpfId),
    },
    identity: {
      filerName: record.filerName,
      committeeName: record.committeeName,
      office: record.office,
      party: record.party,
      matchStatus: record.matchStatus,
    },
    period: {
      startDate: report?.startDate ?? null,
      endDate: report?.endDate ?? null,
      cycle: snapshot.scope.electionCycle,
      asOf: report?.endDate ?? null,
      basis: report ? "year_to_date" : "unknown",
      reportId: report?.reportId ?? null,
    },
    totals: {
      receipts: metric(report?.receipts ?? null, sourceRecordRef),
      disbursements: metric(report?.disbursements ?? null, sourceRecordRef),
      cashOnHand: metric(report?.cashOnHand ?? null, sourceRecordRef),
      debtsOwed: unavailableMetric(
        "not_available",
        "The OCPF filer YTD payload used by this adapter does not expose debts owed.",
      ),
    },
    receiptComposition: unavailableStructuredField(
      "not_researched",
      "Receipt-level category aggregation is outside this bounded first-pass adapter.",
    ),
    outsideSpending: unavailableStructuredField(
      "not_researched",
      "Independent spending requires OCPF miscellaneous-report endpoints and has not been joined yet.",
    ),
    timeSeries: {
      receipts: unavailableSeries(
        "not_researched",
        "Monthly receipt history has not been materialized from report-level records yet.",
      ),
      disbursements: unavailableSeries(
        "not_researched",
        "Monthly disbursement history has not been materialized from report-level records yet.",
      ),
      cashOnHand: unavailableSeries(
        "not_researched",
        "Historical cash balances have not been materialized from report-level records yet.",
      ),
    },
    comparability: {
      status: report?.startDate && report?.endDate ? "limited" : "unknown",
      basis: "OCPF filer-specific year-to-date summary; compare only records with matching periods and account rules.",
      key:
        report?.startDate && report?.endDate
          ? `ocpf:ytd:${report.startDate}:${report.endDate}`
          : null,
      caveats: [
        "Year-to-date totals are not lifetime or full election-cycle totals.",
        "Candidates may use different OCPF account types and reporting schedules.",
        "A missing value is not zero and must not be ranked as zero.",
      ],
    },
    source: {
      sourceId: OCPF_SOURCE_ID,
      recordId: sourceRecordRef,
      url: sourceUrl,
      retrievedAt: snapshot.freshness.checkedAt,
      contentHash: record.contentHash,
    },
    provenance: {
      method: "deterministic_derivation",
      sourceIds: [OCPF_SOURCE_ID],
      evidenceIds: [],
      producedAt: snapshot.freshness.checkedAt,
      generator: {
        kind: "script",
        name: "scripts/materialize-finance-data.mjs",
        version: FINANCE_SCHEMA_VERSION,
      },
      codeRevision,
    },
    freshness: {
      status: "current",
      checkedAt: snapshot.freshness.checkedAt,
      sourceChangedAt: snapshot.freshness.contentChangedAt,
      dataUpdatedAt: snapshot.freshness.checkedAt,
      validThrough: null,
    },
    review: {
      status: "needs_review",
      reviewedAt: null,
      reviewer: null,
      notes: [
        "Provider identity checks passed; a maintainer has not yet marked this finance view human-reviewed.",
      ],
    },
    synthesisRefs: [],
  };
}

function minDate(values) {
  return values.filter(Boolean).sort((left, right) => left.localeCompare(right, "en"))[0] ?? null;
}

function maxDate(values) {
  return values.filter(Boolean).sort((left, right) => right.localeCompare(left, "en"))[0] ?? null;
}

export function financeDatasetHash(candidates) {
  return sha256Canonical(
    candidates.map((candidate) => ({
      ...candidate,
      source: {
        ...candidate.source,
        retrievedAt: null,
      },
      provenance: {
        ...candidate.provenance,
        producedAt: null,
        codeRevision: null,
      },
      freshness: {
        ...candidate.freshness,
        checkedAt: null,
        dataUpdatedAt: null,
      },
    })),
  );
}

export function materializeOcpfFinanceDataset(snapshot, codeRevision = null) {
  assertObject(snapshot, "OCPF snapshot");
  if (
    snapshot.provider !== OCPF_PROVIDER_ID ||
    !Array.isArray(snapshot.records) ||
    snapshot.recordCount !== snapshot.records.length ||
    snapshot.contentHash !== sha256Canonical(snapshot.records)
  ) {
    throw new Error("OCPF snapshot has an invalid shape or content hash.");
  }
  const candidates = snapshot.records.map((record) =>
    candidateFinanceFromOcpfRecord(record, snapshot, codeRevision),
  );
  const candidateIds = candidates.map((candidate) => candidate.candidateId);
  const sortedCandidateIds = [...candidateIds].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  if (candidateIds.some((candidateId, index) => candidateId !== sortedCandidateIds[index])) {
    throw new Error("OCPF snapshot records must be sorted by candidateId.");
  }

  const startDate = minDate(candidates.map((candidate) => candidate.period.startDate));
  const endDate = maxDate(candidates.map((candidate) => candidate.period.endDate));
  const limitations = [
    "This OCPF view covers mapped Massachusetts state and local candidates, not federal candidates governed by FEC reporting.",
    "The current adapter materializes filer-specific year-to-date totals only; receipt composition, outside spending, debt, and historical series remain explicit research gaps.",
    "Periods and reporting rules must match before candidate totals are compared.",
    "Provider identity mappings passed deterministic checks but still require maintainer review before stable publication.",
  ];
  const dataset = {
    schemaVersion: FINANCE_SCHEMA_VERSION,
    id: `finance:ocpf:ma:${snapshot.scope.electionCycle}`,
    kind: "finance_dataset",
    provider: {
      id: OCPF_PROVIDER_ID,
      name: "Massachusetts Office of Campaign and Political Finance Public API",
      jurisdiction: "Massachusetts",
      documentationUrl: OCPF_DEVELOPER_GUIDE_URL,
    },
    status:
      candidates.length === 0
        ? "unknown"
        : candidates.every((candidate) => candidate.status === "complete")
          ? "complete"
          : "partial",
    period: {
      cycle: snapshot.scope.electionCycle,
      startDate,
      endDate,
      asOf: endDate,
    },
    candidates,
    limitations,
    source: {
      sourceId: OCPF_SOURCE_ID,
      recordId: snapshot.dataset,
      url: OCPF_DEVELOPER_GUIDE_URL,
      retrievedAt: snapshot.freshness.checkedAt,
      contentHash: snapshot.contentHash,
    },
    contentHash: financeDatasetHash(candidates),
    provenance: {
      method: "deterministic_derivation",
      sourceIds: [OCPF_SOURCE_ID],
      evidenceIds: [],
      producedAt: snapshot.freshness.checkedAt,
      generator: {
        kind: "script",
        name: "scripts/materialize-finance-data.mjs",
        version: FINANCE_SCHEMA_VERSION,
      },
      codeRevision,
    },
    freshness: {
      status: "current",
      checkedAt: snapshot.freshness.checkedAt,
      sourceChangedAt: snapshot.freshness.contentChangedAt,
      dataUpdatedAt: snapshot.freshness.checkedAt,
      validThrough: null,
    },
    review: {
      status: "needs_review",
      reviewedAt: null,
      reviewer: null,
      notes: [
        "Generated finance data passed deterministic validation but has not received maintainer review.",
      ],
    },
  };
  assertFinanceDataset(dataset);
  return dataset;
}

function assertMetric(metricValue, fieldName) {
  assertObject(metricValue, fieldName);
  if (!AVAILABILITY_STATES.has(metricValue.status) || metricValue.currency !== "USD") {
    throw new Error(`${fieldName} has an invalid state or currency.`);
  }
  assertFiniteNumberOrNull(metricValue.value, `${fieldName}.value`);
  const refs = sortedUniqueStrings(metricValue.sourceRecordRefs, `${fieldName}.sourceRecordRefs`);
  if (metricValue.status === "known") {
    if (metricValue.value === null || refs.length === 0) {
      throw new Error(`${fieldName} known values require a number and source record.`);
    }
  } else if (metricValue.status !== "conflicting" && metricValue.value !== null) {
    throw new Error(`${fieldName} unavailable values must be null.`);
  }
  assertOptionalString(metricValue.note, `${fieldName}.note`, 1000);
}

function assertUnavailableField(value, fieldName, includeCurrency = false) {
  assertObject(value, fieldName);
  if (!AVAILABILITY_STATES.has(value.status)) {
    throw new Error(`${fieldName}.status is invalid.`);
  }
  if (includeCurrency && value.currency !== "USD") {
    throw new Error(`${fieldName}.currency must be USD.`);
  }
  const refs = sortedUniqueStrings(value.sourceRecordRefs, `${fieldName}.sourceRecordRefs`);
  assertOptionalString(value.note, `${fieldName}.note`, 1000);
  if (value.status === "known" || value.status === "conflicting") {
    if (value.value === null || refs.length === 0) {
      throw new Error(`${fieldName} known values require data and a source record.`);
    }
  } else if (value.value !== null) {
    throw new Error(`${fieldName} unavailable values must be null.`);
  }
}

function assertCompositionField(value, fieldName) {
  assertUnavailableField(value, fieldName);
  if (value.status !== "known" && value.status !== "conflicting") return;
  if (!Array.isArray(value.value)) {
    throw new Error(`${fieldName}.value must be an array when known.`);
  }
  const ids = [];
  for (const [index, category] of value.value.entries()) {
    assertObject(category, `${fieldName}.value[${index}]`);
    assertEntityId(category.id, `${fieldName}.value[${index}].id`);
    if (typeof category.label !== "string" || category.label.length === 0) {
      throw new Error(`${fieldName}.value[${index}].label must be non-empty.`);
    }
    assertFiniteNumberOrNull(category.amount, `${fieldName}.value[${index}].amount`);
    if (category.amount === null) {
      throw new Error(`${fieldName}.value[${index}].amount must be numeric.`);
    }
    if (
      category.share !== null &&
      (typeof category.share !== "number" ||
        !Number.isFinite(category.share) ||
        category.share < 0 ||
        category.share > 1)
    ) {
      throw new Error(`${fieldName}.value[${index}].share must be null or between zero and one.`);
    }
    ids.push(category.id);
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${fieldName}.value contains duplicate category IDs.`);
  }
}

function assertOutsideSpendingField(value, fieldName) {
  assertUnavailableField(value, fieldName);
  if (value.status !== "known" && value.status !== "conflicting") return;
  assertObject(value.value, `${fieldName}.value`);
  for (const metricName of ["supporting", "opposing", "other", "total"]) {
    assertFiniteNumberOrNull(value.value[metricName], `${fieldName}.value.${metricName}`);
    if (value.value[metricName] === null) {
      throw new Error(`${fieldName}.value.${metricName} must be numeric.`);
    }
  }
}

function assertSeriesField(value, fieldName) {
  assertUnavailableField(value, fieldName, true);
  if (value.status !== "known" && value.status !== "conflicting") return;
  if (!Array.isArray(value.value) || value.value.length === 0) {
    throw new Error(`${fieldName}.value must contain at least one point when known.`);
  }
  const dates = [];
  for (const [index, point] of value.value.entries()) {
    assertObject(point, `${fieldName}.value[${index}]`);
    assertIsoDateOrNull(point.date, `${fieldName}.value[${index}].date`);
    if (point.date === null) {
      throw new Error(`${fieldName}.value[${index}].date must be known.`);
    }
    assertFiniteNumberOrNull(point.value, `${fieldName}.value[${index}].value`);
    if (point.value === null) {
      throw new Error(`${fieldName}.value[${index}].value must be numeric.`);
    }
    assertOptionalString(point.reportId, `${fieldName}.value[${index}].reportId`, 200);
    dates.push(point.date);
  }
  if (new Set(dates).size !== dates.length) {
    throw new Error(`${fieldName}.value contains duplicate dates.`);
  }
  const sortedDates = [...dates].sort((left, right) => left.localeCompare(right, "en"));
  if (dates.some((date, index) => date !== sortedDates[index])) {
    throw new Error(`${fieldName}.value must be sorted by date.`);
  }
}

export function assertCandidateFinance(candidate) {
  assertObject(candidate, "finance candidate");
  assertEntityId(candidate.candidateId, "finance candidate candidateId");
  if (!FINANCE_STATUSES.has(candidate.status)) {
    throw new Error(`${candidate.candidateId} has an invalid finance status.`);
  }
  if (
    candidate.provider?.id !== OCPF_PROVIDER_ID ||
    typeof candidate.provider?.entityId !== "string" ||
    !/^\d+$/.test(candidate.provider.entityId)
  ) {
    throw new Error(`${candidate.candidateId} has an invalid OCPF provider identity.`);
  }
  assertObject(candidate.identity, `${candidate.candidateId}.identity`);
  if (
    typeof candidate.identity.filerName !== "string" ||
    !IDENTITY_MATCH_STATUSES.has(candidate.identity.matchStatus)
  ) {
    throw new Error(`${candidate.candidateId} has invalid identity metadata.`);
  }
  assertObject(candidate.period, `${candidate.candidateId}.period`);
  assertIsoDateOrNull(candidate.period.startDate, `${candidate.candidateId}.period.startDate`);
  assertIsoDateOrNull(candidate.period.endDate, `${candidate.candidateId}.period.endDate`);
  assertIsoDateOrNull(candidate.period.asOf, `${candidate.candidateId}.period.asOf`);
  if (!Number.isSafeInteger(candidate.period.cycle)) {
    throw new Error(`${candidate.candidateId}.period.cycle must be an integer.`);
  }
  assertObject(candidate.totals, `${candidate.candidateId}.totals`);
  for (const name of ["receipts", "disbursements", "cashOnHand", "debtsOwed"]) {
    assertMetric(candidate.totals[name], `${candidate.candidateId}.totals.${name}`);
  }
  assertCompositionField(candidate.receiptComposition, `${candidate.candidateId}.receiptComposition`);
  assertOutsideSpendingField(candidate.outsideSpending, `${candidate.candidateId}.outsideSpending`);
  assertObject(candidate.timeSeries, `${candidate.candidateId}.timeSeries`);
  for (const name of ["receipts", "disbursements", "cashOnHand"]) {
    assertSeriesField(
      candidate.timeSeries[name],
      `${candidate.candidateId}.timeSeries.${name}`,
    );
  }
  if (!new Set(["comparable", "limited", "not_comparable", "unknown"]).has(candidate.comparability?.status)) {
    throw new Error(`${candidate.candidateId} has invalid comparability metadata.`);
  }
  if (!Array.isArray(candidate.comparability.caveats)) {
    throw new Error(`${candidate.candidateId} comparability caveats must be an array.`);
  }
  if (candidate.source?.sourceId !== OCPF_SOURCE_ID) {
    throw new Error(`${candidate.candidateId} has invalid source metadata.`);
  }
  assertSha256(candidate.source.contentHash, `${candidate.candidateId}.source.contentHash`);
  assertIsoTimestamp(candidate.source.retrievedAt, `${candidate.candidateId}.source.retrievedAt`);
  assertIsoTimestamp(candidate.freshness?.checkedAt, `${candidate.candidateId}.freshness.checkedAt`);
  assertIsoTimestamp(
    candidate.freshness?.sourceChangedAt,
    `${candidate.candidateId}.freshness.sourceChangedAt`,
  );
  sortedUniqueStrings(candidate.synthesisRefs, `${candidate.candidateId}.synthesisRefs`);
  assertNoSensitiveKeys(candidate);
}

export function assertFinanceDataset(dataset) {
  assertObject(dataset, "finance dataset");
  if (
    dataset.schemaVersion !== FINANCE_SCHEMA_VERSION ||
    dataset.kind !== "finance_dataset" ||
    dataset.provider?.id !== OCPF_PROVIDER_ID ||
    !FINANCE_STATUSES.has(dataset.status)
  ) {
    throw new Error("Finance dataset metadata is invalid.");
  }
  assertEntityId(dataset.id, "finance dataset id");
  if (!Array.isArray(dataset.candidates)) {
    throw new Error("Finance dataset candidates must be an array.");
  }
  dataset.candidates.forEach((candidate) => assertCandidateFinance(candidate));
  const candidateIds = dataset.candidates.map((candidate) => candidate.candidateId);
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new Error("Finance dataset contains duplicate candidate IDs.");
  }
  const sortedCandidateIds = [...candidateIds].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  if (candidateIds.some((candidateId, index) => candidateId !== sortedCandidateIds[index])) {
    throw new Error("Finance dataset candidates must be sorted by candidateId.");
  }
  if (dataset.contentHash !== financeDatasetHash(dataset.candidates)) {
    throw new Error("Finance dataset content hash is invalid.");
  }
  if (!Array.isArray(dataset.limitations) || dataset.limitations.length === 0) {
    throw new Error("Finance dataset must disclose limitations.");
  }
  if (dataset.source?.sourceId !== OCPF_SOURCE_ID) {
    throw new Error("Finance dataset source metadata is invalid.");
  }
  assertSha256(dataset.source.contentHash, "finance dataset source.contentHash");
  assertIsoTimestamp(dataset.source.retrievedAt, "finance dataset source.retrievedAt");
  assertNoSensitiveKeys(dataset);
}
