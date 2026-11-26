/* FoodScan 106: product photos.
 * Seen on the live 106.0.0 (phone width, Greece): a search for "γιαούρτι" opened on 16 drawings in 20 rows, because the search ranked the shortest text first
 * and the barest records have the shortest text; every photo was requested at 200 px, product photo included; a product without a front photo only ever got
 * the photo index built on 6 Nov. Measured on the catalogue: 3,380 of 12,137 products have no front photo on record.
 * These tests pin the rules: which file is asked for, which photo is taken when no front is chosen, how search orders equally relevant rows,
 * and that nothing is invented when Open Food Facts holds no photo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = f => import(pathToFileURL(path.join(ROOT, f)).href);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const D = await imp('assets/domain-v106.mjs'), F = await imp('prices/fill-v89.js'), M = await imp('assets/market-catalogue-v106.mjs'), S = await imp('tools/build-search-index.mjs'), P = await imp('tools/build-photos.mjs');
const OFF = 'https://images.openfoodfacts.org/images/products/';

test('one photo, several sizes: the small file by default, the 400 px file offered to the browser', () => {
  const front = D.photoSet(OFF + '301/762/042/2003/front_en.879.200.jpg');
  assert.equal(front.src, OFF + '301/762/042/2003/front_en.879.200.jpg');
  assert.equal(front.srcset, `${OFF}301/762/042/2003/front_en.879.200.jpg 200w, ${OFF}301/762/042/2003/front_en.879.400.jpg 400w`);
  assert.equal(front.large, OFF + '301/762/042/2003/front_en.879.400.jpg');
  assert.equal(front.selected, true);
  // whichever size the record names (thumbnail, 400, full), the same set comes out
  for (const size of ['100', '400', 'full']) assert.equal(D.photoSet(OFF + `301/762/042/2003/front_en.879.${size}.jpg`).srcset, front.srcset);
  // an uploaded photo nobody chose exists as 100 and 400 only (no 200 px file)
  const raw = D.photoSet(OFF + '520/327/802/7518/1.400.jpg');
  assert.equal(raw.src, OFF + '520/327/802/7518/1.400.jpg');
  assert.equal(raw.srcset, `${OFF}520/327/802/7518/1.100.jpg 100w, ${OFF}520/327/802/7518/1.400.jpg 400w`);
  assert.equal(raw.selected, false);
});

test('only Open Food Facts image addresses are ever drawn', () => {
  for (const bad of ['', null, 'https://evil.example/images/products/1/front_en.3.200.jpg', 'http://images.openfoodfacts.org/images/products/1/front_en.3.200.jpg', 'javascript:alert(1)', 'https://user:pw@images.openfoodfacts.org/x.jpg'])
    assert.deepEqual(D.photoSet(bad), { src: '', srcset: '', large: '', selected: false }, String(bad));
  // an Open Food Facts address in a shape the rule does not know is passed through untouched, with no srcset
  const odd = 'https://static.openfoodfacts.org/images/misc/placeholder.png';
  assert.deepEqual(D.photoSet(odd), { src: odd, srcset: '', large: odd, selected: false });
  assert.equal(D.photoURL('12575299', '1'), OFF + '000/001/257/5299/1.400.jpg', 'short barcodes are filed under 13 digits');
  assert.equal(D.photoURL('3017620422003', 'front_fr.3', 200), OFF + '301/762/042/2003/front_fr.3.200.jpg');
  for (const file of ['../x', 'front_fr', 'ingredients_fr.3', '', 'front_fr.3/../../y']) assert.equal(D.photoURL('3017620422003', file), '', file);
});

test('the photo taken when no front is chosen: another language’s front, else the earliest real upload, else packaging, else nothing', () => {
  const big = { sizes: { full: { w: 1200, h: 1600 } } }, tiny = { sizes: { full: { w: 120, h: 90 } } };
  assert.equal(D.bestPhotoFile({ 1: big, front_fr: { rev: '7' }, front_de: { rev: '2' } }, 'de'), 'front_de.2', 'the record’s own language first');
  assert.equal(D.bestPhotoFile({ 1: big, front_fr: { rev: '7' }, front_en: { rev: 3 } }, 'el'), 'front_en.3', 'then English');
  assert.equal(D.bestPhotoFile({ 1: big, front_fr: { rev: '7' }, front_bg: { rev: '4' } }, 'el'), 'front_bg.4', 'then a stable order');
  assert.equal(D.bestPhotoFile({ 10: big, 3: big, 1: tiny }), '3', 'a thumbnail-sized upload is skipped; numbers are ordered as numbers');
  assert.equal(D.bestPhotoFile({ 2: {}, 1: {} }), '1', 'an upload of unknown size is kept');
  assert.equal(D.bestPhotoFile({ 1: tiny, packaging_el: { rev: '2' } }), 'packaging_el.2');
  assert.equal(D.bestPhotoFile({ ingredients_en: { rev: '2' }, nutrition_el: { rev: '5' } }), '', 'a close-up of the ingredients or the table is not a product photo');
  assert.equal(D.bestPhotoFile({ front_fr: {} }), '', 'a front with no revision cannot be addressed');
  for (const none of [null, undefined, 'x', {}, []]) assert.equal(D.bestPhotoFile(none), '');
  // the build tool and the browser use the same rule
  assert.equal(P.bestPhoto({ 1: big, front_fr: { rev: '7' } }), 'front_fr.7.400');
  assert.equal(P.bestPhoto({ 1: tiny }), null);
  assert.match(read('tools/build-photos.mjs'), /import \{ bestPhotoFile \} from '\.\.\/assets\/domain-v106\.mjs'/);
});

test('the worker’s model and the browser engine carry the same photo rules', () => {
  const body = name => { const src = [read('src/domain/model.js'), read('assets/domain-v106.mjs')].map(s => { const i = s.indexOf(`function ${name}(`); assert.ok(i > 0, name); return s.slice(i, s.indexOf('\n}\n', i)); }); return src; };
  for (const name of ['photoSet', 'photoURL', 'bestPhotoFile']) { const [a, b] = body(name); assert.equal(a, b, name); }
  assert.match(read('_worker.js'), /function bestPhotoFile\(/, 'the built worker was rebuilt from the changed module');
});

test('the live look at Open Food Facts: a photo, a confirmed "none", or "could not ask" — never a guess', async () => {
  const answer = body => async url => { assert.match(String(url), /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/\d+\.json\?fields=lang,images$/); return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }); };
  assert.equal(await F.livePhoto('1000000000016', answer({ status: 1, product: { lang: 'el', images: { 1: {}, front_fr: { rev: '4' } } } })), 'front_fr.4');
  assert.equal(await F.livePhoto('1000000000023', answer({ status: 1, product: { lang: 'el', images: { nutrition_el: { rev: '2' } } } })), '', 'on record, but no product photo');
  assert.equal(await F.livePhoto('1000000000030', answer({ status: 1, product: { lang: 'el' } })), '');
  assert.equal(await F.livePhoto('1000000000047', answer({ status: 0, status_verbose: 'product not found' })), null, 'not found is not "no photo"');
  assert.equal(await F.livePhoto('1000000000054', async () => new Response('busy', { status: 429 })), null);
  assert.equal(await F.livePhoto('1000000000061', async () => { throw new TypeError('offline'); }), null);
  // an answer is remembered for the visit; a failure is asked again
  let calls = 0; const counted = async () => { calls++; return new Response(JSON.stringify({ product: { images: { 2: {} } } }), { status: 200 }); };
  assert.equal(await F.livePhoto('1000000000078', counted), '2'); assert.equal(await F.livePhoto('1000000000078', counted), '2'); assert.equal(calls, 1);
  let tries = 0; const flaky = async () => { tries++; if (tries === 1) throw new Error('down'); return new Response(JSON.stringify({ product: { images: { 5: {} } } }), { status: 200 }); };
  assert.equal(await F.livePhoto('1000000000085', flaky), null); await new Promise(r => setTimeout(r, 5)); assert.equal(await F.livePhoto('1000000000085', flaky), '5');
  assert.equal(F.editURL('5200115770118'), 'https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=5200115770118');
});

test('the photo module: wiring pinned in the source', () => {
  const src = read('prices/fill-v89.js'), css = read('prices/native-v83.css'), chunk = read('assets/chunk-2OB4V521-v106.js');
  assert.match(src, /photos-\$\{REV\}\.json\?v=106/, 'the photo index changed under the same name, so its address changes (assets are cached for a year)');
  assert.match(src, /if \(data\.photos\[code\]\) fillPhoto\(hero, code\); else heroFallback\(hero, code\);/, 'the index first; the live look only for a product page that still shows the drawing');
  assert.match(src, /if \(routeCode\(\) !== code \|\| file === null\) return;/, 'a late or failed answer changes nothing');
  assert.match(src, /img\.sizes = hero \? '88px' : '56px';/);
  assert.match(src, /if \(ps\.selected\) \{ big\.sizes/, 'only a chosen front photo may load its full-size file; an unselected upload can weigh megabytes');
  assert.match(src, /rel = 'noopener noreferrer'/);
  assert.doesNotMatch(src, /innerHTML/, 'text from the network is never written as markup');
  for (const l of ['fr', 'de', 'es', 'it']) assert.match(src, new RegExp(`"${l}":\\{"zoom":`), l);
  assert.match(chunk, /Evidence\.photoSet\(e\.image\)/); assert.match(chunk, /"88px" : t === "md" \? "72px" : "56px"/);
  assert.doesNotMatch(chunk + src, /sizes="auto|'auto,/, 'sizes=auto picked the 400 px file for 40 px list boxes when tried in the browser');
  assert.match(css, /\.pimg:has\(>img\)\{background:#fff url\("data:image\/svg\+xml/); assert.match(css, /\.pimg>img\[data-fs106ok\]\{background:#fff\}/);
  assert.match(css, /dialog\.fs106-zoom::backdrop/);
  // the security policy already allows these hosts; nothing new was opened
  const headers = read('_headers');
  assert.match(headers, /img-src 'self' data: blob: https:\/\/images\.openfoodfacts\.org https:\/\/static\.openfoodfacts\.org/); assert.match(headers, /connect-src 'self' https:\/\/world\.openfoodfacts\.org/);
});

test('the photo index: every entry is a file the rule can address, and the catalogue numbers are what the notes say', () => {
  const idx = JSON.parse(read('assets/photos-off-csv-2026-10-30.json')), dir = path.join(ROOT, 'assets/greece-r20261030');
  let total = 0, none = 0; const noPhoto = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-'))) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).products) { total++; if (!r.image_front_small_url) { none++; noPhoto.add(String(r.code)); } }
  assert.equal(total, 12137); assert.equal(none, 3380);
  const entries = Object.entries(idx.photos); assert.equal(entries.length, 189);
  for (const [code, file] of entries) {
    assert.ok(noPhoto.has(code), `${code} has no front photo in the catalogue`);
    assert.match(file, /^(?:front_[a-z]{2}\.\d+|packaging_[a-z]{2}\.\d+|\d{1,4})\.400$/);
    assert.ok(D.photoSet(F.photoURL(code, file)).src, code);
  }
  assert.deepEqual(idx.recheck, { date: '2026-11-26', asked: 150, added: 4, note: 'spot check of the first 150 photo-less barcodes; Open Food Facts rate-limited the full re-read' });
});

test('search: relevance decides first, then the complete records lead', async () => {
  const idx = JSON.parse(read('assets/search-index-v106.json'));
  assert.equal(idx.schema, 2); assert.equal(idx.rows.length, 12137);
  assert.ok(idx.rows.every(r => r.length === 5 && Number.isInteger(r[4]) && r[4] >= 0 && r[4] <= 7));
  assert.equal(idx.rows.filter(r => r[4] & 4).length, 8946, '8,757 front photos in the catalogue + 189 from the photo index');
  assert.equal(idx.rows.filter(r => r[4] & 2).length, 4176); assert.equal(JSON.stringify(S.build()), read('assets/search-index-v106.json'), 'the file on disk is what the tool writes');
  assert.equal(S.qOf({ image_front_small_url: 'x', nutriscore_grade: 'b', brands: 'Y' }), 7); assert.equal(S.qOf({ nutriscore_grade: 'unknown', brands: ' ' }), 0); assert.equal(S.qOf({}, '1.400'), 4);
  assert.ok(!fs.existsSync(path.join(ROOT, 'assets/search-index-v101.json')), 'the old file is gone, not left to be served for a year');

  const fetcher = async u => { const p = path.join(ROOT, String(u).split('?')[0]); return fs.existsSync(p) ? new Response(fs.readFileSync(p), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('', { status: 404 }); };
  const cat = M.createCatalogue(fetcher);
  const yog = await cat.search('γιαούρτι', { country: 'greece', limit: 20 });
  assert.equal(yog.total, 148, 'nothing is dropped from the results: only the order changed');
  assert.ok(yog.products.filter(p => p.image).length >= 18, 'the first page was 4 photos in 20 before');
  const milk = await cat.search('γάλα', { country: 'greece', limit: 20 }); assert.equal(milk.products.filter(p => p.image).length, 20);
  // the rule itself, on a small index: a row that starts with the query still beats a complete row that only contains it
  const src = read('assets/market-catalogue-v106.mjs');
  assert.match(src, /rank:\(x\.norm\.startsWith\(text\)\?20:0\)\+\(x\.norm\.includes\(text\)\?10:0\)\+\(x\.q\|\|0\)-x\.norm\.length\*\.001/);
  assert.match(src, /q:r\[4\]\|0/);
  const last = await cat.search('γιαούρτι', { country: 'greece', limit: 20, page: 8 });
  assert.ok(last.products.length > 0 && last.products.filter(p => p.image).length < last.products.length, 'the bare records are still listed, further down');
});
