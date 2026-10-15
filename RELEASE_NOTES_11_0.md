# FoodScan 11.0.0 — Clarity Studio Release Notes

## High-impact changes

| Surface | Previous friction | Implementation |
|---|---|---|
| Homepage | Busy presentation and too many competing calls to action | Calm dark-green scan hero, clear camera/photo entry, one name/barcode search, mobile-first spacing |
| Result conclusion | Generic, animated presentation with crucial facts buried lower down | A simple source-backed verdict, declared allergens and per-100 nutrition visible within the opening hero, two-item evidence summary immediately below |
| Full report | Long nutrition, ingredients and source report collapsed behind accordions | All sections visible directly and linked from a compact report index |
| Ingredients as reported | Dense unbroken copy, easy to misread | Numbered, source-order ingredient items and original text kept verbatim for checking; percentages shown only when present in source |
| Amount consumed | Duplicate sliders and separate meal entry field | Single large editable quantity, decrement/increment, serving/50/100/200 presets, live calories/protein/fiber; calibrated based on the recorded per-100 g/ml basis |
| Mobile readability | Inconsistent cards, spacing, shadows and responsive formatting | Consistent surfaces, type hierarchy, minimum touch areas, 320–1440 responsive breakpoints and dark mode |

## Accuracy and safety

- Existing allergen/profile hard gate is retained. Restricted products are withheld before rendering sensitive details or providing a logging call to action.
- Nutrition conflicts/missing values never become zero. Calculations are explicitly based on reported data and user-confirmed amount.
- Ingredient list is for readability, not chemical decomposition or evidence of nutritional benefit. Exact supplied source text remains directly visible.
- Record completeness, sourced timestamps and Open Food Facts links remain visible. Ingredient or allergen absence never implies guaranteed safety.
- No new tracking provider, AI model, external API key or checkout flow. No unsupported performance or retention claims.

## Validation and known limitations

- JavaScript syntax checks passed for all 30 JavaScript files; all 38 service-worker pre-cache paths resolve to files in the package.
- Local Node tests passed for output sections, ingredient escaping, allergen hard gating, missing-nutrient handling, serving calculations, clickable quantity presets and Worker health/error/origin protection.
- Screenshots of the actual rendered component markup passed viewport checks at 320px, 390px, and 1440px with no horizontal scrolling, including a dark-theme smoke check.
- Browser-driven *static markup* preview checks at 320 px, 390 px and 1440 px confirm no horizontal overflow and check report/navigation structure; this is not a live Cloudflare or device integration test.
- The Chromium environment blocks localhost navigation, so live interaction/browser E2E and camera cannot be verified here.
- Run real smartphone, Cloudflare Worker, Open Food Facts network, offline update and accessibility assistive-tech checks on staging before replacing production.

## Staging and rollback

1. Keep the 10.9.0 Pages build/deployment as a rollback.
2. Direct-upload the flattened ZIP to a separate Cloudflare Pages staging project.
3. Confirm `/api/health` includes `version: 11.0.0`.
4. Verify five scenarios: first visit, actual barcode, long multilingual ingredient list, an allergen-restricted profile, and changing/adding a consumed amount.
5. Promote after those pass. To roll back, redeploy 10.9.0 and hard-refresh/reopen the installed PWA to activate the earlier service worker cache.
