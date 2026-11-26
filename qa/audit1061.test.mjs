/* FoodScan 106.1: the "Later" button on the "new version" bar could not be read.
 * Seen on the live 106.0.0: the bar showed "Refresh" and an empty pill. The bar inverts the page colours (background: ink, text: surface); the ghost
 * button's own colour is ink, the bar's background, so its label was invisible in the light theme and in the dark one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const rule = (css, selector) => { const i = css.indexOf(selector + '{'); assert.ok(i >= 0, selector); return css.slice(i + selector.length + 1, css.indexOf('}', i)); };

test('the bar still inverts the page colours, and the ghost button alone would repeat its background', () => {
  const app = read('assets/app-V52SOTA1-v106.css');
  assert.match(rule(app, '.updatebar'), /background:var\(--ink, #0d1f16\);color:var\(--surface, #fff\)/);
  assert.match(rule(app, '.btn--ghost'), /color:var\(--ink\)/, 'the cause: if this ever changes, the override below can go');
});

test('"Later" takes the bar’s text colour, in a stylesheet that is not cached for a year', () => {
  const css = read('prices/native-v83.css');
  assert.match(rule(css, '.updatebar .btn--ghost'), /^color:var\(--surface,#fff\);border-color:color-mix\(in srgb,var\(--surface,#fff\) 45%,transparent\)$/);
  assert.match(rule(css, '.updatebar .btn--ghost:focus-visible'), /outline:2px solid var\(--surface,#fff\)/);
  // every page that can show the bar loads this stylesheet, and the service worker keeps it
  for (const page of ['index.html', 'how/index.html', 'demo/index.html']) assert.match(read(page), /<link rel="stylesheet" href="\/prices\/native-v83\.css">/, page);
  assert.match(read('sw.js'), /'\/prices\/native-v83\.css'/);
  assert.match(read('assets/app-V52SOTA1-v106.js'), /className="updatebar"/, 'the bar is built by the app bundle, which needed no change');
});
