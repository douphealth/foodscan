import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, domain } from './helpers.mjs';
import { ns23Verify } from '../src/domain/nutriscore2023.mjs';

// Real Open Food Facts API records that carry the SOURCE'S OWN component points: the calculator is checked against OFF's numbers, per product class.
const golden = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'golden-off-2023.json'), 'utf8')).classes;
const NEG = { energy: 'energy', sugars: 'sugars', saturatedFat: 'saturated_fat', salt: 'salt' };
const own = (list, id) => list.find(x => x.id === id)?.points;

test('golden fixtures cover every Nutri-Score 2023 product class', () => {
  assert.deepEqual(Object.keys(golden).sort(), ['beverage', 'cheese', 'fat', 'general', 'red-meat', 'water']);
  for (const [cls, list] of Object.entries(golden)) assert.ok(list.length >= 13, `${cls}: ${list.length} records`);
});

for (const cls of ['general', 'beverage', 'cheese', 'fat', 'red-meat']) {
  test(`golden ${cls}: points and every component equal the source's own, for at least 80% of records`, async () => {
    const dom = await domain(); let reproduced = 0, checked = 0;
    for (const raw of golden[cls]) {
      const p = dom.parseProduct({ product: raw, fetchedAt: Date.now() }, String(raw.code)); if (!p) continue; checked++;
      const v = ns23Verify(p), c = raw.nutriscore['2023'].data.components;
      if (v.status !== 'reproduced') continue;
      reproduced++;
      assert.equal(v.calc.score, raw.nutriscore_score, `${raw.code} points`); assert.equal(v.calc.grade.toLowerCase(), raw.nutriscore_grade, `${raw.code} letter`);
      for (const [mine, id] of Object.entries(NEG)) { const theirs = own(c.negative, id) ?? own(c.negative, mine === 'energy' ? 'energy_from_saturated_fat' : mine === 'saturatedFat' ? 'saturated_fat_ratio' : id); if (theirs !== undefined) assert.equal(v.calc.negative[mine], theirs, `${raw.code} ${mine}`); }
      for (const [mine, id] of [['fibre', 'fiber'], ['fvl', 'fruits_vegetables_legumes']]) { const theirs = own(c.positive, id); if (theirs !== undefined) assert.equal(v.calc.positive[mine], theirs, `${raw.code} ${mine}`); }
      assert.ok(['complete', 'robust', 'partial'].includes(v.tier), 'every reproduction carries an evidence tier');
    }
    assert.ok(checked >= 13 && reproduced / checked >= 0.8, `${cls}: reproduced ${reproduced}/${checked}`);
  });
}

test('golden water is graded A by definition', async () => {
  const dom = await domain();
  for (const raw of golden.water) { const p = dom.parseProduct({ product: raw, fetchedAt: Date.now() }, String(raw.code)); if (p) assert.equal(raw.nutriscore_grade, 'a'); }
});

test('evidence tiers: nothing is "complete" unless every favourable input was reported, and a partial grade is never comparable', async () => {
  const dom = await domain(); const seen = { complete: 0, robust: 0, partial: 0 };
  for (const cls of Object.keys(golden)) for (const raw of golden[cls]) {
    const p = dom.parseProduct({ product: raw, fetchedAt: Date.now() }, String(raw.code)); if (!p) continue;
    const v = ns23Verify(p); if (v.status !== 'reproduced') continue; seen[v.tier]++;
    const n = p.nutrition, allReported = n.fiber != null && n.protein != null && n.fvl != null;
    if (v.tier === 'complete') assert.ok(allReported, `${raw.code} complete but an input is missing`);
    if (!allReported) assert.notEqual(v.tier, 'complete', raw.code);
    if (v.tier !== 'complete') assert.ok(v.missing.length > 0, `${raw.code} has no missing inputs listed`);
  }
  assert.ok(seen.complete > 0 && seen.robust + seen.partial > 0, JSON.stringify(seen));
});
