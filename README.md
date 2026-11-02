# FoodScan 80.0.0 source (overlay build on v79)

    1. unzip FoodScan-v79.0.0-Groq-Full.zip into ./baseline/
    2. node tools/build-v80.mjs --zip      -> FoodScan-80.0.0-Complete-Prices-Cloudflare-Pages.zip (byte-reproducible)
    3. node tools/serve.mjs --dir app --port 8820      local Pages emulator
    4. node --test tests/*.test.mjs ; node --test tests/ui.spec.mjs     (browser spec: playwright-core + Chrome, see paths at the top of the file)
    5. node tools/verify-deploy.mjs <site url> 80.0.0      is the price system really live?
       node tools/coverage-eval.mjs <url>                   coverage on popular / random Greek barcodes
       node tools/live-accuracy.mjs <url>                   seed prices vs the shops' own pages

Layout: `src/` new client and worker code, `tools/` build and data tools, `data/seeds/` the four source files as shipped (2 Nov 2026),
`data/gr-est-v80/` the shipped estimates, `data/inputs/` what they were built from. `price-refresh/` is the self-contained daily refresh job
(copy that folder and `.github/workflows/refresh-prices.yml` into the repository; see price-refresh/refresh/README.md). `src/RELEASE-80.0.0.md` has the findings and numbers.
