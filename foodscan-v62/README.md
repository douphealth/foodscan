# FoodScan 62 workspace

`app/` is the deployable Cloudflare Pages tree and is **generated**: `npm run build` rebuilds it from `baseline/` (the v61 ZIP as received, hash-pinned in `release.json`) plus `src/` and `tools/patches-v62.mjs`.

| Path | What |
|---|---|
| `src/domain.mjs`, `src/domain/nutriscore2023.mjs` | the one grading engine (browser module and Worker are built from the same text) |
| `src/match-policy.mjs`, `src/comparison-guards.mjs` | what counts as the same kind of product; guards |
| `src/market-catalogue.mjs` | catalogue reader, lazy parsing, Greek/Greeklish search skeleton |
| `src/i18n-el-62.json` | Greek strings added for engine messages |
| `tools/` | build, Pages emulator (`serve.mjs`), catalogue audit/quarantine, live parity check, recommendation harness, perf/vitals |
| `tests/` | 53 tests: `npm test` (39) and `npm run e2e` (+ `tests/pwa.spec.mjs`) |
| `release-qa/` | evidence files produced by the tools |
| `docs/` | release notes, validation report, deployment guide |

The v61 bundle had no source tree; unchanged chunks are carried over byte for byte (renamed to `-v620` so immutable caching cannot serve old code).
