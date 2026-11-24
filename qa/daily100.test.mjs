/* 100.0: eight fixes to 99.0.0 and four additions.
 * Fixes: a welcome for a new phone (My Lens and Restore backup stay reachable), the compare dialog closes when the page changes, no megabyte key string on every
 * mutation, no one-tap "whole pack" above 600 g or ml, the compare table says per 100 g / per 100 ml and crowns no winner across the two, the data check reads a
 * shared link and the shopper's own label numbers, kcal formatted like the hub, and 100+ superseded asset files gone.
 * Additions: the label bridge, where the grade comes from, the last 7 days, a swap list. The numbers below are worked by hand in the comments. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT, read } from './helpers.mjs';

const C = await import(pathToFileURL(path.join(ROOT, 'daily-v98-core.mjs')).href);
const src = read('daily-v98.js');

/* ---- one-tap pack ------------------------------------------------------------------------------------------------ */
test('a pack is one tap only up to 600 g or ml; typing a larger amount still works', () => {
  const has = (p, amount, kind) => C.presetsFor(p).some(x => x.amount === amount && (!kind || x.kind === kind));
  assert.equal(has({ basis: 'ml', quantity: '1,5 L' }, 1500), false, '1.5 L bottle: no accidental 1,500 ml');
  assert.equal(has({ basis: 'ml', quantity: '1 L' }, 1000), false, '1 L: no one-tap');
  assert.equal(has({ basis: 'g', quantity: '601 g' }, 601), false);
  assert.equal(has({ basis: 'g', quantity: '600 g' }, 600, 'pack'), true, 'the limit itself is allowed');
  assert.equal(has({ basis: 'ml', quantity: '500 ml' }, 500), true, 'a single-serve bottle');
  const multi = C.presetsFor({ basis: 'ml', quantity: '6 x 330 ml' });
  assert.deepEqual(multi[0], { kind: 'unit', amount: 330, unit: 'ml' }, 'a multipack offers one unit, not the whole 1,980 ml');
  assert.equal(C.parseAmount('1500'), 1500, 'a typed amount keeps the 2,000 limit');
  assert.equal(C.parseAmount('2000'), 2000);
});

/* ---- the shopper's own label ------------------------------------------------------------------------------------- */
test('label storage key -> GTIN-14; anything else is not a label', () => {
  assert.equal(C.labelCode('fs85:label:5201054016501'), '05201054016501');
  assert.equal(C.labelCode('fs85:label:036000291452'), '00036000291452', 'UPC-A');
  for (const bad of ['fs85:label:abc', 'fs85:label:12345', 'fs13:saved', 'xfs85:label:5201054016501', '', null]) assert.equal(C.labelCode(bad), null, String(bad));
});

const LABEL100 = { v: 2, basis: '100', kind: 'general', values: { kj: 1000, fat: 10, sat: 3, carbs: 50, sugars: 12, fibre: 2, protein: 5, salt: 1.2 }, model: { grade: 'C' } };
test('label per 100 g: kJ -> kcal (1000 / 4.184 = 239), names mapped to the record model', () => {
  const L = C.labelNutrition(LABEL100);
  assert.deepEqual(L.nutrition, { kcal: 239, carbohydrates: 50, sugars: 12, fat: 10, saturatedFat: 3, protein: 5, fiber: 2, salt: 1.2 });
  assert.equal(L.grade, 'C'); assert.equal(L.basis, null);
});
test('label per serving: scaled to 100 g with the serving the shopper typed (30 g -> x 3.333); without a serving it is unusable', () => {
  const s = { v: 2, basis: 'serving', serving: 30, kind: 'general', values: { kj: 600, kcal: 143, fat: 3, sat: 1, carbs: 20, sugars: 6, fibre: 1, protein: 2, salt: 0.3 } };
  const L = C.labelNutrition(s);
  assert.equal(L.nutrition.sugars, 20); assert.equal(L.nutrition.saturatedFat, 3.33); assert.equal(L.nutrition.kcal, 477); assert.equal(L.nutrition.salt, 1); assert.equal(L.nutrition.fat, 10);
  assert.equal(C.labelNutrition({ ...s, serving: null }), null);
  assert.equal(C.labelNutrition({ ...s, serving: 0 }), null);
});
test('a drink label is per 100 ml; a malformed or empty label is ignored', () => {
  assert.equal(C.labelNutrition({ ...LABEL100, kind: 'beverage' }).basis, 'ml');
  for (const bad of [null, undefined, {}, { v: 1, values: { sugars: 5 } }, { v: 2 }, { v: 2, values: {} }, { v: 2, values: { sugars: 'x' } }]) assert.equal(C.labelNutrition(bad), null, JSON.stringify(bad));
});
test('mergeLabel: the label wins where the shopper gave a number, the database keeps the rest, the record is not changed in place', () => {
  const p = { barcode: '5201054016501', name: 'X', basis: 'g', nutrition: { kcal: 90, sugars: 5, fiber: 3, salt: 0.5, protein: 4 } };
  const m = C.mergeLabel(p, { ...LABEL100, values: { ...LABEL100.values, fibre: null } });
  assert.equal(m.nutrition.sugars, 12); assert.equal(m.nutrition.salt, 1.2); assert.equal(m.nutrition.kcal, 239);
  assert.equal(m.nutrition.fiber, 3, 'a field the label did not give keeps the database value');
  assert.equal(m.labelPhoto, true); assert.equal(m.labelGrade, 'C');
  assert.equal(p.nutrition.sugars, 5, 'the stored record is untouched'); assert.equal(p.labelPhoto, undefined);
  assert.equal(C.mergeLabel(p, null), p, 'no usable label: the same object back');
  assert.equal(C.mergeLabel(null, LABEL100), null);
});
test('a merged record feeds the check-in: the amount is multiplied by the LABEL numbers (200 g x 12 g sugars / 100 = 24 g)', () => {
  const m = C.mergeLabel({ barcode: '5201054016501', name: 'X', basis: 'g', nutrition: { sugars: 5 } }, LABEL100);
  const e = C.logEntry(m, 200, 'custom', { day: '2026-11-23', at: 1 });
  assert.equal(C.entryIntake(e).sugars, 24);
});

/* ---- where a grade comes from ------------------------------------------------------------------------------------ */
test('provenance: published, your label, calculated, similar products, none', () => {
  assert.equal(C.provenance({ status: 'reported', grade: 'A' }), 'published');
  assert.equal(C.provenance({ status: 'reported', grade: 'A', label: true }), 'published', 'a published grade is not replaced by a photo');
  assert.equal(C.provenance({ status: 'estimated', grade: 'C', label: true }), 'label');
  assert.equal(C.provenance({ status: 'missing', grade: null, label: true }), 'label');
  assert.equal(C.provenance({ status: 'estimated', grade: 'C' }), 'calculated');
  assert.equal(C.provenance({ status: 'missing', quick: 'quick' }), 'calculated');
  assert.equal(C.provenance({ status: 'missing', quick: 'similar' }), 'similar');
  assert.equal(C.provenance({ status: 'missing' }), 'none');
  assert.equal(C.provenance({ status: 'reported', grade: null }), 'none', 'reported without a letter is no grade');
  assert.equal(C.provenance(), 'none');
});

/* ---- the last 7 days --------------------------------------------------------------------------------------------- */
const E = (day, grams, sugars, salt = 0.1) => ({ day, at: 1, barcode: '5449000000996', gtin: '05449000000996', basis: 'g', grams, kcal: 100, sugars, salt, sat: 1, protein: 1 });
test('weekPulse: seven days ending today, averages only over days with amounts, a legacy day counts as logged but not averaged', () => {
  const log = [
    E('2026-11-23', 200, 20),                  // 40 g sugars, 0.2 g salt
    E('2026-11-22', 100, 60),                  // 60 g sugars (over 50), 0.1 g salt
    { day: '2026-11-21', at: 1, barcode: '1', name: 'old' },   // a 98.1 check-in: no amount
    E('2026-11-20', 100, 10),                  // 10 g sugars
    E('2026-11-16', 100, 99)                   // 8 days ago: outside the window
  ];
  const w = C.weekPulse(log, '2026-11-23');
  assert.equal(w.rows.length, 7);
  assert.equal(w.rows[0].day, '2026-11-17'); assert.equal(w.rows[6].day, '2026-11-23');
  assert.equal(w.daysLogged, 4, '23rd, 22nd, 21st (no amount) and 20th');
  assert.equal(w.daysCounted, 3);
  assert.equal(w.avgSugars, 36.7, '(40 + 60 + 10) / 3 = 36.67');
  assert.equal(w.avgSalt, 0.13, '(0.2 + 0.1 + 0.1) / 3 = 0.133');
  assert.equal(w.daysOverSugar, 1); assert.equal(w.daysOverSalt, 0);
  assert.equal(w.rows[4].counted, 0); assert.equal(w.rows[4].entries, 1, 'the no-amount day is listed, not counted');
});
test('weekPulse with nothing logged: no days, no averages (null, never 0)', () => {
  const w = C.weekPulse([], '2026-11-23');
  assert.equal(w.daysLogged, 0); assert.equal(w.avgSugars, null); assert.equal(w.avgSalt, null);
  assert.equal(C.weekPulse(undefined, '2026-11-23').rows.length, 7);
});
test('weekPulse crosses a month and a leap day boundary', () => {
  const w = C.weekPulse([], '2028-03-02');
  assert.deepEqual(w.rows.map(r => r.day), ['2028-02-25', '2028-02-26', '2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02']);
});

/* ---- swap list --------------------------------------------------------------------------------------------------- */
const S1 = { code: '5201054016501', name: 'Total 5 %', brand: 'Fage', grade: 'A', forCode: '5201000000028', forName: 'Sweet yogurt', forGrade: 'E' };
test('swap list: one row per product (UPC-A and EAN-13 are one), newest first, at most 30, junk ignored', () => {
  let l = C.listAdd([], S1, 10);
  assert.equal(l.length, 1); assert.equal(l[0].gtin, '05201054016501'); assert.equal(l[0].forGtin, '05201000000028');
  l = C.listAdd(l, { code: '036000291452', name: 'A', grade: 'B' }, 20);
  l = C.listAdd(l, { code: '0036000291452', name: 'A again', grade: 'A' }, 30);
  assert.equal(l.length, 2); assert.equal(l[0].name, 'A again', 'the same product again replaces and moves to the front');
  assert.equal(C.listAdd(l, { code: 'abc', name: 'x' }, 1), l, 'no barcode: unchanged');
  assert.equal(C.listAdd(l, { code: '5449000000996', name: '  ' }, 1), l, 'no name: unchanged');
  assert.equal(C.listAdd(l, { code: '5449000000996', name: 'ok', grade: 'Z' }, 1)[0].grade, null, 'an unknown letter is not stored');
  let big = [];
  for (let i = 0; i < 35; i++) big = C.listAdd(big, { code: String(5200000000000 + i), name: `p${i}`, grade: 'A' }, i);
  assert.equal(big.length, C.LIST_MAX); assert.equal(big[0].name, 'p34');
  assert.deepEqual(C.listRemove(l, '00036000291452').map(x => x.name), ['Total 5 %']);
  assert.deepEqual(C.listRemove(undefined, 'x'), []);
});
test('swap list: grade steps gained (E -> A is 4, D -> B is 2; unknown grades gain nothing)', () => {
  assert.equal(C.gradeGain({ grade: 'A', forGrade: 'E' }), 4);
  assert.equal(C.gradeGain({ grade: 'B', forGrade: 'D' }), 2);
  assert.equal(C.gradeGain({ grade: 'C', forGrade: 'C' }), 0);
  assert.equal(C.gradeGain({ grade: null, forGrade: 'D' }), null);
  assert.equal(C.gradeGain({ grade: 'A', forGrade: null }), null);
});
test('swap list summary: totals use only CURRENT prices in one currency; cheaper/dearer only on the same unit basis, both current', () => {
  let l = C.listAdd([], S1, 1);                                                                                                  // A for E: +4
  l = C.listAdd(l, { code: '5449000000996', name: 'Cola Zero', grade: 'B', forCode: '3017620422003', forName: 'Nutella', forGrade: 'D' }, 2);   // B for D: +2
  l = C.listAdd(l, { code: '4006381333931', name: 'No grade', grade: null }, 3);
  const g = k => C.gtin14(k);
  const prices = new Map([
    [g('5201054016501'), { price: 1.2, currency: 'EUR', older: false, unitPrice: 3, unitBasis: 'kg' }],
    [g('5201000000028'), { price: 1.5, currency: 'EUR', older: false, unitPrice: 5, unitBasis: 'kg' }],    // 3 vs 5 per kg: cheaper
    [g('5449000000996'), { price: 2, currency: 'EUR', older: false, unitPrice: 2, unitBasis: 'l' }],
    [g('3017620422003'), { price: 1.8, currency: 'EUR', older: false, unitPrice: 1, unitBasis: 'kg' }],    // per l vs per kg: not compared
    [g('4006381333931'), { price: 3, currency: 'EUR', older: true, unitPrice: 6, unitBasis: 'kg' }]        // an older price: listed, not added up
  ]);
  const s = C.listSummary(l, prices);
  assert.equal(s.count, 3); assert.equal(s.graded, 2); assert.equal(s.improved, 2); assert.equal(s.gain, 6);
  assert.equal(s.best.name, 'Total 5 %');
  assert.equal(s.priced, 3); assert.equal(s.current, 2); assert.equal(s.total, 3.2, '1.20 + 2.00, the older 3.00 is not added');
  assert.equal(s.currency, 'EUR'); assert.equal(s.cheaper, 1); assert.equal(s.dearer, 0);
  prices.set(g('5449000000996'), { price: 2, currency: 'GBP', older: false, unitPrice: 2, unitBasis: 'l' });
  const mixed = C.listSummary(l, prices);
  assert.equal(mixed.total, null, 'two currencies are never added'); assert.equal(mixed.currency, null);
  const none = C.listSummary([], {});
  assert.equal(none.count, 0); assert.equal(none.total, null); assert.equal(none.best, null);
  const dearer = C.listSummary(C.listAdd([], S1, 1), { [g('5201054016501')]: { price: 3, currency: 'EUR', older: false, unitPrice: 9, unitBasis: 'kg' }, [g('5201000000028')]: { price: 1.5, currency: 'EUR', older: false, unitPrice: 5, unitBasis: 'kg' } });
  assert.equal(dearer.dearer, 1); assert.equal(dearer.cheaper, 0);
});

/* ---- the hub file ------------------------------------------------------------------------------------------------ */
test('fix 1: a new phone gets a compact welcome with My Lens and Restore backup (the hub is no longer removed when empty)', () => {
  assert.ok(src.includes('welcomeSub'));
  assert.doesNotMatch(src, /a first-time visitor sees the app's own scan screen/);
  assert.match(src, /const welcome = !records\.size && !log\.length && !list\.length;/);
  const welcome = src.slice(src.indexOf('if (welcome) {'), src.indexOf('const savedRows'));
  assert.ok(welcome.includes('moreHtml(') && welcome.includes('wireMore('), 'the welcome includes the lens and backup block and wires it');
  assert.match(src, /data-fs98-import/);
});
test('fix 2: leaving a page closes the compare dialog', () => {
  assert.match(src, /if \(where !== lastWhere\) \{[^}]*closeModal\(\);/);
});
test('fix 3: the change key is built from signatures, not from the stored lists', () => {
  const key = src.match(/const key = \[r\.page[^\n]*/)[0];
  assert.ok(!key.includes('readRaw('), 'no raw megabyte string in the key');
  for (const k of ['readSig(PORTION_KEY)', 'readSig(DAILY_KEY)', 'readSig(COMPARE_KEY)', 'readSig(LIST_KEY)', 'recordsKey(']) assert.ok(key.includes(k), k);
  assert.match(src, /const sig = s => \(s \? `\$\{s\.length\}:\$\{s\.slice\(0, 48\)\}:\$\{s\.slice\(-48\)\}` : '0'\);/);
});
test('fix 5 and 7: the compare table names its basis, crowns no winner across g and ml, and formats energy like the hub', () => {
  assert.match(src, /const mixed = new Set\(list\.map\(x => x\.basis\)\)\.size > 1;/);
  assert.match(src, /const win = \(v, b\) => \(!mixed && /);
  assert.ok(src.includes('t.perBasis[x.basis'));
  assert.ok(src.includes('t.mixedBasis'));
  assert.ok(src.includes("Math.round(x.kcal).toLocaleString(el ? 'el' : 'en')"));
});
test('fix 6: the data check reads a shared link (snapshot) and the label numbers, and looks again for a few seconds', () => {
  assert.ok(src.includes("'fs591:source-snapshots'") && src.includes('function snapshotRecord('));
  assert.ok(src.includes('readAllRecords().get(recordKey(code)) || snapshotRecord(code)'));
  assert.ok(src.includes('trustRetry++ < 10'));
  assert.ok(src.includes('mergeLabel(') && src.includes('labelKeys()'));
});
test('the swap list and the source pill are drawn, in both languages', () => {
  for (const k of ['srcLabel', 'src', 'srcTip', 'labelNote', 'confHighLabel', 'weekTitle', 'weekLogged', 'weekAvgSugar', 'weekAvgSalt', 'weekOver', 'weekOnly', 'weekBars', 'weekAbout', 'listBest', 'listTitle', 'listSub', 'listAdd', 'listOn', 'listAddedMsg', 'listRemovedMsg', 'listRemove', 'listInstead', 'listMore', 'listCount', 'listGain', 'listTotal', 'listCheaper', 'listDearer', 'listNoPrice', 'listOlder', 'welcomeSub', 'perBasis', 'mixedBasis'])
    assert.equal((src.match(new RegExp(`^\\s+(?:.*[ ,{])?${k}:`, 'gm')) || []).length >= 2, true, `${k} exists in English and Greek`);
  assert.ok(src.includes('fs100-add') && src.includes('a.fs88__item'));
  assert.ok(fs.readFileSync(path.join(ROOT, 'daily-v98.css'), 'utf8').includes('.fs100-src--published'));
});

/* ---- the asset tree ---------------------------------------------------------------------------------------------- */
test('fix 8: the superseded v7540-v8300 chunks are gone, and every static import in assets still resolves', () => {
  const dir = path.join(ROOT, 'assets');
  const seen = new Set(), queue = [];
  const roots = ['index.html', 'how/index.html', 'demo/index.html', 'prices/index.html', '404.html'];
  const ref = /(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+\.(?:m?js|css))["']|(?:src|href)=["']([^"']+\.(?:m?js|css))["']/g;
  const add = (from, spec) => {
    if (/^https?:|^data:/.test(spec)) return;
    const p = spec.startsWith('/') ? path.join(ROOT, spec.split('?')[0]) : path.resolve(path.dirname(from), spec.split('?')[0]);
    if (!seen.has(p)) { seen.add(p); queue.push(p); }
  };
  for (const r of roots) { const f = path.join(ROOT, r); if (fs.existsSync(f)) for (const m of fs.readFileSync(f, 'utf8').matchAll(ref)) add(f, m[1] || m[2]); }
  while (queue.length) {
    const f = queue.pop();
    assert.ok(fs.existsSync(f), `an import points at a missing file: ${path.relative(ROOT, f)}`);
    if (!/\.m?js$/.test(f)) continue;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(ref)) add(f, m[1] || m[2]);
  }
  assert.ok(seen.size > 40, `walked ${seen.size} files`);
  // what is left from builds 7540-8300 is what a page still loads (walked above) or the readable engine source the tests import (domain-v*.mjs): a handful, not 140
  const legacy = fs.readdirSync(dir).filter(n => /-v(7[5-9]\d\d|8[0-2]\d\d|8300)\.(?:m?js|css)$/.test(n));
  for (const f of legacy) assert.ok(seen.has(path.join(dir, f)) || /^(?:domain|market-catalogue|recommendations-core)-v\d+\.mjs$/.test(f), `${f} is unreferenced legacy`);
  assert.ok(legacy.length < 30, `${legacy.length} legacy files left`);
});
