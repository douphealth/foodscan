# FoodScan 82.0.0: confirm a product to see its prices, and a cleaner layout

Base: FoodScan 81.0.0 (main, 2 Nov 2026).

## 1. "Is it one of these?" when a barcode has no current price
Many products show no price because the price observatory never linked their barcode, even when it prices the same product in every chain. Linking by name alone was tested on the reviewed set and is only about 88-90 % right, so FoodScan does not do it automatically.

Instead, when a barcode has no current price, the card lists up to 4 products **of the same brand** from the price observatory (same pack size first, at least 45 % name similarity). Each one shows how many chains price it, the date, and an "other pack size" warning when the size differs from the label. Nothing is shown as this product's price until the shopper taps "This is it".

After confirming:
- The card shows that product's prices in each chain, with date, marked "Prices of the product you confirmed", with a "Change" button.
- The choice is stored only on this device (`foodscan:confirmed:v82`). The server takes it as `?pk=<id>` and adds those prices only if the barcode has no reviewed observatory link.
- If the confirmed product is sold in another pack size, its lowest price is shown with that size named ("Lowest price for 200 g") and a note that the label says something else. It is never ranked as this barcode's price.
- An old price (for example e-katanalotis from June) is still shown first, with its age, and the candidates are listed below it.

Data: new `o-00..o-63.json` shards (observatory products by id; FoodScan chain ids; at most 30 days old; outlier prices quarantined, the same rules as linked prices). The estimate shards gain a `k` field with the candidates.

## 2. Unit price for another pack size
A price for another pack size used to get its EUR/kg from this barcode's label size. It now uses the size actually sold.

## 3. Drinks scale explained
Under the drinks Nutri-Score (2023) only water gets A. A drink at score 0 or below (for example mmmMilk at -1) is B. The scale now says "water only" under A and explains this inside the scale.

## 4. Layout
- The share button can shrink; the Greek label is shortened to "Κοινοποίηση".
- "All prices" wraps inside the card on phones.
- The points box puts "against" and "for" on separate lines.
- Recommendation buttons sit in a full-width grid; the comparison prompt wraps under 520 px.
- The floating "better choice" pill is not shown on phones (the grade card already names the better choice). On wider screens it shows once, hides after 6 seconds or when the alternatives are reached, and does not come back.
- Pack sizes never break across lines.

## Not solved by this release
Public data covers only part of the catalogue. A product with no recorded price, and no same-brand candidate, shows none. FoodScan never guesses a price.

## Assets
Three chunks changed (grade scale, Greek dictionary, the floating pill). They and every file that imports them were copied under new `-v8200` names (33 files). The old files stay.

## Check
`node price-refresh/tools/verify-deploy.mjs https://<site> 82.0.0`
