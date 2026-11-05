#!/usr/bin/env node
/** Measures prices/swaps-v88.mjs on the bundled Greek catalogue.
 *  For every product with a grade (published) whose category tags name a real shelf (its most specific tag shared by at least 8 recommendable products):
 *    coverage: it gets at least one strictly better-graded swap (products graded A are left out: nothing is better)
 *    same shelf: the top swap (and all shown swaps) carry that shelf tag; a swap with no tags of its own counts as NOT the same shelf
 *  Two runs: the record as it is, and the same record with its categories and PNNS group hidden (the situation of a record with no category).
 *  Plus coverage over the whole catalogue, with the grade the page has (published, calculated, or an estimate's likely letter). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const D = await import(path.join(here, '../assets/domain-v8500.mjs'));
const Q = await import(path.join(here, '../prices/quick-grade-v85.mjs'));
const W = await import(path.join(here, '../prices/swaps-v88.mjs'));
const B = await import(path.join(here, 'build-swaps.mjs'));

export function load() {
  const dir = path.join(here, '../assets/greece-r20261030'), items = [];
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-')).sort()) {
    const family = /^part-([a-z-]+)-\d+\.json$/.exec(f)[1];
    for (const raw of JSON.parse(fs.readFileSync(path.join(dir, f))).products) items.push({ raw, family, p: D.parseProduct({ status: 1, product: raw }, raw.code) });
  }
  const prep = W.prepare(JSON.parse(fs.readFileSync(B.fileFor(JSON.parse(fs.readFileSync(path.join(dir, 'index.json'))).revision), 'utf8')));
  return { items, prep };
}
const kindOf = (p, hideCats) => { const k = D.ns23Kinds(hideCats ? { ...p, categories: [], pnns: 'unknown' } : p); return k.kinds?.length ? k.kinds[0] : Q.inferKinds(hideCats ? { ...p, categories: [] } : p).kinds[0]; };
export const targetOf = (x, { hideCats = false, grade } = {}) => ({ code: x.raw.code, name: x.p.name, brand: (x.raw.brands || '').split(',')[0], categories: hideCats ? [] : x.raw.categories_tags || [], pnns: hideCats ? '' : x.raw.pnns_groups_2 || '', family: x.family, kind: kindOf(x.p, hideCats), grade: grade ?? (/^[A-E]$/.test(x.p.nutriScore || '') ? x.p.nutriScore : null) });

export function validate({ items, prep } = load(), opts = {}) {
  const shelfOf = x => [...(x.raw.categories_tags || [])].reverse().find(c => (prep.catDf.get(c) || 0) >= 8) || null;
  const aisleOf = x => [...(x.raw.categories_tags || [])].reverse().find(c => (prep.catDf.get(c) || 0) >= 30) || null; // e.g. biscuits rather than chocolate biscuits
  const res = {};
  for (const hideCats of [false, true]) {
    const r = res[hideCats ? 'no category' : 'as recorded'] = { n: 0, covered: 0, top: 0, all: 0, shown: 0, gain: 0, topAisle: 0, allAisle: 0, labelled: 0, labelledOk: 0 };
    for (const x of items) {
      const g = x.p.nutriScore; if (!/^[B-E]$/.test(g || '')) continue;
      const shelf = shelfOf(x), aisle = aisleOf(x); if (!shelf || !aisle) continue;
      r.n++;
      const s = W.findSwaps(targetOf(x, { hideCats }), prep, opts); if (!s.ok) continue;
      r.covered++; if (s.swaps[0].row.cats.includes(shelf)) r.top++; if (s.swaps[0].row.cats.includes(aisle)) r.topAisle++;
      for (const w of s.swaps) { r.shown++; if (w.row.cats.includes(shelf)) r.all++; if (w.row.cats.includes(aisle)) r.allAisle++; if (w.tier === 'shelf') { r.labelled++; if (w.row.cats.includes(shelf)) r.labelledOk++; } r.gain += W.RANK[g] - W.RANK[w.row.grade]; }
    }
  }
  return res;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = load(), pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0') + ' %';
  for (const [k, r] of Object.entries(validate(data))) console.log(`${k.padEnd(12)} products ${r.n}: get a better swap ${pct(r.covered, r.n)}; top swap on the same shelf ${pct(r.top, r.covered)}; all shown swaps on the same shelf ${pct(r.all, r.shown)}; same aisle: top ${pct(r.topAisle, r.covered)}, all ${pct(r.allAisle, r.shown)}; average improvement ${(r.gain / Math.max(1, r.shown)).toFixed(2)} letters; labelled "same shelf": ${r.labelled}, of which on the shelf ${pct(r.labelledOk, r.labelled)}`);
}
