# FoodScan 11.15.0 — trust and mobile photo layout

## Correctness
- Never invent nutrition values when fields are truly absent. Display explicitly unavailable metrics and source completeness (8 core fields).
- Convert kcal from reported kJ only with an explicit conversion and when the reported kcal is implausible or absent. Suppress conflicting energy, sugar/carb, fat/saturates and salt/sodium pairs.
- A known serving quantity may support a value-per-100 conversion when the field is absent; show that fact as *calculated* rather than label-reported.
- Check source values against conservative physical plausibility bounds. Record conflict warnings without hiding the rest of the valid report.
- Previous public-query cache version is changed to prevent carrying broken stale snapshots into the new parser.
- These checks protect against corrupted source records but cannot guarantee accuracy of volunteer-entered labels.

## Package images
- Include selected source-language front images, favor the display-size front crop, and retain multiple allowed Open Food Facts fallbacks.
- Center image inside a bounded squareish mobile panel with `object-fit: contain`. The screenshot's narrow, excessive-height white image area is removed.
- If an image fails, try the next sourced image. Never swap to a different barcode or a guessed image.

## API / rollout
- Include OFF selected_images and nutrition_data_per metadata from the same verified barcode record; no added API calls or arbitrary external images.
- New 11.15 asset directory, CSP import-map hash, release version, and PWA cache.
- No changes to the existing allergy checks, active priorities, diary arithmetic, alternate food ranking or referral behavior.
- Run source-normalization and mobile Chromium tests before promotion. Live Cloudflare checks remain required.
- Roll back by reverting the release commit. The existing 11.14.1 assets are retained.
