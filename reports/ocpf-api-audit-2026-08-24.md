# OCPF API identity and finance audit

Retrieved: `2026-08-24T14:58:33Z`

Source scope: official Massachusetts Office of Campaign and Political Finance endpoints only.

- [OCPF public API](https://api.ocpf.us/)
- [Getting started guide](https://api.ocpf.us/developers/guide)
- [OpenAPI reference](https://api.ocpf.us/swagger)

## Result

The OCPF identity path is viable for this prototype. All 18 seed candidates seeking Massachusetts state or county office have an exact current CPF match after checking name, office sought, active status, and city or incumbency context. The 10 candidates seeking U.S. Senate or U.S. House should use FEC data for their current campaigns.

The machine-readable coverage artifact is [`data/reviewed/ocpf-candidate-coverage.json`](../data/reviewed/ocpf-candidate-coverage.json). It covers all 28 seed candidates, carries the exact source URLs and retrieval time, forbids fuzzy matching and automatic publication, and distinguishes current OCPF identities from federal and historical-only identities.

Two federal candidates have OCPF records that must not be blended into current federal finance:

- Jamie Belsito: CPF `17857`, inactive former `House, 4th Essex` account.
- Tram Nguyen: CPF `16891`, active `House, 18th Essex` account.

Those records may eventually support a separately labeled state-office history, but current U.S. House campaign totals must come from the FEC.

## Official endpoint plan

| Need | Official endpoint | Useful fields | Recommended handling |
| --- | --- | --- | --- |
| Find a filer | `GET /filers/listings/C?searchPhrase={name}` | `cpfId`, `filerName`, `filerCity`, `isActive`, `officeSought`, `officeHeld`, `isIncumbent`, `accountTypeCode` | Candidate discovery only. Resolve with all identity dimensions and require review. Never accept the first fuzzy result. |
| Verify the identity | `GET /filer/{cpfId}` | `fullName`, `officeSought`, `officeHeld`, `partyAffiliation`, `tags`, `filerPhotoUrl` | Use as the canonical OCPF identity assertion. Treat photo reuse rights as unreviewed; an API URL is not a license. |
| Candidate YTD snapshot | `GET /filer/payload/{cpfId}` | `ytdReport.receiptsYtdNumeric`, `expendituresYtdNumeric`, `currentCashOnHandNumeric`, `startBalanceNumeric`, `bankReportEndDate`, `reportYearFirstDayDate` | Best bounded endpoint for an at-a-glance candidate snapshot. Read only the candidate's own `ytdReport`, not `raceActivityReports`. |
| Discover report families | `GET /reports/baseReportTypes/{cpfId}` | `baseReportTypeId`, `baseReportTypeDescription` | Resolve available report families before requesting reports. Depository candidates expose principal reports, deposit reports, year-end summaries, and related itemization reports. |
| Monthly receipts, spending, and cash | `GET /reports/reportList/{cpfId}?baseReportTypeId=1&pageSize={bounded}` | For bank reports: `creditTotal`, `expenditureTotal`, `cashOnHand`, `startBalance`, `endBalance`, `savingsBalance`, `startDate`, `endDate`, `dateFiled`, `reportId`, `isAmended` | Use each current monthly bank report as a point. `creditTotal` and `expenditureTotal` are monthly flows; `cashOnHand` is the end-of-period snapshot. Convert strict currency strings to integer cents. |
| Report evidence | `GET /report/{reportId}` | Runtime report fields, item arrays, linked reports, `ocpfUsReportLink`, amendment links | Preserve the report ID and OCPF display URL for every derived metric. Ignore superseded reports. |
| Itemized receipts | `GET /search/items?SearchTypeCategory=A&CpfId={cpfId}&StartDate={date}&EndDate={date}&withSummary=true` | `recordTypeId`, `recordTypeDescription`, donor/name fields, `date`, `amount`, `sourceLink` | Record-type IDs are available from `GET /search/recordTypes/A`. Includes contributions, loans, interest, transfers, and in-kind entries. Avoid equating total receipts with individual donations. |
| Itemized spending | `GET /search/items?SearchTypeCategory=B&CpfId={cpfId}&StartDate={date}&EndDate={date}&withSummary=true` | vendor/name, purpose/description, date, amount, source link | Record-type IDs are available from `GET /search/recordTypes/B`. Includes general expenditures, fees, liability repayments, reimbursements, card charges, and independent expenditures. |
| Debts and liabilities | `GET /reports/reportList/{cpfId}?baseReportTypeId=3`, then `GET /report/{reportId}` | On year-end runtime payloads: `liabilityItemizedTotal`, `liabilities`, `liabilityRelatedItems`, `endDate` | The latest observed liability figure is a year-end value, not a live 2026 balance. Display its as-of date or keep current debt unknown. Do not silently carry it forward. |
| Candidate-targeted outside spending | `GET /miscreports/iepacs/candidates/{year}`, `/miscreports/iepacs/reports/summary/{year}`, `/miscreports/iepacs/reports/{year}`, then `GET /report/{reportId}` | Summary `count`/`total`; detailed expenditure items expose `affectedCandidateName`, `isSupported`, `amount`, `date`, `description` | Keep independent spending separate from candidate-controlled money. Use only current amendments and attribute item-by-item because one report can cover several candidates. |

### Current record types

The official `GET /search/recordTypes/A` response currently identifies receipt types including individual contributions (`201`), committee contributions (`202`), union/association contributions (`203`), non-contribution receipts (`204`), bank interest (`205`), candidate loans (`206`), transfers from savings (`207`), unitemized receipts (`220`), and in-kind types (`401`–`404`, `420`).

The official `GET /search/recordTypes/B` response currently identifies spending types including general expenditures (`301`), bank fees (`302`), committee contributions (`303`), liability repayments (`304`), independent expenditures (`315`), payroll (`318`), unitemized expenditures (`320`), candidate out-of-pocket spending (`331` and `332`), reimbursements (`351`), card charges (`354`), and merchant-provider fees (`319`).

The adapter should retrieve these dictionaries during refresh and preserve the descriptions rather than hard-code political meaning from numeric IDs.

## Data-quality findings

### Use the candidate's `ytdReport`, not the embedded race list

The live `raceActivityReports` array embedded in `GET /filer/payload/{cpfId}` produced expenditure figures that disagreed with the same payload's candidate `ytdReport`. Examples observed during this audit included Maura Healey and Barry Finegold. Treat `raceActivityReports` as unverified until OCPF clarifies the discrepancy.

### Reconcile YTD and monthly values before publication

For Maura Healey, the sum of the retrieved 2026 monthly bank-report `creditTotal` values differed by `$51.00` from `ytdReport.receiptsYtdNumeric` in a near-simultaneous live probe. This may reflect amendment timing or an API consistency issue. A materializer should:

1. Fetch a single bounded snapshot.
2. Exclude superseded reports.
3. Compare report sums with the YTD payload.
4. Mark the result `partial` with a visible limitation when they do not reconcile.

It must not silently choose the more visually convenient total.

### Do not use `/chartData/monthly` for candidate history yet

Live probes of `GET /chartData/monthly` with `CpfId`, start date, and end date returned a top-ten aggregate list rather than the requested candidate's monthly history. The per-candidate report-list method above is more transparent and evidence-addressable.

### Treat pagination summaries cautiously

One observed `reports/reportList` response returned report items while its `summary.count` and `summary.total` were both zero. Bound by `pageSize`, inspect the actual `items`, and stop deterministically using dates and item counts instead of trusting that summary alone.

### Independent-expenditure filters are not stable enough for direct publication

The candidate summary endpoint returned valid totals when given OCPF's reverse-name form, such as `Healey, Maura T.`. During this audit, adding the documented `Position` filter or applying the candidate filter to the full reports endpoint produced HTTP 500 responses. Fetching the bounded yearly report set and resolving current detailed report items is slower but auditable. Any summary total should be cross-checked against those items.

## Minimal adapter behavior

1. Load the reviewed registry and fail closed when a current OCPF identity no longer matches its expected name and office.
2. Fetch only the candidate's own profile, payload, bounded report list, and relevant report details.
3. Cache raw sanitized responses with source URL, retrieval timestamp, HTTP metadata, and content hash.
4. Preserve amounts as integer cents and all period/as-of dates.
5. Exclude amended reports that have a current successor.
6. Emit a metric only when its identity, period, and source report are known.
7. Keep candidate-controlled receipts/spending, debt, and independent spending in separate fields and visual layers.
8. Downgrade to `partial` or `unknown` on reconciliation failure; never fill gaps with zero.
9. Require maintainer confirmation before the identity registry becomes publishable.

## Recommended first UI slice

The strongest OCPF pilot is the Governor race because all three candidates have exact current identities, direct YTD snapshots, monthly bank reports, and 2026 independent-expenditure activity. A useful first comparison can show:

- Candidate-controlled receipts, expenditures, and cash through a common cutoff.
- Monthly money-in and money-out as small multiples with a shared scale.
- Candidate loans and other receipt composition as distinct categories where item data is complete.
- Independent support and opposition in a separate panel.
- A visible reconciliation state, reporting cutoff, and links to every underlying report.

This would be substantially more informative than a single "money raised" ranking while staying inside observable regulator data.
