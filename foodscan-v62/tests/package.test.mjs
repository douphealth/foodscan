import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { APP, ROOT, SUFFIX } from './helpers.mjs';

const cfg = JSON.parse(readFileSync(join(ROOT, 'release.json'), 'utf8'));
const read = f => readFileSync(join(APP, f), 'utf8');
const exists = p => existsSync(join(APP, p.replace(/^\//, '').split(/[?#]/)[0]));
const active = readdirSync(join(APP, 'assets')).filter(f => new RegExp(`-${SUFFIX}\\.(?:js|mjs|css)$`).test(f));

test('the deployable tree has the files Cloudflare Pages Direct Upload needs at its root', () => {
  for (const f of ['index.html', '_worker.js', '_routes.json', '_headers', 'sw.js', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml', '404.html']) assert.ok(exists(f), f);
  assert.equal(existsSync(join(APP, 'functions')), false, 'the API is _worker.js, not a functions/ folder');
});

test('every asset the page, the service worker and the module graph name exists', () => {
  const html = read('index.html'), refs = [...html.matchAll(/(?:href|src)="(\/[^"#]+)"/g)].map(m => m[1]).filter(r => !/^\/\//.test(r));
  for (const r of refs) assert.ok(exists(r), `index.html -> ${r}`);
  const sw = read('sw.js'), pre = JSON.parse(sw.match(/const PRECACHE = (\[.*?\]);/s)[1].replace(/'/g, '"'));
  assert.ok(pre.length > 40);
  for (const r of pre) assert.ok(exists(r), `sw precache -> ${r}`);
  for (const f of active.filter(f => /\.(?:js|mjs)$/.test(f))) {
    const text = read(`assets/${f}`);
    for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)["'](\.\/[^"']+)["']/g)) assert.ok(exists(`assets/${m[1].slice(2)}`), `${f} imports ${m[1]}`);
  }
});

test('the new release only loads new URLs, so immutable caching cannot serve old code', () => {
  for (const f of active.filter(f => /\.(?:js|mjs)$/.test(f))) {
    const text = read(`assets/${f}`);
    for (const m of text.matchAll(/["']\.\/([^"']+-v\d+\.(?:js|mjs))["']/g)) assert.ok(m[1].endsWith(`-${SUFFIX}.${m[1].split('.').pop()}`), `${f} still imports ${m[1]}`);
  }
  assert.doesNotMatch(read('index.html'), /-v610\./);
  assert.match(read('sw.js'), new RegExp(`const CACHE = '${cfg.cache}';`));
});

test('one version everywhere', () => {
  assert.match(read('_worker.js'), new RegExp(`var VERSION = "${cfg.version.replace(/\./g, '\\.')}";`));
  assert.match(read('index.html'), new RegExp(`data-foodscan-version="${cfg.version.replace(/\./g, '\\.')}"`));
  assert.ok(active.some(f => read(`assets/${f}`).includes(`var Y="${cfg.version}"`)), 'Me > About shows the version');
  assert.ok(existsSync(join(APP, `RELEASE-${cfg.version}.md`)));
  assert.equal(JSON.parse(read('release-qa/build-manifest.json')).version, cfg.version);
});

test('routing, headers and caching', () => {
  const routes = JSON.parse(read('_routes.json'));
  assert.equal(routes.version, 1);
  for (const r of ['/api/*', '/p/*', '/compare/*', '/', '/sitemap.xml']) assert.ok(routes.include.includes(r), r);
  for (const r of ['/assets/*', '/sw.js', '/icon*']) assert.ok(routes.exclude.includes(r), r);
  assert.ok(routes.include.length + routes.exclude.length <= 100, 'Pages allows 100 rules');
  const headers = read('_headers');
  assert.match(headers, /Content-Security-Policy: default-src 'self'; script-src 'self';/);
  assert.match(headers, /connect-src 'self' https:\/\/world\.openfoodfacts\.org/);
  assert.match(headers, /\/assets\/\*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /\/sw\.js\n  ! Cache-Control\n  Cache-Control: no-cache, no-store, must-revalidate/);
  assert.doesNotMatch(headers, /unsafe-eval/);
});

test('the service worker precaches the app shell and the engine, not the catalogue', () => {
  const sw = read('sw.js'), pre = JSON.parse(sw.match(/const PRECACHE = (\[.*?\]);/s)[1].replace(/'/g, '"'));
  for (const m of ['domain', 'match-policy', 'comparison-guards', 'market-catalogue', 'recommendations-core']) assert.ok(pre.some(p => p.includes(`/${m}-${SUFFIX}.mjs`)), `precache ${m}`);
  assert.ok(pre.every(p => !/part-.*\.json/.test(p)), 'catalogue shards load on demand');
  const bytes = pre.reduce((n, p) => n + statSync(join(APP, p.replace(/^\//, '').split('?')[0])).size, 0);
  assert.ok(bytes < 2.5 * 1024 * 1024, `precache is ${Math.round(bytes / 1024)} KB`);
});

test('sitemaps, manifest and llms.txt are well formed', () => {
  for (const f of ['sitemap.xml', 'sitemap-pages.xml', 'sitemap-products.xml']) { const x = read(f); assert.match(x, /^<\?xml/); assert.equal((x.match(/<urlset|<sitemapindex/g) || []).length > 0, true); assert.equal((x.match(/<loc>/g) || []).length, (x.match(/<\/loc>/g) || []).length); }
  const m = JSON.parse(read('manifest.webmanifest')); assert.equal(m.display, 'standalone'); assert.ok(m.icons.length >= 2);
  assert.match(read('robots.txt'), /Sitemap: https:\/\/food-scan\.gearuptofit\.com\/sitemap\.xml/);
});

test('no secret, token or personal address ships in the tree', () => {
  const bad = /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']|papalexios@|BEGIN (?:RSA |EC )?PRIVATE KEY/i;
  const walk = d => readdirSync(d).flatMap(e => { const f = join(d, e); return statSync(f).isDirectory() ? (/greece-/.test(f) ? [] : walk(f)) : [f]; });
  for (const f of walk(APP).filter(f => /\.(?:js|mjs|html|json|txt|md|css|xml)$/.test(f))) assert.doesNotMatch(readFileSync(f, 'utf8'), bad, f);
});
