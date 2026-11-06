#!/usr/bin/env node
/** Builds a FoodScan market catalogue (the files under assets/greece-vNNN/) from an Open Food Facts CSV export.
 *   node tools/build-catalogue.mjs --csv en.openfoodfacts.org.products.csv[.gz] --country greece --out build/catalogue [--revision off-csv-2026-11-29] [--exported-at 2026-11-29T00:00:00Z]
 * Deterministic: the same CSV gives the same bytes. Streams the file (the real export is ~1 GB) and keeps only the market's rows.
 * Output files (schema 2, read by src/market-catalogue.mjs and the Worker): index.json (SHA-256 per shard), part-<family>-<n>.json,
 * codes-00..31.json (barcode -> shard), categories.json (category tag -> shards), search.json, ATTRIBUTION.txt, build-summary.json.
 * Source data: Open Food Facts contributors, ODbL 1.0 (database) / DbCL (contents). Country tags are listings, not stock. */
import { createReadStream, writeFileSync, mkdirSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILY_TAGS, discoveryFamily } from '../src/comparison-guards.mjs';
import { validBarcode } from '../src/domain.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const MAX_PER_SHARD = 330, MAX_SHARD_BYTES = 450000, BUCKETS = 32;
const LIST_FIELDS = ['categories_tags', 'labels_tags', 'countries_tags', 'allergens_tags', 'traces_tags', 'additives_tags', 'ingredients_analysis_tags', 'data_quality_errors_tags'];
const TEXT_FIELDS = ['product_name', 'brands', 'generic_name', 'quantity', 'serving_size', 'ingredients_text', 'pnns_groups_1', 'pnns_groups_2', 'stores', 'image_front_url', 'image_front_small_url', 'nutriscore_grade'];
const NUMBER_FIELDS = ['last_modified_t', 'serving_quantity', 'product_quantity', 'nutriscore_score', 'nova_group', 'additives_n'];

const num = v => { if (v === undefined || v === '') return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined; };
const tags = v => (v ? v.split(',').map(x => x.trim()).filter(Boolean) : []);

// The real export names a few columns differently from the shard fields (checked against en.openfoodfacts.org.products.csv.gz, 30 Oct 2026):
// allergens (tag list) -> allergens_tags; image_url / image_small_url (the front photo) -> image_front_url / image_front_small_url.
const ALIASES = { allergens_tags: ['allergens_tags', 'allergens'], image_front_url: ['image_front_url', 'image_url'], image_front_small_url: ['image_front_small_url', 'image_small_url'] };
/** One CSV row (header-indexed) -> the record shape the shards use. Only fields the source actually has are written. */
export function recordFromRow(row, header, country) {
  const get = name => { for (const n of ALIASES[name] || [name]) { const i = header.get(n); if (i !== undefined && (row[i] ?? '').trim()) return row[i].trim(); } return ''; };
  const code = get('code').replace(/\s/g, '');
  if (!validBarcode(code)) return { skip: 'invalid-barcode' };
  const countries = tags(get('countries_tags'));
  if (!countries.includes(`en:${country}`)) return { skip: 'not-listed' };
  const nutriments = {};
  for (const [name, i] of header) if (/_100g$/.test(name) && row[i] !== undefined && row[i] !== '') { const n = num(row[i]); if (n !== undefined) nutriments[name] = n; }
  const rec = { code };
  for (const f of TEXT_FIELDS) { const v = get(f); if (v) rec[f] = v; }
  for (const f of LIST_FIELDS) { const v = tags(get(f)); if (f === 'countries_tags' || v.length) rec[f] = v; }
  for (const f of NUMBER_FIELDS) { const v = num(get(f)); if (v !== undefined) rec[f] = v; }
  rec.nutriments = nutriments; rec.catalogue_export_format = 'csv';
  // A row is kept when it says what the product is (name, brand, generic name, pack size) or what is in it (nutrition, ingredients). A photo or a category tag alone is not a product:
  // the first run on the real export found 2,129 such rows (barcode + photo + categories) that the shipped 12,113-record catalogue rightly leaves out.
  const says = rec.product_name || rec.brands || rec.generic_name || rec.quantity || rec.ingredients_text || Object.keys(nutriments).length;
  if (!says) return { skip: 'no-usable-identity' };
  return { rec };
}

// category tag -> family, learned from the shipped catalogue's own partition (tools/derive-family-tags.mjs); the most specific vote wins
const { tags: TAG_FAMILY, pnns: PNNS_FAMILY } = JSON.parse(readFileSync(new URL('../src/family-tags.json', import.meta.url), 'utf8'));
const legacyFamily = product => {
  const votes = {}; for (const tag of product?.categories || []) { const f = TAG_FAMILY[tag] || Object.entries(FAMILY_TAGS).find(([, t]) => t === tag)?.[0]; if (f) votes[f] = (votes[f] || 0) + 1; }
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || (!(product?.categories || []).length && PNNS_FAMILY[product?.pnns] || '');
};
/** Family used to partition the shards: the same discovery rule the app applies at run time, so a base product's family and its shard family agree. */
export function familyOf(rec) {
  const product = { name: rec.product_name || '', categories: rec.categories_tags || [], pnns: rec.pnns_groups_2 || '' };
  return discoveryFamily(product, legacyFamily) || 'other';
}

/** barcode -> family for every product of an existing catalogue directory (the shard files carry their family). */
export function inheritFamilies(dir) {
  const map = new Map(); if (!dir || !existsSync(dir)) return map;
  for (const f of readdirSync(dir).filter(f => /^part-.*\.json$/.test(f))) { const d = JSON.parse(readFileSync(join(dir, f), 'utf8')); for (const p of d.products) map.set(String(p.code).padStart(14, '0'), d.family); }
  return map;
}

export async function buildCatalogue({ csv, country = 'greece', out, revision, exportedAt, version = '', previous = '' }) {
  const inherited = inheritFamilies(previous ? resolve(previous) : '');
  const input = createReadStream(csv); const lines = createInterface({ input: csv.endsWith('.gz') ? input.pipe(createGunzip()) : input, crlfDelay: Infinity });
  let header = null, rows = 0; const kept = new Map(), skipped = {};
  for await (const line of lines) {
    if (!header) { header = new Map(line.split('\t').map((n, i) => [n.trim(), i])); if (!header.has('code') || !header.has('countries_tags')) throw new Error('the CSV has no code/countries_tags columns: is this the Open Food Facts export?'); continue; }
    rows++;
    if (!line.includes(`en:${country}`)) { skipped['not-listed'] = (skipped['not-listed'] || 0) + 1; continue; } // cheap pre-filter: the real export has millions of rows
    const { rec, skip } = recordFromRow(line.split('\t'), header, country);
    if (skip) { skipped[skip] = (skipped[skip] || 0) + 1; continue; }
    const key = rec.code.padStart(14, '0'); const old = kept.get(key);
    if (old) { skipped.duplicate = (skipped.duplicate || 0) + 1; if ((rec.last_modified_t || 0) <= (old.last_modified_t || 0)) continue; }
    kept.set(key, rec);
  }
  if (!kept.size) throw new Error(`no ${country} rows found in ${rows} CSV rows`);
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  const exportedMs = exportedAt ? Date.parse(exportedAt) : Date.now(); if (!Number.isFinite(exportedMs)) throw new Error('bad --exported-at');
  const rev = revision || `off-csv-${new Date(exportedMs).toISOString().slice(0, 10)}`;
  const byFamily = {};
  for (const rec of [...kept.values()].sort((a, b) => (a.code < b.code ? -1 : 1))) (byFamily[inherited.get(rec.code.padStart(14, '0')) || familyOf(rec)] ||= []).push(rec);
  const shards = {}, families = {}, codes = Array.from({ length: BUCKETS }, () => ({})), categories = {}, searchRows = [];
  for (const family of Object.keys(byFamily).sort()) {
    const files = []; let part = [], n = 0;
    const flush = () => {
      if (!part.length) return; const file = `part-${family}-${n++}.json`;
      const text = JSON.stringify({ schema: 2, revision: rev, exportedAt: exportedMs, family, products: part });
      writeFileSync(join(out, file), text); shards[file] = { bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex'), count: part.length }; files.push(file);
      for (const rec of part) { const key = rec.code.padStart(14, '0'); codes[Number(key.slice(-6)) % BUCKETS][key] = file; for (const tag of rec.categories_tags || []) (categories[tag] ||= new Set()).add(file); searchRows.push([rec.code, rec.product_name || '', rec.brands || '', file, rec.countries_tags]); }
      part = [];
    };
    for (const rec of byFamily[family]) { part.push(rec); if (part.length >= MAX_PER_SHARD || Buffer.byteLength(JSON.stringify(part)) > MAX_SHARD_BYTES) flush(); }
    flush(); families[family] = { files, count: byFamily[family].length };
  }
  const bucket = i => String(i).padStart(2, '0');
  codes.forEach((map, i) => writeFileSync(join(out, `codes-${bucket(i)}.json`), JSON.stringify({ schema: 2, revision: rev, codes: map })));
  writeFileSync(join(out, 'categories.json'), JSON.stringify({ schema: 2, revision: rev, categories: Object.fromEntries(Object.entries(categories).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, [...v].sort()])) }));
  writeFileSync(join(out, 'search.json'), JSON.stringify({ schema: 2, revision: rev, rows: searchRows }));
  const source = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';
  writeFileSync(join(out, 'index.json'), JSON.stringify({ schema: 2, integrity: 'sha256', version, country, exportedAt: exportedMs, revision: rev, source, license: 'ODbL-1.0', productCount: kept.size, coverage: 'Open Food Facts country listings, not a complete inventory of Greek supermarkets or proof of current stock.', barcodeBuckets: BUCKETS, families, shards }));
  writeFileSync(join(out, 'ATTRIBUTION.txt'), `Open Food Facts contributors. Derived ${country} catalogue built ${new Date(exportedMs).toISOString().slice(0, 10)}.\nDatabase: https://world.openfoodfacts.org/data\nSource: ${source}\nDerived database license: ODbL 1.0 https://opendatacommons.org/licenses/odbl/1-0/\nCountry listings are not current retailer stock.\n`);
  const summary = { revision: rev, exportedAt: new Date(exportedMs).toISOString(), sourceRows: rows, products: kept.size, skipped, inheritedFamilies: [...kept.keys()].filter(k => inherited.has(k)).length, families: Object.fromEntries(Object.entries(families).map(([k, v]) => [k, v.count])), shards: Object.keys(shards).length };
  writeFileSync(join(out, 'build-summary.json'), JSON.stringify(summary, null, 1));
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const csv = arg('--csv'); if (!csv) { console.error('usage: node tools/build-catalogue.mjs --csv <export.csv[.gz]> --out <dir> [--country greece] [--revision ..] [--exported-at ..]'); process.exit(2); }
  const summary = await buildCatalogue({ csv: resolve(csv), country: arg('--country', 'greece'), out: resolve(arg('--out', 'build/catalogue')), revision: arg('--revision', ''), exportedAt: arg('--exported-at', ''), version: arg('--version', ''), previous: arg('--previous', '') });
  console.log(JSON.stringify(summary));
}
