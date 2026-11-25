# FoodScan 101.1.0 — release notes (25 Nov 2026)

101.1.0 is your 101.0.0 (`FoodScan-v101-site.zip` + `FoodScan-v101-tools.zip`, notes in [`RELEASE-101.0.0.md`](RELEASE-101.0.0.md)) put back into this repository and checked against it. Nothing in 101.0.0 was removed. Three real defects were fixed, the bundled prices were brought up to date, and the daily price refresh can now be signed.
**Not deployed.** The live site is still 100.1.0.

## What differs from your zip

Compared byte for byte, 69 of the 284 shipped files differ from `FoodScan-v101-site.zip`. All 215 others are identical.

| files | what |
|---|---|
| `assets/market-catalogue-v101.mjs` | **defect fixed** (below) |
| `_worker.js` | **defect fixed** (below) and the version string. Nothing else differs. |
| 4 pages, `sw.js`, `daily-v98.js`, `prices/native-v83.js` | the version string only (`101.0.0` → `101.1.0`) |
| 59 files in `assets/gr-prices-v72/`, `gr-obs-v82/`, `gr-cand-v101/` | the bundled prices, newer snapshots (below). The 10 e-katanalotis shards hold the same records as yours; only the file formatting differs. |
| `assets/estimates-off-csv-2026-10-30.json` | the grade index, 13 entries added (below) |

One file is added: `prices/ocr/LICENSE-tesseract.js.md`, the Apache-2.0 licence text for the tesseract.js that the label reader ships (`tesseract.min.js`, `worker.min.js`; its core library already had its licence file, tesseract.js itself did not). The site is 285 files, under the 300 your notes set as the limit.

## Defects fixed

1. **A comment swallowed the first statement of the Greek catalogue lookup** (`assets/market-catalogue-v101.mjs`). The line `// 101 (fix 8)` sat directly in front of `const m=await manifest(…),key=…,bucket=…`, so that whole statement was a comment and `m`, `key` and `bucket` did not exist for the rest of the function. Every Greek catalogue lookup in the browser threw a `ReferenceError`; the caller hid it and fell back to a live request, so nothing visibly broke but the catalogue never answered. It is now on its own line. Two new tests: one checks that the module answers a lookup for a shopper in Greece and for nobody else, the other runs `node --check` on every shipped script and flags a numbered or "fix" line comment that has code after it on the same line (a heuristic, aimed at exactly this mistake).
2. **Approving a shared price link always failed** (`_worker.js`). The 101.0.0 admin approval wrote the columns `reviewed_by` and `reviewed_at`, which the `foodscan_obs_links` table does not have (see `d1-schema/prices_db.sql`), so every approval ended in a 503 and no shared link could ever be approved. It now writes `status` and `updated_at` only. The "five confirmations → review → approval" tests run on real SQLite with the real schema file (`d1-schema/prices_db.sql`, whose `status` comment now lists `pending_review` and `rejected`).
3. **Source and tools**: `src/` (the readable source of the worker) now carries the 101 code, so `node build.mjs --check` passes again. The swap, peer, estimate, coverage and validation tools and the tests of earlier releases now read the 101 grade engine (`assets/domain-v101.mjs`) instead of `domain-v8500.mjs` / `domain-v8100.mjs`, which lack the energy fix.

4. **The deploy check could never pass** (`price-refresh/tools/verify-deploy.mjs`). It still demanded more than 5,000 estimates from the estimator that 101 removed on purpose, so it failed on every 101 deployment. It now checks the 101 policy (no estimated prices are served), prints whether the signed price manifest is in use, and warns when it is not.

## Checked in Cloudflare's own runtime

The extracted `FoodScan-101.1.0-Cloudflare-Pages.zip` was run with `wrangler pages dev` (wrangler 4.156.0, workerd 1.20261023.1) and, for the signature check, a small worker with the same two WebCrypto calls:

- `/api/health` reports 101.1.0; `node price-refresh/tools/verify-deploy.mjs <url> 101.1.0` exits 0 (all checks pass, plus the warning that the signed manifest is off).
- Real products through the worker, against the real Open Food Facts: Nutella (3017620422003) grade E, 31 points (energy 6, sugars 15, saturated fat 10); Coca-Cola (5449000000996) grade E, 12 points, answered with `X-FoodScan-Record: live-newer-than-catalogue`.
- Ed25519 in workerd, with a manifest made by `scripts/sign-price-data.mjs`: the right key verifies; a changed manifest and the wrong key are refused; a malformed key throws (the worker catches it and uses the bundled copy); the SHA-256 computed in workerd equals the signed hash.
- With a public key set and the real `prices-data` branch (which has no manifest yet): `remote.integrity.status` is `no_manifest`, the bundled prices are used, and price lookups answer 200.
- Not checked: a real signed manifest on GitHub (needs your key), D1 and the cron Worker, the camera, real phones.

## Prices bundled in this release (what the site shows if the daily refresh is not running)

| source | snapshot in 101.0.0 | snapshot in 101.1.0 | records |
|---|---|---|---|
| bazaar-online.gr web shop | 2 Nov | **24 Nov** | 6,143 → 6,291 |
| lidl.gr product pages | 2 Nov | **25 Nov** | 521 → 1,365 |
| posokanei.gov.gr price observatory | 1 Nov | **18 Nov** (newest the publisher's archive has) | 1,177 → 1,456 |
| e-katanalotis.gov.gr | 16 Jun | 16 Jun (the publisher has published nothing newer) | 2,701 |

Packed with `tools/repack-v101.mjs`, which moves records and edits none. `node tools/repack-v101.mjs --verify` reports that every record sits in the shard the worker reads it from.
Freshness is not changed by bundling: a price is "current" for 7 days (30 for an Open Prices observation with a receipt or shelf photo), so the observatory prices (newest snapshot 18 Nov, 7 days old today) are at the edge of that window and will be shown as older from about 26 Nov, and e-katanalotis prices are shown as old, never as current. A web-shop price the shop's own page does not confirm on the day is shown as "last seen" and is never ranked cheapest (101.0.0 behaviour, kept).

## Grade index

`assets/estimates-off-csv-2026-10-30.json` was regenerated with the 101 grade engine. All 6,338 entries of your zip are unchanged (no letter moved); 13 entries for products new in the refreshed data were added (6,351).

## Signed price data (needs two steps from you, once)

101 uses a price file from the `prices-data` branch only if a signed manifest lists it. Until the key exists the daily refresh publishes unsigned data and the site ignores it (it shows the bundled prices above). Added here:

- `scripts/sign-price-data.mjs keygen | sign | verify` (Ed25519, SHA-256 per file; the same rules the worker applies; `keygen` writes the private key to a file and prints only the public key).
- A step in `.github/workflows/refresh-prices.yml` that signs what it publishes when the secret `PRICE_DATA_SIGNING_KEY` exists, and prints a warning when it does not.
- [`SETUP.md`](SETUP.md) section 4c: generate the key, store the private key as that GitHub secret, set `FOODSCAN_PRICE_DATA_PUBKEY` on Cloudflare Pages, retry the deployment. `/api/prices/status` shows `remote.status`; it reads `disabled_no_key` until then.
- Your tools zip names the secret `FOODSCAN_DATA_SIGNING_KEY`; this repository's workflow reads `PRICE_DATA_SIGNING_KEY`. Use one name for both.

## Tests

`node --test qa/*.test.mjs`: **218 of 218 pass** (about 2 minutes, run three times; the last run was after the final edit). 13 of them are new, in `qa/v101.test.mjs`: the Greek catalogue lookup, the script syntax and swallowed-comment check, the kcal/kJ correction (a drink with 463 kcal beside 194 kJ; 1,082 kcal beside 1,081 kJ; nothing "corrected" when kcal and kJ agree), the signed manifest (accepted; tampered file, unlisted file, wrong key, missing key, stale and future manifest all refused), the signing tool and `keygen`, the workflow's signing step, shard placement, the packer, and price freshness. The earlier tests that pinned file names or versions were moved to the 101 files.

## What "accurate" can and cannot mean here

- **Grades** are computed by FoodScan's own Nutri-Score 2023 engine from the nutrition numbers Open Food Facts holds. A grade is withheld when numbers are missing or impossible, an energy value that contradicts both the kJ field and the macronutrients is corrected from kJ and marked as converted, and nothing is guessed. A number that is wrong but physically plausible cannot be detected by any check, so no release can promise every grade of every product is right. Coverage is limited by the data: of the 12,137 products in the bundled Greek catalogue, 4,176 carry a published grade and 7,961 do not, and 2,408 of those have no nutrition numbers at all, so they can only be graded from a label photo (the label reader). For the products that lack a published grade but have the numbers, `tools/quick-grade-validate.mjs` measures the shown letter range against Open Food Facts' published letter with the categories hidden: the published letter lies inside the range for 93.5 % (one letter shown) to 96.6 % (three letters shown), so a range is an estimate and is labelled as one. The only measurement of grade agreement is the one in `RELEASE-101.0.0.md` (97.2 % of 287 compared products agreed with the reference, 2 wrong letters, 6 withheld); it was not repeated for 101.1.0.
- **Prices** are shown with their store, date and unit price and only as "current" inside the freshness windows above. A price that cannot be shown honestly is shown as "last seen" or not at all. Coverage is limited by the data that exists (no open barcode price feed exists for most countries), and a price is only as good as its source's last update.

## Not done / not verified

- No deploy, no Cloudflare changes, no updater run on Cloudflare; no real phone or camera test.
- Everything under "Not done / not verified" in `RELEASE-101.0.0.md` still stands (including the machine-translated French, German, Spanish and Italian text).
- The two signing steps above are yours: they need the GitHub and Cloudflare dashboards.
