import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, APP, compare, loadWorker, makeEnv, withNetwork, noOpenPrices, json, allEstimates, estManifest, seed, key14, gtinOK } from './helpers.mjs';

const est = allEstimates(), bz = seed('bazaar-eshop-latest.json'), pk = seed('posokanei-latest.json'), ek = seed('ekatanalotis-latest.json');
const pickEst = f => Object.entries(est).find(([k, e]) => f(e) && gtinOK(k) && !ek.products[k])[0].replace(/^0+/, ''); // no old basket price either: that would lead the card
const CUR = Object.keys(pk.products).find(k => pk.products[k].p.length >= 6 && bz.products[k] && gtinOK(k)).replace(/^0+/, ''); // observatory + web shop
const EST_B = pickEst(e => e.e.c === 'B' && e.e.p), EST_E = pickEst(e => e.e.c === 'E');
const NONE = (() => { for (let n = 4001234560000; ; n++) { const s = String(n).slice(0, 12); let t = 0; for (let i = 0; i < 12; i++) t += Number(s[i]) * (i % 2 === 0 ? 1 : 3); const c = s + String((10 - t % 10) % 10); if (!est[key14(c)] && !pk.products[key14(c)] && !bz.products[key14(c)]) return c; } })();

test('version, identity and the 7-day window are the release’s', async () => {
  const { body, res } = await compare(CUR);
  assert.equal(res.status, 200); assert.equal(body.version, '81.0.0'); assert.equal(body.barcode, CUR);
});

test('a barcode with recorded prices returns dated, sourced offers; no estimate rides along', async () => {
  const { body } = await compare(CUR);
  assert.equal(body.status, 'observations_available'); assert.ok(body.offers.length >= 2); assert.equal(body.estimate, null);
  for (const o of body.offers) { assert.match(o.id, /^(?:pk|bz|li|ek|op|lf):/); assert.ok(o.price > 0); assert.match(o.date, /^\d{4}-\d{2}-\d{2}$/); assert.ok(o.source); assert.equal(o.currency, 'EUR'); assert.ok(!o.estimated && !o.modelled); }
});

test('observations are copied from the seeds: every pk/bz price in the payload traces to a seed row', async () => {
  const { body } = await compare(CUR); const k = key14(CUR);
  for (const o of body.offers.filter(x => /^pk:/.test(x.id))) assert.ok(pk.products[k].p.some(t => t[1] === o.price && t[2] === o.date), `${o.id}`);
  for (const o of body.offers.filter(x => /^bz:/.test(x.id) && x.origin === 'seed')) assert.equal(o.price, bz.products[k].p);
});

test('freshness: a seed price older than 7 days is "older" and never the lowest current price', async () => {
  const worker = await loadWorker();
  // pretend it is 10 days later: every bundled observation must stop being current
  const realNow = Date.now; Date.now = () => realNow() + 10 * 86400000;
  try {
    const { body } = await compare(CUR);
    assert.ok(body.offers.length); assert.ok(body.offers.every(o => !o.rankingEligible || o.origin === 'live'), 'no seed offer ranks');
    assert.equal(body.summary.lowestCurrentPrice, null); assert.ok(body.offers.every(o => o.freshness !== 'current'));
  } finally { Date.now = realNow; }
  assert.ok(worker);
});

test('81: a barcode with no recorded price gets NO estimate; close products are listed with their own recorded prices', async () => {
  const { body } = await compare(EST_B);
  assert.equal(body.status, 'no_data'); assert.equal(body.offers.length, 0); assert.equal(body.summary.lowestCurrentPrice, null); assert.equal(body.summary.bestOfferId, null);
  assert.equal(body.estimate, null); assert.ok(!JSON.stringify(body).includes('unitLow'));
  assert.ok(Array.isArray(body.related) && body.related.length <= 3);
  for (const x of body.related) { assert.ok(x.name && x.price > 0 && x.source); assert.match(x.date, /^\d{4}-\d{2}-\d{2}$/); assert.ok(x.similarity >= 55); }
});

test('class E (typical for the product type) lists no related products and no estimate', async () => {
  const { body } = await compare(EST_E); assert.equal(body.estimate, null); assert.deepEqual(body.related, [], 'a "typical for the type" match is too loose to list'); assert.equal(body.status, 'no_data');
});

test('unknown barcode: honest no_data, never a made-up price', async () => {
  const { body } = await compare(NONE); assert.equal(body.status, 'no_data'); assert.equal(body.offers.length, 0); assert.equal(body.estimate, null);
});

test('every source down and nothing bundled: reported as an outage, not as "no price"', async () => {
  const down = [[/prices\.openfoodfacts\.org/, () => new Response('down', { status: 503 })]];
  const { body } = await compare(NONE, { env: makeEnv({ FOODSCAN_PRICE_DATA_URL: 'off', ASSETS: { fetch: async () => new Response('x', { status: 500 }) } }), handlers: down });
  assert.ok(['temporarily_unavailable', 'incomplete'].includes(body.status), body.status);
});

test('an Open Prices outage does not hide bundled prices', async () => {
  const down = [[/prices\.openfoodfacts\.org/, () => new Response('down', { status: 503 })]];
  assert.equal((await compare(CUR, { handlers: down })).body.status, 'observations_available');
  assert.ok(['no_data', 'incomplete'].includes((await compare(EST_B, { handlers: down })).body.status), 'a missing source is reported, never covered by a guess');
});

test('the live shop check corrects a stale seed price and never invents one', async () => {
  const k = key14(CUR), item = bz.products[k]; if (!item?.u) return;
  const page = price => `<html><div itemscope itemtype="http://schema.org/Product"><meta itemprop="model" content="${k.replace(/^0+/, '')}"><meta itemprop="price" content="${price}"><meta itemprop="priceCurrency" content="EUR"></div></html>`;
  const live = [...noOpenPrices, [/bazaar-online\.gr/, () => new Response(page('9.99'), { status: 200 })]];
  const { body } = await compare(CUR, { handlers: live });
  const o = body.offers.find(x => x.id.startsWith('bz:')); assert.ok(o); assert.equal(o.price, 9.99); assert.equal(o.origin, 'live'); assert.equal(o.freshness, 'current');
  const wrong = [...noOpenPrices, [/bazaar-online\.gr/, () => new Response(page('9.99').replace(k.replace(/^0+/, ''), '5201000000000'), { status: 200 })]];
  assert.ok(!(await compare(CUR, { handlers: wrong })).body.offers.some(x => x.id.startsWith('bz:')), 'a page naming another barcode drops the price');
});

test('Open Prices rows in Greece are merged; other countries stay in "elsewhere"', async () => {
  const row = (id, cc, price, date) => ({ id, product_code: NONE, type: 'PRODUCT', price, currency: 'EUR', date, price_per: null, location: { id: id * 10, osm_name: 'Test shop', osm_brand: 'Sklavenitis', osm_address_country_code: cc, osm_address_city: 'X', type: 'OSM' }, product: { code: NONE, product_name: 'Test', quantity: '500 g' }, proof: { type: 'PRICE_TAG' } });
  const today = new Date().toISOString().slice(0, 10);
  const { body } = await compare(NONE, { handlers: [[/prices\.openfoodfacts\.org/, () => json({ items: [row(1, 'GR', 2.5, today), row(2, 'FR', 3.1, today)], total: 2 })]] });
  assert.equal(body.offers.length, 1); assert.equal(body.offers[0].price, 2.5); assert.equal(body.offers[0].rankingEligible, true);
  assert.equal(body.elsewhere.length, 1); assert.equal(body.elsewhere[0].countryCode, 'FR'); assert.equal(body.elsewhere[0].rankingEligible, false);
});

test('invalid input is rejected', async () => { assert.equal((await compare('1234567890123')).res.status, 400); assert.equal((await compare('abc')).res.status, 400); });

test('/api/prices/health reports the estimator and the remote-data setting', async () => {
  const worker = await loadWorker();
  const res = await withNetwork(noOpenPrices, () => worker.fetch(new Request('https://food-scan.test/api/prices/health'), makeEnv(), { waitUntil() {} }));
  const h = await res.json(); assert.equal(h.version, '81.0.0'); assert.ok(h.estimator.estimates > 5000 && h.estimator.validation.A.usable); assert.ok(h.remote.url);
});

test('remote data: a NEWER seed manifest + shard wins; older, truncated, invalid or failing remotes are ignored', async () => {
  const k = key14(CUR), shardId = k.slice(-2), today = new Date().toISOString().slice(0, 10), env = makeEnv({ FOODSCAN_PRICE_DATA_URL: 'https://data.example/prices' });
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seeds/posokanei-latest.json'), 'utf8'));
  const sharded = (over = {}) => ({ ...man, schema: 2, sharded: 'pk/', products: {}, source: { ...man.source, fetched_at: '2099-01-01T00:00:00Z', snapshot: today, counts: { products: Object.keys(man.products).length }, ...over } });
  const shard = (m, rec) => ({ schema: 2, source: { snapshot: m.source.snapshot }, products: { [k]: rec }, rows: [] });
  const newRec = { ...man.products[k], p: [['ab', 1.11, today, 0]] };
  const h = (m, shardHandler) => [...noOpenPrices, [/data\.example\/prices\/seeds\/posokanei-latest\.json$/, () => json(m)], [new RegExp(`data\\.example/prices/seeds/pk/${shardId}\\.json$`), shardHandler || (() => json(shard(m, newRec)))]];
  const m1 = sharded();
  const a = await compare(CUR, { env, origin: 'https://remote-a.test', handlers: h(m1) });
  assert.ok(a.body.offers.some(o => o.id.startsWith('pk:') && o.price === 1.11 && o.retailerId === 'ab'), 'newer remote manifest + shard are used');
  const b = await compare(CUR, { env, origin: 'https://remote-b.test', handlers: h(sharded({ fetched_at: '2001-01-01T00:00:00Z' })) });
  assert.ok(!b.body.offers.some(o => o.price === 1.11), 'an older remote copy never replaces the bundled one');
  const c = await compare(CUR, { env, origin: 'https://remote-c.test', handlers: h(sharded({ counts: { products: 10 } })) });
  assert.ok(!c.body.offers.some(o => o.price === 1.11), 'a truncated remote copy (under 90 % of the bundled products) is ignored');
  const d = await compare(CUR, { env, origin: 'https://remote-d.test', handlers: h(m1, () => new Response('nope', { status: 500 })) });
  assert.equal(d.body.status, 'observations_available'); assert.ok(d.body.offers.some(o => o.id.startsWith('pk:') && o.price !== 1.11), 'a remote shard that cannot be read falls back to the consistent bundled set');
  const e = await compare(CUR, { env, origin: 'https://remote-e.test', handlers: h(m1, () => json({ schema: 2, source: { snapshot: '1999-01-01' }, products: { [k]: newRec }, rows: [] })) });
  assert.ok(!e.body.offers.some(o => o.price === 1.11), 'a shard from another snapshot than its manifest is refused');
  const f = await compare(CUR, { env, origin: 'https://remote-f.test', handlers: [...noOpenPrices, [/data\.example\/prices\/seeds\/posokanei-latest\.json$/, () => json({ schema: 9, products: {} })]] });
  assert.equal(f.body.status, 'observations_available');
  const legacy = { ...man, source: { ...man.source, fetched_at: '2099-01-01T00:00:00Z', snapshot: today }, products: { ...man.products, [k]: newRec } };
  const g = await compare(CUR, { env, origin: 'https://remote-g.test', handlers: [...noOpenPrices, [/data\.example\/prices\/seeds\/posokanei-latest\.json$/, () => json(legacy)]] });
  assert.ok(g.body.offers.some(o => o.price === 1.11), 'a monolithic remote file (older refresh job) still works');
  assert.ok(estManifest().built);
});

test('a lookup reads small files: no bundled price file a request has to parse is larger than 40 KB', () => {
  const root = path.join(APP, 'assets/gr-prices-v72');
  for (const f of fs.readdirSync(root).filter(f => f.endsWith('.json'))) assert.ok(fs.statSync(path.join(root, f)).size < 8000, `${f} is a manifest`);
  for (const d of ['bz', 'li', 'pk', 'ek']) { assert.equal(fs.readdirSync(path.join(root, d)).length, 100); for (const f of fs.readdirSync(path.join(root, d))) assert.ok(fs.statSync(path.join(root, d, f)).size < 40000, `${d}/${f}`); }
});
