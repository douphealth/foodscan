# FoodScan 64.0.0 — Qualified Evidence

Cloudflare Pages Direct Upload, as before: upload the ZIP as a new deployment (staging first). No new binding, migration or paid service; saved foods and history are untouched. `/api/health` must report `version 64.0.0`, `catalogue.status ready`, `catalogue.products 12137`. Installed apps show the "new version" bar; accept it, then reopen.

This release answers the independent audit of 63.0.0. Its first finding was right: the product-use matching still offered things that are not alternatives.

## What changed

**Better choices: a product must be the same use, not just look similar (audit P0-1)**
- The three audited pairs are rejected: iced tea vs a whey-protein powder with an iced-tea flavour (a supplement), a prepared salad vs green beans in tomato sauce, plant-based burgers vs plain tofu.
- Supplements (whey, isolates, creatine, capsules, "dietary supplement" in any language) are never swapped with foods or drinks; protein *bars* and collagen *cookies* stay snack foods.
- What a product is comes from its head noun, not its qualifiers ("with dressing", "in tomato sauce", "με σάλτσα"). Plant protein is split by form (tofu, tempeh, seitan, burger, sausage, nuggets, mince, deli slices).
- A defect found while writing the variants: since 62.0.0 every sauce collapsed into one type, so ketchup, mustard and mayonnaise were interchangeable. Fixed.
- Replay of the 260 pairs the 63.0.0 packet offered: **39 are no longer offered** (16 different use, 2 supplements, 1 unconfirmed use, 20 whose grades are not comparable evidence).

**Grades say how well they are evidenced (audit P0-2)**
Open Food Facts counts a missing fibre, protein or fruit-veg value as 0 points. Matching the published points that way is evidence, not verification. Every point-reproduced grade now carries a tier: *complete-input* (nothing assumed), *robust-to-missing-inputs* (the letter is the same for every value physics and the ingredient list allow) or *partial-input agreement* (the letter could differ). Only the first two are comparable; the third is shown as the source's own grade with the reason, and never supports a "higher grade" claim. Of the 4,170 graded records in the 29 Oct snapshot: 1,327 complete, 969 robust, 1,188 partial, 555 source-only, 131 withheld. A dated copy whose letter merely agrees with an estimate is no longer treated as verified. Golden fixtures: 133 real Open Food Facts records (water, drinks, cheese, fats/oils/nuts/seeds, red meat, ordinary foods) with the source's own component points; the calculator matches them component by component. That check exposed a gap: olive, rapeseed and walnut oil count as 100% fruit/vegetable/legume at the source; added (33 of 35 Greek olive oils are now comparable).

**The refresh pipeline has run on the real export (audit P0-3)**
On 30 Oct 2026 the official export (1.4 GB, 4,883,884 rows) was built in 1 min 52 s into 12,137 Greece-listed products. The first real run found that the real CSV names two columns differently (`allergens`, `image_url`/`image_small_url`): the 63.0.0 builder would have dropped allergens and photos. Fixed, and the rehearsal test now uses the real names. `tools/verify-catalogue.mjs` gates a catalogue (hashes, duplicates, barcodes, market, indexes, quarantine share, product-count change, snapshot age); `tools/promote-catalogue.mjs` adopts a verified one atomically and `--rollback` restores the previous configuration; families are inherited from the catalogue being replaced so a refresh cannot reshuffle shards. This release ships that refreshed catalogue (+24 products, 69 records changed in the day since the previous export). The app staged with it passes all 16 browser tests.

**Honest coverage (audit P1-5)** `release-qa/coverage.md`: of 12,137 records, 93% have a name, 49% categories, 29% ingredients, 59% full nutrition, 34% a source grade and only 19% a grade strong enough to compare.

**Also** `/api/sync` stays dormant; Greek translations for the new messages; the Fridge Challenge, shared links and reports still use one engine.

## Not done
Route-level loading and real-phone INP/LCP (the v61 chunks have no source); privacy-safe funnel validation against production Search Console and analytics; a signed, scheduled production refresh with alerting (the monthly job builds an artifact only); the shopping-decision workspace; independent human adjudication of the review packet (260 new pairs ready); licensed Greek availability feeds.

## Rollback
Deployments → promote the previous deployment (63.0.0, 62.0.0 or 61.0.0). No schema or stored-data change. To ship the previous catalogue from source: `node tools/promote-catalogue.mjs --rollback`, then rebuild.
