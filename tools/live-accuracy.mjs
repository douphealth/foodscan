#!/usr/bin/env node
/** Accuracy audit: for a random sample of barcodes the bundled seeds price, ask the running app (which re-reads the shop's own
 *  product page at scan time) and compare the seed price with what the shop page says today.
 *    node tools/live-accuracy.mjs http://localhost:8820 [--n 80] */
import fs from 'node:fs';
const base = process.argv[2] || 'http://localhost:8820';
const N = Number(process.argv.includes('--n') ? process.argv[process.argv.indexOf('--n') + 1] : 80);
const dir = process.env.FS_SEEDS || 'D:/Claude/FoodScan/v79-work/baseline/assets/gr-prices-v72/';
const seeds = { bazaar: JSON.parse(fs.readFileSync(dir + 'bazaar-eshop-latest.json', 'utf8')), lidl: JSON.parse(fs.readFileSync(dir + 'lidl-eshop-latest.json', 'utf8')) };
let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const sample = [];
for (const [shop, doc] of Object.entries(seeds)) { const codes = Object.keys(doc.products); const k = shop === 'bazaar' ? N : Math.min(N, codes.length); const used = new Set(); while (used.size < k) used.add(codes[Math.floor(rnd() * codes.length)]); for (const c of used) sample.push({ shop, code: c.replace(/^0+/, ''), seedPrice: doc.products[c].p, seedDate: doc.products[c].d }); }
let ip = 0; const res = { bazaar: { n: 0, confirmed: 0, same: 0, changed: [], unavailable: 0, dropped: 0 }, lidl: { n: 0, confirmed: 0, same: 0, changed: [], unavailable: 0, dropped: 0 } };
async function one(s) {
  const r = res[s.shop]; r.n++;
  try {
    const j = await (await fetch(`${base}/api/prices/compare?barcode=${s.code}&r=${Math.random()}`, { method: 'POST', headers: { 'CF-Connecting-IP': '198.51.100.' + (++ip % 250 + 1), Origin: base }, signal: AbortSignal.timeout(30000) })).json();
    const prov = j.providers?.[s.shop], o = j.offers.find(x => x.id.startsWith(s.shop === 'bazaar' ? 'bz:' : 'li:'));
    if (prov?.live === 'confirmed' && o) { r.confirmed++; if (Math.abs(o.price - s.seedPrice) < 0.005) r.same++; else r.changed.push([s.code, s.seedPrice, o.price]); }
    else if (prov?.live === 'barcode_not_on_page' || !o) r.dropped++; else r.unavailable++;
  } catch { r.unavailable++; }
}
await Promise.all(Array.from({ length: 3 }, async () => { while (sample.length) await one(sample.shift()); }));
for (const [shop, r] of Object.entries(res)) console.log(shop.padEnd(7), 'sampled', r.n, '| live-confirmed', r.confirmed, '| seed price still right', r.same, '| seed price stale (corrected)', r.changed.length, '| not confirmed', r.unavailable, '| dropped', r.dropped, r.changed.slice(0, 6).map(x => x.join(':')).join(' '));
