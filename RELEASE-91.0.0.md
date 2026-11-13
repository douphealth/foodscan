# FoodScan 91.0.0: shared shopper confirmations — each confirmed product unlocks the observatory's daily chain prices for everyone

Base: FoodScan 90.0.0 (`main`, 47af380).

## Why
The Ministry of Development price observatory (posokanei.gov.gr) is already read every day: 10,342 products with dated prices from about ten chains (AB, Sklavenitis, Masoutis, My market, ΣΥΝΚΑ, Galaxias, Bazaar, …). It publishes **no barcodes**, so its prices can appear for a scanned barcode only once the barcode is linked to an observatory product; 1,454 are, and the price-anchored linking is nearly exhausted (18 new candidates in its last run). Measured on 11 Nov: matching by Open Food Facts names agrees with every known link it reaches (102 of 102) but finds only 12 new ones. Scraping the chains does not help either (checked from GitHub Actions and with webclaw on 11 Nov): Sklavenitis refuses automated access, AB's robots.txt forbids its product pages, and Masoutis and My market load products in the browser, where webclaw returned no product, barcode or price.

FoodScan already asks the shopper, for an unlinked barcode, "Is it one of these?" (82), but the answer stayed on that device.

## What 91 does
- **`POST /api/prices/confirm`** (worker, `FOODSCAN_PRICES_DB`): "This is it" is also a vote (`1`); undo withdraws it (`0`); "Not this product" disputes a shared link (`-1`). A vote is accepted only when:
  - the observatory product is one of the candidates FoodScan itself offered for that barcode (from the daily build);
  - the barcode has no observatory link of its own;
  - the observatory pack size matches the barcode's (the catalogue's label, else the size written in the barcode's own record name, e.g. "… 24/330G"); with neither known, the choice stays on the device;
  - the voter (a salted SHA-256 of the network: /24 IPv4, /48 IPv6, so one household counts once; no address is stored) has fewer than 30 votes in the last 24 hours;
  - the request comes from the site itself (cross-site requests are refused).
- **A link is shared with everyone** when at least `FS_CONFIRM_MIN` (default 2) different voters confirm the same product, disputes stay under half of the confirmations, and no other product of that barcode has as many confirmations. It switches off again when disputes reach half.
- **Then the product page and the lists** (search, categories, swaps) show that product's own dated chain prices for the barcode, labelled "confirmed by shoppers", with "Not this product". Every price still goes through all the payload checks (pack size, freshness, outlier guard).
- The card tells the voter where things stand: "Saved for everyone: 1 of 2 confirmations…", "Shared with everyone: confirmed by 2 shoppers", or, without the database, "Kept on this device only…".

## Checked
- `qa/shared-confirm.test.mjs` (real SQLite, the real schema file, the real bundled candidate and observatory shards): without the database the server says `not_configured` and the device choice still works; one vote is pending; a second vote from the same /24 counts once; a voter on another network shares the link; the product page then shows the confirmed product's observatory prices and no candidates; lists show them too; one dispute against two confirmations switches the link off; a product FoodScan did not offer is refused; a 200 g product for a 330 g barcode is refused (`pack_mismatch`); a vote can be withdrawn; a cross-site request is refused (403).
- In the real app (local worker, Greek visitor, real SQLite): shopper 1 taps "This is it" on ΥΦΑΝΤΗΣ ΠΑΡΙΖΑΚΙ 330G and reads "Saved for everyone: 1 of 2 confirmations"; after a second shopper on another network confirms, a new visitor sees €4.30 Γαλαξίας, €4.78 Μασούτης, €4.99 AB (typical €4.78) and "Prices of the product 2 shoppers confirmed as this one: ΥΦΑΝΤΗΣ παριζάκι γαλοπούλα 330g · Not this product". No page errors.
- 132 tests pass; `node build.mjs --check` OK. Not checked on the live site (it needs the database).

## To switch it on (owner)
`SETUP.md` steps 1-3: create the D1 database, run `d1-schema/prices_db.sql` in its console, bind it as `FOODSCAN_PRICES_DB`, add the secret `FS_CONFIRM_SALT` (a long random string), redeploy. The same database also serves the web price search (steps 4-5).

## Rollback
Revert the merge. Without the database binding the feature is inert: votes answer 503 and nothing changes for shoppers.
