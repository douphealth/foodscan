# FoodScan 80.0.0: complete, fresh, honest prices

Base: the uploaded `FoodScan-v79.0.0-Groq-Full` site zip (2 Nov 2026). Everything v79 does stays: scan-time live check of the exact barcode on bazaar-online.gr and lidl.gr, size consensus, price tiers, Kritikos off by default, D1 support. v80 adds what v79 could not do, and fixes what made prices wrong.

## First: nothing you built is live
Checked read-only on 2 Nov 2026 14:19 (`node tools/verify-deploy.mjs https://food-scan.gearuptofit.com 80.0.0`):

| site | serves | price API |
|---|---|---|
| food-scan.gearuptofit.com | **FoodScan 52.0.0** | **HTTP 404 `route_not_found`** |
| foodscan-cym.pages.dev | **FoodScan 52.0.0** | **HTTP 404 `route_not_found`** |

Both still run release 52, which has no price code at all. So whoever opens the live site sees no price on any product, whatever v70-v79 contain. A new ZIP has to be uploaded to the project that serves your domain (see Deploy). `tools/verify-deploy.mjs` tells you in ten seconds whether it worked.

## What was wrong with v79 itself (measured 2 Nov 2026)
| finding | evidence |
|---|---|
| **Too few products had a price** | 300 most-scanned Greek-market products: 58 % had any recorded price; 150 random Greek-prefix products: 20 % |
| **Prices go stale fast, and v79 called 30-day-old prices "current"** | a full Bazaar re-crawl 2 days after the bundled reading: **260 of 6,108 prices (4.3 %) had changed** (e.g. Mentos 3,49 -> 2,60, Nutella 7,29 -> 6,94). At that rate about a third of the bundled web-shop prices would be wrong after 30 days |
| Bundled shop data was 2 days old and refreshed nowhere | seeds dated 31 Oct; no job refreshed them |
| The observatory links themselves are accurate | 794 of 795 independent comparisons agreed (a shop price carrying the barcode vs the linked observatory price, 1 day apart) |
| The action bar of the product view overflowed on a phone in Greek | the "save" button was pushed off the right edge |

## What changed in 80.0.0
1. **A price figure for (almost) every product, honestly labelled.** The price strip now says, in this order: the lowest **current** recorded price; else the **last recorded price with its age**; else a **labelled estimate** (a range, "Not a recorded price", the products it rests on, how it was measured); else **"No verified price for this barcode"** with the reason. An estimate is never an offer: never ranked, never "cheapest", never the winner in Compare. It also shows in Better choices, Compare, the Prices page, and on products Open Food Facts does not have (where the page previously showed no price at all).
2. **7-day "current" window** (was 30). Older prices stay visible as "last recorded", with their age. Observatory data is daily; Bazaar and Lidl are re-read live on every scan when they answer.
3. **Fresh data, 2 Nov 2026:** Bazaar fully re-crawled (6,127 products, +19 new barcodes), Lidl fully re-crawled (517 products, **+146 new barcodes**, sitemap grew from 524 to 691 pages), observatory snapshot of 1 Nov (1,177 linked barcodes).
4. **Prices update without redeploying.** The worker reads published copies of the four seed files and of the estimates from the `prices-data` branch and uses, per file, the NEWER of the bundled and the published copy (a missing, older, invalid, truncated or unreachable copy is ignored). A daily GitHub Actions job (`.github/workflows/refresh-prices.yml`, in the source bundle) rebuilds them: observatory prices re-read by product id, shops re-crawled (only if their robots.txt is unchanged), estimates recalibrated, with a publish gate. `/api/prices/health` shows which copy is in use.
5. **Greek / layout:** the product action bar fits 320-390 px in Greek, long product names are clamped to the card, Greek capitals use calmer letter-spacing, the Prices page no longer shows twelve "Not available" tiles.
6. `tools/verify-deploy.mjs`, `tools/coverage-eval.mjs` and `tools/live-accuracy.mjs` (spot-check seed prices against the shops' own pages).

## How the estimate works, and how wrong it is
13,058 real reference prices (the ministry observatory's chain prices for about 7,400 food products, plus the Bazaar and Lidl web shops). A barcode's name, brand and pack size are compared with them (Greek and Latin spellings folded: ΦΑΓΕ = FAGE); the estimate is the score-weighted median of the neighbours' price per kg/L/piece times the pack size. Where no neighbour exists but the Open Food Facts category is known, the median price of that category is used (class E). The range is the 10th-90th percentile of the method's own errors on products whose price is known (leave-one-out, 4,030 products), per confidence class, then checked on a held-out half:

| class | meaning | tested on | typical error | within 25 % | stated 80 % range held (held-out) |
|---|---|---|---|---|---|
| A | very similar products | 948 | 11.6 % | 74 % | 81 % |
| B | similar products | 1,851 | 12.2 % | 70 % | 77 % |
| C | broadly similar | 815 | 18 % | 60 % | 80 % |
| D | rough, few close matches | 416 | 24 % | 51 % | 79 % |
| E | typical for the product type | 1,489 | 29 % | 45 % | 82 % |

A class A/B estimate is typically within about 12 % of the shelf price, a class E one within about 29 %. 11,673 barcodes carry an estimate.

## Coverage (same samples as v79's report, local Workers-compatible server, 2 Nov 2026)
| sample | v79: any recorded price | **v80: price figure of any kind** | of which current recorded | last recorded | estimate |
|---|---|---|---|---|---|
| 300 most-scanned Greek-market products | 58 % | **100 %** | 52 % | 6 % | 42 % |
| 150 random Greek-prefix barcodes | 20 % | **57 %** | 16 % | 4 % | 37 % |

The remaining 43 % of the random sample are products whose Open Food Facts entry has no name, size or category, so nothing can be compared. They show "No verified price" (never a guess).

## Accuracy checks
* **Live shop pages vs bundled seed (2 Nov):** Bazaar 100 of 100 sampled products confirmed on the shop's own page; 3 of 100 bundled prices were already stale and were corrected by the live check (1,12 -> 1,25; 4,40 -> 4,19; 1,80 -> 1,90). Lidl: 0 changes among the confirmed.
* The observatory/barcode links: 794 of 795 independent comparisons agree.
* No invented prices: every recorded price traces to a seed row with its date, and the tests enforce it (estimates are a separate object).

## Tests
38 unit tests (price policy, the real worker handler incl. the live shop check, remote data rules, data integrity, estimator calibration, package consistency) and 24 browser checks (Greek/English at 320/390/1280 px: every price state, action bar, choices, compare, Prices page), all passing on the built tree and on the extracted ZIP; the worker was also run in `wrangler pages dev` (workerd).

## Not verified / limits
* **Not deployed.** Nothing was uploaded; Cloudflare credentials were not used.
* Whether bazaar-online.gr and lidl-hellas.gr answer requests from Cloudflare Workers IPs (they answered from this computer). If they do not, the app shows the dated seed price.
* The daily refresh workflow has not run on GitHub (its steps ran locally except the full crawl, which was run by hand today).
* An estimate is not a price: shelf prices differ by store and day; the observatory price is a national chain price; web-shop prices are online prices; Lidl shows its default region.
* Open Food Facts entries without a name, size or category cannot get an estimate.

## Deploy
1. Cloudflare dashboard > Workers & Pages > the project that serves food-scan.gearuptofit.com > Deployments > Create deployment (production), upload the contents of the ZIP (`index.html`, `_worker.js`, `_routes.json` at the root). Direct-upload deployments created on a non-production branch are previews and do not change the live site.
2. `node tools/verify-deploy.mjs https://food-scan.gearuptofit.com 80.0.0` must print "All checks passed". If it still says 52.0.0 the upload went to a different project or to a preview.
3. Optional, for daily updates: copy `price-refresh/` and `.github/workflows/refresh-prices.yml` from the source bundle into the repository and run the workflow once (Actions > Refresh prices).
4. Leave `FS_KRITIKOS` unset unless Kritikos has given written permission. `FS_SHOP_LIVE=0` switches the live shop checks off; `FOODSCAN_PRICE_DATA_URL=off` switches the published-data refresh off.
