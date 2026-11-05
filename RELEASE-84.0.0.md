# FoodScan 84.0.0: a corrected Nutri-Score rule, live shop prices for any barcode, and real Open Prices filters

Base: FoodScan 83.2.0 (main, 4 Nov 2026). Built from that code plus the parts of the uploaded `foodscan-codebase.zip` (a Lovable project that carries a FoodScan copy) that were checked and kept: the score fix, the D1 table definitions, and the web price search, ported from TypeScript to plain worker JavaScript. Not taken: the React/TanStack shell, the D1-over-HTTP adapter and the Lovable AI/Firecrawl gateway (they exist to host the worker somewhere else), and the in-app Prices view (this release keeps the separate Prices page that is tested here).

## 1. Scores: the protein rule was the 2017 one (fixed, verified against the reference)
In the 2023 Nutri-Score, protein points count only when the negative points are **under 11** (**under 7** for fats, oils, nuts and seeds); cheese and drinks always count. FoodScan 83 also counted protein when the fruit/vegetable/legume share was above 80 %, which is the **2017** rule. Checked line by line against Open Food Facts' reference implementation (`lib/ProductOpener/Nutriscore.pm`, `compute_nutriscore_score_2023`, read from GitHub): no such exception exists in 2023. The point tables themselves already matched the reference exactly (a test now pins every threshold to it).
- Corrected in the worker (`src/domain`) and in the browser engine (`assets/domain-v8400.mjs`). Example that changes: a dried-fruit mix at 18 negative points, 90 % fruit, 4.5 g fibre, 3 g protein: 11 points = **D** (83 gave 10 = C).
- The sentence that explains a missing protein score no longer says "and little fruit or vegetable", and says "7 or more" for fats/oils/nuts/seeds (Greek too).
- **Unverified-grade warning.** A grade whose record lacks energy, sugars, saturated fat or salt cannot be checked against the label: it now says which values are missing (English and Greek), is marked `unverified` and carries at most low confidence. In the saved Greek catalogue that is 71 of 4,040 shown grades (1.8 %).
- Tests: `qa/nutriscore-audit.test.mjs` (tables, the 10/11 and 6/7 boundaries, the browser engine agreeing with the worker engine, the warning).

## 2. Prices: live shop prices for any barcode, in the shopper's country, verified by code
New `src/worker/webprices.js`. When the free sources (Open Prices; in Greece also the observatory and shop seeds) have **no current price** for the barcode in the shopper's market, FoodScan finds the shops' own product pages (Firecrawl search and scrape), has Claude read them, and then **plain code verifies every price before it can appear**:
- the price must literally appear in that page's text (raised cents such as `€130` only with the matching per-kg price); the product title and pack size too;
- the currency must be the market's; the shop's domain must be of that country (a generic `.com` only if the page says the country); the pack must equal the label's (2 x 100 g is not 200 g); variants (zero, light, vegan) and percentages must match; in stock; a "close" match never counts;
- pages that talk to the model ("ignore previous instructions") are dropped before it reads them;
- every web price shows the shop, a link and the time it was read; only barcode matches (or exact name+brand+pack matches with the label's size) can be "the cheapest".
Cost control: it runs only when there is no current price (never for the small "better choice" chips: `web=0`), answers are cached in D1 (12 h; 24 h when nothing found; 2 h after a failure), a rescan re-checks at most every 30 minutes per product and country, and `FS_WEB_DAILY_LIMIT` (default 300 new lookups per UTC day) is counted atomically in D1. A slow search answers "Checking shops online…" first; the app asks once more (`deep=1`) and the price fills in by itself.
**Off by default.** It needs the secrets `FIRECRAWL_API_KEY` and `ANTHROPIC_API_KEY` and the D1 binding `FOODSCAN_PRICES_DB` (see `SETUP.md`); without all three the app behaves as in 83. Claude is called with plain `fetch` (this worker has no package manager); the model is `FS_WEB_PRICES_MODEL` (default `claude-opus-5-5`; `claude-haiku-5-5` is about 40 times cheaper and, because code verifies every price, loses recall rather than accuracy).

## 3. Open Prices: the filters it really has (found by reading its source)
Reading the Open Prices server source (`open_prices/api/prices/filters.py`) showed that 83's "country filter" (`location__osm_address_country_code`) **does not exist**: the API ignored it, so the "market-first" read was a duplicate of the plain one. The API's real filters are `currency`, `date__gte` and the nearby trio `lat` + `lon` + `radius_km`. The worker and the browser fallback now ask for the market's currency and the last 90 days first, and "Find near me" is filtered by the server before pagination. Every observation is still re-checked here (country, currency, date, proof). The field names the worker reads (`price_per` UNIT/KILOGRAM/LITER, `discount_type` values, nested `location` and `proof`) were confirmed in the same source.

## 4. Databases
`d1-schema/food_db.sql`, `public_db.sql`, `prices_db.sql` (from the upload; the repository never had them) and `SETUP.md` (click-by-click: create, run, bind, secrets, redeploy, check). `qa/d1-schema.test.mjs` runs them on real SQLite with the statements the worker uses and checks that every table the worker names is created by one of the files.

## 5. Other
- New asset generation `-v8400` (36 files; `-v8300`/`-v8200` stay); `tools/new-generation.mjs` makes the next one. `build.mjs --update-manifest` refreshes the module manifest.
- The browser Prices page and card list the web search as a source and update when a deep answer arrives.

## Checked
- `node --test qa/*.test.mjs`: 62 tests (new: score conformance, web search with fake Firecrawl/Claude/Open Prices and a real SQLite behind D1, D1 schemas). The old Greece payloads are unchanged: old and new workers return identical answers on 313 real Greek barcodes (the new explanatory sentence aside).
- In Chromium against the emulated worker: a French visitor sees the web price (EUR 3.29, shop, "Online price") instantly, or "Checking shops online…" and then the price by itself when the search is slow; no script errors on 24 random products; card and Prices page agree on the country; the unverified-grade warning shows in English and Greek.

## Not verified
- **Live services.** This environment reaches only GitHub, so Firecrawl, the Anthropic API and Open Prices were never called. The Claude request follows the documented Messages API shape (`x-api-key`, `anthropic-version: 2026-10-21`, `output_config.effort`; a model that rejects `output_config` is retried without it). Firecrawl's request fields (`country` lower-case, `scrapeOptions`, `location`) follow the upload's working use through its gateway. Run `node verify-deploy.mjs https://<site> 84.0.0` after switching the search on, and try one barcode.
- Coverage: how many barcodes get a verified shop price depends on what shops publish and Firecrawl can read (the upload's own audit found shops that block automated reading or need a delivery area).

## Rollback
Revert the merge commit or redeploy 83.2.0 (`1786e3e`). Nothing is stored server side except the optional D1 cache.
