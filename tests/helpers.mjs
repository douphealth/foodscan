import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP = process.env.FS_APP ? path.resolve(process.env.FS_APP) : path.join(ROOT, 'app'); // FS_APP: test an extracted zip instead of the build tree
export const read = (f, enc = 'utf8') => fs.readFileSync(path.join(APP, f), enc);

/** ASSETS binding over the built tree, like Cloudflare Pages. */
export const assets = { fetch: async request => {
  const url = new URL(request.url); let file = path.join(APP, decodeURIComponent(url.pathname));
  if (!file.startsWith(APP)) return new Response('Forbidden', { status: 403 });
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(file), { headers: { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'text/plain' } });
} };

let workerPromise;
export const loadWorker = () => (workerPromise ||= import(pathToFileURL(path.join(APP, '_worker.js')).href + '?t=' + Date.now()).then(m => m.default));
export const makeEnv = (extra = {}) => ({ ASSETS: assets, ...extra });

/** Runs fn with a fake network: each [regex, handler] answers matching URLs; every other host fails. */
export async function withNetwork(handlers, fn) {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    for (const [re, h] of handlers) if (re.test(url)) return h(url, init);
    throw new TypeError('network blocked in tests: ' + url);
  };
  try { return await fn(); } finally { globalThis.fetch = real; }
}
export const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
export const noOpenPrices = [[/prices\.openfoodfacts\.org/, () => json({ items: [], total: 0 })]];

export async function compare(code, { env = makeEnv(), handlers = noOpenPrices, method = 'POST', origin = 'https://food-scan.test' } = {}) {
  const worker = await loadWorker();
  const request = new Request(`${origin}/api/prices/compare?barcode=${code}&r=${Math.random()}`, { method, headers: { 'CF-Connecting-IP': '203.0.113.' + (Math.floor(Math.random() * 200) + 1) } });
  return withNetwork(handlers, async () => { const res = await worker.fetch(request, env, { waitUntil() {} }); return { res, body: await res.json() }; });
}

/** All estimate shard entries (barcode -> {n, q, e}) from the built tree. */
export function allEstimates() {
  const dir = path.join(APP, 'assets/gr-est-v80'), items = {};
  for (const f of fs.readdirSync(dir).filter(f => /^e-\d+\.json$/.test(f))) Object.assign(items, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).items);
  return items;
}
export const estManifest = () => JSON.parse(read('assets/gr-est-v80/manifest.json'));
/** The monolithic source seed (data/seeds): what the shipped shards are built from (the shards themselves are tested against it). */
export const seed = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seeds', name), 'utf8'));
export const gtinOK = s => { s = String(s).replace(/^0+(?=\d{8})/, ''); if (!/^(?:\d{8}|\d{12,14})$/.test(s)) return false; const d = s.padStart(14, '0'); let t = 0; for (let i = 0; i < 13; i++) t += Number(d[i]) * (i % 2 === 0 ? 3 : 1); return (10 - t % 10) % 10 === Number(d[13]); };
export const key14 = c => String(c).replace(/\D/g, '').padStart(14, '0');
