# FoodScan 62.0.0 — validation report

Everything below was measured on this machine from the shipped files and from live Open Food Facts reads. Nothing was deployed and nothing was merged. Where something was **not** done, it says so in section 9.

## 0. What v62 is built from

v61 reached this workspace as a built Cloudflare Pages bundle: **no source tree** (the grading, recommendation, catalogue and Worker modules are readable; most of the UI is minified chunks). v62 therefore keeps the v61 ZIP (SHA-256 `b83aab2c…cba8`) as the pinned baseline and produces v62 from it with `tools/build-v62.mjs`: readable modules are replaced by the canonical sources in `src/`, the same engine text is spliced into `_worker.js`, and each remaining minified-chunk patch must match exactly once or the build fails. `git diff` of `app/` is the v62 change set. The GitHub repository is the v11-era layout and was not used as a source.

## 1. Defects found, causes and fixes

| # | Symptom (reproduced) | Root cause | Fix | Guarded by |
|---|---|---|---|---|
| 1 | 3,021 of 4,170 graded Greek records could never be called a "higher grade": their source grade carried no method | the bulk export has no `nutriscore.2023` object, and v61 could only recompute ordinary foods | every Nutri-Score table (foods, drinks, cheese, fats/oils/nuts/seeds, red-meat cap) is recomputed from the record and compared with the source's *published points*; equal points = reproduced and comparable (3,452 records; v61: 1,035) | `tests/grading.test.mjs` |
| 2 | Fridge Challenge showed a letter the report withheld | `fridge-core.mjs` read `product.nutriScore` directly | asks the shared engine; Worker and browser engine text is byte-identical | `tests/consistency.test.mjs` (all 12,113 records), `tests/grading.test.mjs` |
| 3 | Live re-reads: the catalogue grade FoodScan *calculated* differed from the live record (3 of the 76 records read) | the CSV merges nutrients Open Food Facts *estimated from ingredients* into label columns (e.g. salt present in the export, absent live) | a dated catalogue copy never yields a self-calculated grade; 302 records with the estimated-nutrient signature are flagged, and the caveat says so | live-parity runs, `tests/grading.test.mjs` |
| 4 | Irrelevant "better" suggestions (chocolate bar → cocoa powder; kalathaki → cottage cheese; cake → corn cake; plant drink ↔ nuts; cereal → spaghetti; margarine → frozen fries; deli turkey → ready meal) | families were aisle-level; subtype rules existed for 17 of 31 families | bilingual product-type lexicon for every family plus cross-family types; unresolved wide families need a shared specific category; savoury-vs-sweet guard | `tests/relevance.test.mjs`, `tests/recommendations.spec.mjs` |
| 5 | Search: Greek-script only, 1.0–1.5 s cold | folded 12k rows per session, parsed every record of five shards for 30 results | precomputed Greek/Latin skeleton index; only matched records parsed | `tests/catalogue.test.mjs`, perf table |
| 6 | Shared `/p/<code>` returned 503 when the food API was busy | server page only read upstream/D1 | falls back to the dated catalogue record (HTTP 200, `noindex`) | `tests/worker.test.mjs` |
| 7 | Grade explanations in English in the Greek UI | 22 of 74 engine messages had no Greek entry | translations added; build check `tools/i18n-missing.mjs --strict` | e2e Greek test |

**A → C.** The class could not be reproduced in the offline pipeline (0 shown-vs-opened mismatches in v61 *and* v62 over the same 128 products). The causes that *do* exist are 1 (unversioned grades are not comparable) and 3 (catalogue-calculated grades the live record does not support); both are closed. The browser suite opens every suggestion on 10 real products (≥15 suggestions) and requires the opened report to show the suggested letter.

## 2. Nutri-Score validation

Method: recompute points from the nutrition on the record with the 2023 tables as implemented by Open Food Facts (energy/sugars/saturated fat/salt/fibre/protein/fruit-veg tables; separate drink, water, cheese and fats-oils-nuts-seeds tables; protein rules; red-meat cap; sweeteners) and compare with the points the source published.

| Check | Result |
|---|---|
| Greek catalogue, 4,170 graded records | 3,803 reproduced exactly on first pass; after the estimated-nutrient guard 3,452 are shown as reproduced (general 2,699, drinks 368, fats/nuts/seeds 220, cheese 165); the rest keep the source letter, unversioned, with the reason |
| Real API records from earlier captures (7 countries, 2,397 with points) | 2,168 reproduced exactly (90.4%): an independent check of the calculator, not of the Greek data |
| Letters impossible for their own published points | 0 (the first run flagged 18 catalogue records: coffee/tea drink rule and a nuts/seeds table edge case, both fixed) |
| Records the engine withholds | 241 (contradictory/impossible: kcal > pure fat, macros > 100 g, sugars > carbohydrate, …); source rows are not deleted |

Final status over the catalogue: reproduced-by-points 3,452 · source letter, unversioned 567 · letter-only calculated 20 · withheld 241 · no grade 7,833 (no source grade and nothing may be calculated from a dated copy).

## 3. Better choices (same 128 real Greek products, food API unreachable)

| | v61 | v62 |
|---|---|---|
| verified higher grade | 11 | 38 |
| same-grade peers | 5 | 10 |
| nutrient-based options | 64 | 51 |
| comparison-only | 116 | 111 |
| nothing to show (explained on screen) | 12 | 17 |
| shown ≠ opened grade | 0 | 0 |
| p50 / p95 engine time (this PC) | 44 / 206 ms | 49 / 228 ms |

Nutrient options fell because irrelevant ones were removed. The 38 suggestions were read by eye: remaining weaknesses are in section 9.

## 4. Greek market

Catalogue: 12,113 Greece-listed Open Food Facts records (export 29 Oct 2026; the v60 build kept 12,113 of 14,634 source rows). Audit of the shipped records: median last edit 218 days ago (2,081 older than two years, 740 older than four); 2,525 have no nutrition at all, 585 partial; 6,155 lack category tags; 8,590 lack ingredients; 3,382 lack a photo; 142 kcal/kJ disagreements; 138 salt/sodium disagreements; 155 groups (342 records) share brand + name + size under different barcodes. Quarantine is applied at read time (`release-qa/catalogue-quarantine.json`); no source record is deleted or edited.

Independent source check: 60 products spread over every family, re-read live, paced: 60/60 readable, 60/60 still listed for Greece, 0 modified since the export (the export was one day old), nutrition identical in 59/60, shown grade identical in 60/60 after the fixes (58/60 before). All 16 records whose grade FoodScan calculated itself: 2 differed live, now not calculated.

Search: Greek, Latin and Greeklish spellings of names and brands meet (γιώτης/Giotis, "galaktos" → γάλακτος products: 6 → 20 hits, the display cap).

## 5. Speed (Chromium, this PC; ms)

| 4× CPU throttle (mid-range phone) | v61 | v62 |
|---|---|---|
| cold barcode lookup p50 / p95 | 232 / 387 | 86 / 140 |
| cold catalogue search p50 / p95 | 1,155 / 1,509 | 371 / 548 |
| warm lookup | 0.2 | 0.2 |

Initial load (4× CPU, 1.6 Mbps, 150 ms RTT, cache off, medians of 5, alternating): FCP/LCP 2.57–2.60 s (v61) vs 2.56–2.58 s (v62); blocking time ≈1.0 s both; +53 KB uncompressed (engine, lexicon, Greek strings; Cloudflare compresses). **No load-time improvement is claimed.**

## 6. Interface, accessibility, SEO

Verified in Chromium (390, 360, 768, 1280 px): landing phone illustration and five-grade scale present, no horizontal overflow, no console errors; every balance bar fills exactly its printed percentage (e.g. 94% → 94.0% ±0.5, meter value and `--w` agree); axe-core: no serious/critical violations on the landing page and a report, light and dark; Greek report text. Not redesigned: the v61 visual design, Fridge Challenge (target 7), Food Battles, share cards and `/p`, `/compare`, sitemap routes are unchanged apart from the engine fixes above. Product pages are indexable only when the live source answered and the record passes the existing quality gate; dated-catalogue pages are `noindex`.

## 7. Tests

53 automated tests, all passing: 39 unit/contract (grading, relevance, catalogue integrity incl. SHA-256 of all 47 shards, consistency over all records, Worker, package/headers/routes) and 14 Chromium (landing, bars, A→C over every suggestion, outage, axe, Greek, 6 recommendation invariants, service worker install/offline). `npm test`, `npm run e2e` (+ `node --test tests/pwa.spec.mjs`). Real adversarial records used: kcal 1291/kJ 312 feta, 48,500 kcal, three letter-vs-points conflicts, an ingredient-estimated crispbread, a savoury cracker filed as a biscuit, a BBQ sauce filed under ice cream.

## 8. Cloudflare configuration checks

`_routes.json` (Worker for `/api/*`, `/p/*`, `/compare/*`, documents and sitemaps; assets, service worker, icons excluded), `_headers` (CSP without `unsafe-eval`, immutable `/assets/*`, `no-store` `sw.js`), every file referenced by `index.html`, the service worker and the module graph exists, v62 modules import only v62 URLs, one version string everywhere, no secrets in the tree, SW precache < 2.5 MB and excludes catalogue shards. Preview hosts are `noindex`.

## 9. Not done / known limits

- **No Cloudflare staging run, no physical-device scan, no production deploy.** Chromium used an in-process Pages emulator with the real Worker.
- **No catalogue refresh and no incremental-sync scheduler.** The snapshot is one day old; the live check found nothing changed; the Open Food Facts search API answered 503 during this work, and the v60 catalogue builder is not part of what was delivered. A refresh/sync job (Cron Trigger + D1, or a monthly CSV rebuild) remains to be written.
- Retailer availability, prices and stock are not verified and never claimed. The 2,521 source rows excluded by the v60 build were not re-audited (the CSV was not re-downloaded).
- 7,833 catalogue records (65%) show no grade: the source has none and a dated copy is not graded by FoodScan. Opening one refreshes it from the live database when the source answers.
- Product-type matching is a lexicon over names: unusual names fall back to a default type. A sample read found one questionable pair (a rye crispbread offered for a toast loaf, both default "bread"). Hidden non-relevant matches are possible; the compare-only labels stay on.
- Amazon search links and their disclosure in the Greek report are existing v61 features, unchanged.
- v62 keeps the older asset sets (v59–v61) for already-installed clients; the ZIP is therefore larger than necessary.
- Domain strings now translated only for Greek; other languages are unchanged.
