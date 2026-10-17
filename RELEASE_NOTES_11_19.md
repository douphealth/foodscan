# FoodScan 11.19.0 — reliable alternative comparisons

The source comparison path now checks real same-origin Open Food Facts category snapshots before calling remote providers. A GitHub Actions job retrieves 43 verified-category snapshots and refreshes them daily. This is a read-only public data backup, not a list of guaranteed available or diet-safe products.

Confirmed diagnostic 2026-10-17: published foodscan-9oi.pages.dev upstream category API returned HTTP 502 while the Open Food Facts search index returned live hits when queried from GitHub Actions. Chromium cross-origin browser fetch failed (CORS), so previous browser fallback could not recover from both server and direct-provider outages.

Fix:
- Serve cached source records from /data/alternatives/<category>.json on the same origin.
- Keep exact source barcodes, source retrieval dates, and the existing ranking/allergen checks.
- Maintain provider-specific cooldown and read budgets, so a failing legacy endpoint cannot automatically disable the index.
- Use the verified catalog first for unrestricted profiles and keep the original report and alternative card designs.
- For strict dietary profiles, do not present incomplete index snapshots as verified allergen suitability.
- Use static cache-on-use for future offline access; refresh daily in Actions.
- Keep regular comparison search as fallback if a category is not covered.

Limits: 43 popular categories were initially populated. No universal completeness or store inventory claims are made. Provider or Cloudflare egress failures remain possible for un-catalogued categories.
Rollback: revert the release commit; previous 11.18 files remain in Git history.
