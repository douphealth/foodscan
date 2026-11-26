/* 104: defects found by looking at the running app (one screen showing two different letters for the same drink) and by comparing the app's grade with the
 * published one on the most-scanned products of several countries; plus the Home hub as a daily dashboard. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read } from './helpers.mjs';

const D = await import(pathToFileURL(path.join(ROOT, 'assets/domain-v106.mjs')).href);
const M = await import(pathToFileURL(path.join(ROOT, 'prices/market-v83.mjs')).href);

const CODE = '5449000000996';
const mk = raw => D.parseProduct({ status: 1, product: { code: CODE, ...raw } }, CODE);
const COLA = { 'energy-kj_100g': 180, 'energy-kcal_100g': 42, 'sugars_100g': 10.6, 'salt_100g': 0, 'saturated-fat_100g': 0, 'fat_100g': 0, 'carbohydrates_100g': 10.6, 'proteins_100g': 0, 'fiber_100g': 0 };
const ZERO = { 'energy-kj_100g': 1.3, 'energy-kcal_100g': 0.3, 'sugars_100g': 0, 'salt_100g': 0.02, 'saturated-fat_100g': 0, 'fat_100g': 0, 'carbohydrates_100g': 0, 'proteins_100g': 0, 'fiber_100g': 0 };
/** a soda Open Food Facts scored with the table for solid foods (free-text Greek category), published B */
const wrongTable = (o = {}) => mk({ product_name: 'Cola soda', quantity: '330 ml', nutrition_data_per: '100ml', nutriscore_grade: 'b', nutriscore_score: 2, categories_tags: ['el:αναψυκτικά'],
  ingredients_text: 'Carbonated water, sugar, colour (E150d), phosphoric acid, natural flavourings, caffeine', nutriments: COLA, ...o });
/** a zero cola whose published points (0, B) leave out the sweeteners its own ingredient list names */
const zero = (o = {}) => mk({ product_name: 'Cola zero sugar', quantity: '330 ml', nutrition_data_per: '100ml', nutriscore_grade: 'b', nutriscore_score: 0, categories_tags: ['en:beverages', 'en:carbonated-drinks', 'en:sodas'],
  ingredients_text: 'Φυσικό μεταλλικό νερό, διοξείδιο του άνθρακα, χρωστική, γλυκαντικά: κυκλαμικό νάτριο, ασπαρτάμη, ακεσουλφάμη Κ', nutriments: ZERO, ...o });

test('a caller that asks for published grades only never gets back a letter the app itself corrects', () => {
  // before 104 the two drink checks ran only when estimates were allowed, so "Your week", the public product pages and the server's swap
  // candidates still used the published B / A for drinks the product page showed as C / E
  const s = D.assessGrade(zero(), { estimate: false });
  assert.equal(s.status, 'withheld'); assert.equal(s.grade, null); assert.equal(s.sourceGrade, 'B'); assert.equal(s.sweetenersAdded, true); assert.equal(s.correctedGrade, 'C');
  assert.match(s.reasons[0], /published B for this drink without the 4 points/, 'the reason is the same sentence the product page shows');
  const w = D.assessGrade(wrongTable(), { estimate: false });
  assert.equal(w.status, 'withheld'); assert.equal(w.grade, null); assert.equal(w.wrongTable, true); assert.equal(w.correctedGrade, 'E');
  // with estimates allowed nothing changed: the corrected letter, marked as FoodScan's calculation
  assert.equal(D.assessGrade(zero()).grade, 'C'); assert.equal(D.assessGrade(zero()).status, 'estimated');
  assert.equal(D.assessGrade(wrongTable()).grade, 'E');
});

test('a drink the source scored correctly is still reported as published, with or without estimates', () => {
  const ok = zero({ nutriscore_grade: 'c', nutriscore_score: 4 });
  for (const opt of [undefined, { estimate: false }]) { const a = D.assessGrade(ok, opt); assert.equal(a.grade, 'C'); assert.notEqual(a.status, 'withheld'); assert.ok(!a.sweetenersAdded && !a.wrongTable); assert.equal(a.correctedGrade, undefined); }
});

test('"Your week" and the foods page count the corrected letter, and the server engine is the same code', () => {
  assert.match(read('assets/chunk-XKEZNCT7-v106.js'), /L\(i,\{estimate:!1\}\);return d\.status==="reported"\?d\.grade:d\.correctedGrade\|\|null/);
  assert.match(read('assets/chunk-5DGYLCD6-v106.js'), /D\(a,\{estimate:!1\}\);return e\.status==="reported"\?e\.grade:e\.correctedGrade\|\|null/);
  for (const f of ['_worker.js', 'src/domain/grade.js', 'assets/domain-v106.mjs']) {
    const s = read(f);
    assert.ok(!/estimate \? ns23(?:Drink|Sweetener)Check/.test(s), f + ': the checks no longer depend on the estimate option');
    assert.match(s, /correctedGrade: isGrade\(r\.grade\) \? r\.grade : null/, f);
  }
});

test('a kcal and a kJ value that differ only by label rounding do not hold back a published grade; a real mismatch still does', () => {
  // Coca-Cola sans sucres (5449000214799): "1 kcal / 1.3 kJ" is flagged by the database; the app withheld the published C of one of the most-scanned drinks
  const flag = ['en:nutrition-packaging-as-sold-100g-energy-value-in-kcal-does-not-match-value-in-kj'];
  const rounding = zero({ nutriscore_grade: 'c', nutriscore_score: 4, data_quality_errors_tags: flag, nutriments: { ...ZERO, 'energy-kcal_100g': 1 } });
  assert.equal(D.dataQuality(rounding).state, 'usable'); assert.equal(D.assessGrade(rounding).grade, 'C');
  assert.deepEqual(rounding.qualityWarnings, []);
  // 17 kJ (4 kcal) is the line: 100 kcal against 100 kJ is a contradiction and stays one
  const real = zero({ nutriscore_grade: 'c', nutriscore_score: 4, data_quality_errors_tags: flag, nutriments: { ...ZERO, 'energy-kcal_100g': 100, 'energy-kj_100g': 100 } });
  assert.equal(D.dataQuality(real).state, 'blocked'); assert.equal(D.assessGrade(real).grade, null);
  // the other flags are untouched by the rounding rule
  const other = zero({ nutriscore_grade: 'c', nutriscore_score: 4, data_quality_errors_tags: ['en:nutrition-value-total-over-105'], nutriments: { ...ZERO, 'energy-kcal_100g': 1 } });
  assert.deepEqual(other.qualityWarnings, ['en:nutrition-value-total-over-105']);
});

test('the hub opens on the day: a dial per limit, the date in words, one line of counts, and the country row as a setting', () => {
  const hub = read('daily-v98.js'), css = read('daily-v98.css');
  // the dial is the progress bar (role, name, value in words); the short visible value is language-neutral
  assert.match(hub, /class="fs104-ring fs99-meter" role="progressbar" aria-label="\$\{esc\(label\)\}" aria-valuemin="0" aria-valuemax="100"/);
  assert.match(hub, /aria-valuetext="\$\{esc\(`\$\{text\(v\)\} · \$\{pr\.pct\} % · \$\{t\.state\[pr\.state\]\}`\)\}"/);
  assert.match(hub, /const v = di\.counted \? di\.totals\[k\] : null/, 'with nothing counted the dials are empty, never 0 %');
  assert.match(hub, /if \(low\) lows\.push\(t\.lowerBound/, 'a lower bound is still said in words under the dials');
  assert.match(hub, /<time datetime="\$\{esc\(td\)\}">\$\{esc\(dateWords\)\}<\/time>/);
  assert.match(hub, /\$\{streak > 0 \? `<span class="fs98-badge/, 'no "Streak: 0 days"');
  assert.ok(!/fs98-stat__v">\$\{di\.entries\}/.test(hub), 'the two boxes of counts are gone');
  // the country row sits on top only while it asks something
  assert.match(hub, /locTop = !mk\.code \|\| !!mk\.suggest/);
  assert.match(hub, /\$\{locTop \? locHtml\(t, lang\(\)\) : ''\}[\s\S]*\$\{intakeHtml\(t, di, aboutOpen\)\}[\s\S]*\$\{locTop \? '' : locHtml\(t, lang\(\)\)\}\s*\$\{moreHtml/);
  const en = hub.slice(hub.indexOf('const TX'), hub.indexOf('\n  el: {')), el = hub.slice(hub.indexOf('\n  el: {'), hub.indexOf('\n};', hub.indexOf('\n  el: {')));
  for (const k of ['ring', 'ofMax', 'summary']) { assert.ok(en.includes(k + ':'), 'en ' + k); assert.ok(el.includes(k + ':'), 'el ' + k); }
  assert.match(css, /@property --p \{ syntax: '<number>'; inherits: true; initial-value: 0; \}/);
  assert.match(css, /conic-gradient\(var\(--c\) calc\(var\(--p, 0\) \* 1%\), var\(--track\) 0\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{ \.fs104-in \.fs104-ring\[role\] \{ animation: fs104-fill/, 'the dials only animate when motion is welcome');
});

test('a shopper who has scanned before finds their foods right under the search box; a first visit is unchanged', () => {
  const hub = read('daily-v98.js'), css = read('daily-v98.css');
  assert.match(hub, /toggleAttribute\('data-fs104-returning', records\.size > 0\)/);
  assert.match(css, /html\[data-fs104-returning\] \.page\.home > \.top21 \{ display: contents; \}/);
  assert.match(css, /html\[data-fs104-returning\] \.page\.home > \.block21 \{ order: -2; \}/);
  assert.match(css, /html\[data-fs104-returning\] \.page\.home > \.daily21 \{ order: -1; \}/);
  assert.match(css, /\.top21 > \.trustrow, html\[data-fs104-returning\] \.page\.home > \.top21 > \.gutf-ribbon \{ order: 0; \}/, 'the trust row and the articles stay above the footer');
  // every rule of the new order is scoped to the flag, so nothing changes for a first visit
  const block = css.slice(css.indexOf('/* 104: a shopper who has scanned before')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...block.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(m => m[1].trim()).filter(sel => /\.home|\.top21|\.daily21/.test(sel));
  assert.ok(rules.length >= 6);
  for (const rule of rules) for (const sel of rule.split(',')) assert.match(sel, /html\[data-fs104-returning\]/, sel.trim());
});

test('the price card separates the currency from where the country came from', () => {
  assert.match(read('prices/native-v83.js'), /<small class="fp102-src">· \$\{esc\(note\)\}<\/small>/);
});

test('a flag is drawn only where the system has flag emoji; the country name never depends on it', () => {
  assert.equal(M.marketFlag('GR'), '\u{1F1EC}\u{1F1F7}', 'outside a browser the flag is returned as before');
  assert.equal(M.marketName('GR', 'en'), 'Greece');
  // a system that draws the two letters instead (Windows): no coloured pixel on the canvas
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillText() {}, getImageData: () => ({ data: new Uint8ClampedArray(24 * 24 * 4).fill(0).map((_, i) => (i % 4 === 3 ? 255 : 30)) }) }) }) };
  try { assert.equal(M.flagsRender(), false); assert.equal(M.marketFlag('GR'), ''); assert.equal(M.marketName('GR', 'en'), 'Greece'); }
  finally { delete globalThis.document; }
});
