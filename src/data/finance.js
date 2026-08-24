const fecSource = {
  id: "fec-candidate-finance-2026",
  label: "Federal Election Commission",
  provider: "fec",
  checkedAt: "2026-08-24",
  reportingNote: "FEC summary data may lag newly filed reports by up to 48 hours.",
};

export const financeRecords = [
  {
    candidateId: "edward-markey",
    status: "available",
    provider: "fec",
    committeeName: "The Markey Committee",
    externalIdentifiers: {
      candidateId: "S4MA00028",
      committeeIds: ["C00196774"],
    },
    period: {
      cycle: 2026,
      startDate: "2025-01-01",
      endDate: "2026-08-12",
      asOf: "2026-08-12",
      label: "2025–2026 cycle through Aug. 12, 2026",
      comparability: "aligned-end-date",
    },
    totals: {
      receipts: 5352148.33,
      disbursements: 5814159.22,
      cashOnHand: 1348676.08,
      debtsOwed: 0,
    },
    receiptComposition: [
      { id: "individuals", label: "Individual contributions", amount: 2362475.2 },
      { id: "committees", label: "Other committee contributions", amount: 589250 },
      { id: "candidate", label: "Candidate contributions", amount: 0 },
      { id: "transfers", label: "Other authorized committee transfers", amount: 2284238.31 },
      { id: "loans", label: "Loans", amount: 0 },
      { id: "other", label: "Offsets and other receipts", amount: 116184.82 },
    ],
    outsideSpending: {
      status: "not-researched",
      support: null,
      oppose: null,
      note: "Independent expenditure totals are not included in this first snapshot.",
    },
    source: {
      ...fecSource,
      id: "fec-finance-edward-markey-2026",
      url: "https://www.fec.gov/data/committee/C00196774/?cycle=2026",
      recordIds: ["S4MA00028", "C00196774"],
    },
    limitations: [
      "Receipts include transfers from other authorized committees.",
      "Cash on hand can include funds accumulated before this election cycle.",
    ],
  },
  {
    candidateId: "seth-moulton",
    status: "available",
    provider: "fec",
    committeeName: "Seth for Massachusetts, Inc.",
    externalIdentifiers: {
      candidateId: "S6MA00296",
      committeeIds: ["C00547240"],
    },
    period: {
      cycle: 2026,
      startDate: "2025-01-01",
      endDate: "2026-08-12",
      asOf: "2026-08-12",
      label: "2025–2026 cycle through Aug. 12, 2026",
      comparability: "aligned-end-date",
    },
    totals: {
      receipts: 6213102.88,
      disbursements: 6228105.21,
      cashOnHand: 1835335.73,
      debtsOwed: 0,
    },
    receiptComposition: [
      { id: "individuals", label: "Individual contributions", amount: 5853522.29 },
      { id: "committees", label: "Other committee contributions", amount: 241200 },
      { id: "candidate", label: "Candidate contributions", amount: 0 },
      { id: "transfers", label: "Other authorized committee transfers", amount: 1469.16 },
      { id: "loans", label: "Loans", amount: 0 },
      { id: "other", label: "Offsets and other receipts", amount: 116911.43 },
    ],
    outsideSpending: {
      status: "not-researched",
      support: null,
      oppose: null,
      note: "Independent expenditure totals are not included in this first snapshot.",
    },
    source: {
      ...fecSource,
      id: "fec-finance-seth-moulton-2026",
      url: "https://www.fec.gov/data/committee/C00547240/?cycle=2026",
      recordIds: ["S6MA00296", "C00547240"],
    },
    limitations: [
      "This is the principal campaign committee's federal cycle summary.",
      "Cash on hand can include funds accumulated before this election cycle.",
    ],
  },
  {
    candidateId: "john-deaton",
    status: "available",
    provider: "fec",
    committeeName: "John Deaton for Senate",
    externalIdentifiers: {
      candidateId: "S6MA00304",
      committeeIds: ["C00926139"],
    },
    period: {
      cycle: 2026,
      startDate: "2025-10-01",
      endDate: "2026-08-12",
      asOf: "2026-08-12",
      label: "Oct. 1, 2025–Aug. 12, 2026",
      comparability: "different-start-date",
    },
    totals: {
      receipts: 1561360.3,
      disbursements: 848942.9,
      cashOnHand: 712417.4,
      debtsOwed: 1005000,
    },
    receiptComposition: [
      { id: "individuals", label: "Individual contributions", amount: 472175.11 },
      { id: "committees", label: "Other committee contributions", amount: 5775 },
      { id: "candidate", label: "Candidate contributions", amount: 53414 },
      { id: "transfers", label: "Other authorized committee transfers", amount: 0 },
      { id: "loans", label: "Loans", amount: 1000000 },
      { id: "other", label: "Offsets and other receipts", amount: 29996.19 },
    ],
    outsideSpending: {
      status: "not-researched",
      support: null,
      oppose: null,
      note: "Independent expenditure totals are not included in this first snapshot.",
    },
    source: {
      ...fecSource,
      id: "fec-finance-john-deaton-2026",
      url: "https://www.fec.gov/data/candidate/S6MA00304/?cycle=2026",
      recordIds: ["S6MA00304", "C00926139"],
    },
    limitations: [
      "This committee's reporting period begins later than the other candidates' periods.",
      "One million dollars of reported receipts are candidate loans and should not be read as outside support.",
    ],
  },
];

export const financeSynthesisByRace = {
  "us-senate": {
    status: "ai-assisted-draft",
    reviewStatus: "Unreviewed draft",
    generatedAt: "2026-08-24T13:00:00-04:00",
    reviewedAt: null,
    title: "The money tells three different campaign stories.",
    text: "At the Aug. 12 snapshot, Seth Moulton reports the largest 2025–2026 receipts at $6.21 million, followed by Edward Markey at $5.35 million. Their sources differ: roughly 94% of Moulton's receipts are individual contributions, while about 43% of Markey's are transfers from other authorized committees. John Deaton's committee began reporting later, on Oct. 1, 2025; $1 million of its $1.56 million in receipts is candidate loans. Moulton reports $1.84 million cash on hand, Markey $1.35 million, and Deaton $712,000 alongside $1.005 million in debt.",
    evidenceCandidateIds: ["edward-markey", "seth-moulton", "john-deaton"],
    sourceIds: [
      "fec-finance-edward-markey-2026",
      "fec-finance-seth-moulton-2026",
      "fec-finance-john-deaton-2026",
    ],
    disclosure: "AI-assisted orientation derived only from the exact regulator totals shown here.",
    method: "AI-assisted arithmetic summary of the exact FEC committee totals displayed in this section. No donor-level records, sentiment, viability prediction, or candidate-quality judgment were used.",
    limitations: [
      "The candidates do not all share the same reporting-period start date.",
      "Receipts are not votes, endorsements, or a measure of public support.",
      "This draft has automated checks but has not received independent human editorial review.",
    ],
  },
};

function metricValue(metric) {
  return metric?.status === "known" && Number.isFinite(metric.value) ? metric.value : null;
}

export function adaptOcpfFinanceDataset(dataset) {
  if (!dataset || dataset.provider?.id !== "ocpf" || !Array.isArray(dataset.candidates)) return [];

  return dataset.candidates.map((candidate) => {
    const limitationNotes = [
      ...(dataset.limitations ?? []),
      ...(candidate.comparability?.caveats ?? []),
      ...Object.values(candidate.totals ?? {})
        .map((metric) => metric?.note)
        .filter(Boolean),
      candidate.receiptComposition?.note,
      candidate.outsideSpending?.note,
    ].filter(Boolean);

    return {
      candidateId: candidate.candidateId,
      status: candidate.status === "complete" ? "available" : candidate.status,
      provider: "ocpf",
      committeeName: candidate.identity?.committeeName ?? null,
      externalIdentifiers: {
        cpfId: candidate.provider?.entityId ?? null,
      },
      period: {
        cycle: candidate.period?.cycle ?? dataset.period?.cycle ?? 2026,
        startDate: candidate.period?.startDate ?? null,
        endDate: candidate.period?.endDate ?? null,
        asOf: candidate.period?.asOf ?? null,
        label: candidate.period?.basis === "year_to_date" ? "OCPF year-to-date filing" : "OCPF filing period",
        comparability: candidate.comparability?.status ?? "limited",
      },
      totals: {
        receipts: metricValue(candidate.totals?.receipts),
        disbursements: metricValue(candidate.totals?.disbursements),
        cashOnHand: metricValue(candidate.totals?.cashOnHand),
        debtsOwed: metricValue(candidate.totals?.debtsOwed),
      },
      receiptComposition: candidate.receiptComposition?.value ?? [],
      outsideSpending: {
        status: candidate.outsideSpending?.status ?? "not-researched",
        support: null,
        oppose: null,
        note: candidate.outsideSpending?.note ?? null,
      },
      source: {
        id: `ocpf-finance-${candidate.candidateId}-2026`,
        label: "Massachusetts Office of Campaign and Political Finance",
        provider: "ocpf",
        url: candidate.source?.url ?? dataset.provider.documentationUrl,
        checkedAt: candidate.freshness?.checkedAt ?? dataset.freshness?.checkedAt,
        recordIds: [candidate.source?.recordId, candidate.provider?.entityId].filter(Boolean),
      },
      limitations: [...new Set(limitationNotes)],
    };
  });
}

export function getFinanceRecord(candidateId, records = financeRecords) {
  return records.find((record) => record.candidateId === candidateId) ?? null;
}

export function getRaceFinanceRecords(race, visibleCandidateIds, records = financeRecords) {
  if (!race) return [];
  const raceCandidateIds = [...race.democratic, ...race.republican];
  const allowedCandidateIds = new Set(visibleCandidateIds ?? raceCandidateIds);
  return records.filter((record) => raceCandidateIds.includes(record.candidateId) && allowedCandidateIds.has(record.candidateId));
}
