import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP, read } from './helpers.mjs';

const V = '81.0.0', BUILD = '8100-honest-prices', rx = s => s.replace(/\./g, '\\.');

test('release identity is the same everywhere', () => {
  assert.match(read('_worker.js'), new RegExp(`var VERSION = "${rx(V)}";`)); assert.match(read('_worker.js'), new RegExp(`var BUILD = "${BUILD}";`));
  assert.match(read('sw.js'), new RegExp(`const CACHE = 'foodscan-${rx(V)}'`)); assert.match(read('prices/native-v80.js'), new RegExp(`export const BUILD = 'foodscan-${rx(V)}'`));
  for (const f of ['index.html', 'prices/index.html', 'demo/index.html', 'how/index.html']) assert.match(read(f), new RegExp(`data-foodscan-version="${rx(V)}"`), f);
  assert.match(read('RELEASE-81.0.0.md'), /81\.0\.0/);
});

test('every service-worker precache entry exists in the package, so activation can never fail on a 404', () => {
  const sw = read('sw.js'); const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  const extra = [...sw.matchAll(/PRECACHE\.push\(([^)]*)\)/g)].flatMap(m => JSON.parse('[' + m[1].replace(/'/g, '"') + ']')); const all = [...new Set([...list, ...extra])]; assert.ok(all.length > 40);
  for (const p of all) { const f = p.split('?')[0]; assert.ok(fs.existsSync(path.join(APP, f.endsWith('/') ? f + 'index.html' : f)), 'missing precache entry ' + p); }
  assert.ok(all.includes('/prices/native-v80.js') && all.includes('/prices/price-core-v80.mjs') && all.includes('/ui-v80.css')); assert.ok(!all.some(p => /-v79\./.test(p)));
});

test('pages reference only v80 price modules and the shared stylesheet', () => {
  for (const f of ['index.html', 'prices/index.html', 'demo/index.html', 'how/index.html']) { const s = read(f); assert.ok(!/-v79\./.test(s), f); assert.ok(s.includes('/ui-v80.css'), f + ' lacks ui-v80.css'); assert.ok(/-v80\./.test(s), f); }
  for (const f of ['prices/native-v80.js', 'prices/prices-v80.js', 'prices/price-client-v80.mjs']) assert.ok(!/-v79\./.test(read(f)), f);
});

test('every relative import of the price modules resolves', () => {
  for (const f of ['prices/native-v80.js', 'prices/prices-v80.js', 'prices/price-client-v80.mjs', 'prices/price-core-v80.mjs', 'prices/add-price-v80.mjs'])
    for (const m of read(f).matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) assert.ok(fs.existsSync(path.join(APP, 'prices', m[1])), `${f} imports ${m[1]}`);
});

test('the price API is routed to the worker and assets stay static', () => {
  const r = JSON.parse(read('_routes.json')); assert.ok(r.include.includes('/api/*')); assert.ok(r.exclude.includes('/assets/*'));
});

test('Kritikos stays OFF by default and its seed is not shipped (the shop’s terms forbid reuse without permission)', () => {
  assert.ok(!fs.existsSync(path.join(APP, 'assets/gr-prices-v72/kritikos-eshop-latest.json'))); assert.match(read('_worker.js'), /optIn:'FS_KRITIKOS'/);
});

test('no leftover of the invented-price engines', () => { const w = read('_worker.js'); for (const bad of ['fsFetchTimoulesLiveOffers', 'fsFetchKillDealLiveOffers', 'chainMultiplier', 'priceBenchmark']) assert.ok(!w.includes(bad), bad); });

test('package size stays inside Cloudflare Pages limits (25 MiB per file, 20,000 files)', () => {
  let files = 0, biggest = 0; const walk = d => { for (const e of fs.readdirSync(d)) { const f = path.join(d, e), st = fs.statSync(f); if (st.isDirectory()) walk(f); else { files++; biggest = Math.max(biggest, st.size); } } };
  walk(APP); assert.ok(files < 3000, 'files ' + files); assert.ok(biggest < 25 * 1048576, 'biggest file ' + biggest);
});
