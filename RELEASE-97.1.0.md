# FoodScan 97.1.0: the owner's 97.0.0 reviewed — correct Nutri-Score 2023 tables kept, unmeasured guesses left out

Base: FoodScan 95.0.0 (`main`, live). The owner sent a 97.0.0 build. Every change was measured on the 12,137-product Greek catalogue and, for prices, against the real shop prices published on 19 Nov 2026. What held up is in the source with tests; the rest is listed with the measurement.

## Kept (from 97.0.0)
- **Nutri-Score 2023 tables** (`src/domain/nutriscore2023.js`, `assets/domain-v8500.mjs`, `assets/domain-v8400.mjs`; the two browser engines are byte-identical to 97.0.0's):
  - plain waters (0 kcal, no sugar, any water category) use the water table and are **A**. Before, Table water, Eau Samaria, Dirfys, Aqua Carpatica and others showed B or B–C;
  - a product tagged as mineral water but containing sugar is a sweetened drink, **never A**. Before, "vikos pink" (11 g sugar) and a flavoured "Aqua" (4.9 g) showed A;
  - **chicken and turkey are not red meat**, so the red-meat rule no longer widens their grade (chicken nuggets, chicken gyros, turkey breast now show the single letter the source publishes).
  - 29 catalogue products change grade or band; all were checked by hand against the 2023 rules. Measured against published letters the share of exact matches moves from 97.7 % to 97.4 % because several published letters are themselves wrong (waters published "B").
- A guard in `prices/fill-v89.js` against an estimate with no letters.
- The similar-products, swaps and list-estimate indexes were rebuilt with the corrected tables (`tools/build-peers.mjs`, `build-swaps.mjs`, `build-estimates.mjs`, all `--check` OK); the printed category-estimate reliability is lowered to the new measurement (inside 90 %, most likely 56 %; it was 91 / 57).

## Left out (measured 19 Nov 2026)
| 97.0.0 change | Measurement | Why left out |
|---|---|---|
| Assumed salt maximum when salt is missing (0.2 g drinks, 1.0 g sweet foods) | Salt hidden on 4,152 graded products: graded 434 → 699, **wrong 12 → 54** (exact 97.2 % → 92.3 %); e.g. kombucha published B shown as C | States one letter where the data allows two |
| "Most likely" letter when a nutrient is missing | Computed with the missing nutrient at zero: always the best case | Biased; the code's own comment says only the band is shown |
| Family grade fallback for products with no data | Published letter inside the family band 84 %, but 76 % of bands are 3+ letters wide; "most likely" right **47 %**; shows hard-coded `share: 0.8` and `n: 12` as evidence | Unmeasured figures shown as facts |
| Grades for withheld products (`sanitizeWithheld`) | Shows a grade for 123 of 279 withheld products; **41 differ** from the published letter (e.g. Feta E → D); also clears the "estimated nutrition" flag | Withholding exists because the record conflicts |
| Family price benchmark for every unpriced product (`fsV97LiveEstimate`) | 1,325 products with a real current price: real price inside the shown range **39 %**, median error 41 %, off by 50 %+ for 40 % (in-sample, so new products would do worse); no validation | A wrong price shown as a range is still wrong |
| Price estimates rewritten (15,683 vs 11,742; ranges narrowed) | Not the calibrated daily set (0 of 11,722 identical to the published estimates of 19 Nov); real price inside the range 44 % vs 68 % before (27 products) | Narrower ranges without re-calibration |
| 63 observatory links added | 13 are the daily linker's; of the other 50, about 1 in 10 is the wrong variant (light milk → full-fat, vanilla → strawberry, protein oats → plain oats) | The verified linker publishes 1,456 links daily; the site reads them |
| 153 older files deleted | `fridge-core.mjs` still imports the deleted `assets/domain-v8100.mjs`, so `growth-ui.js` (home page) and the challenge page fail to load their module | Kept all files |

## Where coverage stands (measured)
- Grades: 4,028 published, 3,719 calculated from the label (97.7 % equal to the published letter where both exist), 2,529 labelled estimates from similar products, 348 not rated (exempt), **1,513 (12.5 %) with no grade** — their records carry almost no nutrition numbers; the label photo reader (85) is the way to fill them.
- Prices (published data of 19 Nov): current price (≤ 7 days) 17.0 %, older 3.7 %, labelled estimate range 47.3 %, **nothing 32.1 %**. The 15 bundled web-shop prices are 8 days old and no longer current (the daily web step needs the `WEBCLAW_API_KEY` GitHub secret).

## Checked
- `qa/release97.test.mjs`: five plain waters are A; two sugared "waters" are not A; three chicken products are A.
- Full suite: **149 tests pass**; `node build.mjs --check` OK.
- Real app in Chromium (local worker, Greek visitor, D1, admin token), phone and desktop: no page or console errors, no failed requests, real product photos load, one scan outcome per product page (HTTP 202); `/challenge/` loads.

## Rollback
Revert the merge or redeploy 95.0.0 (Cloudflare Pages → food-scan → Deployments).
