/* 93: web-shop prices found ahead of any scan (price-refresh/tools/webclaw-prefill.mjs) and read by the worker on the product page and in lists. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, makeEnv, compare, peek, json } from './helpers.mjs';
const P = await import(pathToFileURL(path.join(ROOT, 'price-refresh/tools/webclaw-prefill.mjs')).href);
const DAY = 864e5, now = Date.parse('2026-11-11T12:00:00Z');

test('the plan skips products priced elsewhere, does never-tried products first, re-checks a found price after 6 days and an empty one after 45', () => {
  const cat = [{ code: '5201024005438', brands: 'Lays' }, { code: '4000000000006', brands: '' }, { code: '5201310006071', brands: 'Yfantis' }, { code: '5200000000009', brands: 'X' }, { code: '5209999999995', brands: 'Y' }];
  const priced = new Set([P.key14('5200000000009')]);
  const state = new Map([[P.key14('5201310006071'), { t: new Date(now - 7 * DAY).toISOString(), o: [{ p: 4.58 }] }], [P.key14('5209999999995'), { t: new Date(now - 10 * DAY).toISOString(), o: [] }]]);
  const due = P.plan(cat, priced, state, now).map(d => d.k.replace(/^0+/, ''));
  assert.deepEqual(due, ['5201024005438', '4000000000006', '5201310006071'], 'priced elsewhere skipped; empty one re-checked only after 45 days; Greek and branded first among the new');
});

test('shards round-trip, 100 files by the last two digits, with a manifest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webpre-'));
  const state = new Map([[P.key14('5201024005438'), { t: '2026-11-11T10:00:00Z', o: [{ r: 'Kiosk', p: 1.8, u: 'https://k.gr/p', n: "LAY'S 95gr", k: '95gr', c: '2026-11-11T10:00:00Z' }] }]]);
  P.writeShards(dir, state, { built: '2026-11-11T12:00:00Z' });
  assert.equal(fs.readdirSync(dir).filter(f => /^\d{2}\.json$/.test(f)).length, 100);
  assert.deepEqual(P.readShards(dir).get(P.key14('5201024005438')).o[0].p, 1.8);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'))).schema, 1);
});

test('the worker shows a prefilled web-shop price on the product page and in lists, with no live search', async () => {
  const code = '5201024005438', today = new Date().toISOString(), url = 'https://data-webpre.test/prices-data';
  const shard = { schema: 1, built: today, products: { [P.key14(code)]: { t: today, o: [{ r: 'Kiosk Example', p: 1.8, u: 'https://www.kiosk-example.gr/p/3605', n: "LAY'S CHORIZO & ONION 95gr", k: '95gr', c: today }] } } };
  const remote = [new RegExp('^' + url.replace(/\./g, '\\.') + '/web/(\\d{2})\\.json'), u => u.endsWith('/web/38.json') ? json(shard) : new Response('', { status: 404 })];
  const live = [/api\.webclaw\.io|api\.anthropic|api\.firecrawl/, () => { throw new Error('no live search when a prefilled current price exists'); }];
  const env = makeEnv({ FOODSCAN_PRICE_DATA_URL: url });
  const r = await compare(code, { market: 'GR', env, extra: [remote, live] });
  const ws = r.body.offers.filter(o => String(o.id).startsWith('ws:'));
  assert.equal(ws.length, 1); assert.equal(ws[0].price, 1.8); assert.equal(ws[0].tier, 'current');
  const p = await peek([code], { market: 'GR', env, extra: [remote, live] });
  assert.equal(p.body.items[0].best?.price, 1.8, 'lists show it too');
});
