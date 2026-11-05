/* Nutri-Score 2023 conformance. The expected values below are the reference implementation's (Open Food Facts, ProductOpener::Nutriscore,
 * compute_nutriscore_score_2023: tables, and "count_proteins": beverage -> yes; cheese -> yes; fats, oils, nuts, seeds -> only if negative points < 7;
 * everything else -> only if negative points < 11). There is NO fruit/vegetable exception in 2023 (it was a 2017 rule, which FoodScan 83 still applied). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers.mjs';

const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/domain/nutriscore2023.js'), 'utf8') + '\nthis.ns23Score = ns23Score; this.ns23TH = ns23TH;', ctx);
const client = await import(pathToFileURL(path.join(ROOT, 'assets/domain-v8400.mjs')).href);

test('the 2023 point tables are exactly the reference implementation\'s', () => {
  const T = ctx.ns23TH, same = (a, b) => assert.deepEqual([...a], b);
  same(T.energy, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]); same(T.energyBev, [30, 90, 150, 210, 240, 270, 300, 330, 360, 390]);
  same(T.sugars, [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51]); same(T.sugarsBev, [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11]);
  same(T.saturatedFat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); same(T.salt.map(x => Math.round(x * 10) / 10), [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4]);
  same(T.energySat, [120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200]); same(T.satRatio, [10, 16, 22, 28, 34, 40, 46, 52, 58, 64]);
  same(T.fvl, [40, 60, 80, 80, 80]); same(T.fvlBev, [40, 40, 60, 60, 80, 80]); same(T.fibre, [3, 4.1, 5.2, 6.3, 7.4]);
  same(T.protein, [2.4, 4.8, 7.2, 9.6, 12, 14, 17]); same(T.proteinBev, [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3]);
});
test('protein is NOT counted at 11+ negative points even with 80%+ fruit/vegetables (general foods)', () => {
  const r = ctx.ns23Score({ kj: 2000, sugars: 30, saturatedFat: 0.5, salt: 0.1, fibre: 0, protein: 10, fvl: 90 }, 'general');
  assert.equal(r.negative.total, 13); assert.equal(r.positive.counted, false); assert.equal(r.score, 13 - 5); assert.equal(r.grade, 'C');
});
test('protein IS counted just under the limit (10 negative points) and at 11 exactly it is not', () => {
  const at = (kj, sugars) => ctx.ns23Score({ kj, sugars, saturatedFat: 0, salt: 0, protein: 8, fvl: 0 }, 'general');
  const ten = at(2010 /* 5 */, 17.1 /* 5 */), eleven = at(2345.1 /* 7 */, 17.1 /* 5 */); // 5+5=10 ; 7+5=12
  assert.equal(ten.negative.total, 10); assert.equal(ten.positive.counted, true);
  assert.ok(eleven.negative.total >= 11); assert.equal(eleven.positive.counted, false);
});
test('fats, oils, nuts and seeds: protein not counted at 7+ negative points, whatever the fruit/vegetable share', () => {
  const r = ctx.ns23Score({ kj: 3700, sugars: 0, saturatedFat: 30, fat: 100, salt: 0, protein: 5, fvl: 100 }, 'fat');
  assert.ok(r.negative.total >= 7); assert.equal(r.positive.counted, false);
});
test('cheese and drinks always count protein', () => {
  assert.equal(ctx.ns23Score({ kj: 1600, sugars: 1, saturatedFat: 16, salt: 1.8, protein: 25, fvl: 0 }, 'cheese').positive.counted, true);
  assert.equal(ctx.ns23Score({ kj: 400, sugars: 12, saturatedFat: 0, salt: 0.1, protein: 3.4, fvl: 0 }, 'beverage').positive.counted, true);
});
test('the browser engine gives the same answer as the worker engine on the protein rule (a dried fruit that sits on a letter boundary)', () => {
  // negative: energy 1700 kJ -> 5, sugars 45 g -> 13 = 18; positive: fibre 4.5 g -> 2, fruit/veg 90 % -> 5 (protein 3 g would add 1 under the 2017 rule)
  const rec = { status: 1, product: { code: '3017620422003', product_name: 'Dried fruit mix', quantity: '200 g', nutrition_data_per: '100g', categories_tags: ['en:plant-based-foods-and-beverages', 'en:dried-fruits'], ingredients_text: 'dried apricots, raisins',
    nutriments: { 'energy-kj_100g': 1700, 'energy-kcal_100g': 406, fat_100g: 0.4, 'saturated-fat_100g': 0.2, carbohydrates_100g: 85, sugars_100g: 45, fiber_100g: 4.5, proteins_100g: 3, salt_100g: 0.05, sodium_100g: 0.02, 'fruits-vegetables-legumes-estimate-from-ingredients_100g': 90 } } };
  const a = client.assessGrade(client.parseProduct(rec, '3017620422003'));
  assert.equal(a.score, 11, JSON.stringify(a)); assert.equal(a.grade, 'D'); // 2017 rule would have given 10 = C
  const w = ctx.ns23Score({ kj: 1700, sugars: 45, saturatedFat: 0.2, salt: 0.05, fibre: 4.5, protein: 3, fvl: 90 }, 'general');
  assert.equal(w.score, 11); assert.equal(w.grade, 'D');
});
test('a source grade whose core label values are missing is flagged unverified and never shown with more than low confidence', () => {
  const rec = { status: 1, product: { code: '3017620422003', product_name: 'x', quantity: '100 g', nutrition_data_per: '100g', categories_tags: ['en:snacks'], nutriscore_grade: 'b', nutriscore_score: 1, nutriscore_version: '2023', ingredients_text: 'x',
    nutriments: { 'energy-kj_100g': 800, 'energy-kcal_100g': 190, fat_100g: 5, carbohydrates_100g: 20, sugars_100g: 3, proteins_100g: 5, fiber_100g: 2 } } }; // saturated fat and salt absent
  const a = client.assessGrade(client.parseProduct(rec, '3017620422003'));
  assert.ok(a.grade); assert.equal(a.confidence, 'low'); assert.equal(a.unverified, true); assert.deepEqual(a.missingInputs, ['saturated fat', 'salt']);
  assert.match(a.caveats[0], /Unverified grade: the record is missing saturated fat, salt/);
});
