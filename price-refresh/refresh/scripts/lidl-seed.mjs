#!/usr/bin/env node
/* FoodScan 74 · build the bundled Lidl seed (assets/gr-prices-v72/lidl-eshop-latest.json) from product pages fetched by
 * lidl_crawl.py, using the SAME parser as the cron Worker (src/sources/lidl.mjs), so the seed and the live rows agree.
 * Usage: node ingest/scripts/lidl-seed.mjs <workdir with cache/ and sitemap.xml.gz> <out.json> */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { parseProduct, sitemapLinks, SOURCE } from '../src/sources/lidl.mjs';

const [wd = '/workspace/gr-match/lidl', out = new URL('../../assets/gr-prices-v72/lidl-eshop-latest.json', import.meta.url).pathname] = process.argv.slice(2);
let sm = fs.readFileSync(path.join(wd, 'sitemap.xml.gz')); try { sm = zlib.gunzipSync(sm); } catch {}
const urls = sitemapLinks(sm.toString()).products;
const athens = iso => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Athens' }).format(new Date(iso));
const products = {}, counts = { pages: urls.length, fetched: 0, products: 0, no_barcode: 0, ambiguous_price: 0, no_price: 0, no_product_jsonld: 0, not_fetched: 0, duplicate: 0 };
let newest = '', oldest = '';
for (const u of urls) {
  const sku = (u.match(/\/p(\d+)$/) || [])[1], f = path.join(wd, 'cache', sku + '.html');
  if (!fs.existsSync(f)) { counts.not_fetched++; continue; }
  counts.fetched++;
  const fetched = fs.statSync(f).mtime.toISOString();
  const r = parseProduct(fs.readFileSync(f, 'utf8'), u, fetched);
  if (r.skip) { counts[r.skip]++; continue; }
  for (const it of r.items) {
    if (products[it.ean]) { counts.duplicate++; if (products[it.ean].p !== it.price) { delete products[it.ean]; counts.duplicate_conflict = (counts.duplicate_conflict || 0) + 1; } continue; }
    const p = new URL(it.url).pathname;
    products[it.ean] = { n: it.name, u: p, p: it.price, o: null, d: athens(fetched), f: fetched, ...(it.valid_until ? { v: it.valid_until } : {}), ...(it.availability ? { a: it.availability } : {}) };
    if (!newest || fetched > newest) newest = fetched; if (!oldest || fetched < oldest) oldest = fetched;
  }
}
counts.products = Object.keys(products).length;
const robots = fs.existsSync(path.join(wd, 'robots.txt')) ? fs.readFileSync(path.join(wd, 'robots.txt')) : null;
const doc = { schema: 1, source: { id: 'lidl', name: 'lidl.gr product pages', url: SOURCE.home, snapshot: newest ? athens(newest) : null, fetched_at: newest, oldest_fetch: oldest,
  scope: 'the price lidl.gr shows for its default region (Lidl prices can differ by region; offers are time-limited)',
  method: 'product pages listed in the product sitemap advertised by robots.txt; only /p/ (allowed); 1 request at a time >=1.5 s apart; schema.org Product JSON-LD gtin13 + the single EUR offer price; pages with no barcode or more than one price skipped',
  robots_sha1: robots ? crypto.createHash('sha1').update(robots).digest('hex') : null,
  terms: 'Imprint https://www.lidl-hellas.gr/c/imprint-lidl-website/s10100556 and the legal-compliance page (read 31 Oct 2026): no website terms of use and no clause on automated reading or quoting of prices found. (lidlhouse.gr, a separate Lidl site, has terms forbidding commercial use without written consent; they do not cover lidl.gr.)', counts }, products };
fs.writeFileSync(out, JSON.stringify(doc));
console.log(JSON.stringify(doc.source, null, 1));
