import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers.mjs';

const { build } = await import(pathToFileURL(path.join(ROOT, 'build.mjs')).href);

test('src/ modules rebuild the deployed _worker.js byte for byte (edit a module, run `node build.mjs`, commit both)', () => {
  const { output, files } = build(ROOT);
  const onDisk = fs.readFileSync(path.join(ROOT, '_worker.js'));
  assert.equal(Buffer.compare(output, onDisk), 0, 'src/ and _worker.js differ: run `node build.mjs`');
  assert.ok(files.length >= 20);
});
test('the manifest lists every module file, with the right sizes, and no stray module is left out', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/worker/manifest.json'), 'utf8'));
  for (const f of m.files) assert.equal(fs.statSync(path.join(ROOT, f.file)).size, f.bytes, f.file);
  const listed = new Set(m.files.map(f => f.file)); const onDisk = [];
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.js$/.test(e.name) && onDisk.push(path.join(d, e.name).split(path.sep).join('/')));
  walk('src'); assert.deepEqual(onDisk.sort(), [...listed].sort());
});
test('the module names match the bundler markers they came from (src/domain/grade.js starts with its marker)', () => {
  for (const [file, marker] of [['src/domain/grade.js', '// src/domain/grade.js'], ['src/lib/i18n.js', '// src/lib/i18n.js'], ['src/domain/nutriscore2023.js', '// src/domain/nutriscore2023.js'], ['src/worker/prices.js', '/* BEGIN FOODSCAN PRICES 72 */']])
    assert.ok(fs.readFileSync(path.join(ROOT, file), 'utf8').startsWith(marker), file);
});
