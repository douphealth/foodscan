import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { APP, catalogue, importFile } from './helpers.mjs';

// The Worker, run in Node with an ASSETS binding over the built tree and the upstream food API unreachable.
let worker; const { byCode } = catalogue();
const assets = { fetch: async req => { let p = join(APP, decodeURIComponent(new URL(req.url).pathname)); if (p.endsWith('\\') || !/\.[a-z0-9]+$/i.test(p)) p = join(p, 'index.html'); return existsSync(p) ? new Response(readFileSync(p), { headers: { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.json') ? 'application/json' : 'text/plain' } }) : new Response('nf', { status: 404 }); } };
const call = (path, { host = 'food-scan.gearuptofit.com', headers = {}, env = {} } = {}) => worker.fetch(new Request(`https://${host}${path}`, { headers: { Accept: 'text/html,application/json', ...headers } }), { ASSETS: assets, ...env }, { waitUntil() {}, passThroughOnException() {} });
before(async () => {
  globalThis.fetch = (input) => Promise.reject(new TypeError('upstream offline: ' + (typeof input === 'string' ? input : input.url)));
  worker = (await importFile(join(APP, '_worker.js'))).default;
});

test('health reports this release and the shipped catalogue', async () => {
  const r = await call('/api/health'), j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.version, '62.0.0'); assert.equal(j.catalogue.status, 'ready'); assert.equal(j.catalogue.products, 12113);
});

test('a barcode from the catalogue is answered with the upstream down, dated and labelled', async () => {
  const r = await call('/api/product/5201673006909'), j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.product.code, '5201673006909'); assert.equal(j.catalogueSnapshot.provider, 'openfoodfacts-daily-export'); assert.equal(r.headers.get('X-FoodScan-Cache'), 'DATED-CATALOGUE');
});

test('unknown and invalid barcodes fail cleanly, not with a retry loop', async () => {
  assert.equal((await call('/api/product/abc')).status >= 400, true);
  const missing = await call('/api/product/0000000000017'); assert.ok([404, 502, 503].includes(missing.status)); assert.equal((await missing.json()).error.code.length > 3, true);
  assert.equal((await call('/api/product/12345678')).status, 400);
});

test('a shared link opens a real page from the catalogue when the food API is down, and is never indexed', async () => {
  const r = await call('/p/5201673006909'), html = await r.text();
  assert.equal(r.status, 200);
  assert.match(html, /<title>[^<]*Nutri-Score C[^<]*<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.match(r.headers.get('x-robots-tag') || '', /noindex/);
  assert.match(html, /<link rel="canonical" href="https:\/\/food-scan\.gearuptofit\.com\/p\/5201673006909">/);
});

test('product pages on preview hosts and for withheld records are noindex', async () => {
  const preview = await call('/p/5201673006909', { host: 'abc123.food-scan.pages.dev' }); assert.match(await preview.text(), /noindex/);
  const bad = [...byCode.values()].find(r => r.raw.nutriments['energy-kcal_100g'] === 48500);
  if (bad) { const r = await call(`/p/${bad.raw.code}`); assert.match(await r.text(), /noindex/); }
});

test('alternatives for a category come from the bundled catalogue and respect the market', async () => {
  const r = await call('/api/alternatives?category=en:breads&country=greece'), j = await r.json();
  assert.equal(r.status, 200); assert.ok(j.products.length > 10); assert.equal(j.provider, 'off-catalogue');
  assert.ok(j.products.every(p => p.countries_tags.includes('en:greece')));
  const fr = await (await call('/api/alternatives?category=en:breads&country=france')).json().catch(() => ({ products: [] }));
  assert.ok((fr.products || []).every(p => p.countries_tags.includes('en:france')), 'only records the source lists for France');
});

test('sitemap index, robots and the security headers on documents', async () => {
  const robots = await (await call('/robots.txt')).text(); assert.match(robots, /Disallow: \/api\//); assert.match(robots, /Sitemap: https:\/\/food-scan\.gearuptofit\.com\/sitemap\.xml/);
  const pre = await (await call('/robots.txt', { host: 'x.pages.dev' })).text(); assert.match(pre, /Disallow: \//);
  const sm = await call('/sitemap.xml'); assert.equal(sm.status, 200); assert.match(await sm.text(), /<sitemapindex|<urlset/);
});

test('invalid paths and methods are refused', async () => {
  assert.equal((await call('/api/alternatives?category=../../etc&country=greece')).status, 400);
  const post = await worker.fetch(new Request('https://food-scan.gearuptofit.com/p/5201673006909', { method: 'POST' }), { ASSETS: assets }, { waitUntil() {} });
  assert.ok([404, 405].includes(post.status));
});
