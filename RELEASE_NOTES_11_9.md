# FoodScan 11.9.0 — readable themes and macro circles

- Added visible Light/Dark controls to the shared header. Preference persists separately as foodscan-display-mode and survives application rerenders; initial system preference is respected.
- Paired surface/foreground tokens replace light-only overrides. Numbered report headers, source panels, composition legend, raw transcription, presets, stepper controls and portion nutrient labels receive explicit paired colors.
- Shared-page view adapters normalize legacy header/source containers. Profile, saved foods, shopping, pantry, comparison, insights, demo, about/privacy, alternatives and pantry review use the same theme system.
- Added Protein, Fat and Carbs circular cards from accepted, non-conflicting per-100 g/ml source values. Outlines are decorative, not invented target percentages. Unknown values remain unknown; gates are retained.
- Local Chromium fixture tests at 390px and 1440px passed for light and dark: 3 macro cards, no page overflow, persistence/re-render checks, and 30 selected text samples per screen. Minimum sampled contrast: light 7.26:1; dark 8.32:1.
- These are isolated component tests, not proof that every deployed screen passes. Source fixtures reproduce the reported defects but do not include every legacy page.
- Versioned entry points, import-map CSP hash and offline cache updated to 11.9.0. The 11.8 layout and original engine remain shared dependencies. No nutrition calculations changed.
- Live-audit workflow now derives the expected version from release metadata, checks the selected display theme, and runs the existing mobile/desktop route audit for light and dark separately. The workflow may consume GitHub Actions minutes and retains reports for 7 days. No claim that the live audit has completed.
- Revert this commit to roll back. Requires CSS cascade layers and import maps.
