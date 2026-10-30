import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogue, domain, ROOT, APP, SUFFIX } from './helpers.mjs';
import { ns23Score, ns23GradeOfScore, ns23Verify, ns23Kinds } from '../src/domain/nutriscore2023.mjs';

const { manifest, records, byCode } = catalogue();
const snapshot = { provider: 'openfoodfacts-daily-export', exportedAt: manifest.exportedAt, revision: manifest.revision, source: manifest.source };
// exactly what src/market-catalogue.mjs hands the grade engine
const parse = (dom, raw) => { const p = dom.parseProduct({ product: raw, fetchedAt: manifest.exportedAt }, String(raw.code)); return p && { ...p, catalogueSnapshot: snapshot }; };

test('2023 tables: published threshold examples', () => {
  // general foods: A <= 0, B 1-2, C 3-10, D 11-18, E >= 19
  assert.deepEqual([0, 1, 2, 3, 10, 11, 18, 19].map(s => ns23GradeOfScore(s)), ['A', 'B', 'B', 'C', 'C', 'D', 'D', 'E']);
  // beverages: no A except water; B <= 2, C 3-6, D 7-9, E >= 10
  assert.deepEqual([-5, 2, 3, 6, 7, 9, 10].map(s => ns23GradeOfScore(s, 'beverage')), ['B', 'B', 'C', 'C', 'D', 'D', 'E']);
  assert.equal(ns23GradeOfScore(40, 'water'), 'A');
  // fats, oils, nuts and seeds: A <= -6, B <= 2
  assert.deepEqual([-6, -5, 2, 3].map(s => ns23GradeOfScore(s, 'fat')), ['A', 'B', 'B', 'C']);
});

test('2023 points: a known general food, a drink with sweetener points, cheese protein rule, red-meat cap', () => {
  // 2000 kJ (6 pts), 20 g sugars (6 pts: >20 needs 6? 20 is not above 20 -> 5), 5 g sat fat (4), 1 g salt (4), fibre 3 g (0), protein 6 g (2)
  const food = ns23Score({ kj: 2000, sugars: 20, saturatedFat: 5, salt: 1, fibre: 3, protein: 6 });
  assert.equal(food.negative.energy, 5); // 2000 is above 335..1675 (5 thresholds) but not 2010
  assert.equal(food.negative.sugars, 5);
  assert.equal(food.score, food.negative.total - food.positive.total);
  // drinks: sweeteners are +4 and protein always counts
  const cola0 = ns23Score({ kj: 4, sugars: 0, saturatedFat: 0, salt: 0.02, sweeteners: 2 }, 'beverage');
  assert.equal(cola0.negative.sweeteners, 4); assert.equal(cola0.grade, 'C');
  // cheese: protein counts even with >= 11 unfavourable points; for a general food it does not
  const args = { kj: 1500, sugars: 0.5, saturatedFat: 18, salt: 2.5, protein: 17 };
  assert.equal(ns23Score(args, 'cheese').positive.counted, true);
  assert.equal(ns23Score(args, 'general').positive.counted, false);
  // red meat caps protein points at 2
  assert.equal(ns23Score({ kj: 500, sugars: 1, saturatedFat: 2, salt: 1, protein: 30, redMeat: true }).positive.protein, 2);
});

test('every table reproduces the points the source published for at least 90% of graded catalogue records', async () => {
  const dom = await domain(), count = {}, bad = [];
  for (const { raw } of records) {
    const p = parse(dom, raw); if (!p?.nutriScore || !Number.isFinite(p.nutriScoreValue)) continue;
    const v = ns23Verify(p); count.total = (count.total || 0) + 1; count[v.status] = (count[v.status] || 0) + 1;
    if (v.status === 'reproduced') count[v.kind] = (count[v.kind] || 0) + 1;
    if (v.status === 'contradicts') bad.push(raw.code);
  }
  assert.ok(count.total > 4000, `graded records ${count.total}`);
  assert.ok(count.reproduced / count.total >= 0.9, `reproduced ${count.reproduced}/${count.total}`);
  for (const kind of ['general', 'beverage', 'cheese', 'fat']) assert.ok(count[kind] > 100, `${kind} reproduced ${count[kind]}`);
  assert.deepEqual(bad, [], 'no published letter may be impossible for its own published points');
});

test('a grade is never invented: ungraded records stay ungraded unless the calculator has every input', async () => {
  const dom = await domain();
  let shownWithoutSourceGrade = 0, invented = [];
  for (const { raw } of records) {
    const p = parse(dom, raw); if (!p) continue;
    const a = dom.assessGrade(p);
    if (!p.nutriScore && a.grade) { shownWithoutSourceGrade++; invented.push(raw.code); }
    if (a.status === 'withheld' || a.status === 'missing') assert.equal(a.grade, null, `${raw.code} shows a grade while ${a.status}`);
    if (a.grade) assert.match(a.grade, /^[A-E]$/);
  }
  assert.deepEqual(invented, []);
  assert.equal(shownWithoutSourceGrade, 0, 'a dated catalogue copy never yields a grade FoodScan calculates itself');
});

test('reproduced grades equal the source grade; contradictory or unreproducible ones never claim a method', async () => {
  const dom = await domain(); const kinds = {};
  for (const { raw } of records) {
    const p = parse(dom, raw); if (!p?.nutriScore) continue;
    const a = dom.assessGrade(p);
    if (a.reproducedByPoints) { assert.equal(a.grade, p.nutriScore, raw.code); assert.equal(a.method, '2023-calculated'); assert.equal(a.status, 'reported', 'the grade is the sources own, reproduced; it is not presented as calculated by FoodScan'); kinds[a.reproducedKind || 'general'] = (kinds[a.reproducedKind || 'general'] || 0) + 1; }
    if (a.status === 'reported' && !p.nutriScoreMethod && !a.reproducedByPoints) assert.equal(a.method, null, `${raw.code}: an unversioned grade must not claim a method`);
  }
  assert.ok(Object.values(kinds).reduce((a, b) => a + b, 0) > 3000);
});

test('real adversarial cases from the shipped catalogue', async () => {
  const dom = await domain(), grade = code => { const r = byCode.get(code); return dom.assessGrade(parse(dom, r.raw)); };
  // kcal 1291 with kJ 312 (units swapped): the record contradicts itself, so it is quarantined with no grade
  const feta = grade('5203735000320'); assert.equal(feta.status, 'withheld'); assert.equal(feta.grade, null);
  // a published grade whose points the record's own nutrition does not reproduce (8 calculated, 13 published) is shown without a method and says why
  const fit = grade('5201415205836'); assert.equal(fit.status, 'reported'); assert.equal(fit.method, null);
  assert.ok(fit.caveats.some(c => /works out to 8 points, not the 13/.test(c)), fit.caveats.join('|'));
  // 48,500 kcal / 100 g: impossible, quarantined, no grade
  const impossible = records.find(r => r.raw.nutriments['energy-kcal_100g'] === 48500);
  if (impossible) assert.equal(dom.assessGrade(parse(dom, impossible.raw)).status, 'withheld');
  // v61 withheld these three: the export mixes ingredient-ESTIMATED nutrients into the label values, so their nutrition no longer reproduces the
  // letter the source graded from the label. The source's own letter is kept, unversioned and out of every "higher grade" claim, with the reason.
  for (const [code, letter, shown] of [['4056489763321', 'D', 10], ['4012359114907', 'B', 0], ['4012359113405', 'D', 10]]) {
    const raw = byCode.get(code).raw, p = parse(dom, raw), a = dom.assessGrade(p);
    assert.equal(p.nutritionEstimated, true, code); assert.equal(a.status, 'reported', code); assert.equal(a.grade, letter); assert.equal(a.method, null);
    assert.ok(a.caveats.some(c => new RegExp('estimated from the ingredient list.*works out to ' + shown + ' points').test(c)), a.caveats.join('|'));
  }
  // ungraded record with an ingredient-estimated panel: no grade is calculated from estimates
  const elite = grade('5201485000201'); assert.equal(elite.status, 'missing'); assert.equal(elite.grade, null);
});

test('one grading engine: the Worker contains byte-identical domain code to the browser module', () => {
  const client = readFileSync(join(APP, 'assets', `domain-${SUFFIX}.mjs`), 'utf8').replace(/\r/g, '');
  const worker = readFileSync(join(APP, '_worker.js'), 'utf8').replace(/\r/g, '');
  const body = client.slice(0, client.indexOf('\nexport {')).trimEnd();
  assert.ok(body.length > 30000);
  assert.ok(worker.includes(body), 'the Worker domain block differs from assets/domain-' + SUFFIX + '.mjs');
  assert.ok(client.includes('ns23Verify') && worker.includes('ns23Verify'));
});
