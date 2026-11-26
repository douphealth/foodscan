# FoodScan 103.0.0

A second audit of the live 102.1.0, this time by measurement: every one of the 12,137 products in the bundled catalogue was run through the grade
engine, and 3,128 bundled barcodes were run through the price service offline. This release fixes what that found.

Nothing here invents a grade or a price. Every correction is the published Nutri-Score 2023 rule applied to values the record itself carries, and the
card always names the letter the source published.

## Grades

| # | What was wrong | What 103 does | How many (bundled catalogue) |
|---|---|---|---|
| 1 | **Drinks graded as solid foods.** Open Food Facts picks the drinks table from its English category tags. A record whose category is free text ("el:Αναψυκτικά", "el:Χυμός") or missing was scored with the table for solid foods: a soda at B, a sweetened iced tea at A. Under the 2023 rules only water is A among drinks. | A record counts as a drink only when its values are per 100 ml (declared, or a volume on the pack) AND its name or a category names a drink, and nothing names a liquid food (sauce, soup, cream, oil, vinegar, syrup) or alcohol. Then the drinks table is applied. One possible letter: shown as "Calculated by FoodScan", with the published letter named. Several possible letters (fruit share or sweeteners not on record): no single letter is claimed, the range is shown. | 33 drinks: 17 get one letter (for example A→C, B→E), 16 get a range |
| 2 | **Sweeteners left out of the points.** Open Food Facts finds sweeteners with its ingredient parser, which reads few Greek lists. A zero-sugar cola then keeps B (0 points); the rules add 4 points for any intense sweetener, which gives C. | Recalculated only when ALL hold: a drink by the source's own category, values per 100 ml, sweeteners on the record (named in the ingredient list, an additive tag, or the source's own category "artificially sweetened beverages"), the published points equal the drinks-table points without the sweetener component, and the letter changes. | 28 drinks: B→C 17, C→D 7, C→E 2, D→E 2 (22 by ingredient list, 6 by category). Pepsi Max, Lipton zero, Vikos Cola zero: B→C |
| 3 | **Sweetener detection.** "γλυκαντικό συμπύκνωμα από χυμό μήλου" (apple concentrate used to sweeten), "without sweeteners" and "χωρίς ασπαρτάμη" were counted as sweeteners; polyols (erythritol, xylitol) too, which the Nutri-Score list does not include; Greek names (στεβιόλη, σακχαρίνη, κυκλαμικό) and E numbers in the text were missed. | Counted: the intense sweeteners on the Nutri-Score list, by name or E number. Not counted: polyols, negated mentions, sweetening fruit concentrates. The bare word "sweeteners" with none named is "unknown", not zero. | |
| 4 | **Pure juices.** The source's fruit share is an estimate from the ingredient list and reads 0 when that list is missing. | A name that states a pure juice ("100 % juice", "Φυσικός χυμός") fixes the fruit share at 100 and the sweeteners at none (the law allows none in a fruit juice). The card says the share was read from the name. A nectar or "juice drink" is not a pure juice. | |
| 5 | **Swaps offered products the app itself holds back.** The swap index took any published letter, including records with impossible values or a letter that contradicts its points ("vikos pink": 11 g sugars, filed as water, A). | A product whose grade is held back on its own page never enters the swap index. Drinks from rows 1 and 2 enter with the recalculated letter, or not at all. | 4,938 → 4,789 swap rows (137 held-back products removed, 12 drinks with only a range) |
| 6 | **The grade card for a recalculated drink** said "because the source has no grade for this product" and showed the solid-food scale. | It says what was recalculated and why, shows the drinks scale, and the caveat names the published letter. Translated in Greek, German, Spanish, French and Italian. | |
| 7 | **Quick-grade card:** the sweetener tile read `non_nutritive_sweeteners · 0 number`. | "Sweeteners · None listed / On the ingredient list". | |

The quick grade (the estimate for products with no published grade) was re-measured against Open Food Facts' own letters with the 61 wrong reference
letters above left out: 4,042 products; a single letter is right 95.6 % of the time; the published letter is inside a two-letter band 96.8 % of the time.
Drinks recognised by unit and name ("evidence") are rated medium, not high: 96.4 % inside, 89.1 % exact (n 220).

## Prices

| # | What was wrong | What 103 does |
|---|---|---|
| 8 | **Dead proof link.** Every government-observatory price linked to `.../data//posokanei-.json` (the date was missing from the address). | The link is rebuilt from the snapshot date; the daily refresh writes it correctly; the bundled seed is fixed. |
| 9 | **Price without a unit price.** When Open Food Facts has no pack size, no €/kg or €/l was shown even where the shop's own listing of that barcode states the size. | That shop's price gets a unit price from its own listed size, when the shop item has one barcode and the result is a plausible food price (€0.08 to €150 per kg or litre). Nothing is assumed for other stores. In the first sweep of 2,472 barcodes, products with a price but no unit price fell from 1,572 to 750. |
| 10 | **"330 ml x 6" read as one can**, so a six-pack showed six times the real price per litre. | The count after the size is read ("330 ml x 6", "1,5 lt x 6", "10gr x 200τμχ"). |
| 11 | **Capacities read as contents.** Bin bags "25l", paper cups "250ml 50τμχ", a bin "10Lt", a flowerpot saucer got a price per litre. | No unit price for an item that is a container, or whose title carries dimensions. |
| 12 | **A portion typed as the pack.** A box of 12 stock cubes recorded as "10 g" gave €269/kg. | A label size under 50 g/ml that no shop or observatory record confirms, and that would put every recorded price above €150 per kg or litre, gives no unit price. |
| 13 | **Old outliers.** A €0.40 entry from June for a 6 x 1.5 l pack that sells at €2.40 to €3.48 was listed as an older price at €0.04/l. | Old prices are checked against what the other stores record today too; an outlier is marked and never ranks. |

## Delivery

- **New asset generation.** `/assets/*` is served `immutable` for a year, and 102.1.0 is live, so a changed engine file under its old name would never
  reach a returning visitor whose browser has no service worker (and would break pages that import a new function from the old cached file). All 49
  versioned files are renamed `-v101` → `-v103`; the three rebuilt index files are requested with `?v=103`.
- The three grade indexes (similar products, swaps, list estimates) are rebuilt with the corrected engine.

## Checks

- `qa/audit103.test.mjs`: 20 new tests. Full suite: 255 of 255 (the 235 of 102.1.0 plus these 20).
- Two printed reliability figures were lowered to what the rebuilt swap index measures (the tests that guard them failed first): "same aisle" for
  products with no category 70 → 69 %, "same shelf" 56 → 55 %, and the category estimate's "inside the band" 90 → 88 %.
- Browser (desktop pane, local copy of the release against live Open Food Facts): Coca-Cola E; Vikos cool tea A→C with the drinks scale; Vikos Cola zero
  B→C with the sweetener wording; a 1.5 % milk published A shown as "most likely B, between B and C"; no failed requests after the rename.

## What this release cannot do

- A wrong number in Open Food Facts that still looks plausible is not detectable.
- A drink with sweeteners that the record shows nowhere (no ingredient list, no additive tag, no category) keeps its published letter.
- 7,961 of the 12,137 catalogue products have no published grade; 2,408 of those have no nutrition numbers at all and can only be graded from a label photo.
- Prices outside Greece come from Open Prices, a community database that is sparse in most countries.
- Unit prices from a shop's own listing describe that shop's item; stores without a listed size still show the pack price only.
- The German, Spanish, French and Italian sentences are hand-written and have not been read by a native speaker.
- A tab left open on 102.1.0 keeps the old file names; it needs one reload after the update (as with every earlier asset generation).
- The zip (`FoodScan-103.0.0-Cloudflare-Pages.zip`, 286 files) was run in Cloudflare's local runtime: `verify-deploy.mjs` passes, the observatory proof
  link answers 200. Not tried on real Cloudflare or on a real phone.
