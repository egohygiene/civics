/**
 * Normalized fixture contract for the finance UI.
 *
 * Amounts are non-negative integer cents so exact regulator totals survive
 * serialization without floating-point rounding. This placeholder deliberately
 * contains no invented finance claims; a materializer can replace unknown
 * values after resolving candidate, committee, period, and source identities.
 */
export const massachusettsSenateFinancePlaceholder = {
  id: "ma-us-senate-2026-finance",
  title: "Money in the U.S. Senate race",
  office: "U.S. Senate",
  electionLabel: "2026 Massachusetts State Primary",
  status: "unknown",
  comparison: {
    startDate: "2025-01-01",
    throughDate: "2026-06-30",
    label: "2025–2026 cycle through June 30, 2026",
  },
  candidates: [
    {
      candidateId: "edward-markey",
      name: "Edward J. Markey",
      initials: "EM",
      party: "Democratic",
      status: "unknown",
      coverage: { startDate: "2025-01-01", throughDate: null },
      totals: {},
      receiptComposition: [],
      outsideSpending: {},
      series: [],
      sourceIds: [],
      limitations: ["Candidate and committee identifiers have not been reviewed yet."],
    },
    {
      candidateId: "seth-moulton",
      name: "Seth Moulton",
      initials: "SM",
      party: "Democratic",
      status: "unknown",
      coverage: { startDate: "2025-01-01", throughDate: null },
      totals: {},
      receiptComposition: [],
      outsideSpending: {},
      series: [],
      sourceIds: [],
      limitations: ["Candidate and committee identifiers have not been reviewed yet."],
    },
    {
      candidateId: "john-deaton",
      name: "John Deaton",
      initials: "JD",
      party: "Republican",
      status: "unknown",
      coverage: { startDate: "2025-01-01", throughDate: null },
      totals: {},
      receiptComposition: [],
      outsideSpending: {},
      series: [],
      sourceIds: [],
      limitations: ["Candidate and committee identifiers have not been reviewed yet."],
    },
  ],
  summary: null,
  sources: [],
  limitations: [
    "Finance figures remain unknown until candidate and committee identities are reviewed.",
    "Candidate-controlled committee activity and outside spending must remain separate.",
  ],
};
