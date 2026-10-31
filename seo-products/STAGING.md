# FoodScan public catalog — gated staging integration

This branch extends PR #2 without enabling any production route by default. The current GitHub main app is older than the separate Cloudflare direct-upload v52 archive; do not deploy this GitHub branch as a replacement for v52 without porting and comparing the newer Worker.

## Staging configuration

1. Create a **new staging** Cloudflare D1 database and bind it as `FOODSCAN_DB` to the *staging* Pages project.
2. Apply `seo-products/schema.sql` against staging, e.g. `npx wrangler d1 execute <database-name> --remote --file=seo-products/schema.sql` using an authenticated Wrangler session.
3. Set `FOODSCAN_PUBLIC_PAGES_ENABLED=1` for staging only.
4. Set a strong random `FOODSCAN_INGEST_TOKEN` as a secret and `FOODSCAN_OFF_USER_AGENT` with a real, maintained contact address. Never commit either secret.
5. Test one authenticated POST `/api/public-products/ingest` with a JSON body containing only a barcode. This endpoint MUST NOT be exposed to the scanner. Ingest via a separately authorized, rate-limited server job. Rate limit at Cloudflare WAF and at the caller. No public endpoint should automatically write arbitrary scans.
6. Verify GET `/products/{barcode}`, absent/invalid code 404+noindex, `/sitemap-products-d1.xml`, HTML source without JS, page shares, data attribution, existing `/api/product/{barcode}`, `/api/search`, offline scans and existing app URLs.
7. Integrate `/sitemap-products-d1.xml` into the sitemap index only after the staging catalog and page quality are reviewed. This branch intentionally does not advertise staging URLs to search engines.
8. For the first 20 products, manually verify each source record against its published Open Food Facts fields and the rendered page. Evaluate image licenses, product uniqueness, allergens, dates and descriptions. Do not seed with fabricated examples.

## Privacy and indexing

The catalog stores public Open Food Facts source fields only. It does not persist visitor IDs, food diary entries, private images, manual labels, scan events or health information. Ineligible rows remain quarantined and outside the sitemap. Images are linked from the source, not rehosted.

Open Food Facts data is licensed under ODbL and may have attribution and share-alike requirements. Confirm database reuse obligations and image licensing before releasing a persistent derivative catalog. Its API imposes rate limits, so batch ingestion must throttle and honor 429 / Retry-After. The current ingestion endpoint is for private low-volume staging operations, not an unrestricted public scan trigger.

## Unfinished production gates

- Real D1 provision/binding and remote database tests.
- Durable queue, global rate limiting / retries and verified source synchronization.
- Twenty individually verified products in staging.
- Sitemap pagination and discovery beyond 5,000 eligible records.
- Dynamic OG scorecard images, rendered story downloads, source-backed recommendations, and conversion analytics.
- Real staging browser, lighthouse, scanner regressions and eventual v52 integration.

## Rollback

Unset `FOODSCAN_PUBLIC_PAGES_ENABLED` and redeploy the previous staging Worker. No existing scanner route is changed when the flag is off. D1 tables are isolated; export the staging database before any schema migration. Never delete public rows or alter production until a reviewed release.
