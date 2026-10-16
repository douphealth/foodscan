# FoodScan 11.14.1 — circular macronutrient cards restored

## Intent
Restore the requested Protein / Fat / Carbs circular card treatment from the previous report screenshot while retaining FoodScan 11.14.0's complete layout, portion calculator, safe comparisons and report hierarchy.

## Changes
- Re-enabled the original source-data-backed SVG rings that were already rendered but hidden by 11.14.0 CSS.
- Kept all three cards in a responsive three-column row; cards and ring sizes adapt at 320, 390, 768 and 1440 px.
- Used the previous protein/lime, fat/blue and carbohydrate/coral distinction, aligned nutrient labels, amounts in grams, and 'per 100 g/ml' units.
- Used dashed neutral rings for missing source values; no fabricated nutritional figures and no misleading daily percentage/completion metrics.
- Restored the exact explanatory disclaimer that the circular outlines are decorative, not percentages of a daily target.
- No changes to scanner, product parsing, food eligibility, allergen logic, portion arithmetic, comparisons, API calls or data storage.

## Validation / rollout
- The GitHub Actions visual regression covers actual computed style, visible SVG circles, source values, layout overflow and viewport/theme variants.
- Source-integrity checks verify CSP import-map hash and every new versioned asset.
- This change updates GitHub only; deploy 11.14.1 to Cloudflare Pages staging and verify on a real phone before promoting.
- Rollback by reverting the release commit. All previous 11.14.0 files remain in Git history and repository.
