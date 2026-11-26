#!/usr/bin/env node
/** Adds a "how complete is this record" number to every row of the browser's search index (assets/search-index-v106.json).
 * Why: the search ranked matches by how short their text is, so the barest records came first: a search for "γιαούρτι" opened on products called
 * just "Γιαούρτι", with no brand, no photo and no published grade, and the well-documented yogurts sat below them. Relevance still decides first
 * (the name starts with the query, then contains it); among equally relevant rows the complete ones now lead.
 *   row = [barcode, shard file, countries, folded text, q]     q = 4 (a real photo) + 2 (a published Nutri-Score) + 1 (a brand)
 * The first four columns are copied unchanged from the existing index; only q is computed here, from the catalogue shards and the photo index.
 *   node tools/build-search-index.mjs            writes the file
 *   node tools/build-search-index.mjs --check    fails when the file on disk differs from what would be written */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), assets = path.join(here, '../assets'), dir = path.join(assets, 'greece-r20261030');
export const FILE = path.join(assets, 'search-index-v106.json');
export const qOf = (rec, extraPhoto) => (rec?.image_front_small_url || rec?.image_front_url || extraPhoto ? 4 : 0) + (/^[a-e]$/i.test(String(rec?.nutriscore_grade || '')) ? 2 : 0) + (String(rec?.brands || '').trim() ? 1 : 0);

export function build() {
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const base = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const photos = JSON.parse(fs.readFileSync(path.join(assets, `photos-${index.revision}.json`), 'utf8')).photos || {};
  const recs = new Map();
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-')).sort()) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).products) recs.set(String(r.code), r);
  const rows = base.rows.map(r => { const rec = recs.get(String(r[0])); if (!rec) throw new Error(`row ${r[0]} is not in the catalogue`); return [r[0], r[1], r[2], r[3], qOf(rec, photos[String(r[0])])]; });
  return { schema: 2, revision: base.revision, rows };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = JSON.stringify(build());
  if (process.argv.includes('--check')) { if (fs.readFileSync(FILE, 'utf8') !== text) { console.error('search-index-v106.json is out of date: run node tools/build-search-index.mjs'); process.exit(1); } console.log('OK: search index matches the catalogue'); }
  else { fs.writeFileSync(FILE, text); const rows = JSON.parse(text).rows, n = b => rows.filter(r => r[4] & b).length; console.log(`${path.basename(FILE)}: ${rows.length} rows, photo ${n(4)}, published grade ${n(2)}, brand ${n(1)}`); }
}
