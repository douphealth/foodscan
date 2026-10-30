# FoodScan 64.0.0 — validation report (against the independent audit of 63.0.0)

Nothing was deployed or merged. 84 automated tests pass (68 unit/contract, 16 in Chromium). Earlier reports (62.0.0, 63.0.0) still apply except where this one changes a number.

## Audit findings, one by one

| Finding | Status | Evidence |
|---|---|---|
| **P0-1** wrong product-use matches | **Fixed for the audited cases and their variants; adjudication not done** | All three audited pairs are rejected in the matcher and in discovery (real records, `tests/relevance.test.mjs`), plus Greek/imported variants and supplement/food-form edge cases. A defect the variants exposed (all sauces one type since 62.0.0) is fixed. 260 earlier pairs replayed: 39 no longer offered (`release-qa/review-replay.json`). A new packet of 260 pairs (all 31 families) is ready; **no human has adjudicated it**, so the audit's ≤2% inappropriate-pair target is not demonstrated. |
| **P0-2** point agreement presented as verification | **Fixed** | Tiers complete / robust / partial; only complete and robust are comparable. 4,170 graded records in the 29 Oct snapshot: 1,327 complete-input, 969 robust, 1,188 partial (shown as the source's own grade, not comparable), 555 source-only, 131 withheld. Missing inputs are never silently zero: ranges are checked and the missing nutrients are named (Greek too). Golden fixtures: 133 real Open Food Facts records with the source's own component points across water, drinks, cheese, fats/oils/nuts/seeds, red meat, ordinary foods; points and components equal the source's for all reproduced records (≥80% of each class reproduce; the rest keep the source letter). Oil override added after the fixtures found it. |
| **P0-3** refresh not operational | **Run once on the real export; scheduling and alerting not done** | See below. |
| **P1-4** startup | **Not done** beyond 63.0.0's preload change; no real-phone data. The v61 chunks have no source for route-level splitting. |
| **P1-5** coverage | **Measured and published**, not improved | `release-qa/coverage.md`: 12,137 records; named 92.9%, categories 49.2%, ingredients 29%, full nutrition 59%, source-graded 34.4%, comparable grade 19%, withheld 2%. No stock, price or availability is claimed. |
| **P1-6** SEO/analytics | **Partly** | With a stubbed upstream: a fresh record → `index, follow`; 503 and 429 → 200 page from the dated catalogue, `noindex`, origin in `X-FoodScan-Cache`; the sitemap tool leaves such answers "unverified" instead of removing URLs. 404-from-upstream and D1 stale paths were not exercised. No Search Console, GA4 or referral data exists to validate. |
| **P1-7** reproducibility | **Improved** | The build is hash-pinned, byte-reproducible, gates a catalogue before adopting it, and the suites run on any built tree (`FS_APP_DIR`, `CHROME_PATH`, `FS_RELEASE`). The source bundle and a CI workflow for the PR carry the project; the deployed ZIP cannot run `npm test` by itself, as the audit noted. Old asset sets are kept for installed clients (not deleted). |
| **P2-8** repeat use | **Not built** | No saved-decision workspace; no metrics. |

## The real-export refresh (P0-3)
- Source: `en.openfoodfacts.org.products.csv.gz`, 1,525,386,608 bytes, last modified 2026-10-30 09:08 UTC (official bulk export; one request with a descriptive User-Agent).
- Builder: 4,883,884 rows streamed in 1 min 52 s; 14,673 Greece-listed rows → **12,137 products**; 2,324 rows without identity (name, brand, generic name, pack size, nutrition or ingredients) and 212 invalid barcodes skipped, as the shipped catalogue does.
- Gates (`tools/verify-catalogue.mjs`): 12/12 pass (manifest/licence/attribution, snapshot age 0.1 days, 57 shards' bytes+SHA-256+count, no duplicate or invalid barcode, all listed for Greece, 32 families, codes/search/category indexes, 2.0% quarantine share, +0.2% product count vs the shipped catalogue, newer than it).
- Real schema differences found and fixed: `allergens` (not `allergens_tags`), `image_url`/`image_small_url` (not `image_front_*`). A first family partition of my own reshuffled shards and lost 4 of 128 sampled recommendations; families are now inherited from the catalogue being replaced.
- Staged app (real catalogue): 36 higher-grade suggestions on the 128-product sample (shipped: 36), 0 shown-vs-opened mismatches; all 16 browser tests pass.
- Damage tests: a changed byte, a missing shard, a truncated export, a stale or future snapshot and a duplicate barcode are each refused; a refused promotion changes nothing; a promotion keeps the old configuration; `--rollback` restores it exactly.
- **Not done:** a scheduled production job with alerting, a Cloudflare staging deployment, sign-off. Snapshot continuity: this release's catalogue expires for recommendations on 2027-01-28 (lookups to 2027-10-30).
- Licensing: the data is ODbL 1.0 (Open Food Facts contributors); attribution ships in `assets/<catalogue>/ATTRIBUTION.txt`. A share-alike review of the derived database is not done.

## Better choices on the 128-product sample (API unreachable)
36 higher-grade, 10 same-grade, 51 nutrient-based, 109 comparison-only, 19 nothing; 0 shown-vs-opened mismatches; engine p50/p95 78/351 ms on this PC (63.0.0: 52/216; the extra category shards read per query cost about 100 ms at p95). 63.0.0 → 64.0.0 higher-grade 38 → 36, after the evidence tiers and the use fixes.

## Limits that remain
Physical phones, Cloudflare staging, production analytics, the human adjudication, route-level loading and INP were not done. The supplement and head-noun rules are lexicons over names: products with unusual names fall back to a default type and are compared only after a shared specific category. The audit's mention of `ERR_BLOCKED_BY_ADMINISTRATOR` browser failures does not apply here: the Chromium suites ran.
