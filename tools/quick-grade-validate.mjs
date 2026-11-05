#!/usr/bin/env node
/** Measures the quick grade (prices/quick-grade-v85.mjs) against Open Food Facts' own published letters, on every graded product of the bundled Greek catalogue.
 *   node tools/quick-grade-validate.mjs
 * The categories of each graded product are hidden, so the estimate faces the same situation as a product that has none: the table is inferred from the name, the unit
 * and the composition. "Truth" here is the letter Open Food Facts published; it is not independent (Open Food Facts itself falls back to the general table when it has no
 * category, so a juice without a category is graded as a food there). Also reports how many products that show "No grade" today would get an estimate. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const D = await import(path.join(here, '../assets/domain-v8500.mjs'));
const Q = await import(path.join(here, '../prices/quick-grade-v85.mjs'));

export function validate(dir = path.join(here, '../assets/greece-r20261030')) {
  const items = [];
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-'))) for (const raw of JSON.parse(fs.readFileSync(path.join(dir, f))).products) items.push({ raw, p: D.parseProduct({ status: 1, product: raw }, raw.code) });
  const graded = items.filter(x => /^[A-E]$/.test(x.p.nutriScore || '') && D.ns23Inputs(x.p) && Number.isFinite(x.p.nutriScoreValue));
  const r = { graded: graded.length, single: 0, singleRight: 0, two: 0, twoInside: 0, none: 0, off: 0, by: {} };
  for (const x of graded) {
    const q = Q.quickGrade(x.p, { ignoreCategories: true, alcohol: x.raw.nutriments?.alcohol_100g });
    if (!q.ok) { r.none++; continue; }
    for (const key of [q.via, 'basis ' + (x.p.basisSource === 'assumed' ? 'assumed' : 'known'), 'confidence ' + q.confidence]) { const b = (r.by[key] ||= { single: 0, singleRight: 0, two: 0, twoInside: 0 }); if (q.letters.length === 1) { b.single++; if (q.letters[0] === x.p.nutriScore) b.singleRight++; } else { b.two++; if (q.letters.includes(x.p.nutriScore)) b.twoInside++; } }
    if (q.letters.length === 1) { r.single++; if (q.letters[0] === x.p.nutriScore) { r.singleRight++; } else if (Math.abs(q.letters[0].charCodeAt(0) - x.p.nutriScore.charCodeAt(0)) > 1) r.off++; }
    else { r.two++; if (q.letters.includes(x.p.nutriScore)) { r.twoInside++; } }
  }
  const gap = items.filter(x => !/^[A-E]$/.test(x.p.nutriScore || ''));
  r.noGrade = gap.length; r.noGradeWithCore = gap.filter(x => D.ns23Inputs(x.p)).length; r.noGradeSingle = 0; r.noGradeTwo = 0;
  for (const x of gap) { const q = Q.quickGrade(x.p, { alcohol: x.raw.nutriments?.alcohol_100g }); if (q.ok) q.letters.length === 1 ? r.noGradeSingle++ : r.noGradeTwo++; }
  r.catalogue = items.length; r.graded4 = items.filter(x => /^[A-E]$/.test(x.p.nutriScore || '')).length;
  return r;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = validate(), pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0') + ' %';
  console.log(`Catalogue ${r.catalogue} products; ${r.graded4} have a published grade; ${r.noGrade} do not.`);
  console.log(`Graded products with all four core values, categories hidden: ${r.graded}`);
  console.log(`  one letter shown: ${r.single} (${pct(r.single, r.graded)}); the letter equals Open Food Facts' in ${pct(r.singleRight, r.single)}; two or more steps away: ${r.off}`);
  console.log(`  two letters shown: ${r.two} (${pct(r.two, r.graded)}); Open Food Facts' letter is inside in ${pct(r.twoInside, r.two)}`);
  console.log(`  nothing shown (letters span three or more grades, or no table): ${r.none} (${pct(r.none, r.graded)})`);
  for (const [k, b] of Object.entries(r.by)) console.log(`    by ${k.padEnd(18)} one letter ${String(b.single).padStart(4)} right ${pct(b.singleRight, b.single).padStart(7)} | two letters ${String(b.two).padStart(4)} inside ${pct(b.twoInside, b.two).padStart(7)}`);
  console.log(`Products with no grade today: ${r.noGrade}; with energy, sugars, saturates and salt on record: ${r.noGradeWithCore}; they would now show one letter: ${r.noGradeSingle}, two letters: ${r.noGradeTwo} (total ${r.noGradeSingle + r.noGradeTwo}).`);
}
