# FoodScan 87.0.0: Open Prices from the official daily dumps, plus a live check for prices added since

Base: FoodScan 86.0.0 (`main`, 9f059b0). Built after the owner's request to use Open Prices "in the most efficient way to get the most up-to-date, accurate prices", and, for Greece, to combine it with the observatory, Bazaar, Lidl and the price-linking job while relying mostly on those. No new secret, no cost, no new host: the worker already read Open Prices and the `prices-data` branch.

## What changed
**Before (86):** every scan read Open Prices live, up to nine paged requests per product (one per barcode variant and page). That was slow, and when the API was slow or down the product showed no Open Prices offer.

**Now (87):**
1. **Daily snapshot** (`price-refresh/tools/build-open-prices.mjs`, new step in `.github/workflows/refresh-prices.yml`). It reads the four official daily dumps (`https://prices.openfoodfacts.org/data/{prices,proofs,locations,products}.jsonl.gz`), keeps the barcode prices of the last 120 days and writes them to `prices-data/op/` as 256 shards keyed by barcode (about 50 KB each), with the store, proof type, pack size and a **cutoff**: the newest `created` timestamp in the dump.
2. **One live request per scan, for what is newer than the snapshot.** The worker reads the product's shard, then asks the live API only for prices created after the cutoff: `GET /api/v1/prices?product_code__in=<all barcode variants>&created__gte=<cutoff>`. Prices from both are merged by id. Nothing added since the dump is missed, and the request is small.
3. **Fallbacks.** API slow or down: the snapshot alone answers (`providers.openPrices.via = "snapshot"`). No snapshot, or a snapshot older than 8 days: the old full live read (86 behaviour). The response says which path was used (`via`, `snapshotCutoff`, `liveSinceCutoff`).
4. **Same rules for every price.** Snapshot rows are rebuilt into the live API's shape and go through the same normaliser (`fsPriceNormalizeOpen`) and the same guards as before: currency, unit basis, pack size, freshness (current is 7 days or less), promotion conditions, and the outlier check (a price below half or above 2.5x the median of the other stores is shown as "suspect" and never ranks). A test checks that the same price gives an identical offer whichever way it arrives.

## Greece: the Greek sources stay primary
All sources go into one pool for each barcode; there is no hidden weighting. In practice the Greek sources do most of the work, and they are also the benchmark that every crowd price is tested against:
- The snapshot holds **11 Greek Open Prices observations from the last 120 days**, against thousands of Greek chain prices from the observatory (through the price-linking job), Bazaar and Lidl. A Greek product's lowest current price is almost always a chain price.
- A Greek crowd price ranks only if it passes the outlier check against those chain prices. Tested case: a crowd price of 0.02 € for a product with ten chain offers is shown as "suspect" and is not the lowest price.
- An Open Prices price for a Greek product with no chain price is still shown, with its date, store and proof, exactly as before.

## Measured on the real dumps (5 Nov 2026, in the sandbox)
| | |
|---|---|
| price rows inspected | 340,872 |
| kept (barcode, last 120 days, not a duplicate, a store, a price and currency) | 57,672 observations, 41,080 barcodes |
| skipped | 262,476 older than 120 days, 10,665 not a barcode price, 9,364 duplicates, 694 no store, 1 no price |
| cutoff | 2026-11-04T22:57:38Z |
| top countries (observations) | FR 25,225, US 15,423, NO 5,803, DE 2,858, DK 1,944, SE 1,907, PL 956 ... GR 11 |
| build time, size | 7 s, 12 MB in 256 shards |
Verified against the live API before relying on them: `product_code__in` takes a comma-separated list, `created__gte` filters to the second.

## Safeguards in the daily job
- If a download fails or the new dump has fewer than 70 % of the previous observations, the previous snapshot is kept.
- The step is `continue-on-error`: the Greek data still publishes if Open Prices is unreachable on a day with no previous snapshot.
- Licence: the dumps are ODbL 1.0 (Open Prices, Open Food Facts); proof images CC BY-SA 4.0. The manifest records this. The snapshot is a derived database published openly on the `prices-data` branch, which meets ODbL's share-alike; the price cards already credit Open Prices.

## Not done / not measured (said plainly)
- **Not run in the live daily job yet.** `prices-data/op/` appears after the first run following the merge. Until then the worker uses the full live read, as in 86, so nothing gets worse in the meantime.
- Not measured on the live site (the sandbox cannot reach it): scan latency before and after.
- Open Prices coverage is the community's: strong in France and the US, thin in Greece. The snapshot makes those prices faster and more robust; it does not add prices that nobody recorded.

## Files
New: `price-refresh/tools/build-open-prices.mjs`, `qa/open-prices-snapshot.test.mjs` (6 tests), this file. Changed: `src/worker/prices.js` (snapshot read, delta request, fallbacks), `_worker.js` and `src/worker/manifest.json` (rebuilt), `.github/workflows/refresh-prices.yml` (new step), `qa/helpers.mjs` (fake API supports `product_code__in` and `created__gte`), `PRICE-COVERAGE.md`, version strings (87.0.0), `sw.js`. 110 tests pass; `node build.mjs --check` OK.

## Rollback
- Fastest, no deploy: set `FOODSCAN_PRICE_DATA_URL=off` in Cloudflare Pages; the worker uses only the bundled data and the full live read. (That also turns off the daily Greek data, so prefer the next option.)
- Remove the "Open Prices snapshot" step from the workflow; after the next run `prices-data/op/` is gone and the worker falls back to the full live read automatically.
- Or revert the merge.
