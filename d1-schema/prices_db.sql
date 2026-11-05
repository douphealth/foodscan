CREATE TABLE IF NOT EXISTS foodscan_price_offers (
 offer_key TEXT PRIMARY KEY, barcode TEXT NOT NULL, retailer_id TEXT NOT NULL, retailer TEXT NOT NULL,
 store_id TEXT NOT NULL, store_name TEXT NOT NULL, store_scope TEXT NOT NULL, city TEXT NOT NULL DEFAULT '',
 latitude REAL, longitude REAL, price_cents INTEGER NOT NULL, regular_price_cents INTEGER,
 price_basis TEXT NOT NULL DEFAULT 'item', discounted INTEGER NOT NULL DEFAULT 0, discount_type TEXT NOT NULL DEFAULT '',
 offer_conditions TEXT NOT NULL DEFAULT '', observed_at TEXT NOT NULL, valid_until TEXT,
 source_id TEXT NOT NULL, source_label TEXT NOT NULL, source_url TEXT NOT NULL, license_ref TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS foodscan_price_barcode ON foodscan_price_offers (barcode, observed_at DESC);
CREATE TABLE IF NOT EXISTS foodscan_price_ingest_runs(run_at TEXT NOT NULL, source_id TEXT NOT NULL, snapshot_date TEXT, status TEXT NOT NULL, rows INTEGER NOT NULL DEFAULT 0, detail TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS foodscan_crawl_state(source_id TEXT PRIMARY KEY, targets TEXT NOT NULL DEFAULT '[]', position INTEGER NOT NULL DEFAULT 0, cycle INTEGER NOT NULL DEFAULT 0, cycle_started_at TEXT, last_cycle_done_at TEXT, robots_sha1 TEXT, last_run_at TEXT, last_ok_at TEXT, last_status TEXT, pages_ok INTEGER NOT NULL DEFAULT 0, pages_failed INTEGER NOT NULL DEFAULT 0, consecutive_failures INTEGER NOT NULL DEFAULT 0, detail TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS foodscan_price_changes(offer_key TEXT NOT NULL, barcode TEXT NOT NULL, source_id TEXT NOT NULL, retailer_id TEXT NOT NULL, old_cents INTEGER NOT NULL, new_cents INTEGER NOT NULL, old_observed_at TEXT NOT NULL, new_observed_at TEXT NOT NULL, detected_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS foodscan_price_changes_b ON foodscan_price_changes(barcode, detected_at DESC);
CREATE TABLE IF NOT EXISTS foodscan_barcode_names(barcode TEXT NOT NULL, source_id TEXT NOT NULL, name TEXT NOT NULL, brand TEXT, price_cents INTEGER, regular_cents INTEGER, url TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(barcode,source_id));
CREATE TABLE IF NOT EXISTS foodscan_pk_links(ean TEXT NOT NULL, pk_id TEXT NOT NULL, pk_name TEXT NOT NULL, method TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, PRIMARY KEY(ean,pk_id));
-- 84: AI web price search (created on first use by the worker too; listed here so one run of this file sets the database up completely)
CREATE TABLE IF NOT EXISTS foodscan_web_prices(barcode TEXT NOT NULL, market TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, checked_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(barcode, market));
CREATE TABLE IF NOT EXISTS foodscan_web_budget(day TEXT PRIMARY KEY, n INTEGER NOT NULL);
