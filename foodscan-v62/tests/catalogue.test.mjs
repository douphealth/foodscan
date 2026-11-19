import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { catalogue, CATALOGUE_DIR, ACTIVE_CATALOGUE_DIR, APP, SUFFIX, domain, diskFetcher } from './helpers.mjs';
import { verifyCatalogue } from '../tools/verify-catalogue.mjs';
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
  // the reference snapshot's own search index is the baseline search.json (the shipped index may be a newer catalogue's: see the active-catalogue test)
  const ref = JSON.parse(readFileSync(join(CATALOGUE_DIR, 'search.json'), 'utf8'));
  assert.equal(ref.revision, manifest.revision); assert.equal(ref.rows.length, 12113);
  assert.deepEqual(new Set(ref.rows.map(r => r[0])), new Set(records.map(r => r.raw.code)));
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

test('search is paged over the whole ranking: no matching product is silently excluded (no five-shard ceiling)', async () => {
  const cat = createCatalogue(diskFetcher);
  for (const query of ['γάλα', 'cheese', 'ψωμί', 'chocolate', 'bio', 'τυρί']) {
    const tokens = skeleton(query).split(' ').filter(Boolean);
    const expected = records.filter(({ raw }) => (raw.countries_tags || []).includes('en:greece')).filter(({ raw }) => { const text = ' ' + skeleton(`${raw.product_name || ''} ${raw.brands || ''}`) + ' '; return tokens.every(t => text.includes(' ' + t + ' ') || t.length >= 4 && text.includes(' ' + t)); }).map(r => String(r.raw.code));
    const got = []; let page = 1, files = new Set(), last;
    do { last = await cat.search(query, { country: 'greece', page, limit: 30 }); assert.ok(last.products.length <= 30); assert.equal(last.page, page); assert.equal(last.total, expected.length, `${query}: total`); for (const p of last.products) { got.push(String(p.barcode).replace(/^0+(?=\d{8})/, '')); files.add(records.find(r => String(r.raw.code) === String(p.barcode))?.file); } page++; } while (last.hasMore && page < 60);
    assert.equal(last.unavailable, 0);
    assert.equal(got.length, expected.length, `${query}: ${got.length} returned, ${expected.length} match`);
    assert.deepEqual(new Set(got.map(c => c.padStart(14, '0'))), new Set(expected.map(c => c.padStart(14, '0'))), `${query}: sets differ`);
    assert.equal(new Set(got).size, got.length, `${query}: duplicates across pages`);
    if (expected.length > 150) assert.ok(files.size > 5, `${query}: only ${files.size} shards`);
  }
});

test('a failed shard is reported, not silently dropped', async () => {
  const flaky = url => String(url).includes('part-cheese-0') ? Promise.resolve(new Response('x', { status: 500 })) : diskFetcher(url);
  const r = await createCatalogue(flaky).search('feta', { country: 'greece', limit: 30 });
  assert.equal(r.partial, true); assert.ok(r.catalogue.failedFiles.length > 0); assert.ok(r.unavailable > 0, 'the records it could not load are counted'); assert.equal(r.catalogue.status, 'partial');
});

test('graceful expiry: after 90 days lookups and search still work (labelled), recommendations stop; after a year nothing is served', async () => {
  const real = Date.now, shift = days => { Date.now = () => real() + days * 864e5; };
  const dom = await domain();
  try {
    shift(120);
    const cat = createCatalogue(diskFetcher), p = await cat.product('5201673006909');
    assert.ok(p, 'lookup works at 120 days'); assert.ok((await cat.search('feta', { country: 'greece' })).products.length > 5); assert.equal((await cat.search('feta', { country: 'greece' })).catalogue.expired, true);
    await assert.rejects(cat.query({ family: 'bread' }, { country: 'greece' }), /catalogue_expired/);
    const a = dom.assessGrade(p); assert.match(a.caveats.join('|'), /more than 90 days old/);
    shift(400);
    await assert.rejects(createCatalogue(diskFetcher).product('5201673006909'), /catalogue_expired/);
  } finally { Date.now = real; }
  const fresh = dom.assessGrade(await createCatalogue(diskFetcher).product('5201673006909')); assert.doesNotMatch(fresh.caveats.join('|'), /more than 90 days old/);
});

test('the catalogue this release ships passes every refresh gate, is at least as large as the reference snapshot, and has a matching search index', () => {
  const r = verifyCatalogue(ACTIVE_CATALOGUE_DIR, { previous: CATALOGUE_DIR === ACTIVE_CATALOGUE_DIR ? '' : CATALOGUE_DIR, maxAgeDays: 400 });
  assert.equal(r.ok, true, JSON.stringify(r.checks.filter(c => !c.ok)));
  const active = JSON.parse(readFileSync(join(ACTIVE_CATALOGUE_DIR, 'index.json'), 'utf8')), search = JSON.parse(readFileSync(join(APP, 'assets', `search-index-${SUFFIX}.json`), 'utf8'));
  assert.equal(search.revision, active.revision); assert.equal(search.rows.length, active.productCount); assert.ok(active.productCount >= manifest.productCount);
  const shipped = new Set(JSON.parse(readFileSync(join(CATALOGUE_DIR, 'index.json'), 'utf8')) && records.map(r => String(r.raw.code).padStart(14, '0')));
  const codes = new Set(search.rows.map(x => String(x[0]).padStart(14, '0'))); for (const k of shipped) assert.ok(codes.has(k), `reference product ${k} is missing from the shipped catalogue`);
});
