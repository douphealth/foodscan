#!/usr/bin/env node
/** Reproducible FoodScan 62 build.
 *   node tools/build-v62.mjs [--base ../v61] [--out app] [--zip <path>]
 *
 * v61 was delivered as a hand-patched, partly minified Pages bundle with no source tree. This build keeps that bundle as the
 * versioned baseline (the extracted v61 ZIP) and produces v62 from it deterministically:
 *   1. copy the baseline to --out (so `git diff` of --out is exactly the v62 change set);
 *   2. give every active v610 asset a v620 URL (immutable caching needs new names) and rewrite references;
 *   3. replace the readable modules with the canonical sources in src/ (domain.mjs inlines src/domain/nutriscore2023.mjs);
 *   4. splice the same domain code into _worker.js (one grading engine for the app, shared links and server-rendered pages);
 *   5. apply the exact-match patches in tools/patches-v62.mjs to the minified chunks (each must match exactly once);
 *   6. regenerate the catalogue (tools/build-catalogue.mjs output, if present) and release metadata.
 * Every replacement asserts it matched; a drifting baseline fails the build instead of shipping silently. */
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeZip, readZip } from './zip.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const OUT = resolve(root, arg('--out', 'app'));
const ZIP = arg('--zip', '');
const CFG = JSON.parse(readFileSync(join(root, process.env.FS_RELEASE || 'release.json'), 'utf8'));
// The baseline is the v61 ZIP exactly as received (hash-checked), extracted once into build/baseline. --base <dir> uses an already-extracted tree.
function baselineDir() {
  if (arg('--base', '')) return resolve(root, arg('--base'));
  const zip = resolve(root, CFG.baselineZip), dir = join(root, 'build', 'baseline'), stamp = join(dir, '.sha256');
  const hash = createHash('sha256').update(readFileSync(zip)).digest('hex');
  if (hash !== CFG.baselineZipSha256) throw new Error(`baseline ZIP hash ${hash} does not match release.json (${CFG.baselineZipSha256})`);
  if (existsSync(stamp) && readFileSync(stamp, 'utf8') === hash) return dir;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  for (const entry of readZip(zip)) { const target = join(dir, entry.name); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, entry.read()); }
  writeFileSync(stamp, hash); return dir;
}
const BASE = baselineDir();
const OLD = CFG.baselineSuffix, NEW = CFG.suffix; // 'v610' -> 'v620'

const read = f => readFileSync(f, 'utf8');
const sha = buf => createHash('sha256').update(buf).digest('hex');
function replaceOnce(text, find, replacement, label) {
  const parts = text.split(find);
  if (parts.length !== 2) throw new Error(`build: expected exactly one match for ${label} (found ${parts.length - 1})`);
  return parts.join(replacement);
}
// The catalogue data directory keeps its v610 name: the records are byte-identical, so the immutable URLs stay valid and 14 MB is not shipped twice.
const CATALOGUE_DIR = CFG.catalogueDir || `greece-${OLD}`;
const suffixText = text => text.split(`-${OLD}`).join(`-${NEW}`).split(`greece-${NEW}`).join(`greece-${OLD}`).split(`greece-${OLD}`).join(CATALOGUE_DIR);

// 1. baseline copy
if (!existsSync(join(BASE, '_worker.js'))) throw new Error(`baseline not found at ${BASE}: extract the v61 ZIP there`);
// Windows keeps a directory locked while a process (a dev server, a shell) has it as its working directory: empty it instead of removing it.
mkdirSync(OUT, { recursive: true });
for (const entry of readdirSync(OUT)) rmSync(join(OUT, entry), { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
cpSync(BASE, OUT, { recursive: true });
const assets = join(OUT, 'assets');

// 2. v610 -> v620 asset copies (text assets get their references rewritten; the old files stay for clients that still hold them)
const TEXT = /\.(?:js|mjs|css|json|txt)$/;
for (const name of readdirSync(assets)) {
  const full = join(assets, name);
  if (statSync(full).isDirectory()) continue;
  const m = name.match(new RegExp(`^(.*)-${OLD}(\\.[a-z]+)$`));
  if (!m) continue;
  const target = join(assets, `${m[1]}-${NEW}${m[2]}`);
  writeFileSync(target, TEXT.test(name) ? suffixText(read(full)) : readFileSync(full));
}
// Catalogue: data unchanged (greece-v610), plus the 62.0 search index (precomputed Greek/Latin skeletons).
// A refreshed catalogue (tools/build-catalogue.mjs output named in release.json: catalogueSource, catalogueDir) replaces the baseline data; its directory name changes with it.
if (CFG.catalogueSource) cpSync(resolve(root, CFG.catalogueSource), join(assets, CATALOGUE_DIR), { recursive: true });
const catalogueIndex = JSON.parse(read(join(assets, CATALOGUE_DIR, 'index.json')));
execFileSync(process.execPath, [join(root, 'tools/build-search-index.mjs'), join(assets, CATALOGUE_DIR), join(assets, `search-index-${NEW}.json`)], { stdio: 'inherit' });

// root documents and the service worker point at the new URLs
for (const f of ['index.html', 'demo/index.html', 'how/index.html', 'challenge/index.html', '404.html', 'sw.js']) {
  const p = join(OUT, f); if (existsSync(p)) writeFileSync(p, suffixText(read(p)));
}

// the growth pages (Fridge Challenge, shared helpers) are plain files with a cache-busting query: a changed fridge-core.mjs needs a new one
for (const f of ['index.html', 'demo/index.html', 'how/index.html', 'challenge/index.html', 'challenge/challenge.js', 'growth-ui.js', 'sw.js']) {
  const p = join(OUT, f); if (existsSync(p)) writeFileSync(p, read(p).split(`?v=${CFG.assetQuery.from}`).join(`?v=${CFG.assetQuery.to}`));
}

// 63.0: the entry script already imports these chunks statically; the 12 modulepreload hints only fought the stylesheet for bandwidth.
// Measured (4x CPU, 1.6 Mbps, 150 ms RTT, 10 runs): first/largest paint 2.57 s -> 1.84 s, time until the app UI is on screen unchanged (5.5 s).
for (const f of ['index.html', 'demo/index.html', 'how/index.html', 'challenge/index.html']) {
  const p = join(OUT, f); if (existsSync(p)) writeFileSync(p, read(p).split('\n').filter(l => !/^<link rel="modulepreload"/.test(l)).join('\n'));
}

// 3. canonical readable modules
const stripInline = text => text.replace(/^export \{[^}]*\};?\s*\/\/ @strip-on-inline\s*$/m, '').replace(/\r/g, '');
const ns23 = stripInline(read(join(root, 'src/domain/nutriscore2023.mjs')));
function domainBody() {
  const src = read(join(root, 'src/domain.mjs')).replace(/\r/g, '');
  const imp = "import { ns23Data, ns23Verify } from './domain/nutriscore2023.mjs';\n";
  let body = replaceOnce(src, imp, '', 'domain import');
  // the scoring tables sit after the model/estimate code and before grade.js, as one more module of the same bundle
  body = replaceOnce(body, '// src/domain/grade.js', `// src/domain/nutriscore2023.js\n${ns23.trim()}\n\n// src/domain/grade.js`, 'grade.js marker');
  return body;
}
const MODULES = CFG.modules; // canonical name -> asset base name
for (const [canonical, asset] of Object.entries(MODULES)) {
  const f = join(root, 'src', canonical);
  let text = (canonical === 'domain.mjs' ? domainBody() : read(f).replace(/\r/g, '')).split('{{suffix}}').join(NEW).split('{{catalogue}}').join(CATALOGUE_DIR);
  text = text.replace(/from\s*(['"])\.\/([a-z-]+)\.mjs\1/g, (_, q, name) => `from ${q}./${MODULES[`${name}.mjs`] ?? name}-${NEW}.mjs${q}`);
  writeFileSync(join(assets, `${asset}-${NEW}.mjs`), text);
}

// 4. worker: same domain code, same bytes
let worker = read(join(OUT, '_worker.js')).replace(/\r/g, '');
{
  const oldDomain = read(join(BASE, 'assets', `domain-${OLD}.mjs`)).replace(/\r/g, '');
  const oldBody = oldDomain.slice(0, oldDomain.indexOf('\nexport {')).trimEnd();
  const newBody = domainBody().replace(/\nexport \{[^}]*\};?\s*$/m, '').trimEnd();
  worker = replaceOnce(worker, oldBody, newBody, 'worker domain block');
  worker = replaceOnce(worker, `var VERSION = "${CFG.baselineVersion}";`, `var VERSION = "${CFG.version}";`, 'worker VERSION');
  worker = replaceOnce(worker, `var BUILD = "${CFG.baselineBuild}";`, `var BUILD = "${CFG.build}";`, 'worker BUILD');
  worker = suffixText(worker);
  worker = worker.replace('/* FoodScan v59.1 consistent evidence release', `/* FoodScan ${CFG.version} ${CFG.codename} release`);
}
// 5. patches
// a broken patch file must stop the build, never ship an unpatched release
const { patches } = await import(pathToFileURL(join(root, 'tools/patches-v62.mjs')).href);
for (const [find, replacement, label] of patches.worker || []) worker = replaceOnce(worker, find, replacement, `worker: ${label}`);
writeFileSync(join(OUT, '_worker.js'), worker);
for (const { file, find, replace, label, all } of patches.chunks || []) {
  const p = join(assets, file.replace('{v}', NEW)); let text = read(p);
  text = all ? text.split(find).join(replace) : replaceOnce(text, find, replace, `${file}: ${label}`);
  writeFileSync(p, text);
}
for (const { file, find, replace, label } of patches.files || []) {
  const p = join(OUT, file); writeFileSync(p, replaceOnce(read(p), find, replace, `${file}: ${label}`));
}
// version string shown in Me > About, the page shell, the service worker cache name
for (const name of readdirSync(assets).filter(n => new RegExp(`-${NEW}\\.js$`).test(n))) {
  const p = join(assets, name), text = read(p);
  if (text.includes(`var Y="${CFG.baselineVersion}"`)) writeFileSync(p, text.replace(`var Y="${CFG.baselineVersion}"`, `var Y="${CFG.version}"`));
}
{
  const p = join(OUT, 'index.html'); writeFileSync(p, replaceOnce(read(p), `data-foodscan-version="${CFG.baselineVersion}"`, `data-foodscan-version="${CFG.version}"`, 'index version'));
  const sw = join(OUT, 'sw.js'); writeFileSync(sw, replaceOnce(read(sw), `const CACHE = '${CFG.baselineCache}';`, `const CACHE = '${CFG.cache}';`, 'sw cache'));
}

// the product sitemap lists only pages the Worker would index (tools/reconcile-sitemap.mjs)
if (existsSync(join(root, 'src', 'sitemap-products.xml'))) cpSync(join(root, 'src', 'sitemap-products.xml'), join(OUT, 'sitemap-products.xml'));

// 6. release metadata
for (const f of readdirSync(OUT).filter(n => /^RELEASE-/.test(n))) rmSync(join(OUT, f));
const notes = join(root, 'docs', `RELEASE-${CFG.version}.md`);
if (existsSync(notes)) cpSync(notes, join(OUT, `RELEASE-${CFG.version}.md`));
const qaDir = join(OUT, 'release-qa'); mkdirSync(qaDir, { recursive: true });
// v61's own QA JSON describes v61 runs: only the catalogue provenance summary stays; this release ships its own evidence
for (const f of readdirSync(qaDir)) if (f !== 'catalogue-build-summary.json') rmSync(join(qaDir, f), { recursive: true, force: true });
const qaSrc = join(root, 'release-qa');
if (existsSync(qaSrc)) cpSync(qaSrc, qaDir, { recursive: true });
for (const doc of [`VALIDATION-REPORT-${CFG.version}.md`, `DEPLOYMENT-${CFG.version}.md`]) if (existsSync(join(root, 'docs', doc))) cpSync(join(root, 'docs', doc), join(qaDir, doc));
const fileList = []; const walk = d => { for (const e of readdirSync(d).sort()) { const f = join(d, e); statSync(f).isDirectory() ? walk(f) : fileList.push(f); } }; walk(OUT);
const manifest = { version: CFG.version, build: CFG.build, baseline: { version: CFG.baselineVersion, note: 'FoodScan-61.0.0-Fast-Relevant-Choices-Cloudflare-Pages.zip, extracted unchanged' },
  catalogue: { products: catalogueIndex.productCount, revision: catalogueIndex.revision, exportedAt: catalogueIndex.exportedAt }, files: fileList.length };
writeFileSync(join(qaDir, 'build-manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`built ${CFG.version} -> ${OUT} (${fileList.length} files)`);
if (ZIP) { const n = writeZip(OUT, resolve(ZIP)); const bytes = readFileSync(resolve(ZIP)); console.log(`zip ${ZIP}: ${n} files, ${bytes.length} bytes, sha256 ${sha(bytes)}`); }
