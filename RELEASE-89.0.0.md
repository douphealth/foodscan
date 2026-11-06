# FoodScan 89.0.0: estimates in every list, and the missing numbers shown with their range

Base: FoodScan 88.0.0 (`main`, 80c9f0d). Built after the owner's screenshots: a "Greek yogurt" search where most rows show "–", and Rodogal Greek yogurt (5204140002008) whose card says sugars, saturated fat and salt were "borrowed" without saying what was borrowed.

## 1. Grades in lists
A search, category or swap row showed only the published grade, so every product without one showed "–", even when its product page shows an estimate. Now (`prices/fill-v89.js`, `assets/estimates-off-csv-2026-10-30.json` built by `tools/build-estimates.mjs` with the product page's own steps):
- the row shows the letter its product page shows (the most likely letter, or the first of the band), as the app's own estimate chip (dashed ring); its tooltip and screen-reader label say "Estimated Nutri-Score B (B–C): FoodScan's estimate, not a published grade";
- products the method does not cover (salt, spices, alcohol, supplements, baby food) keep "–" with the explanation as tooltip;
- 6,198 catalogue products: 3,496 calculated from their own numbers, 1,202 with borrowed numbers, 1,075 typical of similar products, 108 by maker, 317 not rated. 37 KB compressed, loaded once.
- Checked in the real app as a Greek visitor: the same "Greek yogurt" search now shows Delta A, Kolios B, ΣΕΡΓΑΛ B, Carrefour C, Rodogal B, Olympos 2 % A as estimates. `qa/fill.test.mjs` checks that a row shows the same letter as the product page (Rodogal B, the 87.1 orange juice E) and that the index is exactly what the catalogue produces.

## 2. The missing numbers, shown
A borrowed sugars, saturated fat, salt or energy value is now printed on the card with its range: "Sugars ≈ 4.7 g, borrowed, 3.8–5.2 g in similar products". The value is the weighted middle value of the similar products used, the range holds the middle 80 % of them. Measured leave-one-out on 3,528 graded Greek products with their sugars, saturates and salt hidden (`tools/similar-validate.mjs`, `validateBorrowed`):

| | real value inside the range shown | median error |
|---|---|---|
| sugars | 87.2 % | 0.8 g per 100 g |
| saturated fat | 88.9 % | 0.2 g |
| salt | 84.6 % | 0.08 g |

The card's reliability note quotes these ("85 to 89 %"); `qa/similar.test.mjs` fails if the measurement drops below what is printed. The label-facts panel still says "Not reported" for these nutrients, because they are not on the label.

## 3. Tried and not shipped (measured)
- **Numbers from the same product under another barcode** (same name and brand, agreeing numbers): published letter inside only 74.7 % of the time, worse than the similar-products method (88 %), and only 18 products reached. Variants under one name (2 % and 5 % yogurt) differ too much.
- **Shop photos** (Bazaar, Lidl): not used; they belong to the shops and manufacturers, and the page's security policy allows only Open Food Facts images.
- **Rodogal's price**: no source has it (observatory, Bazaar, Lidl, Open Prices, e-katanalotis), and no estimate is possible because the record has no pack size.

## 4. Photos (follow-up)
`tools/build-photos.mjs` asks Open Food Facts for every catalogue product without a front image and keeps a real photo of it (a front image of another language, then the first uploaded photo). A sample found one for about 12 % of the 3,380. The Open Food Facts search API was answering "busy" for most requests, so the index was not ready for this release; `prices/fill-v89.js` already uses it when the file is present (a missing file leaves the illustration, as today). It ships in 89.1.

## Checked
Real `_worker.js` locally as a Greek visitor (Chromium, Greek locale, Athens time zone): the search list, the Rodogal page (borrowed values, swaps: Fage Total Greek yogurts graded A). No page errors. 123 tests pass; `node build.mjs --check` OK. Not checked on the live site.

## Rollback
Revert the merge; or remove `fill-v89.js` from `index.html` (lists show "–" again); the borrowed values come from `prices/similar-v86.mjs` and `prices/grade-ui-v85.mjs`.
