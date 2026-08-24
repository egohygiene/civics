# Visualization contract

Civics treats a chart as a deterministic, inspectable view of reviewed records—not as decoration and not as an authority signal. Canonical facts remain separate from the transformations that arrange them for human perception.

```text
reviewed source records
          ↓
normalized domain records
          ↓
named deterministic transformation
          ↓
geometry-free view model
          ↓
chart + exact-value table + plain-language note
```

The browser renders precomputed or locally deterministic view models. It does not call a model, campaign-finance API, or political profiling service at runtime.

## Transformation metadata

Every published visualization should be reproducible from:

- a stable transformation ID and version;
- the input record and source IDs;
- explicit parameters, filters, period, denominator, and units;
- a comparability state and its exclusions;
- the deterministic generator revision;
- limitations and review state.

The transformation must not overwrite its inputs. A new chart or framing can therefore be added without rewriting the underlying candidate, election, evidence, or finance record.

## Initial modalities

| Lens | Transformation | What it can show | Required guardrail |
| --- | --- | --- | --- |
| Career timeline | Date-domain layout | Sourced roles and public milestones over time | Unknown dates remain unknown; overlapping roles are not collapsed |
| Election history | Share of reported total | Candidate vote share and exact vote count within one contest | Office, stage, date, denominator, and source remain visible |
| Race history context | `closest-historical-context` v1 | One past contest per candidate on a shared 0–100% candidate-vote-pool axis | Publish the office/stage/recency selection rule and every non-comparability warning; never call it polling |
| Finance snapshot | Exact monetary metrics | Receipts, spending, cash, debt, and source composition | Common periods for shared axes; missing money is never zero |
| Evidence inventory | Categorical state matrix | Which evidence layers are verified, available, queued, or not applicable | Coverage is not candidate quality and is never summed into a score |
| Portrait identity | Reviewed publishability state | A rights-cleared portrait or an initials fallback | A photo check verifies the image mapping only; it is not an endorsement |

## Rendering rules

1. Prefer direct labels and exact values over legends that require memory.
2. Use a common axis only when units, period, population, and denominator match.
3. Preserve the regulator or election authority's terminology alongside any plain-language explanation.
4. Pair color with text, position, shape, or pattern.
5. Provide an equivalent semantic table for quantitative SVG views.
6. Explain the transformation near the view, including why a record was excluded.
7. Keep zero, unknown, unavailable, unresearched, and not applicable distinct.
8. Never sort candidates by a composite Civics score, inferred ideology, compatibility, viability, or worthiness.

## Extensibility

Future adapters can add cumulative series, rates of change, distributions, geographic aggregation, topic counts, voting networks, or similarity exploration by producing the same kind of geometry-free view model. More advanced statistical or machine-learning transformations must publish their inputs, version, parameters, assumptions, uncertainty, and validation. They remain optional lenses—not replacements for the source record and never a hidden voting recommendation.
