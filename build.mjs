#!/usr/bin/env node
/** FoodScan worker build: concatenates the module files listed in src/worker/manifest.json, in order, into _worker.js (the Cloudflare Pages advanced-mode worker).
 *
 *   node build.mjs            write _worker.js
 *   node build.mjs --check    build in memory and fail (exit 1) if it differs from the _worker.js on disk
 *   node build.mjs --out FILE write somewhere else
 *
 * What the modules are: the worker was produced by a bundler that keeps one comment per source module ("// src/domain/grade.js", "// worker/_worker.js", ...).
 * src/ holds those modules, cut at those markers, in the order they run. They are the bundler's OUTPUT for each module (plain functions and consts, no
 * import/export lines), not the original ES-module sources, which were never committed to this repository. Editing a module and running this script is the
 * supported way to change the worker; `--check` and qa/source.test.mjs keep the modules and the deployed file in sync. No dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export function build(root = ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/worker/manifest.json'), 'utf8'));
  const parts = manifest.files.map(f => fs.readFileSync(path.join(root, f.file)));
  return { manifest, output: Buffer.concat(parts), files: manifest.files.map(f => f.file) };
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
  const { manifest, output } = build();
  const target = path.resolve(ROOT, arg('--out') || manifest.output);
  if (process.argv.includes('--check')) {
    const onDisk = fs.existsSync(target) ? fs.readFileSync(target) : Buffer.alloc(0);
    const same = Buffer.compare(onDisk, output) === 0;
    console.log(same ? `OK: ${manifest.files.length} modules rebuild ${path.relative(ROOT, target)} exactly (sha256 ${sha(output).slice(0, 16)}...)` : `DIFFERENT: the modules build ${output.length} bytes (${sha(output).slice(0, 16)}...), ${path.relative(ROOT, target)} has ${onDisk.length} (${sha(onDisk).slice(0, 16)}...). Run: node build.mjs`);
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(target, output);
  console.log(`wrote ${path.relative(ROOT, target)}: ${output.length} bytes from ${manifest.files.length} modules (sha256 ${sha(output).slice(0, 16)}...)`);
}
