# FoodScan 11.10.0 — targeted contrast and database recovery

- Fixed allergen chips, source cards, context icons, comparison error panels and grocery empty states in both display modes. Existing macro circles and theme controls retained.
- Browser proxy requests now allow a bounded 20-second recovery window; the previous 9.5-second deadline could cancel the server's two sequential 7-second provider attempts before fallback completed. The backend Worker is unchanged; this does not guarantee upstream availability.
- Replaced the browser cross-origin category fallback with proxy-first requests, coalescing, a small per-browser live-search budget and a bounded public-query snapshot cache.
- Cache keys isolate country and detail mode; normalized records retain original retrieval dates. Stale category, product and name-search snapshots are explicitly labeled. No fake alternatives or zero-filled nutrition.
- 429/503 request pauses and 403 restrictions are respected. Wrong-barcode and confirmed-miss responses do not fall back to another identity. Explicit diagnostic transport modes do not silently return saved product data.
- Retry countdown re-enables controls without requiring a full page rerender. Duplicate saved-food error copy removed.
- Public-query cache is capped, expires after seven days and is removed by the app-data deletion adapter. Rate limits are not cleared to bypass provider pauses.
- Four Chromium local fixture renders passed: 390/1440 pixels, light/dark; 21 selected contrast samples per render, no overflow, retry re-enabling and source-card normalization. Minimum sampled contrast: 6.63:1 light, 8.32:1 dark.
- Fourteen mocked API tests passed for deadlines, coalescing, transient failure, persisted offline snapshots, request pauses, access restrictions, cancellation, barcode identity, stale metadata, query-key isolation, local budget and cache deletion. Timings were simulated, not measured on the live provider.
- UI/module version, entry points, CSP hash and offline shell are 11.10.0. Shared engine and 11.9 theme modules remain dependencies.
- Full live-network, backend-global-rate-limit and all-route integration validation remain outstanding. First-use searches can still fail without a usable snapshot when the provider is unavailable.
- Rollback by reverting this commit.
