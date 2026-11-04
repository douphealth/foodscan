# FoodScan source map (83.2.0)

## Server (Cloudflare Pages worker): editable modules + `build.mjs`
`_worker.js` is built from `src/` by `node build.mjs` (no dependencies). `node build.mjs --check` rebuilds in memory and fails if the result differs from the `_worker.js` on disk; `qa/source.test.mjs` runs that check, so CI keeps the modules and the deployed file in sync.

| module | what it holds |
|---|---|
| `src/lib/i18n.js` | translation hook for server-rendered text |
| `src/domain/model.js` | `parseProduct`: turns a source record into FoodScan's product (basis per 100 g / 100 ml, nutrients, validity) |
| `src/domain/estimate.js` | calculated Nutri-Score for ordinary foods, with the range over unreported nutrients |
| `src/domain/nutriscore2023.js` | Nutri-Score 2023 tables for every food kind (general, drinks, fats, cheese, red-meat cap) and `ns23Verify` |
| `src/domain/grade.js` | `assessGrade`: source grade vs calculation, data-quality checks, contradictions, withheld grades |
| `src/domain/allergens.js`, `categories.js`, `profile.js`, `facts.js`, `alternatives.js`, `versus.js`, `seo.js` | allergen cross-check, category families, personal rules, facts, better choices, comparisons, indexability |
| `src/data/countries.js`, `src/data/indexable.js` | country list and the indexable catalogue sample |
| `src/worker/core.js` | request handling: limits, Open Food Facts lookup, search, caching, health |
| `src/worker/prices.js` | the price service (83: market and currency aware; Open Prices; Greek official and web-shop sources; estimates removed since 81) |
| `src/worker/routes.js` | the `fetch` router, product and compare pages, site documents, the product index |
| `src/worker/catalog-extension.js`, `og-render.js`, `growth-extension.js`, `tail.js` | public catalogue pages, social images, battles/challenges, cloud backup, static catalogue reads |

**What these files are, exactly.** The worker was produced by a bundler that leaves one comment per source module (`// src/domain/grade.js`, `// worker/_worker.js`, ...). The modules above are those slices, in run order. They are the bundler's output for each module (plain functions and constants, no `import`/`export` lines), **not** the original ES-module sources: `src/domain`, `src/lib` and `build.mjs` were never committed to this repository (checked: all 132 commits, 28 branches). The slices rebuild the deployed worker byte for byte.

## Browser app
- `index.html`, `prices/`, `market-hint-v71.js`, `growth-ui.*`, `ui-v80.css`: readable, hand-edited source (`prices/*-v83.*` is the 83 price client and pages).
- `assets/domain-v8100.mjs`, `market-catalogue-v8100.mjs`, `recommendations-core-v8100.mjs`, `match-policy-v7540.mjs`, `comparison-guards-v7540.mjs`, `nutrition-choices-v7540.mjs`, `profile-evidence-v7540.mjs`, `balance-view-v7540.mjs`: readable modules used by the app.
- `assets/*-v8300.js`: the app's views and lookup, **minified/generated** (no source in this repository). `assets/*-v8200.js` is the previous generation and stays for tabs left open.
- Changing a file under `assets/` that the browser caches for a year means copying it under a new generation name and rewriting the imports (see `RELEASE-83.1.0.md`).

## Data and tools
- `assets/gr-prices-v72/`, `gr-obs-v82/`, `gr-est-v80/`, `greece-r20261030/`: price seeds, observatory products, saved catalogue.
- `price-refresh/`: the daily price refresh (GitHub Actions publishes `prices-data`), `price-refresh/tools/verify-deploy.mjs` checks a deployed site.
- `qa/`: `node --test qa/*.test.mjs`.

## Older sources
Branch `v62-verified-points` holds `foodscan-v62/` (older domain and build sources), `source/v80` and `source/v81` the 80/81 overlay build tools. None of them is the 83 worker source.
