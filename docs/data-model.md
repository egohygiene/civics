# Civics data model

Civics publishes a versioned static knowledge graph. Source adapters collect public records, deterministic code normalizes them, optional AI produces evidence-backed claims, and the build emits small JSON materialized views for the React application. Git stores releases and GitHub Pages serves them; no runtime database is required.

## Version-one resources

| Resource | Purpose | Schema |
| --- | --- | --- |
| Candidate | One consistent person profile plus candidacy references | `schemas/candidate.schema.json` |
| Election | Date, jurisdiction, election type, and contained races/ballots | `schemas/election.schema.json` |
| Ballot | A party/geography-specific ballot style | `schemas/ballot.schema.json` |
| Race | An office contest and its candidate entries | `schemas/race.schema.json` |
| Source | Source authority, terms, retrieval health, and change fingerprint | `schemas/source.schema.json` |
| Evidence | A locatable observation from one source | `schemas/evidence.schema.json` |
| Claim | A factual or interpretive statement tied to evidence | `schemas/claim.schema.json` |
| Finance view | Comparable provider metrics with explicit gaps, periods, and provenance | `schemas/finance.schema.json` |
| Dataset manifest | Release inventory, hashes, coverage, limitations, and validation | `schemas/dataset-manifest.schema.json` |

All schemas use JSON Schema Draft 2020-12. `schemas/common.schema.json` contains shared identifiers and the required provenance, freshness, review, and field-state envelopes.

## Graph shape

Resources are normalized and connected with stable IDs rather than nested copies:

```text
Election ──contains──> Ballot ──lists──> Race ──includes──> Candidate
   │                                │                     │
   └──governs date/jurisdiction     └──seeks──> Office    └──subject of──> Claim
                                                                  │
Claim ──supported/contradicted/contextualized by──> Evidence ──from──> Source
```

Candidate analysis fields contain claim IDs only. Generated prose, ideological characterizations, likely policy directions, tradeoffs, and contradiction detection therefore cannot bypass the claim/evidence/review model.

Suggested static layout:

```text
public/data/
  manifest.json
  candidates/<candidate-id>.json
  elections/<election-id>.json
  ballots/<ballot-id>.json
  races/<race-id>.json
  sources/<source-id>.json
  evidence/<evidence-id>.json
  claims/<claim-id>.json
  indexes/by-election/<election-id>.json
  indexes/by-jurisdiction/<jurisdiction-id>.json
  geography/*.geojson
```

Indexes are disposable materialized views. Canonical resources remain normalized and can be regenerated into different views later.

## Required data states

Unknown data must be represented, not omitted. Fields whose availability can vary use the `dataField` envelope:

```json
{
  "status": "not_researched",
  "value": null,
  "evidenceRefs": [],
  "note": "Campaign-finance adapter has not run for this candidate."
}
```

Allowed states are:

- `known`: non-null value and at least one evidence reference
- `conflicting`: non-null value and at least two evidence references
- `unknown`: checked, but the value could not be established
- `not_available`: the upstream source does not provide it
- `not_researched`: the relevant adapter or research pass has not run
- `not_applicable`: the field does not apply to this resource

Known empty arrays and strings are different from unavailable values. Pipelines must never invent a plausible value merely to fill a candidate card.

Every resource also requires:

- `freshness`: separates when sources were checked, when source content changed, and when normalized data changed
- `review`: explicitly marks `unreviewed`, automated checks, human review, review needs, or rejection
- `provenance`: records source/evidence IDs, transformation method, generator, timestamp, and code revision

The interface should expose these states rather than collapsing them into a generic “last updated” label.

## Evidence and claims

Evidence is a faithful, locatable observation: for example, a roll-call vote, bill sponsorship, campaign statement, office record, or finance filing. An evidence record identifies its source, original record ID or URL, locator, content hash, relevant subjects/topics, and dates.

A claim is what Civics says about that evidence. These invariants are mandatory:

1. Every claim references at least one evidence record.
2. A `contradiction` claim references at least two evidence records.
3. Interpretive and predictive claims include their method, assumptions, alternative explanations, and limitations.
4. Predictive claims include at least one assumption and one limitation.
5. Factual claims do not include an interpretation block.
6. `provenance.evidenceIds` must match the IDs in `evidenceReferences`; this cross-resource invariant is enforced by the graph validator.
7. Automated checks and human review are distinct states. AI generation never implies human verification.

Claims identify tensions rather than motives. For example, Civics may say that recorded actions conflict with repeated statements and show both sets of evidence; it should not infer that a candidate lied or assign a private psychological profile.

## Candidate consistency

Every person uses the same candidate schema regardless of party, office, geography, incumbency, or source richness. The required top-level shape includes identity, images, affiliations, geography, occupation, offices, candidacies, links, external identifiers, analysis references, provenance, freshness, and review. Missing enrichment remains explicit through field status and empty claim-reference arrays.

The schema separates:

- Civic identity: names, party/ballot designation, geography, office, and candidacy
- Political evidence: statements, votes, bills, actions, finance records, and endorsements
- Interpretive enrichment: priorities, record summaries, ideology, likely direction, tradeoffs, uncertainty, and possible contradictions

This separation lets the project improve analysis without rewriting source facts.

## Incremental publication

Each source record preserves HTTP validators and upstream hashes when available: `etag`, `lastModified`, `contentHash`, and `upstreamChangeHash`. A scheduled build should:

1. Probe sources using conditional requests or upstream change hashes.
2. Update `lastCheckedAt` even when content is unchanged.
3. Re-ingest only changed records and their dependent evidence/claims.
4. Validate schemas and all ID references.
5. Generate materialized views and the aggregate manifest.
6. Publish only when validation has no schema errors or broken references.

The manifest records changed and skipped source IDs, per-file SHA-256 hashes, coverage gaps, warnings, source attributions, and explicit experimental limitations. This makes each static release auditable and reproducible.

## Validation beyond JSON Schema

JSON Schema validates individual documents. The build must additionally verify graph-wide rules:

- IDs are globally unique and every reference resolves.
- Claim evidence references resolve and match claim provenance.
- Candidate analysis IDs resolve to claims whose subjects include that candidate.
- Ballot race IDs belong to the same election.
- Race candidate entries resolve to candidates with matching candidacies.
- Source license and attribution requirements flow into the dataset manifest.
- Manifest counts and file hashes match emitted files.
- Public output contains no API credentials, private voter preferences, or raw secrets.

User priorities and ballot notes remain local to the browser and are not part of this public graph.

## Candidate finance views

Finance is a materialized view rather than a candidate score. Each candidate
record identifies its provider entity, reporting period, totals, receipt
composition, outside spending, time series, comparability basis, source record,
freshness, review state, and optional synthesis claim references. The required
totals are receipts, disbursements, cash on hand, and debts owed. Every metric
uses an availability envelope so unknown or unresearched data cannot be rendered
as zero.

The initial Massachusetts OCPF adapter uses the official no-authentication
[`filer/payload/{cpfId}` API](https://api.ocpf.us/developers/guide). It stores
only a sanitized identity subset and the filer-specific `ytdReport`; provider
contact details and the race-wide `raceActivityReports` array are discarded.
The latter is deliberately excluded because race aggregates are a different
comparison unit and must not silently replace filer totals.

The first published view therefore marks every candidate `partial` even when
receipts, disbursements, and cash are known. Debt is `not_available` from this
payload, while receipt composition, outside spending, and monthly series are
`not_researched`. Comparisons are `limited` and include a key derived from the
provider, period start, and period end. Interfaces should compare values only
when those keys match and should still disclose account-type/reporting-rule
differences.

Generated prose is never placed inside a monetary field. Any later AI summary
must be represented by a claim ID in `synthesisRefs`, linked to evidence and
clearly labeled with its generator and review status.
