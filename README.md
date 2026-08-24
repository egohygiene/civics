# civics

> See the choice before the ballot.

Civics is an experimental, open-source civic intelligence and ballot decision-support portal by [Ego Hygiene](https://egohygiene.io). It helps voters explore the candidates and offices relevant to an election, compare evidence across party ballots, and keep private ballot notes without creating an account.

The first public checkpoint focuses on the September 1, 2026 Massachusetts State Primary.

## What exists now

- Responsive React and Vite portal with an Ego Hygiene visual identity.
- Massachusetts county map derived from U.S. Census cartographic geometry.
- Side-by-side Democratic and Republican statewide choices plus a 13-race Wilmington proof of concept.
- Evidence-coverage profiles that preserve unknown and incomplete states.
- Local-only candidate bookmarks for private ballot preparation.
- Versioned civic knowledge-graph schemas with provenance and review states.
- Secret-backed Open States and FEC ingestion with content hashing.
- Static publication through GitHub Pages at [civics.egohygiene.io](https://civics.egohygiene.io).

## Architecture

```text
Permitted public APIs + human-reviewed official election sources
                              ↓
          bounded adapters and content fingerprints
                              ↓
        evidence records + claims + provenance graph
                              ↓
          candidate, race, ballot, and map views
                              ↓
             React/Vite static GitHub Pages site
```

Git holds versioned public knowledge, GitHub Actions provides periodic build-time computation, and GitHub Pages serves the same static materialized views to every visitor. No production database or runtime AI call is required.

See [the data model](docs/data-model.md) for the knowledge graph contracts.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Validate the exact production tree with:

```bash
npm run check
npm test
```

## Data refresh

Repository Actions secrets:

```text
OPENSTATES_API_KEY
DATA_GOV_API_KEY
LEGISCAN_API_KEY
```

Open States and FEC are used by the first deterministic ingestion workflow. LegiScan is reserved as a supplementary source after its key is approved. Secrets are available only inside GitHub Actions and are never written into output.

Massachusetts Secretary of the Commonwealth pages are human-reviewed sources only. Their published terms prohibit automated scraping or crawling, so Civics does not automate those pages. Election facts from them are seeded with direct citations and review timestamps.

## Evidence promise

Civics separates:

1. Official civic identity and ballot facts.
2. Observable statements, votes, bills, filings, endorsements, and actions.
3. Clearly labeled synthesis derived from cited evidence.

Missing evidence stays unknown. Research coverage is not a candidate score. Civics does not endorse candidates or tell anyone how to vote.

The roster is a source snapshot checked August 24, 2026, not a promise that the ballot is final or certified. Official corrections and withdrawals remain possible.

## Experimental status

Information may be incomplete, outdated, or incorrectly interpreted. Verify consequential claims using the linked primary sources before voting.

## License

[MIT](LICENSE). Third-party data retains its original attribution and licensing requirements.
