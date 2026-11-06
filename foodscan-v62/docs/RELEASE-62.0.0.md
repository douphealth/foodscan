# FoodScan 62.0.0 — Verified Points

Cloudflare Pages Direct Upload. Upload the ZIP as a **new deployment of the existing project** (staging first). `index.html`, `_worker.js`, `_routes.json`, `_headers` and `assets/` stay at the root. No new binding, migration, API key or paid service is needed. Saved foods, history and rules (`fs13:` storage) are untouched.

After deploying, `/api/health` must report `version 62.0.0` and `catalogue.status ready` with `catalogue.products 12113`. Installed apps show FoodScan's "new version" bar; accept it, then reopen. Do not clear site data.

## What changed

**One grading engine, now verified against the points the source published**
- Every Nutri-Score table (ordinary foods, drinks, cheese, fats/oils/nuts/seeds, red-meat protein cap) is recomputed from the nutrition on the record and compared with the source's *published points*. Identical points = the grade is "reproduced" and becomes comparable (method 2023). Over the 12,113 Greece-listed records: **3,452 source grades reproduced point for point** (v61: 1,035 comparable grades, ordinary foods only).
- A letter that no table can produce from its own published points is withheld. Differing points leave the grade as the source's, unversioned, out of every "higher grade" claim, with the reason written on the report.
- Open Food Facts' bulk export blends in nutrients it *estimated from ingredients*. A dated catalogue copy therefore never yields a grade FoodScan calculates itself, and 302 such records are flagged. (Two paced live re-read samples against Open Food Facts — 60 random catalogue products, and all 16 whose grade FoodScan calculated itself — found 3 calculated grades the live record did not support. All three are fixed.)
- The Fridge Challenge read the raw source letter of saved foods; it now asks the same engine as the report. The Worker (shared links, server pages) and the browser share byte-identical engine code, enforced by a test.

**Better choices: same kind of product, not the same aisle**
- A bilingual product-type lexicon (English, Greek and the languages on Greek shelves) replaces coarse families: chocolate bars no longer match cocoa powder, Greek hard cheese no longer matches cottage cheese, plant drinks no longer match nuts, pasta no longer matches cereal, cakes no longer match puffed corn cakes, and a cracker filed as a biscuit is not offered for a sweet cookie.
- Same 128 real Greek products, food API unreachable: verified higher-grade suggestions 11 → 38, same-grade peers 5 → 10, zero shown-vs-opened grade mismatches.

**Greece**
- Greek and Greeklish search share one skeleton (γιώτης = Giotis, "galaktos" finds γάλακτος), brand spellings included. Catalogue search and barcode lookups no longer parse whole shards: cold lookup p50 232 → 86 ms, cold search p50 1,155 → 371 ms (4× CPU throttle).
- Shared links open from the dated catalogue when the food database is busy (never indexed).
- 22 grade explanations that had no Greek translation now have one.

## Not changed / limits
- The catalogue is the 29 Oct 2026 Open Food Facts snapshot (12,113 usable records of 14,634 Greece-listed source rows). It is not every supermarket product and not a stock feed. It expires for recommendation use 90 days after export.
- Retail availability is never claimed. Grades are not medical advice; always check the package and allergens.
- Physical-device scanning and a real Cloudflare staging run were not performed by this build. See the validation report.

## Rollback
Cloudflare dashboard → Pages → food-scan → Deployments → promote the previous deployment (61.0.0). Nothing else needs undoing: no schema change, no data migration, no deleted user data.
