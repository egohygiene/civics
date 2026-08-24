# Agent guide for Civics

## Mission

Civics helps voters inspect ballot choices through sourced evidence without outsourcing judgment to a hidden recommendation system.

## Non-negotiable evidence rules

- Prefer election authorities, government APIs, legislative records, campaign-finance regulators, candidate-owned statements, and other primary sources.
- Never infer a missing political position, biography fact, identity, or ballot status.
- Keep candidate statements, government actions, third-party characterizations, and generated synthesis distinct.
- Every substantive claim must reference evidence records and source identifiers.
- Represent unknown, incomplete, conflicting, outdated, and unreviewed states explicitly.
- Never convert research completeness, party, ideology, or controversy into a candidate quality score.
- Do not create a hidden recommendation or compatibility algorithm.
- Never collect, transmit, or commit voter addresses or political preferences.

## Source access

Massachusetts Secretary of the Commonwealth terms prohibit scraping and crawling. Do not automate those pages. Use manually reviewed citations or obtain an official permitted export. Automated workflows are limited to documented APIs and datasets whose terms allow this project’s access and caching.

## Repository contracts

- `src/` owns the static portal interface.
- `src/data/seed.js` is the initial human-reviewed interface seed.
- `schemas/` owns canonical public graph contracts.
- `data/raw/` contains sanitized provider snapshots and fingerprints, never secrets.
- `scripts/` owns bounded provider adapters, validation, and materialization.
- `dist/` is generated and must not be committed.

## Code style

- Use UTF-8, LF endings, final newlines, two-space indentation, and double quotes in JavaScript where practical.
- Prefer explicit names, small pure functions, native platform APIs, and deterministic output.
- Use long-form command arguments where portable and unambiguous.
- Keep touch targets near 44 CSS pixels, preserve visible focus, support keyboard operation, honor reduced motion, and keep a non-map navigation path.

## Validation

Run from the repository root:

```bash
npm run check
npm test
git diff --check
```

Do not claim deployment or data quality succeeded unless the exact published tree passed its checks.
