# FoodScan 11.7.0

- Root cause addressed: legacy dark-green panels, faint copy and invisible logo text from the 11.3 stylesheet were overriding earlier light redesign layers.
- New runtime surface-repair module guarantees light surfaces and minimum 4.5:1 text contrast on every rendered screen (home, result, profile, lists), without depending on legacy class names.
- Small bars, dots, buttons and score marks are preserved; no nutrition, eligibility or diary logic changed.
- Stronger light header, navigation, scan panel, search, chips, ingredient rows and diary cards.
- Contrast-repair behavior verified in headless Chromium on a dark, low-contrast fixture; the real deployed pages were not rendered here.
- New 11.7.0 entry points, VERSION, CSP import-map hash and offline cache.
- Rollback: revert this commit.
