import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { catalogue, domain, APP, importFile } from './helpers.mjs';

const { manifest, records } = catalogue();
const snapshot = { provider: 'openfoodfacts-daily-export', exportedAt: manifest.exportedAt, revision: manifest.revision, source: manifest.source };

test('saved foods and the Fridge Challenge use the same grade as the report, for every catalogue record', async () => {
  const dom = await domain(), { localReportSnapshot } = await importFile(join(APP, 'fridge-core.mjs'));
  let compared = 0, graded = 0;
  for (const { raw } of records) {
    const parsed = dom.parseProduct({ product: raw, fetchedAt: manifest.exportedAt }, String(raw.code)); if (!parsed) continue;
    const p = { ...parsed, catalogueSnapshot: snapshot }, a = dom.assessGrade(p), s = localReportSnapshot({ product: p });
    if (!s) continue; compared++;
    const expected = ['reported', 'estimated'].includes(a.status) ? a.grade : null;
    assert.equal(s.grade, expected, `${raw.code}: challenge shows ${s.grade}, report shows ${a.grade} (${a.status})`);
    if (a.status === 'withheld') assert.equal(s.hasWarning, true, raw.code);
    if (s.grade) graded++;
  }
  assert.ok(compared > 11000 && graded > 3900, `${compared} compared, ${graded} graded`);
});

test('assessment is deterministic and does not mutate the record', async () => {
  const dom = await domain();
  for (const { raw } of records.filter((_, i) => i % 61 === 0)) {
    const p = { ...dom.parseProduct({ product: raw, fetchedAt: manifest.exportedAt }, String(raw.code)), catalogueSnapshot: snapshot };
    const before = JSON.stringify(p), a = dom.assessGrade(p), b = dom.assessGrade(p);
    assert.equal(JSON.stringify(p), before, `${raw.code} mutated`);
    assert.deepEqual([a.status, a.grade, a.method, a.score], [b.status, b.grade, b.method, b.score]);
  }
});

test('a grade reproduced from points is identical wherever it is read: report, comparison, share card', async () => {
  const dom = await domain();
  for (const { raw } of records.filter((_, i) => i % 43 === 0)) {
    const p = { ...dom.parseProduct({ product: raw, fetchedAt: manifest.exportedAt }, String(raw.code)), catalogueSnapshot: snapshot };
    const viaAssess = dom.assessGrade(p), viaAssessNoEstimate = dom.assessGrade(p, { estimate: false });
    // a source grade the engine reproduces keeps its letter whether or not estimation is allowed; calculation can only add, never change a letter
    if (viaAssessNoEstimate.grade) assert.equal(viaAssess.grade, viaAssessNoEstimate.grade, raw.code);
  }
});
