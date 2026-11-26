/* 102.1: defects found by auditing 102.0.0 against live Open Food Facts and the bundled Greek price data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read } from './helpers.mjs';
const D = await import(pathToFileURL(path.join(ROOT, 'assets/domain-v106.mjs')).href);
const C = await import(pathToFileURL(path.join(ROOT, 'daily-v98-core.mjs')).href);

const product = (raw, code = '3017620422003') => D.parseProduct({ status: 1, product: { code, product_name: 'x', quantity: '400 g', ...raw } }, code);
const NUTELLA_FR = 'Sucre, huile de palme, NOISETTES 13%, cacao maigre, LAIT écrémé en poudre, LACTOSERUM en poudre, émulsifiants: lécithines [SOJA], vanilline';

test('a cut-short translation does not stand in for the label (Nutella: English "sugar, palm oil", French names all 8)', () => {
  const p = product({ lang: 'en', ingredients_text: 'sugar, palm oil', ingredients_text_en: 'sugar, palm oil', ingredients_text_ab: NUTELLA_FR.toUpperCase(), ingredients_text_fr: NUTELLA_FR });
  assert.equal(p.ingredients, NUTELLA_FR, 'the fullest list, and on a tie the usual label language (fr) over a mislabelled code (ab)');
  assert.match(p.ingredients, /LAIT/); assert.match(p.ingredients, /NOISETTES/); assert.match(p.ingredients, /SOJA/);
});

test('a complete main list is kept, even when another language names one or two more items (Coca-Cola: Spanish 5, Bulgarian 7)', () => {
  const es = 'Agua carbonatada, azúcar, colorante (E-150d), acidulante (ácido fosfórico), aromas naturales (contiene cafeína).';
  const p = product({ lang: 'es', ingredients_text: es, ingredients_text_es: es, ingredients_text_bg: 'вода, захар, въглероден двуокис, оцветител e150d, подкислитель e338, естествени аромати, кофеин' });
  assert.equal(p.ingredients, es);
});

test('Arabic and Chinese list separators are counted, so those lists are not taken for one-item lists', () => {
  const zh = '碳酸水、白砂糖、着色剂（焦糖色 E150d）、酸度调节剂（磷酸）、天然香料、咖啡因香料';
  const p = product({ lang: 'zh', ingredients_text: 'water', ingredients_text_zh: zh });
  assert.equal(p.ingredients, zh, 'six items, not one');
});

const water = (salt) => product({ product_name: 'Spring water', quantity: '500 ml', nutriscore_grade: 'a', categories_tags: ['en:beverages', 'en:waters', 'en:spring-waters', 'en:unsweetened-beverages'],
  nutriments: { 'energy-kcal_100g': 0, 'sugars_100g': 0, 'salt_100g': salt, 'fat_100g': 0, 'carbohydrates_100g': 0, 'proteins_100g': 0 } }, '5449000000996');

test('plain water keeps its A when only a mistyped salt line is impossible (mg per litre typed as mg per 100 ml)', () => {
  const a = D.assessGrade(water(3.45));
  assert.equal(a.grade, 'A');
  assert.ok((a.caveats || []).length >= 1, 'the salt warning stays on the result');
});

test('a flavoured or sweetened water is not let through by the water rule', () => {
  const p = water(3.45); p.categories = [...p.categories, 'en:flavoured-waters']; p.nutrition = { ...p.nutrition, sugars: 4, kcal: 16 };
  assert.notEqual(D.assessGrade(p).grade, 'A');
});

test('the daily intake never multiplies an impossible number into the day', () => {
  const n = C.plausibleNumbers({ salt: 3.45, sugars: 0, kcal: 0 }, true);
  assert.equal(n.salt, null, 'a drink with 3.45 g salt per 100 ml is a typing mistake: "not reported", not 17 g for half a litre');
  assert.equal(C.plausibleNumbers({ salt: 1.8 }, false).salt, 1.8, 'a salty food keeps its real value');
  assert.equal(C.plausibleNumbers({ sugars: 120 }).sugars, null);
  assert.equal(C.plausibleNumbers({ sugars: 20, carbs: 10 }).sugars, null, 'sugars cannot exceed carbohydrates');
  assert.equal(C.plausibleNumbers({ kcal: 950 }).kcal, null);
  assert.equal(C.plausibleNumbers({ kcal: 900 }).kcal, 900, 'pure oil (about 900 kcal) is real');
});

test('the outlier check covers every price source, not only community prices', () => {
  const src = read('src/worker/prices.js');
  assert.doesNotMatch(src, /!o\.id\.startsWith\('op:'\) \|\| o\.otherCurrency/, 'web shop and observatory prices are compared with their peers too');
  assert.match(src, /if \(o\.otherCurrency \|\| o\.packMismatch \|\| o\.basis !== 'item'/);
});
