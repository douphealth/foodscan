# FoodScan 83.1.0: live upgrade of products the saved catalogue cannot grade

Base: FoodScan 83.0.0 (main, 4 Nov 2026).

## What the audit found
For the 12,137 Greek products in the bundled catalogue the app **never consulted the live source**: the product lookup took the device copy, then the bundled snapshot, and stopped there. The snapshot is a dated export (30 Oct 2026) with no category tags and no per-100-g marker, so FoodScan, which will not guess a grade, could grade only **33 %** of those products (4,035 of 12,137). 7,835 showed "No grade", and 267 "Grade on hold". A live Open Food Facts record carries the categories, the ingredient-based fruit/vegetable estimate and every correction made since the snapshot, so for most of the gradeless ones a grade can be calculated with the official method.

## What changed
- **Live read first, only where it helps.** When the device copy or the snapshot has **no source Nutri-Score**, the live record is requested first: through FoodScan's server (`/api/product/<code>?refresh=1`, edge-cached and rate-limited) and directly from the source, in parallel, first good answer wins, within **2.6 s**. A record that already has a source grade is never delayed (no live call at all).
- **The snapshot is always the fallback.** Source slow, down, rate-limited, offline or the record absent: the snapshot is shown as before. After a failure live reads pause for 2 minutes (a source that does not have the barcode is an answer, not an outage), so a hanging source costs a shopper the 2.6 s budget **once**, not on every scan.
- A live record wins over a catalogue snapshot only if it is complete and fresh (the existing `fresh()` / `chooseRecord()` rules); it is then kept on the device like any other checked record.
- Nothing about grading changed. FoodScan still calculates only where the method allows it and says so ("Calculated by FoodScan ... because the source has no grade"); a record whose fruit/vegetable share is unknown can still end with "No grade".

## Measured (local emulator of the Pages worker, Chromium)
| case | result |
|---|---|
| protein bar with no snapshot grade, live record available | shows **D, "Calculated by FoodScan"** instead of "No grade"; hero in 0.8 s |
| same product, source down | snapshot shown in 0.5 s; second visit 55 ms |
| same product, source **hanging** | snapshot after 3.1 s once; the next product 51 ms |
| product with a source grade | 0 live calls, 0.5 s |
| 24 random Greek products | no script errors, no overflow, none slower than 6 s |

## Also in this release
- Prices page: the empty-state text now meets WCAG AA contrast (0 contrast failures in the axe-core audit of the Prices page).
- Barcode scanner benchmarked, **not changed**: the app's own decoder (used where the browser has no `BarcodeDetector`: iPhones, Firefox) read 92-93 % of 240 synthetic barcodes (blur, rotation, noise, low contrast, small size) against 87 % for ZXing compiled to WebAssembly (the usual replacement), so the heavier decoder and the CSP loosening it needs were not added. Weak spot found: a barcode filling only 30 % of the frame (71 %). Hold the phone closer.

## Assets
33 modules copied under new `-v8300` names (`assets/*-v8300.js`, imports rewritten; the `-v8200` files stay so a tab left open on 83.0.0 keeps working); the lookup change is in `assets/chunk-BIWX2LG4-v8300.js`. The service worker is `foodscan-83.1.0`.

## Not verified
Live Open Food Facts answers (the build environment reaches only GitHub). The share of gradeless catalogue products that become gradable live depends on how many Open Food Facts records have an ingredient-based fruit/vegetable estimate; expect a real but partial gain, not 100 %.

## Rollback
Revert the merge commit or redeploy 83.0.0 (`aac374b`). Nothing is stored server side; the device keeps ordinary checked records only.

## Check
`node price-refresh/tools/verify-deploy.mjs https://<site> 83.1.0`
