#!/usr/bin/env node
/** Drives the REAL Better-choices pipeline (the shipped modules, loaded in Chromium) over real catalogue products, with every live
 * food-API call refused, and records what it returns. Used for before/after numbers and for the consistency invariants.
 *   node tools/rec-harness.mjs --base http://localhost:8802 --suffix v620 --dir app/assets/greece-v620 --out release-qa/rec-v620.json [--per-family 3] [--codes a,b,c] [--country greece]
 */
import { chromium } from 'playwright-core';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const base = arg('--base', 'http://localhost:8802'), S = arg('--suffix', 'v620'), dir = resolve(arg('--dir', `app/assets/greece-${S}`));
const out = arg('--out', ''), perFamily = Number(arg('--per-family', 3)), country = arg('--country', 'greece');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

// Deterministic sample: the same codes every run (sorted by a hash of the barcode), spread over families and over source grades.
let codes = arg('--codes', '') ? arg('--codes', '').split(',') : [];
if (!codes.length) {
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const byFamily = {};
  for (const f of readdirSync(dir).filter(f => /^part-.*\.json$/.test(f))) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const p of d.products) if (p.nutriments && (p.nutriments['energy-kcal_100g'] != null || p.nutriments.energy_100g != null)) (byFamily[d.family] ||= []).push(p);
  }
  for (const [family, list] of Object.entries(byFamily)) {
    list.sort((a, b) => hash(a.code) - hash(b.code));
    const graded = list.filter(p => /^[a-e]$/.test(p.nutriscore_grade || '')), ungraded = list.filter(p => !/^[a-e]$/.test(p.nutriscore_grade || ''));
    codes.push(...graded.slice(0, perFamily).map(p => p.code), ...ungraded.slice(0, 1).map(p => p.code));
  }
}
console.log(`bases: ${codes.length}`);

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const ctx = await browser.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.route(/openfoodfacts\.org/, r => r.abort());      // the harness never touches the live food API
await page.goto(base + '/how/', { waitUntil: 'load' });
const rows = [];
for (let i = 0; i < codes.length; i += 8) {
  const batch = codes.slice(i, i + 8);
  rows.push(...await page.evaluate(async ({ batch, S, country }) => {
    const mc = await import(`/assets/market-catalogue-${S}.mjs`), engine = await import(`/assets/chunk-57E5ZLYU-${S}.js`), dom = await import(`/assets/domain-${S}.mjs`);
    const offline = Object.assign(new Error('offline'), { code: 'upstream_busy' });
    const source = { catalogue: (plan, o) => mc.marketCatalogue.query(plan, o), saved: async () => [], remember: p => p, peek: () => null, pool: async () => { throw offline; }, product: async () => { throw offline; }, search: async () => { throw offline; } };
    const grade = p => { const a = dom.assessGrade(p); return { grade: a.grade, status: a.status, method: a.method }; };
    const out = [];
    for (const code of batch) {
      const baseProduct = await mc.marketCatalogue.product(code);
      if (!baseProduct) { out.push({ code, error: 'not-in-catalogue' }); continue; }
      const t0 = performance.now();
      let res, error = null;
      try { res = await engine.e(baseProduct, { country }, { country, source }); } catch (e) { error = String(e?.code || e?.message || e); }
      const ms = Math.round(performance.now() - t0);
      const reopen = async item => { const again = await mc.marketCatalogue.product(item.product.barcode); return again ? grade(again) : null; };
      const pick = async (list, kind) => Promise.all((list || []).map(async item => ({ kind, code: item.product.barcode, name: item.product.name, brand: item.product.brand, shown: item.to ?? grade(item.product).grade, from: item.from ?? null, shownMethod: item.gradeMethod ?? null,
        opened: await reopen(item), reasons: (item.reasons || []).slice(0, 2), improvements: (item.improvements || []).map(x => ({ key: x.key, from: x.from, to: x.to, percent: x.percent })), basis: item.product.basis, recordSource: item.recordSource || null, checkedAt: item.checkedAt || item.product.catalogueSnapshot?.exportedAt || null })));
      out.push({ code, name: baseProduct.name, brand: baseProduct.brand, family: res?.plan?.family ?? null, base: grade(baseProduct), basis: baseProduct.basis, ms, error, status: res?.status ?? null, hidden: res?.hidden ?? null, candidateCount: res?.candidateCount ?? null, verifiedCount: res?.verifiedCount ?? null,
        better: res ? await pick(res.better, 'better') : [], peers: res ? await pick(res.peers, 'peer') : [], nutrition: res ? await pick(res.nutritionBetter, 'nutrition') : [], compare: res ? await pick(res.comparisonFoods, 'compare') : [], catalogue: res?.catalogue ? { status: res.catalogue.status, failed: (res.catalogue.failedFiles || []).length } : null });
    }
    return out;
  }, { batch, S, country }));
  process.stdout.write('.');
}
console.log();
await browser.close();
const summary = { bases: rows.length, status: {}, withHigherGrade: 0, withPeers: 0, withNutrition: 0, withCompare: 0, nothing: 0, errors: 0, mismatches: [], ms: [] };
for (const r of rows) {
  if (r.error) { summary.errors++; continue; }
  summary.status[r.status] = (summary.status[r.status] || 0) + 1; summary.ms.push(r.ms);
  if (r.better.length) summary.withHigherGrade++; if (r.peers.length) summary.withPeers++; if (r.nutrition.length) summary.withNutrition++; if (r.compare.length) summary.withCompare++;
  if (!r.better.length && !r.peers.length && !r.nutrition.length && !r.compare.length) summary.nothing++;
  for (const item of r.better) if (item.opened?.grade !== item.shown) summary.mismatches.push({ base: r.code, item: item.code, shown: item.shown, opened: item.opened });
}
summary.ms.sort((a, b) => a - b);
const q = p => summary.ms[Math.min(summary.ms.length - 1, Math.floor(p * summary.ms.length))];
summary.latency = { p50: q(0.5), p95: q(0.95), max: q(1) }; delete summary.ms;
console.log(JSON.stringify(summary, null, 1));
if (out) { mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(out, JSON.stringify({ summary, rows }, null, 1)); }
