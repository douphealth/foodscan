# FoodScan 11.1.0 - Insight Release

Release date: 2026-10-14
Platform: Cloudflare Pages Direct Upload (advanced-mode `_worker.js`)
Source: user's FoodScan 11.0.0 release. This archive is the entire deployable app, not a UI mockup.

## Shipped

1. Precision ingredient parser (`assets/release-11.1.0/lib/ingredient-parser.js`): protects decimal commas such as `7,4%`, bracketed ingredient lists, semicolon separators, and source ordering. Supports English reading hints and role labels without inventing quantity percentages. Preserves the original, escaped label transcription and provides an explicit statement for separately reported claims.
2. First-screen result: actual product identity; evidence-led conclusion; reported Nutri-Score and NOVA, when provided; four UK-style per-100 nutrition traffic lights; primary links to ingredient details, consumed quantity, and sharing. Unknown or internally conflicting values remain unknown. Safety decisions and personal hard-restriction gating are preserved.
3. Ingredients: source-order numbered cards, only actual printed percentages and actual reported allergens, high-contrast category cues, full unedited transcription, and explanations that ingredient categories do not prove allergen safety. Percentage bars represent ONLY source-declared percentages; no relative guesses for unquantified ingredients.
4. Unified consumed amount: starts with a compatible source-reported serving, otherwise a clearly labeled 100 g/ml calculation starting point; stepper, range input, and quick presets; complete known totals for calories, sugars, saturated fat, fat, carbohydrates, protein, fiber and salt. Very small amounts such as 0.02 g salt remain visible. Underlying nutrient calculations are derived from the actual source per-100 values. Contradictions are suppressed; missing values are never silently replaced with zeros or Nutella constants.
5. Sugar display: grams plus approximate teaspoons equivalent using 4 g per teaspoon. This is an equivalence of total sugars, not an assertion of added or free sugar. A logged-food summary compares known total sugars with the EU adult reference intake of 90 g only; it never calls the WHO 25 g free-sugars goal a total-sugars limit.
6. Homepage: put scan/search before the explanatory heading on phone layouts, consolidate camera and photo entry, add 3 live sample lookup buttons (product availability not guaranteed), show calorie/total-sugar progress rings when the user has logged foods, including missing-data counts. Existing recent report cards retain reported Nutri-Score/NOVA and nutrient chips.
7. Visual: add responsive 12-column result bento, consistent spacing, stronger foreground/background contrast, explicit dark theme colors, 320 px+ responsive breakpoints and reduced-motion preference.
8. Release integrity: versioned 11.1.0 module assets, `/demo/` corrected from broken 9.0.0 links, release-scoped immutable CSS/JS paths, service-worker pre-cache version, health endpoint version.

## Verification done locally

- JavaScript syntax for worker, service worker and the full frontend module tree.
- 15 logic/render checks for European decimal commas, nested ingredients, percentage fidelity, escaped label text, all known portion nutrients, small salt, missing data, source conflicts, 100g baseline, safety route, first-screen conclusion and homepage sample actions.
- Returning-user meal diary/ring state check with a mixture of known and unknown nutrition.
- Cloudflare Worker local route responses: `/api/health` 200 with version 11.1.0; malformed barcode 400; nonexistent route 404; cross-origin API read 403.
- Real frontend module-generated markup rendered into isolated Chromium HTML previews at 320 px, 390 px and 1440 px, both light and dark, without horizontal overflow. These previews use illustrative fixture data, NOT results fetched live from Open Food Facts.
- ZIP CRC and all linked release asset paths checked.

## Not verified

- End-to-end browser navigation in this environment: Chromium administrator policies blocked all navigations including localhost. Isolated HTML rendering is NOT a successful end-to-end camera or API test.
- Real camera scanning, network performance on mobile data, live Open Food Facts responses, installed-PWA upgrade/offline behavior, merchant outbound clicks, and Cloudflare Pages production deployment must be verified in staging.
- No basis for guaranteed traffic, revenue, improvement multiplier, health outcome, or sub-second load claims.

## How to deploy safely

1. Retain the original FoodScan 11.0.0 ZIP, and preferably export current Cloudflare Pages deployment state.
2. Deploy this archive with all files at the root of a Cloudflare Pages STAGING project. No build step. Keep `_worker.js`, `_routes.json`, `_headers`, `sw.js`, `index.html`, and `assets/` at the site root.
3. Confirm `GET /api/health` returns a JSON version of `11.1.0`. Confirm the app loads `assets/release-11.1.0/insight.css` and `lib/ingredient-parser.js` without 404s.
4. Test on an actual iOS and Android phone: camera denied/allowed, three live barcodes, incomplete OFF record, foreign decimal ingredient label (including 7,4%), restriction exclusion, size presets and slider, logging to the diary, total sugars display and offline revisit.
5. Test the `/demo/` route and dark theme. Check CSP/security headers after Cloudflare upload.
6. Promote only after staging tests pass. Rollback by redeploying the unmodified FoodScan 11.0.0 ZIP; preserve user local data under the existing localStorage keys.

## Security and nutrition cautions

This tool cannot independently verify allergens or medical safety. Ingredient role tags are reading aids, not diagnoses. Data is community supplied, potentially stale or incomplete. Source categories, Nutri-Score and NOVA values are only shown when available. Source claims must be checked against actual packaging. Portion amounts are arithmetic based on stated values, not precise measurements of consumption. Cloudflare PWA caching does not cache profile/diary/API data in the app shell. No secrets, API credentials or new analytics defaults were added.
