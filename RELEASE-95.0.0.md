# FoodScan 95.0.0: launch-ready (the owner's 95 changes, now in the source)

Base: FoodScan 94.0.0. The owner sent a 95.0.0 build made on top of 94; its changes were reviewed, tested and written into the source, which now builds a worker byte-for-byte identical to the owner's.

## What 95 changes
- **Search-result pages are never product pages.** A web price from a shop's search page (`?q=`, `?s=`, `?search=`, `?query=`, `?keyword=`, or `/search`, `/catalogsearch`, … also under `/el/`, `/en/`, `/gr/`) is dropped; a product page with an id (`?id=`, `?sku=`, `?product_id=`, …) still counts.
- **Lists stay fast.** List prices (`/api/prices/peek`) read the pack size from the bundled catalogue only and no longer ask Open Food Facts for it.
- **Scan outcomes set themselves up.** `foodscan_scan_daily` is created on first use if `prices_db.sql` was not re-run; the admin report also gives the totals over all products, not only the top 500.
- **Outcome reporting waits for a pending web search**, and a grade read from the shopper's saved label photo counts as "estimated".

## Checked
- `qa/release95.test.mjs`: a `?q=` search page and `/el/search/…` give no price, a product page with `?id=` does; scan outcomes are recorded and readable on a database where `prices_db.sql` was never re-run.
- The test database (`qa/helpers.mjs` `fakeD1`) now runs statements without parameters directly, as Cloudflare D1 does; before, it only accepted them after `bind()`.
- Full suite: **146 tests pass**; `node build.mjs --check` OK.
- Real app in Chromium (local worker, Greek visitor, database, admin token), iPhone 13 and desktop: no page or console errors, no failed requests, no sideways scrolling; every product page sent one outcome (HTTP 202); the admin report listed them (2 products, 3 opens) and refused a request without the token (401).
- Not checkable here: product photos (this sandbox blocks images.openfoodfacts.org).

## Owner steps
Unchanged from 94 (`SETUP.md`): D1 database bound as `FOODSCAN_PRICES_DB` with `d1-schema/prices_db.sql` run, secrets `FS_CONFIRM_SALT` and `FOODSCAN_PRICES_ADMIN_TOKEN`, redeploy, then `node price-refresh/tools/verify-deploy.mjs https://food-scan.gearuptofit.com 95.0.0`.

## Rollback
Redeploy the 94.0.0 zip, or revert the merge.
