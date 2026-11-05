/* 87: the Open Prices daily snapshot (price-refresh/tools/build-open-prices.mjs) and the worker's snapshot + live-delta read.
 * The dumps are built from items in the real API shape; the worker reads the shard from a fake prices-data branch and the delta from a fake API
 * that implements product_code__in and created__gte (both checked against the live API on 5 Nov 2026). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { ROOT, op, compare, makeEnv, json, daysAgo } from './helpers.mjs';
const B = await import(pathToFileURL(path.join(ROOT, 'price-refresh/tools/build-open-prices.mjs')).href);

/** Real-API items -> the four dump files (the official dumps carry ids, the API nests the objects). */
function dumps(items, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opdump-')), gz = (name, rows) => fs.writeFileSync(path.join(dir, name + '.jsonl.gz'), zlib.gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n'));
  const prices = [], proofs = new Map(), locations = new Map(), products = new Map();
  for (const i of items) {
    const proofId = i.proof ? i.id + 500000 : null;
    if (i.proof) proofs.set(proofId, { id: proofId, type: i.proof.type, file_path: i.proof.file_path, draft: Boolean(i.proof.draft) });
    locations.set(i.location.id, { id: i.location.id, type: i.location.type, osm_brand: i.location.osm_brand, osm_name: i.location.osm_name, osm_address_country_code: i.location.osm_address_country_code, osm_address_city: i.location.osm_address_city, osm_lat: String(i.location.osm_lat), osm_lon: String(i.location.osm_lon) });
    products.set(i.product_code, { code: i.product_code, product_name: i.product?.product_name, quantity: i.product?.quantity });
    prices.push({ id: i.id, type: i.type, product_code: i.product_code, price: String(i.price), currency: i.currency, date: i.date, price_per: i.price_per === 'UNIT' ? null : i.price_per, price_is_discounted: i.price_is_discounted, price_without_discount: i.price_without_discount, discount_type: i.discount_type, duplicate_of: i.duplicate_of ?? null, location_id: i.location.id, proof_id: proofId, created: i.created, ...(extra[i.id] || {}) });
  }
  gz('prices', prices); gz('proofs', [...proofs.values()]); gz('locations', [...locations.values()]); gz('products', [...products.values()]);
  return dir;
}
let base = 0;
/** A fake prices-data branch serving the shards of `snap`, at its own URL (the worker caches shards per base URL). */
function branch(snap) {
  const url = `https://data${++base}.test/prices-data`, calls = [];
  return { env: makeEnv({ FOODSCAN_PRICE_DATA_URL: url }), calls, handlers: [[new RegExp('^' + url.replace(/\./g, '\\.') + '/op/'), u => { calls.push(u); const id = Number(u.match(/op\/(\d{3})\.json/)[1]); const s = snap.shards[id]; return json({ schema: 1, cutoff: snap.cutoff, built: snap.manifest.built, ...s }); }], [new RegExp('^' + url.replace(/\./g, '\\.')), () => json({}, 404)]] };
}

test('the snapshot keeps every usable observation and nothing else: duplicates, drafts, old prices and prices without a store are left out', async () => {
  const code = '3017620422003';
  const good = op({ code, price: 4.45, date: daysAgo(3) }), old = op({ code, price: 3.9, date: daysAgo(200) }), dup = op({ code, price: 9.99, date: daysAgo(2) }), draft = op({ code, price: 1.11, date: daysAgo(2) });
  draft.proof.draft = true;
  const dir = dumps([good, old, dup, draft], { [dup.id]: { duplicate_of: good.id } });
  const snap = await B.build(dir, { now: Date.now() });
  const entry = snap.shards[Number(B.shardOf(code.padStart(14, '0')))].products[code.padStart(14, '0')];
  assert.deepEqual(entry.o.map(o => o[0]), [good.id]);
  assert.equal(snap.manifest.skipped.duplicate, 1); assert.equal(snap.manifest.skipped['draft proof'], 1); assert.equal(snap.manifest.skipped['outside the window'], 1);
  assert.equal(snap.cutoff, [good, old, dup, draft].map(i => i.created).sort().at(-1), 'the cutoff is the newest created time in the dump');
  assert.equal(entry.m[0], 'Test product');
});

test('a scan reads its shard and makes ONE live request, for every barcode variant, for prices created after the cutoff', async () => {
  const code = '3017620422003', inDump = op({ code, price: 4.45, date: daysAgo(2), cc: 'FR' }), newer = op({ code, price: 4.19, date: daysAgo(0), cc: 'FR' });
  const snap = await B.build(dumps([inDump]), { now: Date.now() }); newer.created = new Date(Date.parse(snap.cutoff) + 3600e3).toISOString();
  const b = branch(snap);
  const { body, calls } = await compare(code, { items: [inDump, newer], market: 'FR', env: b.env, extra: b.handlers });
  assert.equal(calls.length, 1, `one live request, got ${calls.length}: ${calls.join(' | ')}`);
  const q = new URLSearchParams(calls[0]); assert.ok(q.get('product_code__in').split(',').includes(code)); assert.equal(q.get('created__gte'), snap.cutoff);
  const ids = body.offers.map(o => o.id); assert.ok(ids.includes('op:' + inDump.id) && ids.includes('op:' + newer.id), JSON.stringify(ids));
  assert.equal(body.providers.openPrices.via, 'snapshot+live'); assert.equal(body.providers.openPrices.snapshotCutoff, snap.cutoff);
  assert.equal(body.summary.lowestCurrentPrice, 4.19, 'the newest, lower price is the lowest current price');
});

test('the API down: the snapshot still answers with its dated prices', async () => {
  const code = '5449000000996', p = op({ code, price: 0.89, date: daysAgo(1), cc: 'DE', brand: 'Lidl' });
  const snap = await B.build(dumps([p]), { now: Date.now() }), b = branch(snap);
  const { body } = await compare(code, { items: [p], market: 'DE', env: b.env, extra: b.handlers, opts: { status: 503 } });
  assert.equal(body.providers.openPrices.via, 'snapshot'); assert.ok(body.offers.some(o => o.id === 'op:' + p.id));
});

test('the same observation gives the same offer from the snapshot and from the live API', async () => {
  const code = '7622210449283', p = op({ code, price: 2.35, date: daysAgo(1), cc: 'FR', discounted: true, was: 2.79, discountType: 'QUANTITY' });
  const snap = await B.build(dumps([p]), { now: Date.now() }), b = branch(snap);
  const viaSnap = await compare(code, { items: [], market: 'FR', env: b.env, extra: b.handlers });
  const viaLive = await compare(code, { items: [p], market: 'FR' });
  const pick = r => { const o = r.body.offers.find(x => x.id === 'op:' + p.id); const { fetchedAt, origin, ...rest } = o; return rest; };
  assert.deepEqual(pick(viaSnap), pick(viaLive));
});

test('no snapshot, or one older than 8 days: the full live read, as before', async () => {
  const code = '8000500310427', p = op({ code, price: 3.1, date: daysAgo(1), cc: 'IT' });
  const none = await compare(code, { items: [p], market: 'IT' });
  assert.ok(none.calls.length >= 2 && none.calls.every(c => /product_code=/.test(c)), 'full live read'); assert.ok(!none.body.providers.openPrices.via);
  const stale = await B.build(dumps([p]), { now: Date.now() }); stale.cutoff = new Date(Date.now() - 10 * 864e5).toISOString();
  const b = branch(stale), r = await compare(code, { items: [p], market: 'IT', env: b.env, extra: b.handlers });
  assert.ok(!r.body.providers.openPrices.via && r.calls.some(c => /product_code=/.test(c)));
});

test('Greece: the observatory, Bazaar and Lidl stay the backbone; Open Prices adds proven shelf prices and is held to the same guards', async () => {
  const code = '5201004023360', p = op({ code, price: 0.2, date: daysAgo(1), cc: 'GR', brand: 'ΑΒ Βασιλόπουλος', city: 'Αθήνα' });
  const snap = await B.build(dumps([p]), { now: Date.now() }), b = branch(snap);
  const { body } = await compare(code, { items: [], market: 'GR', env: b.env, extra: b.handlers });
  const o = body.offers.find(x => x.id === 'op:' + p.id);
  assert.ok(o, 'the Greek Open Prices observation is read from the snapshot');
  assert.ok(body.offers.some(x => !x.id.startsWith('op:')), 'the Greek official/shop sources are still there');
  const chains = body.offers.filter(x => !x.id.startsWith('op:') && x.rankingEligible);
  if (chains.length >= 3) {
    const typo = op({ code, price: 0.02, date: daysAgo(1), cc: 'GR', brand: 'Μασούτης', city: 'Θεσσαλονίκη' }), snap2 = await B.build(dumps([typo]), { now: Date.now() }), b2 = branch(snap2);
    const r = await compare(code, { items: [], market: 'GR', env: b2.env, extra: b2.handlers }), t = r.body.offers.find(x => x.id === 'op:' + typo.id);
    assert.ok(t && t.suspect && !t.rankingEligible, 'a crowd price far below the chains is flagged and never ranks');
    assert.notEqual(r.body.summary.lowestCurrentPrice, 0.02);
  }

});
