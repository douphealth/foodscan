#!/usr/bin/env node
/** Scores a filled review packet (release-qa/review-pairs.json): precision overall, by family and by kind of offer.
 * Release gate: >= 200 reviewed pairs, every family with >= 5 pairs reviewed, "wrong" <= 5% overall and <= 10% in any family. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { pairs } = JSON.parse(readFileSync(resolve(process.argv[2] || 'release-qa/review-pairs.json'), 'utf8'));
const reviewed = pairs.filter(p => ['same-use', 'acceptable', 'wrong'].includes(p.verdict));
const rate = list => (list.length ? list.filter(p => p.verdict === 'wrong').length / list.length : 0);
const group = key => Object.fromEntries([...new Set(reviewed.map(p => p[key]))].sort().map(k => { const l = reviewed.filter(p => p[key] === k); return [k, { reviewed: l.length, wrongPct: Math.round(rate(l) * 1000) / 10 }]; }));
const families = group('family'), kinds = group('kind');
const problems = [];
if (reviewed.length < 200) problems.push(`only ${reviewed.length} pairs reviewed (need 200)`);
if (rate(reviewed) > 0.05) problems.push(`wrong rate ${Math.round(rate(reviewed) * 1000) / 10}% > 5%`);
for (const [f, s] of Object.entries(families)) { if (s.reviewed < 5) problems.push(`${f}: ${s.reviewed} reviewed (need 5)`); if (s.wrongPct > 10) problems.push(`${f}: wrong ${s.wrongPct}% > 10%`); }
console.log(JSON.stringify({ reviewed: reviewed.length, of: pairs.length, wrongPct: Math.round(rate(reviewed) * 1000) / 10, families, kinds, problems }, null, 1));
process.exit(problems.length ? 1 : 0);
