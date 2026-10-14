# FoodScan 9.1.0 — Everyday Companion Upgrade

**Deliverable:** `FoodScan-9.1.0-Cloudflare-Pages-Upload.zip`  
**Source:** user-supplied FoodScan 9.0.0 Cloudflare Pages Direct Upload ZIP  
**Target:** Cloudflare Pages, preserving the existing advanced-mode `_worker.js` routing and the `foodscan:v3` browser storage key.

## What changed

### 1. A dashboard for regular users

The home page now distinguishes a first visit from a returning shopper. A first visit still leads with barcode scanning. Returning users land on **Everything for today**, a summary driven by their own local shopping and pantry records, rather than another large introductory scanner panel.

It surfaces pending groceries, running-low pantry items, package dates to check, saved foods, and context-appropriate next actions. Date prompts quote the entered package date and its type; they make **no claim of food safety**. The home page updates the date-dependent data on reopening on a new local day.

### 2. Faster routine interactions

- One-field grocery addition directly on Today. New entries persist in the existing local list.
- One-tap grocery checkboxes. Bought items go through the existing purchase transaction to add a pantry lot with Undo.
- One-tap restock from pantry; no silent duplicates and no unverified automatic purchasing.
- Repeat a favorite from saved foods without navigating through its product page.
- Immediate barcode camera, barcode-photo, manual barcode, and product-name search actions.
- Reach the existing local grocery suggestion dialog, shopping calendar reminder, and share-list flow directly from Today.
- Home-screen installation guidance appears once a visitor has ongoing local data (and when not already in standalone mode).

### 3. Trust-respecting monetization and sharing

- A **single optional** Amazon search link is offered when a pending grocery is backed by an eligible, sourced, full product record.
- Uses existing per-market Associates tags from FoodScan 9.0.0. No affiliate IDs were invented or changed.
- Displays `paid link`, the existing Associates disclosure, and a warning that search results are not confirmed exact product listings, prices, or stock.
- Records only a local `amazon_search_opened` event with placement `today` when users deliberately select a merchant link. Weekly Insights shows local merchant-search clicks, clearly labeled **not sales or earnings**.
- Shared grocery-list text now includes a link back to the currently visited FoodScan site. Nothing is shared until the user initiates sharing.

### 4. Existing functionality preserved

Product records still come from Open Food Facts, with missing values and uncertainty treated as missing. Profile restrictions still gate products across lists and saved foods. With restrictions enabled, the Today's free-text food quick-add is replaced with a prompt to scan an eligible product. Hidden items due to restrictions are counted without revealing excluded product details. Source lookups, pantry dates, comparison, history, offline-local storage, exports, imports, and the worker cache retain their existing contracts.

### 5. Search and progressive-web-app support

- Updated the landing title and description for both barcode scanning and grocery-list intent.
- Added accurate WebApplication feature descriptions, refreshed the home page sitemap modification date, and adjusted the app manifest wording and home shortcut.
- Versioned the immutable asset path to `assets/release-9.1.0/` and service worker cache to `foodscan-shell-9.1.0`.
- All 36 declared precache paths exist, including the new Today module. The backend reports version 9.1.0.

## Validation completed

| Validation | Outcome |
|---|---|
| Syntax checks of application ES modules, worker, service worker, and boot script | Passed |
| Local worker `GET /api/health` | 200; reports 9.1.0 |
| Worker invalid-barcode rejection and cross-origin blocking | Passed |
| Browser-rendered modules, 320px / 390px / 1440px layouts | Passed; zero horizontal overflow observed |
| Adding an item, marking bought, creating pantry item, then Undo | Passed |
| Restocking from pantry, direct name-search focus, and reminder dialog | Passed |
| Existing list state round-trip through browser storage | Passed |
| HTML escaping of untrusted custom item text | Passed |
| Hard food-restriction gate and withheld-item display | Passed |
| Affiliate eligibility/disclosure/URL tags and local click counts | Passed using a synthetic product record |
| Dark theme and extra-large text on 320px viewport | Passed |
| Root references, precache paths, routes JSON, app manifest, sitemap XML | Passed |

**Test-environment limitation:** Browser QA mounted the actual HTML, CSS, and ES modules into Chromium using local blob URLs because this environment's Chromium blocks HTTP(S) navigation. Accordingly, the tests **did not** exercise Cloudflare deployment, a real camera, real Open Food Facts traffic, actual affiliate purchases, or offline service-worker operation on an installed production origin. No live-usage lift, retention improvement, search ranking, or revenue increase is claimed.

## Release procedure

1. Keep the supplied 9.0.0 ZIP as a rollback artifact. Back up any data you rely on with FoodScan's Settings → Export backup before testing with real devices.
2. Upload the new **ZIP contents at the project root** to a **Cloudflare Pages preview/staging deployment**, using the same Direct Upload method as 9.0.0. Do not nest the build in an extra folder.
3. Confirm `/api/health` returns `version: 9.1.0` and `/` loads CSS/JS with no missing `/assets/release-9.1.0/` requests.
4. On mobile, add an item from Today; tick it off; confirm the pantry record and Undo. Check the date prompt against a manually entered package date. Then test product-name search and a real food barcode online.
5. Test with a hard avoidance preference enabled and confirm unverified products are gated. Verify any optional Amazon link carries your own correct Associates market tag and disclosures. Check a repeated visit offline after the service worker installs.
6. Only after staging validation, promote the preview to production. Track actual outcomes rather than assuming improvement.

**Rollback:** redeploy the original `FoodScan-9.0.0-Cloudflare-Pages-Upload.zip`. The preexisting storage key and export format were retained; no storage migration or destructive update is required. Re-check the service worker and hard refresh after rollback.

## Suggested 14-day scorecard

Compare equivalent pre/post cohorts (or a controlled rollout) using: first successful barcode-to-result time; first grocery item added; list-to-pantry completion; 7-day returning-user share; merchant-search CTR per eligible shopping session; verified Associates orders/earnings; and organic visitors who use a non-scanning daily action. The **local** weekly recap cannot report sitewide conversion or actual Amazon earnings. Those require consent-aware aggregated analytics and authorized Associates reporting.

**Highest-leverage next action:** stage the ZIP on Cloudflare Pages and conduct a real-device purchase-list/pantry loop before pushing it to the production domain.
