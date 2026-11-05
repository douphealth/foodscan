#!/usr/bin/env node
/** Measures prices/similar-v86.mjs against the published letters of the graded products of the bundled catalogue, leave-one-out: the product being tested (and, in the
 *  strict runs, every product with the same name and brand) is removed from the peers first. Two situations are simulated on each graded product that has all four numbers:
 *    nothing known:      name and brand only (a product whose record has no nutrition)
 *    sugars+salt hidden: the situation of a record that has energy, fat, saturates, carbohydrate and protein but no sugars and no salt
 *  Reports how often the published letter is inside the estimated band, how wide the bands are, and how many products get one. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const D = await import(path.join(here, '../assets/domain-v8500.mjs'));
const S = await import(path.join(here, '../prices/similar-v86.mjs'));
const B = await import(path.join(here, 'build-peers.mjs'));

export function validate({ limit = Infinity, opts = {}, only = null } = {}) {
  const dir = path.join(here, '../assets/greece-r20261030'), items = [];
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-')).sort()) for (const raw of JSON.parse(fs.readFileSync(path.join(dir, f))).products) items.push({ raw, p: D.parseProduct({ status: 1, product: raw }, raw.code) });
  const prep = S.prepare(JSON.parse(fs.readFileSync(B.fileFor(JSON.parse(fs.readFileSync(path.join(dir, 'index.json'))).revision), 'utf8')));
  const graded = items.filter(x => /^[A-E]$/.test(x.p.nutriScore || '') && D.ns23Inputs(x.p) && Number.isFinite(x.p.nutriScoreValue) && x.p.name);
  const out = {};
  for (const [scenario, hide] of [['nothing', n => ({ nutriments: null })], ['sugars+salt', n => ({ sugars: null, salt: null })]].filter(x => !only || x[0] === only)) for (const noTwins of only ? [true] : [false, true]) {
    const r = out[`${scenario}${noTwins ? ' (no twins)' : ''}`] = { n: 0, shown: 0, inside: 0, likely: 0, width: { 1: 0, 2: 0, 3: 0 }, reasons: {}, byWidthInside: { 1: 0, 2: 0, 3: 0 } };
    for (const x of graded.slice(0, limit)) {
      r.n++;
      const nutrition = scenario === 'nothing' ? {} : { ...x.p.nutrition, ...hide() };
      const q = S.similarGrade({ ...x.p, nutrition, categories: [], pnns: 'unknown' }, prep, { exclude: x.raw.code, noTwins, ...opts });
      if (!q.ok) { r.reasons[q.reason] = (r.reasons[q.reason] || 0) + 1; continue; }
      r.shown++; r.width[q.letters.length]++; const inside = q.letters.includes(x.p.nutriScore); if (inside) { r.inside++; r.byWidthInside[q.letters.length]++; } if (q.likely === x.p.nutriScore) r.likely++;
    }
  }
  return out;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0') + ' %', res = validate();
  for (const [k, r] of Object.entries(res)) console.log(`${k.padEnd(26)} n ${r.n}: estimate for ${r.shown} (${pct(r.shown, r.n)}); published letter inside ${pct(r.inside, r.shown)}; "likely" exact ${pct(r.likely, r.shown)}; widths 1/2/3: ${r.width[1]}/${r.width[2]}/${r.width[3]}; inside by width ${pct(r.byWidthInside[1], r.width[1])} / ${pct(r.byWidthInside[2], r.width[2])} / ${pct(r.byWidthInside[3], r.width[3])}; no estimate: ${JSON.stringify(r.reasons)}`);
}
