# FoodScan 79.0.0 — price accuracy and coverage

Release date: 2 Nov 2026 (Europe/Athens). Base: v78.0.0. Replaces the build Alex shared on 2 Nov 2026 (FoodScan-Freshness-Checks-Cloudflare-Pages-FIXED.zip).
Rule kept everywhere: no price is invented, estimated or interpolated. Every price shown has a source, a date and a link.

## Why prices were missing or wrong in Alex's build (measured on 2 Nov 2026)
Same samples throughout: popular-200 = 200 popular Greek supermarket barcodes; random-150 = 150 random Greek-prefix catalogue barcodes.

| Cause | Evidence |
|---|---|
| Production (food-scan.gearuptofit.com) still serves v52, which has no price route | verify-deploy: version 52, /api/prices/compare is missing |
| His build dropped the bundled price seeds (observatory, e-katanalotis, Bazaar, Lidl) and the D1 database | prices came only from live shop calls |
| My market live calls are blocked or rate-limited | 117 rate_limited + 80 unavailable out of 200 |
| The Kritikos live scrape matched few products, and its terms forbid reuse (see below) | matched 12 of 200 |
| Open Prices reads only page 1; Open Prices is sparse in Greece | — |
| Mixed VERSION constants (71.0.0 / 55.0.0 / 79.0.0); an unverified static index and benchmarks are shipped | — |
| The user's notes were merged into the basket as price offers | — |
| Result | **current price for 12/200 (6%) popular and 7/150 (4.7%) random** |

## What changed in 79.0.0
1. **Scan-time live check of the exact barcode** on bazaar-online.gr (schema.org microdata) and lidl.gr (JSON-LD gtin13).
   - A price is accepted only when the page carries exactly one Product whose barcode equals the scanned code, with one EUR price.
   - lidl.gr → www.lidl-hellas.gr: exactly one 301 hop is followed (same path, https only). Other redirects are never followed.
   - Page down, blocked, ambiguous or without markup → the dated seed price stays, labelled with its date.
   - Page names a different barcode → the price is dropped.
   - OutOfStock → shown but not ranked.
   - Checks run in parallel with a 2.5 s timeout each. `FS_SHOP_LIVE=0` turns them off.
   - Measured on 2 Nov: all 69 shop prices on popular-200 were confirmed live, and **6 of the 69 seed prices (8.7%) were stale and were corrected**. For example, Alpro 5411188120742 went from 3.25 € (seed, 31 Oct) to 1.90 € (live, 2 Nov).
2. **Size consensus.** When the price observatory's pack and at least one shop's barcode-exact pack agree against a wrong catalogue label, the agreed size is used (`packCheck.resolvedBy`). This fixes Kellogg's 5059319002323: the catalogue said 30 g, but the observatory and Bazaar both say 410 g.
3. **Kritikos is OFF by default (`FS_KRITIKOS` unset).**
   - kritikos-sm.gr terms: «Απαγορεύεται στον χρήστη η αντιγραφή, αναπαραγωγή, διάδοση, διάθεση, μετάδοση ή η με οιονδήποτε τρόπο χρήση αυτών, πέραν των χρήσεων που ρητώς ορίζονται…». The evidence is in `ingest/data/chains-evidence/`.
   - While it is off, the app makes no Kritikos requests, reads no Kritikos files, ignores D1 `kr:` rows, and shows the provider as "needs permission".
   - The 19,248-row seed is not in the site zip; it is in the tools zip under `optional/kritikos-seed/`.
   - Turn it on only with written permission from Kritikos.
4. Labelled tiers: current / other size / pack unconfirmed / older / out of stock / not ranked. Only "current" is ranked.
5. The user's own contributions and notes stay separate from source prices.
6. **Comparison table:** Greek product names in the column headers wrap in full (the 3-line clamp was removed).
7. **Version 79.0.0 everywhere:** worker, service-worker cache, pages and verify-deploy. TTL 600 s, or 0 when any provider is unavailable.
8. `scripts/eval-coverage.mjs` is the coverage and precision evaluator. It spot-verifies prices against shop pages.

## Coverage and precision (same samples, local Workers-compatible server, 2 Nov 2026)

| Build | popular-200 current | popular-200 any labelled price | random-150 current | random-150 any |
|---|---|---|---|---|
| Alex's build | 12 (6%) | 12 (6%) | 7 (4.7%) | 7 (4.7%) |
| v78 | 68 (34%) | 92 (46%) | 22 (14.7%) | 31 (20.7%) |
| **v79 default** | **68 (34%)** | **92 (46%)** | **21 (14%)** | **31 (20.7%)** |
| v79 with FS_KRITIKOS=1 (permission needed) | 84 (42%) | 105 (52.5%) | 33 (22%) | 44 (29.3%) |

Precision checks:
- Spot-verify against live shop pages, v79 default: 20/20 and 10/10 identical.
- Observatory automatch on the gold set: 280/280 correct.
- The live check fixed 6/69 stale shop prices that v78 would have shown as current.

Notes on the numbers:
- random-150 lost one "current" result against v78: 5201627260524. The catalogue says "NUTREE strawberry praline bar 50 g", while Bazaar's barcode-exact page says "Zagori water 330 ml". The two sources disagree on what the product is, so the 0.23 € price is shown under "other size" and is not ranked. This is deliberate: precision comes before coverage.
- Coverage did not grow without Kritikos because no other compliant source has new barcodes. The live check improves accuracy, not coverage.

## Coverage ceiling (honest)
- About 60 of the 108 popular-200 misses are Lidl in-store or own-label codes. lidl.gr lists only about 375 food products online.
- About 35 misses have no compliant public source at all.
- The price observatory (posokanei / e-katanalotis) publishes no EANs. 4,479 rows were refused because they had no safe barcode candidate.
- My market, AB, Sklavenitis, Masoutis, Galaxias, e-Fresh and Thanopoulos were rejected: their terms forbid reuse, they need a bot-protection bypass, or they have no barcode on the page.
- Broad, reliable coverage ("all products") is only possible with an official ministry feed that carries EANs, or with written data agreements from the chains. That is a business step, not a code step.

## Tests
`npm test` (NODE_OPTIONS=--max-old-space-size=4096): 9 files, 101 tests, all pass.
- New: tests/v79.test.mjs, 15 tests: live check, fallbacks, Lidl redirect, opt-in gate, size consensus.
- The v78 zip test runs against the built site zip with `FOODSCAN_SITE_ZIP=...`.

## Deploy (Alex)
1. Cloudflare Pages project `foodscan-cym`: upload the contents of `FoodScan-v79-site.zip` (flat; `_worker.js` and `index.html` at the root).
2. D1:
   - `wrangler d1 create foodscan-prices`;
   - `wrangler d1 execute foodscan-prices --remote --file ingest/migrations/0001_foodscan_prices.sql`;
   - bind it to Pages as `FOODSCAN_PRICES_DB`.
3. Set the Pages secret `FOODSCAN_PRICES_ADMIN_TOKEN` (and the same value on the ingest Worker); see README-TOOLS.md.
4. Optional: deploy the ingest Worker and its cron from the tools zip. Cron triggers need Workers Paid.
5. Leave `FS_KRITIKOS` unset unless Kritikos has given written permission. `FS_SHOP_LIVE=0` turns off the live shop checks if needed.
6. Run `node scripts/verify-deploy.mjs https://food-scan.gearuptofit.com 79.0.0`. It must report 79.0.0 and a working /api/prices/compare.

## Not verified
- The production deploy itself: nothing was deployed.
- Whether bazaar-online.gr and lidl-hellas.gr answer requests from Cloudflare Workers IPs. If they do not, the app falls back to the dated seed prices, labelled with their dates.
- D1 against a live binding.
