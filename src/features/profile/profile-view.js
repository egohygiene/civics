export const PHOTO_VERIFICATION = Object.freeze({
  verified: {
    label: "Photo verified",
    description: "The portrait subject and reuse rights passed the linked publication checks. This verifies the photo only—not the candidate or their claims.",
  },
  unverified: {
    label: "Photo unverified",
    description: "Initials are shown because no candidate photo has passed both identity and publication-rights checks.",
  },
});

export const PROFILE_STATUS_LABELS = Object.freeze({
  verified: "Verified",
  available: "Available",
  partial: "Partial",
  queued: "Queued",
  researching: "Researching",
  unknown: "Unknown",
  "not-researched": "Not researched",
  "not-applicable": "Not applicable",
});

export const EVIDENCE_LAYER_LABELS = Object.freeze({
  ballot: "Ballot identity",
  record: "Public record",
  finance: "Campaign finance",
  positions: "Policy positions",
  biography: "Career history",
  elections: "Election history",
});

export const SOURCE_KIND_LABELS = Object.freeze({
  "official-government": "Official government",
  "official-election": "Election authority",
  "campaign-controlled": "Candidate-controlled",
  "legislative-record": "Legislative record",
  "finance-regulator": "Finance regulator",
  "manual-review": "Manual review",
  other: "Other source",
});

const IDENTIFIER_SYSTEM_LABELS = Object.freeze({
  bioguide: "Bioguide",
  "fec-candidate": "FEC candidate",
  "fec-committee": "FEC committee",
});

const PROFILE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const PROFILE_MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const PROFILE_NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const PROFILE_PERCENT_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function parseTemporalDate(value, edge = "start") {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:T.*)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : edge === "start" ? 1 : 12;
  const day = match[3]
    ? Number(match[3])
    : edge === "start"
      ? 1
      : new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  return {
    timestamp,
    precision: match[3] ? "day" : match[2] ? "month" : "year",
  };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(safeArray(values).filter((value) => typeof value === "string" && value))];
}

export function formatProfileDate(value, monthOnly = false) {
  const temporal = parseTemporalDate(value);
  if (!temporal) return "Unknown";
  if (temporal.precision === "year") return String(new Date(temporal.timestamp).getUTCFullYear());
  return (monthOnly || temporal.precision === "month" ? PROFILE_MONTH_FORMAT : PROFILE_DATE_FORMAT).format(temporal.timestamp);
}

export function formatProfileNumber(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? PROFILE_NUMBER_FORMAT.format(value)
    : "Unknown";
}

export function formatProfilePercent(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100
    ? `${PROFILE_PERCENT_FORMAT.format(value)}%`
    : "Unknown";
}

export function normalizeProfileStatus(value) {
  if (value === "complete") return "available";
  if (value === "not_applicable") return "not-applicable";
  return Object.hasOwn(PROFILE_STATUS_LABELS, value) ? value : "unknown";
}

export function normalizeProfilePhoto(photo = {}) {
  photo = photo ?? {};
  const candidateUrl = photo.display?.imageUrl ?? photo.url;
  const url = typeof candidateUrl === "string" && /^https?:\/\//.test(candidateUrl)
    ? candidateUrl
    : null;
  const candidateThumbnailUrl = photo.display?.thumbnailUrl ?? photo.thumbnailUrl;
  const thumbnailUrl = typeof candidateThumbnailUrl === "string" && /^https?:\/\//.test(candidateThumbnailUrl)
    ? candidateThumbnailUrl
    : url;
  const requestedStatus = photo.identityVerification?.status ?? photo.verificationStatus ?? photo.status;
  const requestedRightsStatus = photo.rights?.status ?? photo.rightsStatus;
  const isCanonicalPublishable = photo.publicationStatus === "published"
    && photo.display?.kind === "image"
    && requestedStatus === "verified"
    && requestedRightsStatus === "verified";
  const isSimplePublishable = ["publishable", "approved"].includes(requestedRightsStatus);
  const isPublishable = isCanonicalPublishable || isSimplePublishable;
  const verificationStatus = url
    && ["verified", "human-reviewed"].includes(requestedStatus)
    && isPublishable
    ? "verified"
    : "unverified";
  const sourcePageUrl = photo.source?.sourcePageUrl ?? photo.source?.url;
  const embeddedSource = typeof sourcePageUrl === "string" && /^https?:\/\//.test(sourcePageUrl)
    ? {
      id: photo.source?.id ?? "portrait-source",
      label: photo.source?.label ?? "Portrait source",
      publisher: photo.source?.provider ?? null,
      kind: "other",
      kindLabel: "Portrait source",
      url: sourcePageUrl,
      checkedAt: photo.source?.checkedAt ?? photo.capturedOn ?? null,
      recordIds: [],
    }
    : null;

  return {
    url,
    thumbnailUrl,
    alt: typeof (photo.display?.alt ?? photo.alt) === "string" && (photo.display?.alt ?? photo.alt).trim()
      ? (photo.display?.alt ?? photo.alt).trim()
      : "",
    verificationStatus,
    rightsStatus: isPublishable ? "publishable" : "unreviewed",
    sourceId: typeof photo.sourceId === "string" ? photo.sourceId : null,
    checkedAt: typeof (photo.checkedAt ?? photo.source?.checkedAt) === "string"
      ? photo.checkedAt ?? photo.source.checkedAt
      : null,
    embeddedSource,
  };
}

export function calculateVoteShare(candidateVotes, totalVotes, suppliedShare = null) {
  if (
    Number.isSafeInteger(candidateVotes)
    && candidateVotes >= 0
    && Number.isSafeInteger(totalVotes)
    && totalVotes > 0
    && candidateVotes <= totalVotes
  ) return (candidateVotes / totalVotes) * 100;
  return Number.isFinite(suppliedShare) && suppliedShare >= 0 && suppliedShare <= 100
    ? suppliedShare
    : null;
}

export function buildElectionHistoryView(elections = []) {
  const rows = safeArray(elections).map((election, index) => {
    const candidateVotes = Number.isSafeInteger(election.candidateVotes) && election.candidateVotes >= 0
      ? election.candidateVotes
      : null;
    const totalVotes = Number.isSafeInteger(election.totalVotes) && election.totalVotes >= 0
      ? election.totalVotes
      : null;
    const voteShare = calculateVoteShare(candidateVotes, totalVotes, election.voteShare);
    const otherVotes = candidateVotes !== null && totalVotes !== null && totalVotes >= candidateVotes
      ? totalVotes - candidateVotes
      : null;

    return {
      id: election.id ?? `election-${index + 1}`,
      date: election.date ?? null,
      office: election.office ?? "Office not recorded",
      electionType: election.electionType ?? "Election type not recorded",
      jurisdiction: election.jurisdiction ?? null,
      candidateVotes,
      totalVotes,
      otherVotes,
      voteShare,
      candidateWidth: voteShare ?? 0,
      otherWidth: voteShare === null ? 0 : Math.max(0, 100 - voteShare),
      result: election.result ?? null,
      status: voteShare === null ? "partial" : normalizeProfileStatus(election.status ?? "available"),
      sourceIds: uniqueStrings(election.sourceIds),
      note: election.note ?? null,
    };
  }).sort((left, right) => String(left.date ?? "").localeCompare(String(right.date ?? "")));

  return {
    rows,
    chartRows: rows.filter(({ voteShare }) => voteShare !== null),
    unknownRows: rows.filter(({ voteShare }) => voteShare === null),
    axisTicks: [0, 25, 50, 75, 100],
    unit: "share of reported votes",
    note: "Every bar uses the same 0–100% axis. Vote share describes a past contest; different offices, electorates, and election types are not directly predictive.",
  };
}

function interpolateDate(start, end, ratio) {
  return start + ((end - start) * ratio);
}

export function buildCareerTimelineView(entries = [], throughDate = null) {
  const throughTimestamp = parseTemporalDate(throughDate, "end")?.timestamp ?? null;
  const normalizedEntries = safeArray(entries).map((entry, index) => {
    const startTemporal = parseTemporalDate(entry.startDate, "start");
    const endTemporal = parseTemporalDate(entry.endDate, "end");
    const startTimestamp = startTemporal?.timestamp ?? null;
    const explicitEndTimestamp = endTemporal?.timestamp ?? null;
    const endTimestamp = explicitEndTimestamp ?? throughTimestamp;
    const hasRange = startTimestamp !== null && endTimestamp !== null && endTimestamp >= startTimestamp;
    return {
      id: entry.id ?? `career-${index + 1}`,
      title: entry.title ?? "Role not recorded",
      organization: entry.organization ?? null,
      location: entry.location ?? null,
      startDate: entry.startDate ?? null,
      endDate: entry.endDate ?? null,
      isCurrent: !entry.endDate && Boolean(entry.startDate),
      description: entry.description ?? null,
      evidenceKind: entry.evidenceKind ?? "official-government",
      status: normalizeProfileStatus(entry.status ?? (hasRange ? "available" : "partial")),
      sourceIds: uniqueStrings(entry.sourceIds),
      startTimestamp,
      endTimestamp,
      startPrecision: startTemporal?.precision ?? null,
      endPrecision: endTemporal?.precision ?? null,
      hasRange,
    };
  }).sort((left, right) => (
    (left.startTimestamp ?? Number.POSITIVE_INFINITY) - (right.startTimestamp ?? Number.POSITIVE_INFINITY)
    || left.title.localeCompare(right.title)
  ));

  const rangedEntries = normalizedEntries.filter(({ hasRange }) => hasRange);
  const domainStart = rangedEntries.length
    ? Math.min(...rangedEntries.map(({ startTimestamp }) => startTimestamp))
    : null;
  const domainEnd = rangedEntries.length
    ? Math.max(...rangedEntries.map(({ endTimestamp }) => endTimestamp))
    : null;
  const domainSpan = domainStart !== null && domainEnd !== null
    ? Math.max(domainEnd - domainStart, 86_400_000)
    : null;
  const bars = rangedEntries.map((entry) => ({
    ...entry,
    offsetPercent: ((entry.startTimestamp - domainStart) / domainSpan) * 100,
    widthPercent: Math.max(1.25, ((entry.endTimestamp - entry.startTimestamp) / domainSpan) * 100),
  }));
  const axisTicks = domainSpan === null
    ? []
    : [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      label: String(new Date(interpolateDate(domainStart, domainEnd, ratio)).getUTCFullYear()),
      offsetPercent: ratio * 100,
    }));
  const hasImpreciseBoundary = normalizedEntries.some(({ startPrecision, endPrecision }) => (
    [startPrecision, endPrecision].some((precision) => precision && precision !== "day")
  ));
  const cutoffNote = throughDate
    ? `Open-ended roles are drawn through the profile's ${formatProfileDate(throughDate)} source-check cutoff.`
    : "Open-ended roles need a documented source-check cutoff before a duration is drawn.";
  const precisionNote = hasImpreciseBoundary
    ? " Year- and month-precision records use full calendar bounds for layout; labels retain the source precision."
    : "";

  return {
    rows: normalizedEntries,
    bars,
    unrangedRows: normalizedEntries.filter(({ hasRange }) => !hasRange),
    axisTicks,
    domain: {
      startDate: domainStart === null ? null : new Date(domainStart).toISOString().slice(0, 10),
      endDate: domainEnd === null ? null : new Date(domainEnd).toISOString().slice(0, 10),
    },
    note: `${cutoffNote}${precisionNote}`,
  };
}

function normalizeEvidence(evidence) {
  if (Array.isArray(evidence)) {
    return evidence.map((item) => ({
      id: item.id,
      label: item.label ?? EVIDENCE_LAYER_LABELS[item.id] ?? item.id,
      status: normalizeProfileStatus(item.status),
      detail: item.detail ?? null,
      sourceIds: uniqueStrings(item.sourceIds),
    })).filter(({ id }) => Boolean(id));
  }
  return Object.entries(evidence ?? {}).map(([id, status]) => ({
    id,
    label: EVIDENCE_LAYER_LABELS[id] ?? id,
    status: normalizeProfileStatus(status),
    detail: null,
    sourceIds: [],
  }));
}

export function buildEvidenceCoverageView(evidence = {}) {
  const layers = normalizeEvidence(evidence);
  return {
    layers,
    availableCount: layers.filter(({ status }) => ["verified", "available"].includes(status)).length,
    partialCount: layers.filter(({ status }) => status === "partial").length,
    openCount: layers.filter(({ status }) => !["verified", "available", "partial", "not-applicable"].includes(status)).length,
    note: "Coverage states report what this prototype has researched. They are not grades, endorsements, or measures of candidate quality.",
  };
}

function normalizeSource(source) {
  const url = typeof source.url === "string" && /^https?:\/\//.test(source.url) ? source.url : null;
  return {
    id: source.id,
    label: source.label ?? source.name ?? source.id,
    publisher: source.publisher ?? null,
    kind: source.kind ?? "other",
    kindLabel: SOURCE_KIND_LABELS[source.kind] ?? source.kind ?? SOURCE_KIND_LABELS.other,
    url,
    checkedAt: source.checkedAt ?? null,
    reviewState: source.reviewState ?? null,
    recordIds: uniqueStrings(source.recordIds),
  };
}

function normalizeProfileLink(link, index) {
  const url = typeof link.url === "string" && /^https?:\/\//.test(link.url) ? link.url : null;
  if (!url) return null;
  const kind = link.kind ?? "campaign-controlled";
  return {
    id: link.id ?? `profile-link-${index + 1}`,
    label: link.label ?? "Profile link",
    url,
    kind,
    kindLabel: SOURCE_KIND_LABELS[kind] ?? kind,
    sourceId: link.sourceId ?? null,
  };
}

function normalizeFacts(facts) {
  return safeArray(facts).map((fact, index) => ({
    id: fact.id ?? `fact-${index + 1}`,
    label: fact.label ?? "Fact",
    value: fact.value ?? "Unknown",
    detail: fact.detail ?? null,
    status: normalizeProfileStatus(fact.status ?? (
      fact.value === null || fact.value === undefined ? "unknown" : "available"
    )),
    sourceIds: uniqueStrings(fact.sourceIds ?? [fact.sourceId]),
  }));
}

function normalizeIdentifiers(identifiers) {
  return safeArray(identifiers).map((identifier, index) => ({
    id: identifier.id ?? `identifier-${index + 1}`,
    system: identifier.system ?? "other",
    systemLabel: IDENTIFIER_SYSTEM_LABELS[identifier.system] ?? identifier.system ?? "Other identifier",
    value: identifier.value ?? "Unknown",
    scope: identifier.scope ?? null,
    current: identifier.current !== false,
    sourceIds: uniqueStrings(identifier.sourceIds ?? [identifier.sourceId]),
  }));
}

function mergeProfileEvidence(candidateEvidence, profileEvidence) {
  const merged = new Map();
  for (const layer of normalizeEvidence(candidateEvidence)) merged.set(layer.id, layer);
  for (const layer of normalizeEvidence(profileEvidence)) merged.set(layer.id, layer);
  return [...merged.values()];
}

function normalizeSynthesis(synthesis) {
  if (!synthesis?.text) return null;
  return {
    title: synthesis.title ?? "Evidence synthesis",
    text: synthesis.text,
    status: synthesis.status ?? "ai-assisted-draft",
    disclosure: synthesis.disclosure ?? "AI-assisted synthesis; verify consequential claims in the linked sources.",
    method: synthesis.method ?? null,
    reviewStatus: synthesis.reviewStatus ?? "Unreviewed draft",
    generatedAt: synthesis.generatedAt ?? null,
    sourceIds: uniqueStrings(synthesis.sourceIds),
    limitations: safeArray(synthesis.limitations),
  };
}

export function buildProfileView({ candidate = {}, profile = {} } = {}) {
  const sources = safeArray(profile.sources).map(normalizeSource).filter(({ id }) => Boolean(id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const checkedAt = profile.checkedAt ?? sources.map(({ checkedAt: date }) => date).filter(Boolean).sort().at(-1) ?? null;
  const photo = normalizeProfilePhoto(profile.photo);
  const photoSource = photo.sourceId
    ? sourceById.get(photo.sourceId) ?? photo.embeddedSource
    : photo.embeddedSource;

  return {
    id: profile.id ?? `profile-${candidate.id ?? "candidate"}`,
    candidate: {
      id: candidate.id ?? null,
      name: candidate.name ?? "Candidate name unavailable",
      initials: candidate.initials ?? candidate.name?.split(/\s+/).map((part) => part[0]).slice(0, 2).join("") ?? "?",
      party: candidate.party ?? "unknown",
      partyLabel: candidate.partyLabel ?? candidate.party ?? "Party not listed",
      office: candidate.office ?? "Office not listed",
      role: candidate.role ?? "Role not listed",
      locality: candidate.locality ?? null,
      summary: candidate.summary ?? null,
    },
    checkedAt,
    photo: { ...photo, source: photoSource },
    links: safeArray(profile.links).map(normalizeProfileLink).filter(Boolean),
    identifiers: normalizeIdentifiers(profile.identifiers),
    facts: normalizeFacts(profile.facts),
    timeline: buildCareerTimelineView(profile.timeline, checkedAt),
    elections: buildElectionHistoryView(profile.elections),
    evidence: buildEvidenceCoverageView(mergeProfileEvidence(candidate.evidence, profile.evidence)),
    synthesis: normalizeSynthesis(profile.synthesis),
    sources,
    sourceById,
    limitations: safeArray(profile.limitations),
  };
}

export function resolveProfileSources(sourceIds, sourceById) {
  return uniqueStrings(sourceIds).map((sourceId) => sourceById.get(sourceId)).filter(Boolean);
}
