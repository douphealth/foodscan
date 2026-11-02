#!/usr/bin/env node
/** Coverage / state evaluator for a running emulator (or deployed site):
 *    node tools/coverage-eval.mjs http://localhost:8820 [--n 300] [--random 150] [--out file.json]
 *  Samples the most-scanned Greek-market barcodes (Open Food Facts unique_scans_n) and a random set of Greek-prefix barcodes,
 *  calls /api/prices/compare and counts what a user would see. */
import fs from 'node:fs';
const base = process.argv[2] || 'http://localhost:8820';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const N = Number(arg('--n', 300)), R = Number(arg('--random', 150)), OUT = arg('--out', null);
const off = JSON.parse(fs.readFileSync('D:/Claude/FoodScan/v77-work/scratch/off/extract.json', 'utf8')).rows;
const valid = s => { s = s.replace(/^0+(?=\d{8})/, ''); if (!/^(?:\d{8}|\d{12,14})$/.test(s)) return false; const d = s.padStart(14, '0'); let t = 0; for (let i = 0; i < 13; i++) t += Number(d[i]) * (i % 2 === 0 ? 3 : 1); return (10 - t % 10) % 10 === Number(d[13]); };
const rows = off.filter(r => String(r[7]).includes('en:greece') && valid(String(r[0]))).map(r => ({ code: String(r[0]).replace(/^0+/, ''), scans: Number(r[8]) || 0, name: r[1] }));
rows.sort((a, b) => b.scans - a.scans);
const popular = rows.slice(0, N);
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const greekPrefix = rows.filter(r => /^520/.test(r.code)); const random = []; const used = new Set();
while (random.length < R && random.length < greekPrefix.length) { const r = greekPrefix[Math.floor(rnd() * greekPrefix.length)]; if (!used.has(r.code)) { used.add(r.code); random.push(r); } }
let ip = 0;
async function one(r) {
  const url = `${base}/api/prices/compare?barcode=${r.code}&r=${Math.random()}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'CF-Connecting-IP': '198.51.100.' + (++ip % 250 + 1), Origin: base }, signal: AbortSignal.timeout(30000) });
    const j = await res.json();
    const offers = j.offers || [], current = offers.filter(o => o.rankingEligible && o.freshness === 'current');
    return { ...r, http: res.status, status: j.status, offers: offers.length, current: current.length, best: current.length ? Math.min(...current.map(o => o.price)) : null, estimate: j.estimate ? j.estimate.cls : null,
      latest: offers.length ? offers.slice().sort((a, b) => b.date.localeCompare(a.date))[0].date : null, version: j.version };
  } catch (e) { return { ...r, http: 0, status: 'error:' + String(e).slice(0, 40) }; }
}
async function run(list) { const out = []; let i = 0; await Promise.all(Array.from({ length: 4 }, async () => { while (i < list.length) { const r = list[i++]; out.push(await one(r)); } })); return out; }
const summarize = (label, res) => {
  const n = res.length, c = k => res.filter(k).length, pct = x => (100 * x / n).toFixed(0) + '%';
  const cur = c(r => r.current > 0), any = c(r => r.offers > 0), est = c(r => !r.offers && r.estimate), err = c(r => r.http !== 200);
  console.log(label.padEnd(10), 'n', n, '| current price', cur, pct(cur), '| any recorded', any, pct(any), '| estimate only', est, pct(est), '| price figure of any kind', any + est, pct(any + est), '| errors', err);
};
const t0 = Date.now(); const pop = await run(popular), rand = await run(random);
summarize('popular', pop); summarize('random', rand);
console.log('seconds', Math.round((Date.now() - t0) / 1000));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ pop, rand }, null, 1));
