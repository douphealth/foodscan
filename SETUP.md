# Setting up the databases and the web price search (Cloudflare Pages)

Nothing here is required: FoodScan runs without any database. Each step switches one capability on, and the app says which are on at `/api/prices/status` (`sources.webSearch`) and `/api/health` (`index`, `publicCatalog`).

| Binding / secret | Needed for | Table definitions |
|---|---|---|
| `FOODSCAN_PRICES_DB` (D1) + `FIRECRAWL_API_KEY` + `ANTHROPIC_API_KEY` | **web price search** (current shop prices for any barcode, in the shopper's country) | `d1-schema/prices_db.sql` |
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

## 3. Web price search: two secrets
**Settings → Variables and Secrets → Add** (type *Secret*):
- `FIRECRAWL_API_KEY`: your Firecrawl key (finds and reads shop pages).
- `ANTHROPIC_API_KEY`: your Anthropic API key (Claude reads the page text).
Optional (plain text): `FS_WEB_PRICES_MODEL` (default `claude-opus-5-5`; `claude-haiku-5-5` is about 40 times cheaper and, because every price is verified by code, loses recall rather than accuracy), `FS_WEB_DAILY_LIMIT` (new lookups per UTC day, default 300).

## 4. Redeploy, then check
Bindings and secrets apply to the **next deployment**: Deployments → the latest → **Retry deployment**. Then:
```bash
curl -s https://YOUR-SITE/api/prices/status | grep -o '"webSearch":"[^"]*"'
node verify-deploy.mjs https://YOUR-SITE 90.0.0
```

## What the web search does, and what it costs
- It runs only when the free sources (Open Prices; for Greece also the observatory and the shops' seeds) have **no current price** for the barcode in the shopper's country, and never for the small "better choice" chips.
- One new lookup = 1-2 Firecrawl searches + up to 3 page scrapes + one Claude call over about 10 thousand tokens. Results are cached in D1 for 12 hours (24 hours when nothing was found, 2 hours after a failure); a rescan re-checks at most every 30 minutes per product and country; `FS_WEB_DAILY_LIMIT` caps the day's new lookups. Past the cap the card simply shows what the free sources know.
- **Every price is checked by code before it can appear:** it must literally be in the page text, in the market's currency, from a shop domain of that country (or a page that says so), for this barcode or the exact name, brand and pack size, in stock; a "close" match never counts. Each web price shows the shop, a link and the time it was read. Pages that talk to the model ("ignore previous instructions") are dropped before the model sees them.
