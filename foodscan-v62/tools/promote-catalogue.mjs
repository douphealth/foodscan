#!/usr/bin/env node
/** Promotes a verified catalogue into the release configuration, atomically, with a one-command rollback.
 *   node tools/promote-catalogue.mjs --from build/catalogue --previous <dir of the catalogue now shipped> --name greece-r20261101
 *   node tools/promote-catalogue.mjs --rollback
 * Promotion = verify (tools/verify-catalogue.mjs gates) -> copy to catalogues/<name> -> write release.json to a temp file and rename it over the
 * old one (release.previous.json keeps the old configuration). Nothing is deployed. Rollback restores release.previous.json. */
import { cpSync, existsSync, readFileSync, renameSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCatalogue } from './verify-catalogue.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const root = arg('--root', '') ? resolve(arg('--root')) : fileURLToPath(new URL('..', import.meta.url)), cfgFile = join(root, 'release.json'), prevFile = join(root, 'release.previous.json');
if (process.argv.includes('--rollback')) {
  if (!existsSync(prevFile)) { console.error('no release.previous.json to restore'); process.exit(1); }
  copyFileSync(prevFile, `${cfgFile}.tmp`); renameSync(`${cfgFile}.tmp`, cfgFile); console.log('release.json restored from release.previous.json; rebuild to ship the previous catalogue'); process.exit(0);
}
const from = resolve(arg('--from', 'build/catalogue')), name = arg('--name', '');
if (!/^greece-r\d{8}$/.test(name)) { console.error('--name must look like greece-r20261101'); process.exit(2); }
const result = verifyCatalogue(from, { previous: arg('--previous', '') ? resolve(arg('--previous')) : '', maxAgeDays: Number(arg('--max-age-days', 7)) });
for (const c of result.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ': ' + c.detail : ''}`);
if (!result.ok) { console.error('REFUSED: the catalogue failed its gates, nothing was changed'); process.exit(1); }
const target = join(root, 'catalogues', name); mkdirSync(join(root, 'catalogues'), { recursive: true });
if (existsSync(target)) { console.error(`${target} exists; pick a new name`); process.exit(1); }
cpSync(from, target, { recursive: true });
const cfg = JSON.parse(readFileSync(cfgFile, 'utf8')); copyFileSync(cfgFile, prevFile);
Object.assign(cfg, { catalogueSource: `catalogues/${name}`, catalogueDir: name });
writeFileSync(`${cfgFile}.tmp`, JSON.stringify(cfg, null, 2) + '\n'); renameSync(`${cfgFile}.tmp`, cfgFile);
console.log(`promoted ${result.products} products as ${name}; run npm run build, npm test, npm run e2e, then stage the ZIP. Rollback: node tools/promote-catalogue.mjs --rollback`);
