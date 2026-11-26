/* 100.1: the Home hub on a desktop. Two things the screenshot showed: the hub stretched across a 2,000 px window, and the "Last 7 days" card was a row of
 * seven blank dashes (the user's two check-ins were written by 98.1.0 and carry no amount, so there was nothing to chart). Fixed here:
 *  - the card is drawn only from two days with an amount (weekReady), its caveat sits in a folded note, and the biggest swap win moved to the swap list;
 *  - the hub sits in the same column as the page below it: two columns from 960 px, one column on a phone. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read } from './helpers.mjs';

const C = await import(pathToFileURL(path.join(ROOT, 'daily-v98-core.mjs')).href);
const src = read('daily-v98.js');
const css = read('daily-v98.css');
const E = (day, grams, sugars) => ({ day, at: 1, barcode: '5449000000996', gtin: '05449000000996', basis: 'g', grams, kcal: 100, sugars, salt: 0.1, sat: 1, protein: 1 });

test('weekReady: nothing, legacy entries and a single day with an amount do not draw the card; two days do', () => {
  const day = '2026-11-24';
  assert.equal(C.WEEK_MIN_DAYS, 2);
  assert.equal(C.weekReady(C.weekPulse([], day)), false, 'no check-ins');
  const legacy = [{ day: '2026-11-23', at: 1, barcode: '1', name: 'a' }, { day, at: 2, barcode: '2', name: 'b' }];   // the user's screenshot: two 98.1.0 check-ins, no amounts
  const w = C.weekPulse(legacy, day);
  assert.equal(w.daysLogged, 2, 'both days are logged');
  assert.equal(w.daysCounted, 0, 'but neither has an amount');
  assert.equal(C.weekReady(w), false, 'a card of seven blank bars is clutter');
  assert.equal(C.weekReady(C.weekPulse([E(day, 100, 10)], day)), false, 'one day is not a week');
  assert.equal(C.weekReady(C.weekPulse([E(day, 100, 10), E('2026-11-22', 100, 20)], day)), true, 'two days with an amount');
  assert.equal(C.weekReady(C.weekPulse([E(day, 100, 10), { day: '2026-11-23', at: 1, barcode: '1', name: 'old' }], day)), false, 'a legacy day does not count towards the two');
  assert.equal(C.weekReady(undefined), false); assert.equal(C.weekReady({}), false); assert.equal(C.weekReady({ daysCounted: '2' }), true);
});

test('the week card is gated, its caveat is folded away, and the biggest swap win sits with the swap list', () => {
  assert.ok(src.includes('weekReady') && src.includes('if (!weekReady(wp)) return'));
  assert.ok(src.includes('weekHtml(t, log)') && !src.includes('weekHtml(t, log, sum.best)'), 'the week card no longer takes the swap list');
  const week = src.slice(src.indexOf('function weekHtml'), src.indexOf('function listHtml'));
  assert.ok(week.includes('<details class="fs99-about"><summary>${esc(t.weekAbout)}</summary>') && week.includes('t.weekOnly'), 'the caveat is a folded note');
  assert.ok(!/<p class="fs99-low">\$\{esc\(t\.weekOnly\)\}/.test(week), 'not a visible paragraph any more');
  assert.ok(!week.includes('weekBest') && !week.includes('best'), 'no swap win inside the week card');
  const list = src.slice(src.indexOf('function listHtml'), src.indexOf('function renderHub'));
  assert.ok(list.includes('sum.best?.forGrade') && list.includes('t.listBest('), 'the biggest win belongs to the list it is about');
  assert.ok(!src.includes('weekBest'), 'the old string is gone');
});

test('the new strings exist in English and Greek, and the Greek ones are Greek', () => {
  for (const k of ['weekBars', 'weekAbout', 'listBest']) assert.equal((src.match(new RegExp(`^\\s+(?:.*[ ,{])?${k}:`, 'gm')) || []).length, 2, `${k} in both languages`);
  assert.match(src, /weekBars: 'οι μπάρες δείχνουν σάκχαρα σε σχέση με το όριο του ΠΟΥ των 50 g', weekAbout: 'Για αυτούς τους μέσους όρους'/);
  assert.match(src, /listBest: \(name, a, b\) => `Μεγαλύτερη βελτίωση: \$\{name\} \(\$\{a\} → \$\{b\}\)`/);
  assert.match(src, /listBest: \(name, a, b\) => `Biggest swap win: \$\{name\} \(\$\{a\} → \$\{b\}\)`/);
});

test('the hub sits in the page column and flows in two columns on a desktop; a phone keeps one column; the trust card is untouched', () => {
  const i = css.indexOf('/* 100.1:'); assert.ok(i > 0, 'the 100.1 block exists');
  const block = css.slice(i), wide = block.indexOf('@media (min-width: 960px)');
  assert.match(block, /@media \(min-width: 600px\) \{ \.fs98-hub \{ width: min\(1264px, calc\(100% - 64px\)\); margin-inline: auto; \} \}/, 'the page below is 1328 px wide with 32 px padding: 1264 px of content');
  assert.match(block, /@media \(min-width: 960px\) \{\s*\.fs98-hub \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(block, /\.fs98-hub > \.fs98-head, \.fs98-hub > \.fs98-stats, \.fs98-hub > \.fs100-wide, \.fs98-hub > \.fs98-more, \.fs98-hub > \.fs98-status \{ grid-column: 1 \/ -1; \}/);
  assert.ok(wide > 0 && !block.slice(0, wide).includes('display: grid'), 'below 960 px nothing becomes a grid: one column on a phone');
  assert.ok(src.includes('<div class="fs98-sec fs100-wide fs104-quick"><p class="fs98-sec__label">${esc(t.quickLogLabel)}</p>'), 'the quick-log row spans both columns');
  assert.ok(!block.includes('.fs98-trust'), 'the product-page card is not touched');
  assert.ok(css.includes('.fs100-hint') && src.includes('class="fs100-hint"'));
});

test('100.1 is carried by every file that carries a version', () => {
  assert.match(read('sw.js'), /const CACHE = 'foodscan-106\.0\.0'/);
  assert.match(read('_worker.js'), /var VERSION = "106\.0\.0"/);
  assert.match(read('src/worker/core.js'), /var VERSION = "106\.0\.0"/);
  assert.match(read('prices/native-v83.js'), /BUILD = 'foodscan-106\.0\.0'/);
  assert.match(read('price-refresh/tools/verify-deploy.mjs'), /'106\.0\.0'/);
  for (const page of ['index.html', 'how/index.html', 'demo/index.html', 'prices/index.html']) assert.match(read(page), /data-foodscan-version="106\.0\.0"/, page);
  assert.ok(src.includes("version: '106.0.0'"), 'the backup file names the version');
  assert.ok(fs.existsSync(path.join(ROOT, 'RELEASE-106.0.0.md')), 'release notes');
});
