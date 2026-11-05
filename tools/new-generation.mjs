#!/usr/bin/env node
/** New asset generation for the browser app. /assets/* is cached for a year, so a changed module must get a NEW file name, and every file that imports it too.
 *   node tools/new-generation.mjs v8300 v8400 domain-v8100.mjs=domain-v8400.mjs market-catalogue-v8100.mjs=market-catalogue-v8400.mjs ...
 * Copies every assets/*-<from>.js to *-<to>.js, rewrites its imports (the generation suffix and the listed module renames), and copies each listed module under
 * its new name (with the same import rewrites). The old files stay, so a tab left open on the previous release keeps working. Then update index.html, how/, demo/
 * and sw.js the same way (the script prints the replacement pairs). */
import fs from 'node:fs';
import path from 'node:path';
const [from, to, ...renames] = process.argv.slice(2);
if (!/^v\d+$/.test(from || '') || !/^v\d+$/.test(to || '')) { console.error('usage: node tools/new-generation.mjs v8300 v8400 [old.mjs=new.mjs ...]'); process.exit(2); }
const dir = path.resolve('assets');
const pairs = [[`-${from}.js`, `-${to}.js`], ...renames.map(r => r.split('='))];
const rewrite = text => pairs.reduce((t, [a, b]) => t.split(a).join(b), text);
let n = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(`-${from}.js`))) { fs.writeFileSync(path.join(dir, f.replace(`-${from}.js`, `-${to}.js`)), rewrite(fs.readFileSync(path.join(dir, f), 'utf8'))); n++; }
for (const [a, b] of renames.map(r => r.split('='))) { fs.writeFileSync(path.join(dir, b), rewrite(fs.readFileSync(path.join(dir, a), 'utf8'))); n++; }
console.log(`${n} files written. Replace in index.html, how/index.html, demo/index.html and sw.js:`); for (const [a, b] of pairs) console.log(`  ${a}  ->  ${b}`);
