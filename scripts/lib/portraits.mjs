const HTTPS_URL = /^https:\/\//;
const SHA256 = /^[a-f0-9]{64}$/;

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function assertHttpsUrl(value, label) {
  assertNonEmptyString(value, label);
  if (!HTTPS_URL.test(value)) throw new Error(`${label} must use HTTPS.`);
}

function assertUnique(records, property, label) {
  const values = records.map((record) => record[property]);
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate ${property} values.`);
  }
}

export function assertPortraitSourceSnapshot(snapshot) {
  assertObject(snapshot, "Portrait source snapshot");
  if (snapshot.kind !== "portrait-source-snapshot") {
    throw new Error("Portrait source snapshot has an unexpected kind.");
  }
  assertNonEmptyString(snapshot.checkedAt, "Portrait source checkedAt");
  if (!Array.isArray(snapshot.providers) || !snapshot.providers.length) {
    throw new Error("Portrait source snapshot must declare providers.");
  }
  if (!Array.isArray(snapshot.records) || !snapshot.records.length) {
    throw new Error("Portrait source snapshot must contain records.");
  }
  assertUnique(snapshot.providers, "id", "Portrait providers");
  assertUnique(snapshot.records, "id", "Portrait source records");

  const providerIds = new Set(snapshot.providers.map((provider) => provider.id));
  for (const provider of snapshot.providers) {
    assertNonEmptyString(provider.id, "Portrait provider id");
    assertHttpsUrl(provider.url, `Portrait provider ${provider.id} URL`);
    assertHttpsUrl(provider.termsUrl, `Portrait provider ${provider.id} terms URL`);
  }

  for (const record of snapshot.records) {
    assertNonEmptyString(record.id, "Portrait source record id");
    if (!providerIds.has(record.providerId)) {
      throw new Error(`Portrait source ${record.id} references an unknown provider.`);
    }
    assertObject(record.candidateHint, `Portrait source ${record.id} candidate hint`);
    assertNonEmptyString(
      record.candidateHint.displayName,
      `Portrait source ${record.id} candidate display name`,
    );
    assertHttpsUrl(record.sourcePageUrl, `Portrait source ${record.id} page URL`);
    if (!Array.isArray(record.identitySourceUrls) || !record.identitySourceUrls.length) {
      throw new Error(`Portrait source ${record.id} must include identity evidence URLs.`);
    }
    record.identitySourceUrls.forEach((url, index) =>
      assertHttpsUrl(url, `Portrait source ${record.id} identity URL ${index}`),
    );
    if (!Array.isArray(record.renditions) || !record.renditions.length) {
      throw new Error(`Portrait source ${record.id} must include at least one rendition.`);
    }
    for (const rendition of record.renditions) {
      if (!new Set(["card", "profile"]).has(rendition.purpose)) {
        throw new Error(`Portrait source ${record.id} has an invalid rendition purpose.`);
      }
      assertHttpsUrl(rendition.url, `Portrait source ${record.id} rendition URL`);
      if (!Number.isInteger(rendition.width) || rendition.width < 1) {
        throw new Error(`Portrait source ${record.id} rendition width must be positive.`);
      }
      if (!Number.isInteger(rendition.height) || rendition.height < 1) {
        throw new Error(`Portrait source ${record.id} rendition height must be positive.`);
      }
      if (!SHA256.test(rendition.sha256)) {
        throw new Error(`Portrait source ${record.id} rendition must have a SHA-256 hash.`);
      }
    }
    assertObject(record.rightsDeclaration, `Portrait source ${record.id} rights declaration`);
    if (!new Set(["public_domain", "licensed"]).has(record.rightsDeclaration.status)) {
      throw new Error(`Portrait source ${record.id} does not have reusable declared rights.`);
    }
    assertNonEmptyString(record.rightsDeclaration.license, `Portrait source ${record.id} license`);
    assertHttpsUrl(
      record.rightsDeclaration.licenseUrl,
      `Portrait source ${record.id} license URL`,
    );
    assertNonEmptyString(
      record.rightsDeclaration.attribution,
      `Portrait source ${record.id} attribution`,
    );
  }
  return snapshot;
}

export function assertPortraitRegistry(registry, snapshot) {
  assertObject(registry, "Portrait candidate registry");
  if (registry.kind !== "portrait-candidate-registry") {
    throw new Error("Portrait candidate registry has an unexpected kind.");
  }
  if (!Array.isArray(registry.records)) {
    throw new Error("Portrait candidate registry records must be an array.");
  }
  assertUnique(registry.records, "candidateId", "Portrait candidate registry");
  const sourceIds = new Set(snapshot.records.map((record) => record.id));

  for (const record of registry.records) {
    assertNonEmptyString(record.candidateId, "Portrait registry candidate id");
    if (!sourceIds.has(record.sourceRecordId)) {
      throw new Error(`Portrait registry candidate ${record.candidateId} has no source record.`);
    }
    const identityStatus = record.identityVerification?.status;
    const rightsStatus = record.rightsVerification?.status;
    if (!new Set(["verified", "needs_review", "rejected"]).has(identityStatus)) {
      throw new Error(`Portrait registry candidate ${record.candidateId} has invalid identity status.`);
    }
    if (!new Set(["verified", "needs_review", "rejected"]).has(rightsStatus)) {
      throw new Error(`Portrait registry candidate ${record.candidateId} has invalid rights status.`);
    }
    if (!new Set(["publish", "hold", "reject"]).has(record.publicationDecision)) {
      throw new Error(`Portrait registry candidate ${record.candidateId} has invalid publication decision.`);
    }
    if (
      record.publicationDecision === "publish" &&
      (identityStatus !== "verified" || rightsStatus !== "verified")
    ) {
      throw new Error(
        `Portrait registry candidate ${record.candidateId} cannot publish without verified identity and rights.`,
      );
    }
  }
  return registry;
}

function fallbackRecord(candidate, checkedAt) {
  return {
    candidateId: candidate.id,
    displayName: candidate.name,
    initials: candidate.initials,
    publicationStatus: "fallback",
    display: {
      kind: "initials",
      imageUrl: null,
      thumbnailUrl: null,
      alt: `${candidate.name} portrait is not verified; initials shown`,
    },
    identityVerification: {
      status: "unverified",
      scope: "portrait_subject_only",
      label: "Portrait unverified",
      tooltip: "No identity- and rights-verified portrait has been published. Initials are shown instead.",
      method: null,
    },
    rights: {
      status: "not_researched",
      license: null,
      licenseUrl: null,
      attribution: null,
      attributionRequired: null,
      changes: null,
    },
    source: {
      sourceRecordId: null,
      providerId: null,
      sourcePageUrl: null,
      checkedAt,
    },
    capturedOn: null,
    review: {
      status: "unreviewed",
      reviewedAt: null,
      reviewer: null,
      notes: ["Portrait enrichment has not produced a publishable source for this candidate."],
    },
    provenance: {
      transformation: "default-initials-fallback",
      sourceRecordIds: [],
    },
  };
}

function materializeRegistryRecord(candidate, registryRecord, sourceRecord, checkedAt) {
  const mayPublish =
    registryRecord.publicationDecision === "publish" &&
    registryRecord.identityVerification.status === "verified" &&
    registryRecord.rightsVerification.status === "verified";
  const profile = sourceRecord.renditions.find((rendition) => rendition.purpose === "profile") ??
    sourceRecord.renditions[0];
  const card = sourceRecord.renditions.find((rendition) => rendition.purpose === "card") ?? profile;
  const rights = sourceRecord.rightsDeclaration;

  return {
    candidateId: candidate.id,
    displayName: candidate.name,
    initials: candidate.initials,
    publicationStatus: mayPublish ? "published" : "review_required",
    display: {
      kind: mayPublish ? "image" : "initials",
      imageUrl: mayPublish ? profile.url : null,
      thumbnailUrl: mayPublish ? card.url : null,
      alt: mayPublish
        ? `${candidate.name}, identity- and rights-verified portrait`
        : `${candidate.name} portrait awaits identity review; initials shown`,
    },
    identityVerification: {
      status: registryRecord.identityVerification.status,
      scope: "portrait_subject_only",
      label: mayPublish ? "Verified portrait" : "Portrait review needed",
      tooltip: mayPublish
        ? "The portrait subject and reuse rights were verified from cited sources. Ballot status is a separate evidence layer."
        : "A possible portrait was found, but it is hidden until the subject match and reuse rights both pass publication checks.",
      method: registryRecord.identityVerification.method,
    },
    rights: {
      status: registryRecord.rightsVerification.status,
      license: rights.license,
      licenseUrl: rights.licenseUrl,
      attribution: rights.attribution,
      attributionRequired: rights.attributionRequired,
      changes: rights.changes,
    },
    source: {
      sourceRecordId: sourceRecord.id,
      providerId: sourceRecord.providerId,
      sourcePageUrl: sourceRecord.sourcePageUrl,
      checkedAt,
    },
    capturedOn: sourceRecord.capturedOn,
    review: registryRecord.review,
    provenance: {
      transformation: mayPublish
        ? "verified-source-to-publishable-portrait"
        : "candidate-source-held-behind-initials-fallback",
      sourceRecordIds: [sourceRecord.id],
    },
  };
}

export function materializePortraitDataset({
  candidates,
  snapshot,
  registry,
  generatedAt = snapshot.checkedAt,
  codeRevision = "working-tree",
}) {
  assertPortraitSourceSnapshot(snapshot);
  assertPortraitRegistry(registry, snapshot);
  if (!Array.isArray(candidates) || !candidates.length) {
    throw new Error("Portrait materialization requires candidate records.");
  }

  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const sourceById = new Map(snapshot.records.map((record) => [record.id, record]));
  const registryByCandidate = new Map(
    registry.records.map((record) => [record.candidateId, record]),
  );
  for (const candidateId of registryByCandidate.keys()) {
    if (!candidateIds.has(candidateId)) {
      throw new Error(`Portrait registry references unknown candidate ${candidateId}.`);
    }
  }

  const portraits = candidates.map((candidate) => {
    const registryRecord = registryByCandidate.get(candidate.id);
    if (!registryRecord) return fallbackRecord(candidate, snapshot.checkedAt);
    return materializeRegistryRecord(
      candidate,
      registryRecord,
      sourceById.get(registryRecord.sourceRecordId),
      snapshot.checkedAt,
    );
  });
  const published = portraits.filter((portrait) => portrait.publicationStatus === "published").length;
  const reviewRequired = portraits.filter(
    (portrait) => portrait.publicationStatus === "review_required",
  ).length;

  return {
    schemaVersion: "1.0.0",
    datasetId: "ma-primary-2026-portraits",
    kind: "portrait-dataset",
    generatedAt,
    codeRevision,
    coverage: {
      candidateCount: portraits.length,
      publishedCount: published,
      reviewRequiredCount: reviewRequired,
      initialsFallbackCount: portraits.length - published,
    },
    portraits,
    providers: snapshot.providers,
    limitations: [
      "A verified portrait badge covers only the pictured subject and reuse rights; it does not verify ballot status, biography, party, or political claims.",
      "Portraits without both verified identity and verified reuse rights fail closed to initials.",
      "A portrait can be historically accurate but old; capture dates are shown when the provider supplies them.",
      "Remote image bytes are pinned by immutable repository revision where available and recorded with SHA-256 hashes in the source snapshot.",
    ],
  };
}

export function assertPortraitDataset(dataset, expectedCandidateIds = null) {
  assertObject(dataset, "Portrait dataset");
  if (dataset.kind !== "portrait-dataset" || !Array.isArray(dataset.portraits)) {
    throw new Error("Portrait dataset has an invalid shape.");
  }
  assertUnique(dataset.portraits, "candidateId", "Portrait dataset");
  if (expectedCandidateIds) {
    const actual = dataset.portraits.map((portrait) => portrait.candidateId).sort();
    const expected = [...expectedCandidateIds].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error("Portrait dataset candidate coverage does not match the seed.");
    }
  }

  for (const portrait of dataset.portraits) {
    assertNonEmptyString(portrait.candidateId, "Portrait candidate id");
    assertNonEmptyString(portrait.displayName, `Portrait ${portrait.candidateId} display name`);
    assertNonEmptyString(portrait.initials, `Portrait ${portrait.candidateId} initials`);
    assertNonEmptyString(portrait.source?.checkedAt, `Portrait ${portrait.candidateId} checkedAt`);
    const published = portrait.publicationStatus === "published";
    if (published) {
      if (
        portrait.display?.kind !== "image" ||
        portrait.identityVerification?.status !== "verified" ||
        portrait.rights?.status !== "verified"
      ) {
        throw new Error(`Published portrait ${portrait.candidateId} failed closed-state checks.`);
      }
      assertHttpsUrl(portrait.display.imageUrl, `Portrait ${portrait.candidateId} image URL`);
      assertHttpsUrl(portrait.display.thumbnailUrl, `Portrait ${portrait.candidateId} thumbnail URL`);
      assertNonEmptyString(portrait.rights.license, `Portrait ${portrait.candidateId} license`);
      assertNonEmptyString(
        portrait.rights.attribution,
        `Portrait ${portrait.candidateId} attribution`,
      );
    } else if (
      portrait.display?.kind !== "initials" ||
      portrait.display?.imageUrl !== null ||
      portrait.display?.thumbnailUrl !== null
    ) {
      throw new Error(`Non-published portrait ${portrait.candidateId} exposed image bytes.`);
    }
  }

  const publishedCount = dataset.portraits.filter(
    (portrait) => portrait.publicationStatus === "published",
  ).length;
  if (
    dataset.coverage?.candidateCount !== dataset.portraits.length ||
    dataset.coverage?.publishedCount !== publishedCount ||
    dataset.coverage?.initialsFallbackCount !== dataset.portraits.length - publishedCount
  ) {
    throw new Error("Portrait dataset coverage counters are inconsistent.");
  }
  return dataset;
}
