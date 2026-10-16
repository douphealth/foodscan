# FoodScan backend 11.11.0 — comparison-search compatibility hotfix

- Backend-only update. The existing 11.10.0 frontend, themes, nutrition calculations and eligibility rules are unchanged.
- Search-a-licious queries now use categories and countries. Product Opener v2 requests correctly retain categories_tags and countries_tags.
- Current index taxonomy fields are mapped into the legacy product-record format. NOVA numeric strings are normalized; boolean obsolete records are excluded. Index records remain partial.
- Search requests now use the existing upstream budget/optional limiter. Provider Retry-After pauses are no longer shortened to 120 seconds.
- Query rejection, access refusal, timeout, response-format, size and network failures have distinct messages and safe provider diagnostics; speculative usually-busy wording removed.
- Barcode cache namespace preserved; matching prior stale search snapshots remain usable with STALE labeling.
- Fifteen mocked Worker integration checks passed, including reproduction of the old query-schema failure and successful corrected fallback. Current upstream configuration and query-validator source were inspected. Live-provider success and Cloudflare deployment remain unverified.
- Health reports backend version 11.11.0 and searchSchema categories-countries-v1 without claiming an upstream probe.
- No frontend layout files or workflow files changed. Roll back by reverting this commit.
