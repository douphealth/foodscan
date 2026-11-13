#!/usr/bin/env node
/** FoodScan 93: web-shop prices for the whole catalogue, BEFORE anyone scans (webclaw, prices read by code).
 * The live web search (92) runs only when a shopper scans an unpriced product, at most 20 new lookups a day. This runs the SAME code
 * (src/worker/webprices.js: fsWebclawSearch -> fsWebFromPage -> fsWebVerifyOffers, loaded from the file itself) for every catalogue product that has no
 * current price in FoodScan's own sources (observatory links, Bazaar, Lidl), and publishes the verified prices as small shards the worker reads.
 * A price counts only from a page of a Greek shop that prints THIS barcode, with one price attached to the product, then checked by the 84 verifier.
 *
 *   node tools/webclaw-prefill.mjs --catalogue ../assets/greece-r20261030 --seeds out/seeds --prev prev/web --out out/web [--max 600] [--parallel 4]
 * Needs WEBCLAW_API_KEY in the environment; without it the previous shards are copied unchanged. Re-checks a found price after 6 days (so it stays
 * "current"), a product with nothing found after 45 days. Stops before the credits run low (GET /v1/usage) and on 401/402/403/429.
 * Writes <out>/NN.json (100 shards by the last two digits of the 14-digit barcode, like the seeds) and <out>/manifest.json. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const DAY = 864e5, FOUND_EVERY = 6 * DAY, EMPTY_EVERY = 45 * DAY;
export const key14 = c => String(c).replace(/\D/g, '').padStart(14, '0');
export const shardOf = k => k.slice(-2);

/** The worker's own web-price functions, from the worker source file (one source of truth for the rules). */
export function loadRules(file = path.join(here, '../../src/worker/webprices.js')) {
  return new Function(fs.readFileSync(file, 'utf8') + '\nreturn { fsWebclawSearch, fsWebFromPage, fsWebVerifyOffers };')();
}
/** Barcodes that already have a CURRENT price in FoodScan's own Greek sources (observatory links, Bazaar, Lidl; e-katanalotis is only history). */
export function pricedFrom(seedsDir) {
  const priced = new Set();
  for (const src of ['pk', 'bz', 'li']) {
    const d = path.join(seedsDir, src); if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => /^\d{2}\.json$/.test(f))) { const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); for (const k of Object.keys(j.products || {})) priced.add(key14(k)); }
  }
  return priced;
}
export function readShards(dir) {
  const m = new Map(); if (!dir || !fs.existsSync(dir)) return m;
  for (const f of fs.readdirSync(dir).filter(f => /^\d{2}\.json$/.test(f))) { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (j?.schema === 1) for (const [k, v] of Object.entries(j.products || {})) m.set(k, v); }
  return m;
}
export function writeShards(out, state, meta) {
  fs.mkdirSync(out, { recursive: true });
  const shards = new Map();
  for (const [k, v] of state) { const s = shardOf(k); (shards.get(s) || shards.set(s, {}).get(s))[k] = v; }
  const put = (f, text) => { const tmp = path.join(out, f + '.tmp'); fs.writeFileSync(tmp, text); fs.renameSync(tmp, path.join(out, f)); }; // never a half-written shard
  for (let i = 0; i < 100; i++) { const s = String(i).padStart(2, '0'); put(s + '.json', JSON.stringify({ schema: 1, built: meta.built, products: shards.get(s) || {} })); }
  put('manifest.json', JSON.stringify({ schema: 1, ...meta }, null, 1));
}
/** Which catalogue products to look up today, most useful first: never tried, then found prices about to go stale, then long-ago empty ones. */
export function plan(catalogue, priced, state, now = Date.now()) {
  const due = [];
  for (const p of catalogue) {
    const k = key14(p.code); if (priced.has(k)) continue;
    const s = state.get(k), age = s ? now - Date.parse(s.t) : Infinity;
    const rank = !s ? 0 : s.o?.length ? (age >= FOUND_EVERY ? 1 : null) : (age >= EMPTY_EVERY ? 2 : null);
    if (rank === null) continue;
    due.push({ p, k, rank, greek: k.startsWith('0520') ? 0 : 1, branded: p.brands ? 0 : 1 });
  }
  return due.sort((a, b) => a.rank - b.rank || a.greek - b.greek || a.branded - b.branded || (a.k < b.k ? -1 : 1));
}
const compact = o => ({ r: o.retailer, p: o.price, u: o.url, n: o.productTitle, k: o.packSize, c: o.checkedAt });

async function usage(key) {
  try { const r = await fetch('https://api.webclaw.io/v1/usage', { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) }); return r.ok ? await r.json() : null; } catch { return null; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = arg('--out', 'out/web'), prevDir = arg('--prev', null), seeds = arg('--seeds', 'out/seeds'), catDir = arg('--catalogue', path.join(here, '../../assets/greece-r20261030'));
  const key = process.env.WEBCLAW_API_KEY || '', max = Math.max(0, Number(arg('--max', process.env.WEBCLAW_DAILY_LOOKUPS || 600))), parallel = Math.max(1, Math.min(8, Number(arg('--parallel', 2))));
  const state = readShards(prevDir); readShards(out).forEach((v, k) => { if (!state.has(k) || Date.parse(v.t) > Date.parse(state.get(k).t)) state.set(k, v); }); // resume a partial run
  const catalogue = []; for (const f of fs.readdirSync(catDir).filter(f => f.startsWith('part-')).sort()) catalogue.push(...JSON.parse(fs.readFileSync(path.join(catDir, f), 'utf8')).products);
  const priced = pricedFrom(seeds), due = plan(catalogue, priced, state);
  const finish = (extra = {}) => { const withPrice = [...state.values()].filter(v => v.o?.length).length; writeShards(out, state, { built: new Date().toISOString(), source: 'webclaw search + FoodScan price rules (src/worker/webprices.js)', catalogue: catalogue.length, pricedElsewhere: priced.size, tracked: state.size, withPrice, due: due.length, ...extra }); console.error(`web prefill: ${withPrice} products with a web-shop price, ${state.size} tracked, ${due.length} were due, ${JSON.stringify(extra)}`); };
  if (!key) { console.error('web prefill: no WEBCLAW_API_KEY; previous shards kept'); finish({ ran: 0, reason: 'no_key' }); process.exit(0); }
  const before = await usage(key), room = before ? Math.floor((Number(before.credits_remaining) - 2000) / 8) : max; // keep a reserve of 2,000 credits
  const todo = due.slice(0, Math.max(0, Math.min(max, room)));
  const R = loadRules(), env = { WEBCLAW_API_KEY: key, FS_WEBCLAW_RESULTS: process.env.FS_WEBCLAW_RESULTS || '10', FS_WEBCLAW_SERIAL: '1' };
  let ran = 0, found = 0, failed = 0, busy = 0, stop = ''; const started = Date.now();
  const work = async item => {
    if (stop) return;
    const q = { code: item.k, market: 'GR', currencies: ['EUR'], name: String(item.p.product_name || ''), brand: String(item.p.brands || '').split(',')[0], quantity: String(item.p.quantity || '') };
    try {
      let pages = null;
      for (const wait of [0, 3000, 8000, 20000]) { // webclaw answers 503/429 when busy: back off and try again
        if (wait) await new Promise(r => setTimeout(r, wait));
        try { pages = await R.fsWebclawSearch(env, q, AbortSignal.timeout(90000)); break; } catch (e) { busy++; if (!/webclaw_(5\d\d|429)|aborted|timeout|fetch failed/i.test(String(e.message || e)) || wait === 20000) throw e; }
      }
      const offers = R.fsWebVerifyOffers(pages.map(p => R.fsWebFromPage(q, p)).filter(Boolean), pages, q);
      state.set(item.k, { t: new Date().toISOString(), o: offers.map(compact) }); ran++; if (offers.length) found++;
    } catch (e) { failed++; const m = String(e.message || e); if (failed <= 3) console.error(`web prefill: ${item.k} failed: ${m.slice(0, 160)}`); if (/webclaw_(401|402|403|429)/.test(m)) stop = m; }
    const done = ran + failed;
    if (done % 25 === 0) console.error(`web prefill: ${done}/${todo.length} looked up, ${found} prices, ${busy} busy retries, ${((Date.now() - started) / 1000 / done).toFixed(1)} s per lookup`);
    if (done % 50 === 0) { finish({ ran, found, failed, busy, partial: true }); }
  };
  for (let i = 0; i < todo.length && !stop; i += parallel) await Promise.all(todo.slice(i, i + parallel).map(work));
  const after = await usage(key);
  finish({ ran, found, failed, busy, stoppedBy: stop || null, creditsUsed: before && after ? Number(after.credits_used) - Number(before.credits_used) : null, creditsRemaining: after?.credits_remaining ?? null });
}
