# Prices: what exists, what it covers, and what would add more (measured 5 Nov 2026)

## What the app does today (unchanged by 86.0.0)
Per barcode, in this order: the lowest **current** recorded price (7 days or less); else the last recorded price with its age; else a **labelled estimate** (a range from comparable products, with the measured error of its class); else "No verified price" with the reason. Sources: Open Prices (since 87: a daily snapshot of the official dumps, 120 days, plus one live request per scan for prices added after the snapshot; any country), and for Greece the Ministry of Development price observatory (10,324 products in about ten chains, no barcodes), the Bazaar and Lidl web shops (barcodes, crawled daily), and e-katanalotis (barcodes, frozen since 16 Jun 2026). A daily GitHub job (`refresh-prices.yml`, runs every day, all recent runs succeeded) publishes the data to the `prices-data` branch.

## Coverage of the Greek catalogue (12,137 products), from the published data of 5 Nov 2026
| | products |
|---|---|
| recorded price of the last 7 days (Bazaar 1,807, observatory-linked 842, Lidl 44) | 2,071 (17.1 %) |
| older recorded price (e-katanalotis, frozen) | about 3 % |
| calibrated estimate only (classes A-E) | 6,048 (49.8 %) |
| nothing | 4,018 (33.1 %) |
Measured error of the estimates (leave-one-out, from `gr-est-v80/manifest.json`): class A and B median error 12 %, C 18 %, D 25 %, E 29 %; the printed ranges contain the true price in 80-86 % of held-out cases.
The observatory links grow by themselves (1,177 barcodes on 2 Nov, 1,450 on 4 Nov) because a barcode is linked to an observatory product only when the same chain's price equals it to the cent, with the same brand and pack size (`price-refresh/refresh/src/pricelink.mjs`).

## What the 33 % "nothing" are
Products with no brand-and-size match in any price source and no Open Food Facts category (3,198 of the 3,899 without an estimate have no pack size on record; 3,462 have no category). Any price shown for them would be a guess.

## Which shops could add recorded prices (checked from GitHub Actions on 5 Nov 2026; read-only, 1.5 s apart, robots.txt respected)
| shop | result |
|---|---|
| ab.gr, kritikos-sm.gr, thanopoulos.gr, masoutis.gr | the search is rendered by JavaScript: no server-side barcode search to call; sitemaps exist |
| sklavenitis.gr | answers 403 to a GitHub Actions request, robots.txt included: not reachable from the refresh job |
| mymarket.gr | server-rendered, robots.txt allows reading, but no usable barcode search was found by the generic check |
| marketin.gr | server-rendered, no search form found |
| bazaar-online.gr, lidl | already crawled daily |
So there is no cheap per-scan barcode lookup on the other chains. Adding one means a crawler per shop (sitemap, then one product page at a time), each needing its own review of robots.txt and terms, tested against the live site, and hours of runtime in the daily job.

## Options, ranked by credibility per effort
1. **Switch on the web price search** (already built in 84, off by default): reads shop pages for a barcode only when nothing is recorded, verifies every price in code, caches in D1. Needs Firecrawl and Anthropic keys and the prices D1 database (`SETUP.md`). It is the only option that can reach "any product" in "any country", at a per-lookup cost with a daily cap.
2. **Open Prices contributions**: the add-a-price flow already uploads to Open Prices (needs the shopper's Open Food Facts login). Every contribution is then visible to everyone, worldwide, with no FoodScan infrastructure. A "contribute with one tap" flow would raise it; it still depends on shoppers.
3. **One more crawler at a time** (mymarket.gr and marketin.gr are the candidates that answered): each adds only the products that shop sells with a barcode on its pages; needs the shop's pages inspected from Actions first.
4. **More anchors for the observatory links** (still open after 87; the 87 snapshot holds only 11 Greek observations from the last 120 days, so the gain is small): Greek Open Prices observations could anchor barcode-less observatory products by the same price-to-the-cent rule. Gain unknown until measured on real data.
