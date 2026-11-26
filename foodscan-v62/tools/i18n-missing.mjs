#!/usr/bin/env node
/** Lists user-visible domain messages (t("...") in src/domain.mjs) that the Greek dictionary shipped in the app does not translate.
 *   node tools/i18n-missing.mjs [--dict app/assets/chunk-BQKWV521-v620.js] [--add src/i18n-el-62.json] */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const dict = (await import(pathToFileURL(resolve(arg('--dict', `app/assets/chunk-BQKWV521-${JSON.parse(readFileSync('release.json', 'utf8')).suffix}.js`))).href)).default;
const added = existsSync(resolve(arg('--add', 'src/i18n-el-62.json'))) ? JSON.parse(readFileSync(resolve(arg('--add', 'src/i18n-el-62.json')), 'utf8')) : {};
const src = readFileSync('src/domain.mjs', 'utf8') + readFileSync('src/domain/nutriscore2023.mjs', 'utf8');
const found = new Set();
for (const m of src.matchAll(/\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/g)) found.add(JSON.parse(`"${(m[1] ?? m[2]).replace(/"/g, '\\"')}"`.replace(/\\\\"/g, '\\"')));
for (const m of src.matchAll(/\btn\(\s*[^,]+,\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"/g)) { found.add(m[1]); found.add(m[2]); }
const missing = [...found].filter(s => s.length > 12 && !(s in dict) && !(s in added) && /[a-z]{3}/i.test(s) && !/^\$\{/.test(s));
console.log(`domain messages: ${found.size}; untranslated: ${missing.length}`);
for (const s of missing) console.log(JSON.stringify(s));
if (process.argv.includes('--strict') && missing.length) process.exit(1);
