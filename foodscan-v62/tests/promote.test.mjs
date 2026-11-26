import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, CATALOGUE_DIR } from './helpers.mjs';
import { buildCatalogue } from '../tools/build-catalogue.mjs';
import { verifyCatalogue } from '../tools/verify-catalogue.mjs';

// Gates, atomic promotion and rollback, on a catalogue built by the real builder from an export-shaped CSV (the shipped records, real column names).
const LISTS = ['categories_tags', 'labels_tags', 'countries_tags', 'traces_tags', 'additives_tags', 'ingredients_analysis_tags', 'data_quality_errors_tags'], TEXTS = ['product_name', 'brands', 'generic_name', 'quantity', 'serving_size', 'ingredients_text', 'pnns_groups_1', 'pnns_groups_2', 'stores', 'nutriscore_grade'], NUMS = ['last_modified_t', 'serving_quantity', 'product_quantity', 'nutriscore_score', 'nova_group', 'additives_n'];
const clean = v => String(v).replace(/[\t\r\n]+/g, ' ');
let work, good, csvText;
async function make(name, { drop = 0, exportedAt = '2026-10-30T00:00:00Z' } = {}) {
  const out = join(work, name); await buildCatalogue({ csv: join(work, drop ? `export-${drop}.csv` : 'export.csv'), country: 'greece', out, exportedAt, version: 'test' }); return out;
}
test('setup: an export-shaped CSV from the shipped records, built into a catalogue that passes every gate', async () => {
  work = mkdtempSync(join(tmpdir(), 'fs-promote-'));
  const { catalogue } = await import('./helpers.mjs'), { records } = catalogue(), nutrients = [...new Set(records.flatMap(r => Object.keys(r.raw.nutriments)))].sort();
  const header = ['code', ...TEXTS, ...LISTS, ...NUMS, 'allergens', 'image_url', 'image_small_url', ...nutrients];
  const row = ({ raw }) => header.map(h => h === 'code' ? raw.code : h === 'allergens' ? (raw.allergens_tags || []).join(',') : h === 'image_url' ? raw.image_front_url || '' : h === 'image_small_url' ? raw.image_front_small_url || '' : LISTS.includes(h) ? clean((raw[h] || []).join(',')) : TEXTS.includes(h) ? clean(raw[h] ?? '') : NUMS.includes(h) ? (raw[h] ?? '') : (raw.nutriments[h] ?? '')).join('\t');
  csvText = [header.join('\t'), ...records.map(row)];
  writeFileSync(join(work, 'export.csv'), csvText.join('\n') + '\n');
  writeFileSync(join(work, 'export-1.csv'), [csvText[0], ...csvText.slice(1, 3000)].join('\n') + '\n'); // a truncated export: a quarter of the products
  good = await make('good');
  const r = verifyCatalogue(good, { previous: CATALOGUE_DIR, maxAgeDays: 9999 });
  assert.equal(r.ok, true, JSON.stringify(r.checks.filter(c => !c.ok))); assert.equal(r.products, 12113);
});

test('gates refuse damage: a flipped byte, a missing shard, a truncated export, a stale or future snapshot, a duplicate barcode', async () => {
  const bad = join(work, 'tampered'); cpSync(good, bad, { recursive: true });
  const shard = readdirSync(bad).find(f => /^part-bread/.test(f)), text = readFileSync(join(bad, shard), 'utf8');
  writeFileSync(join(bad, shard), text.replace('Ψωμί', 'Ψωμι'));
  assert.ok(verifyCatalogue(bad, { maxAgeDays: 9999 }).checks.find(c => c.name === 'shards' && !c.ok), 'a changed byte is caught by the SHA-256 gate');
  rmSync(join(bad, shard)); assert.throws(() => verifyCatalogue(bad, { maxAgeDays: 9999 }), /ENOENT/, 'a missing shard cannot pass');
  const small = await make('small', { drop: 1 });
  const shrink = verifyCatalogue(small, { previous: CATALOGUE_DIR, maxAgeDays: 9999, families: 0 }); assert.ok(shrink.checks.find(c => c.name === 'product count change' && !c.ok), 'a catalogue that lost most products is refused');
  assert.ok(verifyCatalogue(good, { maxAgeDays: 7, now: Date.parse('2026-12-01') }).checks.find(c => c.name === 'snapshot date' && !c.ok), 'an old snapshot is refused');
  assert.ok(verifyCatalogue(good, { maxAgeDays: 9999, now: Date.parse('2026-10-01') }).checks.find(c => c.name === 'snapshot date' && !c.ok), 'a future snapshot is refused');
  const dup = join(work, 'dup'); cpSync(good, dup, { recursive: true });
  const first = readdirSync(dup).find(f => /^part-/.test(f)), data = JSON.parse(readFileSync(join(dup, first), 'utf8')); data.products.push({ ...data.products[0] });
  writeFileSync(join(dup, first), JSON.stringify(data)); assert.ok(verifyCatalogue(dup, { maxAgeDays: 9999 }).checks.some(c => !c.ok), 'a duplicate barcode cannot pass');
});

test('promotion is atomic and reversible: refused catalogues change nothing, a verified one is adopted, rollback restores the previous release.json', () => {
  const ws = join(work, 'workspace'); cpSync(ROOT + '/release.json', join(ws, 'release.json'), { recursive: true });
  const run = (...args) => spawnSync(process.execPath, [join(ROOT, 'tools', 'promote-catalogue.mjs'), '--root', ws, ...args], { encoding: 'utf8' });
  const before = readFileSync(join(ws, 'release.json'), 'utf8');
  assert.equal(run('--from', join(work, 'small'), '--name', 'greece-r20261030', '--previous', CATALOGUE_DIR, '--max-age-days', '9999').status, 1, 'a failing catalogue is refused');
  assert.equal(readFileSync(join(ws, 'release.json'), 'utf8'), before, 'a refusal changes nothing'); assert.equal(existsSync(join(ws, 'catalogues')), false);
  assert.equal(run('--from', good, '--name', 'bad-name', '--max-age-days', '9999').status, 2);
  const ok = run('--from', good, '--name', 'greece-r20261030', '--previous', CATALOGUE_DIR, '--max-age-days', '9999'); assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const cfg = JSON.parse(readFileSync(join(ws, 'release.json'), 'utf8')); assert.equal(cfg.catalogueDir, 'greece-r20261030'); assert.equal(cfg.catalogueSource, 'catalogues/greece-r20261030');
  assert.equal(readFileSync(join(ws, 'release.previous.json'), 'utf8'), before, 'the previous configuration is kept');
  assert.equal(run('--from', good, '--name', 'greece-r20261030', '--max-age-days', '9999').status, 1, 'a name is never reused');
  assert.equal(run('--rollback').status, 0); assert.equal(readFileSync(join(ws, 'release.json'), 'utf8'), before, 'rollback restores the previous configuration exactly');
});
