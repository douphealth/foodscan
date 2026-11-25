# FoodScan 102.1.0 — release notes (25 Nov 2026)

102.1.0 fixes the defects found by auditing 102.0.0 against live Open Food Facts records, the bundled Greek price data and the running app.
It is built on 102.0.0 ([`RELEASE-102.0.0.md`](RELEASE-102.0.0.md)). **Not deployed:** the live site is still 100.1.0.

Before the audit, the three zips in the project folder were compared file by file: 101.1.0 and 102.0.0 contain every file of `FoodScan-v101-site.zip`, and differ from it only in the files those releases meant to change. Nothing of the hand-made v101 was lost.

## Defects fixed

| Area | What was wrong (found live) | Now |
|---|---|---|
| Allergens and ingredients (`assets/domain-v101.mjs`) | A cut-short translation stood in for the label. Nutella's English list in Open Food Facts is "sugar, palm oil"; its French, German and Italian lists name 8 to 10 ingredients. The short list hid hazelnuts, milk and soy from the ingredient-text allergen check. | When the main list names at most half the items of the fullest list (and that one names 4 or more), the fullest is used. On a tie the usual label languages win over a mislabelled code (Nutella's French list is also filed as Abkhaz, `ab`). Arabic `،` and Chinese `、` separators are counted. A complete main list is kept (Coca-Cola's Spanish list of 5 stays, though Bulgarian names 7). |
| Grades (`assets/domain-v101.mjs`) | A Greek spring water published as grade A was withheld, because its record says 3.45 g salt per 100 ml (mg per litre typed as mg per 100 ml). | Plain, unsweetened water is grade A under the Nutri-Score 2023 rules whatever its minerals, so when salt is the only impossible value the source's A is kept, with the salt warning shown. Flavoured or sweetened water is not covered by this rule. |
| Daily check-in (`daily-v98-core.mjs`) | The same impossible number would be multiplied into the day: half a litre of that water would add 17 g of salt against the 5 g limit. | `plausibleNumbers()` holds back values no food can have (over 100 g per 100 g, over 910 kcal, salt over 2 g per 100 ml in a drink, sugars above carbohydrates). They count as "not reported", so the day reads "at least this much", never an invented total. |
| Prices (`src/worker/prices.js`) | The outlier check compared only community prices with their peers. Lidl's e-shop listed a 194 g coffee at €14.85 under a barcode whose official observatory price was €4.76 at Lidl and four other chains; it was shown with a €74.25/kg unit price. | Every source is compared with its peers (below half or above 2.5 times their median). An outlier is shown with a warning, never ranked as cheapest and never counted. |
| Prices in lists (`/api/prices/peek`) | One barcode with a wrong check digit (Open Food Facts holds many, for example 5201004023361) made the whole batch of five fail with a 400. The valid barcodes beside it then showed "no price" for half an hour. | Each invalid barcode is answered on its own as `invalid_barcode`; the valid ones are looked up as usual. Both list clients already treat that answer as "no price". |

## Measured, no change needed

- **Speed.** A cold first visit to Home (no service worker, no cache, local runtime) loads 55 files, 326 kB before compression; the page is usable after about 0.26 s locally. The largest file is the 37 kB list-grade index, loaded after the page. Nothing here was a bottleneck worth a risky change.
- **Suspect prices.** On the product page an outlier is listed in its own "suspect" group with its peer median; it never becomes the headline price, the "last recorded" price or the list price.

## Tests

`qa/audit1021.test.mjs` (7 new) covers the ingredient-list choice (Nutella, Coca-Cola, Chinese separators), the water grade and its limit, the daily-intake bounds and the price outlier rule. `qa/list-prices.test.mjs` now pins the per-barcode answer for a mixed batch. `src/worker/manifest.json` was refreshed with `node build.mjs --update-manifest`, and `node build.mjs --check` rebuilds `_worker.js` byte for byte. Full suite: **235 of 235 pass** (228 before, 7 new).

## Limits

- A wrong number in Open Food Facts that is still plausible cannot be caught by any check.
- Grade coverage is unchanged: of the 12,137 products in the bundled Greek catalogue, 4,176 carry a published grade and 2,408 have no nutrition numbers at all (they can only be graded from a label photo).
- Prices outside Greece still come only from the Open Prices community database, which is sparse in most countries.
- Not tried on a real phone or on real Cloudflare; checked with the test suite and Cloudflare's local runtime.
