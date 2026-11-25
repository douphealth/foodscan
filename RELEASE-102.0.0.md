# FoodScan 102.0.0 — release notes (25 Nov 2026)

102.0.0 makes every part of the app agree on **where the shopper really is**, in any country, and never guess Greece when nobody knows.
It is built on 101.1.0 ([`RELEASE-101.1.0.md`](RELEASE-101.1.0.md)). **Not deployed:** the live site is still 100.1.0.

## What changed

**One location order, used by every page.** The price card, the Prices page, the swaps, the label reader and the Home hub all ask `detectMarket()` (`prices/market-v83.mjs`):

1. the shopper's own choice (kept on this device, and mirrored to the food profile so prices and food choices agree);
2. the network's country (the edge adds `<meta name="fs-country">`; the last answer is remembered, because a cached page shell has none);
3. the country of the phone's time zone, when the network cannot say (Tor, a privacy relay);
4. the region of the browser language (`en-US`, `pt-BR`, `zh-Hant-TW`), labelled as a guess;
5. nothing: the app asks. It never assumes Greece.

Where the country came from is shown on Home ("from your connection", "from your phone's clock", "your choice", "a guess from your language").

**A roaming phone is offered, never switched.** If the network says one country and the phone's clock another (a roaming SIM, a VPN), Home offers the phone's country with "Use X / Keep Y" (opened and tapped in a browser). The price card has the same offer in code (`prices/native-v83.js`), which was not opened in a browser. Declining is remembered for that pair only.

**The worker no longer invents Greek prices.** When Cloudflare says the country is unknown (`XX`, Tor's `T1`, an unusable code) both price routes (`/api/prices/compare`, `/api/prices/peek`) answer `market_unknown` with no offers, `Cache-Control: no-store`, and no price source is asked. An explicit `?market=` still wins. Only a runtime that supplies no geolocation at all (a local preview, the tests) keeps the old Greek default.

**Home hub.** A "Prices and portions for 🇩🇪 Germany · your choice" row with a country picker (245 countries; names in Greek or English on Home, in all six app languages on the Prices page), the offer above, and a clear "Where are you shopping?" card when nothing is known. A new phone sees it first. The one-tap drink sizes follow the country: US cup 240 ml and can 355 ml; Canada and Mexico can 355 ml; Japan and Brazil can 350 ml; Australia can 375 ml; 330 ml elsewhere. The product's own pack size always comes first. Changing the country on any page refreshes the hub's price lines.

**Time zone table.** `prices/tz-country-v102.mjs` is generated from the IANA tz database 2024a by `tools/build-tz-country.mjs`: 418 zones in 247 countries plus 70 old names (`Asia/Calcutta`). `node tools/build-tz-country.mjs --check` verifies the committed table (no zone in two countries, every old name resolves, counts match).

**Prices page.** It uses the shopper's own calendar day (it used Athens time), takes the country from the shared answer instead of its own Greek fallback, and shows a "Which country are you in?" page when nothing is known.

## Defects found and fixed while testing this release

1. **"Automatic" never took effect after a country had been chosen** (`prices/market-v83.mjs`). Choosing a country also wrote it to the food profile, and the profile ranks above the network, so going back to "Automatic" kept the old country for ever. Now it resets the profile's country to `any`.
2. **`zh-Hant-TW`, `zh-Hans-CN`, `sr-Latn-RS` named no country** (a script subtag between language and region was not parsed).
3. **Serbia appeared twice in the picker**: the retired code `YU` (Yugoslavia) is named "Serbia" by the browser. `YU` is no longer offered. A Serbian profile still resolves to `RS`.
4. **`tools/build-tz-country.mjs --check` was documented but rejected its own flag.** Implemented.
5. Four tests pinned behaviour this release replaces (the old "time zone and language are never used" test also depended on the time zone of the machine running it). Updated or replaced; the new rules are pinned in `qa/location102.test.mjs`.

## Verified

- `node --test qa/*.test.mjs`: 228 of 228 pass (218 before, 11 new in `qa/location102.test.mjs`, one obsolete test replaced).
- `node build.mjs --check`: the 23 source modules rebuild `_worker.js` byte for byte. `node tools/build-tz-country.mjs --check`: OK.
- The zip (286 files: 101.1.0's 285 plus `prices/tz-country-v102.mjs`) was extracted into a clean folder and run in Cloudflare's local `workerd`; `price-refresh/tools/verify-deploy.mjs` reports "All checks passed" at release 102.0.0. It asks for FR, US, GB and JP: each answers in its own currency and no Greek source is consulted. For the test barcode they returned 1, 0, 0 and 0 recorded offers, which is the sparsity described below, not a fault.
- In a browser against the real worker (Cloudflare's local `workerd`), phone width: Greece's amounts (330 ml pack, 200 ml glass, 250 ml cup, 500 ml bottle) become Japan's (can 350 ml) and the US's (cup 240 ml, can 355 ml) when the country is changed from Home; "Automatic" returns to the connection's country and clears the profile; the roaming offer appears with a phone clock set to Madrid and a Greek connection, and "Use Spain" switches; with no connection country, a UTC clock and a bare `en` language, the "Where are you shopping?" card appears; the row and the country names render in Greek.

## Not verified, and limits

- **Not tried on a real phone, and not on real Cloudflare.** `request.cf.country` is Cloudflare's own value; the local runtime supplies a fixed one.
- **The unknown-country state of the Prices page and the price card was not opened in a browser.** Their code and strings are in place (all six languages have every string, counted), and the worker side is tested. The French, German, Spanish and Italian strings are hand-written, not machine-translated, and still need a native speaker.
- **`/prices/` is a static page served outside the worker** (`_routes.json` does not include it), so it cannot carry the country tag. A first visit straight to `/prices/` uses the phone's clock, then the language; visiting Home first teaches the device the network country. Routing it through the worker would change its security headers, which cannot be tested here.
- **Flag emoji are drawn as two letters on Windows browsers** (the platform has no flag glyphs). The country name is always shown.
- **Prices outside Greece come from Open Prices, a community database.** Coverage varies enormously: many countries will have few or no recorded prices, and the app says so rather than showing another country's. The bundled daily-refreshed chain data is Greek.
- **Grades do not depend on location** (one published Nutri-Score method), but the quality of the underlying Open Food Facts record does vary by country.
- WHO limits and EU label references are the same everywhere; portions are the only part of the daily check-in that follows the country.
