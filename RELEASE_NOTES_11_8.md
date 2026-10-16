# FoodScan 11.8.0 — clarity-first presentation rebuild

- New scan-first homepage without empty calorie panels. Returning diary totals shown only when entries exist.
- New product report combines product identity, key finding, declared allergens and four reported nutrient tiles.
- Decorative macro rings removed; actual values and threshold labels shown instead.
- Existing portion calculator placed immediately after the report; complete source label remains available.
- Original 11.3 engine retained for functionality; its stylesheet is isolated in a named cascade layer. No 11.5–11.7 presentation imports and no automatic surface-repair script.
- New 11.8 module entry points, displayed VERSION, import-map CSP hash and offline cache. Backend API worker is unchanged.
- Chromium local component tests passed at 390px and 1280px: no horizontal overflow, one H1, scan/search hooks present, four result metrics and portion ordering correct.
- Isolated escaping, conflict withholding and eligibility fallback tests passed. Fixture dependencies and hostile legacy CSS were used, not the deployed complete application. Camera, real network lookup, legacy-page integration and actual live appearance still require validation.
- Local preview screenshots use a crop of the supplied product screenshot and an illustrative image placeholder; the app uses the actual product image and existing produce asset.
- Rollback by reverting the release commit. Requires browser import maps and CSS cascade layers.
