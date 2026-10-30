#!/usr/bin/env node
/** Cold and warm lookup latency of the bundled catalogue, measured in real Chromium against a running Pages emulator.
 *   node tools/perf-catalogue.mjs --base http://localhost:8802 --suffix v620 --catalogue greece-v610 [--n 60] [--cpu 4]
 * Cold = module caches cleared and the browser HTTP cache disabled for the request; --cpu applies Chrome's CPU throttling (mid-range phone). */
import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const base = arg('--base', 'http://localhost:8802'), S = arg('--suffix', 'v620'), cat = arg('--catalogue', 'greece-v610'), n = Number(arg('--n', 60)), cpu = Number(arg('--cpu', 1));
const dir = resolve(arg('--dir', `app/assets/${cat}`));
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const all = [];
for (const f of readdirSync(dir).filter(f => /^part-.*\.json$/.test(f))) for (const p of JSON.parse(readFileSync(join(dir, f), 'utf8')).products) all.push(p);
all.sort((a, b) => hash(a.code) - hash(b.code));
const codes = all.slice(0, n).map(p => p.code);
const queries = ['γαλα', 'galaktos', 'feta', 'φετα', 'oreo', 'ψωμι', 'cola', 'γιαουρτι', 'nutella', 'ελαιολαδο'];

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const ctx = await browser.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.route(/openfoodfacts\.org/, r => r.abort());
const cdp = await ctx.newCDPSession(page);
if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
await page.goto(base + '/how/', { waitUntil: 'load' });
const result = await page.evaluate(async ({ S, codes, queries }) => {
  const mc = await import(`/assets/market-catalogue-${S}.mjs`), dom = await import(`/assets/domain-${S}.mjs`);
  const q = (list, p) => { const s = [...list].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10; };
  const stat = list => ({ n: list.length, p50: q(list, .5), p95: q(list, .95), max: q(list, 1) });
  const bytes = () => performance.getEntriesByType('resource').filter(e => /greece-/.test(e.name)).reduce((a, e) => a + (e.transferSize || e.encodedBodySize || 0), 0);
  const cold = [], warm = [], gradeCost = [], search = [], searchHits = [];
  const startBytes = bytes();
  for (const code of codes) {
    mc.marketCatalogue.clear();
    let t = performance.now(); const p = await mc.marketCatalogue.product(code); cold.push(performance.now() - t);
    t = performance.now(); await mc.marketCatalogue.product(code); warm.push(performance.now() - t);
    if (p) { t = performance.now(); dom.assessGrade(p); gradeCost.push(performance.now() - t); }
  }
  const coldBytes = bytes() - startBytes;
  for (const text of queries) { mc.marketCatalogue.clear(); const t = performance.now(); const r = await mc.marketCatalogue.search(text, { country: 'greece' }); search.push(performance.now() - t); searchHits.push({ text, hits: r.products.length, first: r.products[0]?.name || null }); }
  return { cold: stat(cold), warm: stat(warm), assessGrade: stat(gradeCost), search: stat(search), searchHits, coldKBPerLookup: Math.round(coldBytes / codes.length / 1024) };
}, { S, codes, queries });
console.log(JSON.stringify({ base, suffix: S, cpuThrottle: cpu, ...result }, null, 1));
await browser.close();
