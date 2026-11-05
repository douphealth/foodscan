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
const U = await import(pathToFileURL(path.join(ROOT, 'prices/grade-ui-v85.mjs')).href);

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

test('one letter when every table and every unreported value agree; a band of two or three when they do not; nothing past three', () => {
  const nutella = Q.quickGrade(prod({ name: 'Hazelnut cocoa spread', n: { kj: 2252, fat: 30.9, sat: 10.6, carbs: 57.5, sugars: 56.3, protein: 6.3, salt: 0.107 } }));
  assert.equal(nutella.ok, true); assert.deepEqual(nutella.letters, ['E']); assert.equal(nutella.grade, 'E'); assert.equal(nutella.confidence, 'high');
  const bar = Q.quickGrade(prod({ name: 'Protein Bar Banana', n: { kj: 1548, fat: 17, sat: 13, carbs: 31, sugars: 2.6, protein: 30, salt: 0.56, fibre: 7.5 } }));
  assert.deepEqual(bar.letters, ['C', 'D']); assert.equal(bar.grade, null); assert.deepEqual(bar.missing, ['fruit, vegetables and legumes']);
  const wide = Q.quickGrade(prod({ name: 'Mystery', n: { kj: 800, fat: 5, sat: 1.5, carbs: 30, sugars: 9, protein: 5, salt: 0.7 } }));
  assert.ok(wide.ok ? wide.letters.length <= 3 : wide.reason === 'too-uncertain');
  assert.equal(bar.likely, 'D', 'the most likely letter counts the unreported favourable nutrients as zero'); assert.equal(bar.score, 11);
  assert.deepEqual(bar.movers.map(m => [m.key, m.becomes]), [['fvl', 'C']], 'what would change it is named');
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

test('one missing number is bounded, never guessed: only a band, no "most likely" letter', () => {
  const noSalt = Q.quickGrade(prod({ name: 'Crackers', n: { ...CRISPS, salt: undefined } }));
  assert.equal(noSalt.ok, true); assert.equal(noSalt.likely, null); assert.equal(noSalt.partialData, true); assert.deepEqual(noSalt.bound, { key: 'salt', label: 'salt', max: 3, how: 'cap' });
  for (const salt of [0, 0.5, 1.5, 3]) { const exact = Q.quickGrade(prod({ name: 'Crackers', n: { ...CRISPS, salt } })); assert.ok(exact.letters.every(l => noSalt.letters.includes(l)), `salt ${salt}: ${exact.letters} inside ${noSalt.letters}`); }
  const noSugars = Q.quickGrade(prod({ name: 'Crackers', n: { ...CRISPS, sugars: undefined } })); assert.equal(noSugars.bound.how, 'carbohydrate'); assert.equal(noSugars.bound.max, 50);
  const noSat = Q.quickGrade(prod({ name: 'Crackers', n: { ...CRISPS, sat: undefined } })); assert.equal(noSat.bound.how, 'fat'); assert.equal(noSat.bound.max, 33);
  assert.equal(Q.quickGrade(prod({ name: 'Crackers', n: { ...CRISPS, sugars: undefined, salt: undefined } })).reason, 'inputs-missing', 'two missing numbers: nothing');
});

test('refusals: estimated nutrition, excluded, exempt and unusable products get nothing', () => {
  const noEnergy = Q.quickGrade(prod({ name: 'Crackers', n: { ...CRISPS, kj: undefined } })); assert.equal(noEnergy.reason, 'inputs-missing'); assert.deepEqual(noEnergy.missing, ['energy']);
  const wine = prod({ name: 'House red', quantity: '750 ml', n: { kj: 340, fat: 0, sat: 0, carbs: 3, sugars: 1, protein: 0, salt: 0 } });
  assert.equal(Q.quickGrade(wine, { alcohol: 12 }).reason, 'exempt', 'alcohol from the source record');
  assert.equal(Q.quickGrade(prod({ name: 'Red wine Merlot', quantity: '750 ml', n: { kj: 340, fat: 0, sat: 0, carbs: 3, sugars: 1, protein: 0, salt: 0 } })).reason, 'exempt', 'alcohol from the name');
  assert.equal(Q.quickGrade(null).ok, false);
});

test('it never contradicts a source grade: products that carry categories use the category tables', () => {
  const milk = Q.quickGrade(prod({ name: 'Fresh milk', quantity: '1 l', n: { kj: 270, fat: 1.5, sat: 1, carbs: 4.8, sugars: 4.8, protein: 3.4, salt: 0.1 }, extra: { categories_tags: ['en:beverages', 'en:milks'] } }));
  assert.equal(milk.via, 'category'); assert.deepEqual(milk.kinds, ['beverage']);
});

test('a label result is the same model: exact when everything is reported, a band with the likely letter when fibre or protein is not', () => {
  const nutella = Q.labelGrade({ kj: 2252, kcal: 538, fat: 30.9, sat: 10.6, carbs: 57.5, sugars: 56.3, fibre: 3.4, protein: 6.3, salt: 0.107 }, { kind: 'general', fvl: 0, fvlText: 'up to 40 %' });
  assert.equal(nutella.source, 'label'); assert.deepEqual(nutella.letters, ['E']); assert.equal(nutella.score, 30); assert.equal(nutella.data.negativePoints, 31);
  const noFibre = Q.labelGrade({ kj: 1100, kcal: 263, fat: 9, sat: 3, carbs: 31, sugars: 5, fibre: null, protein: 12, salt: 0.5 }, { kind: 'general', fvl: 0 });
  assert.ok(noFibre.letters.length >= 1 && noFibre.likely); assert.ok(noFibre.missing.includes('fibre'));
  assert.deepEqual(Q.labelGrade({}, { kind: 'water' }).letters, ['A']);
  assert.equal(Q.labelGrade({ kj: 100, fat: 0, sat: 0, carbs: 5, sugars: 5, protein: 0, salt: 0 }, { kind: 'beverage', sweeteners: true }).kind, 'beverage');
});

test('the card says everything: the method, every number with its points, what is unreported, why it is an estimate, where the data comes from, how reliable it is, and what it is not', () => {
  const bar = Q.quickGrade(prod({ name: 'Protein Bar Banana', n: { kj: 1548, fat: 17, sat: 13, carbs: 31, sugars: 2.6, protein: 30, salt: 0.56, fibre: 7.5 } }));
  for (const lang of ['en', 'el']) {
    const html = U.gradeHTML(bar, { lang, kind: 'estimate', code: '3017620422003', modified: Date.UTC(2026, 9, 28), snapshot: true, actions: true });
    assert.ok(!/undefined|NaN|\[object/.test(html), `${lang}: no broken placeholders`);
    assert.ok(html.includes('Nutri-Score 2023'), 'names the method');
    for (const v of ['2.6', '13', '0.56', '7.5', '30']) assert.ok(html.includes(v.replace('.', lang === 'el' ? ',' : '.')), `${lang}: shows ${v}`);
    for (const part of bar.data.negative.concat(bar.data.positive)) assert.ok(html.includes(`${part.points}</`) || html.includes(`${part.points}<small>`), `${lang}: points of ${part.id}`);
    assert.ok(html.includes('3017620422003') && html.includes('fg85__foot'), 'source and barcode');
    assert.ok(html.includes('data-fr="file"'), 'a way to check against the label');
  }
  const en = U.gradeHTML(bar, { lang: 'en', kind: 'estimate' });
  assert.match(en, /official Nutri-Score 2023 algorithm/); assert.match(en, /nutritional facts as recorded in Open Food Facts/); assert.match(en, /not a grade printed on the pack/);
  assert.match(en, /Most likely D/); assert.match(en, /Not reported/); assert.match(en, /more than 40 % of it is fruit/); assert.match(en, /How reliable is this kind of estimate/);
  const label = U.gradeHTML(Q.labelGrade({ kj: 2252, kcal: 538, fat: 30.9, sat: 10.6, carbs: 57.5, sugars: 56.3, fibre: 3.4, protein: 6.3, salt: 0.107 }, { kind: 'general', fvl: 0 }), { lang: 'en', kind: 'label' });
  assert.match(label, /numbers you confirmed against the label/); assert.ok(!/How reliable is this kind of estimate/.test(label), 'an exact grade makes no reliability claim');
  const band = U.gradeHTML(Q.quickGrade(prod({ name: 'Crackers', n: { ...CRISPS, salt: undefined } })), { lang: 'en', kind: 'estimate' });
  assert.match(band, /assumed at most 3 g/); assert.match(band, /Between/); assert.ok(!/Most likely/.test(band), 'a band with an unreported unfavourable nutrient has no most-likely letter');
});

test('gauge: the marker sits inside the segment of its own letter', () => {
  const ladder = Q.ladder('general');
  for (const [score, letter] of [[-3, 'A'], [0, 'A'], [1, 'B'], [2, 'B'], [3, 'C'], [10, 'C'], [11, 'D'], [18, 'D'], [19, 'E'], [30, 'E']]) {
    const pos = U.gaugePosition(score, ladder), i = 'ABCDE'.indexOf(letter);
    assert.ok(pos >= i / 5 - 1e-9 && pos <= (i + 1) / 5 + 1e-9, `${score} -> ${letter}: ${pos}`);
  }
  assert.ok(U.gaugePosition(5, ladder) < U.gaugePosition(9, ladder), 'monotonic inside a segment');
});

test('real catalogue: how the estimate agrees with Open Food Facts on 4,103 graded Greek products (categories hidden)', { timeout: 600000 }, () => {
  const r = V.validate(), W = r.width, ratio = (a, b) => a / b;
  assert.ok(r.graded > 4000);
  assert.ok(ratio(W[1].inside, W[1].n) >= 0.92, `one letter right ${ratio(W[1].inside, W[1].n).toFixed(3)}`);
  assert.ok(ratio(W[2].inside, W[2].n) >= 0.94, `two letters inside ${ratio(W[2].inside, W[2].n).toFixed(3)}`);
  assert.ok(ratio(W[3].inside, W[3].n) >= 0.94, `three letters inside ${ratio(W[3].inside, W[3].n).toFixed(3)}`);
  assert.ok((W[1].n + W[2].n + W[3].n) / r.graded >= 0.88, 'it shows something for at least 88 % of products that have the four numbers');
  assert.ok(r.off / W[1].n <= 0.03, 'a single letter two or more steps from the published one stays rare');
  // the percentages the card prints are floors of what was measured
  for (const tier of ['high', 'medium', 'low']) {
    const b = r.by['confidence ' + tier]; assert.ok(b, tier);
    assert.ok(100 * b.inside / b.n >= U.RELIABILITY.inside[tier], `${tier}: printed ${U.RELIABILITY.inside[tier]} % but measured ${(100 * b.inside / b.n).toFixed(1)} %`);
    assert.ok(100 * b.likely / b.likelyN >= U.RELIABILITY.likely[tier], `${tier} most likely: printed ${U.RELIABILITY.likely[tier]} % but measured ${(100 * b.likely / b.likelyN).toFixed(1)} %`);
  }
  assert.equal(U.RELIABILITY.sample, r.graded, 'the sample size the card prints is the one measured');
  for (const key of ['salt', 'sugars', 'saturatedFat']) { const h = r.hidden[key]; assert.ok(h.inside / h.shown >= 0.92, `${key} hidden: band contains the published letter ${(h.inside / h.shown).toFixed(3)}`); }
  const total = [1, 2, 3].reduce((n, w) => n + r.est.complete[w] + r.est.oneMissing[w], 0);
  assert.ok(total >= 3400, `products with no grade today that now get an estimate: ${total}`);
});
