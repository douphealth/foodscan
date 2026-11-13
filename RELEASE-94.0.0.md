# FoodScan 94.0.0: launch checks — the safe parts of 93.4.0, scan-outcome counts, and a styling bug fixed

Base: FoodScan 93.0.0 (this branch; 91, 92, 93 and 94 ship together). The owner sent a hand-edited build, "93.4.0", to review and improve. Every change in it was measured. What held up is ported into the source (`src/worker/`, `prices/`) with tests; what did not is left out and listed below with the measurement.

## What 94 changes
- **Web-shop prices need a date and a product page.** A web price with no date, a future date, a non-https address or a shop's home, search, cart or account page is dropped. Before, a missing date was read as "today", which could make an undated price "current". (Idea from 93.4.0; written into `src/worker/prices.js` `fsPriceProductPage` and `fsPriceWebOffers`.)
- **Greek date made robust.** "Today in Athens" is now built from date parts (`formatToParts`) instead of relying on the `en-CA` format string, in the worker and the three price cores. Same result today, no dependence on a locale's format. (From 93.4.0.)
- **Scan outcomes** (`POST /api/prices/outcome`, table `foodscan_scan_daily`). Once per product per visit, the product page reports its grade tier (source / estimated / exempt / none), price tier (current / older / estimate / none) and whether a real photo showed. Stored as daily counts per barcode: no address, device id, cookie or time of day. Skipped under Do Not Track / Global Privacy Control and for other sites. `GET /api/prices/outcome?days=30` with `Authorization: Bearer FOODSCAN_PRICES_ADMIN_TOKEN` lists the most-opened products with what each was missing (`SETUP.md` 3a). This tells you which gaps shoppers actually hit, so fixes go where they matter.
- **Fixed: estimate gauges were unstyled in production.** The site's Content-Security-Policy (`style-src 'self'`, set by the worker) drops `style="…"` written in HTML. The estimate card's scale ticks and its "how similar products are graded" bar wrote their positions and widths that way, so the browser threw them away (seen as CSP errors in the browser check). They now carry `data-fs-style` and the reader applies them through the CSSOM, which the policy allows; the bar shows its real proportions (e.g. C 11 %, D 23 %, E 62 %).

## What was left out of 93.4.0, and why (measured 13 Nov 2026)
| 93.4.0 change | Measurement | Decision |
|---|---|---|
| 2,105 products given allergen tags, 171 trace tags | 40 sampled against the live Open Food Facts record: 16 the same, **8 different** (Kinder Sorpresa lost *gluten*; "Chocolate con Leche" lost *gluten and milk*; others gained allergens the record does not list), 16 with no allergens on Open Food Facts at all; some tags are not taxonomy values ("en:Γάλα και προϊόντα του") | Left out: an incomplete allergen list reads as "safe" to an allergic shopper. The app already says when allergens are unknown. |
| 1,177 products given a pack size | 20 sampled: none of the sizes exists on Open Food Facts; source unknown (one looks taken from "HIGH PROTEIN **35g** vanilla", which is the protein content) | Left out: a wrong size turns correct prices into "other size" and breaks per-kg prices |
| 665 observatory links added (1,842 vs 1,177) | 1,364 agree with the daily linker's published links (1,454); 475 come from nowhere reproducible (345 identical to the "Argon" build's links); a sample of 30 had about 1 in 5 another flavour or an unconfirmed size | Left out; the daily linker's links reach the site from `prices-data` anyway, and uncertain matches belong in the shopper confirmation of 91 |
| Estimates rewritten in place (2,599 changed, 1,812 added) with the old build date kept | Not reproducible from the build tool (the "estimate index is exactly what the pages produce" test fails) | Left out; estimates are rebuilt daily by the refresh job |
| Swap "functional compatibility" filter, reliability shown as 94 / 86 / 82 / 71 % | `tools/swaps-validate.mjs` on the 3,037 graded products: top swap on the same shelf **74.8 % → 59.1 %**, same aisle 88.9 % → 73.9 %; without categories 55.2 % → 40.0 %. Coverage rises (88.9 % → 91.5 %) by offering less related swaps | Left out: worse swaps, and printed figures above the measured ones |
| A second grade calculator (multi-table) and removal of the "dated catalogue copy" rule | With the published grade hidden, it recomputes 54.4 % of 4,176 graded products, 98.7 % exactly; but the page's existing quick grade already gives 60.8 % (97.7 % exact) and the new one adds **1 product** over it | Left out: no measurable gain, and it removes a measured safety rule |
| Ranking only when `available === true` | 19 of the 139 tests fail with it: Open Prices offers can never rank, so French and American shoppers get no cheapest price; and the paid web search runs even when a free current price exists (`expected 0 webclaw calls, got 2`) | Left out |
| Shopper label entries sent to Open Food Facts, **on by default**, anonymously, unmoderated | — | Left out: needs explicit opt-in, the shopper's own Open Food Facts login and review first |
| Monthly catalogue refresh inside the worker, writing live overrides | — | Left out for now: catalogue changes belong in the tested build job |
| Hard-coded "coverage" numbers in `/api/prices/status` | Fixed constants (e.g. 7,520 barcodes) shown as live figures | Left out |
| `_worker.js` edited by hand, `SETUP.md` published at the site root | The source no longer builds the deployed worker | Left out; 94 builds from `src/` (`node build.mjs --check` OK) |

## Checked
- `qa/release94.test.mjs` (5 tests): dated product-page web price kept; no date / three days ahead / home page / search page / http dropped; scan outcomes stored as daily counts with no identifier column, admin-only to read (no token and wrong token → 401); DNT, GPC, other sites and bad values never counted, nothing breaks without the database; no `style="` left in the grade card.
- Full suite: **144 tests pass**; `node build.mjs --check` OK.
- Real app in Chromium (local worker, Greek visitor, SQLite database), iPhone 13 and 1440 px desktop, home, three product types (published grade + chain prices, published grade + web-shop price, no grade → estimate) and the prices page: no page errors, no console errors, no failed requests, no sideways scrolling; each product page sent exactly one outcome (e.g. `{"grade":"source","price":"current","photo":false}`).
- Not checkable here: product photos. This sandbox's network blocks `images.openfoodfacts.org`, so every photo fell back to the labelled illustration ("Illustration, not the real package"). Check photos on the live site after deploying.

## Owner steps
1. Run `d1-schema/prices_db.sql` again in the D1 console (adds `foodscan_scan_daily`).
2. Add the secret `FOODSCAN_PRICES_ADMIN_TOKEN` (32+ random characters) to read scan outcomes.
3. Redeploy; `node price-refresh/tools/verify-deploy.mjs https://food-scan.gearuptofit.com 94.0.0`.

## Rollback
Redeploy the 93.0.0 zip, or revert the merge. Without the database the outcome endpoint answers `recorded: false` and nothing else changes.
