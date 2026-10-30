/** The real Better-choices pipeline (shipped modules, in Chromium), every food-API call refused, over a deterministic sample of real catalogue
 * products. Asserts the invariants the product promises. Run: node --test tests/recommendations.spec.mjs */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT, SUFFIX } from './helpers.mjs';

const PORT = 8812; let server, result;
before(async () => {
  server = spawn(process.execPath, [join(ROOT, 'tools', 'serve.mjs'), '--port', String(PORT), '--offline'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('no server')), 20000); server.stdout.on('data', d => { if (String(d).includes('emulator')) { clearTimeout(t); resolve(); } }); });
  const out = join(mkdtempSync(join(tmpdir(), 'fs62-')), 'rec.json');
  execFileSync(process.execPath, [join(ROOT, 'tools', 'rec-harness.mjs'), '--base', `http://localhost:${PORT}`, '--suffix', SUFFIX, '--dir', join(ROOT, 'app/assets/greece-v610'), '--out', out, '--per-family', '2'], { cwd: ROOT, stdio: 'pipe', timeout: 240000 });
  result = JSON.parse(readFileSync(out, 'utf8'));
});
after(() => server?.kill());
const rank = g => 'ABCDE'.indexOf(g);

test('a higher-grade suggestion is strictly higher, and opens as the grade it was shown with', () => {
  let items = 0;
  for (const r of result.rows) for (const b of r.better) {
    items++;
    assert.ok(rank(b.shown) >= 0 && rank(b.shown) < rank(r.base.grade), `${r.name} (${r.base.grade}) -> ${b.name} (${b.shown})`);
    assert.equal(b.opened?.grade, b.shown, `${r.name}: ${b.name} shown ${b.shown}, opens as ${b.opened?.grade}`);
    assert.match(b.shownMethod || '', /2023/, `${b.name}: a higher-grade claim needs a comparable 2023 method`);
    assert.equal(b.basis, r.basis, `${b.name}: per-100 g and per-100 ml are never compared`);
  }
  assert.ok(items >= 20, `${items} higher-grade suggestions exercised`);
});

test('same-grade options are peers, never presented as higher-grade choices', () => {
  for (const r of result.rows) {
    for (const p of r.peers) assert.equal(p.shown, r.base.grade, `${r.name}: peer ${p.name}`);
    for (const b of r.better) assert.notEqual(b.shown, r.base.grade, `${r.name}: ${b.name} is not better`);
  }
});

test('nutrient comparisons never claim a grade and only list real reductions', () => {
  let n = 0;
  for (const r of result.rows) for (const x of r.nutrition) for (const i of x.improvements) { n++; assert.ok(i.to < i.from, `${r.name}: ${x.name} ${i.key} ${i.from} -> ${i.to}`); assert.ok(i.percent >= 1 && i.percent <= 100); }
  assert.ok(n > 10);
});

test('no outage dead end: with the food API unreachable every sampled product still gets an answer from the catalogue', () => {
  const answered = result.rows.filter(r => !r.error && r.status);
  assert.ok(answered.length >= result.rows.length - 2, `${answered.length} of ${result.rows.length} answered`);
  for (const r of answered) assert.ok(['better', 'top', 'nutrition', 'compare', 'none', 'category'].includes(r.status), `${r.name}: ${r.status}`);
  assert.ok(result.rows.every(r => !r.error || r.error === 'not-in-catalogue'));
  assert.ok(result.summary.status.error === undefined, JSON.stringify(result.summary.status));
});

test('relevance: nothing suggested for a chocolate bar is cocoa powder, a cream dessert or a pastry; kalathaki is never cottage cheese', () => {
  for (const r of result.rows) for (const x of [...r.better, ...r.peers, ...r.nutrition, ...r.compare]) {
    if (r.family === 'chocolate' && /bar|tablet|σοκολάτα/i.test(r.name)) assert.doesNotMatch(x.name, /^(κακαο|cacao|cocoa)\b|κρεμα|μπουγάτσα/i, `${r.name} -> ${x.name}`);
    if (/kalathaki/i.test(r.name)) assert.doesNotMatch(x.name, /cottage|творог/i, `${r.name} -> ${x.name}`);
  }
});

test('latency: p95 of an offline recommendation is under one second on the test machine', () => {
  assert.ok(result.summary.latency.p95 < 1000, JSON.stringify(result.summary.latency));
});
