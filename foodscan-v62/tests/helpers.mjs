import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const APP = process.env.FS_APP_DIR ? resolve(process.env.FS_APP_DIR) : join(ROOT, 'app'); // FS_APP_DIR: test an extracted release ZIP instead of app/
export const CATALOGUE_DIR = join(APP, 'assets', 'greece-v610');
export const SUFFIX = JSON.parse(readFileSync(join(ROOT, 'release.json'), 'utf8')).suffix;
export const importFile = file => import(pathToFileURL(file).href);

let cache;
/** Every shipped catalogue record, raw (CSV-derived), with its shard file and the manifest. */
export function catalogue() {
  if (cache) return cache;
  const manifest = JSON.parse(readFileSync(join(CATALOGUE_DIR, 'index.json'), 'utf8')), records = [], byCode = new Map();
  for (const f of readdirSync(CATALOGUE_DIR).filter(f => /^part-.*\.json$/.test(f))) {
    const d = JSON.parse(readFileSync(join(CATALOGUE_DIR, f), 'utf8'));
    for (const raw of d.products) { const r = { raw, file: f, family: d.family }; records.push(r); byCode.set(String(raw.code), r); }
  }
  return (cache = { manifest, records, byCode });
}
/** A fetch() that serves /assets/* from disk, as the browser sees it. */
export const diskFetcher = (url) => {
  const file = join(APP, decodeURIComponent(String(url).split('?')[0]).replace('{{catalogue}}', 'greece-v610')); // src/ modules carry the {{catalogue}} placeholder the build fills in
  if (!existsSync(file)) return Promise.resolve(new Response('not found', { status: 404 }));
  return Promise.resolve(new Response(readFileSync(file), { status: 200 }));
};
export const domain = () => importFile(join(ROOT, 'src', 'domain.mjs'));
