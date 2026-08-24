import {
  senateCandidateProfilesById,
  senateProfileSources,
} from "../data/senate-candidate-profiles.js";

const TEMPORAL_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

function parseTemporal(value, edge = "start") {
  if (typeof value !== "string") return null;
  const match = value.match(TEMPORAL_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : edge === "start" ? 1 : 12;
  const day = match[3]
    ? Number(match[3])
    : edge === "start"
      ? 1
      : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const timestamp = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(timestamp)) return null;

  return {
    value,
    precision: match[3] ? "day" : match[2] ? "month" : "year",
    timestamp,
  };
}

function candidateVoteOption(election) {
  return election.options.find(({ id }) => id === election.candidateOptionId) ?? null;
}

function shareDenominator(election) {
  return election.options
    .filter(({ countsTowardShare }) => countsTowardShare)
    .reduce((total, option) => total + option.votes, 0);
}

export function getSenateCandidateProfile(candidateId) {
  return senateCandidateProfilesById[candidateId] ?? null;
}

export function buildCareerTimelineData(profile) {
  if (!profile) return { entries: [], lanes: {}, unresolved: [] };

  const entries = profile.careerTimeline.map((entry) => {
    const start = parseTemporal(entry.period?.start, "start");
    const end = parseTemporal(entry.period?.end, "end");
    return {
      ...entry,
      temporal: {
        start,
        end,
        isCurrent: entry.period?.end === null,
        label: entry.period?.end
          ? `${entry.period.start}–${entry.period.end}`
          : `${entry.period?.start ?? "Unknown"}–present`,
      },
    };
  }).sort((left, right) => (
    (left.temporal.start?.timestamp ?? Number.POSITIVE_INFINITY)
    - (right.temporal.start?.timestamp ?? Number.POSITIVE_INFINITY)
    || left.id.localeCompare(right.id)
  ));

  const lanes = Object.groupBy(entries, ({ category }) => category ?? "other");
  return {
    entries,
    lanes,
    unresolved: entries.filter(({ temporal }) => temporal.start === null),
  };
}

export function buildElectionHistoryData(profile) {
  if (!profile) return { elections: [], byOffice: {}, byStage: {}, warnings: [] };

  const elections = profile.electionHistory.map((election) => {
    const candidate = candidateVoteOption(election);
    const denominator = shareDenominator(election);
    const segments = election.options.map((option) => ({
      ...option,
      share: option.countsTowardShare && denominator > 0 ? option.votes / denominator : null,
    }));
    return {
      ...election,
      candidateVotes: candidate?.votes ?? null,
      candidateShare: candidate && denominator > 0 ? candidate.votes / denominator : null,
      shareDenominator: denominator,
      shareBasis: "reported-candidate-vote-pool",
      visualizationRole: election.comparability.status === "same-office-same-stage"
        ? "closest-historical-context"
        : "historical-context-only",
      nonCandidateBallots: {
        blank: election.totals.blankBallots,
        reportedBallots: election.totals.ballotsCast,
      },
      segments,
    };
  }).sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));

  return {
    elections,
    byOffice: Object.groupBy(elections, ({ office }) => office.id),
    byStage: Object.groupBy(elections, ({ stage }) => stage),
    warnings: [...new Set(elections.map(({ comparability }) => comparability.note))],
  };
}

export function materializeProfileViewData(profile) {
  if (!profile) return null;
  const timeline = buildCareerTimelineData(profile);
  const elections = buildElectionHistoryData(profile);
  const usedSourceIds = new Set([
    ...profile.identifiers.flatMap(({ sourceIds }) => sourceIds),
    ...profile.links.flatMap(({ sourceIds }) => sourceIds),
    ...profile.facts.flatMap(({ sourceIds }) => sourceIds),
    ...profile.careerTimeline.flatMap(({ sourceIds }) => sourceIds),
    ...profile.electionHistory.flatMap(({ sourceIds }) => sourceIds),
  ]);

  return {
    id: `profile-${profile.candidateId}`,
    candidateId: profile.candidateId,
    checkedAt: profile.checkedAt,
    reviewState: profile.reviewState,
    identifiers: profile.identifiers,
    links: profile.links,
    facts: profile.facts,
    timeline: timeline.entries.map((entry) => ({
      ...entry,
      startDate: entry.period.start,
      endDate: entry.period.end,
    })),
    elections: elections.elections.map((election) => ({
      ...election,
      electionType: election.stage,
      office: election.office.label,
      jurisdiction: election.office.jurisdiction,
      totalVotes: election.shareDenominator,
      voteShare: election.candidateShare === null ? null : election.candidateShare * 100,
      result: election.outcome,
      status: "available",
      note: election.comparability.note,
    })),
    sources: [...usedSourceIds].map((sourceId) => senateProfileSources[sourceId]),
    gaps: profile.gaps,
    evidence: [
      {
        id: "biography",
        label: "Career history",
        status: profile.careerTimeline.length ? "available" : "researching",
        detail: `${profile.careerTimeline.length} sourced timeline records`,
        sourceIds: [...new Set(profile.careerTimeline.flatMap(({ sourceIds }) => sourceIds))],
      },
      {
        id: "elections",
        label: "Election history",
        status: profile.electionHistory.length ? "available" : "researching",
        detail: `${profile.electionHistory.length} selected prior contests`,
        sourceIds: [...new Set(profile.electionHistory.flatMap(({ sourceIds }) => sourceIds))],
      },
    ],
    limitations: [
      "Election results describe past contests; they are not a prediction or candidate-quality measure.",
      "Different offices, stages, years, opponent fields, and electorates are explicitly marked as non-comparable.",
      "All records in this first slice require maintainer review before a verified editorial badge is shown.",
      ...profile.gaps.map(({ note }) => note),
    ],
  };
}
