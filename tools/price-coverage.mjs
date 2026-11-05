#!/usr/bin/env node
/** How many products of the bundled Greek catalogue have a recorded price, an estimate, or nothing, from the bundled price data (no network).
 *  For today's numbers from the published `prices-data` branch, see PRICE-COVERAGE.md. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), assets = path.join(here, '../assets');
const readAll = (dir, pre) => { const out = {}; for (const f of fs.readdirSync(path.join(assets, dir)).filter(f => f.startsWith(pre) && f.endsWith('.json') && !f.includes('manifest'))) Object.assign(out, JSON.parse(fs.readFileSync(path.join(assets, dir, f))).products || JSON.parse(fs.readFileSync(path.join(assets, dir, f))).items || {}); return out; };
const shop = s => readAll(`gr-prices-v72/${s}`, '');
const rec = { bazaar: shop('bz'), ekatanalotis: shop('ek'), lidl: shop('li'), observatory: shop('pk') }, est = readAll('gr-est-v80', 'e-');
const cat = []; for (const f of fs.readdirSync(path.join(assets, 'greece-r20261030')).filter(f => f.startsWith('part-'))) cat.push(...JSON.parse(fs.readFileSync(path.join(assets, 'greece-r20261030', f))).products);
const k = c => c.padStart(14, '0'), has = c => Object.values(rec).some(s => k(c) in s);
const recorded = cat.filter(p => has(p.code)).length, estimated = cat.filter(p => !has(p.code) && k(p.code) in est).length, pct = n => `${n} (${(100 * n / cat.length).toFixed(1)} %)`;
console.log(`Catalogue ${cat.length} products\n  recorded price (any source)  ${pct(recorded)}\n  estimate only                ${pct(estimated)}\n  nothing                      ${pct(cat.length - recorded - estimated)}`);
for (const [name, s] of Object.entries(rec)) console.log(`  ${name.padEnd(13)} ${cat.filter(p => k(p.code) in s).length} catalogue products`);
