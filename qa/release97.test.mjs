/* 97: Nutri-Score 2023 table fixes taken from the owner's 97.0.0, checked against the 2023 rules on real catalogue records:
 * plain waters are A; a "water" with sugar is a sweetened drink, never A; chicken and turkey are not red meat. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers.mjs';
const D = await import(pathToFileURL(path.join(ROOT, 'assets/domain-v104.mjs')).href), Q = await import(pathToFileURL(path.join(ROOT, 'prices/quick-grade-v85.mjs')).href);
const dir = path.join(ROOT, 'assets/greece-r20261030'), byCode = new Map();
for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-'))) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f))).products) byCode.set(String(r.code), r);
/** what the page shows when the record carries no grade of its own: the engine's grade, else the quick grade (a letter, or the band) */
function pageGrade(code) {
  const raw = { ...byCode.get(code) }; assert.ok(raw.code, code + ' is in the catalogue'); delete raw.nutriscore_grade; delete raw.nutriscore_score;
  const p = D.parseProduct({ status: 1, product: raw }, raw.code), a = D.assessGrade(p); if (/^[A-E]$/i.test(a.grade || '')) return a.grade.toUpperCase();
  const q = Q.quickGrade(p, { alcohol: raw.nutriments?.alcohol_100g }); return q.ok ? (q.grade || (q.letters || []).join('')) : '-';
}
test('plain waters (0 kcal, no sugar) are graded A, as Nutri-Score 2023 sets for water', () => {
  for (const code of ['20560850', '5201258750203', '5201599000012', '5201875001504', '5942326400018']) assert.equal(pageGrade(code), 'A', code);
});
test('a product tagged as mineral water but with sugar is a sweetened drink: never A', () => {
  for (const code of ['5201946900798', '5942326401930']) assert.ok(!pageGrade(code).startsWith('A'), code + ' got ' + pageGrade(code));
});
test('chicken and turkey are not red meat: the grade is no longer widened by the red-meat rule', () => {
  for (const [code, want] of [['5201310000956', 'A'], ['4056489602422', 'A'], ['5201310001205', 'A']]) assert.equal(pageGrade(code), want, code);
});
