# FoodScan 11.13.0 — meaningful alternatives and classification redesign

## Alternatives recovery
- Preserved the server's 11.12 category/country compatibility fix and both original provider routes.
- On **transient proxy failure**, the browser attempts a bounded, no-credentials public Open Food Facts category request (search index and legacy endpoint). It does **not** bypass explicit rate limits, access refusals, or user cancellation.
- Previously retrieved, complete same-category records are shown immediately when available, while live search refreshes in the background.
- Incomplete index hits remain flagged as previews; FoodScan retains the original dietary/allergen eligibility rules.
- If neither provider nor local records can support suggestions, **Compare this food side by side** preselects the actual product, and a verified Open Food Facts category link provides a meaningful alternative to endless retries.
- Technical provider errors are available in an expandable disclosure, not the primary action.
- The search provider must be reachable and support browser CORS for automatic live recovery; no unconditional live-provider success is claimed.

## Premium source classifications
- Replaced the bare grade numbers beside the product photo with an accessible Nutri-Score A–E ramp and NOVA 1–4 ramp, distinctive selected markers, plain-language descriptions, and verified high-nutrient signals where available.
- Badges are **dynamic and source-reported**, never hard-coded to Nutella. Unknown data stays unknown; no medical or food-safety rating is inferred.
- Responsive layout at narrow mobile widths, brand-consistent light/dark themes, contrast-conscious typography and tap targets.

## Delivery
- Versioned 11.13 frontend assets and cache shell; no new dependencies, tracking, accounts or credentials.
- Preserve the previous 11.12 files as the rollback target; revert the commit to restore it.
- Source-level regression and real Chromium checks are required before production readiness can be declared.
