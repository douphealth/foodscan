import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogue, domain } from './helpers.mjs';
import { buildCatalogue, recordFromRow, familyOf } from '../tools/build-catalogue.mjs';
import { createCatalogue } from '../src/market-catalogue.mjs';

const { records, manifest } = catalogue();
const LISTS = ['categories_tags', 'labels_tags', 'countries_tags', 'allergens_tags', 'traces_tags', 'additives_tags', 'ingredients_analysis_tags', 'data_quality_errors_tags'];
const TEXTS = ['product_name', 'brands', 'generic_name', 'quantity', 'serving_size', 'ingredients_text', 'pnns_groups_1', 'pnns_groups_2', 'stores', 'image_front_url', 'image_front_small_url', 'nutriscore_grade'];
const NUMS = ['last_modified_t', 'serving_quantity', 'product_quantity', 'nutriscore_score', 'nova_group', 'additives_n'];
const clean = v => String(v).replace(/[\t\r\n]+/g, ' ');
/** The Open Food Facts CSV shape (tab separated, tags comma separated, one column per nutrient) made from the shipped records, plus rows that must be rejected. */
function syntheticCsv() {
  const nutrients = [...new Set(records.flatMap(r => Object.keys(r.raw.nutriments)))].sort();
  const header = ['code', 'url', ...TEXTS, ...LISTS, ...NUMS, ...nutrients], rows = [header.join('\t')];
  const row = raw => header.map(h => h === 'code' ? raw.code : h === 'url' ? 'https://world.openfoodfacts.org/product/' + raw.code : LISTS.includes(h) ? clean((raw[h] || []).join(',')) : TEXTS.includes(h) ? clean(raw[h] ?? '') : NUMS.includes(h) ? (raw[h] ?? '') : (raw.nutriments[h] ?? '')).join('\t');
  for (const { raw } of records) rows.push(row(raw));
  const base = records[0].raw;
  rows.push(row({ ...base, code: '1234567890123' }));                                              // bad check digit
  rows.push(row({ ...base, code: '5449000000996', countries_tags: ['en:france'] }));               // not listed for Greece
  rows.push(row({ code: '4006381333931', countries_tags: ['en:greece'], nutriments: {} }));         // nothing usable
  rows.push(row({ ...base, product_name: 'OLD COPY', last_modified_t: (base.last_modified_t || 1) - 1000 })); // an older duplicate of records[0]
  return rows.join('\n') + '\n';
}
let built;
async function build(out) { const dir = mkdtempSync(join(tmpdir(), 'fs-cat-')), csv = join(dir, 'export.csv'); writeFileSync(csv, syntheticCsv()); return { dir, csv, summary: await buildCatalogue({ csv, country: 'greece', out: join(dir, out), exportedAt: '2026-11-29T00:00:00Z', version: 'test' }), out: join(dir, out) }; }

test('the builder turns an Open Food Facts CSV into the shipped catalogue, record for record', async () => {
  built = await build('a'); console.log('SKIPPED', JSON.stringify(built.summary.skipped));
  assert.equal(built.summary.products, 12113); assert.equal(built.summary.sourceRows, 12113 + 4);
  assert.deepEqual(built.summary.skipped, { 'invalid-barcode': 1, 'not-listed': 1, 'no-usable-identity': 1, duplicate: 1 });
  const got = new Map();
  for (const f of readdirSync(built.out).filter(f => /^part-/.test(f))) for (const p of JSON.parse(readFileSync(join(built.out, f), 'utf8')).products) got.set(String(p.code), p);
  assert.equal(got.size, 12113);
  const norm = v => JSON.stringify(v, (k, x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : x));
  let different = 0;
  for (const { raw } of records) { const mine = got.get(String(raw.code)); assert.ok(mine, raw.code); const a = JSON.parse(norm(raw)), b = JSON.parse(norm(mine)); for (const k of Object.keys(a)) if (!isDeepStrictEqual(a[k], b[k]) && !(Array.isArray(a[k]) && !a[k].length && b[k] === undefined)) { different++; if (different < 4) console.log('differs', raw.code, k, JSON.stringify(a[k]).slice(0, 80), JSON.stringify(b[k])?.slice(0, 80)); } }
  assert.equal(different, 0, `${different} fields differ from the shipped records`);
  assert.equal(got.get(String(records[0].raw.code)).product_name, records[0].raw.product_name, 'the newer of two duplicate rows wins');
});

test('the output is internally consistent: hashes, buckets, categories, search rows, and deterministic bytes', async () => {
  const index = JSON.parse(readFileSync(join(built.out, 'index.json'), 'utf8'));
  for (const [file, s] of Object.entries(index.shards)) { const bytes = readFileSync(join(built.out, file)); assert.equal(bytes.length, s.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), s.sha256); assert.equal(JSON.parse(bytes).products.length, s.count); assert.ok(s.count <= 330 && s.bytes < 4 * 1024 * 1024); }
  assert.equal(index.exportedAt, Date.parse('2026-11-29T00:00:00Z')); assert.equal(index.revision, 'off-csv-2026-11-29'); assert.equal(index.license, 'ODbL-1.0');
  const search = JSON.parse(readFileSync(join(built.out, 'search.json'), 'utf8')); assert.equal(search.rows.length, 12113);
  const cats = JSON.parse(readFileSync(join(built.out, 'categories.json'), 'utf8')).categories; assert.ok(Object.keys(cats).length > 2500);
  const again = await build('b'); assert.equal(createHash('sha256').update(readFileSync(join(again.out, 'index.json'))).digest('hex'), createHash('sha256').update(readFileSync(join(built.out, 'index.json'))).digest('hex'), 'same CSV, same bytes');
});

test('the app can read a catalogue the builder made: lookups, search, family queries', async () => {
  const fetcher = url => { const p = String(url).replace('/assets/{{catalogue}}/', ''); try { return Promise.resolve(new Response(readFileSync(join(built.out, p)), { status: 200 })); } catch { return Promise.resolve(new Response('', { status: 404 })); } };
  const cat = createCatalogue(fetcher), dom = await domain();
  Object.defineProperty(globalThis, '__now', { value: 1, configurable: true });
  const real = Date.now; Date.now = () => Date.parse('2026-12-01T00:00:00Z');
  try {
    const p = await cat.product('5201673006909'); assert.equal(p.name, 'Ψωμί Γερμανικού Τύπου'); assert.equal(p.catalogueSnapshot.exportedAt, Date.parse('2026-11-29T00:00:00Z'));
    assert.equal(dom.assessGrade(p).grade, 'C');
    assert.ok((await cat.search('feta', { country: 'greece' })).products.length > 5);
    const q = await cat.query({ family: 'bread' }, { country: 'greece' }); assert.ok(q.products.length > 300); assert.equal(q.catalogue.status, 'ready');
  } finally { Date.now = real; }
});

test('family assignment matches the shipped partition for at least 85% of records (it only chooses which shards a family query reads)', () => {
  let same = 0; for (const { raw, family } of records) if (familyOf(raw) === family) same++;
  assert.ok(same / records.length >= 0.85, `${same}/${records.length}`);
});

test('row parsing rejects what must never ship', () => {
  const header = new Map(['code', 'product_name', 'countries_tags'].map((n, i) => [n, i]));
  assert.equal(recordFromRow(['5201673006909', 'x', 'en:greece,en:france'], header, 'greece').rec.code, '5201673006909');
  assert.equal(recordFromRow(['5201673006900', 'x', 'en:greece'], header, 'greece').skip, 'invalid-barcode');
  assert.equal(recordFromRow(['5201673006909', 'x', 'en:cyprus'], header, 'greece').skip, 'not-listed');
});

test('a gzipped export (the real file is .csv.gz) is read as a stream, and a wrong file is refused', async () => {
  const { gzipSync } = await import('node:zlib');
  const dir = mkdtempSync(join(tmpdir(), 'fs-gz-')), lines = syntheticCsv().split('\n'), gz = join(dir, 'export.csv.gz');
  writeFileSync(gz, gzipSync(lines.slice(0, 301).join('\n') + '\n'));
  const summary = await buildCatalogue({ csv: gz, country: 'greece', out: join(dir, 'out'), exportedAt: '2026-11-29T00:00:00Z' });
  assert.equal(summary.products, 300);
  const bad = join(dir, 'bad.csv'); writeFileSync(bad, 'a\tb\n1\t2\n');
  await assert.rejects(buildCatalogue({ csv: bad, country: 'greece', out: join(dir, 'out2') }), /Open Food Facts export/);
  const none = join(dir, 'none.csv'); writeFileSync(none, 'code\tcountries_tags\n5201673006909\ten:france\n');
  await assert.rejects(buildCatalogue({ csv: none, country: 'greece', out: join(dir, 'out3') }), /no greece rows/);
});
