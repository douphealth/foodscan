/* 103: defects found by measuring grades over the whole bundled catalogue and by running bundled barcodes through the price service. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read, loadWorker, daysAgo } from './helpers.mjs';

globalThis.__FS101_TEST__ = globalThis.__FS101_TEST__ && globalThis.__FS101_TEST__ !== true ? globalThis.__FS101_TEST__ : true;
const D = await import(pathToFileURL(path.join(ROOT, 'assets/domain-v106.mjs')).href);
const Q = await import(pathToFileURL(path.join(ROOT, 'prices/quick-grade-v85.mjs')).href);
const P = await import(pathToFileURL(path.join(ROOT, 'prices/price-core-v83.mjs')).href);
await loadWorker();
const T = globalThis.__FS101_TEST__;

const CODE = '5449000000996';
const mk = raw => D.parseProduct({ status: 1, product: { code: CODE, ...raw } }, CODE);
const COLA = { 'energy-kj_100g': 180, 'energy-kcal_100g': 42, 'sugars_100g': 10.6, 'salt_100g': 0, 'saturated-fat_100g': 0, 'fat_100g': 0, 'carbohydrates_100g': 10.6, 'proteins_100g': 0, 'fiber_100g': 0 };
const TEA = { 'energy-kj_100g': 8, 'energy-kcal_100g': 2, 'sugars_100g': 0.1, 'salt_100g': 0.02, 'saturated-fat_100g': 0, 'fat_100g': 0, 'carbohydrates_100g': 0.2, 'proteins_100g': 0, 'fiber_100g': 0 };
const JUICE = { 'energy-kj_100g': 188, 'energy-kcal_100g': 45, 'sugars_100g': 9, 'salt_100g': 0, 'saturated-fat_100g': 0, 'fat_100g': 0.1, 'carbohydrates_100g': 10, 'proteins_100g': 0.7, 'fiber_100g': 0.2 };
/** A drink as Open Food Facts holds many Greek ones: values per 100 ml, the category typed as free text, so the source scored it as a solid food. */
const drink = (o = {}) => mk({ product_name: 'Cola soda', quantity: '330 ml', nutrition_data_per: '100ml', nutriscore_grade: 'b', nutriscore_score: 2, categories_tags: ['el:αναψυκτικά'],
  ingredients_text: 'Carbonated water, sugar, colour (E150d), phosphoric acid, natural flavourings, caffeine', nutriments: COLA, ...o });

test('a soda the source graded B with the table for solid foods gets the letter the drinks table gives (E), and says so', () => {
  const p = drink(), a = D.assessGrade(p);
  assert.deepEqual(D.ns23Kinds(p).kinds, ['beverage']); assert.equal(D.ns23Kinds(p).via, 'evidence');
  assert.equal(a.grade, 'E'); assert.equal(a.status, 'estimated'); assert.equal(a.method, '2023-calculated');
  assert.equal(a.sourceGrade, 'B'); assert.equal(a.wrongTable, true);
  assert.match(a.caveats[0], /published B for this drink/, 'the published letter is named, never hidden');
  assert.match(a.caveats[0], /FoodScan's calculation, not a grade printed on the pack/);
});

test('a sweetened iced tea published as A is not shown as A: only water is A among drinks', () => {
  const sweetened = D.assessGrade(drink({ product_name: 'Ice tea peach', nutriscore_grade: 'a', nutriscore_score: -1, nutriments: TEA, ingredients_text: 'Water, tea extract, sweeteners (sucralose, acesulfame K), flavouring' }));
  assert.equal(sweetened.grade, 'C'); assert.equal(sweetened.sourceGrade, 'A');
  // with no ingredient list the sweeteners are not known: the range is given, and no single letter is claimed
  const unknown = D.assessGrade(drink({ product_name: 'Ice tea peach', nutriscore_grade: 'a', nutriscore_score: -1, nutriments: TEA, ingredients_text: '' }));
  assert.equal(unknown.grade, null); assert.equal(unknown.status, 'withheld'); assert.deepEqual(unknown.drinkLetters, ['B', 'C']);
  assert.match(unknown.reasons[0], /With the drinks table the same values give B, C/);
});

test('a product named as a pure juice has a fruit share of 100 and no sweeteners, whatever the missing ingredient list leaves open', () => {
  const p = drink({ product_name: 'Φυσικός χυμός πορτοκάλι 100%', categories_tags: ['el:χυμός'], nutriscore_grade: 'b', nutriscore_score: 1, ingredients_text: '', nutriments: JUICE });
  const input = D.ns23DrinkInputs(p);
  assert.equal(input.fvl, 100); assert.equal(input.fvl_from_name, true);
  const a = D.assessGrade(p);
  assert.equal(a.grade, 'C', 'orange juice is C under the 2023 drinks table'); assert.equal(a.sourceGrade, 'B');
  assert.ok(a.caveats.some(c => /read from the product name/.test(c)), 'where the fruit share came from is stated');
  // a nectar or a juice drink is not a pure juice
  const nectar = D.ns23DrinkInputs(drink({ product_name: 'Νέκταρ πορτοκάλι 100% γεύση', categories_tags: ['el:χυμός'], ingredients_text: '', nutriments: JUICE }));
  assert.notEqual(nectar.fvl_from_name, true);
});

test('liquid foods, alcohol, packs sold by weight and drinks the source already scored as drinks are left alone', () => {
  for (const [why, o] of [
    ['soy sauce', { product_name: 'Soy sauce', quantity: '150 ml', categories_tags: ['el:σάλτσες'] }],
    ['olive oil', { product_name: 'Extra virgin olive oil', quantity: '1 l', categories_tags: [] }],
    ['wine', { product_name: 'Red wine', quantity: '750 ml', categories_tags: [] }],
    ['cream', { product_name: 'Κρέμα γάλακτος', quantity: '200 ml', categories_tags: [] }],
    ['sold by weight', { quantity: '330 g' }],
    ['the source used the drinks table', { nutriscore_grade: 'e', nutriscore_score: 14, categories_tags: ['en:beverages', 'en:sodas'] }],
  ]) assert.equal(D.ns23DrinkCheck(drink(o)), null, why);
  // values per 100 g are never taken for a drink
  assert.equal(D.ns23DrinkCheck(drink({ nutrition_data_per: '100g', quantity: '330 g' })), null);
});

test('sweeteners: the counted ones are found by name or E number; polyols, "without sweeteners" and a sweetening fruit concentrate are not counted', () => {
  const sw = text => D.ns23Sweeteners(mk({ product_name: 'x', ingredients_text: text }));
  assert.equal(sw('Γάλα, γλυκαντικές ύλες: γλυκοζίτες στεβιόλης'), 1);
  assert.equal(sw('Water, acid, E955, E950'), 1);
  assert.equal(sw('Νερό, γλυκαντικό συμπύκνωμα από χυμό μήλου, χυμός λεμονιού'), 0, 'apple juice concentrate used to sweeten is not a sweetener');
  assert.equal(sw('Water, fruit juice. Without sweeteners.'), 0);
  assert.equal(sw('Χωρίς γλυκαντικά. Νερό, χυμός'), 0);
  assert.equal(sw('Water, sweetener (erythritol), flavouring'), 0, 'polyols are not on the Nutri-Score list');
  assert.equal(sw('Water, sweeteners, flavouring'), null, 'which kind is not said: unknown, not zero');
  assert.equal(sw('Water, sugar, lemon juice'), 0);
});

test('the quick grade uses the same drink evidence and never rates it "high"', () => {
  const p = drink({ nutriscore_grade: '', nutriscore_score: undefined });
  const q = Q.quickGrade(p, {});
  assert.equal(q.ok, true); assert.deepEqual(q.letters, ['E']); assert.equal(q.via, 'evidence'); assert.equal(q.confidence, 'medium'); assert.equal(q.inferredKind, true);
});

test('no drink enters the swaps or the similar-products index with a letter from the table for solid foods', () => {
  const swaps = read('tools/build-swaps.mjs'), peers = read('tools/build-peers.mjs'), est = read('tools/build-estimates.mjs');
  assert.match(swaps, /const fix = D\.ns23DrinkCheck\(p\);\s*\n\s*if \(fix\) \{ if \(fix\.state !== 'corrected'\) continue;/);
  assert.match(peers, /fix = D\.ns23DrinkCheck\(p\), sweet = fix \? null : D\.ns23SweetenerCheck\(p\), grade = fix \? \(fix\.state === 'corrected' \? fix\.calc\.grade : ''\) : sweet \? sweet\.calc\.grade :/);
  assert.match(est, /a\.wrongTable && a\.drinkLetters/);
  // the validation leaves those letters out of the reference set, and says how many there were
  assert.match(read('tools/quick-grade-validate.mjs'), /wrongTable: wrongTable\.length/);
});

test('the new messages are translated in all five dictionaries', () => {
  const keys = [...read('src/domain/grade.js').matchAll(/t\("((?:Open Food Facts published|The fruit share|Values the record does not report)[^"]*)"/g)].map(m => m[1]);
  assert.equal(keys.length, 8);
  for (const f of ['chunk-BQKWV521-v106.js', 'i18n-de-v106.js', 'i18n-es-v106.js', 'i18n-fr-v106.js', 'i18n-it-v106.js']) {
    const s = read('assets/' + f);
    for (const k of keys) { const i = s.indexOf(JSON.stringify(k) + ':"'); assert.ok(i >= 0, `${f}: ${k.slice(0, 50)}`); for (const ph of k.match(/\{\w+\}/g) || []) assert.ok(s.slice(i + k.length + 4, s.indexOf('",', i + k.length + 4)).includes(ph), `${f} keeps ${ph}`); }
  }
});

test('year-cached files changed in this release have a new address (assets are served "immutable")', () => {
  assert.match(read('_headers'), /\/assets\/\*\s*\n\s*! Cache-Control\s*\n\s*Cache-Control: public, max-age=31536000, immutable/);
  const names = fs.readdirSync(path.join(ROOT, 'assets'));
  assert.equal(names.filter(f => /-v101\.(?:js|mjs|css)$/.test(f)).length, 0, 'no file of the previous generation is left to be changed in place');
  assert.ok(names.includes('domain-v106.mjs'));
  for (const f of ['index.html', 'sw.js', 'daily-v98.js', 'prices/reader-v85.js', 'prices/quick-grade-v85.mjs']) assert.doesNotMatch(read(f), /-v101\.(?:js|mjs|css)/, f);
  // every asset the pages and the service worker name exists
  for (const f of ['index.html', 'how/index.html', 'demo/index.html', 'sw.js']) for (const m of read(f).matchAll(/\/assets\/([\w.-]+-v103\.(?:js|mjs|css))/g)) assert.ok(names.includes(m[1]), `${f} names ${m[1]}`);
  // the three indexes rebuilt under their old names are asked for at a new address
  assert.match(read('prices/reader-v85.js'), /peers-off-csv-2026-10-30\.json\?v=106/);
  assert.match(read('prices/reader-v85.js'), /swaps-off-csv-2026-10-30\.json\?v=106/);
  assert.match(read('prices/swaps-ui-v88.js'), /swaps-off-csv-2026-10-30\.json\?v=106/);
  assert.match(read('prices/fill-v89.js'), /estimates-\$\{REV\}\.json\?v=106/);
});

test('a pack written as "size x count" is the whole pack, and a size next to dimensions is still parsed as written', () => {
  assert.deepEqual(T.fsPricePack('330 ml x 6'), { amount: 1.98, unit: 'l' });
  assert.deepEqual(T.fsPricePack('1,5 lt x 6'), { amount: 9, unit: 'l' });
  assert.deepEqual(T.fsPricePack('10gr x 200τμχ'), { amount: 2, unit: 'kg' });
  assert.deepEqual(T.fsPricePack('6 x 330 ml'), { amount: 1.98, unit: 'l' }, 'the usual order still works');
  assert.deepEqual(T.fsPricePack('500 g'), { amount: 0.5, unit: 'kg' });
});

test('the observatory proof link is rebuilt from the snapshot date when the stored one lost its date', () => {
  const good = 'https://raw.githubusercontent.com/spyrosavl/posokanei/main/data/2026/posokanei-2026-11-18.json';
  assert.equal(T.fsSeedArchive('posokanei', { archive: 'https://raw.githubusercontent.com/spyrosavl/posokanei/main/data//posokanei-.json', snapshot: '2026-11-18' }), good);
  assert.equal(T.fsSeedArchive('posokanei', { archive: good, snapshot: '2026-11-18' }), good);
  assert.equal(T.fsSeedArchive('posokanei', { archive: 'x', snapshot: '' }), '', 'neither a link nor a date: the caller falls back to the source page');
  // the bundled seed itself carries a working link
  const seed = JSON.parse(read('assets/gr-prices-v72/posokanei-latest.json'));
  assert.match(seed.source.archive, /\/data\/\d{4}\/posokanei-\d{4}-\d{2}-\d{2}\.json$/);
  assert.match(read('price-refresh/refresh/scripts/import.mjs'), /archive: archive \|\| archiveURL\(pk\.meta\.date\)/);
});

test('an old price far from what the other stores record today is marked, and never ranks', () => {
  const off = (storeId, price, freshness = 'current') => ({ id: 'x:' + storeId, storeId, retailerId: storeId, price, currency: 'EUR', basis: 'item', freshness, rankingEligible: freshness === 'current', date: '2026-11-18' });
  const out = T.fsPriceFlagSuspects([off('a', 2.4), off('b', 2.9), off('c', 3.48), off('d', 3.1), off('old', 0.4, 'historical')]);
  const old = out.find(o => o.storeId === 'old');
  assert.equal(old.suspect, true); assert.equal(old.rankingEligible, false);
  assert.ok(out.filter(o => o.storeId !== 'old').every(o => !o.suspect), 'the stores that agree are untouched');
});

test('with no pack on record, a shop price gets its unit price from the size in that shop\'s own listing, and only then', () => {
  const offer = { id: 'bz:1', retailerId: 'bazaar', retailer: 'Bazaar', storeName: 'Bazaar', source: 'bazaar-online.gr', countryCode: 'GR', storeId: 'bazaar', price: 2.5, currency: 'EUR', basis: 'item', date: daysAgo(1), shopSize: { amount: 0.5, unit: 'kg' } };
  const own = P.checkOffer(offer, null);
  assert.equal(own.unitPrice, 5); assert.equal(own.unitBasis, 'kg');
  const withPack = P.checkOffer(offer, { amount: 1, unit: 'kg' });
  assert.equal(withPack.unitPrice, 2.5, 'the pack on record wins when there is one');
  const src = read('src/worker/prices.js');
  assert.match(src, /o\.shopBarcodes !== 1 \|\| o\.shopSizePlain === false/, 'one barcode on the shop item, and a title that states a content, not a capacity');
  assert.match(src, /u >= 0\.08 && u <= 150 \? o\.shopPack : null/, 'outside a plausible food price the "size" was a count or a portion');
  assert.match(src, /labelPack\.amount < 0\.05 && homeItems\.length && homeItems\.every\(o => o\.price \/ labelPack\.amount > 150\)/, 'a portion typed as the pack gives no unit price');
});

const ZERO = { 'energy-kj_100g': 2, 'energy-kcal_100g': 0.4, 'sugars_100g': 0, 'salt_100g': 0.03, 'saturated-fat_100g': 0, 'fat_100g': 0, 'carbohydrates_100g': 0, 'proteins_100g': 0, 'fiber_100g': 0 };
/** A zero-sugar cola as Open Food Facts holds it: a drink by its own category, published B with 0 points, sweeteners named only in a Greek ingredient list. */
const zero = (o = {}) => mk({ product_name: 'Cola zero sugar', quantity: '330 ml', nutrition_data_per: '100ml', nutriscore_grade: 'b', nutriscore_score: 0, categories_tags: ['en:beverages', 'en:carbonated-drinks', 'en:sodas'],
  ingredients_text: 'Φυσικό μεταλλικό νερό, διοξείδιο του άνθρακα, χρωστική, γλυκαντικά: κυκλαμικό νάτριο, ασπαρτάμη, ακεσουλφάμη Κ', nutriments: ZERO, ...o });

test('a drink whose published points leave out the sweeteners on its own ingredient list gets the 4 points the rules add (cola zero: B to C)', () => {
  const p = zero(), c = D.ns23SweetenerCheck(p), a = D.assessGrade(p);
  assert.equal(c.without.score, 0); assert.equal(c.calc.score, 4); assert.equal(c.calc.grade, 'C');
  assert.equal(a.grade, 'C'); assert.equal(a.status, 'estimated'); assert.equal(a.sourceGrade, 'B'); assert.equal(a.sweetenersAdded, true);
  assert.match(a.caveats[0], /published B for this drink without the 4 points/);
  assert.equal(a.anatomy.flags.beverage, true, 'the card shows the drinks scale');
});

test('the published letter stands whenever the sweetener component is not provably the only difference', () => {
  for (const [why, o] of [
    ['no sweetener is named', { ingredients_text: 'Water, carbon dioxide, colour, acid' }],
    ['the only mention is a negation', { ingredients_text: 'Νερό, διοξείδιο του άνθρακα. Χωρίς ασπαρτάμη.' }],
    ['the published points are not the points without sweeteners', { nutriscore_score: 1 }],
    ['the source counted them already', { nutriscore_grade: 'c', nutriscore_score: 4 }],
    ['values per 100 g', { nutrition_data_per: '100g', quantity: '330 g' }],
  ]) { const p = zero(o); assert.equal(D.ns23SweetenerCheck(p), null, why); assert.notEqual(D.assessGrade(p).sweetenersAdded, true, why); }
});

test('a named sweetener after a negation is not an ingredient', () => {
  const sw = text => D.ns23Sweeteners(mk({ product_name: 'x', ingredients_text: text }));
  assert.equal(sw('Νερό, χυμός. Χωρίς ασπαρτάμη.'), 0);
  assert.equal(sw('Water, flavouring. No aspartame or acesulfame K'), 0);
  assert.equal(sw('Water, aspartame-free flavouring'), 0);
  assert.equal(sw('Water. Without aspartame. Sweetener: sucralose'), 1, 'another one, really present, still counts');
  assert.equal(sw('Water, sweeteners: aspartame, acesulfame K'), 1);
});

test('the swaps index never offers a product whose grade the app itself holds back, nor a drink with a letter the rules do not give', () => {
  const idx = JSON.parse(read('assets/swaps-off-csv-2026-10-30.json')), dir = path.join(ROOT, 'assets/greece-r20261030');
  const rows = new Map(idx.rows.map(r => [String(r[0]), r]));
  let seen = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-'))) for (const raw of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).products) {
    const row = rows.get(String(raw.code)); if (!row) continue; seen++;
    const p = D.parseProduct({ status: 1, product: raw }, raw.code), a = D.assessGrade(p);
    assert.notEqual(a.status, 'withheld', `${raw.code} is held back on its own page`);
    if (a.wrongTable || a.sweetenersAdded) assert.equal(row[3], a.grade, `${raw.code} carries the recalculated letter`);
  }
  assert.equal(seen, idx.rows.length);
  assert.match(read('tools/build-swaps.mjs'), /if \(D\.assessGrade\(p\)\.status === 'withheld'\) continue;/);
});

test('a container sold by what it holds gets no price per litre', () => {
  const src = read('src/worker/prices.js');
  const m = /&& !(\/απορριμ[^\n]*?\/u)\.test\(String\(p\.n/.exec(src); assert.ok(m, 'the title check is there');
  const re = new Function('return ' + m[1])(), fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
  for (const t of ['Σακούλες απορριμάτων με χερούλι 25l', 'Θαλασσινός Ποτήρι Χάρτινο Μαύρο 120ml 50τμχ', 'ΕT PLAST Κάδος WC Με Πεντάλ 10Lt', 'Αναίς Πιάτο Γλάστρας Τετράγωνο 17X17 7.5lt']) assert.ok(re.test(fold(t)), t);
  for (const t of ['Farmer Αγγουράκια Τουρσί σε Δοχείο 9.7LT', 'Δέλτα Life Χυμός Πορτοκάλι 1lt', 'KLINEX Υγρό Καθαριστικό Λεκάνης 750ml', 'Γιώτης Caotonic σε Σακούλα 400g']) assert.ok(!re.test(fold(t)), t);
});

test('the grade card names what FoodScan recalculated, with the drinks scale, and the quick-grade tile names the sweeteners', () => {
  const card = read('assets/chunk-57E5ZLYU-v106.js'), why = read('assets/chunk-I3TRV521-v106.js'), scale = read('assets/chunk-IO4NLMGT-v106.js'), ui = read('prices/grade-ui-v85.mjs');
  assert.match(card, /t\.sweetenersAdded \? "Calculated with the sweeteners on the record counted/); assert.match(card, /t\.wrongTable \? "Calculated with the Nutri-Score drinks table/);
  assert.match(why, /s\.sweetenersAdded \? "/); assert.match(why, /s\.wrongTable \? "/);
  assert.match(scale, /let r=e\?\.estimated&&e\.flags\?e\.flags:a\?\.nutriScoreData\|\|e\?\.flags;/, 'a calculated grade shows the scale of the table it was calculated with');
  assert.match(ui, /part\.id === 'non_nutritive_sweeteners' \? 'sweeteners' : part\.id/); assert.match(ui, /part\.unit === 'number' \? \(part\.value \? t\.sweetYes : t\.sweetNo\)/);
  const keys = ['Calculated with the Nutri-Score drinks table: the source graded this drink with the table for solid foods.', "Calculated with the sweeteners on the record counted: the source's grade leaves them out.",
    'The source graded this drink with the table for solid foods, and the record lacks what the drinks table needs'];
  for (const f of ['chunk-BQKWV521-v106.js', 'i18n-de-v106.js', 'i18n-es-v106.js', 'i18n-fr-v106.js', 'i18n-it-v106.js']) for (const k of keys) assert.ok(read('assets/' + f).includes(JSON.stringify(k) + ':"'), `${f}: ${k.slice(0, 40)}`);
});

test('the source\'s own category "artificially sweetened beverages" counts as sweeteners when the ingredient list is missing or misread', () => {
  const p = zero({ product_name: 'Pepsi max', ingredients_text: '', categories_tags: ['en:beverages', 'en:carbonated-drinks', 'en:artificially-sweetened-beverages', 'en:sodas', 'en:diet-sodas'] });
  assert.equal(D.ns23Sweeteners(p), 1);
  const c = D.ns23SweetenerCheck(p), a = D.assessGrade(p);
  assert.equal(c.evidence, 'category'); assert.equal(a.grade, 'C'); assert.match(a.caveats[0], /filed under artificially sweetened drinks/);
  assert.equal(D.ns23SweetenerCheck(zero()).evidence, 'named');
  assert.match(D.assessGrade(zero()).caveats[0], /named in the ingredient list/);
  // a plain soda category says nothing about sweeteners
  assert.equal(D.ns23Sweeteners(zero({ ingredients_text: '', categories_tags: ['en:beverages', 'en:sodas'] })), null);
  for (const f of ['chunk-BQKWV521-v106.js', 'i18n-de-v106.js', 'i18n-es-v106.js', 'i18n-fr-v106.js', 'i18n-it-v106.js']) for (const k of ['named in the ingredient list', 'filed under artificially sweetened drinks']) assert.ok(read('assets/' + f).includes(JSON.stringify(k) + ':"'), `${f}: ${k}`);
});
