# FoodScan 99.0.0: the daily check-in logs how much you ate, and shows the day against the WHO limits

Base: FoodScan 98.1.0 (`main`, live). The brief was a long improvement list (edge catalogue, price layers, offline cache, trust tiers, Smart Basket, a simpler Home). Each item was first checked against the code. Most of the accuracy and price items already exist in 98.1.0 (table below). This release builds the item that was missing and that the brief named exactly: the check-in showed averages per 100 g ("7.4 g / 100 g, not your intake") instead of what a person ate.

## What changed
- **A check-in is a food and an amount.** Tap a food on Home, then an amount: the product's own serving, its pack (or one unit of a multipack), a glass, cup, can or bottle for drinks, or 30, 50, 100, 150 g for foods, "Same as last time" (one tap, remembered per product), or a typed number from 1 to 2,000 g or ml. Nothing is logged without an amount and no amount is guessed. The same row opens from "+ Had today" on a product page.
- **The day is what was eaten against the limits.** Sugars against the WHO 50 g (25 g is better), salt against 5 g, saturated fat against 22 g, energy against the EU label reference of 2,000 kcal. The figure is amount × the food's per-100 numbers; a food that does not report a number is never counted as zero and the card says "at least this much". One 330 ml cola (10.6 g sugars per 100 ml) shows 35 g, 70 % of 50 g. The sugar note says the label counts all sugars (milk and fruit sugar too), so the figure is an upper estimate of the WHO's free sugars.
- **Undo.** Today's check-ins are listed with an amount and a remove button.
- **Entries written by 98.1.0 have no amount**: they are listed as "no amount" and never counted (the card says how many).
- **One key per product (GTIN-14).** A UPC-A (12), EAN-13, EAN-8 and GTIN-14 of one product are one chip and match the same check-ins and compare pin (`gtin14()` in `daily-v98-core.mjs`; `gtinCheckOk()` is the GS1 check digit). In the real browser test a UPC-A and its EAN-13 form showed as one food.
- Actions come first on Home (foods and amounts, then the day, then today's list); the WHO notes sit behind a closed "About these limits".
- Stored in this browser only (`foodscan:daily:v98` rows now carry `gtin`, `grams`, `basis`, `portion`, per-100 numbers; `foodscan:portion:v99` the last amount per product). Backup and restore already cover both keys. English and Greek. The service worker cache is `foodscan-99.0.0`, so installed phones update.

## The brief, item by item (what was found in 98.1.0)
| Item | State |
|---|---|
| GTIN-14 keys | Worker catalogue (`gtin14` column, negative lookups) and the app's recents already pad to 14 digits. **New here:** the daily hub, compare pins and check-ins. |
| Deterministic Nutri-Score 2023 engine | Exists (`src/domain/nutriscore2023.js`, `grade.js`), all food kinds, tested on real records. Unchanged. |
| Label photo to a grade | Exists: on-device reader (`prices/label-reader-v85.mjs`, `label-ocr-v85.mjs`, 85.0.0) that repairs OCR confusions and reports corrections and whether the numbers fit each other. It is Tesseract on the device, not a vision model. Unchanged. |
| Price layers, €/kg, freshness | Exists (80 to 90): Open Prices, Greek official and web-shop sources, unit price on the same basis, a price older than 7 days is shown as "last recorded price" with its age, no estimate shown. The 30-day dimming and hiding stale prices is **not** done. |
| Healthier swaps, price and health | Exists (88, 90): same-shelf swaps from a precomputed index of 4,938 graded Greek products, "cheaper per kg" when both prices are current. A "less sugar" figure is **not** shown: the swap index has no nutrient columns. |
| EU-14 allergen parser, anomaly checks | Exists (`allergens.js`: 14 allergens plus three preferences with multilingual stems; data card energy check shows the reported and the explained kcal; "sugars exceed carbohydrates"). Unchanged. |
| **Daily intake from servings and WHO limits** | **Built here.** |
| Verification tiers (manufacturer, label photo, community) | **Not built.** The worker passes a fixed list of Open Food Facts fields and none says who supplied the data (`data_sources_tags`, `states_tags`). Adding them changes what the worker stores and caches, so it needs real records to test against. Next step. |
| Merge by priority: GS1/manufacturer, national tables, OFF | **Not built.** Open Food Facts is the only nutrient source (plus FoodScan's own calculation). No licensed feed is wired in. |
| Full Open Food Facts dump in D1/R2, nightly deltas | **Not built.** The optional D1 catalogue is a read-through cache of looked-up products. A dump import needs a Cloudflare database and a multi-gigabyte load. |
| 50,000 barcodes in IndexedDB for offline scans | **Not built.** Saved foods work offline; there is no IndexedDB catalogue. |
| Retailer scraping on a cron | **Not built** beyond the existing daily refresh (Open Prices, Bazaar, Lidl, observatory). Chain feeds need agreements with each retailer. |
| Price history sparkline, shelf-tag and receipt scanning | **Not built.** An add-a-price flow exists (`prices/add-price-v80.mjs`); the Open Prices price-tag and receipt proofs are not wired in. |
| Smart Basket totals, a simpler Home with the guides moved to tabs | **Not built.** The Choice Workspace and the Home layout live in the minified app bundles (`assets/*-v8400.js`), which have no source in this repository (see `SOURCE.md`); changing them by hand would be a guess. They need the original sources. |

## Checks
- `qa/daily99.test.mjs` (13 tests): GTIN-14 for 8, 12, 13 and 14 digits and for junk; check digits of real codes and one-digit typos; amount parsing; pack sizes (`6 x 330 ml`, `1,5 L`, `5 kg`); presets (own serving first, no amount twice); the stored entry; intake arithmetic (cola can = 35 g; two cans = 140 %, bar capped at 100); lower bounds when a number is missing; old entries not counted; limits and the 75 % / 100 % states; remembered amounts; wiring and both languages.
- In the browser (phone width, Greek and English, real catalogue record on a product page): amounts row opens with focus inside, escape closes it, invalid amounts (`abc`, `2001`) show an error and log nothing, `500 ml` logs, "same as last time" appears after a first log, remove updates the totals, the card and the saved numbers match hand arithmetic (35 + 53 + 6.6 g = 94.6 g).
- `node build.mjs --check`: 23 modules rebuild `_worker.js` exactly. Full suite `node --test qa/*.test.mjs`: 177 tests; the one failure was a test that still pinned the 98.1.0 page version (fixed), and the changed test files (core, daily98, daily99, source) pass 37 of 37 after the fix.

## Limits
- Tested in a desktop browser at phone width, not on a phone camera or a real phone.
- The WHO sugar limit is for **free** sugars; the product data has total sugars, so the figure over-counts for milk, fruit and plain yoghurt. The card says so.
- Reference values are population limits, not advice for one person.
- Deploy: the live site updates when Cloudflare builds this commit from `main`; after that `node price-refresh/tools/verify-deploy.mjs https://food-scan.gearuptofit.com 99.0.0`.
