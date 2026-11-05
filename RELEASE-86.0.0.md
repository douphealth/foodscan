# FoodScan 86.0.0: a grade, an estimate or an explanation for most products, and a card that says exactly which one it is

Base: FoodScan 85.0.0 (`main`, 4f2d299). Built after the owner's phone screenshots of products with no grade: a Greek sea salt, a pasta ("ΑΧΙΒΑΔΕΣ", Misko), a brioche (Katselis) and a chips bag the label reader could not read. No server change, no secret, no cost: everything runs in the browser.

## What the screenshots showed (three different causes)
1. **Salt (Kalas, 5201050111042):** Open Food Facts marks it "not applicable". The official Nutri-Score method does not cover salt, spices, herbs, seasonings, vinegar, alcohol, supplements and baby food. There is no grade to find; the old card said "No grade ... outside the supported calculation scope", which read like missing data.
2. **Brioche (Katselis, 5201673101406):** the record has energy, fat, saturates, carbohydrate and protein but **no sugars and no salt**, so the quick grade (which needs all four, or all but one) had nothing to work with.
3. **Pasta (Misko, 5201010144660) and many others:** no nutrition numbers at all.
4. The label reader could not read a photographed chips bag (curved pack, angle): accuracy on real photos was never measured, as the 85 notes said.

## What 86 does (in the order the product page tries)
1. **Published grade** (unchanged).
2. **Calculated estimate** from the record's own numbers (85's quick grade; unchanged), now with the table taken from similar products when the figures are complete but the table is unknown (45 more products).
3. **Missing numbers borrowed from similar products** (`prices/similar-v86.mjs`): the numbers that are on record are kept; for each of the most similar products (by name and brand, and by how close their recorded numbers are), the missing sugars/salt/saturates/energy are borrowed one product at a time and the official Nutri-Score 2023 points are computed for every combination; the estimate is the band of letters that results, with a "most likely" letter. The card lists the numbers on record, marks the borrowed ones, shows how the similar products are spread (a stacked A-E bar) and names them.
4. **Typical for similar products:** a record with no numbers at all is matched by brand and name to graded products; the estimate is the band they carry ("Products like this are usually A or B"). The card says it is not calculated from this product's nutrition, because there is none on record.
5. **Not rated** (new card): salt, spices, alcohol, supplements, baby food. It says the method does not cover them, that nothing is missing from the record, shows the non-zero values on record and, for salt, the World Health Organization's advice (under 5 g of salt a day). No grade is invented.
6. **Nothing**, and the label photo, when there are no numbers and no comparable products.

All cards are the same family (seal, A-E scale, legend, "calculated with the official Nutri-Score 2023 algorithm" or "not calculated from this product's nutrition", why it is an estimate, source and date, measured reliability, "not a grade printed on the pack"), English and Greek, light and dark, mobile and desktop. The scale no longer prints a text tag inside the pills (it overflowed in Greek): a legend says "filled and raised: most likely; outlined: also possible".

## Measured (leave-one-out on the 4,103 graded Greek products with all four numbers; the product tested, and every product with the same name and brand, is removed from the peers first; `node tools/similar-validate.mjs`)
| situation | products that get an estimate | published letter inside the band | "most likely" letter exact |
|---|---|---|---|
| numbers on record but not sugars and salt (like the brioche) | 87 % | 88 % | 72 % |
| no numbers, name and brand only (like the pasta) | 37 % | 93 % | 59 % |
The percentages printed on the cards are floors of these (87/71 and 92/58); `qa/similar.test.mjs` fails if a printed figure exceeds the measurement. "Truth" is Open Food Facts' published letter, which is not independent (see 85).

## Coverage of the bundled Greek catalogue (`node tools/coverage.mjs`, 12,137 products)
| | products |
|---|---|
| published grade (what the app showed) | 4,040 (33.3 %) |
| calculated from its own numbers | 3,707 (30.5 %) |
| missing numbers borrowed from similar products | 684 (5.6 %) |
| typical for similar products | 681 (5.6 %) |
| not rated (method does not cover it) | 348 (2.9 %) |
| **some grade or an explanation** | **9,460 (77.9 %)** |
| nothing but the label photo | 2,677 (22.1 %) |
The 2,677 are products with no numbers and no comparable product: 308 have neither name nor brand, ~940 have no brand and a name that matches nothing, ~830 are bars, cookies and rusks whose similar products span four or five grades (a band that wide says nothing, so none is shown).

## What 86 does NOT do (said plainly)
- **Not every product can have a grade.** Where the record has no numbers and nothing resembles the product, any letter would be invented. The photo reader remains, but real phone photos are not yet reliable (see 85).
- **Photos:** a product whose Open Food Facts record has no front image shows the category icon; FoodScan cannot invent a photo. (It would need a second image source, and the page's security policy allows images only from FoodScan and Open Food Facts.)
- **Prices:** unchanged. A product with no Open Prices entry shows no price unless the web price search is switched on (it needs the Firecrawl and Anthropic keys and the prices database, see `SETUP.md`); the observatory's "is it one of these?" suggestion still appears for same-brand products. FoodScan does not estimate a price it has no basis for.
- The similar-products index is built from the Greek catalogue; products from other countries are matched against it by name and brand only, so non-Greek products will often get nothing from this tier.
- Not measured: anything on the live site (the sandbox cannot reach it), and label-reader accuracy on real photos.

## Files
New: `prices/similar-v86.mjs`, `assets/peers-off-csv-2026-10-30.json` (7,076 rows, 709 KB, 238 KB compressed, fetched only when a product needs it), `tools/build-peers.mjs`, `tools/similar-validate.mjs`, `tools/coverage.mjs`, `qa/similar.test.mjs`. Changed: `prices/grade-ui-v85.mjs` (similar and not-rated cards, legend, list grammar), `prices/quick-grade-v85.mjs` (why a product is exempt, table override), `prices/reader-v85.js` (the tiers, in the order above), `prices/reader-v85.css`, version strings (86.0.0), `sw.js`, `src/worker/core.js`, `_worker.js`.

## Rollback
Revert the merge. To drop only the 86 cards, remove the `similar` and `exempt` branches in `loadQuick` (`prices/reader-v85.js`); the 85 behaviour remains.
