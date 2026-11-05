/* The quick grade: an estimate for products that have the numbers a grade needs but no confirmed category. These tests pin the rules, the refusals and, on the
 * real Greek catalogue, how well the estimate agrees with the letters Open Food Facts published for 4,103 graded products whose categories are hidden. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const D = await import(pathToFileURL(path.join(ROOT, 'assets/domain-v8500.mjs')).href);
const Q = await import(pathToFileURL(path.join(ROOT, 'prices/quick-grade-v85.mjs')).href);
const V = await import(pathToFileURL(path.join(ROOT, 'tools/quick-grade-validate.mjs')).href);

const prod = ({ name = 'Product', quantity = '200 g', n = {}, extra = {} }) => D.parseProduct({ status: 1, product: { code: '3017620422003', product_name: name, brands: 'Brand', quantity, nutriscore_grade: 'unknown', pnns_groups_1: 'unknown', pnns_groups_2: 'unknown', countries_tags: ['en:greece'],
  nutriments: { 'energy-kj_100g': n.kj, 'energy-kcal_100g': n.kj ? Math.round(n.kj / 4.184) : undefined, fat_100g: n.fat, 'saturated-fat_100g': n.sat, carbohydrates_100g: n.carbs, sugars_100g: n.sugars, proteins_100g: n.protein, salt_100g: n.salt, fiber_100g: n.fibre, 'fruits-vegetables-legumes_100g': n.fvl }, ...extra } }, '3017620422003');
const CRISPS = { kj: 2200, fat: 33, sat: 3.1, carbs: 50, sugars: 0.6, protein: 6, salt: 1.4, fibre: 4, fvl: 0 };

test('which table: the name, the unit and the composition settle it when there is no category', () => {
  const k = p => Q.inferKinds(prod(p));
  assert.deepEqual(k({ name: 'Chocolate biscuits', n: CRISPS }).kinds, ['general']);
  assert.ok(k({ name: 'Φέτα ΠΟΠ', n: { kj: 1100, fat: 21, sat: 14, carbs: 1, sugars: 1, protein: 15, salt: 2.5 } }).kinds.includes('cheese'), 'Greek cheese names match (\\b does not work for Greek)');
  assert.ok(k({ name: 'Kasseri', n: { kj: 1300, fat: 26, sat: 17, carbs: 0.5, sugars: 0.5, protein: 24, salt: 2 } }).kinds.includes('cheese'));
  assert.ok(k({ name: 'Dodoni Light', n: { kj: 900, fat: 15, sat: 9, carbs: 1, sugars: 1, protein: 28, salt: 1.8 } }).kinds.includes('cheese'), 'a cheese the name does not say, found by its composition');
  assert.deepEqual(k({ name: 'Πορτοκαλάδα', quantity: '1 l', n: { kj: 190, fat: 0, sat: 0, carbs: 11, sugars: 10, protein: 0, salt: 0 } }).kinds, ['beverage']);
  assert.deepEqual(k({ name: 'Tomato soup', quantity: '400 ml', n: { kj: 180, fat: 1, sat: 0.3, carbs: 8, sugars: 5, protein: 1, salt: 0.8 } }).kinds, ['general'], 'a soup is a food, even in ml');
  assert.deepEqual(k({ name: 'Extra virgin olive oil', quantity: '500 ml', n: { kj: 3700, fat: 100, sat: 14, carbs: 0, sugars: 0, protein: 0, salt: 0 } }).kinds, ['fat', 'general']);
  assert.deepEqual(k({ name: 'Vanilla ice cream', n: { kj: 900, fat: 11, sat: 7, carbs: 24, sugars: 21, protein: 4, salt: 0.1 } }).kinds, ['general']);
  assert.ok(k({ name: 'Ήπειρος τσάι του βουνού', n: { kj: 10, fat: 0, sat: 0, carbs: 0, sugars: 0, protein: 0, salt: 0 } }).kinds.includes('beverage'));
});

test('one letter when every table and every unreported value agree; two when they do not; nothing past two', () => {
  const nutella = Q.quickGrade(prod({ name: 'Hazelnut cocoa spread', n: { kj: 2252, fat: 30.9, sat: 10.6, carbs: 57.5, sugars: 56.3, protein: 6.3, salt: 0.107 } }));
  assert.equal(nutella.ok, true); assert.deepEqual(nutella.letters, ['E']); assert.equal(nutella.grade, 'E'); assert.equal(nutella.confidence, 'high');
  const bar = Q.quickGrade(prod({ name: 'Protein Bar Banana', n: { kj: 1548, fat: 17, sat: 13, carbs: 31, sugars: 2.6, protein: 30, salt: 0.56, fibre: 7.5 } }));
  assert.deepEqual(bar.letters, ['C', 'D']); assert.equal(bar.grade, null); assert.deepEqual(bar.missing, ['fruit, vegetables and legumes']);
  const wide = Q.quickGrade(prod({ name: 'Mystery', n: { kj: 800, fat: 5, sat: 1.5, carbs: 30, sugars: 9, protein: 5, salt: 0.7 } }));
  assert.ok(wide.ok || wide.reason === 'too-uncertain');
});

test('the estimate is the official calculation: with every input reported it equals ns23Score', () => {
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 300; i++) {
    const n = { kj: Math.round(200 + rnd() * 2800), fat: 10, sat: Math.round(rnd() * 150) / 10, carbs: 40, sugars: Math.round(rnd() * 300) / 10, protein: Math.round(rnd() * 200) / 10, salt: Math.round(rnd() * 200) / 100, fibre: Math.round(rnd() * 100) / 10, fvl: 0 };
    const q = Q.quickGrade(prod({ name: 'Tasty snack', n }));
    if (!q.ok) continue;
    const ref = D.ns23Score({ kj: n.kj, sugars: n.sugars, saturatedFat: n.sat, fat: 10, salt: n.salt, fibre: n.fibre, protein: n.protein, fvl: 0 }, 'general');
    assert.ok(q.letters.includes(ref.grade), `${JSON.stringify(n)}: ${q.letters} vs ${ref.grade}`);
  }
});

test('refusals: missing values are named, estimated nutrition, excluded and exempt products get nothing', () => {
  const noSalt = Q.quickGrade(prod({ name: 'Crackers', n: { ...CRISPS, salt: undefined } }));
  assert.equal(noSalt.ok, false); assert.equal(noSalt.reason, 'inputs-missing'); assert.deepEqual(noSalt.missing, ['salt']); assert.equal(noSalt.have, 3);
  const wine = prod({ name: 'House red', quantity: '750 ml', n: { kj: 340, fat: 0, sat: 0, carbs: 3, sugars: 1, protein: 0, salt: 0 } });
  assert.equal(Q.quickGrade(wine, { alcohol: 12 }).reason, 'exempt', 'alcohol from the source record');
  assert.equal(Q.quickGrade(prod({ name: 'Red wine Merlot', quantity: '750 ml', n: { kj: 340, fat: 0, sat: 0, carbs: 3, sugars: 1, protein: 0, salt: 0 } })).reason, 'exempt', 'alcohol from the name');
  assert.equal(Q.quickGrade(null).ok, false);
});

test('it never contradicts a source grade: products that carry categories use the category tables', () => {
  const milk = Q.quickGrade(prod({ name: 'Fresh milk', quantity: '1 l', n: { kj: 270, fat: 1.5, sat: 1, carbs: 4.8, sugars: 4.8, protein: 3.4, salt: 0.1 }, extra: { categories_tags: ['en:beverages', 'en:milks'] } }));
  assert.equal(milk.via, 'category'); assert.deepEqual(milk.kinds, ['beverage']);
});

test('real catalogue: how the estimate agrees with Open Food Facts on 4,103 graded Greek products (categories hidden)', { timeout: 300000 }, () => {
  const r = V.validate();
  assert.ok(r.graded > 4000);
  assert.ok(r.singleRight / r.single >= 0.92, `one letter right ${(r.singleRight / r.single).toFixed(3)}`);
  assert.ok(r.twoInside / r.two >= 0.94, `two letters inside ${(r.twoInside / r.two).toFixed(3)}`);
  assert.ok((r.single + r.two) / r.graded >= 0.80, 'it should show something for at least 80 % of products that have the numbers');
  assert.ok(r.off / r.single <= 0.03, 'a single letter two or more steps from the published one stays rare');
  assert.ok(r.by['confidence high'].singleRight / r.by['confidence high'].single >= 0.95, 'the high-confidence tier is at least 95 % exact');
  assert.ok(r.noGradeSingle + r.noGradeTwo >= 2300, `products with no grade today that now get an estimate: ${r.noGradeSingle + r.noGradeTwo}`);
});
