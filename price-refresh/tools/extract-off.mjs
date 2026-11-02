#!/usr/bin/env node
/** Stream the Open Food Facts CSV export and keep the columns the price tools need for
 *  (a) every product sold in Greece and (b) every barcode that has a price in the bundled seeds.
 *    node tools/extract-off.mjs <off.csv.gz> <out.json> [--seeds <dir with the 4 seed files>]
 *  Output: { exportedAt, rows: [[code, name, brands, quantity, product_quantity, categories_tags, pnns2, countries_tags, scans], ...] } */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';

const [, , input, output] = process.argv;
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const seedDir = arg('--seeds', 'D:/Claude/FoodScan/v77-work/app/assets/gr-prices-v72');
const wanted = new Set();
for (const f of fs.readdirSync(seedDir).filter(f => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(seedDir, f), 'utf8'));
  for (const k of Object.keys(j.products || {})) wanted.add(k.replace(/^0+/, ''));
}
console.error('wanted barcodes from seeds:', wanted.size);

const rl = readline.createInterface({ input: fs.createReadStream(input).pipe(zlib.createGunzip()), crlfDelay: Infinity });
let header = null, idx = null, n = 0;
const rows = [];
for await (const line of rl) {
  if (!header) {
    header = line.split('\t');
    const want = ['code', 'product_name', 'brands', 'quantity', 'product_quantity', 'categories_tags', 'pnns_groups_2', 'countries_tags', 'unique_scans_n', 'generic_name'];
    idx = Object.fromEntries(want.map(k => [k, header.indexOf(k)]));
    console.error(idx);
    continue;
  }
  n++;
  // cheap pre-filter before the split
  const cols = line.split('\t');
  const code = cols[idx.code];
  const countries = cols[idx.countries_tags] || '';
  const greek = countries.includes('en:greece') || String(code).startsWith('520'); // 520 = GS1 Greece prefix
  if (!greek && !wanted.has(String(code).replace(/^0+/, ''))) continue;
  rows.push([code, cols[idx.product_name] || '', cols[idx.brands] || '', cols[idx.quantity] || '', cols[idx.product_quantity] || '',
    cols[idx.categories_tags] || '', cols[idx.pnns_groups_2] || '', countries, cols[idx.unique_scans_n] || '', cols[idx.generic_name] || '']);
  if (n % 500000 === 0) console.error(n, rows.length);
}
fs.writeFileSync(output, JSON.stringify({ exportedAt: new Date().toISOString(), source: input, rows }));
console.error('done', n, 'rows scanned,', rows.length, 'kept');
