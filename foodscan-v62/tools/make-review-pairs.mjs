#!/usr/bin/env node
/** Builds the human review packet for Better-choices relevance: >= 200 (scanned product, offered product) pairs the engine really produced for real
 * Greek catalogue products, spread across food families and across the four kinds of offer (higher grade, same grade, nutrient comparison,
 * comparison only). Reviewers fill `verdict` with same-use | acceptable | wrong; tools/score-review.mjs turns the filled file into precision.
 *   node tools/make-review-pairs.mjs <rec-harness.json> [--n 220] [--out release-qa/review-pairs.json] */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const { rows } = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8')), N = Number(arg('--n', 220));
const KINDS = [['better', 'higher-grade'], ['peers', 'same-grade'], ['nutrition', 'nutrient-comparison'], ['compare', 'comparison-only']];
const pool = {};
for (const r of rows) for (const [key, kind] of KINDS) for (const c of (r[key] || []).slice(0, 2)) (pool[r.family] ||= []).push({ family: r.family, kind, base: { code: r.code, name: r.name, brand: r.brand || '', grade: r.base?.grade || null }, candidate: { code: c.code, name: c.name, brand: c.brand || '', grade: c.shown || null }, verdict: null, reviewer: null, notes: '' });
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
for (const list of Object.values(pool)) list.sort((a, b) => hash(a.base.code + a.candidate.code) - hash(b.base.code + b.candidate.code));
const picked = []; const families = Object.keys(pool).sort();
for (let i = 0; picked.length < N && families.some(f => pool[f][i]); i++) for (const f of families) if (pool[f][i] && picked.length < N) picked.push(pool[f][i]);
picked.forEach((p, i) => { p.id = i + 1; });
const out = resolve(arg('--out', 'release-qa/review-pairs.json'));
writeFileSync(out, JSON.stringify({ instructions: 'verdict: "same-use" (a shopper would treat them as the same kind of product), "acceptable" (reasonable alternative, different form), or "wrong" (different use). Fill reviewer with your name. Needs at least 200 reviewed pairs and every family >= 5 for tools/score-review.mjs to pass.', pairs: picked }, null, 1));
writeFileSync(out.replace(/\.json$/, '.csv'), ['id,family,kind,base_code,base_name,base_grade,offered_code,offered_name,offered_grade,verdict,reviewer,notes', ...picked.map(p => [p.id, p.family, p.kind, p.base.code, p.base.name, p.base.grade, p.candidate.code, p.candidate.name, p.candidate.grade, '', '', ''].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n'));
const byFamily = {}; for (const p of picked) byFamily[p.family] = (byFamily[p.family] || 0) + 1;
console.log(JSON.stringify({ pairs: picked.length, families: byFamily, kinds: Object.fromEntries(KINDS.map(([, k]) => [k, picked.filter(p => p.kind === k).length])) }));
