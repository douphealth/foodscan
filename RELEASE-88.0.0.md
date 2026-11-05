# FoodScan 88.0.0: Prices inside the app's design, and a healthier swap for most products

Base: FoodScan 87.2.0 (`main`, 4f2bf3b). Built after the owner's request: the Prices section must look like Home, Search, Choices and Me, not like another app; every product should come with a healthier product of the same kind; more products should be helped.

## 1. Prices, in the app's own design
`/prices/` was a separate page with its own light theme, its own header and no bottom navigation. Now (`prices/prices-app-v88.css`, loaded last; `prices/index.html`):
- the app's design tokens, both themes, copied value for value from the app stylesheet: cream `#F4EFE2` in light mode, `#050F0A` in dark mode, the same surfaces, ink, mint accent, display type, radii and shadows; the page follows the phone's light or dark setting exactly like the app (theme colour per scheme, `color-scheme: light dark`);
- the app's dock on phones (Home, Search, scan, Choices, **Prices** marked as the current tab, Me), and the app's navigation in the top bar on desktop; English and Greek labels as in the app;
- every element the page can show re-skinned: search box, price-area switch, the "Price in Greece" card, typical price, statistics, warnings, the per-shop offers (the cheapest highlighted), the chain grid, sources, the basket, the add-a-price sheet, notes, toast. An automated scan of all visible elements in the empty, result, detail and basket states found 65 light-themed elements before and none left after (the remaining flags are the mint buttons and pills with dark ink, as in the app);
- no content or behaviour changed: all the prices of 80 to 87 (observatory via price linking, Bazaar, Lidl, e-katanalotis history, Open Prices with the daily snapshot) are shown exactly as before.

## 2. Healthier swaps on the product page
Before: alternatives were looked up only by the product's Open Food Facts category, in one market. Real pages showed "No comparison available" (a Papadopoulos biscuit, about E), "No higher grade found, 1 record assessed" (Caprice wafer rolls, E) or asked the shopper to pick a category (an orange juice with none).

Now (`prices/swaps-v88.mjs`, `prices/swaps-ui-v88.js`, `prices/swaps-v88.css`, index `assets/swaps-off-csv-2026-10-30.json` built by `tools/build-swaps.mjs`):
- candidates: the 4,938 products of the Greek catalogue with a grade FoodScan can stand behind (3,881 published, 1,057 calculated from their own complete numbers with the table settled);
- same kind of product: shared category tags (rare tags weigh more), the same PNNS group, a similar name (Greek and Greeklish count as the same), the same catalogue family, and **always the same Nutri-Score table** (a drink is never offered for a food). A record with no category borrows its shelf from the products named most like it, and the card says so;
- strictly better: better than the published grade, or, for a product with only an estimate, better than the **best** letter the estimate allows; the table is the grade card's own (an orange juice estimated as a drink gets juices, not orange biscuits);
- each swap shows its photo, name, brand, grade (published or calculated by FoodScan), how many grades better, and "same shelf" or "same aisle"; the healthiest first; "How swaps are chosen" explains the method and the measured reliability;
- the app's own comparison card is folded away when it found nothing; it stays when it lists products of its own.

### Measured (`node tools/swaps-validate.mjs`; 3,037 graded Greek products whose categories name a real shelf)
| | gets a healthier swap | swaps shown in the same aisle | on the same narrow shelf | average improvement |
|---|---|---|---|---|
| category on record | **88.9 %** | **89.4 %** | 75.7 % | 1.9 grades |
| no category (shelf inferred from the name) | 62.4 % | 70.0 % | 56.1 % | 1.8 grades |
"Same shelf" labels are right 85.9 % of the time. The card prints 89 / 75 and 70 / 56; `qa/swaps.test.mjs` fails if a printed figure exceeds a measurement. Aisle = the product's most specific category with at least 30 products (e.g. biscuits); shelf = with at least 8 (e.g. chocolate stuffed wafers).

## 3. The 1,649 products with no grade
They still have no grade: their records have no numbers and nothing similar enough to estimate one credibly (see 87.2). What changes is that **782 of them (47 %) now get the best-graded products of the same shelf**, so the shopper still gets a healthier choice (e.g. a barley rusk with no grade is shown three A-graded barley rusks). The card says the comparison is not against this product's grade. Known limit: when the shelf has to be inferred from a short name, a swap can be the wrong kind of product (seen: a protein powder offered a chocolate dessert); those cards carry the "check that a swap is the same kind of product" note.

## Also in this release
The daily price job ran with the Open Prices step (run 8, 5 Nov): `prices-data/op/` is published, 41,080 barcodes and 57,672 prices, newest 4 Nov 22:57 UTC.

## Checked
Real `_worker.js` locally, Chromium, phone 390 px and desktop 1440 px, light and dark, English and Greek: the Prices page (empty, a product with 10 chain prices, basket) and the swaps card on four products; no horizontal overflow, no page errors. 119 tests pass; `node build.mjs --check` OK. Product photos could not be loaded in the sandbox (no access to the image host); a photo that fails shows the leaf tile. Not checked on the live site.

## Rollback
Revert the merge. Partial: remove `prices-app-v88.css` and the dock from `prices/index.html` (Prices returns to its old look), or remove `swaps-ui-v88.js` / `swaps-v88.css` from `index.html` (the swaps card disappears and the app's comparison card shows as before).
