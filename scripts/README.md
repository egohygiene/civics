# Civic data pipeline

This directory contains the dependency-free Node.js pipeline that creates the
versioned Massachusetts source snapshots consumed by Civics.

## Sources

- Plural Open / Open States API v3: current Massachusetts state legislators.
- Federal Election Commission OpenFEC API: Massachusetts federal candidates for
  a selected election cycle.

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

## Automation

`.github/workflows/refresh-civic-data.yml` runs monthly and can also be started
manually. It validates the snapshots, creates a uniquely named automation
branch, and opens a pull request only when tracked data changed.

The workflow requires these repository secrets:

- `OPENSTATES_API_KEY`
- `DATA_GOV_API_KEY`

It also requires workflow permissions for `contents: write` and
`pull-requests: write`, plus the repository setting that permits GitHub Actions
to create pull requests.
