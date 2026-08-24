# Candidate portrait data

Candidate portraits are evidence-bearing identity records, not decorative URLs. Civics publishes a face only when both the pictured subject and the right to reuse the image pass explicit checks. A candidate or ballot verification badge never implies that a portrait is verified, and a portrait badge never implies that the candidate's biography, ballot status, or claims are verified.

## Pipeline

The portrait slice follows the same static, reviewable pattern as finance:

1. `data/raw/portraits/ma-primary-2026.json` preserves sanitized provider metadata, exact upstream revisions, rendition hashes, declared rights, and candidate identity hints.
2. `data/sources/portrait-candidate-registry.json` makes the candidate-to-source join explicit and records identity, rights, review, and publication decisions separately.
3. `scripts/materialize-portraits.mjs` produces `public/data/portraits/ma-primary-2026.json` for the browser.
4. `src/data/portraits.js` applies the publication invariants again at runtime. A malformed or incomplete published record is downgraded to initials.
5. `scripts/validate-portraits.mjs` proves that the checked-in public view is an exact deterministic transformation of the source snapshot and registry.

The browser consumes only the precomputed public view. It does not call Wikimedia, GitHub, an AI model, or a key-protected identity service to decide whether an image is safe to show.

## Publication states

| State | Browser behavior | Meaning |
| --- | --- | --- |
| `published` | Render the portrait and verified-photo indicator | Subject identity and reuse rights are both verified |
| `review_required` | Render initials; never expose an image URL | A possible source exists, but one or more publication checks need review |
| `fallback` | Render initials | No publishable portrait source has been established |

The verified-photo tooltip should say that verification covers only the portrait subject and reuse rights. It must not say or imply that the candidate, campaign, ballot entry, or political statements are generally "verified."

## Initial Massachusetts coverage

Two U.S. Senate portraits are publishable:

- Edward J. Markey joins to the `unitedstates/images` portrait through exact Bioguide ID `M000133` and current official [Congress.gov](https://www.congress.gov/member/edward-markey/M000133) and [Senate](https://www.markey.senate.gov/about) profiles.
- Seth Moulton joins through exact Bioguide ID `M001196` and current official [U.S. House Clerk](https://clerk.house.gov/members/M001196) and [Biographical Directory](https://bioguide.congress.gov/search/bio/M001196) profiles.

The [`unitedstates/images`](https://github.com/unitedstates/images) project says the Government Printing Office assured it that its congressional photos are public domain. Both image URLs are pinned to repository revision `aec3e4a88af843b282c0576f420b930f6a9a46ad`, and each card/profile rendition has a recorded SHA-256 hash.

A rights-clear John Deaton lead was retained but deliberately not published. The [Wikimedia Commons file record](https://commons.wikimedia.org/wiki/File:John_Deaton,_2024_(cropped).jpg) traces the still to a candidate-campaign video, records a CC BY 3.0 license, and documents both automated and manual Commons license review. It does not contain a stable civic identifier comparable to a Bioguide ID, so the candidate-to-subject join remains `needs_review`; the public materialized view contains initials and no image URL.

The other 25 seed candidates remain explicit initials fallbacks. Candidate-owned web photos, social-media avatars, search-engine thumbnails, Ballotpedia images, and state-government page images are not publishable merely because they are publicly visible. Unknown reuse rights fail closed.

## Updating

After editing the source snapshot or registry, run:

```bash
node scripts/check-portrait-assets.mjs
node scripts/materialize-portraits.mjs
node scripts/validate-portraits.mjs
```

The asset check performs bounded HTTPS retrieval, enforces the expected image media type and five-megabyte ceiling, and compares every rendition with its recorded SHA-256 hash. It is appropriate for a scheduled source-integrity job; the normal static build does not need network access.

Future provider adapters may add Commons API metadata, official identifier joins, or licensed candidate submissions, but they must preserve the same gates:

- exact candidate identity match;
- reusable license or public-domain basis;
- attribution and modification notes where required;
- source URL, provider revision or content hash, and `checkedAt`;
- visible review state;
- no image URL in the public record until all publication checks pass.
