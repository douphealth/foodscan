# FoodScan 87.2.0: 503 more products get a grade estimate (maker code, product family, Greek/Greeklish names)

Base: FoodScan 87.1.0 (`main`, b5ebb38). After 87.1, 2,152 of the 12,137 bundled Greek products still showed only "No grade" and the label-photo offer. 1,680 of them (78 %) have **no nutrition numbers at all**, so no calculation is possible; the only route is "what do similar products score", which in 86 matched by name and brand only.

## What 87.2 adds to "similar products" (no numbers on record)
1. **The catalogue's product family** (biscuit, bread, cheese, juice, ...), which the worker now passes with each catalogue product (`catalogueSnapshot.family`, `src/worker/tail.js`).
2. **The maker, read from the barcode.** The first 7 to 9 digits of an EAN-13 are the company's GS1 prefix (5201004... Papadopoulos, 5203064... Allatini). In-store codes (2x), restricted codes (02x, 04x) and short codes are ignored.
3. **Greek script and Greeklish count as the same word** ("μπισκότα", "mpiskota", "biskota" reduce to one sound skeleton), on both the product and the similar products.
4. Similarity for records with no numbers: 0.45 name + 0.2 brand + 0.2 maker + 0.15 family; the band must hold 85 % of the similar products' weight (was 90 %) and is still never wider than three letters.
5. A record with **no usable name and no brand** can now be matched by maker and family alone. Its card says so ("graded products from the same maker ... a weaker match than a name") and prints its own, lower figures.

## Measured (leave-one-out on the 4,103 graded Greek products: numbers hidden, the product and its same-name twins removed from the comparison; `node tools/similar-validate.mjs`)
| situation | gets an estimate | published letter inside the band | "most likely" exact | printed on the card |
|---|---|---|---|---|
| no numbers, name/brand: 86 | 37 % | 93 % | 59 % | 92 / 58 |
| no numbers, name/brand + maker + family + Greeklish: **87.2** | **58.5 %** | **93.0 %** | **59.5 %** | 92 / 58 (unchanged) |
| no numbers, no name, no brand (maker + family only): **new** | 47 % | 87.6 % | 56.3 % | **87 / 56** |
| some numbers, the rest borrowed (unchanged) | 87 % | 88.2 % | 71.6 % | 87 / 71 |
`qa/similar.test.mjs` fails if a printed figure exceeds its measurement.

**Not shown on purpose:** bands of four or five letters. Measured the same way, their "most likely" letter is exact only 39 to 41 % of the time; that is not a credible grade.

## Coverage of the bundled Greek catalogue (`node tools/coverage.mjs`)
| | 87.1 | 87.2 |
|---|---|---|
| typical for similar products (name, brand, maker, family) | 681 | 1,075 |
| typical for the maker's similar products (no name) | 0 | 108 |
| **some grade or an explanation** | 9,985 (82.3 %) | **10,488 (86.4 %)** |
| nothing but the label photo | 2,152 | **1,649** |

## The 1,649 that still get nothing, and why
- 857: similar products exist but their grades spread over four or five letters (mostly mixed bars, spreads, sauces and drinks).
- 709: nothing comparable by name, brand, maker or family.
- 66: all four numbers on record, but marked "estimated" by Open Food Facts or ambiguous between tables.
- 17: no name, no brand and no usable maker code.
- 1,094 of the 1,649 are in the catalogue's unclassified "other" family, which also holds non-food items (hand cream, medicine syrups, face masks, supplements). FoodScan does not guess a grade for them.

## Checked in the real app
The real `_worker.js` run locally, Chromium: an unnamed Allatini biscuit (5203064005966, English, 1440 px: "Usually E", maker wording, 87 % / 56 %), a Greeklish record "papadopoulou gemista sokol" (40000374, Greek, 390 px: "Συνήθως E" from Greek-named Papadopoulos products) and the 87.1 orange juice (still "Most likely E"). In all three the estimate shows, no "No grade" text is visible, no horizontal overflow, no page errors. Not checked on the live site.

## Files
`prices/similar-v86.mjs` (maker, family, skeleton, weights), `prices/grade-ui-v85.mjs` (wording, `typicalMaker` figures), `prices/reader-v85.js` (passes the family), `src/worker/tail.js` (`catalogueSnapshot.family`), `tools/similar-validate.mjs` (maker scenario, family), `tools/coverage.mjs`, `qa/similar.test.mjs` (1 new test, floors for the maker figures), version 87.2.0, `sw.js`, `_worker.js`. 113 tests pass.

## Rollback
Revert the merge, or upload the 87.1.0 zip.
