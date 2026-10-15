# UX upgrade 10.2

**Direct product report:** `views.js → productFullReport` shows all source fields without click-gated accordions or tabs. Meal log accepts only per-100-unit records after user confirms the consumed amount. A product with restriction exclusions never reaches the log form.

**Daily report:** `meal-diary.js` retains existing `foodscan-meal-diary-v1` localStorage key and migrates old 10.1 entries. Text-only meals persist with null nutrients rather than pretending unknown values are zero. One-tap repeat, edit, Undo, weekly visible mini-report, optional 9:16 image share.

**Unified discovery:** enter a product name OR numeric barcode in the same search field; native camera and photo are one tap away; title/photo search/alternatives/saved records still use the original backend.

**Validation gates:** syntax check all JS; inspect HTML and precache assets; exercise first visit, daily logging, editing, repeat, product report, restricted product gating, dark theme, 320/390/1440 widths, responsive overflow, and update offline/cache when possible.
