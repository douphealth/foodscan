# FoodScan 83.0.0: prices in the shopper's own country and currency

Base: FoodScan 82.0.0 (main, 3 Nov 2026).

## Why
Up to 82 the price system was Greece only, by construction: the worker dropped every Open Prices observation that was not in euro, the "nearby" search refused any coordinate outside a Greek box, the client formatted every number as euro and kept only offers with `countryCode === 'GR'`, and "today" was the Athens calendar day. A shopper in France, the UK, the US or Japan therefore saw "No verified price" for everything the Greek sources did not know.

## What changed
### One market per request, and what it decides
- The market (country) is, in order: the shopper's own choice on the price card ("Change"), the country chosen for food choices in the app profile, the network country (`<meta name="fs-country">`, set by the edge), the browser language region; the worker falls back to its own `request.cf.country`, then to Greece. The app sends it as `?market=XX`.
- Only observations made **in that country** and **in that country's currency** can be ranked ("cheapest"). Observations from other countries are listed separately as "seen elsewhere", each in its own currency. **Nothing is converted, estimated or guessed.**
- Greek official and web-shop sources (observatory, Bazaar, Lidl, e-katanalotis) are consulted only for the Greek market. Outside Greece they are not part of the answer, so no phantom "source unavailable" noise.

### Any currency
Open Prices observations in any ISO-4217 currency are accepted and kept as recorded. A built-in country-to-currency table (196 of the 245 listed countries; the table is duplicated in the worker and the client and a test checks the two are identical) decides which currency is "the market's". Countries not in the table use the most common currency of their own observations. Big-number currencies (JPY, KRW, VND, IDR, HUF ...) have a higher sanity ceiling. Money is written in the market's style: `$4.99`, `£3.69`, `¥598`, `€3.29`; a foreign currency keeps its long form (`US$4.99`) so it cannot be mistaken for a local price.

### Dates
Outside Greece "today" is the UTC day. A price dated exactly one day ahead (a shop east of UTC) counts as today; two or more days ahead is rejected as mis-dated. Greece keeps the Athens day.

### Reading Open Prices for the right country
A popular product has thousands of observations from dozens of countries, so the newest 300 may hold none from the shopper's country. The worker now asks for the shopper's country first (a country filter, up to 200 newest) next to the newest 100 worldwide, and every observation is re-checked (country, currency, date, proof) whichever way it arrived. If the API rejects the filter (HTTP 4xx), it falls back to the plain newest-300 read used by 82. The browser-side fallback (when FoodScan's own service is unreachable) does the same.

### Accuracy guards that are new
- **Unusual-price guard.** A community price below half, or above 2.5 times, the median of at least three OTHER stores' prices for the same barcode, currency and pack basis is flagged "unusual", never ranked and never counted. A real promotion (a discounted price whose crossed-out regular price is in the normal band) stays. The same rule drops probable typing mistakes from "seen elsewhere" (a Greek shopper no longer reads "seen in France: EUR 0.39").
- **Typical price.** When at least 3 stores recorded an unconditional shelf price in the last 90 days, the card shows their median and range, with the number of prices and chains. It is a statistic of this barcode's own recorded prices, never an estimate from other products.
- A price in another currency than the market's never ranks, and is never "the last recorded price".

### Interface
- The price card says whose prices these are ("🇫🇷 Prices in France · EUR") with a one-tap country picker (native list of 245 countries, flag and localized name, Automatic). The choice stays on the device; every price is asked again for the new country, and an answer for a country the shopper has left is dropped.
- Typical price row; "All prices · N current, M older" now counts this market's usable prices only.
- The Prices page follows the market: headline, scope pill ("All of France"), the chain grid lists the chains that have a price in that country, a country picker, the right currency, the unusual-price tag, no Greek-only footer. Greek wording and the Greek chain grid are unchanged for the Greek market.
- "Add a price you saw" and "My price notes" (Greek chains, euro, OCR tuned for Greek labels) stay Greece only; elsewhere the Prices page links to the product on Open Prices instead of offering a form that would record the wrong currency or chain.

## What was checked, and what was not
Checked (all in this repository, `node --test qa/*.test.mjs`, 29 tests; they run the real `_worker.js` against a fake Open Prices API and fail on the 82 worker for the worldwide cases):
- French, American, British, Japanese, New Zealand, Spanish, German markets: ranking, currency, other-country separation, old prices, future dates, missing proof, nearby, rejected filter, Open Prices outage ("temporarily unavailable", never "no data").
- **Greece is unchanged:** old and new workers return identical payloads on 313 real Greek barcodes taken from the bundled observatory, Bazaar, Lidl and e-katanalotis seeds (only the new fields differ).
- Nutri-Score 2023: hand-computed cases (general foods calculated exactly; drinks and fats verified against published points; a contradictory grade is withheld). The tables in the worker were compared with the published method and match.
- In a real browser (Chromium, 320 / 360 / 390 / 1280 px, English and Greek, six markets): no overflow, no script errors, picker works and persists across reload.
- `price-refresh/tools/verify-deploy.mjs` now also checks four markets and passes against a local emulator of the Pages worker.

**Not verified (this build environment could not reach the internet apart from GitHub):**
- Live Open Prices responses. The fixtures follow the response shape the 82 code already read in production. The country filter name `location__osm_address_country_code` is from memory of the Open Prices API; if it is wrong the API either ignores it or answers 4xx, and both cases fall back to the 82 behaviour automatically (tested). Run `node price-refresh/tools/verify-deploy.mjs https://<site> 83.0.0` after deploying.
- That Open Prices has observations for a given product in a given country. Coverage is community-driven and differs by country and product.
- Deployment. Nothing was uploaded.

## Not solved by this release
- **No source gives a shelf price for every barcode in every country.** Where Open Prices has nothing recorded in the shopper's country the card says so and shows the last price seen elsewhere in its own currency. FoodScan still never guesses a price. Closing the gap needs more data, not more guessing: licensed retailer or aggregator feeds per country (the existing D1 import path accepts them), national open price datasets where a government publishes them, and contributions to Open Prices.
- Currency conversion is deliberately absent: a converted price is not a recorded price.
- The photo flow "Add a price" and personal price notes are not yet available outside Greece.

## Assets and rollback
New files: `prices/market-v83.mjs`, `prices/price-core-v83.mjs`, `prices/price-client-v83.mjs`, `prices/native-v83.js|css`, `prices/prices-v83.js|css`, `qa/`, `.github/workflows/qa.yml`. The `-v80` files stay in place. The service worker is `foodscan-83.0.0`; a phone on 82 reloads into 83 on its next visit. **Rollback:** redeploy the previous commit (`23f9863`); nothing is stored server side, and the device keys (`foodscan:prices:v83:*`, `foodscan:market:v83`) are ignored by 82.

## Check
`node price-refresh/tools/verify-deploy.mjs https://<site> 83.0.0`
