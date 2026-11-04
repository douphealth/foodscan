import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT, compare, op, daysAgo } from './helpers.mjs';

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
  for (const page of ['index.html', 'how/index.html', 'demo/index.html', 'prices/index.html']) { const h = read(page); assert.match(h, /data-foodscan-version="83\.0\.0"/, page); assert.ok(!/-v80\.(?:js|mjs)/.test(h.replace(/prices-base-v80|ocr|add-price/g, '')), `${page} still loads a v80 price module`); }
  assert.match(sw, /const CACHE = 'foodscan-83\.0\.0'/); assert.match(read('_worker.js'), /var VERSION = "83\.0\.0"/); assert.match(read('prices/native-v83.js'), /BUILD = 'foodscan-83\.0\.0'/);
  // every relative import of the v83 modules resolves
  for (const f of ['prices/native-v83.js', 'prices/prices-v83.js', 'prices/price-client-v83.mjs', 'prices/price-core-v83.mjs', 'prices/market-v83.mjs']) for (const m of read(f).matchAll(/from '(\.\/[^']+)'|import\('(\.\/[^']+)'\)/g)) assert.ok(fs.existsSync(path.join(ROOT, 'prices', m[1] || m[2])), `${f} imports a missing file: ${m[1] || m[2]}`);
});
