import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT, compare, op, daysAgo } from './helpers.mjs';
import * as require_fs from 'node:fs';

const core = await import(pathToFileURL(path.join(ROOT, 'prices/price-core-v83.mjs')).href);
const market = await import(pathToFileURL(path.join(ROOT, 'prices/market-v83.mjs')).href);
const CODE = '3017620422003';

test('the client re-checks a worldwide answer and keeps each price in its own currency', async () => {
  const items = [op({ code: CODE, price: 4.49, currency: 'USD', cc: 'US', brand: 'Kroger' }), op({ code: CODE, price: 4.99, currency: 'USD', cc: 'US', brand: 'Walmart', date: daysAgo(3) }),
    op({ code: CODE, price: 3.9, currency: 'EUR', cc: 'DE', brand: 'Edeka' })];
  const { body } = await compare(CODE, { items, market: 'US' });
  const r = core.checkPayload(body);
  assert.equal(r.home, 'US'); assert.equal(r.currency, 'USD');
  assert.equal(r.best.price, 4.49); assert.equal(r.best.currency, 'USD'); assert.equal(r.offers.length, 2);
  assert.equal(r.elsewhere.length, 1); assert.equal(r.elsewhere[0].currency, 'EUR'); assert.equal(r.elsewhere[0].rankingEligible, false);
  assert.equal(core.euro(r.best.price, 'en'), '$4.49'); // the market's currency
  assert.equal(core.money(r.elsewhere[0].price, 'en', 'EUR', 'US'), '€3.90');
});

test('a tampered or cached answer cannot make a foreign or wrong-currency price rank', async () => {
  const { body } = await compare(CODE, { items: [op({ code: CODE, price: 2, cc: 'FR', brand: 'Carrefour' })], market: 'FR' });
  body.offers[0].countryCode = 'DE'; // pretend it is German while the answer is for France
  assert.equal(core.checkPayload(body).offers.length, 0);
  const { body: b2 } = await compare(CODE, { items: [op({ code: CODE, price: 2, cc: 'FR', brand: 'Carrefour' })], market: 'FR' });
  b2.offers[0].currency = 'USD';
  const r = core.checkPayload(b2); assert.equal(r.offers[0].rankingEligible, false); assert.equal(r.best, null);
  const { body: b3 } = await compare(CODE, { items: [op({ code: CODE, price: 2, cc: 'FR', brand: 'Carrefour' })], market: 'FR' });
  b3.offers[0].suspect = true; assert.equal(core.checkPayload(b3).best, null);
});

test('answers from the old Greece-only engine are refused', () => {
  assert.equal(core.checkPayload({ version: '82.0.0', barcode: CODE, status: 'no_data', offers: [], elsewhere: [] }), null);
  assert.ok(core.checkPayload({ version: '83.0.0', barcode: CODE, country: 'FR', currency: 'EUR', status: 'no_data', offers: [], elsewhere: [] }));
});

test('direct Open Prices fallback (service down) works for any market and currency', () => {
  const items = [op({ code: CODE, price: 2.99, currency: 'GBP', cc: 'GB', brand: 'Tesco', date: daysAgo(1) }), op({ code: CODE, price: 3.1, currency: 'EUR', cc: 'IE', brand: 'Dunnes', date: daysAgo(1) })];
  const r = core.fromOpenPrices(items, CODE, Date.now(), '500 g', 'GB', 'GBP');
  assert.equal(r.home, 'GB'); assert.equal(r.best.price, 2.99); assert.equal(r.best.currency, 'GBP'); assert.equal(r.elsewhere[0].countryCode, 'IE');
});

test('market: signals, normalisation and money', () => {
  assert.equal(market.validMarket('uk'), 'GB'); assert.equal(market.validMarket('el'), 'GR'); assert.equal(market.validMarket('xx'), ''); assert.equal(market.validMarket('QQ'), '');
  assert.equal(market.marketFlag('FR'), '🇫🇷'); assert.equal(market.marketName('DE', 'en'), 'Germany'); assert.equal(market.marketName('GR', 'el'), 'Ελλάδα');
  assert.equal(market.money(398, 'en', 'JPY', 'JP'), '¥398'); // the market's own currency: short symbol, no decimals
  assert.equal(market.money(4.99, 'en', 'USD', 'FR'), 'US$4.99'); // a foreign currency keeps the long form
  assert.equal(market.money(4.99, 'en', 'USD', 'US'), '$4.99'); assert.equal(market.money(24.9, 'en', 'SEK', 'SE').replace(/\s/g, ' '), 'kr 24.90');
  assert.equal(market.money(2.5, 'el', 'EUR', 'GR'), '2,50 €');
  assert.equal(market.money(1, 'en', 'not-a-currency', 'FR'), '€1.00'); // junk currency never throws
  assert.ok(market.ALL_MARKETS.includes('GR') && market.ALL_MARKETS.length > 200);
});

test('the client currency table is identical to the worker\'s (one source of truth, two copies)', async () => {
  const { read } = await import('./helpers.mjs');
  const grab = (src, name) => src.slice(src.indexOf(`const ${name} = {`), src.indexOf('};', src.indexOf(`const ${name} = {`)) + 2).replace(name, 'T');
  assert.equal(grab(read('_worker.js'), 'FS_CURRENCY_COUNTRIES'), grab(read('prices/market-v83.mjs'), 'CURRENCY_COUNTRIES'));
  assert.equal(market.marketCurrency('JP'), 'JPY'); assert.equal(market.marketCurrency('fr'), 'EUR'); assert.equal(market.marketCurrency('ZZ'), '');
});

test('package: every precached file exists, shell pages load the v83 modules, versions agree', async () => {
  const fs = await import('node:fs'); const { read } = await import('./helpers.mjs');
  const sw = read('sw.js'); const list = new Function('return ' + sw.match(/const PRECACHE = (\[.*?\]);/s)[1])();
  for (const f of list.filter(x => x.startsWith('/') && !x.endsWith('/'))) assert.ok(fs.existsSync(path.join(ROOT, f.split('?')[0])), `precached file missing: ${f}`);
  for (const page of ['index.html', 'how/index.html', 'demo/index.html', 'prices/index.html']) { const h = read(page); assert.match(h, /data-foodscan-version="83\.2\.0"/, page); assert.ok(!/-v80\.(?:js|mjs)/.test(h.replace(/prices-base-v80|ocr|add-price/g, '')), `${page} still loads a v80 price module`); }
  assert.match(sw, /const CACHE = 'foodscan-83\.2\.0'/); assert.match(read('_worker.js'), /var VERSION = "83\.2\.0"/); assert.match(read('prices/native-v83.js'), /BUILD = 'foodscan-83\.2\.0'/);
  // every relative import of the v83 modules resolves
  for (const f of ['prices/native-v83.js', 'prices/prices-v83.js', 'prices/price-client-v83.mjs', 'prices/price-core-v83.mjs', 'prices/market-v83.mjs']) for (const m of read(f).matchAll(/from '(\.\/[^']+)'|import\('(\.\/[^']+)'\)/g)) assert.ok(fs.existsSync(path.join(ROOT, 'prices', m[1] || m[2])), `${f} imports a missing file: ${m[1] || m[2]}`);
});

test('the home page preloads only files that exist (module waterfall flattened)', async () => {
  const fs = await import('node:fs'); const { read } = await import('./helpers.mjs');
  const links = [...read('index.html').matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map(m => m[1]);
  assert.ok(links.length >= 14); for (const l of links) assert.ok(fs.existsSync(path.join(ROOT, l)), `modulepreload target missing: ${l}`);
});

test('"Check live prices online" is the plain barcode search: no shopping-mode, country or other parameters that change which product Google ranks first', async () => {
  const fs = await import('node:fs'); const t = fs.readFileSync(path.join(ROOT, 'prices/native-v83.js'), 'utf8');
  assert.match(t, /liveSearchURL\(code\)/); assert.match(t, /rel="noopener noreferrer"/); assert.match(t, /not FoodScan/);
  for (const f of ['prices/native-v83.js', 'prices/prices-v83.js', 'prices/market-v83.mjs']) assert.ok(!/[?&](?:tbm|udm|gl)=/.test(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/Added parameters \(tbm=shop, gl=, udm=\)/, '')), `${f} adds a search parameter`);
  assert.equal(market.liveSearchURL('5201004023360'), 'https://www.google.com/search?q=5201004023360');
  assert.equal(market.liveSearchURL('3017620422003'), 'https://www.google.com/search?q=3017620422003');
  assert.equal(market.searchCode('0012345678905'), '012345678905'); // padded UPC-A: the 12 digits printed on the pack
  assert.equal(market.searchCode('00012345678905'), '012345678905');
  assert.equal(market.searchCode('01234565'), '01234565'); assert.equal(market.searchCode('12345670'), '12345670'); // EAN-8 stays 8 digits
});

test('the market is the same on every page: only an explicit choice or the profile country is used; the browser language and time zone never are', async () => {
  // Node has navigator.language = en-US; the old code turned that into "United States" on the Prices page while the card (server, network country) said Greece.
  const keep = globalThis.localStorage; const mem = new Map(); globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  try {
    const fresh = await import(pathToFileURL(path.join(ROOT, 'prices/market-v83.mjs')).href + '?fresh=' + Math.random());
    assert.deepEqual(fresh.detectMarket(), { code: '', source: 'server' });
    mem.set('fs13:profile', JSON.stringify({ country: 'france' })); assert.deepEqual(fresh.detectMarket(), { code: 'FR', source: 'profile' });
    mem.set('fs13:profile', JSON.stringify({ country: 'any' })); assert.equal(fresh.detectMarket().code, '');
    fresh.setMarket('jp'); assert.deepEqual(fresh.detectMarket(), { code: 'JP', source: 'choice' }); fresh.setMarket(''); assert.equal(fresh.detectMarket().code, '');
  } finally { globalThis.localStorage = keep; }
});

test('v8300 asset generation: every v8200 module has a twin, nothing in v8300 points back at v8200, the shell uses v8300', async () => {
  const fs = await import('node:fs'); const { read } = await import('./helpers.mjs');
  const old = fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('-v8200.js'));
  assert.ok(old.length >= 33);
  for (const f of old) { const twin = f.replace('-v8200.js', '-v8300.js'); assert.ok(fs.existsSync(path.join(ROOT, 'assets', twin)), `missing ${twin}`); assert.ok(!read('assets/' + twin).includes('-v8200.js'), `${twin} still imports a v8200 file`); }
  for (const page of ['index.html', 'how/index.html', 'demo/index.html', 'sw.js']) assert.ok(!read(page).includes('-v8200.js'), `${page} still references v8200`);
  for (const f of fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('-v8300.js'))) for (const m of read('assets/' + f).matchAll(/from\s*["']\.\/([^"']+)["']/g)) assert.ok(fs.existsSync(path.join(ROOT, 'assets', m[1])), `${f} imports a missing file ${m[1]}`);
});

test('live upgrade of ungraded snapshots: only for records without a source grade, with a time budget, a circuit breaker and the snapshot as fallback', async () => {
  const { read } = await import('./helpers.mjs'); const t = read('assets/chunk-BIWX2LG4-v8300.js');
  assert.match(t, /const LIVE_BUDGET = 2600/); assert.match(t, /liveSkipUntil = Date\.now\(\) \+ 120000/); assert.match(t, /\/api\/product\/\$\{code\}\?refresh=1/);
  assert.match(t, /if\(gradeless\(bundled\)\)\{const live=await liveRecord/); assert.match(t, /return \{product:rememberProduct\(bundled,'catalogue'\),via:'catalogue',cache:'DATED-CATALOGUE'\}/);
  assert.match(t, /!\(saved\.catalogueSnapshot&&gradeless\(saved\)\)/);
});
