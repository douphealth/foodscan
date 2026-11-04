# FoodScan 83.2.0: one country on every page, and a plain barcode search

Base: FoodScan 83.1.0 (main, 4 Nov 2026). Both problems were reported on the live sites.

## 1. "All prices · 11 current" opened a page with "No verified price" until the country was chosen again
**Cause (reproduced).** The product card asked FoodScan's server for prices without naming a country, and the server used the visitor's network country (Greece). The Prices page named a country itself, taken from the browser language ("en-US" became "United States") or the device time zone. A Greek shopper on an English-language phone therefore saw 10 Greek prices on the card and "All of United States, 0 prices, Open Prices answered · no price" on the next page, until the country was picked by hand.

**Fix.** Only explicit signals are used on the device now: the country the shopper picked, or the country in the app profile. Otherwise nothing is sent and the server decides from the network country, the same answer on every page. Browser language and time zone are never used.
Measured (emulated worker, Chromium): a French visitor on an en-US phone in the Chicago time zone sees France on the card (EUR 3.29) and on the Prices page (EUR 3.29, "All of France"); after choosing the United States on the card both pages show USD 4.99. A Greek visitor on an en-US phone: card 10 current + 5 older, Prices page 15 prices, cheapest EUR 3.08, no selection needed.
Also: until the first answer says which country it is, the Prices page headline and scope pill stay generic ("Your country") instead of flashing Greece; switched-off sources ("FoodScan D1 not enabled") are no longer listed in "Sources checked".

## 2. "Check live prices online" often did not find the right product
**Cause.** The link added `tbm=shop` and `gl=<country>`; Google answered with its shopping view (`udm=28`), which ranks other products first. The bare barcode search returns the right product and its shops.
**Fix.** The link is now exactly `https://www.google.com/search?q=<barcode>`. The barcode is written as printed: padding zeros are removed (a 13-digit EAN starting with 0 is searched as the 12-digit UPC-A; EAN-8 stays 8 digits). The note under the link says those prices are the shops', not FoodScan's.

## Checks
`node --test qa/*.test.mjs`: 34 tests (new: the link has no `tbm`/`udm`/`gl`, barcode forms, and the market is the same on every page even where the browser language is en-US).

## Not verified
Live Google results (the build environment reaches only GitHub); the plain-barcode form is the one you reported as working.

## Rollback
Revert the merge commit or redeploy 83.1.0 (`1d57c7a`). Nothing is stored server side.

## Check
`node verify-deploy.mjs https://<site> 83.2.0`
