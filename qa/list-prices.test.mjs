/* 90: prices in lists (GET /api/prices/peek and prices/list-prices-v90.js): daily data only, no live request, and never a price the product page would not rank. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { ROOT, op, compare, peek, makeEnv, daysAgo } from './helpers.mjs';
const B = await import(pathToFileURL(path.join(ROOT, 'price-refresh/tools/build-open-prices.mjs')).href);
const LP = await import(pathToFileURL(path.join(ROOT, 'prices/list-prices-v90.js')).href);

function dumps(items) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opdump-')), gz = (n, rows) => fs.writeFileSync(path.join(dir, n + '.jsonl.gz'), zlib.gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n'));
  gz('prices', items.map(i => ({ id: i.id, type: i.type, product_code: i.product_code, price: String(i.price), currency: i.currency, date: i.date, price_per: null, price_is_discounted: false, price_without_discount: null, discount_type: null, proof_id: i.id + 500000, location_id: i.location.id, duplicate_of: null, created: i.created })));
  gz('proofs', items.map(i => ({ id: i.id + 500000, type: i.proof.type, file_path: i.proof.file_path, draft: false })));
  gz('locations', [...new Map(items.map(i => [i.location.id, { id: i.location.id, type: i.location.type, osm_brand: i.location.osm_brand, osm_name: i.location.osm_name, osm_address_country_code: i.location.osm_address_country_code, osm_address_city: i.location.osm_address_city, osm_lat: i.location.osm_lat, osm_lon: i.location.osm_lon }])).values()]);
  gz('products', items.map(i => ({ code: i.product_code, product_name: 'Test product', quantity: '400 g' })));
  return dir;
}
let n = 0;
async function branchEnv(items) {
  const snap = await B.build(dumps(items), { now: Date.now() }), url = `https://peek${++n}.test/prices-data`;
  return { env: makeEnv({ FOODSCAN_PRICE_DATA_URL: url }), handlers: [[new RegExp('^' + url.replace(/\./g, '\\.') + '/op/'), u => { const id = Number(u.match(/op\/(\d{3})\.json/)[1]); const s = snap.shards[id]; return new Response(JSON.stringify({ schema: 1, cutoff: snap.cutoff, built: snap.manifest.built, ...s }), { headers: { 'content-type': 'application/json' } }); }]] };
}

test('peek gives each barcode the same lowest current price as the product page, without any live request', async () => {
  const a = '3017620422003', b = '5000159407236';
  const items = [op({ code: a, price: 4.45, date: daysAgo(2), cc: 'FR' }), op({ code: a, price: 4.19, date: daysAgo(1), cc: 'FR' }), op({ code: b, price: 1.2, date: daysAgo(3), cc: 'FR' })];
  const br = await branchEnv(items);
  const p = await peek([a, b], { items, market: 'FR', env: br.env, extra: br.handlers });
  assert.equal(p.res.status, 200);
  assert.equal(p.calls.length, 0, 'no live Open Prices request from a list');
  const byCode = Object.fromEntries(p.body.items.map(i => [i.code, i]));
  for (const code of [a, b]) {
    const c = await compare(code, { items, market: 'FR', env: br.env, extra: br.handlers });
    assert.equal(byCode[code].best?.price ?? null, c.body.summary.lowestCurrentPrice, code + ': same lowest current price as the product page');
  }
  assert.equal(byCode[a].best.price, 4.19);
});

test('a suspect crowd price never shows in a list either', async () => {
  const code = '3017620422003', items = [1, 2, 3].map(d => op({ code, price: 4 + d / 100, date: daysAgo(d), cc: 'FR' })).concat(op({ code, price: 0.04, date: daysAgo(0), cc: 'FR' }));
  const br = await branchEnv(items);
  const p = await peek([code], { items, market: 'FR', env: br.env, extra: br.handlers });
  assert.ok(p.body.items[0].best.price >= 4, `got ${p.body.items[0].best.price}`);
});

test('peek refuses more than five barcodes (the free-plan subrequest budget) and invalid ones', async () => {
  const six = ['3017620422003', '5000159407236', '5201004023360', '5204140002008', '5201005001824', '5201004040022'];
  assert.equal((await peek(six)).res.status, 400);
  assert.equal((await peek(['12345'])).res.status, 400);
});

test('the row line and the swap comparison: an older price is marked, and unit prices are compared only on the same basis', () => {
  assert.deepEqual(LP.lineOf({ best: null, latest: { price: 2.5, currency: 'EUR', retailer: 'AB', date: '2026-10-01', unitPrice: 5, unitBasis: 'kg' } }), { price: 2.5, currency: 'EUR', retailer: 'AB', older: true, date: '2026-10-01', unitPrice: 5, unitBasis: 'kg' });
  assert.equal(LP.lineOf({ best: null, latest: null }), null);
  const s = { older: false, unitPrice: 8, unitBasis: 'kg' }, h = { older: false, unitPrice: 12.4, unitBasis: 'kg' };
  assert.deepEqual(LP.compareUnit(s, h), { diff: -4.4, basis: 'kg', cheaper: true, same: false });
  assert.equal(LP.compareUnit({ ...s, unitBasis: 'l' }, h), null, 'kg against l: no comparison');
  assert.equal(LP.compareUnit({ ...s, older: true }, h), null, 'an older price is not compared');
  assert.equal(LP.compareUnit({ ...s, unitPrice: null }, h), null);
});
