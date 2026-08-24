function uniqueById(records) {
  const byId = new Map();
  for (const record of records.filter(Boolean)) {
    if (record.id && !byId.has(record.id)) byId.set(record.id, record);
  }
  return [...byId.values()];
}

function ballotProfileSource(ballotSource) {
  return {
    id: ballotSource.id,
    label: `${ballotSource.name} candidate roster`,
    publisher: ballotSource.name,
    kind: "official-election",
    url: ballotSource.url,
    checkedAt: ballotSource.checkedAt,
    reviewState: "human-reviewed-snapshot",
    recordIds: [],
  };
}

function financeProfileSource(financeRecord) {
  if (!financeRecord?.source?.id) return null;
  return {
    id: financeRecord.source.id,
    label: financeRecord.source.label ?? `${financeRecord.provider ?? "Campaign finance"} filing`,
    publisher: financeRecord.source.label ?? financeRecord.provider ?? null,
    kind: "finance-regulator",
    url: financeRecord.source.url ?? null,
    checkedAt: financeRecord.source.checkedAt ?? financeRecord.period?.asOf ?? null,
    reviewState: "automated-checks-passed",
    recordIds: financeRecord.source.recordIds ?? [],
  };
}

function sourceIdsForKinds(sources, kinds) {
  return sources.filter(({ kind }) => kinds.includes(kind)).map(({ id }) => id);
}

export function buildCandidateProfile({
  ballotSource,
  candidate,
  financeRecord = null,
  portrait = null,
  senateProfile = null,
}) {
  const inferredPartyLabel = candidate.party
    ? `${candidate.party.charAt(0).toUpperCase()}${candidate.party.slice(1)}`
    : "Party not listed";
  const partyLabel = candidate.partyLabel ?? inferredPartyLabel;
  const rosterSource = ballotProfileSource(ballotSource);
  const financeSource = financeProfileSource(financeRecord);
  const sourcedProfile = senateProfile ?? {};
  const sources = uniqueById([
    ...(sourcedProfile.sources ?? []),
    rosterSource,
    financeSource,
  ]);
  const publicRecordSourceIds = sourceIdsForKinds(sources, [
    "official-government",
    "legislative-record",
  ]);
  const profileEvidence = sourcedProfile.evidence ?? [];
  const baseEvidence = [
    {
      id: "ballot",
      label: "Ballot identity",
      status: candidate.evidence?.ballot ?? "unknown",
      detail: "Candidate name, office, and party from the checked roster snapshot",
      sourceIds: [rosterSource.id],
    },
    {
      id: "record",
      label: "Public record",
      status: candidate.evidence?.record ?? "unknown",
      detail: publicRecordSourceIds.length
        ? `${publicRecordSourceIds.length} linked public-record source${publicRecordSourceIds.length === 1 ? "" : "s"}`
        : "No reviewed record source is linked in this profile yet",
      sourceIds: publicRecordSourceIds,
    },
    {
      id: "finance",
      label: "Campaign finance",
      status: financeRecord ? financeRecord.status : candidate.evidence?.finance ?? "unknown",
      detail: financeRecord
        ? `${financeRecord.provider?.toUpperCase() ?? "Regulator"} filing snapshot through ${financeRecord.period?.endDate ?? "an unknown date"}`
        : "Candidate-to-filer mapping or finance retrieval remains open",
      sourceIds: financeSource ? [financeSource.id] : [],
    },
    {
      id: "positions",
      label: "Policy positions",
      status: candidate.evidence?.positions ?? "unknown",
      detail: "Position research is published only when statements and sources are linked",
      sourceIds: [],
    },
  ];
  const hasPublishedPortrait = portrait?.publicationStatus === "published";
  const limitations = [
    ...(sourcedProfile.limitations ?? []),
    `The candidate roster is a manually reviewed snapshot checked ${ballotSource.checkedAt}; it is not a promise of final certification.`,
    ...(!senateProfile ? [
      "Career chronology and prior-election enrichment have not been materialized for this candidate yet.",
    ] : []),
    ...(!hasPublishedPortrait ? [
      "No portrait has passed both identity and publication-rights checks; initials are shown instead.",
    ] : []),
  ];

  return {
    ...sourcedProfile,
    id: sourcedProfile.id ?? `profile-${candidate.id}`,
    candidateId: candidate.id,
    checkedAt: sourcedProfile.checkedAt ?? ballotSource.checkedAt,
    photo: portrait,
    facts: [
      {
        id: `${candidate.id}-roster-listing`,
        label: "Checked roster listing",
        value: `${partyLabel || "Party not listed"} · ${candidate.office}`,
        detail: "Official corrections or withdrawals may still occur.",
        status: "available",
        sourceIds: [rosterSource.id],
      },
      ...(sourcedProfile.facts ?? []),
    ],
    evidence: uniqueById([...baseEvidence, ...profileEvidence]),
    sources,
    limitations: [...new Set(limitations)],
  };
}
