/* 95: search-result pages never count as product pages; the scan-outcome table creates itself when prices_db.sql was not re-run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, makeEnv, compare, json, fakeD1, loadWorker } from './helpers.mjs';
const P = await import(pathToFileURL(path.join(ROOT, 'price-refresh/tools/webclaw-prefill.mjs')).href);

const CODES = ['5201024005483', '5201024005490', '5201024005476']; let n = 0;
async function webOffers(u) {
  const code = CODES[n], url = `https://data-webpre95-${++n}.test/prices-data`, today = new Date().toISOString();
  const shard = { schema: 1, built: today, products: { [P.key14(code)]: { t: today, o: [{ r: 'Kiosk Example', p: 1.8, u, n: "LAY'S 95gr", k: '95gr', c: today }] } } };
  const remote = [new RegExp('^' + url.replace(/\./g, '\\.') + '/web/(\\d{2})\\.json'), x => x.endsWith(`/web/${code.slice(-2)}.json`) ? json(shard) : new Response('', { status: 404 })];
  const live = [/api\.webclaw\.io|api\.anthropic|api\.firecrawl/, () => { throw new Error('no live search in this test'); }];
  const r = await compare(code, { market: 'GR', env: makeEnv({ FOODSCAN_PRICE_DATA_URL: url }), extra: [remote, live] });
  return r.body.offers.filter(x => String(x.id).startsWith('ws:'));
}
test('a shop search-result page (?q=… or /el/search) is not a product page, a product page with ?id= still is', async () => {
  assert.equal((await webOffers('https://www.kiosk-example.gr/products?q=5201024005483')).length, 0, '?q=');
  assert.equal((await webOffers('https://www.kiosk-example.gr/el/search/lays')).length, 0, '/el/search');
  assert.equal((await webOffers('https://www.kiosk-example.gr/product?id=3605')).length, 1, 'product page with an id');
});
test('scan outcomes work on a database where prices_db.sql was never re-run: the table is created on first use', async () => {
  const db = fakeD1(), TOKEN = 'z'.repeat(40), env = makeEnv({ FOODSCAN_PRICES_DB: db, FOODSCAN_PRICES_ADMIN_TOKEN: TOKEN }), worker = await loadWorker();
  const post = body => worker.fetch(new Request('https://food-scan.test/api/prices/outcome', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://food-scan.test' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then(r => r.json());
  assert.equal((await post({ barcode: '5201024005438', grade: 'none', price: 'none', photo: false })).recorded, true);
  const r = await (await worker.fetch(new Request('https://food-scan.test/api/prices/outcome?days=7', { headers: { Authorization: 'Bearer ' + TOKEN } }), env, { waitUntil() {} })).json();
  assert.equal(r.opens, 1); assert.equal(r.rows[0].no_grade, 1);
});
