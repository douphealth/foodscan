# Baseline

The release is built from the **v61 Cloudflare Pages bundle as received** (it has no source tree). The ZIP is committed under `baseline/` (10 MB, the same files v61 already serves publicly) so a clean checkout can rebuild:

- file: `baseline/FoodScan-61.0.0-Fast-Relevant-Choices-Cloudflare-Pages.zip`
- SHA-256: `b83aab2c52c672ba61217d2e0922711d47797bf8614c98e000472cfd21f4cba8` (the build refuses any other file)

`npm run build` writes `FoodScan-64.0.0-Qualified-Evidence-Cloudflare-Pages.zip`; the one built from the source bundle has SHA-256 `79910706178b9e025bb7469857ec78292509b1adc93e159165ade06df52d6e49`. The refreshed catalogue (`catalogues/greece-r20261030`, 14 MB of Open Food Facts data, ODbL) is not committed: CI builds with `release.ci.json` (baseline catalogue) and a refresh is rebuilt with `tools/build-catalogue.mjs` and gated by `tools/verify-catalogue.mjs`.
