import { senateProfileSources } from "../data/senate-candidate-profiles.js";
import {
  buildElectionHistoryData,
  getSenateCandidateProfile,
} from "./senate-profile-data.js";

export const HISTORICAL_CONTEXT_TRANSFORM = Object.freeze({
  id: "closest-historical-context",
  version: "1.0.0",
  selectionRule: "Prefer the same office and stage, then the same office, then the same stage; break ties with the most recent contest.",
  unit: "percent of the reported candidate-vote pool",
});

const CONTEXT_LABELS = Object.freeze({
  "same-office-same-stage": "Same office + stage",
  "same-office-different-stage": "Same office · different stage",
  "different-office-same-stage": "Different office · same stage",
  "different-office": "Different office + stage",
  "different-office-uncontested": "Different office · uncontested",
  other: "Other historical context",
});

function contextKind(election, targetOfficeId, targetStage) {
  const sameOffice = election.office.id === targetOfficeId;
  const sameStage = election.stage === targetStage;
  if (sameOffice && sameStage) return "same-office-same-stage";
  if (sameOffice) return "same-office-different-stage";
  if (sameStage) return "different-office-same-stage";
  if (election.comparability.status === "different-office-uncontested") {
    return "different-office-uncontested";
  }
  if (election.office.id !== targetOfficeId) return "different-office";
  return "other";
}

function contextPriority(kind) {
  return [
    "same-office-same-stage",
    "same-office-different-stage",
    "different-office-same-stage",
    "different-office",
    "different-office-uncontested",
    "other",
  ].indexOf(kind);
}

export function selectClosestHistoricalContext(elections, {
  targetOfficeId,
  targetStage,
}) {
  return [...elections].map((election) => {
    const kind = contextKind(election, targetOfficeId, targetStage);
    return { election, kind, priority: contextPriority(kind) };
  }).sort((left, right) => (
    left.priority - right.priority
    || right.election.date.localeCompare(left.election.date)
    || left.election.id.localeCompare(right.election.id)
  )).at(0) ?? null;
}

export function buildRaceHistoryView({
  candidates = [],
  targetOfficeId = "us-senate-massachusetts",
  targetStage = "primary",
} = {}) {
  const rows = candidates.map((candidate) => {
    const profile = getSenateCandidateProfile(candidate.id);
    const history = buildElectionHistoryData(profile);
    const selected = selectClosestHistoricalContext(history.elections, {
      targetOfficeId,
      targetStage,
    });
    if (!selected) {
      return {
        candidateId: candidate.id,
        candidateName: candidate.name,
        party: candidate.party,
        status: "not-available",
        context: null,
      };
    }

    const { election } = selected;
    const sourceId = election.sourceId ?? election.sourceIds?.[0] ?? null;
    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      party: candidate.party,
      status: "available",
      context: {
        id: election.id,
        date: election.date,
        office: election.office.label,
        jurisdiction: election.office.jurisdiction,
        stage: election.stage,
        outcome: election.outcome,
        candidateVotes: election.candidateVotes,
        totalVotes: election.shareDenominator,
        sharePercent: election.candidateShare === null ? null : election.candidateShare * 100,
        contextKind: selected.kind,
        contextLabel: CONTEXT_LABELS[selected.kind],
        caution: election.comparability.note,
        sourceId,
        source: sourceId ? senateProfileSources[sourceId] ?? null : null,
      },
    };
  });

  return {
    transform: HISTORICAL_CONTEXT_TRANSFORM,
    target: { officeId: targetOfficeId, stage: targetStage },
    axisTicks: [0, 25, 50, 75, 100],
    rows,
    availableRows: rows.filter(({ context }) => context && context.sharePercent !== null),
    unavailableRows: rows.filter(({ context }) => !context || context.sharePercent === null),
    note: "Each row is one selected past contest, not current polling. Different years, offices, stages, fields, and electorates can make the percentages non-comparable.",
  };
}
