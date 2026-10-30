# Baseline

This workspace builds the release from the **v61 Cloudflare Pages bundle as received** (it has no source tree). The ZIP is not committed (10 MB, binary):

- file: `FoodScan-61.0.0-Fast-Relevant-Choices-Cloudflare-Pages.zip`
- SHA-256: `b83aab2c52c672ba61217d2e0922711d47797bf8614c98e000472cfd21f4cba8`

Put it at `baseline/` and run `npm run build`; `tools/build-v62.mjs` refuses to run on any other file. This change set builds `FoodScan-63.0.0-Steady-Catalogue-Cloudflare-Pages.zip`, SHA-256 `bd1cb32cc37f035110a137f824ab9a341227ebf6c11c54764453fcad843c1801` (rebuilt byte-identically from the source bundle in a fresh folder). The directory is still named `foodscan-v62/` to keep the PR's file history readable.
