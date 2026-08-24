# Massachusetts finance data

The finance layer gives voters useful context without turning money into a
candidate-quality score. It answers bounded questions—how much an official
record reports, for which period, from which provider, and with which gaps—while
keeping interpretation separate.

## Current coverage

The first release maps 18 Massachusetts state and local candidates to official
OCPF CPF identifiers. It covers the statewide executive races and the
Wilmington proof ballot's Governor's Council, state legislative, district
attorney, and register of probate candidates. Federal candidates are not absent
or zero; they are routed to FEC data. The first UI snapshot includes exact FEC
cycle summaries for the three U.S. Senate candidates, while U.S. House finance
remains an explicit research gap until the federal adapter is materialized.

The canonical identity registry is
`data/sources/ocpf-candidate-registry.json`. Each mapping pins the expected
provider name, office, and locality. The refresh stops if any of these checks
drift. Automatic fuzzy matching is never used.

The broader reviewed coverage ledger at
`data/reviewed/ocpf-candidate-coverage.json` accounts for all 28 seed
candidates, including federal candidates explicitly routed to FEC. Tests require
the 18 current OCPF CPF IDs in that ledger and the payload-validation registry
to remain identical.

## Generated files

- `data/raw/ocpf/ma-candidate-finance-2026.json` is the sanitized provider
  snapshot. It contains no contact/address/treasurer data or provider photo
  URLs, and every record has a canonical SHA-256 hash.
- `public/data/finance/ocpf-ma-2026.json` is the static app view conforming to
  `schemas/finance.schema.json`.

Run and verify the exact pipeline with:

```bash
node scripts/refresh-ocpf-finance.mjs \
  --max-requests 30

node scripts/validate-ocpf-finance.mjs
```

Use `--now` and `--code-revision` to make test or archival output reproducible.
The adapter makes one bounded request per registry entry, waits briefly between
requests, uses no credential, and writes snapshot/view files atomically only
after all candidates pass identity and shape checks.

## Metric semantics

The initial totals are copied deterministically from the filer-specific OCPF
`ytdReport`:

| Civics field | OCPF field | Initial state |
| --- | --- | --- |
| `totals.receipts` | `receiptsYtdNumeric` | Known when numeric |
| `totals.disbursements` | `expendituresYtdNumeric` | Known when numeric |
| `totals.cashOnHand` | `currentCashOnHandNumeric` | Known when numeric |
| `totals.debtsOwed` | Not exposed by selected payload | `not_available` |
| `receiptComposition` | Requires receipt-item aggregation | `not_researched` |
| `outsideSpending` | Requires miscellaneous-report joins | `not_researched` |
| `timeSeries` | Requires report/month aggregation | `not_researched` |

`period.startDate`, `period.endDate`, and `period.asOf` come from the same YTD
report. The comparison key is identical only for matching provider periods.
Year-to-date totals are not lifetime fundraising or complete election-cycle
totals, and different OCPF account types may have different reporting rules.

## Trust and review

- Source values are never ranked as good or bad.
- Missing values never become zero.
- The API retrieval time and source-change time are distinct.
- Provider, record ID, URL, content hash, and deterministic generator revision
  remain attached to every candidate view.
- Current identity matches have passed automated exact checks but remain
  `needs_review` until a maintainer reviews the registry and generated diff.
- AI prose may later summarize sourced records, but only through disclosed claim
  references in `synthesisRefs`; it cannot overwrite provider metrics.

Source documentation: [OCPF Public API developer guide](https://api.ocpf.us/developers/guide).
