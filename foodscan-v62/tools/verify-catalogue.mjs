#!/usr/bin/env node
/** Release gate for a catalogue directory (output of tools/build-catalogue.mjs). Exit code 0 only when every check passes.
 *   node tools/verify-catalogue.mjs <dir> [--previous <dir>] [--country greece] [--max-age-days 7] [--max-shrink 0.1] [--max-growth 0.5] [--report file.json]
 * Checks: manifest schema/licence/source, every shard's bytes + SHA-256 + count, no duplicate or invalid barcodes, every record listed for the market,
 * codes/search/categories indexes agree with the shards, enough families, product count within bounds of the previous catalogue, snapshot date sane,
 * and the share of records the engine would quarantine. A failed gate means the catalogue is NOT promoted (tools/promote-catalogue.mjs). */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validBarcode, parseProduct, dataQuality } from '../src/domain.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
export function verifyCatalogue(dir, { previous = '', country = 'greece', maxAgeDays = 7, maxShrink = 0.1, maxGrowth = 0.5, now = Date.now() } = {}) {
  const checks = [], fail = (name, detail) => checks.push({ name, ok: false, detail }), pass = (name, detail = '') => checks.push({ name, ok: true, detail });
  const read = f => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const m = read('index.json');
  m.schema === 2 && m.integrity === 'sha256' && m.country === country && m.license === 'ODbL-1.0' && /openfoodfacts/.test(m.source) && existsSync(join(dir, 'ATTRIBUTION.txt')) ? pass('manifest', `${m.revision}`) : fail('manifest', 'schema/integrity/country/licence/source/attribution');
  const age = (now - m.exportedAt) / 864e5;
  m.exportedAt <= now + 300000 && age <= maxAgeDays ? pass('snapshot date', `${age.toFixed(1)} days old`) : fail('snapshot date', `exportedAt ${new Date(m.exportedAt).toISOString()} is ${age.toFixed(1)} days old (limit ${maxAgeDays}, no future dates)`);
  let count = 0, bad = [], dupes = [], unlisted = 0, invalid = 0, blocked = 0; const seen = new Map(), perFile = new Map();
  for (const [file, s] of Object.entries(m.shards)) {
    const bytes = readFileSync(join(dir, file)), data = JSON.parse(bytes);
    if (bytes.length !== s.bytes || createHash('sha256').update(bytes).digest('hex') !== s.sha256 || data.products.length !== s.count || data.revision !== m.revision || data.exportedAt !== m.exportedAt) bad.push(file);
    for (const raw of data.products) {
      count++; const key = String(raw.code).padStart(14, '0');
      if (!validBarcode(String(raw.code))) invalid++; if (!(raw.countries_tags || []).includes(`en:${country}`)) unlisted++;
      if (seen.has(key)) dupes.push(raw.code); seen.set(key, file); perFile.set(raw.code, file);
      const p = parseProduct({ product: raw, fetchedAt: m.exportedAt }, String(raw.code)); if (p && dataQuality(p).state === 'blocked') blocked++;
    }
  }
  bad.length ? fail('shards', `${bad.length} shard(s) fail bytes/sha256/count/revision: ${bad.slice(0, 3)}`) : pass('shards', `${Object.keys(m.shards).length} shards verified`);
  count === m.productCount ? pass('product count', String(count)) : fail('product count', `${count} records, manifest says ${m.productCount}`);
  dupes.length ? fail('duplicates', `${dupes.length} duplicate barcode(s) e.g. ${dupes.slice(0, 3)}`) : pass('duplicates', 'none');
  invalid ? fail('barcodes', `${invalid} invalid GTIN(s)`) : pass('barcodes', 'all valid');
  unlisted ? fail('market', `${unlisted} record(s) not listed for ${country}`) : pass('market', `all listed for ${country}`);
  Object.keys(m.families).length >= 25 ? pass('families', String(Object.keys(m.families).length)) : fail('families', `only ${Object.keys(m.families).length}`);
  let indexBad = 0;
  for (let i = 0; i < m.barcodeBuckets; i++) { const codes = read(`codes-${String(i).padStart(2, '0')}.json`).codes; for (const [key, file] of Object.entries(codes)) if (seen.get(key) !== file || Number(key.slice(-6)) % m.barcodeBuckets !== i) indexBad++; }
  const search = read('search.json').rows, cats = read('categories.json').categories;
  if (search.length !== count || search.some(r => perFile.get(r[0]) !== r[3])) indexBad++;
  for (const files of Object.values(cats)) for (const f of files) if (!m.shards[f]) indexBad++;
  indexBad ? fail('indexes', `${indexBad} index inconsistencies`) : pass('indexes', 'codes, search and categories agree with the shards');
  const blockedShare = count ? blocked / count : 0;
  blockedShare <= 0.05 ? pass('quarantine share', `${blocked} records (${(blockedShare * 100).toFixed(1)}%) would be withheld`) : fail('quarantine share', `${(blockedShare * 100).toFixed(1)}% of records are contradictory: the export may be damaged`);
  if (previous) {
    const old = JSON.parse(readFileSync(join(previous, 'index.json'), 'utf8')), change = (m.productCount - old.productCount) / old.productCount;
    change >= -maxShrink && change <= maxGrowth ? pass('product count change', `${old.productCount} -> ${m.productCount} (${(change * 100).toFixed(1)}%)`) : fail('product count change', `${old.productCount} -> ${m.productCount} (${(change * 100).toFixed(1)}%) is outside -${maxShrink * 100}%..+${maxGrowth * 100}%`);
    m.exportedAt > old.exportedAt ? pass('newer than previous', `${new Date(old.exportedAt).toISOString().slice(0, 10)} -> ${new Date(m.exportedAt).toISOString().slice(0, 10)}`) : fail('newer than previous', 'the new snapshot is not newer');
  }
  return { dir, ok: checks.every(c => c.ok), revision: m.revision, products: count, checks };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : null;
  if (!dir) { console.error('usage: node tools/verify-catalogue.mjs <dir> [--previous <dir>]'); process.exit(2); }
  const result = verifyCatalogue(dir, { previous: arg('--previous', '') ? resolve(arg('--previous')) : '', country: arg('--country', 'greece'), maxAgeDays: Number(arg('--max-age-days', 7)), maxShrink: Number(arg('--max-shrink', 0.1)), maxGrowth: Number(arg('--max-growth', 0.5)) });
  for (const c of result.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ': ' + c.detail : ''}`);
  if (arg('--report', '')) writeFileSync(resolve(arg('--report')), JSON.stringify(result, null, 1));
  process.exit(result.ok ? 0 : 1);
}
