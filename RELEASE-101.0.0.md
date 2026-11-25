# FoodScan 101.0.0 — release notes (25 Nov 2026, Europe/Athens)

Built from `/workspace/foodscan-latest-src` (v100.1.0, left untouched) into `/workspace/foodscan-v101`.
Deliverables: `FoodScan-v101-site.zip` (the site, flat, Cloudflare Pages advanced mode) and `FoodScan-v101-tools.zip`
(tests, scripts, price updater, adapters, measurement tools, these notes, screenshots).
**Not deployed.** No production deploy and no production updater run were done (no Cloudflare credentials on this machine).

## Before / after (all measured on this box, 25 Nov 2026, local Pages emulator `tests/serve-cf.mjs`)

| measure | v100.1.0 | v101.0.0 |
|---|---|---|
| Grades, 358 products in 8 countries: agreement with reference | 93.4 % | **97.2 %** (279/287) |
| Grades: wrong letters | — | 2 (both: catalogue answered because the local test OFF budget ran out; one repeat request gives the live record and the right letter) |
| Grades: withheld (not enough data to grade honestly) | 16 | 6 |
| GR popular-200, signed remote data: current price / any price | 70 / 97 | 70 / 97 |
| GR popular-200: spot check of 20 against the shop page | 18 same, 1 different | **19 same, 0 different** (1 not checkable) |
| GR random-150, signed remote: current / any, spot check | — | 23 / 34, 16/16 same |
| GR, bundled data only (remote off): popular / random | — | 63/93 (spot 20/20), 20/32 |
| Shop pages blocked (live check fails): unconfirmed prices ranked | 16 of 17 ranked, 12 shown as "cheapest" | **0 ranked, 0 "cheapest"** (shown as "last seen", retried) |
| Normal conditions: shop prices confirmed live | — | 16 of 17 |
| Abroad, 30 products each: current price shown — FR / DE / US | 4 / 0 / 0 | **17 / 5 (of 29) / 2** |
| Abroad — ES / IT / GB / BR | 0 | 0 (no open barcode price feed exists there; Open Prices only) |
| Greek offers or Greek text shown abroad | Greek swaps + Greek names on BR/DE product pages | **0 everywhere** (an earlier v101 build still showed 8 Greek words on BR, 1 on DE; fixed) |
| Product page abroad, data downloaded (375 px) | not measured (earlier v101 build: ~2,014 kB) | **~1,363 kB** (no Greek swaps index abroad) |
| Time to grade on product page, 375 px — GR / FR / DE / BR / US / GB | 914 / 1300 / failed / failed / 1144 / – ms | 855 / 1306 / 1227 / 1107 / 1265 / 1379 ms |
| 403 errors in the console | on every page | **0** (analytics endpoints answer 204 when not configured) |
| Site files | 863 | **284** (limit 300) |
| Automated tests | — | **35 unit tests pass** + offline review checks (`npm test`) |

Outage simulation (OFF cut, fresh copies expired, `serve-cf --cache-shim --outage-toggle`): FR/DE/US/BR products seen before
answer **200 from the saved copy** (marked STALE); an unseen IT product answers 503, then the server pauses only that lookup
(429, retry after ~30 s) and a saved FR product still opens during the pause.

Updater, run locally against a SQLite stand-in for D1 (`tools/updater-local.mjs`): Greek observatory 8,097 offers
(snapshot 18 Nov 2026), Bazaar 199, Lidl 36, HU 24,421, IL 7,835, HR 36,054 rows. `verify-deploy` against it: "OK: price data is live".

## Per-item status

| item | status | what was done / how verified |
|---|---|---|
| P0-1 failed live shop check → "last seen", never ranked | **done** | live-check test above (0 ranked when blocked); unit test |
| P0-2 calories checked against the kJ the grade uses | **done** | `domain-v101.mjs`; price modules re-pointed from the old `domain-v8500` (which lacked the fix); unit test |
| P0-3 Greek catalogue: prefer live record when newer | **done** — live record asked on every GR lookup, wins when as new or newer (`X-FoodScan-Record: live-newer-than-catalogue`) |
| P0-3 Greek catalogue: daily refresh of the bundled export | **partly** — not regenerated daily. The bundled export stays dated 30 Oct 2026; freshness comes from the live record on each lookup (edge-cached), with a 90-day warning on old snapshots. A daily export rebuild + redeploy job was **not built** |
| P0-4 no estimated prices | **done** — estimator data removed entirely (stricter than "off by default"); only "not this product" candidates with their own recorded prices remain; unit test |
| P0-5 signed manifest for `prices-data`, fallback to bundled, docs | **done** — Ed25519 + SHA-256 per file, refuses manifests > 10 days old; tampered file rejected in test; `scripts/sign-price-data.mjs keygen|sign|verify` |
| P1-6 pause only the failing lookup, retry, saved copies, phone reads OFF directly | **done** — outage simulation above |
| P1-7 Open Prices with proof current for 30 days (others 7) | **done** — unit test |
| P1-8 Greek catalogue never used outside Greece | **done** — server + client; swaps and similar-product estimates gated on market; Greek-only-named OFF records dropped abroad; leak check 0 |
| P1-9 per-country registry + adapters HU, IL, HR | **done** — HU Árfigyelő, IL Shufersal, HR Konzum enabled (test runs 25 Nov); other IL/HR chains, RO, US Kroger **off and documented** in `ingest/adapters/README.md`; `/api/prices/sources` |
| P1-10 ≥5 shopper votes, matching pack size, review step | **done** — unit test |
| P1-11 updater runnable, deploy check fails on "awaiting first run", exact commands | **done** locally — fixed two real updater bugs found while running it (observatory looked back only 4 days → 14; Lidl moved to lidl-hellas.gr and was read as "blocked"); new health state `upstream_unchanged` for e-katanalotis (publisher file unchanged since 16 Jun 2026). Not run on Cloudflare |
| P2-12 < 300 site files | **done** — 284 |
| P2-13 share button at 375 px, no 403 noise | **done** — icon-only share under 480 px; 0 console 403s |
| P2-14 French, German, Spanish, Italian | **done, needs native review** — price card and Prices page hand-written; main app machine-translated with a garbage filter + 231 hand-checked phrases; English shown where a translation failed the filter (fr 18, de 1, es 17, it 18 of 1,427 strings) |
| P2-15 `npm test` with review checks | **done** — `npm test` = 35 unit tests + offline checks (syntax of worker/tools, adapters compile) |
| Earlier rules (no synthesized prices, personal notes separate, unit prices, 101.0.0 everywhere, time-limited cache) | **kept** — version test passes |

## Headless QA (run 3, after all fixes)
el-GR, en-US, fr-FR and de-DE at 320 / 375 / 430 / 1440 px, home + product + prices (48 shots, `/workspace/shots-v101-run3`):
0 horizontal overflow; 0 Greek text outside Greece. One cut-off found (country picker at 320 px in fr/de) and **fixed**
(re-checked: 17–297 px of 320). Remaining console error on product pages abroad: `/api/alternatives` 503/429 — Open Food Facts'
own search answers 503 to this machine (checked with a direct request), so the app shows its "temporarily unavailable" note.
Not a v101 bug, but it means "healthier choices" abroad could not be shown in this test.

## Screenshots (in `release-shots/` of the tools zip)
1. `1-fr-FR-375-product-current-price.png` — Nutella in France: grade E, current price 4,05 € (10,12 €/kg) at Carrefour City Nancy, dated, from Open Prices, typical price range.
2. `2-de-DE-375-product-no-invented-price.png` — Germany: German UI, grade E, "no checked price for this barcode" instead of a made-up one.
3. `3-el-GR-375-prices-not-this-product.png` — Greece, Prices page: no verified price for this exact barcode, so it lists close products with their own observatory prices, clearly marked as other products.

## Deploy (exact commands; run from the unzipped tools folder with the site files next to it)
1. `npx wrangler login` as the Cloudflare account owner (Workers Paid plan needed for the crawler).
2. `scripts/deploy-prices.sh --seed --countries` — creates/uses D1 `foodscan-prices`, applies migrations, deploys the cron Worker `foodscan-price-ingest` (18:20 + 03:40 UTC daily, hourly :07), sets the admin token, seeds today's prices, loads HU/IL/HR, deploys Pages, runs the check. Add `--dry-run` first to see the plan.
3. Dashboard → Workers & Pages → the Pages project → Settings → Bindings → add D1 `FOODSCAN_PRICES_DB` = `foodscan-prices` (Production). Wrangler cannot do this without replacing the project's dashboard settings.
4. Signed remote data: `node scripts/sign-price-data.mjs keygen --out foodscan-data-key.pem` → store the private key as GitHub secret `FOODSCAN_DATA_SIGNING_KEY`, set the printed public key on Pages as `FOODSCAN_PRICE_DATA_PUBKEY`. The refresh job must run `node scripts/sign-price-data.mjs sign <dir> --key …` before every push (manifest older than 10 days is refused; without a key the site falls back to bundled data).
5. Country feeds daily: copy `ingest/adapters/country-prices.github-workflow.yml` to `.github/workflows/`, or cron `ingest/adapters/run_all.sh --apply`.
6. Check: `node scripts/verify-deploy.mjs https://food-scan.gearuptofit.com 101.0.0` — exits 1 while any source is `awaiting_first_run`, `never_ran`, `failing`, or data is not live. Re-run after the first cron.

Test the updater locally first (never touches Cloudflare):
```
node tools/updater-local.mjs --db /tmp/foodscan-prices.sqlite --steps posokanei,ekatanalotis,housekeeping
node tests/serve-cf.mjs "$PWD/site" 8851 --d1db /tmp/foodscan-prices.sqlite
node scripts/verify-deploy.mjs http://127.0.0.1:8851 101.0.0
```
Tests: `npm test`. Measurements: `npm run check:grades | check:coverage | check:abroad | check:perf`.

## Not done / not verified
- **No production deploy, no updater run on Cloudflare** (no credentials). Everything above is local emulation.
- **Daily rebuild of the bundled Greek catalogue export** not built (see P0-3).
- **Real phones and the camera** not tested (headless Chrome only).
- **French/German/Spanish/Italian main UI** is machine translation behind a filter; needs a native speaker review. Price card and Prices page are hand-written.
- **Greek observatory archive** (github spyrosavl/posokanei) has not been updated since 18 Nov 2026; e-katanalotis file unchanged since 16 Jun 2026. Upstream, not fixable here; both now show honestly in health.
- **Bazaar / Lidl reachability from Cloudflare** not verified (worked from this box).
- **Coverage is limited by real data**: ES, IT, GB, BR have no open barcode price feed, so most products there show no price (by design, never an invented one). Open Food Facts tagging quality limits the grade/category data.
- Two grade mismatches in the bulk run were caused by the local test's OFF request budget; they resolve on a single re-request but were not re-run as a full batch.
- "Healthier choices" abroad untested in this run because OFF search returned 503 to this machine.
