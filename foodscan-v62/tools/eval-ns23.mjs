#!/usr/bin/env node
/** Measures src/domain/nutriscore2023.mjs against real published points: the Greece catalogue (CSV rows) and real API records
 * from earlier captures (tests/fixtures/grading-*). Prints agreement per table and every contradiction.
 *   node tools/eval-ns23.mjs [--grading <dir with country folders>] */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ns23Verify } from '../src/domain/nutriscore2023.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const { parseProduct } = await import(pathToFileURL(resolve(arg('--domain', 'app/assets/domain-v610.mjs'))).href);

function* catalogue(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
  for (const f of readdirSync(dir).filter(f => /^part-.*\.json$/.test(f))) for (const raw of JSON.parse(readFileSync(join(dir, f), 'utf8')).products) yield { raw, at: manifest.exportedAt, origin: 'catalogue' };
}
function* grading(dir) {
  if (!dir || !existsSync(dir)) return;
  const files = [];
  const walk = d => { for (const e of readdirSync(d)) { const f = join(d, e); statSync(f).isDirectory() ? walk(f) : e === 'graded.json' && files.push(f); } };
  walk(dir);
  for (const f of files) for (const raw of JSON.parse(readFileSync(f, 'utf8')).products) yield { raw, at: Date.now(), origin: 'api:' + f.split(/[\\/]/).at(-2) };
}

const stats = {};
const bump = (origin, key) => { const o = (stats[origin] ||= {}); o[key] = (o[key] || 0) + 1; };
const contradictions = [], notReproduced = [];
for (const src of [...catalogue(resolve(arg('--dir', 'app/assets/greece-v610'))), ...grading(arg('--grading', ''))]) {
  const p = parseProduct({ product: src.raw, fetchedAt: src.at }, String(src.raw.code));
  if (!p || !p.nutriScore || !Number.isFinite(p.nutriScoreValue)) { bump(src.origin, 'noPublishedPoints'); continue; }
  bump(src.origin, 'withPoints');
  const v = ns23Verify(p);
  bump(src.origin, v.status + (v.status === 'reproduced' ? ':' + v.kind + '/' + v.via : v.reason ? ':' + v.reason : ''));
  bump(src.origin, v.status);
  if (v.status === 'contradicts') contradictions.push({ code: p.barcode, name: p.name, letter: p.nutriScore, points: p.nutriScoreValue, via: v.via, kinds: v.kinds, pnns: p.pnns, cats: p.categories.slice(-2) });
  if (v.status === 'consistent' && v.reason === 'points-differ' && notReproduced.length < 25) notReproduced.push({ code: p.barcode, name: p.name, letter: p.nutriScore, points: p.nutriScoreValue, tried: v.tried.slice(0, 3), via: v.via, n: p.nutrition });
}
for (const [origin, o] of Object.entries(stats)) console.log(origin, JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))), null, 0));
console.log('\nCONTRADICTIONS', contradictions.length); for (const c of contradictions.slice(0, 40)) console.log(JSON.stringify(c));
console.log('\nPOINTS-DIFFER samples'); for (const c of notReproduced.slice(0, 12)) console.log(JSON.stringify(c).slice(0, 420));
