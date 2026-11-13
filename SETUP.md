# Setting up the databases and the web price search (Cloudflare Pages)

Nothing here is required: FoodScan runs without any database. Each step switches one capability on, and the app says which are on at `/api/prices/status` (`sources.webSearch`) and `/api/health` (`index`, `publicCatalog`).

| Binding / secret | Needed for | Table definitions |
|---|---|---|
| `FOODSCAN_PRICES_DB` (D1) | **shared shopper confirmations** (91): two independent "This is it" confirmations link a barcode to an observatory product, and its daily chain prices show for everyone | `d1-schema/prices_db.sql` |
| the same `FOODSCAN_PRICES_DB` + `WEBCLAW_API_KEY` (92, recommended: prices read by code, no AI) | **web price search** (current shop prices for a barcode, in the shopper's country) | `d1-schema/prices_db.sql` |
| or the same `FOODSCAN_PRICES_DB` + `FIRECRAWL_API_KEY` + `ANTHROPIC_API_KEY` (84) | the same, with Firecrawl and Claude | `d1-schema/prices_db.sql` |
| `FOOD_DB` (D1) | shared product cache and search index on the server (faster repeat scans, gentler on Open Food Facts) | `d1-schema/food_db.sql` |
| `FOODSCAN_PUBLIC_DB` (D1) + `FOODSCAN_PUBLIC_PAGES_ENABLED=1` | public product pages Google can index | `d1-schema/public_db.sql` |

The table definitions are tested on real SQLite against the exact statements the worker runs (`qa/d1-schema.test.mjs`), including a check that every table the worker names is created by one of the files.

## 1. Create a database (repeat for each one you want)
1. Cloudflare dashboard → **Storage & Databases → D1 SQL database → Create database**. Names that fit: `foodscan-prices`, `foodscan-food`, `foodscan-public`.
2. Open the database → **Console** → paste the whole matching `d1-schema/*.sql` file → **Execute**. (If the Console rejects a multi-statement paste, run it from a terminal instead: `npx wrangler d1 execute foodscan-prices --remote --file=d1-schema/prices_db.sql`.) The files are safe to run twice.
3. The **Database ID** is on the database's overview page. You do not need it for the Pages binding below (you pick the database by name); it is only for `wrangler` configuration files.

## 2. Bind it to the Pages project
**Workers & Pages → your project → Settings → Bindings → Add → D1 database.** Variable name exactly `FOODSCAN_PRICES_DB` (or `FOOD_DB`, `FOODSCAN_PUBLIC_DB`), choose the database. Add it for **Production** (and Preview if you test there).
Bind `FOOD_DB` only after `food_db.sql` has been run: binding it switches the server product cache on at once.

## 3. Shared confirmations (needs only `FOODSCAN_PRICES_DB`)
On as soon as the database is bound (step 2) and `prices_db.sql` has been run (it creates `foodscan_obs_votes` and `foodscan_obs_links`). Recommended: **Settings → Variables and Secrets → Add** a *Secret* `FS_CONFIRM_SALT` with a long random string (it salts the hash that tells voters apart; no IP address is ever stored). Optional plain variable `FS_CONFIRM_MIN` (confirmations needed, default 2, 2 to 10). Check: `POST /api/prices/confirm` answers 422 or 400 instead of 503 `not_configured`.

## 3a. Scan outcomes (94): which opened products miss a grade, a price or a photo
On as soon as `FOODSCAN_PRICES_DB` is bound and `prices_db.sql` has been run again (it adds `foodscan_scan_daily`; running it twice is safe). The product page sends, once per product per visit, the grade tier, price tier and whether a photo showed; the server keeps **daily counts per barcode** only (no address, device id, cookie or time of day) and skips Do Not Track / Global Privacy Control and requests from other sites.
To read them, add a *Secret* `FOODSCAN_PRICES_ADMIN_TOKEN` (at least 32 random characters; the same token protects `/api/prices/admin/import`) and run:
```bash
curl -s -H "Authorization: Bearer $FOODSCAN_PRICES_ADMIN_TOKEN" "https://YOUR-SITE/api/prices/outcome?days=30"
```
It lists up to 500 barcodes by opens, with `no_grade`, `est_grade`, `no_price`, `weak_price` (older or estimate only) and `no_photo` counts: fix the most-opened gaps first.

## 4. Web price search with webclaw (one secret, no AI)
**Settings → Variables and Secrets → Add** (type *Secret*): `WEBCLAW_API_KEY` = your webclaw key (the `wc_…` key from the webclaw dashboard; never in the code or a file in the repository). That is all: with it, the web search uses webclaw and reads prices by code; Firecrawl and Anthropic are not used even if their keys exist.
- When it runs: only for a barcode with **no current price** from the free sources, in the shopper's country. One lookup = one webclaw search for the barcode (up to `FS_WEBCLAW_RESULTS`, default 8, result pages scraped by webclaw).
- What counts: a page of the shopper's country (".gr" for Greece) that prints **this barcode**, whose product heading names a pack size equal to the label's, with one price attached to the product; per-kg prices, struck-through prices, other products, sold-out items, trade (B2B), comparison and nutrition sites never count. Then the 84 verifier checks it again.
- Credits: answers are kept 3 days (7 days when nothing was found); at most `FS_WEB_DAILY_LIMIT` new lookups a day (default **20** with webclaw). Raise it only if your webclaw plan has the credits.
- Measured on 11 Nov 2026 (`RELEASE-92.0.0.md`): 8 prices accepted, 0 wrong; a price for 25 % of products that had none (5 of 20).

## 4a. Web-shop prices found ahead of any scan (93): one GitHub secret
The daily GitHub job (`.github/workflows/refresh-prices.yml`) looks up every catalogue product that has no current price in the Greek sources, with the same webclaw search and the same price rules, and publishes the verified prices to the `prices-data` branch (`web/`), which the site reads (a copy is also bundled with the site in `assets/gr-web-v93/`).
- GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**: name `WEBCLAW_API_KEY`, value your `wc_…` key. Without it the job keeps the previous prices.
- Optional repository **variable** `WEBCLAW_DAILY_LOOKUPS` (default 1500). A lookup with no shop page costs about 1–2 credits, one with a price about 3–5; found prices are re-checked after 6 days, products with nothing found after 45 days; the job stops before fewer than 2,000 credits remain.

## 4b. Web price search with Firecrawl and Claude: two secrets (instead of 4)
**Settings → Variables and Secrets → Add** (type *Secret*):
- `FIRECRAWL_API_KEY`: your Firecrawl key (finds and reads shop pages).
- `ANTHROPIC_API_KEY`: your Anthropic API key (Claude reads the page text).
Optional (plain text): `FS_WEB_PRICES_MODEL` (default `claude-opus-5-5`; `claude-haiku-5-5` is about 40 times cheaper and, because every price is verified by code, loses recall rather than accuracy), `FS_WEB_DAILY_LIMIT` (new lookups per UTC day, default 300).

## 5. Redeploy, then check
Bindings and secrets apply to the **next deployment**: Deployments → the latest → **Retry deployment**. Then:
```bash
curl -s https://YOUR-SITE/api/prices/status | grep -o '"webSearch":"[^"]*"'
node verify-deploy.mjs https://YOUR-SITE 95.0.0
```

## What the web search does, and what it costs
- It runs only when the free sources (Open Prices; for Greece also the observatory and the shops' seeds) have **no current price** for the barcode in the shopper's country, and never for the small "better choice" chips.
- One new lookup = 1-2 Firecrawl searches + up to 3 page scrapes + one Claude call over about 10 thousand tokens. Results are cached in D1 for 12 hours (24 hours when nothing was found, 2 hours after a failure); a rescan re-checks at most every 30 minutes per product and country; `FS_WEB_DAILY_LIMIT` caps the day's new lookups. Past the cap the card simply shows what the free sources know.
- **Every price is checked by code before it can appear:** it must literally be in the page text, in the market's currency, from a shop domain of that country (or a page that says so), for this barcode or the exact name, brand and pack size, in stock; a "close" match never counts. Each web price shows the shop, a link and the time it was read. Pages that talk to the model ("ignore previous instructions") are dropped before the model sees them.
