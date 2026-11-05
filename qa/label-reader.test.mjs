/* The label reader: nutrition-table text -> numbers -> Nutri-Score 2023. Text is what Tesseract really returned (or what it returns for the classic confusions:
 * the unit "g" read as 9, a lost decimal point, kJ read as KI), so these tests keep the repairs honest. Accuracy on rendered photos is measured by tools/label-accuracy.cjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const L = await import(pathToFileURL(path.join(ROOT, 'prices/label-reader-v85.mjs')).href);
const D = await import(pathToFileURL(path.join(ROOT, 'assets/domain-v8500.mjs')).href);

// published values of three real products (the same golden cases as score.test.mjs)
const NUTELLA = { kj: 2252, kcal: 538, fat: 30.9, sat: 10.6, carbs: 57.5, sugars: 56.3, fibre: 3.4, protein: 6.3, salt: 0.107 };
const SKYR = { kj: 255, kcal: 61, fat: 0.2, sat: 0.1, carbs: 3.9, sugars: 3.9, fibre: 0, protein: 11, salt: 0.1 };
const num = (v, comma) => { const s = String(v); return comma ? s.replace('.', ',') : s; };
const table = (n, { rows, comma = false, head = 'per 100 g' } = {}) => [head, `${rows[0]} ${n.kj} kJ / ${n.kcal} kcal`, `${rows[1]} ${num(n.fat, comma)} g`, `${rows[2]} ${num(n.sat, comma)} g`, `${rows[3]} ${num(n.carbs, comma)} g`, `${rows[4]} ${num(n.sugars, comma)} g`, `${rows[5]} ${num(n.fibre, comma)} g`, `${rows[6]} ${num(n.protein, comma)} g`, `${rows[7]} ${num(n.salt, comma)} g`].join('\n');
const ROWS = {
  en: ['Energy', 'Fat', 'of which saturates', 'Carbohydrate', 'of which sugars', 'Fibre', 'Protein', 'Salt'],
  el: ['Ενέργεια', 'Λιπαρά', 'εκ των οποίων κορεσμένα', 'Υδατάνθρακες', 'εκ των οποίων σάκχαρα', 'Φυτικές ίνες', 'Πρωτεΐνες', 'Αλάτι'],
  fr: ['Énergie', 'Matières grasses', 'dont acides gras saturés', 'Glucides', 'dont sucres', 'Fibres alimentaires', 'Protéines', 'Sel'],
  de: ['Brennwert', 'Fett', 'davon gesättigte Fettsäuren', 'Kohlenhydrate', 'davon Zucker', 'Ballaststoffe', 'Eiweiß', 'Salz'],
  it: ['Energia', 'Grassi', 'di cui acidi grassi saturi', 'Carboidrati', 'di cui zuccheri', 'Fibre', 'Proteine', 'Sale'],
  es: ['Valor energético', 'Grasas', 'de las cuales saturadas', 'Hidratos de carbono', 'de los cuales azúcares', 'Fibra alimentaria', 'Proteínas', 'Sal'],
};
const same = (got, want) => { for (const k of Object.keys(want)) assert.ok(got[k] != null && Math.abs(got[k] - want[k]) < 1e-9, `${k}: got ${got[k]}, want ${want[k]}`); };

for (const lang of Object.keys(ROWS)) test(`a clean ${lang} table is read exactly and the numbers fit each other`, () => {
  const r = L.readLabel(table(NUTELLA, { rows: ROWS[lang], comma: lang !== 'en' }));
  same(r.values, NUTELLA); assert.equal(r.consistent, true); assert.deepEqual(r.corrections, []); assert.equal(r.basis, '100g');
});

test('the same table on one line (OCR without line breaks) is read the same way', () => {
  const r = L.readLabel(table(NUTELLA, { rows: ROWS.en }).replace(/\n/g, ' '));
  same(r.values, NUTELLA);
});

test('the unit g read as a digit is repaired, and the repair is reported', () => {
  const r = L.readLabel(`per 100 g
Energy 2252 kJ / 538 kcal
Fat 30.99
of which saturates 10,69
Carbohydrate 57.59
of which sugars 56,39
Fibre 3.49
Protein 6.39
Salt 0.107 g`);
  same(r.values, NUTELLA); assert.equal(r.consistent, true);
  assert.deepEqual(r.corrections.map(c => c.field).sort(), ['carbs', 'fat', 'fibre', 'protein', 'sat', 'sugars']);
  for (const c of r.corrections) assert.equal(r.flags[c.field], 'repaired');
});

test('a "/" read for the decimal point and a trailing g read as 9 ("2/69") become 2.6', () => {
  const r = L.readLabel(`per 100 g
Energy 1100 kJ / 263 kcal
Fat 9 g
of which saturates 3 g
Carbohydrate 31 g
of which sugars 2/69
Fibre 2 g
Protein 12 g
Salt 0.5 g`);
  assert.equal(r.values.sugars, 2.6);
});

test('a lost decimal point is restored only when the numbers cannot otherwise fit: sugars 44 g in 9.7 g of carbohydrate becomes 4.4 g', () => {
  const r = L.readLabel(`pour 100 g
Energie 250 kJ / 60 kcal
Matières grasses 1,8 g
dont acides gras saturés 0,3 g
Glucides 9,7 g
dont sucres 44 g
Fibres alimentaires 0,6 g
Protéines 0,8 g
Sel 0,34 g`);
  assert.equal(r.values.sugars, 4.4); assert.equal(r.consistent, true);
});

test('energy units the OCR garbled (KI for kJ, kcaB for kcal) still give the first column, not the serving column', () => {
  const r = L.readLabel(`per 100 g per serving
Energy 1109 ΚΙ / 265 kcaB33 ΚΙ / 80 kcal
Fat 22 g 6.6 g
of which saturates 14 g 4.2 g
Carbohydrate 0.9 g 0.3 g
of which sugars 0.2 g 0.1 g
Fibre 0.9 g 0.3 g
Protein 16 g 4.8 g
Salt 1.42 g 0.4 g`);
  assert.equal(r.values.kj, 1109); assert.equal(r.values.fat, 22); assert.equal(r.values.salt, 1.42);
});

test('when the header names the serving first, the second column is the one per 100 g', () => {
  const r = L.readLabel(`per serving (30 g) per 100 g
Energy 676 kJ / 161 kcal 2252 kJ / 538 kcal
Fat 9.3 g 30.9 g
of which saturates 3.2 g 10.6 g
Carbohydrate 17.3 g 57.5 g
of which sugars 16.9 g 56.3 g
Fibre 1.0 g 3.4 g
Protein 1.9 g 6.3 g
Salt 0.03 g 0.107 g`);
  assert.equal(r.values.kj, 2252); assert.equal(r.values.fat, 30.9);
});

test('a label printed per serving only is recognised as such and scaled with the serving size the shopper gives', () => {
  const r = L.readLabel(`Serving size 30 g
Energy 676 kJ / 161 kcal
Fat 9.3 g
of which saturates 3.2 g
Carbohydrate 17.3 g
of which sugars 16.9 g
Fibre 1.0 g
Protein 1.9 g
Salt 0.03 g`);
  assert.equal(r.basis, 'serving');
  const per = L.perHundred(r.values, 30);
  assert.equal(per.kj, 2253); assert.equal(per.sat, 10.67);
});

test('one unreadable row between two readable ones is placed by the EU row order and marked inferred', () => {
  const r = L.readLabel(`per 100 g
Energy 1109 kJ / 265 kcal
Fat 22 g
of which saturates 14 g
Carbohydrate 0.9 g
??? 0.2 g
Fibre 0.9 g
Protein 16 g
Salt 1.42 g`);
  assert.equal(r.values.sugars, 0.2); assert.equal(r.flags.sugars, 'inferred');
});

test('nothing is invented: text with no nutrition table gives no numbers and no grade', () => {
  const r = L.readLabel('Best before end: see lid\nStore in a cool, dry place\nIngredients: wheat flour, water, salt');
  assert.equal(r.values.sugars, null); assert.equal(r.values.sat, null); assert.equal(r.consistent, false);
  assert.equal(L.gradeFromLabel(r.values).ok, false);
});

test('numbers that cannot fit together are flagged, never presented as verified', () => {
  const r = L.readLabel(`per 100 g
Energy 300 kJ / 72 kcal
Fat 40 g
of which saturates 20 g
Carbohydrate 30 g
of which sugars 20 g
Fibre 1 g
Protein 20 g
Salt 1 g`);
  assert.equal(r.consistent, false); assert.ok(Object.keys(r.flags).length > 0);
});

test('sodium (US/UK style) becomes salt = sodium x 2.5', () => {
  const r = L.readLabel(`per 100 g
Energy 255 kJ / 61 kcal
Fat 0.2 g
Saturated fat 0.1 g
Carbohydrate 3.9 g
Sugars 3.9 g
Protein 11 g
Sodium 40 mg`);
  assert.equal(r.values.salt, 0.1);
});

/* ---------- rows rebuilt from word boxes ---------- */
const W = (text, x0, y0, extra = {}) => ({ text, bbox: { x0, y0, x1: x0 + 10 * text.length, y1: y0 + 20 }, ...extra });
test('a column of labels followed by a column of numbers is put back into rows', () => {
  const words = [W('Fat', 10, 100), W('of', 10, 140), W('which', 40, 140), W('saturates', 90, 140), W('Carbohydrate', 10, 180), W('of', 10, 220), W('which', 40, 220), W('sugars', 90, 220), W('Salt', 10, 260), W('Energy', 10, 60),
    W('1109', 400, 60), W('kJ', 460, 60), W('/', 490, 60), W('265', 510, 60), W('kcal', 560, 60), W('22', 400, 100), W('g', 440, 100), W('14', 400, 140), W('g', 440, 140), W('0.9', 400, 180), W('g', 460, 180), W('0.2', 400, 220), W('g', 460, 220), W('1.42', 400, 260), W('g', 460, 260)];
  const rows = L.rowsFromWords(words).split('\n');
  assert.equal(rows.length, 6); assert.match(rows[0], /Energy 1109 kJ \/ 265 kcal/); assert.match(rows[2], /of which saturates 14 g/);
  const r = L.readLabel(rows.join('\n'));
  assert.equal(r.values.fat, 22); assert.equal(r.values.sat, 14); assert.equal(r.values.salt, 1.42);
});

test('the engine\'s second choice for the last character ("9" or "g") turns "9.19" into "9.1 g"', () => {
  const sym = (t, c) => ({ text: t, choices: c });
  const unit = (text, alt, conf) => W(text, 400, 100, { symbols: [...text.slice(0, -1)].map(c => sym(c, [{ text: c, confidence: 90 }])).concat(sym(text.slice(-1), [{ text: text.slice(-1), confidence: 60 }, { text: alt, confidence: conf }])) });
  const label = t => W(t, 10, 100);
  const filler = (y, t, v) => [W(t, 10, y), W(v, 400, y)];
  const rows = L.rowsFromWords([label('Fat'), unit('9.19', 'g', 40), ...filler(140, 'Salt', '0.5 g'), ...filler(180, 'Fibre', '1 g'), ...filler(220, 'Protein', '2 g')]).split('\n');
  assert.equal(rows[0], 'Fat 9.1 g');
  const keep = L.rowsFromWords([label('Fat'), unit('9.19', 'g', 3), ...filler(140, 'Salt', '0.5 g'), ...filler(180, 'Fibre', '1 g'), ...filler(220, 'Protein', '2 g')]).split('\n');
  assert.equal(keep[0], 'Fat 9.19', 'a weak alternative does not change the number');
});

/* ---------- the grade ---------- */
test('golden products: the grade from the label equals the published Nutri-Score 2023 calculation', () => {
  const nutella = L.gradeFromLabel(NUTELLA, { kind: 'general', fvlBand: 'le40' });
  assert.equal(nutella.score, 30); assert.equal(nutella.grade, 'E'); assert.equal(nutella.exact, true);
  const skyr = L.gradeFromLabel(SKYR, { kind: 'general', fvlBand: 'le40' });
  assert.equal(skyr.score, -3); assert.equal(skyr.grade, 'A');
});

test('the grade is exactly the calculator the whole app uses (property test over 400 random labels)', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 400; i++) {
    const n = { kj: Math.round(rnd() * 3400), sugars: Math.round(rnd() * 600) / 10, sat: Math.round(rnd() * 250) / 10, salt: Math.round(rnd() * 400) / 100, fibre: Math.round(rnd() * 120) / 10, protein: Math.round(rnd() * 300) / 10, fat: 30 };
    for (const kind of ['general', 'beverage', 'cheese', 'fat']) {
      const mine = L.gradeFromLabel(n, { kind, fvlBand: 'b60' }), ref = D.ns23Score({ kj: n.kj, sugars: n.sugars, saturatedFat: n.sat, fat: n.fat, salt: n.salt, fibre: n.fibre, protein: n.protein, fvl: 70 }, kind);
      assert.equal(mine.score, ref.score, JSON.stringify([kind, n])); assert.equal(mine.grade, ref.grade);
    }
  }
});

test('what the label does not print is never assumed: missing fibre and protein give a range, not a letter', () => {
  const v = { ...NUTELLA, fibre: null, protein: null };
  const g = L.gradeFromLabel(v, { kind: 'general', fvlBand: 'le40' });
  assert.equal(g.exact, false); assert.deepEqual(g.unknown, { fibre: true, protein: true, fvl: false });
  assert.ok(g.range[0] <= 'E' && g.range[1] >= 'E');
  const water = L.gradeFromLabel({}, { kind: 'water' }); assert.equal(water.grade, 'A');
});

test('a grade needs energy, sugars, saturates and salt; it names what is missing', () => {
  const g = L.gradeFromLabel({ kj: 500, sugars: null, sat: 1, salt: null }, { kind: 'general' });
  assert.equal(g.ok, false); assert.deepEqual(g.missing, ['sugars', 'salt']);
  const fat = L.gradeFromLabel({ kj: 3000, sugars: 0, sat: 14, salt: 0, fat: null }, { kind: 'fat' });
  assert.equal(fat.ok, false); assert.deepEqual(fat.missing, ['fat']);
});

test('an unknown fruit/vegetable share is evaluated over all bands and shown as a range when it matters', () => {
  const v = { kj: 600, sugars: 9, sat: 0.4, salt: 0.1, fibre: 2.5, protein: 1.5, fat: 1 };
  const exact = L.gradeFromLabel(v, { kind: 'general', fvlBand: 'le40' }), unknown = L.gradeFromLabel(v, { kind: 'general', fvlBand: 'unknown' });
  assert.equal(exact.exact, true); assert.equal(unknown.exact, false); assert.ok(unknown.range[0] <= exact.grade && exact.grade <= unknown.range[1]);
});
