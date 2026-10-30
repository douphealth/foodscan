#!/usr/bin/env node
/** Builds the 62.0 catalogue search index (compact rows with a precomputed Greek/Latin skeleton) from the shipped catalogue's search.json.
 *   node tools/build-search-index.mjs <catalogue dir> <output file>
 * Row: [barcode, shard file, country tags, skeleton of "name brand"]. The skeleton function is the one the browser applies to queries. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { skeleton } from '../src/market-catalogue.mjs';

const [dir, out] = [resolve(process.argv[2]), resolve(process.argv[3])];
const manifest = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')), source = JSON.parse(readFileSync(join(dir, 'search.json'), 'utf8'));
if (source.revision !== manifest.revision) throw new Error('search.json revision does not match index.json');
const rows = source.rows.map(([code, name, brand, file, countries]) => [code, file, countries || [], skeleton(`${name || ''} ${brand || ''}`)]);
writeFileSync(out, JSON.stringify({ schema: 2, revision: manifest.revision, rows }));
console.log(`search index: ${rows.length} rows -> ${out}`);
