# FoodScan 10.2.0 — Release notes

## Changes

1. Replaced the old first-visit/returning-visit homepage variants with a unified mobile-first search and scanning surface; added one-field product-name-or-barcode search.
2. Replaced full nutrition `<details>` and tab-only reports with visible report sections for nutrients, ingredients, allergens, source reliability, and portion comparisons.
3. Made all profile flags visible in the decision report instead of hiding flags behind `Why?` toggles. Product restriction gating remains in place.
4. Rebuilt the daily diary for one-field manual entry and one-tap repeat; nutrition not supplied remains **unknown** and is not counted as zero.
5. Added confirmed-amount product-to-diary logging using actual source per-100 values (excluding conflicts), an inline estimate preview, edit/delete/undo, a visible 7-day recap, and an image share/export action.
6. Kept optional disclosed merchant search below the factual report; no subscriptions or invasive prompts were added.
7. Updated the versioned static asset folder, cache name, WebApplication structured data, and Cloudflare Worker version.

## Deployment and rollback

Upload ZIP contents to a Cloudflare Pages staging deployment in Direct Upload mode. `/api/health` should report 10.2.0. Do **not** overwrite production until mobile and backend smoke tests complete. To roll back, redeploy the archived FoodScan 10.1.0 ZIP; client service workers should update on reload.

## Known limitations

- No automatic AI photo nutrition estimates or false 1-second scan guarantee. Camera/image barcode and upstream Open Food Facts calls still depend on browser permissions, network and available provider records.
- Free-text meal entries cannot automatically infer nutrition; numbers are explicitly optional and user-reported.
- No user account/sync; clearing browser data removes the diary unless exported.
- Meal diary JSON is separate from the base FoodScan export/import tool.
- Weekly image card shows logged quantities and is not a physiological/metabolic health assessment.
- Complete ingestion tests for the live Cloudflare Worker, real camera hardware, voice service, Amazon merchant links and Apple PWA install require staging/device testing.

## Verification completed locally

- Node JavaScript syntax across all modules and worker passed.
- Rendering-level view tests confirmed complete source report, nutrition sections, unique element IDs, heading structure and allergy restriction withholding.
- Simulated event-handler tests passed for manual log with null nutrition, edit, repeat, Undo, product serving log, deletion and data clearing.
- Cloudflare Worker route tests passed for versioned health response, 404/405/400 and origin rejection.
- Static app-shell and service-worker asset paths were checked.
- Browser-based mobile render and camera tests **could not run in this environment** because managed Chromium applies `URLBlocklist=["*"]`, blocking even localhost. Responsive visual QA, native camera/voice and live data must be completed on staging before promotion.

No live deployment, scan-speed improvement or revenue increase is claimed.
