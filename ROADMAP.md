---
schema: aether.architecture-document/v1
id: civics-roadmap
title: Civics Roadmap
kind: architecture-document
version: 0.1.0
status: provisional
owners:
  - egohygiene
created: 2026-08-24
updated: 2026-08-24
governed_by:
  - architecture-roadmap
depends_on:
  - civics-architecture
related: []
supersedes: []
---

# Civics Roadmap

<!-- BEGIN ROADMAP EXECUTION SNAPSHOT -->
<!-- roadmap-manifest
schema: hygiene.roadmap/v1alpha1
repository: egohygiene/civics
visibility: public
publication: composed
route: /roadmap/
updated: 2026-08-24
-->
## 2026-08-24 execution snapshot

> This evidence-reconciled snapshot is the issue-generation and visual-roadmap handoff. The longer-horizon strategy below remains canonical context; generated HTML, JSON, progress, issue plans, and commit lists are projections.

**Lifecycle:** experimental v0.1 prototype  
**Current gate:** Create the missing roadmap and issue backlog, then certify the 2026-09-01 dataset and evidence rules.  
**North-star outcome:** A trustworthy, local-first civic information portal with traceable claims, privacy-aware participation, and portable jurisdiction adapters.

### Visual roadmap publication

**Mode:** `composed`  
**Route:** `/roadmap/`  
**Current publication evidence:** Live GitHub Pages site at https://civics.egohygiene.io/ with green quality and Pages workflows.

Compose dist/roadmap/ into the repository's existing final site artifact at /roadmap/. The current Pages workflow remains the only deployer.

### Quest line

<!-- roadmap-step
id: CIV-Q01
status: complete
depends_on: []
issues: []
-->
#### CIV-Q01 — Launch the civic portal prototype

**State:** `complete`  
**Depends on:** None

**Outcome:** A public React/Vite portal ships candidate profiles, finance data, ballot context, and local notes.

**Exit criteria:**

- [x] The site is publicly accessible at the HTTPS custom domain.
- [x] Quality and Pages workflows are green.

**Current evidence:**

- Portal commit d293b75ece4cbf23a870415f3bf12fd1a6412db6 landed on 2026-08-24.
- Ballot Atlas commit a72b34cfab9fdac4a90a6ce8e0872eea1a9cf91 landed later that day.

<!-- roadmap-step
id: CIV-Q02
status: active
depends_on: [CIV-Q01]
issues: []
-->
#### CIV-Q02 — Create roadmap and issue governance

**State:** `active`  
**Depends on:** `CIV-Q01`

**Outcome:** The experimental product has an authoritative roadmap, owned issues, dependencies, and evidence criteria.

**Exit criteria:**

- [ ] ROADMAP.md or the canonical equivalent is present.
- [ ] Each active milestone has an issue and acceptance-level outcome.

**Current evidence:**

- No ROADMAP or open issue backlog was observed despite substantial implementation.

<!-- roadmap-step
id: CIV-Q03
status: ready
depends_on: [CIV-Q02]
issues: []
-->
#### CIV-Q03 — Certify the September dataset

**State:** `ready`  
**Depends on:** `CIV-Q02`

**Outcome:** The 2026-09-01 snapshot has complete provenance, freshness, and review evidence.

**Exit criteria:**

- [ ] Every published claim and candidate datum links to a dated source.
- [ ] Automated validation covers schema, freshness, duplicates, and broken evidence links.

**Current evidence:**

- PR #1 finance merged at af3f6686dde59cbd0c3b9e3357392b7241e296cf on 2026-08-24.
- PR #2 profiles merged at 28b3dc67840c23677d366ea4fad18f099467258a the same day.

<!-- roadmap-step
id: CIV-Q04
status: planned
depends_on: [CIV-Q03]
issues: []
-->
#### CIV-Q04 — Harden evidence, privacy, and accessibility

**State:** `planned`  
**Depends on:** `CIV-Q03`

**Outcome:** Users can inspect claim provenance and participate without unsafe data exposure or access barriers.

**Exit criteria:**

- [ ] Claim-level evidence, portrait rights, privacy controls, and retention behavior are tested.
- [ ] The production site passes the declared accessibility baseline.

**Current evidence:**

- Portrait rights and monthly review ingestion exist, but no formal roadmap or certification gate was observed.

<!-- roadmap-step
id: CIV-Q05
status: planned
depends_on: [CIV-Q03, CIV-Q04]
issues: []
-->
#### CIV-Q05 — Extract jurisdiction adapters and publish v0.1

**State:** `planned`  
**Depends on:** `CIV-Q03`, `CIV-Q04`

**Outcome:** The prototype becomes a durable v0.1 snapshot that can support another jurisdiction without copying the app.

**Exit criteria:**

- [ ] A second jurisdiction fixture uses a documented adapter contract.
- [ ] A tagged snapshot includes data provenance, schema versions, and deployment evidence.

**Current evidence:**

- No release was observed.
- Homepage metadata uses HTTP while README uses the live HTTPS domain.

### Roadmap-to-issue handoff

- A step is complete only when its exit criteria and required evidence are satisfied; commit count never determines progress.
- Ready or planned steps without an issue are candidates for the private, duplicate-aware roadmap.issue-plan.json dry run.
- Issue creation or reconciliation requires human approval or an explicitly authorized Pace operation and returns issue references through a reviewable roadmap pull request.
- Pull requests and commits should include Roadmap-Step: <ID>; historical evidence may be linked through existing issue and pull-request relationships.
- Public rendering uses only allowlisted build-time evidence and never places a GitHub token or private issue plan in the browser artifact.

<!-- END ROADMAP EXECUTION SNAPSHOT -->

## Strategic context

Civics is a public, evidence-backed static civic intelligence graph. It must keep source evidence, normalization, claims, materialized views, and the client independently reviewable while avoiding provider lock-in and prohibited collection behavior.

The first roadmap horizon is stabilization: make the already-live portal reproducible, govern update automation, establish explicit issue intake, and publish an immutable checkpoint before expanding jurisdiction or analysis scope.

## Operating constraints

- External providers remain adapters; their identifiers and payload shapes are not the canonical domain model.
- Sources, transformations, claims, review state, and generated views preserve provenance.
- Automated access must comply with provider terms and the repository's documented non-scraping boundaries.
- A successful source check does not falsely imply that content, analysis, or review changed.
- Local decision notes remain private and never enter the published static graph.
- The existing Pages workflow remains the single deployment owner when /roadmap/ is composed.

## Deferred direction

Additional jurisdictions, predictive analysis, and richer server-backed queries remain deferred until the Massachusetts foundation, evidence model, accessibility, refresh review, and release path are proven.
