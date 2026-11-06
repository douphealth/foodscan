# FoodScan 63.0.0 — Steady Catalogue

Cloudflare Pages Direct Upload, same as 62.0.0: upload the ZIP as a new deployment (staging first). No new binding, migration or paid service. Saved foods and history are untouched. After deploying, `/api/health` must report `version 63.0.0`, `catalogue.status ready`, `catalogue.products 12113`.

## What changed since 62.0.0

**Catalogue search can no longer lose results.** Search returned at most the first 30 of a ranking cut at 80 hits and five shards, with no way to ask for more. It is now paged over the whole ranking; a "Show more results" button appends the next page (no repeats). Tested for six queries, including ones that span more than five shards, against a brute-force scan of the records: identical result sets. A shard that fails to load is counted and reported, not silently dropped.

**Graceful expiry.** After 90 days a snapshot stops supporting recommendations, but barcode lookups, search and shared links keep working for a year, and every grade read from it says "this catalogue snapshot is more than 90 days old". After a year nothing is served from it. (In 62.0.0 everything stopped at 90 days.)

**Refresh pipeline.** `tools/build-catalogue.mjs` builds the catalogue from the Open Food Facts bulk CSV (streamed, deterministic, hash-checked shards). Rebuilt from a CSV made out of the shipped records it reproduces all 12,113 records field for field. `docs/foodscan-catalogue-refresh.yml` is a monthly job that builds it and uploads an artifact only: it never commits or deploys. It has **not** been run against the real export.

**No composite score.** The balance view's "77/100 visual index" is gone, replaced by "Not a health score"; the five per-nutrient bars remain, with missing values shown as "not reported", never as zero or "low". (A composite number contradicts FoodScan's rule of showing only published standards.)

**Cloud backup endpoint hardened.** The v52–v62 `/api/sync` accepted any string as a key, in the URL, with no size, rate or row limits. It is now off unless `FOODSCAN_SYNC=1` and a D1 database are bound (the shipped app never calls it), needs a 256-bit key in the `Authorization` header, stores only its SHA-256, accepts only an opaque base64 blob up to 256 KB, rate-limits writes, caps rows, forgets backups after 180 days, and lets the owner delete. Six abuse tests run on SQLite.

**Faster first paint.** The 12 `modulepreload` hints competed with the stylesheet: first paint 2.57 s → 1.84 s on the throttled profile (4× CPU, 1.6 Mbps, 150 ms RTT, 4 alternating rounds). The time until the real app UI appears (5.5 s on that profile) is unchanged.

**Sitemap reconciled** with what the Worker actually indexes (13 of 13 product URLs are indexable). Product pages now say where their record came from (`X-FoodScan-Cache`).

## Still open (see the validation report)
Independent review of 200+ comparison pairs (a packet of 260 is ready, unreviewed); data enrichment of the records without ingredients/categories; other countries' catalogues; route-level code splitting and INP; repeat-shopping workspace (recheck saved choices when the source changes); verified recommendation-save/share-conversion metrics.

## Rollback
Deployments → promote the previous deployment (62.0.0 or 61.0.0). No schema or stored-data change. The old `cloud_sync` table (if ever created) is no longer read; see `docs/DEPLOYMENT-63.0.0.md`.
