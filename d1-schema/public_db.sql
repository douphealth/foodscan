CREATE TABLE IF NOT EXISTS foodscan_public_products(gtin14 TEXT PRIMARY KEY, barcode TEXT, product_name TEXT, brand TEXT, family TEXT, grade TEXT, source_url TEXT, source_modified_at INTEGER, verified_at INTEGER, source_json TEXT, status TEXT, quality_reason TEXT, updated_at INTEGER, publication_state TEXT, reviewed_at INTEGER);
CREATE INDEX IF NOT EXISTS fpp_state ON foodscan_public_products(publication_state, updated_at DESC);
CREATE TABLE IF NOT EXISTS fsc_ingest_queue_lease(gtin14 TEXT PRIMARY KEY, last_queued_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS fsc_catalog_budget(name TEXT PRIMARY KEY, next_allowed_ms INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS fsc_battle_votes(pair TEXT PRIMARY KEY, code_a TEXT, code_b TEXT, votes_a INTEGER NOT NULL DEFAULT 0, votes_b INTEGER NOT NULL DEFAULT 0, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS fsc_ingest_jobs(barcode TEXT PRIMARY KEY, queued_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_try_ms INTEGER NOT NULL DEFAULT 0, last_status TEXT);
