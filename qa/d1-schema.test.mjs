/* The three D1 databases FoodScan can use (FOOD_DB, FOODSCAN_PUBLIC_DB, FOODSCAN_PRICES_DB) are created from d1-schema/*.sql. These tests run those files on real
 * SQLite and then the same statements the worker runs (upserts, FTS search, category index, negative lookups, budgets), so a typo in a schema fails here
 * and not in production. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ROOT } from './helpers.mjs';

const db = name => { const d = new DatabaseSync(':memory:'); d.exec(fs.readFileSync(path.join(ROOT, 'd1-schema', name), 'utf8')); return d; };
const tables = d => d.prepare("SELECT name FROM sqlite_master WHERE type IN ('table') ORDER BY name").all().map(r => r.name);

test('every schema file runs twice without error (IF NOT EXISTS: safe to paste again)', () => {
  for (const f of ['food_db.sql', 'public_db.sql', 'prices_db.sql']) { const d = db(f); d.exec(fs.readFileSync(path.join(ROOT, 'd1-schema', f), 'utf8')); }
});
test('FOOD_DB: the product upsert, the category/country index triggers and the full-text search the worker uses', () => {
  const d = db('food_db.sql');
  const up = d.prepare(`INSERT INTO products(gtin14,barcode,name,name_norm,brand_norm,raw_json,grade,grade_rank,quality_ok,quality_score,source_modified_at,verified_at,digest,raw_bytes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(gtin14) DO UPDATE SET
    barcode=excluded.barcode,name=excluded.name,name_norm=excluded.name_norm,brand_norm=excluded.brand_norm,raw_json=excluded.raw_json,grade=excluded.grade,grade_rank=excluded.grade_rank,quality_ok=excluded.quality_ok,quality_score=excluded.quality_score,source_modified_at=excluded.source_modified_at,verified_at=excluded.verified_at,digest=excluded.digest,raw_bytes=excluded.raw_bytes`);
  const raw = JSON.stringify({ product: { categories_tags: ['en:breads', 'en:white-breads'], countries_tags: ['en:greece'] } });
  up.run('05201673101314', '5201673101314', 'Ψωμί Τοστ', 'ψωμι τοστ', 'karamolegkos', raw, 'C', 3, 1, 0.9, 1, 2, 'd1', raw.length);
  assert.deepEqual(d.prepare('SELECT category FROM product_categories WHERE gtin14=? ORDER BY category').all('05201673101314').map(r => r.category), ['en:breads', 'en:white-breads']);
  assert.equal(d.prepare('SELECT country FROM product_countries WHERE gtin14=?').get('05201673101314').country, 'en:greece');
  assert.equal(d.prepare("SELECT p.gtin14 FROM product_fts f JOIN products p ON p.rowid=f.rowid WHERE product_fts MATCH ? ORDER BY bm25(product_fts) LIMIT 5").get('τοστ*').gtin14, '05201673101314');
  // update (a changed category list replaces the old index rows) and delete (nothing is left behind)
  up.run('05201673101314', '5201673101314', 'Ψωμί Τοστ', 'ψωμι τοστ', 'karamolegkos', JSON.stringify({ product: { categories_tags: ['en:toasts'], countries_tags: [] } }), 'B', 2, 1, 0.9, 1, 3, 'd2', 10);
  assert.deepEqual(d.prepare('SELECT category FROM product_categories').all().map(r => r.category), ['en:toasts']); assert.equal(d.prepare('SELECT COUNT(*) n FROM product_countries').get().n, 0);
  d.prepare('DELETE FROM products WHERE gtin14=?').run('05201673101314'); assert.equal(d.prepare('SELECT COUNT(*) n FROM product_categories').get().n, 0);
  // the budget and negative-lookup statements
  d.prepare('INSERT INTO upstream_budget(kind,next_allowed_ms) VALUES(?,?) ON CONFLICT(kind) DO NOTHING RETURNING next_allowed_ms').get('product', 5);
  assert.equal(d.prepare('UPDATE upstream_budget SET next_allowed_ms=? WHERE kind=? AND next_allowed_ms<=? RETURNING next_allowed_ms').get(10, 'product', 6).next_allowed_ms, 10);
  d.prepare("INSERT INTO negative_lookups(gtin14,expires_at,reason) VALUES(?,?,'not_found') ON CONFLICT(gtin14) DO UPDATE SET expires_at=excluded.expires_at").run('x', 9);
  assert.ok(tables(d).includes('refresh_claims') && tables(d).includes('cloud_sync_v2'));
});
test('FOODSCAN_PUBLIC_DB and FOODSCAN_PRICES_DB: every table the worker names exists', () => {
  const pub = tables(db('public_db.sql')); for (const t of ['foodscan_public_products', 'fsc_ingest_queue_lease', 'fsc_catalog_budget', 'fsc_battle_votes', 'fsc_ingest_jobs']) assert.ok(pub.includes(t), t);
  const pr = tables(db('prices_db.sql')); for (const t of ['foodscan_price_offers', 'foodscan_price_ingest_runs', 'foodscan_crawl_state', 'foodscan_price_changes', 'foodscan_barcode_names', 'foodscan_pk_links', 'foodscan_web_prices', 'foodscan_web_budget']) assert.ok(pr.includes(t), t);
});
test('every table name the worker reads or writes in D1 is defined by one of the schema files', () => {
  const worker = fs.readFileSync(path.join(ROOT, '_worker.js'), 'utf8'), defined = new Set(['food_db.sql', 'public_db.sql', 'prices_db.sql'].flatMap(f => tables(db(f))));
  const used = new Set([...worker.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN)\s+((?:foodscan|fsc|fs63)_[a-z_0-9]+|products|product_categories|product_countries|negative_lookups|upstream_budget|refresh_claims|cloud_sync_v2)\b/g)].map(m => m[1]));
  for (const t of used) assert.ok(defined.has(t) || t === 'fs63_x', `the worker uses table ${t}, no schema file creates it`);
});
