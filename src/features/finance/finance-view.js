export const FINANCE_STATUS_LABELS = {
  available: "Available",
  partial: "Partial",
  unknown: "Unknown",
  "not-researched": "Not researched",
  "not-applicable": "Not applicable",
};

export const FINANCE_METRICS = {
  receipts: {
    label: "Receipts",
    longLabel: "Cumulative receipts",
    seriesKey: "receiptsCents",
  },
  disbursements: {
    label: "Spent",
    longLabel: "Cumulative disbursements",
    seriesKey: "disbursementsCents",
  },
};

export const FINANCE_TOTALS = [
  { key: "receipts", label: "Receipts" },
  { key: "disbursements", label: "Spent" },
  { key: "cashOnHand", label: "Cash on hand" },
  { key: "debts", label: "Debts owed" },
];

export function normalizeFinanceStatus(value) {
  if (value === "complete") return "available";
  if (value === "not_applicable") return "not-applicable";
  if (["available", "partial", "unknown", "not-researched", "not-applicable"].includes(value)) return value;
  return "unknown";
}

const DEFAULT_METRIC = Object.freeze({
  amountCents: null,
  status: "unknown",
});

function isIntegerAmount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function dollarsToCents(value) {
  if (typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value)) {
    const [whole, fractional = ""] = value.split(".");
    return Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100);
  }

  return null;
}

export function normalizeFinanceMetric(metric) {
  const amountCents = isIntegerAmount(metric?.amountCents)
    ? metric.amountCents
    : dollarsToCents(metric?.amount ?? metric);

  if (!isIntegerAmount(amountCents)) {
    return { ...DEFAULT_METRIC, status: metric?.status ?? "unknown" };
  }

  return {
    amountCents,
    status: metric.status ?? "available",
  };
}

function normalizeSeriesPoint(point) {
  return {
    date: point.date,
    receiptsCents: isIntegerAmount(point.receiptsCents) ? point.receiptsCents : null,
    disbursementsCents: isIntegerAmount(point.disbursementsCents) ? point.disbursementsCents : null,
  };
}

function compareIsoDates(left, right) {
  return String(left).localeCompare(String(right));
}

export function normalizeFinanceCandidate(candidate, comparison) {
  const throughDate = candidate.coverage?.throughDate ?? null;
  const startDate = candidate.coverage?.startDate ?? null;
  const hasSameCutoff = Boolean(throughDate && throughDate === comparison.throughDate);
  const hasSameStart = Boolean(!comparison.startDate || (startDate && startDate === comparison.startDate));
  const hasSamePeriod = hasSameCutoff && hasSameStart;
  const candidateStatus = normalizeFinanceStatus(candidate.status);
  const isComparable = ["available", "partial"].includes(candidateStatus) && hasSamePeriod;
  const cutoffSeries = (candidate.series ?? [])
    .filter((point) => point.date && compareIsoDates(point.date, comparison.throughDate) <= 0)
    .map(normalizeSeriesPoint)
    .sort((left, right) => compareIsoDates(left.date, right.date));

  return {
    ...candidate,
    status: candidateStatus,
    coverage: {
      startDate: candidate.coverage?.startDate ?? comparison.startDate,
      throughDate,
    },
    totals: Object.fromEntries(
      FINANCE_TOTALS.map(({ key }) => [key, normalizeFinanceMetric(candidate.totals?.[key])]),
    ),
    receiptComposition: (candidate.receiptComposition ?? [])
      .map((item) => ({
        ...item,
        amountCents: isIntegerAmount(item.amountCents) ? item.amountCents : null,
        status: item.status ?? (isIntegerAmount(item.amountCents) ? "available" : "unknown"),
      })),
    outsideSpending: {
      status: normalizeFinanceStatus(candidate.outsideSpending?.status),
      support: normalizeFinanceMetric(candidate.outsideSpending?.support),
      opposition: normalizeFinanceMetric(candidate.outsideSpending?.opposition),
      throughDate: candidate.outsideSpending?.throughDate ?? null,
      sourceIds: candidate.outsideSpending?.sourceIds ?? [],
    },
    series: cutoffSeries,
    comparison: {
      hasSameCutoff,
      hasSamePeriod,
      hasSameStart,
      isComparable,
      reason: hasSamePeriod
        ? null
        : !hasSameCutoff && throughDate
          ? `Reporting coverage ends ${throughDate}, not the shared ${comparison.throughDate} cutoff.`
          : !hasSameCutoff
            ? "No reporting-period cutoff is available."
            : startDate
              ? `Reporting coverage starts ${startDate}, not the shared ${comparison.startDate} start.`
              : "No reporting-period start is available.",
    },
  };
}

function selectComparisonPeriod(records) {
  const frequencies = new Map();
  for (const record of records) {
    const startDate = record.period?.startDate;
    const throughDate = record.period?.endDate;
    if (!startDate || !throughDate) continue;
    const key = `${startDate}|${throughDate}`;
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }

  const selected = [...frequencies.entries()]
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => (
      rightCount - leftCount || rightKey.localeCompare(leftKey)
    ))
    .at(0)?.[0];
  if (!selected) return { startDate: null, throughDate: null };

  const [startDate, throughDate] = selected.split("|");
  return { startDate, throughDate };
}

function normalizeInputSeries(series) {
  return (series ?? []).map((point) => ({
    date: point.date,
    receiptsCents: normalizeFinanceMetric(point.receipts).amountCents ?? point.receiptsCents ?? null,
    disbursementsCents: normalizeFinanceMetric(point.disbursements).amountCents ?? point.disbursementsCents ?? null,
  }));
}

function financeSourceId(record) {
  return record.source?.id ?? `${record.provider ?? "finance"}-${record.candidateId}`;
}

export function adaptFinanceRecord(candidate, record = {}) {
  return {
    candidateId: candidate.id ?? candidate.candidateId,
    name: candidate.name,
    initials: candidate.initials ?? candidate.name?.split(/\s+/).map((part) => part[0]).slice(0, 2).join("") ?? "?",
    party: candidate.partyLabel ?? candidate.party ?? "Party not listed",
    status: normalizeFinanceStatus(record.status),
    provider: record.provider ?? null,
    coverage: {
      startDate: record.period?.startDate ?? null,
      throughDate: record.period?.endDate ?? null,
    },
    cycle: record.period?.cycle ?? null,
    asOf: record.period?.asOf ?? null,
    totals: {
      receipts: normalizeFinanceMetric(record.totals?.receipts),
      disbursements: normalizeFinanceMetric(record.totals?.disbursements),
      cashOnHand: normalizeFinanceMetric(record.totals?.cashOnHand),
      debts: normalizeFinanceMetric(record.totals?.debtsOwed ?? record.totals?.debts),
    },
    receiptComposition: (record.receiptComposition ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      amountCents: normalizeFinanceMetric(item.amount).amountCents ?? item.amountCents ?? null,
      status: item.status,
    })),
    outsideSpending: {
      status: record.outsideSpending?.status ?? "unknown",
      support: normalizeFinanceMetric(record.outsideSpending?.support),
      opposition: normalizeFinanceMetric(record.outsideSpending?.oppose ?? record.outsideSpending?.opposition),
      throughDate: record.outsideSpending?.throughDate ?? record.period?.endDate ?? null,
      sourceIds: [financeSourceId(record)],
    },
    series: normalizeInputSeries(record.series),
    sourceIds: [financeSourceId(record)],
    limitations: record.limitations ?? [],
  };
}

export function buildFinanceView({
  candidates = [],
  comparison = {},
  electionLabel,
  id = "finance-view",
  limitations = [],
  office,
  records = [],
  synthesis = null,
  title = "Campaign finance",
}) {
  const recordsByCandidateId = new Map(records.map((record) => [record.candidateId, record]));
  const selectedPeriod = selectComparisonPeriod(records);
  const startDate = comparison.startDate ?? selectedPeriod.startDate;
  const throughDate = comparison.endDate ?? comparison.throughDate ?? selectedPeriod.throughDate;
  if (!throughDate) {
    throw new Error("Finance records require at least one period.endDate or an explicit comparison.endDate.");
  }

  const sources = [...new Map(records.filter((record) => record.source).map((record) => {
    const source = record.source;
    const sourceId = financeSourceId(record);
    return [sourceId, {
      id: sourceId,
      name: source.label ?? record.provider ?? "Campaign-finance source",
      publisher: record.provider ?? null,
      kind: "campaign-finance",
      url: source.url ?? null,
      checkedAt: source.checkedAt ?? record.period?.asOf ?? null,
      reportingThrough: record.period?.endDate ?? null,
      recordIds: source.recordIds ?? [],
    }];
  })).values()];

  return {
    id,
    title,
    office,
    electionLabel,
    status: records.some((record) => ["available", "complete"].includes(record.status)) ? "available" : records.some((record) => record.status === "partial") ? "partial" : "unknown",
    comparison: {
      startDate,
      throughDate,
      label: comparison.label ?? `${formatFinanceDate(startDate)}–${formatFinanceDate(throughDate)}`,
    },
    candidates: candidates.map((candidate) => adaptFinanceRecord(
      candidate,
      recordsByCandidateId.get(candidate.id ?? candidate.candidateId),
    )),
    summary: synthesis ? {
      title: synthesis.title,
      text: synthesis.text ?? synthesis.summary,
      generatedAt: synthesis.generatedAt,
      reviewedAt: synthesis.reviewedAt,
      reviewStatus: synthesis.reviewStatus ?? synthesis.status,
      sourceIds: synthesis.sourceIds ?? synthesis.evidenceCandidateIds ?? [],
      disclosure: synthesis.disclosure,
      method: synthesis.method,
      limitations: synthesis.limitations ?? [],
    } : null,
    sources,
    limitations,
  };
}

export function normalizeFinanceView(view) {
  if (!view?.comparison?.throughDate) {
    throw new Error("Finance views require comparison.throughDate.");
  }

  const comparison = {
    startDate: view.comparison.startDate ?? null,
    throughDate: view.comparison.throughDate,
    label: view.comparison.label ?? "Shared reporting cutoff",
  };

  const candidates = (view.candidates ?? []).map((candidate) => (
    normalizeFinanceCandidate(candidate, comparison)
  ));

  return {
    ...view,
    status: normalizeFinanceStatus(
      view.status ?? (candidates.some(({ comparison: item }) => item.isComparable) ? "partial" : "unknown"),
    ),
    comparison,
    candidates,
    comparableCandidates: candidates.filter((candidate) => candidate.comparison.isComparable),
    sources: view.sources ?? [],
    limitations: view.limitations ?? [],
  };
}

export function formatExactUsd(amountCents) {
  if (!isIntegerAmount(amountCents)) return "Unknown";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function formatCompactUsd(amountCents) {
  if (!isIntegerAmount(amountCents)) return "Unknown";
  if (amountCents < 100_000) return formatExactUsd(amountCents);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amountCents / 100);
}

export function formatFinanceDate(value, options = {}) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(`${value}T12:00:00`));
}

export function formatFinanceTimestamp(value) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function collectSeriesDates(candidates) {
  return [...new Set(candidates.flatMap((candidate) => candidate.series.map((point) => point.date)))]
    .sort(compareIsoDates);
}

export function maximumSeriesAmount(candidates, metricKey) {
  const seriesKey = FINANCE_METRICS[metricKey]?.seriesKey;
  if (!seriesKey) return 0;

  return candidates.reduce((maximum, candidate) => (
    candidate.series.reduce((candidateMaximum, point) => (
      Math.max(candidateMaximum, point[seriesKey] ?? 0)
    ), maximum)
  ), 0);
}

export function buildLinePoints(series, metricKey, dimensions, dateRange, maximumAmount) {
  const seriesKey = FINANCE_METRICS[metricKey]?.seriesKey;
  if (!seriesKey || !maximumAmount || !dateRange.start || !dateRange.end) return [];

  const startTime = new Date(`${dateRange.start}T12:00:00`).getTime();
  const endTime = new Date(`${dateRange.end}T12:00:00`).getTime();
  const timeSpan = Math.max(1, endTime - startTime);
  const chartWidth = dimensions.width - dimensions.left - dimensions.right;
  const chartHeight = dimensions.height - dimensions.top - dimensions.bottom;

  return series
    .filter((point) => isIntegerAmount(point[seriesKey]))
    .map((point) => {
      const timestamp = new Date(`${point.date}T12:00:00`).getTime();
      const x = dimensions.left + ((timestamp - startTime) / timeSpan) * chartWidth;
      const y = dimensions.top + (1 - point[seriesKey] / maximumAmount) * chartHeight;
      return { amountCents: point[seriesKey], date: point.date, x, y };
    });
}

export function pointsToPath(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

export function percentageOf(amountCents, totalCents) {
  if (!isIntegerAmount(amountCents) || !isIntegerAmount(totalCents) || totalCents === 0) return 0;
  return (amountCents / totalCents) * 100;
}
