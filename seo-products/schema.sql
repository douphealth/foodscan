-- Apply only to a dedicated staging D1 database.
-- Do not store private user profiles, scan history, diary entries, photos, or manual label facts.
CREATE TABLE IF NOT EXISTS public_products (
 barcode TEXT PRIMARY KEY,
 product_name TEXT NOT NULL,
 brand TEXT,
 public_payload_json TEXT NOT NULL,
 source_url TEXT NOT NULL,
 source_modified_at TEXT,
 quality_status TEXT NOT NULL CHECK (quality_status IN ('eligible', 'quarantined')),
 core_nutrient_count INTEGER NOT NULL CHECK (core_nutrient_count BETWEEN 0 AND 8),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_public_products_eligible_updated ON public_products(quality_status, updated_at DESC);
