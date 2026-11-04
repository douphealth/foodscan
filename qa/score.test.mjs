/* Nutri-Score 2023 golden cases: each expected score is worked out by hand from the published tables (Santé publique France 2023),
 * then compared with FoodScan's calculator. A change to any threshold, cap or table fails here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const { parseProduct, assessGrade } = await import(pathToFileURL(path.join(ROOT, 'assets/domain-v8100.mjs')).href);
const grade = (cats, ing, n, name = 'x') => assessGrade(parseProduct({ status: 1, product: { code: '3017620422003', product_name: name, quantity: '500 g', nutrition_data_per: '100g', categories_tags: cats, ingredients_text: ing,
  nutriments: { 'energy-kcal_100g': Math.round((n.kj || 0) / 4.184), 'energy-kj_100g': n.kj || 0, fat_100g: n.fat || 0, 'saturated-fat_100g': n.sat || 0, carbohydrates_100g: n.carbs ?? n.sugars ?? 0, sugars_100g: n.sugars || 0, fiber_100g: n.fibre || 0, proteins_100g: n.protein || 0, salt_100g: n.salt || 0, sodium_100g: (n.salt || 0) / 2.5, 'fruits-vegetables-legumes-estimate-from-ingredients_100g': n.fvl || 0 } } }, '3017620422003'));

/** General foods: FoodScan calculates the exact score itself. */
const GENERAL = [
  ['Nutella: energy 6 + sugars 15 + saturates 10 + salt 0 = 31; fibre 1; protein not counted (N >= 11) -> 30', ['en:spreads', 'en:sweet-spreads'], 'sugar, palm oil, hazelnuts, cocoa', { kj: 2252, fat: 30.9, sat: 10.6, sugars: 56.3, fibre: 3.4, protein: 6.3, salt: 0.107 }, 30, 'E'],
  ['0 % skyr: sugars 1; protein 4 -> -3', ['en:dairies', 'en:fermented-milk-products', 'en:yogurts'], 'skimmed milk, cultures', { kj: 255, fat: 0.2, sat: 0.1, sugars: 3.9, protein: 11, salt: 0.1 }, -3, 'A'],
  ['white bread: energy 3 + salt 4 = 7; protein 3 (N < 11 so it counts) -> 4', ['en:breads', 'en:white-breads'], 'wheat flour, water, salt, yeast', { kj: 1060, fat: 3, sat: 0.7, sugars: 3.0, fibre: 2.7, protein: 8, salt: 1.0 }, 4, 'C'],
];
for (const [label, cats, ing, n, score, letter] of GENERAL) test(label, () => {
  const a = grade(cats, ing, n);
  assert.equal(a.score, score, `score (${JSON.stringify(a.scoreRange)})`); assert.equal(a.grade, letter);
});

/** Drinks and fats follow their own tables. FoodScan does not invent a grade for them: it VERIFIES the points the source published against the
 *  hand-computed ones, and withholds a grade that cannot follow from them. */
const published = (cats, ing, n, g, score) => assessGrade(parseProduct({ status: 1, product: { code: '3017620422003', product_name: 'x', quantity: '500 ml', nutrition_data_per: '100g', categories_tags: cats, ingredients_text: ing, nutriscore_grade: g, nutriscore_score: score, nutriscore_version: '2023',
  nutriments: { 'energy-kcal_100g': Math.round((n.kj || 0) / 4.184), 'energy-kj_100g': n.kj || 0, fat_100g: n.fat || 0, 'saturated-fat_100g': n.sat || 0, carbohydrates_100g: n.sugars || 0, sugars_100g: n.sugars || 0, fiber_100g: 0, proteins_100g: n.protein || 0, salt_100g: n.salt || 0, sodium_100g: (n.salt || 0) / 2.5, 'fruits-vegetables-legumes-estimate-from-ingredients_100g': 0 } } }, '3017620422003'));
const COLA = { kj: 180, sugars: 10.6, salt: 0.01 }, COLA_CATS = ['en:beverages', 'en:sodas', 'en:colas'], COLA_ING = 'carbonated water, sugar, colour, acid, flavourings';
test('cola (drinks table): energy 3 + sugars 9 = 12 is reproduced; 11 is not; a D contradicts 12', () => {
  const ok = published(COLA_CATS, COLA_ING, COLA, 'e', 12); assert.equal(ok.grade, 'E'); assert.equal(ok.method, '2023-calculated'); assert.equal(ok.score, 12);
  assert.notEqual(published(COLA_CATS, COLA_ING, COLA, 'e', 11).method, '2023-calculated');
  const bad = published(COLA_CATS, COLA_ING, COLA, 'd', 12); assert.equal(bad.status, 'withheld'); assert.equal(bad.grade, null);
});
test('butter (fats table): energy from saturates 1887 kJ -> 10, saturates/lipids 62 % -> 9 = 19 (E)', () => {
  const a = published(['en:fats', 'en:animal-fats', 'en:dairy-fats', 'en:butters'], 'cream, salt', { kj: 3000, fat: 82, sat: 51, protein: 0.7, salt: 0.02 }, 'e', 19);
  assert.equal(a.grade, 'E'); assert.equal(a.method, '2023-calculated'); assert.equal(a.score, 19);
});
test('a drink with sweeteners: 4 points (energy 0, sugars 0) -> 4 = C', () => {
  const a = published(['en:beverages', 'en:sodas', 'en:diet-sodas'], 'carbonated water, colour, acid, sweeteners (aspartame, acesulfame k), flavourings', { kj: 1, salt: 0.01 }, 'c', 4);
  assert.equal(a.grade, 'C'); assert.equal(a.method, '2023-calculated'); assert.equal(a.score, 4);
});
test('drinks: only water is A; a contradictory A on cola is withheld', () => {
  assert.equal(published(COLA_CATS, COLA_ING, COLA, 'a', 12).status, 'withheld');
});
