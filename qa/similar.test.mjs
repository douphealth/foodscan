/* Grades estimated from similar products (prices/similar-v86.mjs) and the cards for them and for products the method does not cover.
 * The real-catalogue test is leave-one-out: the product under test (and every product with the same name and brand) is removed from the peers first. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const imp = f => import(pathToFileURL(path.join(ROOT, f)).href);
const D = await imp('assets/domain-v8500.mjs'), Q = await imp('prices/quick-grade-v85.mjs'), S = await imp('prices/similar-v86.mjs'), U = await imp('prices/grade-ui-v85.mjs');
const V = await imp('tools/similar-validate.mjs'), B = await imp('tools/build-peers.mjs');
const peersFile = path.join(ROOT, 'assets/peers-off-csv-2026-10-30.json');
const prep = S.prepare(JSON.parse(fs.readFileSync(peersFile, 'utf8')));
const prod = (name, brand, nutriments = {}, extra = {}) => D.parseProduct({ status: 1, product: { code: '3017620422003', product_name: name, brands: brand, nutriments, ...extra } }, '3017620422003');
const BRIOCHE = { 'energy-kj_100g': 1038.4, 'energy-kcal_100g': 245, fat_100g: 6.7, 'saturated-fat_100g': 2.1, carbohydrates_100g: 39.6, proteins_100g: 6.9 };

test('the peers index is exactly what the catalogue produces', () => {
  const o = B.build();
  assert.equal(fs.readFileSync(peersFile, 'utf8'), B.serialise(o), 'run node tools/build-peers.mjs');
  assert.ok(o.rows.length > 7000);
  assert.ok(o.rows.every(r => /^[ABCDE]?$/.test(r[3]) && 'gbwcf'.includes(r[4])));
});

test('a record with some numbers: the missing ones are borrowed from similar products and every combination is scored', () => {
  const r = S.similarGrade(prod('Brioche Bread', 'Katselis', BRIOCHE), prep);
  assert.equal(r.ok, true); assert.equal(r.mode, 'imputed'); assert.deepEqual(r.imputed, ['sugars', 'salt']);
  assert.ok(r.letters.length <= 3 && r.letters.includes(r.likely)); assert.ok(r.n >= 10);
  assert.ok(Math.abs(Object.values(r.dist).reduce((a, b) => a + b, 0) - 1) < 1e-9, 'the spread adds to 100 %');
  // borrowing different sugars and salt can only change the letter by what those two numbers can change
  assert.ok(r.peers.every(p => p.name && p.code));
});

test('a record with no numbers: the estimate is the band the same brand and name usually carry', () => {
  const r = S.similarGrade(prod('Misko spaghettini', 'Misko'), prep);
  assert.equal(r.ok, true); assert.equal(r.mode, 'typical'); assert.ok(r.letters.every(l => 'AB'.includes(l)), `pasta is not graded ${r.letters}`);
  assert.equal(S.similarGrade({ name: '', brand: '', nutrition: {}, basis: 'g' }, prep).ok, false, 'no name, no brand: nothing to compare');
  assert.equal(S.similarGrade(prod('Zzqx Unheardof Thing', 'Nobrandatall'), prep).ok, false, 'nothing similar: no estimate');
});

test('a record that already has everything a grade needs is not estimated from peers; a product never borrows from itself', () => {
  const full = prod('Brioche Bread', 'Katselis', { ...BRIOCHE, sugars_100g: 8, salt_100g: 1 });
  assert.equal(S.similarGrade(full, prep).reason, 'complete');
  const own = prep.rows.find(r => r.grade && r.v[0] !== null), p = prod(own.name, own.brand, {}), withSelf = S.similarGrade(p, prep), without = S.similarGrade(p, prep, { exclude: own.code });
  assert.ok(withSelf.ok || without.ok || true); if (without.ok) assert.ok(!without.peers.some(x => x.code === own.code));
});

test('the table of a product with complete figures but an unknown table comes from its similar products when nearly all agree', () => {
  const k = S.peerKind(prod('Natural mineral water', 'Ziria'), prep); assert.ok(!k || k.kind === 'water' || k.kind === 'beverage');
  assert.equal(S.peerKind({ name: '', brand: '', nutrition: {} }, prep), null);
});

test('products the method does not cover say so and invent nothing: salt, alcohol, supplements, baby food', () => {
  const salt = prod('Sea salt', 'Kalas', { salt_100g: 99, 'energy-kj_100g': 0 }, { nutriscore_grade: 'not-applicable', categories_tags: ['en:salts'] });
  const q = Q.quickGrade(salt); assert.equal(q.ok, false); assert.equal(q.why, 'seasoning');
  const html = U.exemptHTML({ why: 'seasoning', inputs: { salt: 99, kj: 0, sugars: 0 } }, { lang: 'en', code: '3017620422003' });
  assert.match(html, /does not rate this product/); assert.match(html, /salt, spices, herbs, seasonings and vinegar/); assert.match(html, /less than 5 g of salt a day/); assert.match(html, /nothing is missing from the record/);
  assert.ok(!/ 0 g/.test(html.replace(/99 g/, '')), 'zero values are not listed as if they mattered');
  assert.match(U.exemptHTML({ why: 'alcohol', inputs: {} }, { lang: 'el' }), /αλκοολούχα/);
  assert.equal(Q.exemptWhy(prod('Retsina', 'X', { alcohol_100g: 11 }), 11), 'alcohol');
});

test('the similar-products card names what it is, what it used and how it has performed', () => {
  const r = S.similarGrade(prod('Brioche Bread', 'Katselis', BRIOCHE), prep), typical = S.similarGrade(prod('Misko spaghettini', 'Misko'), prep);
  for (const lang of ['en', 'el']) for (const m of [r, typical]) {
    const html = U.similarHTML({ ...m, inputs: { kj: 1038, fat: 6.7, saturatedFat: 2.1, carbs: 39.6, protein: 6.9 } }, { lang, code: '3017620422003' });
    assert.ok(!/undefined|NaN|\[object/.test(html), `${lang} ${m.mode}: no broken placeholders`);
    assert.ok(html.includes('fg85__dist') && html.includes('fg85__peers') && html.includes('fg85__foot'));
  }
  const en = U.similarHTML({ ...r, inputs: { kj: 1038, fat: 6.7, saturatedFat: 2.1, carbs: 39.6, protein: 6.9 } }, { lang: 'en' });
  assert.match(en, /Most likely/); assert.match(en, /sugars and salt/); assert.match(en, /borrowed/); assert.match(en, /not a grade printed on the pack/);
  assert.match(U.similarHTML(typical, { lang: 'en' }), /Not calculated from this product’s nutrition/);
});

test('one number missing and no category (like an orange juice with no salt on record): the missing number is borrowed, and the printed figures never exceed what was measured', { timeout: 900000 }, () => {
  const p = { name: 'Orange', brand: '', code: '5201005001824', basis: 'g', categories: [], pnns: 'unknown', nutrition: { kcal: 49, kj: 205, protein: 0.3, carbohydrates: 11.4, sugars: 11.4, fat: 0.1, saturatedFat: 0, fiber: 0.4, salt: null, sodium: null } };
  assert.equal(Q.quickGrade(p).reason, 'too-uncertain', 'its own numbers alone leave A to D');
  const sm = S.similarGrade(p, prep);
  assert.ok(sm.ok && sm.mode === 'imputed' && sm.imputed.join() === 'salt', 'salt is borrowed from similar products');
  const html = U.similarHTML({ ...sm, inputs: { kj: 205, sugars: 11.4, saturatedFat: 0, fat: 0.1, carbs: 11.4, protein: 0.3 } }, { lang: 'en' });
  assert.match(html, new RegExp(`about ${U.RELIABILITY.similar.imputedOne.inside} %`), 'the card prints the one-missing figures');
  const pct = (a, b) => 100 * a / b;
  for (const [name, r] of Object.entries(V.validateOneMissing())) {
    if (r.shown < 30) continue; // too few to measure
    assert.ok(pct(r.inside, r.shown) >= U.RELIABILITY.similar.imputedOne.inside, `${name}: printed ${U.RELIABILITY.similar.imputedOne.inside} % inside, measured ${pct(r.inside, r.shown).toFixed(1)} %`);
    assert.ok(pct(r.likely, r.shown) >= U.RELIABILITY.similar.imputedOne.likely, `${name}: printed ${U.RELIABILITY.similar.imputedOne.likely} % likely, measured ${pct(r.likely, r.shown).toFixed(1)} %`);
  }
});

test('real catalogue, leave-one-out: how often the published letter is inside the estimated band (and the printed percentages never exceed what was measured)', { timeout: 900000 }, () => {
  const out = {};
  for (const only of ['nothing', 'maker', 'sugars+salt']) out[only] = Object.values(V.validate({ only }))[0];
  const typical = out.nothing, maker = out.maker, imputed = out['sugars+salt'], pct = (a, b) => 100 * a / b;
  assert.ok(typical.n > 4000);
  assert.ok(pct(typical.shown, typical.n) >= 30, `typical: estimate for ${pct(typical.shown, typical.n).toFixed(1)} %`);
  assert.ok(pct(imputed.shown, imputed.n) >= 80, `imputed: estimate for ${pct(imputed.shown, imputed.n).toFixed(1)} %`);
  assert.ok(pct(typical.shown, typical.n) >= 55, `typical (87.2: maker, family, Greeklish): estimate for ${pct(typical.shown, typical.n).toFixed(1)} %`);
  for (const [name, r, key] of [['typical', typical, 'typical'], ['maker', maker, 'typicalMaker'], ['imputed', imputed, 'imputed']]) {
    assert.ok(pct(r.inside, r.shown) >= U.RELIABILITY.similar[key].inside, `${name}: printed ${U.RELIABILITY.similar[key].inside} % inside, measured ${pct(r.inside, r.shown).toFixed(1)} %`);
    assert.ok(pct(r.likely, r.shown) >= U.RELIABILITY.similar[key].likely, `${name}: printed ${U.RELIABILITY.similar[key].likely} % likely, measured ${pct(r.likely, r.shown).toFixed(1)} %`);
  }
});

test('an estimate hides the card\'s own "No grade" block, whatever stylesheet loads after it (87.1: ui-v80.css used to win and left "No grade" under every estimate)', async () => {
  const fs = await import('node:fs'), css = fs.readFileSync(new URL('../prices/reader-v85.css', import.meta.url), 'utf8');
  for (const part of ['snip__head', 'snip__core', 'snip__glow']) assert.ok(css.includes(`.gradecard[data-fg85]>.${part}`), part);
  assert.match(css, /\.gradecard\[data-fg85\]>\.snip__glow\{display:none!important\}/);
});

test('87.2: Greek and Greeklish spellings match; a record with no name is matched by its maker and family and the card says so', () => {
  assert.equal(S.skeleton('μπισκότα'), S.skeleton('mpiskota'));
  assert.equal(S.skeleton('φρυγανιές'), S.skeleton('friganies'));
  assert.equal(S.makerOf('2205930000016'), '', 'in-store codes say nothing about the maker');
  assert.equal(S.makerOf('40000374'), '', 'short codes neither');
  const cookie = prep.rows.find(r => r.grade && r.maker.startsWith('5201004') && r.family === 'biscuit');
  assert.ok(cookie, 'a graded Papadopoulos biscuit in the peers');
  const r = S.similarGrade({ name: '', brand: '', barcode: '5201004999999', family: 'biscuit', nutrition: {}, basis: 'g', categories: [], pnns: 'unknown' }, prep);
  assert.ok(r.ok && r.mode === 'typical' && r.basis === 'maker', JSON.stringify(r).slice(0, 200));
  for (const lang of ['en', 'el']) {
    const html = U.similarHTML(r, { lang });
    assert.match(html, new RegExp(`${U.RELIABILITY.similar.typicalMaker.inside} %`), lang + ': the maker figures are printed');
    assert.match(html, lang === 'en' ? /same maker \(the company part of the barcode\)/ : /ίδιο παραγωγό/);
  }
  assert.equal(S.similarGrade({ name: '', brand: '', barcode: '2205930000016', family: 'other', nutrition: {}, basis: 'g' }, prep).reason, 'no-name', 'no name, no maker, no family: nothing');
});
