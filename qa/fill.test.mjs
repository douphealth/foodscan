/* 89: grades in lists and real photos (prices/fill-v89.js, tools/build-estimates.mjs, tools/build-photos.mjs). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const imp = p => import(new URL('../' + p, import.meta.url));
const F = await imp('prices/fill-v89.js'), E = await imp('tools/build-estimates.mjs'), P = await imp('tools/build-photos.mjs');
const est = JSON.parse(fs.readFileSync(new URL('../assets/estimates-off-csv-2026-10-30.json', import.meta.url))).e;

test('the estimate index is exactly what the catalogue and the page steps produce', () => {
  execFileSync(process.execPath, [new URL('../tools/build-estimates.mjs', import.meta.url).pathname, '--check'], { stdio: 'pipe' });
  assert.ok(Object.keys(est).length > 6000);
});

test('a list row shows the same letter as the product page: Rodogal Greek yogurt (screenshot) and the 87.1 orange juice', () => {
  assert.equal(F.chipOf(est['5204140002008']).letter, 'B', 'Rodogal: the product page shows Most likely B');
  assert.equal(F.chipOf(est['5201005001824']).letter, 'E', 'Orange: the product page shows Most likely E');
  assert.deepEqual(F.chipOf('BC|C|i'), { tier: 'i', letter: 'C', band: 'B–C' });
  assert.deepEqual(F.chipOf('DE||t'), { tier: 't', letter: 'D', band: 'D–E' });
  assert.equal(F.chipOf('||x').tier, 'x');
  assert.equal(F.chipOf(undefined), null);
  for (const v of Object.values(est)) { const c = F.chipOf(v); assert.ok(c && (c.tier === 'x' || /^[A-E]$/.test(c.letter)), v); }
});

test('photos: Open Food Facts paths, front image of any language first, then the first uploaded photo; nothing invented', () => {
  assert.equal(F.photoURL('12047567', 'front_en.4.400'), 'https://images.openfoodfacts.org/images/products/000/001/204/7567/front_en.4.400.jpg');
  assert.equal(F.photoURL('5201077010502', '1.400'), 'https://images.openfoodfacts.org/images/products/520/107/701/0502/1.400.jpg');
  assert.equal(P.bestPhoto({ 1: {}, 2: {}, front_fr: { rev: '7' }, ingredients_ar: { rev: '3' } }), 'front_fr.7.400');
  assert.equal(P.bestPhoto({ 3: {}, 1: {}, ingredients_ar: { rev: '3' } }), '1.400');
  assert.equal(P.bestPhoto({ ingredients_en: { rev: '2' } }), null, 'an ingredients close-up is not a product photo');
  assert.equal(P.bestPhoto(null), null);
});
