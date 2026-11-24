/* 99.0: the daily check-in logs an AMOUNT, and the day is what was eaten against the WHO limits (not an average per 100 g).
 * Also: one key per product (GTIN-14). The numbers below are label values of real products (Coca-Cola Original 330 ml can, Fage Total 5 % 170 g tub,
 * Nutella 3017620422003) so the arithmetic can be checked by hand. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT, read } from './helpers.mjs';

const C = await import(pathToFileURL(path.join(ROOT, 'daily-v98-core.mjs')).href);

const COLA = { barcode: '5449000000996', name: 'Coca-Cola Original', basis: 'ml', quantity: '330 ml', servingAmount: null, nutrition: { kcal: 42, sugars: 10.6, salt: 0, saturatedFat: 0, protein: 0 } };
const YOGURT = { barcode: '5201054016501', name: 'Total 5 %', basis: 'g', quantity: '170 g', nutrition: { kcal: 97, sugars: 3.9, salt: 0.1, saturatedFat: 3.4, protein: 9 } };
const NUTELLA = { barcode: '3017620422003', name: 'Nutella', basis: 'g', quantity: '400 g', servingAmount: 15, servingUnit: 'g', nutrition: { kcal: 539, sugars: 56.3, salt: 0.107, saturatedFat: 10.6, protein: 6.3 } };
const at = { day: '2026-11-23', at: 1000 };

test('GTIN-14: EAN-8, UPC-A, EAN-13 and GTIN-14 of one product are one key; anything else has none', () => {
  assert.equal(C.gtin14('3017620422003'), '03017620422003');
  assert.equal(C.gtin14('03017620422003'), '03017620422003');
  assert.equal(C.gtin14('036000291452'), '00036000291452', 'UPC-A (12 digits)');
  assert.equal(C.gtin14('0036000291452'), '00036000291452', 'the same UPC-A written as EAN-13');
  assert.equal(C.gtin14('96385074'), '00000096385074', 'EAN-8');
  assert.equal(C.gtin14(' 5449000000996 '), '05449000000996', 'whitespace from a scanner');
  for (const bad of ['', null, undefined, 'abc', '12345', '123456789', '12345678901234567', '5449000000996x', '5449 0000 00996']) assert.equal(C.gtin14(bad), null, String(bad));
  assert.equal(C.gtin14(5449000000996), '05449000000996', 'a number is accepted as text');
});

test('GTIN check digit: real codes pass, a one-digit typo fails (the key is still made: a mis-scan must never hide)', () => {
  for (const ok of ['3017620422003', '4006381333931', '036000291452', '96385074', '5449000000996']) assert.equal(C.gtinCheckOk(ok), true, ok);
  for (const bad of ['3017620422004', '4006381333932', '036000291453', '96385075', '5449000000997']) { assert.equal(C.gtinCheckOk(bad), false, bad); assert.ok(C.gtin14(bad)); }
  assert.equal(C.gtinCheckOk('abc'), false);
});

test('a typed amount: 1 to 2,000, a comma or a unit is accepted, anything else is not', () => {
  assert.equal(C.parseAmount('250'), 250);
  assert.equal(C.parseAmount('250 ml'), 250);
  assert.equal(C.parseAmount('1,5'), 1.5);
  assert.equal(C.parseAmount(' 30g '), 30);
  assert.equal(C.parseAmount('2000'), 2000);
  for (const bad of ['0', '0.5', '2001', '-5', 'abc', '', '1e3', '12 cups', null, undefined]) assert.equal(C.parseAmount(bad), null, String(bad));
});

test('pack size: one unit of a multipack, the whole pack of a single one, nothing for a huge or missing size', () => {
  assert.deepEqual(C.packOf({ quantity: '6 x 330 ml' }), { amount: 330, unit: 'ml', count: 6 });
  assert.deepEqual(C.packOf({ quantity: '6×330 ml' }), { amount: 330, unit: 'ml', count: 6 });
  assert.deepEqual(C.packOf({ quantity: '1,5 L' }), { amount: 1500, unit: 'ml', count: 1 });
  assert.deepEqual(C.packOf({ quantity: '75 cl' }), { amount: 750, unit: 'ml', count: 1 });
  assert.deepEqual(C.packOf({ quantity: '500 g' }), { amount: 500, unit: 'g', count: 1 });
  assert.deepEqual(C.packOf({ quantity: '0.5 kg' }), { amount: 500, unit: 'g', count: 1 });
  assert.equal(C.packOf({ quantity: '5 kg' }), null, 'a 5 kg sack is not one check-in');
  assert.equal(C.packOf({ quantity: '' }), null);
  assert.equal(C.packOf({}), null);
});

test('portions: the product\'s own serving first, then its pack, then common sizes in the right unit; the same amount is never shown twice', () => {
  const cola = C.presetsFor(COLA);
  assert.deepEqual(cola.map(x => [x.kind, x.amount]), [['pack', 330], ['glass', 200], ['cup', 250], ['bottle', 500]], 'a 330 ml can: its pack covers the can size');
  assert.ok(cola.every(x => x.unit === 'ml'));
  const nut = C.presetsFor(NUTELLA);
  assert.deepEqual(nut.slice(0, 2).map(x => [x.kind, x.amount]), [['serving', 15], ['pack', 400]]);
  assert.ok(nut.some(x => x.kind === 'g' && x.amount === 30), '30 g is offered');
  assert.ok(nut.length <= 6);
  const multi = C.presetsFor({ basis: 'ml', quantity: '6 x 330 ml', servingAmount: 250, servingUnit: 'ml' });
  assert.deepEqual(multi.slice(0, 2).map(x => [x.kind, x.amount]), [['serving', 250], ['unit', 330]]);
  assert.equal(new Set(multi.map(x => x.amount)).size, multi.length, 'no amount twice');
  const yog = C.presetsFor(YOGURT);
  assert.deepEqual(yog.map(x => x.amount), [170, 30, 50, 100, 150]);
  assert.deepEqual(C.presetsFor({ basis: 'g' }).map(x => x.amount), [30, 50, 100, 150], 'no pack, no serving: only the common sizes');
  assert.equal(C.presetsFor({ basis: 'g', quantity: '1 L' }).some(x => x.amount === 1000), false, 'a volume pack is not offered for a food measured in grams');
  assert.equal(C.presetsFor({ basis: 'g', servingAmount: 9999, servingUnit: 'g' }).some(x => x.amount === 9999), false, 'an absurd serving is dropped');
});

test('a check-in stores the food\'s per-100 numbers and the amount; an invalid amount or code stores nothing', () => {
  const e = C.logEntry(COLA, 330, 'pack', { ...at, grade: 'E' });
  assert.deepEqual(e, { day: '2026-11-23', at: 1000, barcode: '5449000000996', gtin: '05449000000996', name: 'Coca-Cola Original', grade: 'E', basis: 'ml', grams: 330, portion: 'pack', kcal: 42, sugars: 10.6, salt: 0, sat: 0, protein: 0 });
  assert.equal(C.logEntry(COLA, 0, 'custom', at), null);
  assert.equal(C.logEntry(COLA, 2001, 'custom', at), null);
  assert.equal(C.logEntry(COLA, 'x', 'custom', at), null);
  assert.equal(C.logEntry({ ...COLA, barcode: 'junk' }, 100, 'custom', at), null, 'no GTIN, no entry');
  assert.equal(C.logEntry(COLA, 12.34, 'custom', at).grams, 12.3);
});

test('intake: amount x per-100 value / 100 (one can of cola is 35 g of sugars, 70 % of the 50 g limit)', () => {
  const can = C.entryIntake(C.logEntry(COLA, 330, 'pack', at));
  assert.ok(Math.abs(can.sugars - 34.98) < 1e-9);
  assert.ok(Math.abs(can.kcal - 138.6) < 1e-9);
  const day = C.dayIntake([C.logEntry(COLA, 330, 'pack', at)]);
  assert.equal(day.totals.sugars, 35);
  assert.deepEqual(C.progress(day.totals.sugars, C.LIMITS.sugars), { pct: 70, bar: 70, state: 'ok' });
  const two = C.dayIntake([C.logEntry(COLA, 330, 'pack', at), C.logEntry(COLA, 330, 'pack', at)]);
  assert.equal(two.totals.sugars, 70);
  assert.deepEqual(C.progress(two.totals.sugars, C.LIMITS.sugars), { pct: 140, bar: 100, state: 'over' }, 'the bar stops at 100, the percentage does not');
});

test('a day adds only what was eaten; a number a food does not report is never counted as zero and is said to be missing', () => {
  const rows = [C.logEntry(COLA, 330, 'pack', at), C.logEntry(YOGURT, 170, 'pack', at), C.logEntry(NUTELLA, 15, 'serving', at), C.logEntry({ ...YOGURT, barcode: '5201054016518', nutrition: { kcal: 97 } }, 100, 'g', at)];
  const d = C.dayIntake(rows);
  assert.equal(d.counted, 4); assert.equal(d.uncounted, 0);
  assert.equal(d.totals.sugars, Math.round((34.98 + 6.63 + 8.445) * 10) / 10, 'cola + yogurt + Nutella; the fourth food reports no sugars');
  assert.equal(d.missing.sugars, 1, 'the total is a lower bound and the screen says so');
  assert.equal(d.missing.kcal, 0);
  assert.equal(d.totals.salt, Math.round((0 + 0.17 + 0.01605 + 0) * 100) / 100);
  assert.equal(C.dayIntake([{ day: 'x', sugars: 5 }]).totals.sugars, null, 'no amount, nothing counted');
});

test('entries written by 98.1.0 (no amount) are listed but never counted, and are reported as such', () => {
  const old = { day: '2026-11-23', at: 1, barcode: '5449000000996', name: 'Coca-Cola Original', grade: 'E', sugars: 10.6, salt: 0, protein: 0 };
  const d = C.dayIntake([old, C.logEntry(YOGURT, 100, 'g', at)]);
  assert.equal(d.entries, 2); assert.equal(d.counted, 1); assert.equal(d.uncounted, 1);
  assert.equal(d.totals.sugars, 3.9, 'the old entry\'s 10.6 g per 100 ml is not added');
  assert.deepEqual(C.dayIntake([]).totals, { kcal: null, sugars: null, salt: null, sat: null, protein: null });
});

test('limits and progress: WHO 50 g sugars (25 g better), 5 g salt, 22 g saturated fat, 2,000 kcal reference; the state flips at 75 % and 100 %', () => {
  assert.deepEqual(C.LIMITS, { sugars: 50, sugarsBetter: 25, salt: 5, sat: 22, kcal: 2000 });
  assert.deepEqual(C.progress(37, 50), { pct: 74, bar: 74, state: 'ok' });
  assert.equal(C.progress(37.4, 50).pct, 75, '74.8 % is shown as 75 %');
  assert.equal(C.progress(37.4, 50).state, 'near', 'and coloured as 75 %, so the colour matches the number');
  assert.equal(C.progress(37.5, 50).state, 'near');
  assert.equal(C.progress(50, 50).state, 'near', 'exactly at the limit is not over it');
  assert.deepEqual(C.progress(50.1, 50), { pct: 100, bar: 100, state: 'over' }, 'above the limit is over, even when it rounds to 100 %');
  assert.equal(C.progress(null, 50), null);
  assert.equal(C.progress(10, 0), null);
});

test('the amount of last time is remembered per product (GTIN-14), newest 200 kept, junk ignored', () => {
  let m = C.rememberPortion({}, '05449000000996', 330, 'pack', 10);
  assert.deepEqual(m, { '05449000000996': { amount: 330, kind: 'pack', at: 10 } });
  m = C.rememberPortion(m, '05449000000996', 250, 'cup', 20);
  assert.equal(m['05449000000996'].amount, 250);
  assert.deepEqual(C.rememberPortion(null, 'not-a-key', 5, 'g', 1), {}, 'a key that is not a GTIN-14 is dropped');
  assert.deepEqual(C.rememberPortion([], '05449000000996', 'x', 'g', 1), {}, 'a bad amount is dropped');
  let big = {};
  for (let i = 0; i < 230; i++) big = C.rememberPortion(big, String(i).padStart(14, '0'), 100, 'g', i);
  assert.equal(Object.keys(big).length, 200); assert.ok(big['00000000000229']); assert.equal(big['00000000000000'], undefined, 'the oldest are dropped');
});

test('wiring: the hub asks for an amount, shows the day against the limits, never calls an average "intake", and works on any GTIN form', () => {
  const ui = read('daily-v98.js');
  assert.match(ui, /foodscan:portion:v99/);
  assert.match(ui, /function pickerHtml/); assert.match(ui, /function wirePicker/);
  assert.match(ui, /intakeHtml\(t, di, aboutOpen\)/, 'the home card shows the day against the limits');
  assert.match(ui, /dayIntake\(todayRows\)/);
  assert.doesNotMatch(ui, /dayStats|per100:|not your intake|όχι η πρόσληψή σου/, 'the per-100 g average tiles are gone');
  assert.match(ui, /const recordKey = code => gtin14\(code\)/, 'records are keyed by GTIN-14');
  assert.match(ui, /sameFood\(x\.barcode, code\)/, 'the product page matches the check-in by GTIN-14');
  assert.doesNotMatch(ui, /addDailyLog\(p\);|addDailyLog\(rec\.product\)/, 'nothing is logged without an amount');
  assert.match(read('daily-v98.css'), /\.fs99-pick/);
  for (const l of ['en', 'el']) assert.ok(ui.includes(l === 'en' ? 'whoSugars: ' : 'ΠΟΥ: ελεύθερα σάκχαρα'), l + ' text for the sugar limit');
});

test('both languages carry every new string (a missing Greek string would show the key as "undefined")', () => {
  const ui = read('daily-v98.js');
  const block = lang => { const a = ui.indexOf(`\n  ${lang}: {`), b = lang === 'en' ? ui.indexOf('\n  el: {') : ui.indexOf('\n};', a); return ui.slice(a, b); };
  const en = { has: k => new RegExp(`[ ,]${k}: `).test(block('en')) }, el = { has: k => new RegExp(`[ ,]${k}: `).test(block('el')) };
  for (const k of ['pickTitle', 'sameAsLast', 'customLabel', 'badAmount', 'loggedAmount', 'portion', 'sugarsToday', 'saltToday', 'kcalToday', 'satToday', 'whoSugars', 'whoSalt', 'whoSat', 'refKcal', 'lowerBound', 'uncounted', 'intakeNone', 'removeItem', 'nut', 'state']) {
    assert.ok(en.has(k), 'en ' + k); assert.ok(el.has(k), 'el ' + k);
  }
});
