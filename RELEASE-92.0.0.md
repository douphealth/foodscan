# FoodScan 92.0.0: web price search with webclaw, prices read by code (no AI, no Firecrawl)

Base: FoodScan 91.0.0 (shared shopper confirmations; both ship together). The owner asked to use webclaw.io for the web price search and not Firecrawl or Anthropic.

## What changed (`src/worker/webprices.js`)
- **`WEBCLAW_API_KEY`** (Cloudflare secret) switches the web price search to webclaw; it wins over Firecrawl + Anthropic, which are then never called. The search still runs only for a barcode with **no current price** from the free sources, in the shopper's country.
- One lookup = **one webclaw search for the barcode itself** (`POST https://api.webclaw.io/v1/search`, country and language of the market, result pages scraped by webclaw).
- **The price is read by code, not by a model.** A page counts only if: its domain is of the shopper's country (".gr" for Greece; generic .com pages are not used); it is not a trade (B2B), comparison, nutrition or official-data site; **this barcode is printed on it**; its product heading names a pack size; exactly one price is attached to the product (the first euro amount after the heading, or right after the barcode). Per-kg / per-litre / per-100 g prices, struck-through old prices and other products' prices further down are ignored; two different prices side by side make the page ambiguous and it is skipped.
- Then the 84 verifier checks it exactly like before: the price, the title and the pack must be on the page, the barcode on the page, the country right, the pack equal to the label's; sold-out items are dropped.
- Credits: answers are kept 3 days (7 days when nothing was found); at most `FS_WEB_DAILY_LIMIT` new lookups a day, default **20** with webclaw. `/api/prices/status` says which engine is on.

## Measured on 11 Nov 2026 (the worker's own code, live webclaw searches, 26 lookups)
- **Accuracy: 8 prices accepted, 0 wrong.** Each accepted price sits next to the barcode and the product heading on the shop's page (Mini Stop Kiosk, fastmarket.gr, Ionion Market, zoyashop.gr).
- **Products with a known price** (6): a webclaw price for 3, from other shops (e.g. ΔΕΛΤΑ Life orange juice 1 L 3,68 € at fastmarket.gr, the same as Bazaar; Caprice 250 g 4,30 € at a kiosk, where supermarkets are 3,08–3,26 €; prices are shown by shop).
- **Products with no price in any FoodScan source** (20: 15 random branded Greek products + 5 Greek yogurts): a price for **5 (25 %)**, e.g. Υφαντής burgers 450 g 4,58 € and 640 g 5,85 € (Ionion Market), ΙΟΝ milk chocolate 270 g 5,84 € (fastmarket.gr), BDL organic linseed 300 g 2,60 € (zoyashop.gr), Lay's chorizo 95 g 1,80 € (Mini Stop Kiosk). The 5 yogurts got none: no page on the web prints their barcodes.
- Over the 3,961 branded Greek catalogue products with no price, that suggests roughly 1,000 could get one (a projection from 20, not a measurement).
- Rejected correctly: a Cyprus shop, a manufacturer's B2B site, sold-out items, pages without the barcode. Two extractor bugs were found by the new tests and fixed before release (a real price written right after a struck-through one was skipped; `https://b2b.…` slipped past the B2B block).
- Chains: none of these pages are big chains; Sklavenitis refuses automated access and AB's robots.txt forbids its product pages, so webclaw is not used against them.

## Tests
`qa/webclaw.test.mjs` (4 tests, made-up shop pages, no third-party content stored): the attached price is read and per-kg, struck-through and related-product prices are not; no barcode, no pack, two prices side by side or sold out give no price; another pack size than the label is refused by the verifier; with only `WEBCLAW_API_KEY` the search is on, makes one webclaw call with the barcode and `country: gr`, never calls Firecrawl or Anthropic, and a Cyprus or B2B page never counts. 136 tests pass; `node build.mjs --check` OK.

## To switch it on (owner)
Cloudflare Pages → Settings → Variables and Secrets → add the **Secret** `WEBCLAW_API_KEY` (the `wc_…` key; never in the code or the repository), plus the `FOODSCAN_PRICES_DB` database (`SETUP.md` steps 1-2, 4); redeploy. The key used for the tests came from the file the owner uploaded to the development session; it was read only at request time and is not stored anywhere in the repository.

## Rollback
Remove the `WEBCLAW_API_KEY` secret (the search turns off, or falls back to Firecrawl + Anthropic if those exist), or revert the merge.
