# Repository Intelligence publication

Civics keeps one Pages publisher at `https://civics.egohygiene.io/`. The existing
workflow builds the civic portal, retains its data, finance, portrait and test
gates, then composes Relay's shared output only into `dist/intelligence/`.
`public/CNAME` remains `civics.egohygiene.io`. No top-level aliases are added.
The portal footer links to the repository view.

The same reviewed full Relay commit supplies the typed review-feed action,
Repository Intelligence builder and composition helpers. All inputs bind
`egohygiene/civics`, the exact checked-out source commit and one explicit UTC
evaluation clock. The complete Git history supports the builder's existing
history requirement; it does not establish collected domain evidence.

Relay captures the portal's file and route inventory before composition, then
verifies the shared build manifest, every enabled Intelligence route and all
unrelated portal bytes before the existing Pages upload. This includes CNAME,
data, portraits and portal assets. The helper's default seven-day represented
source-age limit applies to composition verification. A stale source fails that
gate; a fresh build never promotes old reports into fresh observations.

## Explicit typed review selection

[The review plan](../.github/intelligence-review-plan.json) is an immutable-source
selection, with separate `audits` and `sanity` arrays. Both are empty initially.
No reviewer or auditor runs in this workflow. No civic provider is queried by
the new feed, and no report is inferred from the civic data validators, tests,
build outcome or repository prose.

The pinned shared action authenticates the public repository through Hygiene's
reviewed `49639c1845cdfd08fbd5a768261a8b3cf515f80f` admission profile, then uses
Observatory's pinned Audits/Sanity normalization and Aether's report contracts.
It produces repository and fleet models even for empty selections; empty
evidence stays unavailable, with no fabricated finding, clean bill of health,
pass or human ratification. The builder receives only the matching repository
Audits and Sanity models. These describe repository review evidence, not ballot
facts or candidate quality.

To select a real public report later, add an explicit `{ "path": "...",
"sha256": "..." }` descriptor to its corresponding plan array. The path is
relative to the Civics source root and the digest binds the exact report bytes
in the represented Git commit. Selection requires a compatible owner report
whose repository, represented revision, public scope and original observation
times pass the shared contract. A historical report keeps its original
represented revision and clock; a different revision remains explicitly
different in the current source-bound model. The run's evaluation clock does
not refresh that report. Never add a placeholder report to make a page look
complete. Reports and plan changes require ordinary source review.

Native ADR, Roadmap, Dependencies and Journey collection remain disabled.
`ROADMAP.md` contains a legacy execution snapshot; its presence does not prove
admission to the current canonical source contract. Native collection needs a
separate reviewed opt-in after actual source admission. Other missing source
models retain the builder's explicit unavailable states.

## Review evidence and acceptance

The four normalized review models and separate feed receipt remain under
`.cache/intelligence-review-feed/`. The baseline and composition verification
remain under `.cache/intelligence-composition/`. The workflow retains these as
an ordinary artifact identified by source SHA, workflow run and attempt, with
30-day retention. Only `dist/` enters the existing Pages artifact. Private
builder diagnostics under `.cache/repository-intelligence/` are not uploaded.

The feed receipt and composition verification are separate from a deployment
receipt. This change does not establish a prior rollback digest, successful
artifact upload, deployment, live route behavior or accepted publication. The
existing `deploy` job, environment and single Pages artifact remain the sole
publication path; no second publisher is introduced.

This implementation received source review only. Native checks, tests, helper
execution, builds, hosted CI and browser/publication qualification were deferred
at the maintainer's request. Review and perform the repository's normal checks
and publication acceptance before treating the new routes as verified live.
