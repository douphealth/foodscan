/* 94: web prices need a date and a product page; scan outcomes are daily counts with no identifier, readable only with the admin token. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, makeEnv, compare, json, fakeD1, read, loadWorker } from './helpers.mjs';
const P = await import(pathToFileURL(path.join(ROOT, 'price-refresh/tools/webclaw-prefill.mjs')).href);

// one barcode per case, each in another shard: the worker keeps a shard it has read for the rest of the process
const CODES = ['5201024005407', '5201024005414', '5201024005421', '5201024005445', '5201024005452', '5201024005469']; let n = 0;
const offer = (o = {}) => ({ r: 'Kiosk Example', p: 1.8, u: 'https://www.kiosk-example.gr/p/3605', n: "LAY'S CHORIZO & ONION 95gr", k: '95gr', c: new Date().toISOString(), ...o });
async function webOffers(o, t = new Date().toISOString()) {
  const code = CODES[n], url = `https://data-webpre94-${++n}.test/prices-data`;
  const today = new Date().toISOString(), shard = { schema: 1, built: today, products: { [P.key14(code)]: { t, o: [offer(o)] } } };
  const remote = [new RegExp('^' + url.replace(/\./g, '\\.') + '/web/(\\d{2})\\.json'), u => u.endsWith(`/web/${code.slice(-2)}.json`) ? json(shard) : new Response('', { status: 404 })];
  const live = [/api\.webclaw\.io|api\.anthropic|api\.firecrawl/, () => { throw new Error('no live search in this test'); }];
  const r = await compare(code, { market: 'GR', env: makeEnv({ FOODSCAN_PRICE_DATA_URL: url }), extra: [remote, live] });
  return r.body.offers.filter(x => String(x.id).startsWith('ws:'));
}

test('a web-shop price with a valid date on a product page is kept and can be the cheapest', async () => {
  const ws = await webOffers(); assert.equal(ws.length, 1); assert.equal(ws[0].tier, 'current');
});
test('a web-shop price with no date, a future date or only a shop home page is dropped (it used to be dated today)', async () => {
  assert.equal((await webOffers({ c: '' }, '')).length, 0, 'no date');
  assert.equal((await webOffers({ c: new Date(Date.now() + 3 * 864e5).toISOString() })).length, 0, 'three days ahead');
  assert.equal((await webOffers({ u: 'https://www.kiosk-example.gr/' })).length, 0, 'home page');
  assert.equal((await webOffers({ u: 'https://www.kiosk-example.gr/search' })).length, 0, 'search page');
  assert.equal((await webOffers({ u: 'http://www.kiosk-example.gr/p/3605' })).length, 0, 'not https');
});

const TOKEN = 'x'.repeat(40);
async function outcome(env, body, headers = {}) {
  const worker = await loadWorker();
  const req = new Request('https://food-scan.test/api/prices/outcome', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://food-scan.test', 'CF-Connecting-IP': '203.0.113.9', ...headers }, body: JSON.stringify(body) });
  const res = await worker.fetch(req, env, { waitUntil() {} }); return { status: res.status, body: await res.json() };
}
async function report(env, auth) {
  const worker = await loadWorker();
  const res = await worker.fetch(new Request('https://food-scan.test/api/prices/outcome?days=7', { headers: auth ? { Authorization: 'Bearer ' + auth } : {} }), env, { waitUntil() {} });
  return { status: res.status, body: await res.json() };
}
test('scan outcomes: daily counts per barcode, no identifier stored, readable only with the admin token', async () => {
  const db = fakeD1(); db.exec(read('d1-schema/prices_db.sql'));
  const env = makeEnv({ FOODSCAN_PRICES_DB: db, FOODSCAN_PRICES_ADMIN_TOKEN: TOKEN });
  const a = await outcome(env, { barcode: '5201024005438', grade: 'none', price: 'none', photo: false });
  assert.equal(a.status, 202); assert.equal(a.body.recorded, true);
  await outcome(env, { barcode: '5201024005438', grade: 'none', price: 'none', photo: false });
  await outcome(env, { barcode: '3017620422003', grade: 'source', price: 'current', photo: true });
  const cols = db.raw.prepare('PRAGMA table_info(foodscan_scan_daily)').all().map(c => c.name);
  assert.deepEqual(cols, ['day', 'barcode', 'grade', 'price', 'photo', 'n'], 'no address, device or time-of-day column');
  assert.equal((await report(env)).status, 401, 'no token');
  assert.equal((await report(env, 'y'.repeat(40))).status, 401, 'wrong token');
  const r = await report(env, TOKEN); assert.equal(r.status, 200); assert.equal(r.body.opens, 3);
  const top = r.body.rows[0]; assert.equal(top.barcode, '05201024005438'); assert.equal(top.opens, 2); assert.equal(top.no_grade, 2); assert.equal(top.no_price, 2); assert.equal(top.no_photo, 2);
});
test('scan outcomes: Do Not Track, Global Privacy Control, other sites and bad values are never counted', async () => {
  const db = fakeD1(); db.exec(read('d1-schema/prices_db.sql'));
  const env = makeEnv({ FOODSCAN_PRICES_DB: db });
  const ok = { barcode: '5201024005438', grade: 'none', price: 'none', photo: false };
  assert.equal((await outcome(env, ok, { DNT: '1' })).body.recorded, false);
  assert.equal((await outcome(env, ok, { 'Sec-GPC': '1' })).body.recorded, false);
  const other = await outcome(env, ok, { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' }); assert.ok(other.status === 403 || other.body.recorded === false, 'another site');
  assert.equal((await outcome(env, { ...ok, grade: 'excellent' })).status, 400);
  assert.equal((await outcome(env, { ...ok, barcode: '123' })).status, 400);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM foodscan_scan_daily').get().n, 0);
  const noDb = await outcome(makeEnv({}), ok); assert.equal(noDb.status, 202); assert.equal(noDb.body.recorded, false, 'without the database nothing breaks');
});
test('the grade card writes no style="" into HTML (the site CSP style-src \'self\' drops it); the reader applies the values through the CSSOM', () => {
  assert.doesNotMatch(read('prices/grade-ui-v85.mjs'), / style="/);
  assert.match(read('prices/reader-v85.js'), /n\.style\.cssText = n\.dataset\.fsStyle/);
  assert.match(read('src/worker/routes.js'), /style-src 'self';/, 'the policy this guards against');
});
