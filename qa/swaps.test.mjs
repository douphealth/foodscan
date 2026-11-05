/* Healthier swaps (prices/swaps-v88.mjs): same shelf, strictly better grade, never a drink for a food, and the printed figures never exceed what was measured. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const imp = p => import(new URL('../' + p, import.meta.url));
const W = await imp('prices/swaps-v88.mjs'), V = await imp('tools/swaps-validate.mjs'), B = await imp('tools/build-swaps.mjs');
const data = V.load(), prep = data.prep;

test('the swap index is exactly what the catalogue produces', () => {
  execFileSync(process.execPath, [new URL('../tools/build-swaps.mjs', import.meta.url).pathname, '--check'], { stdio: 'pipe' });
  assert.ok(prep.rows.length > 4500);
  for (const r of prep.rows) assert.match(r.grade, /^[A-E]$/);
});

test('a swap is strictly better, of the same Nutri-Score table, and the healthiest come first', () => {
  const wafer = data.items.find(x => x.raw.code === '5201004023360'), t = V.targetOf(wafer);
  assert.equal(t.grade, 'E');
  const s = W.findSwaps(t, prep); assert.ok(s.ok && s.swaps.length >= 3);
  for (const w of s.swaps) { assert.ok(W.RANK[w.row.grade] < W.RANK.E); assert.equal(w.row.kind, t.kind); }
  const ranks = s.swaps.map(w => W.RANK[w.row.grade]); assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), 'sorted best grade first');
});

test('an orange juice with no category gets juices, never biscuits: the table comes from the grade card', () => {
  const s = W.findSwaps({ code: '5201005001824', name: 'Orange', brand: '', categories: [], pnns: '', family: 'juice', kind: 'beverage', grade: null, estimate: 'C' }, prep);
  assert.ok(s.ok, JSON.stringify(s).slice(0, 200));
  for (const w of s.swaps) { assert.equal(w.row.kind, 'beverage'); assert.ok(W.RANK[w.row.grade] < W.RANK.C, 'better than the best letter the estimate allows'); }
});

test('nothing better than A, and a product with nothing to match gets nothing', () => {
  const a = data.items.find(x => x.p.nutriScore === 'A' && (x.raw.categories_tags || []).length > 3);
  assert.equal(W.findSwaps(V.targetOf(a), prep).reason, 'already-best');
  assert.equal(W.findSwaps({ code: '1', name: '', categories: [], kind: 'general', grade: 'E' }, prep).reason, 'nothing-to-match');
});

test('measured on the catalogue: coverage and same-shelf figures, and the printed ones never exceed them', { timeout: 1200000 }, () => {
  const r = V.validate(data), pct = (a, b) => 100 * a / b, R = W.SWAP_RELIABILITY, rec = r['as recorded'], inf = r['no category'];
  assert.ok(rec.n >= 3000 && rec.n <= R.sample + 200, `sample ${rec.n}`);
  assert.ok(pct(rec.covered, rec.n) >= 80, `coverage ${pct(rec.covered, rec.n).toFixed(1)}`);
  assert.ok(pct(rec.allAisle, rec.shown) >= R.aisle, `aisle printed ${R.aisle}, measured ${pct(rec.allAisle, rec.shown).toFixed(1)}`);
  assert.ok(pct(rec.all, rec.shown) >= R.shelf, `shelf printed ${R.shelf}, measured ${pct(rec.all, rec.shown).toFixed(1)}`);
  assert.ok(pct(inf.allAisle, inf.shown) >= R.aisleInferred, `inferred aisle printed ${R.aisleInferred}, measured ${pct(inf.allAisle, inf.shown).toFixed(1)}`);
  assert.ok(pct(inf.all, inf.shown) >= R.shelfInferred, `inferred shelf printed ${R.shelfInferred}, measured ${pct(inf.all, inf.shown).toFixed(1)}`);
  assert.ok(pct(rec.labelledOk, rec.labelled) >= 85, `"same shelf" label right ${pct(rec.labelledOk, rec.labelled).toFixed(1)} %`);
});

test('the Prices page uses the app design system: its tokens, light and dark, and the app dock with Prices as the current tab', () => {
  const html = fs.readFileSync(new URL('../prices/index.html', import.meta.url), 'utf8'), css = fs.readFileSync(new URL('../prices/prices-app-v88.css', import.meta.url), 'utf8');
  assert.match(html, /prices-app-v88\.css"><\/head>/, 'loaded last');
  assert.match(html, /<nav class="dock fp-dock-expanded"[\s\S]*href="\/prices\/" aria-current="page"/);
  for (const [k, light, dark] of [['--bg', '#F4EFE2', '#050F0A'], ['--surface', '#FFFDF7', '#0D1F16'], ['--brand', '#0A5C3C', '#5EDBA0']]) { assert.ok(css.includes(`${k}:${light}`), k + ' light'); assert.ok(css.includes(`${k}:${dark}`), k + ' dark'); }
  const app = fs.readFileSync(new URL('../assets/app-V52SOTA1-v7540.css', import.meta.url), 'utf8');
  assert.ok(app.includes('--bg:#050F0A') || app.toUpperCase().includes('050F0A'), 'the tokens are the app\'s own');
});
