# Civics architecture

## Purpose

Civics is a static intelligence graph: a periodically generated civic knowledge base whose source, evidence, transformations, and published views are all versioned in Git.

## Layers

1. **Civic identity** — people, candidacies, offices, elections, ballots, races, parties, and jurisdictions.
2. **Evidence** — statements, bills, sponsorships, votes, executive actions, finance records, endorsements, and primary sources.
3. **Claims** — explicitly sourced factual, interpretive, comparative, or predictive assertions.
4. **Materialized views** — candidate, race, ballot, issue, and map-specific JSON optimized for a static client.
5. **Interface** — an accessible React application with local-only decision notes.

External providers are adapters. Their identifiers and payload shapes cannot become the canonical domain model.

## Update boundary

```text
cheap conditional request
  → canonicalize
  → hash
  → unchanged: update checkedAt only
  → changed: normalize and calculate impact set
  → validate evidence and schema
  → materialize affected views
  → reviewable Git change
```

The system distinguishes `checkedAt`, `contentChangedAt`, `analysisGeneratedAt`, and `reviewedAt`. A successful check never falsely implies that source content or analysis changed.

## Provider policy

- Automate only APIs and datasets whose terms permit the intended access and caching.
- Never scrape Massachusetts Secretary election pages; use them only as human-reviewed citations unless explicit permission or an official export becomes available.
- Keep raw provider snapshots separate from normalized public entities.
- Never serialize an API key, request authorization header, private address, or voter preference.
- Treat model-generated content as a claim requiring evidence, method, limitations, and review state.

## Static query model

GraphQL is unnecessary at runtime. Build-time adapters normalize provider responses into stable graph entities and generate small candidate/race/ballot views. The client downloads only public static assets. A server-backed query layer can be introduced later without changing the core contracts.
