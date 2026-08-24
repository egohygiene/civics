# Civic data pipeline

This directory contains the dependency-free Node.js pipeline that creates
versioned Massachusetts source snapshots. The OCPF path already materializes a
validated static finance view; the ballot roster and other prototype sections
continue to use the reviewed `src/data/seed.js` dataset directly.

## Sources

- Plural Open / Open States API v3: current Massachusetts state legislators.
- Federal Election Commission OpenFEC API: Massachusetts federal candidates for
  a selected election cycle.
- Massachusetts Office of Campaign and Political Finance Public API: sanitized
  filer-specific year-to-date receipts, disbursements, and cash-on-hand totals
  for the reviewed state/local candidate registry. OCPF requires no API key.

LegiScan is intentionally not required. It can be added as an optional
legislative validation adapter after the account is approved.

## Run locally

Use Node.js 24 or newer and provide secrets through environment variables. Do
not put keys in command arguments or tracked files.

```bash
export OPENSTATES_API_KEY="..."
export DATA_GOV_API_KEY="..."

node scripts/refresh-civic-data.mjs \
  --mode bootstrap \
  --providers all \
  --election-cycle 2026

node scripts/validate-civic-data.mjs \
  --providers all \
  --election-cycle 2026

node scripts/refresh-ocpf-finance.mjs \
  --max-requests 30

node scripts/validate-ocpf-finance.mjs
```

The refresh has conservative hard limits of eight Open States requests and five
FEC requests. A provider response that requires more requests fails closed
before the pipeline retrieves the remaining pages. Temporary network retries
also consume the same budget.

## Freshness semantics

Every snapshot distinguishes between:

- `checkedAt`: when the source was last queried successfully;
- `contentChangedAt`: when the canonical record hash last changed; and
- `sourceUpdatedAt`: the newest upstream update timestamp in the result set.

The manifest stores a hash of provider content hashes. API credentials and
credential-bearing request URLs are never written to snapshots or logs.

The OCPF adapter also excludes provider contact records, street addresses,
telephone numbers, email addresses, ZIP codes, treasurer/chairperson details,
and unlicensed photo URLs before writing or hashing the snapshot. Candidate
identity mappings live in `data/sources/ocpf-candidate-registry.json`; fuzzy
matching is prohibited and provider identity drift fails closed.

The materialized OCPF view is written to
`public/data/finance/ocpf-ma-2026.json`. Its totals use only the filer-specific
`ytdReport` object from `filer/payload/{cpfId}`. Race-wide activity arrays are
not mixed into those totals. Debt, receipt composition, outside spending, and
monthly series remain explicit `not_available` or `not_researched` fields until
dedicated adapters are reviewed.

## Automation

`.github/workflows/refresh-civic-data.yml` runs monthly and can also be started
manually. It validates the snapshots, creates a uniquely named automation
branch, and opens a pull request whenever source freshness or canonical content
changes.

The workflow requires these repository secrets:

- `OPENSTATES_API_KEY`
- `DATA_GOV_API_KEY`

OCPF does not require a secret. The scheduled workflow runs its bounded adapter
after Open States and FEC, then opens the same kind of review pull request for
any changed raw snapshot or materialized finance view.

It also requires workflow permissions for `contents: write` and
`pull-requests: write`, plus the repository setting that permits GitHub Actions
to create pull requests.
