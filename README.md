# FoodScan

Scan a food barcode, read the source-reported nutrition grade, and see the recorded supermarket price in your own country and currency (Greece also has official sources).
Live: https://food-scan.gearuptofit.com/

**This branch (`main`) is FoodScan 89.0.0 (see [`RELEASE-89.0.0.md`](RELEASE-89.0.0.md), [`RELEASE-88.0.0.md`](RELEASE-88.0.0.md), [`RELEASE-87.2.0.md`](RELEASE-87.2.0.md), [`RELEASE-87.1.0.md`](RELEASE-87.1.0.md), [`RELEASE-87.0.0.md`](RELEASE-87.0.0.md), [`RELEASE-86.0.0.md`](RELEASE-86.0.0.md), [`RELEASE-85.0.0.md`](RELEASE-85.0.0.md), [`RELEASE-84.0.0.md`](RELEASE-84.0.0.md), [`RELEASE-83.1.0.md`](RELEASE-83.1.0.md) and [`RELEASE-83.0.0.md`](RELEASE-83.0.0.md); the paragraphs below describe the Greek price sources of 80), ready for Cloudflare Pages: the repository root IS the site** (`index.html`, `_worker.js`, `_routes.json`, `_headers` at the root; no build step). It is the exact content of `FoodScan-80.0.0-Claude-Complete-Prices-Cloudflare-Pages.zip`, plus the price-refresh job below.

## Setup
[`SETUP.md`](SETUP.md): the optional D1 databases and the web price search (two secrets) in a few clicks.

## Source
`_worker.js` is built from `src/` by `node build.mjs` (`--check` verifies); see [`SOURCE.md`](SOURCE.md) for the module map and what is generated. Tests: `node --test qa/*.test.mjs`.

## Worldwide prices (83.0.0)
Every price request carries the shopper's market (country). Only observations made in that country and in its currency can be ranked; other countries are listed apart in their own currency; nothing is converted, estimated or guessed. Sources: Open Prices everywhere, plus the Greek official and web-shop sources for Greece. Checks: `node --test qa/*.test.mjs`.

## Prices (what 80.0.0 does)
Every product gets an honest answer, in this order: the lowest **current** recorded price (7 days or less); else the **last recorded price with its age**; else a **labelled estimate** (a range, "Not a recorded price", the products it rests on, how it was measured); else **"No verified price"** with the reason. An estimate is never ranked, never "cheapest", never wins a comparison.

Recorded prices come from public sources, each shown with its source and date: the Ministry of Development price observatory (posokanei, national chain prices), the Bazaar and Lidl web shops (also re-read on every scan when they answer), e-katanalotis (history only), Open Prices (read live). Data bundled in this release: 2 Nov 2026. Details, numbers and limits: [`RELEASE-80.0.0.md`](RELEASE-80.0.0.md).

## Keeping prices current without redeploying
`.github/workflows/refresh-prices.yml` runs `price-refresh/` every day (02:37 UTC) and force-pushes the result to the **`prices-data`** branch (seeds as manifest + small shards, estimates, calibration). The worker reads that branch and, per file, uses the newer of the bundled and the published copy. A missing, older, truncated or unreachable published copy is ignored. See [`price-refresh/refresh/README.md`](price-refresh/refresh/README.md).

## Is the price system really live?
```
node price-refresh/tools/verify-deploy.mjs https://food-scan.gearuptofit.com 80.0.0
```
It must print "All checks passed" (read-only; the site's `/api/prices/health` must answer with release 80.0.0).

## Branches
- `main` the deployable site (this).
- `prices-data` generated daily by the workflow; never edit by hand.
- `source/v80` the overlay build, tests and tools that produce this release from the v79 zip (reproducible).
- `archive/pre-v80-main` the repository exactly as it was before 80.0.0 replaced it (FoodScan 11.x line).
