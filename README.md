# FoodScan 9.1.0

FoodScan is a mobile-first food barcode lookup and everyday grocery companion. This repository contains the **exact deployable app assets from FoodScan 9.1.0**, supplied as the Cloudflare Pages Direct Upload release, plus documentation and repository metadata.

## Version

- Release: **9.1.0**
- Deployment platform: **Cloudflare Pages (Direct Upload)**
- Entry point: [`index.html`](index.html)
- Backend: [`_worker.js`](_worker.js), Cloudflare Pages advanced mode
- PWA: [`sw.js`](sw.js) and [`manifest.webmanifest`](manifest.webmanifest)
- Assets: [`assets/release-9.1.0/`](assets/release-9.1.0/)

## Deploy

1. Create a new **Cloudflare Pages Direct Upload** project, or use a staging environment in the existing project.
2. Upload **the files at the root of this repository** (not an enclosing directory). Keep `_worker.js`, `_headers`, and `_routes.json` at the root.
3. Test `GET /api/health` and confirm `version` is `9.1.0`.
4. Verify a real barcode scan, food lookup, list-to-pantry transaction, restrictions, and offline revisit on a mobile device before deploying to production.

Do not apply a framework build command: this release is pre-built static HTML/CSS/JS with a Cloudflare Pages worker. GitHub does not automatically deploy it unless you configure a deployment integration.

## Features

- Product scanning and sourced nutrition lookup
- Restriction-aware product decisions
- Today dashboard for returning shoppers
- Grocery lists, pantry, restock, reminders, saved foods
- Optional disclosed merchant search links
- Offline-friendly PWA and local data export/import

## Release and verification

See [`RELEASE_NOTES.md`](RELEASE_NOTES.md) for changes, QA scope, outstanding staging tests, and rollback notes.

## Safety and privacy

No secrets or API credentials are required in this repository. User shopping and profile data are stored locally in the browser. Check each live integration and policy before production promotion.

## Rollback

Redeploy the prior 9.0.0 release archive retained separately. Do not assume GitHub commits automatically roll back a Cloudflare Direct Upload deployment.
