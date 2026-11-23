# FoodScan 98.1.0: the owner's 98.0.0 daily hub reviewed and fixed, and a price refresh that no longer stops when a source pauses

Base: FoodScan 97.1.0 (`main`, live). The owner sent a 98.0.0 build (Daily Pulse and Kitchen Hub, data-confidence card, compare tray). It was built on 97.0.0, so it was not copied over `main`: its own files were reviewed, tested against real catalogue records and carried over on top of 97.1.0, which keeps the corrected Nutri-Score 2023 tables.

## From 98.0.0, kept
- **Broken import fixed** (`fridge-core.mjs` pointed at `assets/domain-v8100.mjs`, which does not exist; it now uses `domain-v8500.mjs`). This restores the 7-discovery challenge, the product-page discovery widget and the shelf metrics.
- **Daily hub on Home** (`daily-v98.js`, `daily-v98-core.mjs`, `daily-v98.css`): one-tap check-in from recent foods, streak, saved foods graded A or B, "My Lens" (low sugar, high protein, low salt, high fibre, less processed), local backup and restore. English and Greek, light and dark. Everything stays in the browser's localStorage; nothing is sent anywhere.
- **Data card on every product page**: energy check, 8-field label completeness, NOVA context and lens badges.
- **Compare tray**: pin up to 3 products and compare sugar, protein, fibre, salt and calories side by side.
- Service worker cache bumped (`foodscan-98.1.0`) so installed phones update; the new files are excluded from `_worker.js` (`_routes.json`) and have cache headers (`_headers`).

## From 98.0.0, changed after measuring on the real catalogue
- **The data card used the wrong field names**: `p.ingredients` is a string in the app's engine, so the draft reported "Missing: ingredients" on every product that has them. It now uses the engine's own product shape.
- **Energy check**: uses the EU energy factors (carbohydrates 4, protein 4, fat 9, fibre 2 kcal/g) so high-fibre foods are not called wrong; alcoholic drinks and products whose ingredients list sugar alcohols are skipped, not flagged; a soft drink tagged non-alcoholic is not skipped. Measured on real records in `qa/daily98.test.mjs`.
- **"Needs checking"** is shown only when the app's own data-quality state says so, not from a separate rule that could disagree with the grade.
- **Teaspoons** are labelled "per 100 g of the foods you logged, not your intake" (the draft implied intake). On Home the salt figure is per 100 g of the foods logged with "WHO: under 5 g salt a day" beside it, not a percentage of the shopper's own day (the draft showed an average percentage of the WHO limit). On a product page "x % of the WHO limit" stays, worded for 100 g of that product.
- **Lenses** use the EU nutrition-claim thresholds, with the stricter limit for drinks.
- **No idle redraws**: the hub renders only when something changed (the draft re-rendered itself continuously), uses the app's own engine instance, and the compare dialog closes with Escape and returns focus.
- **Phone layout**: the tray is a pill above the dock, the hub is shorter, details sit behind a "My Lens and backup" disclosure.
- 9 new tests in `qa/daily98.test.mjs`: lenses, energy check (4 cases), data card, streak, day averages, backup, wiring.

## Prices: why a price is missing, and what changed
- **Measured on the bundled 12,137-product Greek catalogue**: 20.4 % have a recorded price from at least one source (Bazaar, e-katanalotis, Lidl, observatory); 79.6 % have none, because no public source records a price for them. The app shows "No verified price" for those, never a guess. Grades: 33.2 % published, 30.6 % calculated from the product's own numbers, 20.9 % an explained estimate from similar products, 2.9 % not rated by the method, 12.4 % need a label photo.
- **The daily refresh no longer stops when the observatory archive pauses.** The third-party archive stopped on 18 Nov 2026; the refresh took its newest snapshot of the last 45 days (was 6) and keeps its true date, so Bazaar, Lidl and Open Prices still update. A stale snapshot is reported as a warning on the run page, and the app already shows a price older than 7 days as "last recorded price" with its age (`price-refresh/refresh/src/snapshot-day.mjs`).
- **The ministry file (e-katanalotis, about 1,200 catalogue products) is frozen**: its Last-Modified header is 16 Jun 2026, and that is the date shown. The refresh now checks the header every day and raises a warning the day the ministry publishes again, so the old date cannot stay unnoticed.
- The refresh tools and tests now run on Windows (paths built with `fileURLToPath`, not `URL.pathname`).

## Checks
`node --test qa/*.test.mjs`; `node build.mjs --check` (23 modules rebuild `_worker.js` exactly); `node price-refresh/tools/verify-deploy.mjs <site> 98.1.0` after a deploy.

## Limits
- Prices are real only where a source recorded them. 98.1.0 adds no estimate and no price source.
- The hub, tray and data card were tested in a desktop browser at phone widths in English and Greek, not on a phone camera or a real phone.
- Auto-update of the live site happens when Cloudflare builds this commit from `main`; until then the live site stays on 97.1.0.
