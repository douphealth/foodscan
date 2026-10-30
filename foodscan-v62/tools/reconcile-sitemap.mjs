#!/usr/bin/env node
/** Reconciles sitemap-products.xml with what the Worker would actually index: every listed URL is requested from the built Worker (live food API),
 * and kept only when the page answers 200 with `index, follow`. A URL the food source could not answer (429/502/503) is "unverified" and is left
 * alone: it is never removed on a guess. Open Food Facts allows 15 product reads a minute per IP, so this makes one read per URL, six seconds
 * apart, with one retry after a pause.
 *   node tools/reconcile-sitemap.mjs [--out src/sitemap-products.xml] [--report release-qa/sitemap-reconcile.json] */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP } from '../tests/helpers.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const assets = { fetch: async req => { let p = join(APP, decodeURIComponent(new URL(req.url).pathname)); if (!/\.[a-z0-9]+$/i.test(p)) p = join(p, 'index.html'); return existsSync(p) ? new Response(readFileSync(p)) : new Response('nf', { status: 404 }); } };
const worker = (await import(pathToFileURL(join(APP, '_worker.js')).href)).default;
const call = path => worker.fetch(new Request(`https://food-scan.gearuptofit.com${path}`, { headers: { Accept: 'text/html' } }), { ASSETS: assets }, { waitUntil() {} });
const xml = readFileSync(join(APP, 'sitemap-products.xml'), 'utf8');
const urls = [...xml.matchAll(/<loc>https:\/\/food-scan\.gearuptofit\.com\/p\/(\d+)<\/loc>/g)].map(m => m[1]);
const busy = status => [429, 502, 503].includes(status);
// a page built from the dated catalogue or a stale copy is a fallback while the food source is busy: it says nothing about indexability
const fallback = page => /DATED|STALE/.test(page.headers.get('x-foodscan-cache') || '');
const rows = [];
for (const code of urls) {
  let page = await call(`/p/${code}`), html = await page.text();
  if (busy(page.status) || fallback(page)) { await sleep(30000); page = await call(`/p/${code}`); html = await page.text(); }
  const robots = html.match(/<meta name="robots" content="([^"]+)"/)?.[1] || '', header = page.headers.get('x-robots-tag') || '';
  const indexable = page.status === 200 && /^index/.test(robots) && !/noindex/.test(header), unverified = busy(page.status) || fallback(page);
  const lastmod = html.match(/"dateModified":"(\d{4}-\d{2}-\d{2})/)?.[1] || null;
  rows.push({ code, status: page.status, robots, indexable, unverified, lastmod, title: html.match(/<title>([^<]*)<\/title>/)?.[1] || '' });
  process.stdout.write(indexable ? '.' : unverified ? '?' : 'x'); await sleep(6000);
}
const keep = rows.filter(r => r.indexable || r.unverified);
const original = new Map([...xml.matchAll(/<loc>https:\/\/food-scan\.gearuptofit\.com\/p\/(\d+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map(m => [m[1], m[2] || null]));
const out = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${keep.map(r => { const lm = r.lastmod || original.get(r.code); return `  <url><loc>https://food-scan.gearuptofit.com/p/${r.code}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}</url>`; }).join('\n')}\n</urlset>\n`;
writeFileSync(resolve(arg('--out', 'src/sitemap-products.xml')), out);
writeFileSync(resolve(arg('--report', 'release-qa/sitemap-reconcile.json')), JSON.stringify({ checkedAt: new Date().toISOString(), listed: urls.length, indexable: rows.filter(r => r.indexable).length, unverified: rows.filter(r => r.unverified).map(r => r.code), removed: rows.filter(r => !r.indexable && !r.unverified), rows }, null, 1));
console.log(`\n${urls.length} listed, ${rows.filter(r => r.indexable).length} indexable, ${rows.filter(r => r.unverified).length} unverified (kept), ${urls.length - keep.length} removed`);
