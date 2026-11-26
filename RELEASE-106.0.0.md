# FoodScan 106.0.0

Product photos: why so many products showed a drawing or a poor photo, and what this release does about it.

No grade or price rule changes. Every number below was measured; where it was measured is stated.

## What was measured

| What | Measured | Where |
| --- | --- | --- |
| Catalogue products with no front photo on record | 3,380 of 12,137 (27.8 %) | the bundled Greek catalogue |
| Of those, products with a published grade | 260 | the bundled Greek catalogue |
| Photo-less products for which Open Food Facts holds any other photo | 185 of 3,250 asked on 6 Nov (5.7 %) | the photo index built in 89.0 |
| Spot check today: first 150 photo-less barcodes | 21 have some photo (17 already in the index, 4 new), 129 have none | Open Food Facts API, 26 Nov |
| Photo-less products a Greek shop lists (Bazaar 183, Lidl 9) | 192 at most | the bundled shop price files |
| Search for "γιαούρτι" on the live 105.0.0, phone width | 16 drawings in the first 20 rows | browser |
| Photo size requested | 200 px everywhere, the product page included | the code and the browser |

The spot check stopped at 150 products: Open Food Facts answered 503 on its search endpoint and then 429 on its product endpoint, so the full
re-read of all 3,380 was not done. The first 150 barcodes are not a random sample (they are the lowest numbers, mostly imported products).

## The two findings

1. **Most missing photos are missing at the source.** For roughly nine in ten photo-less products, Open Food Facts holds no photo at all,
   and the shops list only 192 of them. No change in the app can show a photo that does not exist.
2. **The search put the barest records first.** Matches were ordered by how short their text is. A record called just "Γιαούρτι", with no
   brand, no photo and no published grade, has the shortest text, so it beat every documented yogurt. The first screen was drawings even
   though photographed products were a scroll away.

## What 106 changes

- **Search order.** Relevance still decides first (the name starts with the query, then contains it). Among equally relevant rows, the
  complete records now lead: a real photo, then a published Nutri-Score, then a brand. Nothing is dropped from the results; the bare records
  are further down. The search index has a fifth column for this (`assets/search-index-v106.json`, `tools/build-search-index.mjs`).

  First page of twelve common Greek searches, products with a photo (offline, same catalogue, before and after):

  | Search | Before | After |
  | --- | --- | --- |
  | γιαούρτι | 4 of 20 | 18 of 20 |
  | γάλα | 10 of 20 | 20 of 20 |
  | μέλι | 10 of 20 | 20 of 20 |
  | ρύζι | 11 of 20 | 19 of 20 |
  | chocolate | 13 of 20 | 20 of 20 |
  | σοκολάτα | 15 of 20 | 20 of 20 |
  | ψωμί | 10 of 20 | 15 of 20 |
  | χυμός | 10 of 20 | 13 of 20 |
  | μπισκότα | 13 of 20 | 15 of 20 |
  | τυρί | 7 of 20 | 8 of 20 |
  | καφές | 8 of 8 | 8 of 8 |
  | ελαιόλαδο | 14 of 19 | 14 of 19 |
  | All twelve | 125 of 227 (55 %) | 190 of 227 (84 %) |

  Published grades on those first pages went up with it (γιαούρτι 1 to 15, γάλα 7 to 20).

- **A sharper product photo.** Open Food Facts keeps each photo in several sizes. The app now tells the browser about the 400 px file as
  well as the 200 px one. Fixed sizes are declared, so lists keep the light 200 px file and the product page takes the 400 px one on sharp
  screens. (`sizes="auto"` was tried first and rejected: the browser picked the 400 px file for 40 px list boxes.)
- **The photo opens large.** Tapping the product photo (or Enter on it) opens it large with its credit. A photo chosen as the front may load
  its full-size file on sharp screens; an unselected upload stays at 400 px, because its original can weigh megabytes.
- **One live look for a product page that still shows the drawing.** The browser asks Open Food Facts once for that product's photo list and
  shows the best real photo it holds: the front chosen for another language, else the earliest upload that is not thumbnail-sized, else a
  packaging photo. The answer is remembered for the visit.
- **A confirmed "no photo" says so.** When Open Food Facts confirms it holds no photo, the page says so and links to the product's edit page
  there. Adding one is the only real fix, and it then shows in every app that uses the database. A failed or offline lookup shows nothing.
- **A slow photo no longer looks like a missing one.** A photo box is white. While its photo is on the way it now shows a faint package mark.
- **Photo index:** 185 to 189 products (the four found in the spot check). The build tool and the browser now share one rule
  (`bestPhotoFile` in the engine); it prefers the record's own language and skips a thumbnail-sized upload.

## What it does not do

- **It does not improve a poor photo.** Many photos are a contributor's phone shot: a shelf, a kitchen table, sometimes the back of the pack.
  When nobody chose a front photo, the app shows the first upload, which is not always the front. Nothing here judges what a photo shows.
- **It does not use shop photos.** They are the shops' own images, the price files do not carry them, and they would cover 192 products.
- **Search outside the Greek catalogue is unchanged.** Other countries search Open Food Facts live, which already orders by popularity.

## Files

- Engine (`src/domain/model.js`, `assets/domain-v106.mjs`, `_worker.js` rebuilt): `photoSet`, `photoURL`, `bestPhotoFile`.
- `assets/chunk-2OB4V521-v106.js`: the photo component declares the sizes.
- `assets/market-catalogue-v106.mjs`, `assets/search-index-v106.json` (was `search-index-v101.json`), `tools/build-search-index.mjs`.
- `prices/fill-v89.js`, `prices/native-v83.css`: live look, "no photo" note, large view, loading mark.
- `assets/photos-off-csv-2026-10-30.json` (address now `?v=106`), `tools/build-photos.mjs`.
- The 49 year-cached asset files are renamed from `-v104` to `-v106`, because the engine and the photo component changed.

## Checks

- Tests: `qa/photos106.test.mjs` (8 new). Full suite: 280 of 280 pass (272 before, 8 new).
- The zip (286 files, the same list as 105 with the renamed assets) was extracted and run in Cloudflare's local runtime: `verify-deploy.mjs`
  passes for 106.0.0, the new search index and photo index answer 200, and the old `-v104` and `search-index-v101` names answer 404.
- Browser, local copy, phone width: the search page (20 photos in the first 20 rows for "γιαούρτι", with the photo index), a product with a
  confirmed "no photo" (note and link), a product whose photo came from the live look, and the large view (opened, closed).
- Not checked: a real phone; real Cloudflare; the photo sizes a 3x phone screen actually picks; the French, German, Spanish and Italian
  sentences (machine-quality, need a native reader). During the check Open Food Facts was rate-limiting this connection, so photos took
  about 6 s each to arrive here; that is this connection, not the app.

## After deploying

A tab left open on 105.0.0 needs one reload, because the asset files have new names.
