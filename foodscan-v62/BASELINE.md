# Baseline

This workspace builds v62 from the **v61 Cloudflare Pages bundle as received** (it has no source tree). The ZIP is not committed (10 MB, binary):

- file: `FoodScan-61.0.0-Fast-Relevant-Choices-Cloudflare-Pages.zip`
- SHA-256: `b83aab2c52c672ba61217d2e0922711d47797bf8614c98e000472cfd21f4cba8`

Put it at `baseline/` and run `npm run build`; `tools/build-v62.mjs` refuses to run on any other file. The result for this change set is `FoodScan-62.0.0-Verified-Points-Cloudflare-Pages.zip`, SHA-256 `be37d604a753035f52fbd1766ec394d04ebe2ade5b187e3be103b80668f90bb5` (rebuilt byte-identically from the source bundle in a fresh folder).
