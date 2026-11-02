/* FoodScan 74 · the D1 row format of foodscan_price_offers, identical to what the Pages Worker's admin import writes
 * (fsPriceValidateImportRecord), so the cron Worker, the box script and the admin endpoint all produce the same rows. */
export const SCHEMA = `CREATE TABLE IF NOT EXISTS foodscan_price_offers (
 offer_key TEXT PRIMARY KEY, barcode TEXT NOT NULL, retailer_id TEXT NOT NULL, retailer TEXT NOT NULL,
 store_id TEXT NOT NULL, store_name TEXT NOT NULL, store_scope TEXT NOT NULL, city TEXT NOT NULL DEFAULT '',
 latitude REAL, longitude REAL, price_cents INTEGER NOT NULL, regular_price_cents INTEGER,
 price_basis TEXT NOT NULL DEFAULT 'item', discounted INTEGER NOT NULL DEFAULT 0, discount_type TEXT NOT NULL DEFAULT '',
 offer_conditions TEXT NOT NULL DEFAULT '', observed_at TEXT NOT NULL, valid_until TEXT,
 source_id TEXT NOT NULL, source_label TEXT NOT NULL, source_url TEXT NOT NULL, license_ref TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS foodscan_price_barcode ON foodscan_price_offers (barcode, observed_at DESC);
CREATE TABLE IF NOT EXISTS foodscan_price_ingest_runs (
 run_at TEXT NOT NULL, source_id TEXT NOT NULL, snapshot_date TEXT, status TEXT NOT NULL, rows INTEGER NOT NULL DEFAULT 0,
 detail TEXT NOT NULL DEFAULT '', PRIMARY KEY (run_at, source_id)
);
CREATE INDEX IF NOT EXISTS foodscan_price_runs_source ON foodscan_price_ingest_runs (source_id, run_at DESC);
CREATE TABLE IF NOT EXISTS foodscan_crawl_state (
 source_id TEXT PRIMARY KEY, targets TEXT NOT NULL DEFAULT '[]', position INTEGER NOT NULL DEFAULT 0, cycle INTEGER NOT NULL DEFAULT 0,
 cycle_started_at TEXT, last_cycle_done_at TEXT, robots_sha1 TEXT, last_run_at TEXT, last_ok_at TEXT, last_status TEXT,
 pages_ok INTEGER NOT NULL DEFAULT 0, pages_failed INTEGER NOT NULL DEFAULT 0, consecutive_failures INTEGER NOT NULL DEFAULT 0, detail TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS foodscan_price_changes (
 offer_key TEXT NOT NULL, barcode TEXT NOT NULL, source_id TEXT NOT NULL, retailer_id TEXT NOT NULL,
 old_cents INTEGER NOT NULL, new_cents INTEGER NOT NULL, old_observed_at TEXT NOT NULL, new_observed_at TEXT NOT NULL, detected_at TEXT NOT NULL,
 PRIMARY KEY (offer_key, detected_at)
);
CREATE INDEX IF NOT EXISTS foodscan_price_changes_barcode ON foodscan_price_changes (barcode, detected_at DESC);
CREATE TABLE IF NOT EXISTS foodscan_barcode_names (
 barcode TEXT NOT NULL, source_id TEXT NOT NULL, name TEXT NOT NULL, brand TEXT, price_cents INTEGER, regular_cents INTEGER, url TEXT, updated_at TEXT NOT NULL,
 PRIMARY KEY (barcode, source_id)
);
CREATE TABLE IF NOT EXISTS foodscan_pk_links (
 ean TEXT PRIMARY KEY, pk_id TEXT NOT NULL UNIQUE, pk_name TEXT NOT NULL, method TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);`;
export const COLUMNS = ['offer_key', 'barcode', 'retailer_id', 'retailer', 'store_id', 'store_name', 'store_scope', 'city', 'latitude', 'longitude', 'price_cents', 'regular_price_cents', 'price_basis', 'discounted', 'discount_type', 'offer_conditions', 'observed_at', 'valid_until', 'source_id', 'source_label', 'source_url', 'license_ref', 'updated_at'];
export const UPSERT = `INSERT INTO foodscan_price_offers (${COLUMNS.join(',')}) VALUES (${COLUMNS.map(() => '?').join(',')})
 ON CONFLICT(offer_key) DO UPDATE SET price_cents=excluded.price_cents,regular_price_cents=excluded.regular_price_cents,discounted=excluded.discounted,discount_type=excluded.discount_type,
 offer_conditions=excluded.offer_conditions,observed_at=excluded.observed_at,valid_until=excluded.valid_until,source_url=excluded.source_url,
 license_ref=excluded.license_ref,updated_at=excluded.updated_at WHERE excluded.observed_at >= foodscan_price_offers.observed_at`;
const key14 = c => String(c).padStart(14, '0');

/** Adapter record -> D1 row. source = {id,label,license}. */
export function rowFor(r, source, nowISO = new Date().toISOString()) {
  const storeId = r.retailer_id + ':' + r.store_id, discountType = r.discount_type || '';
  return {
    // Web-shop sources pass key_discount '' so one shelf item keeps one key whether or not it is on sale (change detection sees sale starts/ends).
    offer_key: [source.id, key14(r.barcode), storeId, r.basis, r.key_discount ?? discountType].join('|'), barcode: key14(r.barcode), retailer_id: r.retailer_id, retailer: r.retailer,
    store_id: storeId, store_name: r.store_name, store_scope: r.store_scope, city: '', latitude: null, longitude: null,
    price_cents: Math.round(r.price * 100), regular_price_cents: r.regular_price > r.price ? Math.round(r.regular_price * 100) : null, price_basis: r.basis, discounted: discountType ? 1 : 0, discount_type: discountType,
    offer_conditions: '', observed_at: r.observed_at, valid_until: /^\d{4}-\d{2}-\d{2}$/.test(r.valid_until || '') ? r.valid_until : null, source_id: source.id, source_label: source.label,
    source_url: r.source_url, license_ref: source.license.slice(0, 120), updated_at: nowISO,
  };
}
/** Adapter record -> body record for POST /api/prices/admin/import. */
export const importRecordFor = r => ({ barcode: r.barcode, retailer_id: r.retailer_id, store_scope: r.store_scope, store_id: r.store_id, store_name: r.store_name,
  price: r.price, basis: r.basis, observed_at: r.observed_at, discount_type: r.discount_type || '', source_url: r.source_url });

const lit = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
/** Rows -> SQL text for `wrangler d1 execute --file`. */
export function sqlFor(rows, { schema = true } = {}) {
  const head = schema ? SCHEMA + '\n' : '';
  return head + rows.map(r => UPSERT.replace(/VALUES \([?,]+\)/, `VALUES (${COLUMNS.map(c => lit(r[c])).join(',')})`) + ';').join('\n') + '\n';
}
/** Rows -> D1 batches with price-change detection: the stored price of each offer is read first; when the new observation is
 *  the same age or newer and the price differs, a row goes to foodscan_price_changes (old -> new, both dates). */
export async function writeRowsTracked(db, rows, nowISO = new Date().toISOString(), size = 50) {
  let n = 0, changes = 0;
  for (let i = 0; i < rows.length; i += size) {
    const part = rows.slice(i, i + size);
    const got = await db.prepare(`SELECT offer_key, price_cents, observed_at FROM foodscan_price_offers WHERE offer_key IN (${part.map(() => '?').join(',')})`).bind(...part.map(r => r.offer_key)).all();
    const prev = new Map((got.results || []).map(r => [r.offer_key, r]));
    const stmts = part.map(r => db.prepare(UPSERT).bind(...COLUMNS.map(c => r[c] ?? null)));
    for (const r of part) {
      const p = prev.get(r.offer_key);
      if (p && p.price_cents !== r.price_cents && r.observed_at >= p.observed_at) {
        changes++;
        stmts.push(db.prepare('INSERT OR IGNORE INTO foodscan_price_changes (offer_key,barcode,source_id,retailer_id,old_cents,new_cents,old_observed_at,new_observed_at,detected_at) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(r.offer_key, r.barcode, r.source_id, r.retailer_id, p.price_cents, r.price_cents, p.observed_at, r.observed_at, nowISO));
      }
    }
    await db.batch(stmts);
    n += part.length;
  }
  return { rows: n, changes };
}
/** Rows -> D1 batches (Worker). */
export async function writeRows(db, rows, size = 50) {
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    const part = rows.slice(i, i + size);
    await db.batch(part.map(r => db.prepare(UPSERT).bind(...COLUMNS.map(c => r[c] ?? null))));
    n += part.length;
  }
  return n;
}
