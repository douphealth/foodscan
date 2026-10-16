# Latest update: FoodScan 11.15.0

See [release notes](RELEASE_NOTES_11_15.md): responsive photo improvements, conservative nutrition-source validation and visible data completeness.

# FoodScan 11.14.1 update

The source-accurate Protein, Fat, and Carbs circular cards are restored in the product report. See [11.14.1 release notes](RELEASE_NOTES_11_14_1.md).

# FoodScan 11.13.0 update

See [11.13 release notes](RELEASE_NOTES_11_13.md) for the live-alternatives recovery architecture and premium source-classification cards.

# Latest update: FoodScan 11.12.0

See [release notes](RELEASE_NOTES_11_12.md) for fixed Open Food Facts category comparisons, meaningful per-portion presets, and safe saved-food recovery.

# FoodScan 11.1.0 - Insight Release

A mobile-first food barcode scanner, evidence-led packaged-food report, local meal diary, grocery and pantry companion for Cloudflare Pages Direct Upload. This is a complete deployable app with its original safety gates and cloud worker.

## First-screen experience

- Start with camera scan, optional barcode photo, or name/barcode search. First-time visitors can try one of three live product lookups.
- See the executive finding and the source-provided Nutri-Score/NOVA ratings together with fat, saturated fat, sugars, and salt traffic lights right at the top of the result page.
- Read accurately split ingredient text: decimal commas and grouped ingredient text are preserved; exact label transcription remains visible.
- Adjust grams/ml with a serving-aware numeric stepper, presets and slider. Eight nutrients update using source data; never default to product-specific estimates for unknown foods.
- Log a portion directly to the local daily meal diary; see logged totals and known-vs-unknown fields. The EU adult 90 g total-sugar RI is not an added-sugar limit.

## Deploy

Upload the contents of this archive to a Cloudflare Pages staging project as a Direct Upload, not a Git build. No build step or credentials. Check `/api/health` returns `version: 11.1.0`. Validate actual scanning, allergies, ingredient source fidelity, portion arithmetic, browser theme and offline behavior on a real phone. Promote only after staging checks; rollback by restoring 11.0.0.

## Entry points

- `index.html`: client HTML app and versioned style/module tags.
- `assets/release-11.1.0/insight.css`: high-contrast result and responsive UI.
- `assets/release-11.1.0/lib/ingredient-parser.js`: decimal-aware label tokenization and glossary reading aid.
- `assets/release-11.1.0/lib/decision-ui.js`: verdict, scores, traffic lights and actions.
- `assets/release-11.1.0/lib/components.js`: structured ingredients and original text.
- `assets/release-11.1.0/lib/meal-diary.js`: portion input, calculator and logged totals.
- `assets/release-11.1.0/lib/views.js`: daily homepage and product report.
- `_worker.js`: Cloudflare API and `/api/health`.
- `sw.js`: versioned offline app shell.
- `RELEASE_NOTES_11_1.md`: validation details, accuracy constraints and rollback.

Data comes from Open Food Facts or the individual's own entries. This is not an allergen safety determination or personal medical/nutrition advice. Missing data remains unknown.
