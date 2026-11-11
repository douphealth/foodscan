# FoodScan 93.0.0: web-shop prices found ahead of any scan (webclaw, read by code)

Base: FoodScan 92.0.0 (webclaw web price search) and 91.0.0 (shared shopper confirmations); 91, 92 and 93 ship together.

## What changed
- **Prefilled web-shop prices.** `price-refresh/tools/webclaw-prefill.mjs` runs the worker's own rules (`src/worker/webprices.js`: search → page check → 84 verifier) for catalogue products with **no current price** in FoodScan's sources (observatory links, Bazaar, Lidl), and writes 100 small shards. The worker reads them (`/assets/gr-web-v93/`, newer copy from prices-data `web/NN.json` when published) on the product page, in lists and in `/api/prices/peek`; a live search runs only when there is no current price at all.
- **Credits spent only where a price is likely.** Each lookup is one webclaw search **without scraping**; only results whose title, snippet or address carry the barcode, on a Greek, non-B2B, non-comparison domain, are scraped (at most 3, one at a time). Per-request timeout 20 s; retries with back-off on busy answers; the batch stops on 401/402/403/429 and keeps a reserve of 2,000 credits (`GET /v1/usage`). Found prices are re-checked after 6 days, empty products after 45 days.
- **Daily job** (`.github/workflows/refresh-prices.yml`): step "Web-shop prices via webclaw", at most `WEBCLAW_DAILY_LOOKUPS` (default 1,500) a day. **It does nothing until the owner adds the GitHub secret `WEBCLAW_API_KEY`.**

## Bundled data (measured 11 Nov 2026)
The batch was stopped by the owner after the first 100 products to save credits. Bundled: 100 products looked up, **15 with a verified shop price** (17 offers: ministopkiosk.gr, Pharmacy Megastore, fastmarket.gr, Metagora, cestino, JOY market, Ionion Market), e.g. ΒΙΟΛΑΝΤΑ cookies zero 170 g 1,68 € (Metagora) / 2,65 € (kiosk), ΒΙΟΛΑΝΤΑ Dubai 180 g 3,79 € (fastmarket.gr). Hit rate 15 %; about 14 credits per price found. Session total 636 credits used, 158,364 left.
These prices are dated 11 Nov; without the daily job they age out of "current" like any other dated price.

## Checked
139 tests pass (`qa/webprefill.test.mjs`, `qa/webclaw.test.mjs` with the two-step search: `scrape:false` asserted, only the barcode-carrying result scraped); `node build.mjs --check` OK. Local run of the real worker (no webclaw key): `/api/prices/peek` returns the bundled prices as current (Metagora 1,68 €, cestino 1,69 €, Ionion Market 1,75 €) and the product page shows fastmarket.gr 3,79 € as the best offer.

## Rollback
Delete `assets/gr-web-v93/` (no prefilled prices) or revert the merge; without `WEBCLAW_API_KEY` in GitHub and Cloudflare no webclaw credits are used.
