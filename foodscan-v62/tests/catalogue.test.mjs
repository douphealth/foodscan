import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { catalogue, CATALOGUE_DIR, APP, SUFFIX, domain, diskFetcher } from './helpers.mjs';
import { createCatalogue, skeleton } from '../src/market-catalogue.mjs';

const { manifest, records, byCode } = catalogue();

test('every shard matches the manifest: bytes, SHA-256 and record count', () => {
  let shards = 0;
  for (const [file, expected] of Object.entries(manifest.shards)) {
    const bytes = readFileSync(join(CATALOGUE_DIR, file));
    assert.equal(bytes.length, expected.bytes, file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, file);
    assert.equal(JSON.parse(bytes.toString('utf8')).products.length, expected.count, file); shards++;
  }
  assert.equal(shards, readdirSync(CATALOGUE_DIR).filter(f => /^part-/.test(f)).length);
});

test('12,113 unique, valid, Greece-listed barcodes', async () => {
  const dom = await domain();
  assert.equal(manifest.productCount, 12113); assert.equal(records.length, 12113); assert.equal(byCode.size, 12113);
  for (const { raw } of records) {
    assert.ok(dom.validBarcode(String(raw.code).padStart(raw.code.length, '0')), `${raw.code} fails its GTIN check digit`);
    assert.ok((raw.countries_tags || []).includes('en:greece'), `${raw.code} is not listed for Greece`);
  }
});

test('code buckets point at the shard that holds each barcode, and the search index covers every product', () => {
  const buckets = {};
  for (let i = 0; i < manifest.barcodeBuckets; i++) buckets[i] = JSON.parse(readFileSync(join(CATALOGUE_DIR, `codes-${String(i).padStart(2, '0')}.json`), 'utf8')).codes;
  for (const { raw, file } of records) { const key = String(raw.code).padStart(14, '0'), b = Number(key.slice(-6)) % manifest.barcodeBuckets; assert.equal(buckets[b][key], file, raw.code); }
  const search = JSON.parse(readFileSync(join(APP, 'assets', `search-index-${SUFFIX}.json`), 'utf8'));
  assert.equal(search.revision, manifest.revision); assert.equal(search.rows.length, 12113);
  assert.deepEqual(new Set(search.rows.map(r => r[0])), new Set(records.map(r => r.raw.code)));
});

test('licence and provenance travel with the data', () => {
  assert.equal(manifest.license, 'ODbL-1.0'); assert.match(manifest.source, /openfoodfacts/); assert.match(manifest.coverage, /not a complete inventory/i);
  assert.match(readFileSync(join(CATALOGUE_DIR, 'ATTRIBUTION.txt'), 'utf8'), /Open Food Facts contributors/);
});

test('barcode lookup parses one record, not the shard; results match a full parse', async () => {
  const dom = await domain(), cat = createCatalogue(diskFetcher), sample = records.filter((_, i) => i % 997 === 0).slice(0, 12);
  for (const { raw } of sample) {
    const p = await cat.product(String(raw.code));
    const direct = dom.parseProduct({ product: raw, fetchedAt: manifest.exportedAt }, String(raw.code));
    assert.equal(p.barcode, direct.barcode); assert.deepEqual(p.nutrition, direct.nutrition); assert.equal(p.catalogueSnapshot.revision, manifest.revision);
  }
  assert.ok(cat.stats().recordsParsed <= sample.length + 1, `parsed ${cat.stats().recordsParsed} records for ${sample.length} lookups`);
  assert.equal(await cat.product('0000000000000'), null);
});

test('Greek and Greeklish spellings find the same products', async () => {
  const cat = createCatalogue(diskFetcher);
  const names = async q => (await cat.search(q, { country: 'greece' })).products.map(p => `${p.name} ${p.brand}`.toLowerCase());
  assert.equal(skeleton('Γιώτης'), skeleton('giotis')); assert.equal(skeleton('Παπαδοπούλου'), skeleton('Papadopoulou'));
  const greek = await names('φέτα'), latin = await names('feta');
  assert.ok(greek.length > 5 && latin.length > 5);
  assert.ok((await names('galaktos')).length > 5, 'Greeklish "galaktos" finds γάλακτος products');
  assert.ok((await names('xalvas')).some(n => /χαλβ|halva/.test(n)), 'Greeklish halva');
  assert.ok((await names('ΓΙΩΤΗΣ')).length > 0 && (await names('giotis')).length === (await names('ΓΙΩΤΗΣ')).length);
  assert.deepEqual((await cat.search('x', { country: 'greece' })).products, [], 'one-letter queries return nothing');
  for (const q of ['φέτα', 'γάλα', 'oreo']) for (const p of (await cat.search(q, { country: 'greece' })).products) assert.ok(p.countries.includes('en:greece'));
});

test('another market never inherits Greece-only records', async () => {
  const cat = createCatalogue(diskFetcher);
  const r = await cat.search('feta', { country: 'france' });
  for (const p of r.products) assert.ok(p.countries.includes('en:france'));
});
