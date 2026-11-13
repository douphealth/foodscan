# FoodScan 62.0.0 — deployment, environment and rollback

Nothing here has been run against your Cloudflare account. Deploying is your decision.

## 1. Deploy (Direct Upload, staging first)
1. Cloudflare dashboard → Workers & Pages → `food-scan` → **Deployments → Create deployment**. Upload `FoodScan-62.0.0-Verified-Points-Cloudflare-Pages.zip` (the complete app, not the source ZIP). Files stay at the deployment root: `index.html`, `_worker.js`, `_routes.json`, `_headers`, `assets/`.
2. Open the deployment's `*.pages.dev` URL (preview hosts are `noindex`). Check, in this order:
   - `/api/health` → `"version":"62.0.0"`, `"catalogue":{"status":"ready","products":12113}`.
   - `/p/5201673006909` → "Ψωμί Γερμανικού Τύπου", grade C, "Source points add up", points 3.
   - A product with higher-grade suggestions, e.g. `/#/p/5201485009044` with the market set to Greece (Me → market): every suggested letter must open as that letter.
   - Turn the phone offline (or block `world.openfoodfacts.org`): saved reports, the catalogue lookup and Greek/Greeklish search (`γιαούρτι`, `galaktos`) must still answer.
   - Install/refresh the PWA: the "new version" bar appears; accept it. Saved foods must still be there.
3. Promote to production only after those pass. Production is a new upload of the same ZIP (or promote the verified deployment).

## 2. Environment
No new binding, secret, migration or paid service. Existing optional settings keep working and are untouched: `CONTACT_EMAIL` (identifies the app to Open Food Facts: set it to a shared mailbox, not a personal address), `ANALYTICS`, `FOOD_DB` (D1 index), `FOODSCAN_PUBLIC_DB` and its flags. The catalogue is a static asset (`assets/greece-v610/`, ODbL, attribution in `ATTRIBUTION.txt`). It stops being used for recommendations 90 days after its export date (29 Oct 2026 → 27 Jan 2027): plan a refresh before then.

## 3. Rollback
Deployments → previous deployment (61.0.0) → promote/rollback. No schema or stored-data change was made, so nothing needs undoing. Installed apps pick up whichever deployment is live on their next visit and ask before switching; their saved data is untouched.

## 4. What to watch after release
- `/api/health` `catalogue.sourceAgeDays` (must stay under 90).
- Reports that show a suggestion opening as a different letter: send the barcode pair; every such case so far traced to a live record changing or to an unversioned catalogue grade.
- Greek-market feedback on suggestions: the product-type lexicon lives in `src/match-policy.mjs` and is tested pair by pair in `tests/relevance.test.mjs`.

## 5. Rebuild from source
`npm install`, then `npm run build` (needs `baseline/FoodScan-61.0.0-…zip` as shipped in the source bundle; its SHA-256 is checked). `npm test`, then `npm run e2e` (needs Google Chrome or Edge installed; set the path in the test files if it differs).
