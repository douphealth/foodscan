/* 98.1: the daily check-in's logic (daily-v98-core.mjs) and its wiring. Real catalogue records are used for the measured cases. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT, read } from './helpers.mjs';

const C = await import(pathToFileURL(path.join(ROOT, 'daily-v98-core.mjs')).href);
const prod = (nutrition, extra = {}) => ({ barcode: '5200000000000', basis: 'g', nutrition, ...extra });

test('lenses follow the EU nutrition-claim thresholds, with the stricter limit for drinks', () => {
  assert.equal(C.lensVerdict('lowSugar', prod({ sugars: 5 })), true);
  assert.equal(C.lensVerdict('lowSugar', prod({ sugars: 5.1 })), false);
  assert.equal(C.lensVerdict('lowSugar', prod({ sugars: 4.9 }, { basis: 'ml' })), false, 'a drink with 4.9 g sugars per 100 ml is not "low sugar" in the EU (limit 2.5 g)');
  assert.equal(C.lensVerdict('lowSugar', prod({ sugars: 2.5 }, { basis: 'ml' })), true);
  assert.equal(C.lensVerdict('lowSugar', prod({})), null, 'unknown, never a guess');
  assert.equal(C.lensVerdict('highProt', prod({ protein: 10, kcal: 400 })), false, '10 g in 400 kcal is 10 % of the energy');
  assert.equal(C.lensVerdict('highProt', prod({ protein: 20, kcal: 380 })), true, '80 of 380 kcal = 21 %');
  assert.equal(C.lensVerdict('highProt', prod({ protein: 20 })), null, 'no energy figure: unknown');
  assert.equal(C.lensVerdict('lowSalt', prod({ salt: 0.3 })), true);
  assert.equal(C.lensVerdict('lowSalt', prod({ salt: 0.31 })), false);
  assert.equal(C.lensVerdict('highFiber', prod({ fiber: 6 })), true);
  assert.equal(C.lensVerdict('highFiber', prod({ fiber: 5.9 })), false);
  assert.equal(C.lensVerdict('lessProc', prod({}, { nova: 3 })), true, 'bread and cheese are NOVA 3: processed, not ultra-processed');
  assert.equal(C.lensVerdict('lessProc', prod({}, { nova: 4 })), false);
  assert.equal(C.lensVerdict('lessProc', prod({})), null);
  assert.equal(C.lensVerdict('nope', prod({ sugars: 1 })), null);
  assert.equal(C.lensVerdict('lowSugar', { basis: 'ml', sugars: 4 }), false, 'the flat compare record keeps the basis');
  for (const l of C.LENSES) assert.ok(l.ruleEn && l.ruleEl, 'every lens states its rule in both languages');
});

test('energy check: EU factors, so high-fibre foods are not called wrong (real catalogue records)', () => {
  const bar = prod({ kcal: 387, carbohydrates: 33, protein: 11.3, fat: 13, fiber: 26.4 });
  assert.equal(C.energyCheck(bar).ok, true, 'protein bar 5032543001416: 387 kcal fits 4-4-9 plus 2 kcal/g fibre');
  const rusk = prod({ kcal: 297, carbohydrates: 35, protein: 13.5, fat: 2.5, fiber: 40 });
  assert.equal(C.energyCheck(rusk).ok, true, 'barley rusks 5200300106777');
  const plain449 = n => n.carbohydrates * 4 + n.protein * 4 + n.fat * 9;
  assert.ok(Math.abs(297 - plain449(rusk.nutrition)) > Math.max(45, plain449(rusk.nutrition) * 0.25), 'the 98.0.0 draft rule (4-4-9, 25 %) called this label wrong');
});

test('energy check: a record that does not add up is reported in the right direction', () => {
  const low = C.energyCheck(prod({ kcal: 36, carbohydrates: 2, protein: 1, fat: 25 }));
  assert.equal(low.ok, false); assert.equal(low.dir, 'low');
  const high = C.energyCheck(prod({ kcal: 438, carbohydrates: 6.5, protein: 9.2, fat: 12.7, fiber: 1.9 }));
  assert.equal(high.ok, false); assert.equal(high.dir, 'high');
  assert.equal(C.energyCheck(prod({ kcal: 100, carbohydrates: 10 })), null, 'a missing number gives no verdict');
});

test('energy check: alcohol and sugar alcohols are skipped, a soft drink tagged non-alcoholic is not', () => {
  const n = { kcal: 85, carbohydrates: 2.6, protein: 0.1, fat: 0 };
  assert.deepEqual(C.energyCheck(prod(n, { categories: ['en:alcoholic-beverages', 'en:wines'] })), { skip: 'alcohol' });
  assert.deepEqual(C.energyCheck(prod(n, { categories: ['en:beverages'], name: 'Μπύρα lager' })), { skip: 'alcohol' });
  assert.deepEqual(C.energyCheck(prod({ kcal: 450, carbohydrates: 58, protein: 5, fat: 22 }, { ingredients: 'Cocoa mass, maltitol, cocoa butter' })), { skip: 'polyols' });
  const cola = prod({ kcal: 42, carbohydrates: 10.6, protein: 0, fat: 0 }, { categories: ['en:beverages', 'en:non-alcoholic-beverages', 'en:sodas', 'en:colas'], name: 'Coca-Cola Original' });
  assert.equal(C.isAlcoholic(cola), false, 'the live product page showed "alcoholic drinks" for Coca-Cola before this was fixed');
  assert.equal(C.energyCheck(cola).ok, true);
  assert.equal(C.isAlcoholic(prod({}, { categories: ['en:non-alcoholic-beers'] })), false);
  assert.equal(C.isAlcoholic(prod({}, { name: 'Αλκοολούχο ποτό' })), true);
});

test('data card: only the app’s own data-quality state can say "needs checking"; ingredients count as a string', () => {
  const full = prod({ kcal: 250, protein: 8, carbohydrates: 38, sugars: 5, fat: 3, saturatedFat: 1, fiber: 20, salt: 1 }, { ingredients: 'Wholemeal flour, water, salt', nova: 3 });
  const a = C.auditProduct(full, { state: 'usable' });
  assert.equal(a.have, 8); assert.deepEqual(a.missing, []); assert.equal(a.tier, 'high');
  assert.equal(C.auditProduct({ ...full, ingredients: '' }, { state: 'usable' }).missing.includes('ingredients'), true);
  assert.equal(C.auditProduct(full, { state: 'blocked', reasons: ['Sugars exceed carbohydrates'] }).tier, 'low');
  assert.deepEqual(C.auditProduct(full, { state: 'blocked', reasons: ['Sugars exceed carbohydrates'] }).reasons, ['Sugars exceed carbohydrates']);
  assert.equal(C.auditProduct(full, { state: 'limited' }).tier, 'med');
  assert.equal(C.auditProduct(full, { state: 'local' }).tier, 'med', 'values typed in by the shopper are not independently checked');
  const sparse = C.auditProduct(prod({ kcal: 100 }), { state: 'usable' });
  assert.equal(sparse.tier, 'med'); assert.ok(sparse.have < 6);
  const odd = C.auditProduct(prod({ kcal: 36, carbohydrates: 2, protein: 1, fat: 25, sugars: 1, saturatedFat: 5, fiber: 0, salt: 0 }, { ingredients: 'oil', nova: 2 }), { state: 'usable' });
  assert.equal(odd.tier, 'med', 'an energy mismatch alone never says "needs checking": the engine decides that');
});

test('streak counts consecutive calendar days and survives until today’s first check-in', () => {
  assert.equal(C.computeStreak(['2026-11-23', '2026-11-22', '2026-11-21'], '2026-11-23'), 3);
  assert.equal(C.computeStreak(['2026-11-22', '2026-11-21'], '2026-11-23'), 2, 'nothing logged yet today: yesterday still counts');
  assert.equal(C.computeStreak(['2026-11-21'], '2026-11-23'), 0, 'a missed day ends it');
  assert.equal(C.computeStreak(['2026-11-23', '2026-11-21'], '2026-11-23'), 1);
  assert.equal(C.computeStreak(['2026-10-31', '2026-11-01'], '2026-11-01'), 2, 'month boundary');
  assert.equal(C.computeStreak(['2026-03-28', '2026-03-29', '2026-03-30'], '2026-03-30'), 3, 'across the clock change');
  assert.equal(C.computeStreak([], '2026-11-23'), 0);
  assert.equal(C.computeStreak(['garbage', undefined], '2026-11-23'), 0);
});

test('day averages are per 100 g of the foods logged and are absent when no logged food has the number', () => {
  assert.deepEqual(C.dayStats([{ sugars: 10, salt: 1 }, { sugars: 5, salt: null }, { sugars: null, salt: 0.5 }]), { count: 3, sugars: 7.5, salt: 0.8 });
  assert.deepEqual(C.dayStats([{ sugars: null, salt: null }]), { count: 1, sugars: null, salt: null });
  assert.deepEqual(C.dayStats([]), { count: 0, sugars: null, salt: null });
});

test('backup: only FoodScan files with FoodScan keys are restored', () => {
  const ok = JSON.stringify({ app: 'FoodScan', data: { 'fs13:saved': '[]', 'foodscan:lens:v98': '["lowSalt"]', 'other:key': 'x', 'fs13:profile': 5 } });
  assert.deepEqual(C.parseBackup(ok), [['fs13:saved', '[]'], ['foodscan:lens:v98', '["lowSalt"]']]);
  assert.throws(() => C.parseBackup(JSON.stringify({ app: 'Other', data: { 'fs13:saved': '[]' } })), /invalid_backup/);
  assert.throws(() => C.parseBackup(JSON.stringify({ app: 'FoodScan', data: [] })), /invalid_backup/);
  assert.throws(() => C.parseBackup(JSON.stringify({ app: 'FoodScan', data: { 'other:key': 'x' } })), /empty_backup/);
  assert.throws(() => C.parseBackup('not json'));
  assert.throws(() => C.parseBackup('x'.repeat(C.BACKUP_MAX_CHARS + 1)), /too_large/);
});

test('wiring: the page loads the card, the service worker caches it, the worker is bypassed, the 7-food shelf uses the current engine', () => {
  const html = read('index.html');
  assert.equal((html.match(/\/daily-v98\.css/g) || []).length, 1);
  assert.equal((html.match(/<script type="module" src="\/daily-v98\.js">/g) || []).length, 1);
  assert.doesNotMatch(html, /verified nutrition grades/i, 'the site never claims laboratory-verified grades');
  const sw = read('sw.js');
  for (const f of ['/daily-v98.js', '/daily-v98-core.mjs', '/daily-v98.css']) assert.ok(sw.includes(`'${f}'`), f + ' is precached');
  assert.match(sw, /const CACHE = 'foodscan-98\.1\.0'/);
  const routes = JSON.parse(read('_routes.json'));
  for (const f of ['/daily-v98.js', '/daily-v98-core.mjs', '/daily-v98.css']) assert.ok(routes.exclude.includes(f), f + ' bypasses the worker');
  assert.match(read('_headers'), /\/daily-v98-core\.mjs\n {2}Content-Type: text\/javascript/);
  assert.match(read('fridge-core.mjs'), /from '\.\/assets\/domain-v8400\.mjs'/);
  const ui = read('daily-v98.js');
  assert.match(ui, /from '\.\/assets\/domain-v8400\.mjs'/, 'the app’s own engine instance: grades match and its messages are translated');
  assert.match(ui, /lastHtml/, 'it draws again only when something changed (98.0.0 rebuilt the hub 11 times a second)');
  assert.match(ui, /const ours = /, 'its own changes do not wake it up again');
});
