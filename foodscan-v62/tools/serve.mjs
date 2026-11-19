#!/usr/bin/env node
/** Cloudflare Pages emulator for the built tree (no build step: app/ IS the deployable tree).
 *   node tools/serve.mjs [--dir app] [--port 8801] [--offline]
 * Applies _routes.json exactly like Pages (include/exclude, "/x/*" = prefix) and _headers (CSP included), runs the real
 * _worker.js with an ASSETS binding, and answers /assets from disk. --offline makes every upstream Open Food Facts fetch
 * from the worker fail fast (used to test outage behaviour without blocking the network for the whole machine). */
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : fallback; };
const DIR = path.resolve(arg('--dir', 'app'));
const PORT = Number(arg('--port', process.env.PORT || 8801));
const OFFLINE = process.argv.includes('--offline');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.woff2': 'font/woff2' };

function headerRules() {
  const file = path.join(DIR, '_headers');
  if (!existsSync(file)) return [];
  const rules = []; let cur = null;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) { cur = { pattern: line.trim(), set: [], drop: [] }; rules.push(cur); continue; }
    const t = line.trim();
    if (t.startsWith('! ')) cur.drop.push(t.slice(2).toLowerCase());
    else { const i = t.indexOf(':'); cur.set.push([t.slice(0, i).toLowerCase(), t.slice(i + 1).trim()]); }
  }
  return rules;
}
const rules = headerRules();
const patternMatches = (pattern, p) => pattern.startsWith('https://') ? false : pattern.endsWith('/*') ? p.startsWith(pattern.slice(0, -1)) : pattern === '/*' ? true : pattern === p;
function headersFor(p) {
  const out = {};
  for (const r of rules) if (patternMatches(r.pattern, p)) { for (const d of r.drop) delete out[d]; for (const [k, v] of r.set) out[k] = v; }
  return out;
}

const routes = JSON.parse(readFileSync(path.join(DIR, '_routes.json'), 'utf8'));
const routeMatch = (rule, p) => rule.endsWith('/*') ? p.startsWith(rule.slice(0, -1)) : p === rule;
const toWorker = p => routes.include.some(r => routeMatch(r, p)) && !routes.exclude.some(r => routeMatch(r, p));

const assets = { fetch: async request => {
  const url = new URL(request.url); let file = path.join(DIR, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIR)) return new Response('Forbidden', { status: 403 });
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) return new Response('Not found', { status: 404 });
  return new Response(readFileSync(file), { headers: { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' } });
} };

if (OFFLINE) {
  const real = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const u = typeof input === 'string' ? input : input.url;
    if (/openfoodfacts\.org|search\.openfoodfacts/.test(u)) return Promise.reject(new TypeError('offline (tools/serve.mjs --offline)'));
    return real(input, init);
  };
}

const worker = (await import(`${pathToFileURL(path.join(DIR, '_worker.js')).href}?t=${Date.now()}`)).default;
const env = { ASSETS: assets, CONTACT_EMAIL: process.env.CONTACT_EMAIL, ...JSON.parse(process.env.FS_ENV || '{}') };

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const request = new Request(url, { method: req.method, headers: Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['host', 'connection'].includes(k))) });
    let response;
    if (toWorker(url.pathname)) response = await worker.fetch(request, env, { waitUntil() {}, passThroughOnException() {} });
    else {
      response = await assets.fetch(request);
      if (response.status === 404 && existsSync(path.join(DIR, '404.html'))) response = new Response(readFileSync(path.join(DIR, '404.html')), { status: 404, headers: { 'Content-Type': TYPES['.html'] } });
    }
    const merged = new Headers(response.headers);
    for (const [k, v] of Object.entries(headersFor(url.pathname))) if (!merged.has(k) || k === 'content-security-policy') merged.set(k, v);
    res.writeHead(response.status, Object.fromEntries(merged)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end(String(e?.stack || e)); }
});
server.listen(PORT, () => console.log(`FoodScan Pages emulator: http://localhost:${PORT}/  dir=${DIR}${OFFLINE ? ' (upstream offline)' : ''}`));
