# FoodScan 64 workspace

`app/` is the deployable Cloudflare Pages tree and is **generated**: `npm run build` rebuilds it from `baseline/` (the v61 ZIP as received, hash-pinned in `release.json`) plus `src/` and `tools/patches-v62.mjs`.

| Path | What |
|---|---|
| `src/domain.mjs`, `src/domain/nutriscore2023.mjs` | the one grading engine (browser module and Worker are built from the same text) |
| `src/match-policy.mjs`, `src/comparison-guards.mjs` | what counts as the same kind of product; guards |
| `src/market-catalogue.mjs` | catalogue reader, lazy parsing, Greek/Greeklish search skeleton |
| `src/i18n-el-62.json` | Greek strings added for engine messages |
| `tools/` | build, catalogue builder (`build-catalogue.mjs`), Pages emulator (`serve.mjs`), catalogue audit/quarantine, live parity check, recommendation harness, perf/vitals |
| `tests/` | 84 tests: `npm test` (68) and `npm run e2e` (16) |
| `release-qa/` | evidence files produced by the tools |
| `docs/` | release notes, validation report, deployment guide |

The v61 bundle had no source tree; unchanged chunks are carried over byte for byte (renamed to `-v620` so immutable caching cannot serve old code).

**63.0.0 additions:** `tools/build-catalogue.mjs` (Open Food Facts CSV → catalogue; `release.rehearsal.json` shows how a rebuilt catalogue is adopted), `tools/reconcile-sitemap.mjs`, `tools/make-review-pairs.mjs` / `score-review.mjs` (independent relevance review), `tools/snippets/` (exact-match patch bodies), `docs/foodscan-catalogue-refresh.yml` (artifact-only monthly job).

**64.0.0 additions:** `tools/verify-catalogue.mjs` (release gates), `tools/promote-catalogue.mjs` (atomic adoption + `--rollback`), `tools/catalogue-coverage.mjs`, `tools/replay-review-pairs.mjs`, `tools/make-golden.mjs` (+ `tests/fixtures/golden-off-2023.json`), `release.ci.json` (baseline-catalogue config used by CI), `catalogues/greece-r20261030/` (the verified catalogue built from the real 30 Oct 2026 export), `docs/foodscan-ci.yml`. `tools/patch-v64-*.mjs` are the one-off edit scripts that produced this release's source changes, kept for the record.
