CREATE TABLE IF NOT EXISTS products(gtin14 TEXT PRIMARY KEY, barcode TEXT, name TEXT, name_norm TEXT, brand_norm TEXT, raw_json TEXT, grade TEXT, grade_rank INTEGER, quality_ok INTEGER DEFAULT 0, quality_score REAL DEFAULT 0, source_modified_at INTEGER, verified_at INTEGER, digest TEXT, raw_bytes INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS product_categories(gtin14 TEXT NOT NULL, category TEXT NOT NULL, eligible INTEGER NOT NULL DEFAULT 0, grade_rank INTEGER, quality_score REAL, PRIMARY KEY(gtin14,category));
CREATE INDEX IF NOT EXISTS product_categories_cat ON product_categories(category, eligible, grade_rank, quality_score DESC);
CREATE TABLE IF NOT EXISTS product_countries(gtin14 TEXT NOT NULL, country TEXT NOT NULL, PRIMARY KEY(gtin14,country));
CREATE INDEX IF NOT EXISTS product_countries_c ON product_countries(country);
CREATE TABLE IF NOT EXISTS negative_lookups(gtin14 TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, reason TEXT);
CREATE TABLE IF NOT EXISTS upstream_budget(kind TEXT PRIMARY KEY, next_allowed_ms INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS refresh_claims(gtin14 TEXT PRIMARY KEY, claimed_at INTEGER NOT NULL, next_retry_ms INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS cloud_sync_v2(id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS product_fts USING fts5(name_norm, brand_norm, content='products', content_rowid='rowid');
CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
 INSERT INTO product_fts(rowid,name_norm,brand_norm) VALUES(new.rowid,new.name_norm,new.brand_norm);
 INSERT OR IGNORE INTO product_categories(gtin14,category,eligible,grade_rank,quality_score) SELECT new.gtin14, value, COALESCE(new.quality_ok,0), new.grade_rank, new.quality_score FROM json_each(CASE WHEN json_valid(new.raw_json) THEN COALESCE(json_extract(new.raw_json,'$.product.categories_tags'),json_extract(new.raw_json,'$.categories_tags'),'[]') ELSE '[]' END);
 INSERT OR IGNORE INTO product_countries(gtin14,country) SELECT new.gtin14, value FROM json_each(CASE WHEN json_valid(new.raw_json) THEN COALESCE(json_extract(new.raw_json,'$.product.countries_tags'),json_extract(new.raw_json,'$.countries_tags'),'[]') ELSE '[]' END);
END;
CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
 INSERT INTO product_fts(product_fts,rowid,name_norm,brand_norm) VALUES('delete',old.rowid,old.name_norm,old.brand_norm);
 INSERT INTO product_fts(rowid,name_norm,brand_norm) VALUES(new.rowid,new.name_norm,new.brand_norm);
 DELETE FROM product_categories WHERE gtin14=new.gtin14;
 DELETE FROM product_countries WHERE gtin14=new.gtin14;
 INSERT OR IGNORE INTO product_categories(gtin14,category,eligible,grade_rank,quality_score) SELECT new.gtin14, value, COALESCE(new.quality_ok,0), new.grade_rank, new.quality_score FROM json_each(CASE WHEN json_valid(new.raw_json) THEN COALESCE(json_extract(new.raw_json,'$.product.categories_tags'),json_extract(new.raw_json,'$.categories_tags'),'[]') ELSE '[]' END);
 INSERT OR IGNORE INTO product_countries(gtin14,country) SELECT new.gtin14, value FROM json_each(CASE WHEN json_valid(new.raw_json) THEN COALESCE(json_extract(new.raw_json,'$.product.countries_tags'),json_extract(new.raw_json,'$.countries_tags'),'[]') ELSE '[]' END);
END;
CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
 INSERT INTO product_fts(product_fts,rowid,name_norm,brand_norm) VALUES('delete',old.rowid,old.name_norm,old.brand_norm);
 DELETE FROM product_categories WHERE gtin14=old.gtin14;
 DELETE FROM product_countries WHERE gtin14=old.gtin14;
END;
