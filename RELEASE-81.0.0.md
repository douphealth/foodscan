# FoodScan 81.0.0: no guessed prices, no grades built on broken data

Base: FoodScan 80.0.0 (main, 2 Nov 2026) plus the Prices 81 linker (PR #5). Checked against the three products in the 2 Nov screenshots.

## 1. No price is ever estimated
v80 showed an "Estimated shelf price" range (for example EUR 1.46-2.98, or EUR 5.40-22.33/kg) when a barcode had no recorded price. The range came from similar products and often had little to do with the product on the screen. It is removed everywhere: the price card, the product chips, the comparison table and the prices page. The server returns `estimate: null`, and the app ignores an estimate even if an older server sends one.

When a barcode has no recorded price, the card says so ("No supermarket price is on record for this exact barcode yet. FoodScan does not guess prices."). It may list up to 3 close products (same brand, similar name and size, at least 55 % similar) with **their own** recorded price, source and date, under the heading "Recorded prices of the closest products · not this product". Loose "same type" matches are never listed.

## 2. "See all N prices" separates current and older prices
mmmMilk 1.5 L showed "See all 7 prices" with 2 current prices and 5 June prices from e-katanalotis. The link now reads "All prices · 2 current, 5 older".

## 3. Grades built on a broken salt value are withheld
Karamolegkos Πολύσπορο 500 g (5201673101314) showed grade A. The label says salt 1.33 g per 100 g; the source record says 0.0033 g, a unit mistake. With the real value the grade is C. A new check withholds the grade when a food that is always salted (bread, cheese, cured meat, olives, crisps and salty snacks, pizza) has under 0.05 g salt per 100 g, and says why. Unsalted products, pasta, seeds, flours, sweet bakery and "0 % salt" products are excluded.

Across the 12,137-product catalogue this changes 26 grades, all to "withheld": for example Edam 0 g, Gouda 0.005 g, Doritos 0 g, Kefalotyri 0.01 g. No other grade changes.

## 4. The grade note is readable
On green (A) cards the note under the grade inherited white text on a light panel. It now uses dark text on every grade colour.

## Not solved by this release
- Public data covers only part of the catalogue: about 17 % of products have a current Greek price. A product with no recorded price shows none, and no guess.
- Lidl's web price for mmmMilk (EUR 2.07) is a promotion according to the price observatory, but lidl.gr marks no promotion and the barcode is not linked to its observatory record. It is shown as Lidl's current web price, with its date.

## Assets
The grade module and the Greek dictionary changed. Because `/assets/*` is cached for a year, both files and every file that imports them were copied under new `-v8100` names (36 files). The old files stay, so a tab left open on 80.0.0 still works.

## Check
`node price-refresh/tools/verify-deploy.mjs https://<site> 81.0.0`
