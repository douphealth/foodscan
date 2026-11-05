#!/usr/bin/env node
/** Measures the quick grade (prices/quick-grade-v85.mjs) against Open Food Facts' own published letters, on every graded product of the bundled Greek catalogue.
 *   node tools/quick-grade-validate.mjs
 * The categories of each graded product are hidden, so the estimate faces the same situation as a product that has none: the table is inferred from the name, the unit
 * and the composition. "Truth" here is the letter Open Food Facts published; it is not independent (Open Food Facts itself falls back to the general table when it has no
 * category, so a juice without a category is graded as a food there). Also hides, one at a time, the salt, the sugars and the saturated fat of each graded product to measure
 * the bounded estimate, and counts how many products that show "No grade" today would get an estimate. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const D = await import(path.join(here, '../assets/domain-v8500.mjs'));
const Q = await import(path.join(here, '../prices/quick-grade-v85.mjs'));
const blank = () => ({ n: 0, inside: 0, likely: 0, likelyN: 0 });
const add = (b, q, truth) => { b.n++; if (q.letters.includes(truth)) b.inside++; if (q.likely) { b.likelyN++; if (q.likely === truth) b.likely++; } };

export function validate(dir = path.join(here, '../assets/greece-r20261030')) {
  const items = [];
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-'))) for (const raw of JSON.parse(fs.readFileSync(path.join(dir, f))).products) items.push({ raw, p: D.parseProduct({ status: 1, product: raw }, raw.code) });
  const graded = items.filter(x => /^[A-E]$/.test(x.p.nutriScore || '') && D.ns23Inputs(x.p) && Number.isFinite(x.p.nutriScoreValue));
  const r = { catalogue: items.length, published: items.filter(x => /^[A-E]$/.test(x.p.nutriScore || '')).length, graded: graded.length, width: { 1: blank(), 2: blank(), 3: blank() }, none: 0, off: 0, by: {}, hidden: {} };
  for (const x of graded) {
    const q = Q.quickGrade(x.p, { ignoreCategories: true, alcohol: x.raw.nutriments?.alcohol_100g });
    if (!q.ok) { r.none++; continue; }
    add(r.width[q.letters.length], q, x.p.nutriScore);
    if (q.letters.length === 1 && Math.abs(q.letters[0].charCodeAt(0) - x.p.nutriScore.charCodeAt(0)) > 1) r.off++;
    for (const key of [q.via, 'confidence ' + q.confidence, 'basis ' + (x.p.basisSource === 'assumed' ? 'assumed' : 'known')]) add((r.by[key] ||= blank()), q, x.p.nutriScore);
  }
  // one nutrient hidden at a time: salt, sugars, saturated fat
  for (const key of ['salt', 'sugars', 'saturatedFat']) {
    const b = (r.hidden[key] = { n: 0, shown: 0, inside: 0, width: { 1: 0, 2: 0, 3: 0 } });
    for (const x of graded) {
      b.n++; const q = Q.quickGrade({ ...x.p, nutrition: { ...x.p.nutrition, [key]: null } }, { ignoreCategories: true, alcohol: x.raw.nutriments?.alcohol_100g });
      if (!q.ok) continue; b.shown++; b.width[q.letters.length]++; if (q.letters.includes(x.p.nutriScore)) b.inside++;
    }
  }
  const gap = items.filter(x => !/^[A-E]$/.test(x.p.nutriScore || ''));
  r.noGrade = gap.length; r.noGradeWithCore = gap.filter(x => D.ns23Inputs(x.p)).length; r.est = { complete: { 1: 0, 2: 0, 3: 0 }, oneMissing: { 1: 0, 2: 0, 3: 0 } }; r.noNumbers = 0;
  for (const x of gap) { const q = Q.quickGrade(x.p, { alcohol: x.raw.nutriments?.alcohol_100g }); if (q.ok) r.est[q.missingKey ? 'oneMissing' : 'complete'][q.letters.length]++; else if (q.reason === 'inputs-missing' && q.have === 0) r.noNumbers++; }
  return r;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = validate(), pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0') + ' %';
  console.log(`Catalogue ${r.catalogue} products; ${r.published} have a published grade; ${r.noGrade} do not.`);
  console.log(`Graded products with all four core values, categories hidden: ${r.graded}`);
  for (const w of [1, 2, 3]) { const b = r.width[w]; console.log(`  ${w} letter${w > 1 ? 's' : ' '} shown: ${String(b.n).padStart(4)} (${pct(b.n, r.graded).padStart(7)}); Open Food Facts' letter inside: ${pct(b.inside, b.n).padStart(7)}; the "most likely" letter equals it: ${pct(b.likely, b.likelyN)}`); }
  console.log(`  nothing shown (letters span four or five grades): ${r.none} (${pct(r.none, r.graded)}); a single letter two or more steps from the published one: ${r.off}`);
  for (const [k, b] of Object.entries(r.by)) console.log(`    by ${k.padEnd(18)} n ${String(b.n).padStart(4)} inside ${pct(b.inside, b.n).padStart(7)} | most likely exact ${pct(b.likely, b.likelyN).padStart(7)}`);
  for (const [k, b] of Object.entries(r.hidden)) console.log(`  with ${k.padEnd(12)} hidden: shown ${pct(b.shown, b.n)} (1/2/3 letters: ${b.width[1]}/${b.width[2]}/${b.width[3]}), published letter inside the band ${pct(b.inside, b.shown)}`);
  const e = r.est, sum = o => o[1] + o[2] + o[3];
  console.log(`Products with no grade today: ${r.noGrade}; with no nutrition numbers at all: ${r.noNumbers}.`);
  console.log(`  estimate for ${sum(e.complete)} that have all four numbers (1/2/3 letters: ${e.complete[1]}/${e.complete[2]}/${e.complete[3]}) and ${sum(e.oneMissing)} that miss exactly one (${e.oneMissing[1]}/${e.oneMissing[2]}/${e.oneMissing[3]}); total ${sum(e.complete) + sum(e.oneMissing)}.`);
}
