# FoodScan 87.1.0: no more "No grade" when one number is missing, and no "No grade" left under an estimate

Base: FoodScan 87.0.0 (`main`, 84452bc). Built after the owner's screenshot of "Orange" (5201005001824): "No grade, a confirmed food category and per-100-g basis are needed", with energy, sugars, saturates and fibre on record.

## Two defects, both fixed
1. **The similar-products step was skipped when one number was missing.** The Open Food Facts record has no salt and no category. The quick grade bounds a missing salt (0 to 3 g), which leaves A to D, and reports "too uncertain". The page then only asked similar products which Nutri-Score table to use; when that gave no clear answer it stopped, and never borrowed the missing number from similar products (86's step, which was only reached when two or more numbers were missing). Now it does (`prices/reader-v85.js`, `loadQuick`). This product now shows **Most likely E (C to E)**, the drinks table, salt borrowed from the 25 most similar products (orange, apple and carrot juices).
2. **The old "No grade" block stayed visible under every estimate on product pages.** `ui-v80.css` (`.report .hero:not(.hero--none) .snip__core{display:grid}`) is as specific as the rule in `prices/reader-v85.css` that hides that block and loads later, so it won. The hide rule is now `!important`; a test pins it. This affected every quick-grade and similar-products card on product pages since 85.

## Measured (leave-one-out, twins removed, on the 4,103 graded Greek products: one number hidden, category removed, through the page's own order; `node tools/similar-validate.mjs`)
| missing | reach this step | get an estimate | published letter inside the band | "most likely" exact |
|---|---|---|---|---|
| salt | 1,776 | 1,471 | 87.4 % | 70.4 % |
| sugars | 869 | 786 | 87.8 % | 73.0 % |
| saturates | 563 | 519 | 83.8 % | 67.6 % |
| energy | 3,813 | 3,509 | 90.3 % | 84.4 % |
The card prints its own figures for one borrowed number: **83 % inside, 67 % exact** (floors of the lowest row). `qa/similar.test.mjs` fails if a printed figure exceeds a measured one. The card's wording now agrees with the count ("The value for salt was borrowed", "Το στοιχείο που λείπει (αλάτι) δανείστηκε").

## Coverage of the bundled Greek catalogue (`node tools/coverage.mjs`, 12,137 products)
| | 86 / 87.0 | 87.1 |
|---|---|---|
| missing numbers borrowed from similar products | 684 | 1,209 |
| some grade or an explanation | 9,460 (77.9 %) | **9,985 (82.3 %)** |
| nothing but the label photo | 2,677 | 2,152 |

## Checked in the real app
The real `_worker.js` run locally with the live Open Food Facts record, Chromium, English at 1440 px and Greek at 390 px: the estimate shows, no "No grade" text is visible anywhere in the card, no horizontal overflow, no page errors. Not checked on the live site (the sandbox cannot reach it).

## Files
`prices/reader-v85.js` (the missing step), `prices/reader-v85.css` (hide rule), `prices/grade-ui-v85.mjs` (one-missing figures and wording), `tools/similar-validate.mjs` (`validateOneMissing`), `tools/coverage.mjs` (same order as the page), `qa/similar.test.mjs` (2 tests), version strings 87.1.0, `sw.js` (new cache name so phones fetch the changed files), `_worker.js` (version only). 112 tests pass.

## Rollback
Revert the merge, or upload the 87.0.0 zip.
