const VERIFIED = "verified";

function fallbackPortrait(candidate, sourceRecord = null) {
  const reviewRequired = sourceRecord?.publicationStatus === "review_required";
  return {
    candidateId: candidate.id,
    displayName: candidate.name,
    initials: candidate.initials,
    publicationStatus: reviewRequired ? "review_required" : "fallback",
    display: {
      kind: "initials",
      imageUrl: null,
      thumbnailUrl: null,
      alt: reviewRequired
        ? `${candidate.name} portrait awaits verification; initials shown`
        : `${candidate.name} portrait is not verified; initials shown`,
    },
    identityVerification: {
      status: sourceRecord?.identityVerification?.status ?? "unverified",
      scope: "portrait_subject_only",
      label: reviewRequired ? "Portrait review needed" : "Portrait unverified",
      tooltip: reviewRequired
        ? "A possible portrait was found, but it remains hidden until identity and reuse rights both pass publication checks."
        : "No identity- and rights-verified portrait has been published. Initials are shown instead.",
      method: sourceRecord?.identityVerification?.method ?? null,
    },
    rights: sourceRecord?.rights ?? {
      status: "not_researched",
      license: null,
      licenseUrl: null,
      attribution: null,
      attributionRequired: null,
      changes: null,
    },
    source: sourceRecord?.source ?? null,
    capturedOn: sourceRecord?.capturedOn ?? null,
    review: sourceRecord?.review ?? null,
  };
}

export function isPublishablePortrait(record) {
  return Boolean(
    record &&
      record.publicationStatus === "published" &&
      record.display?.kind === "image" &&
      typeof record.display.imageUrl === "string" &&
      record.display.imageUrl.startsWith("https://") &&
      typeof record.display.thumbnailUrl === "string" &&
      record.display.thumbnailUrl.startsWith("https://") &&
      record.identityVerification?.status === VERIFIED &&
      record.identityVerification?.scope === "portrait_subject_only" &&
      record.rights?.status === VERIFIED &&
      typeof record.rights.license === "string" &&
      record.rights.license.length > 0 &&
      typeof record.rights.attribution === "string" &&
      record.rights.attribution.length > 0 &&
      typeof record.source?.checkedAt === "string",
  );
}

export function adaptPortraitDataset(dataset) {
  if (!dataset || dataset.kind !== "portrait-dataset" || !Array.isArray(dataset.portraits)) {
    throw new Error("Portrait dataset is unavailable or malformed.");
  }
  const candidateIds = dataset.portraits.map((record) => record.candidateId);
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new Error("Portrait dataset contains duplicate candidate records.");
  }
  return dataset.portraits.map((record) => {
    if (record.publicationStatus !== "published") {
      return {
        ...record,
        display: {
          ...record.display,
          kind: "initials",
          imageUrl: null,
          thumbnailUrl: null,
        },
      };
    }
    if (!isPublishablePortrait(record)) {
      return {
        ...record,
        publicationStatus: "review_required",
        display: {
          ...record.display,
          kind: "initials",
          imageUrl: null,
          thumbnailUrl: null,
        },
        identityVerification: {
          ...record.identityVerification,
          status: "unverified",
          label: "Portrait unverified",
          tooltip: "This image failed a publication invariant and was replaced with initials.",
        },
      };
    }
    return record;
  });
}

export function getCandidatePortrait(candidate, records = []) {
  const sourceRecord = records.find((record) => record.candidateId === candidate.id);
  if (!isPublishablePortrait(sourceRecord)) return fallbackPortrait(candidate, sourceRecord);
  return sourceRecord;
}

export function getPortraitAttribution(record) {
  if (!isPublishablePortrait(record)) return null;
  return {
    text: record.rights.attribution,
    license: record.rights.license,
    licenseUrl: record.rights.licenseUrl,
    sourceUrl: record.source.sourcePageUrl,
    changes: record.rights.changes,
  };
}
