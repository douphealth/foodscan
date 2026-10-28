# Public product pages pilot

This pilot is intentionally not enabled in production. The goal is one stable URL per validated barcode, not one URL per scan.

## Proposed architecture
- Serve server-rendered HTML at /products/{barcode} so search crawlers receive content without executing the SPA.
- Store only public source-derived product records in a dedicated Cloudflare D1 catalog. Never publish visitor scan history, profiles, private label photos, manual label values, or diary entries.
- Require a real product name, sufficient nutrition values, an explicit per-100-g/ml basis, and no critical source-integrity flags. Low-quality records must be noindex/404 and excluded from the sitemap.
- Use idempotent barcode upserts, source attribution, source update timestamps, escaped source strings, canonical URLs, and a paginated sitemap.
- Keep existing /#food/{barcode} application links working independently of public SEO pages.
- Review current Open Food Facts API terms, licensing, attribution and share-alike obligations before publishing a persistent derivative catalog.

## Production gates
1. Bind a dedicated staging D1 database as FOODSCAN_DB.
2. Apply schema.sql.
3. Integrate the renderer in the Worker before static asset fallback, preserving all /api routes.
4. Add rate-limited exact-barcode ingestion and idempotent upserts.
5. Add sitemap generation from eligible rows only.
6. Test XSS escaping, invalid barcodes, poor records, contradictory nutrition, canonical/schema output and existing scan/search flows.
7. Verify staging and rollback before production deployment.

This documentation alone does not enable routes, database storage, ingestion, or sitemap generation.