# FoodScan 90.0.0: prices in every list, and "cheaper per kg" on healthier swaps

Base: FoodScan 89.0.0 (`main`, eeb3c50). Prices appeared only on the product page and in the Prices tab; search and category lists and the healthier-swap rows showed none.

## What changed
- **`GET /api/prices/peek?codes=a,b,…`** (worker, `src/worker/prices.js`): prices for up to **5 barcodes per request** from the **daily data only**: the Open Prices snapshot (no live request), the observatory and web-shop seeds (no live re-read of the shop page), e-katanalotis history. Every barcode goes through the same payload builder as the product page (`fsPriceBuildPayload`: pack-size checks, the outlier guard, freshness tiers, cheapest per chain), so a list never shows a price the product page would not rank. Answers are cached at the edge for 10 minutes. Five barcodes is the subrequest budget of a Worker on Cloudflare's free plan (each barcode reads up to about nine data files).
- **`prices/list-prices-v90.js`**: search and category rows and healthier-swap rows show the lowest current recorded price, the store and the unit price ("1,75 € · Bazaar · 9,72 €/kg"), or the last recorded price marked "older · date". Only rows on screen are asked; rows that appear together go out together. No price is estimated.
- **Healthier and cheaper:** a swap row says "€4.40 cheaper per kg" (or dearer) than the product on the page when both have a current unit price on the same basis (kg with kg, litre with litre); nothing is compared otherwise. A swap that is healthier and cheaper is highlighted.

## The healthier-swaps card, redesigned (after the owner's desktop screenshot)
On desktop the card sits in a column of about 440 to 620 px, but its list switched to two columns on the WINDOW width (900 px and up): each row was about 280 px wide, names were cut after one word, "3 grades better · same shelf" wrapped word by word and the grade badge overlapped the text. Now (`prices/swaps-v88.css`, `prices/swaps-ui-v88.js`):
- two columns only when the CARD itself is at least 720 px wide (a container query); one clean row otherwise: photo | name (two lines), brand, pills | grade badge, with the price on its own line under a hairline;
- "3 grades better" and "same shelf" are separate pills; the badge reads "B / Nutri-Score" (or "calculated" for a grade FoodScan calculated), the caption is dropped on narrow cards;
- measured in the real app at 1440, 390 and 320 px, light and dark: one column, no text under the badge, no horizontal overflow, the price lines of the cola swaps shown (0,55 € Bazaar, 1,18 € My market, 0,83 € Μασούτης older).

## Checked
- `qa/list-prices.test.mjs` (4 tests): peek gives every barcode exactly the product page's lowest current price; no live request; a suspect crowd price (0.04 € among ~4 € prices) never shows; more than five barcodes or an invalid one is refused; older prices are marked; unit prices are compared only on the same basis.
- In the real app (local worker, Greek visitor): a "papadopoulos" search shows 1,75 € Bazaar (9,72 €/kg), 1,59 € Bazaar (7,95 €/kg), 1,90 € Χαλκιαδάκης (12,67 €/kg) next to published and estimated grades; 7 rows were asked in 2 requests. Rows of products with no recorded price (e.g. the Greek yogurts of the 89 screenshot) show no price line, and the product page agrees (`no_data`).
- 128 tests pass; `node build.mjs --check` OK. Not checked on the live site.

## What limits prices (said plainly)
Price coverage is the sources': on 5 Nov, 17.1 % of the 12,137 catalogue products had a recorded price of the last 7 days (Bazaar, observatory links, Lidl) and about 3 % an older one (`PRICE-COVERAGE.md`). Lists now show all of them; they cannot show more than exists. More coverage needs more sources, which is the owner's decision:
1. **Switch on the web price search** (built in 84, off): needs the Firecrawl and Anthropic keys and the prices D1 database (`SETUP.md`); it reads shop pages only when nothing is recorded, verifies every price in code, has a daily spending cap.
2. **A crawler per chain** (Sklavenitis, My market, AB, Masoutis): their sites render search with JavaScript or offer no barcode lookup (checked from GitHub Actions for 87); each needs a review of robots.txt and terms, a sitemap crawler and hours of daily runtime. They could not be reached from the development sandbox.

## Grades and photos
No new source was found that could add grades or photos credibly: 1,511 catalogue products still have nothing (no numbers, nothing similar by name, brand, maker, family or category), and 3,054 have no photo anywhere on Open Food Facts (89).

## Rollback
Revert the merge; or remove `list-prices-v90.js` from `index.html` (lists show no prices; the peek endpoint stays unused).
