export const EVIDENCE_KEYS = ["ballot", "record", "finance", "positions"];

export function filterBallotRows(races, scope = "available") {
  if (scope === "statewide") {
    return races.filter((race) => race.scope === "statewide");
  }

  if (scope === "local") {
    return races.filter((race) => race.scope !== "statewide");
  }

  return races;
}

export function buildBallotRows(races, candidates, scope = "available") {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  return filterBallotRows(races, scope).map((race) => ({
    ...race,
    democraticCandidates: race.democratic.map((id) => candidatesById.get(id)).filter(Boolean),
    republicanCandidates: race.republican.map((id) => candidatesById.get(id)).filter(Boolean),
  }));
}

export function summarizeBallotRows(rows) {
  return rows.reduce((summary, row) => {
    const laneCounts = [row.democraticCandidates.length, row.republicanCandidates.length];
    summary.listings += laneCounts[0] + laneCounts[1];
    summary.emptyLanes += laneCounts.filter((count) => count === 0).length;
    summary.choiceRaces += laneCounts.some((count) => count > 1) ? 1 : 0;
    return summary;
  }, {
    choiceRaces: 0,
    emptyLanes: 0,
    listings: 0,
  });
}

export function describeEvidence(evidence, labels, statuses) {
  return EVIDENCE_KEYS
    .map((key) => `${labels[key]}: ${statuses[evidence[key]] ?? evidence[key]}`)
    .join(", ");
}
