# FoodScan 80: daily price refresh

`scripts/refresh-prices.mjs` rebuilds the price data and writes it to `--out`:

```
out/seeds/posokanei-latest.json    observatory chain prices of the barcode-linked products (re-read by product id from the newest daily snapshot)
out/seeds/bazaar-eshop-latest.json Bazaar web-shop prices (new crawl over the previous file; unreachable pages keep their ORIGINAL dates)
out/seeds/lidl-eshop-latest.json   Lidl web-shop prices (same rule)
out/seeds/ekatanalotis-latest.json historical basket prices (frozen since 16 Jun 2026, carried forward)
out/e-00..63.json, manifest.json   labelled estimates for barcodes with no recorded price + the measured calibration of the estimator
```

The GitHub workflow `.github/workflows/refresh-prices.yml` runs it every day and publishes `out/` to the **`prices-data`** branch. The site's
worker reads `https://raw.githubusercontent.com/douphealth/foodscan/prices-data/...` (default; `FOODSCAN_PRICE_DATA_URL` overrides, `off` disables)
and, per file, uses the NEWER of the bundled and the published copy. A missing, older, invalid, truncated (under 90 % of the bundled products) or
unreachable published copy is ignored, so the worst case is the bundled data with its original dates.

| step | rule |
|---|---|
| observatory | newest snapshot of the last 6 days (github.com/spyrosavl/posokanei, ministry data); rejected under 5,000 products; links are kept from the previous seed, a product renamed since review is skipped |
| Bazaar, Lidl | robots.txt must equal the reviewed copy in `refresh/data/`, else the crawl is skipped; one request at a time, 1.2-1.5 s apart; a failed or too-small crawl keeps the previous observations |
| Open Food Facts | official CSV export, re-downloaded when the saved extract is older than 7 days (names, brands, pack sizes, categories) |
| estimates | `tools/build-price-data.mjs`: leave-one-out calibration per confidence class, range checked on held-out data |
| gate | nothing is published if the observatory, Bazaar or Lidl file lost more than 10 % of its barcodes, estimates fell more than 20 %, an estimator class is unusable, or its held-out coverage leaves 65-95 % |

Run by hand: `node refresh/scripts/refresh-prices.mjs --work work --out out --prev <previous data> [--skip-crawl] [--skip-off]`.
Needs Node 22 and Python 3.12 (crawl). On Windows set `PYTHONUTF8=1`.

**Enable it:** copy `price-refresh/` (this folder's parent, containing `refresh/`, `tools/`, `data/seeds/`) and `.github/workflows/refresh-prices.yml`
into the repository, then Actions > Refresh prices > Run workflow once. The default `GITHUB_TOKEN` with write access to contents is enough (the workflow requests it).
Check: `node tools/verify-deploy.mjs https://food-scan.gearuptofit.com 80.0.0` and `/api/prices/health` (`estimator.origin` becomes `remote` when published data is newer).

Barcode links of observatory products (`data/ean-posokanei-map-*.json` in earlier toolkits) are reviewed or exact name-and-size matches only; this job never creates a link.
