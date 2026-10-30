#!/usr/bin/env node
/** Replays a review packet (release-qa/review-pairs.json from an earlier release) through the CURRENT matching rules and says which pairs would
 * no longer be offered, and why. Used to show the effect of a rules change on pairs a human already saw or will review.
 *   node tools/replay-review-pairs.mjs [packet.json] [--out release-qa/review-replay.json] */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalogue, domain } from '../tests/helpers.mjs';
import { productUseMatch, productKind } from '../src/match-policy.mjs';
import { compatibleFoods } from '../src/comparison-guards.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const packet = JSON.parse(readFileSync(resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'release-qa/review-pairs.json'), 'utf8'));
const dom = await domain(), { manifest, byCode } = catalogue();
const snapshot = { provider: 'openfoodfacts-daily-export', exportedAt: manifest.exportedAt };
const load = code => { const r = byCode.get(code) || byCode.get(String(code).replace(/^0+/, '')); if (!r) return null; const p = dom.parseProduct({ product: r.raw, fetchedAt: manifest.exportedAt }, String(r.raw.code)); return p && { family: r.family, p: { ...p, catalogueSnapshot: snapshot } }; };
const rows = [];
for (const pair of packet.pairs) {
  const a = load(pair.base.code), b = load(pair.candidate.code);
  if (!a || !b) { rows.push({ id: pair.id, family: pair.family, kind: pair.kind, status: 'record-missing' }); continue; }
  const useOk = productUseMatch(a.p, b.p, a.family), still = compatibleFoods(a.p, b.p, () => a.family, a.family);
  const ga = dom.assessGrade(a.p), gb = dom.assessGrade(b.p);
  const higherNeedsEvidence = pair.kind === 'higher-grade' && !(ga.method && gb.method);
  rows.push({ id: pair.id, family: pair.family, kind: pair.kind, base: pair.base.name, offered: pair.candidate.name, baseType: productKind(a.p, a.family).type, offeredType: productKind(b.p, a.family).type, stillOffered: still && !higherNeedsEvidence, reason: !useOk.ok ? useOk.reason : !still ? 'not-compatible' : higherNeedsEvidence ? 'grade-evidence-not-comparable' : null });
}
const dropped = rows.filter(r => r.stillOffered === false);
const summary = { replayed: rows.length, stillOffered: rows.filter(r => r.stillOffered).length, noLongerOffered: dropped.length, byReason: dropped.reduce((m, r) => (m[r.reason] = (m[r.reason] || 0) + 1, m), {}), byKind: dropped.reduce((m, r) => (m[r.kind] = (m[r.kind] || 0) + 1, m), {}), missing: rows.filter(r => r.status === 'record-missing').length };
writeFileSync(resolve(arg('--out', 'release-qa/review-replay.json')), JSON.stringify({ summary, dropped }, null, 1));
console.log(JSON.stringify(summary));
