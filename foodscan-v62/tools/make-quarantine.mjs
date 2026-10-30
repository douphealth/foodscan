#!/usr/bin/env node
/** Catalogue quarantine report: records the engine will not grade or recommend, with the reason, plus duplicate-identity groups.
 * Source records are never deleted or edited: quarantine is applied at read time by the shared engine (dataQuality). */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { catalogue, domain } from '../tests/helpers.mjs';

const out = resolve(process.argv[2] || 'release-qa/catalogue-quarantine.json');
const dom = await domain(), { manifest, records } = catalogue();
const snapshot = { provider: 'openfoodfacts-daily-export', exportedAt: manifest.exportedAt, revision: manifest.revision };
const blocked = [], pointsDiffer = [], estimatedNutrition = [], identity = new Map(); let noNutrition = 0, unnamed = 0;
for (const { raw } of records) {
  const parsed = dom.parseProduct({ product: raw, fetchedAt: manifest.exportedAt }, String(raw.code)); if (!parsed) continue;
  const p = { ...parsed, catalogueSnapshot: snapshot }, q = dom.dataQuality(p), a = dom.assessGrade(p);
  if (q.state === 'blocked') blocked.push({ code: raw.code, name: p.name, reasons: q.reasons });
  if (a.caveats?.some(c => /works out to/.test(c))) pointsDiffer.push({ code: raw.code, name: p.name, published: p.nutriScore, publishedPoints: p.nutriScoreValue, estimatedValues: !!p.nutritionEstimated });
  if (p.nutritionEstimated) estimatedNutrition.push(raw.code);
  if (!Object.values(p.nutrition).some(v => v != null && typeof v === 'number')) noNutrition++;
  if (p.nameMissing) unnamed++;
  const key = `${(p.brand || '').toLowerCase()}|${(p.name || '').toLowerCase()}|${(p.quantity || '').toLowerCase()}`;
  if (p.name && !p.nameMissing) (identity.get(key) || identity.set(key, []).get(key)).push(raw.code);
}
const duplicates = [...identity.entries()].filter(([, v]) => v.length > 1).map(([key, codes]) => ({ key, codes }));
const report = { revision: manifest.revision, products: records.length, note: 'Nothing is deleted from the shipped catalogue. The shared engine withholds grades for blocked records and never recommends them.',
  counts: { blocked: blocked.length, pointsDifferFromPublished: pointsDiffer.length, ingredientEstimatedNutrition: estimatedNutrition.length, noNutritionValues: noNutrition, noProductName: unnamed, duplicateIdentityGroups: duplicates.length, duplicateRecords: duplicates.reduce((n, d) => n + d.codes.length, 0) },
  blocked, pointsDiffer, ingredientEstimatedNutrition: estimatedNutrition, duplicateIdentity: duplicates };
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report));
console.log(JSON.stringify(report.counts));
