import test from 'node:test';
import assert from 'node:assert/strict';
import { productKind, productUseMatch, isSupplement } from '../src/match-policy.mjs';
import { compatibleFoods, discoveryFamily } from '../src/comparison-guards.mjs';

const P = (name, extra = {}) => ({ name, categories: [], basis: 'g', nutrition: {}, ...extra });
const ok = (family, a, b) => productUseMatch(P(a), P(b), family).ok;

// Every pair below was a real suggestion v61 (or the first v62 draft) could produce from the shipped catalogue.
test('different intended use is never the same product type', () => {
  assert.equal(ok('chocolate', 'Dark Chocolate', 'κακαο ION'), false, 'chocolate bar vs cocoa powder');
  assert.equal(ok('chocolate', 'Σοκολάτα με πορτοκάλι', 'CACAO (Belbake)'), false);
  assert.equal(ok('chocolate', 'Dark Chocolate', 'Κρεμα βανίλια σοκολάτα'), false, 'bar vs cream dessert');
  assert.equal(ok('chocolate', 'Milk Chocolate', 'Μπουγάτσα Με Κρέμα Και Σοκολάτα'), false, 'bar vs pastry');
  assert.equal(ok('cheese', 'Kalathaki', 'Cottage Cheese'), false, 'Greek hard cheese vs cottage cheese');
  assert.equal(ok('cheese', 'Feta P.D.O.', 'Gouda slices'), false);
  assert.equal(ok('cake', 'Amadeus cake', 'Wafle kukurydziane'), false, 'cake vs puffed corn cake');
  assert.equal(ok('cereal', 'ΔΗΜΗΤΡΙΑΚΑ ΒΡΩΜΗΣ', 'Σπαγγέτι ολικής άλεσης'), false, 'cereal vs spaghetti');
  assert.equal(ok('nut', 'Walnut kernel', 'Almond Drink plant-based'), false, 'nuts vs plant drink');
  assert.equal(ok('fat', 'soft', 'Pre-Fried Potatoes in Palm Oil'), false, 'margarine vs frozen fries');
  assert.equal(ok('meat', 'Smoked Turkey Fillet', 'XL Γλυκόξινο Κοτόπουλο Με Basmati'), false, 'deli slices vs ready meal');
  assert.equal(ok('meat', 'Smoked Turkey Fillet', 'Chicken nuggets'), false, 'deli slices vs breaded nuggets');
  assert.equal(ok('soda', 'Epsa Lemonada', 'Soda water'), false, 'lemonade vs plain soda water');
  assert.equal(ok('ice-cream', 'Mini Ksilakia', 'BBQ Sauce'), false, 'a mis-filed record cannot be a substitute');
  assert.equal(ok('legume-veg', 'Στραγάλια Ψημένα Αφράτα', 'Spinat Blattspinat'), false, 'roasted chickpea snack vs spinach');
  assert.equal(ok('sweets', 'Snickers', 'Protein chocolate cookie dough'), false, 'candy bar vs protein snack');
  assert.equal(ok('bread', 'Ψωμί Γερμανικού Τύπου', 'Αραβική Πιτα'), false, 'loaf vs pita');
  assert.equal(ok('juice', 'Φυσικός χυμός πορτοκάλι', 'Avocando Mint'), false, 'juice vs smoothie');
  assert.equal(ok('pizza', 'Margherita pizza', 'Pizza base dough'), false);
});

test('the same kind of product is still offered', () => {
  assert.equal(ok('chocolate', 'Dark Chocolate', 'Milk Chocolate Stevia'), true);
  assert.equal(ok('chocolate', 'Σοκολάτα γάλακτος', 'Chocolate negro. Cacao 95%'), true);
  assert.equal(ok('cheese', 'Kalathaki', 'ΓΡΑΒΙΕΡΑ ΑΝΑΛΑΤΗ'), true, 'both Greek hard cheeses');
  assert.equal(ok('cheese', 'Feta P.D.O.', 'φέτα Δωδώνη'), true);
  assert.equal(ok('soda', 'Βίκος Cola', 'Coca-Cola Zero Sugar'), true);
  assert.equal(ok('cereal', 'Cornflakes Proteino', 'Weetabix Original'), false, 'protein-positioned vs plain: kept apart on purpose');
  assert.equal(ok('cereal', 'Corn Flakes Chocos', 'Weetabix Original'), true);
  assert.equal(ok('meat', 'Veggie chicken', 'Tofu natur'), false, 'a plant chicken substitute is not tofu (audit P0-1: different cooking use)');
  assert.equal(ok('meat', 'Vegan burger', 'Plant based burgers'), true, 'same form of plant protein');
  assert.equal(ok('meat', 'Smoked Turkey Fillet', 'Καπνιστή Γαλοπούλα Σε Φέτες'), true);
  assert.equal(ok('plant-drink', 'Almond drink', 'Alpro Soya Unsweetened'), true);
  assert.equal(ok('yogurt', 'Στραγγιστό γιαούρτι 2%', 'STRAINED COW YOGURT 0% FAT'), true);
  assert.equal(ok('pasta', 'Spaghetti No.7', 'Πένες ριγέ ολικής άλεσης'), true);
  assert.equal(ok('juice', 'Φυσικός χυμός πορτοκάλι', 'Apple juice 100%'), true);
});

test('a candidate that is only the same aisle is not enough when both are unresolved', () => {
  // "meal" is a wide default: two unrelated meals need a specific shared category to be comparable
  assert.equal(productUseMatch(P('Freskoulis Caesar’s Salad'), P('Γαρίδες λαδολέμονο'), 'meal').ok, false);
  const shared = { categories: ['en:salads'] };
  assert.equal(productUseMatch(P('Caesar salad', shared), P('Greek salad', shared), 'meal').ok, true);
});

test('a savoury cracker filed as a biscuit is not a substitute for a sweet cookie', () => {
  const legacy = () => 'biscuit', cookie = P('Choco cookies', { nutrition: { sugars: 31 } }), cracker = P('chickpea biscuit', { nutrition: { sugars: 1.3 } }), other = P('Digestive biscuits', { nutrition: { sugars: 18 } });
  assert.equal(compatibleFoods(cookie, cracker, legacy, 'biscuit'), false);
  assert.equal(compatibleFoods(cookie, other, legacy, 'biscuit'), true);
});

test('Greek text resolves: no word boundary can silently fail next to a Greek letter', () => {
  assert.equal(productKind(P('φέτα Δωδώνη'), 'cheese').type, 'cheese:feta');
  assert.equal(productKind(P('Ζωμός Κότας'), 'soup').type, 'stock-cube');
  assert.equal(productKind(P('Αραβική Πιτα'), 'bread').type, 'bread:pita');
  assert.equal(productKind(P('κακαο ION'), 'chocolate').type, 'cocoa-powder');
  assert.equal(productKind(P('ΑΜΥΓΔΑΛΟ'), 'plant-drink').type.startsWith('plant-drink'), true);
  assert.equal(productKind(P('Κεφαλογραβιέρα'), 'cheese').type, 'cheese:greek-hard');
});

test('the family guess never decides a grade: discovery only', () => {
  assert.equal(typeof discoveryFamily(P('Feta'), () => ''), 'string');
});

// Independent audit of 63.0.0 (P0-1): three pairs the shipped review packet offered as better choices. Real records are used where they exist.
test('audit P0-1: supplements, salads and forms of plant protein are never swapped', async () => {
  const { catalogue, domain } = await import('./helpers.mjs');
  const dom = await domain(), { manifest, byCode } = catalogue();
  const get = code => { const r = byCode.get(code); return { family: r.family, p: { ...dom.parseProduct({ product: r.raw, fetchedAt: manifest.exportedAt }, code), catalogueSnapshot: { provider: 'openfoodfacts-daily-export', exportedAt: manifest.exportedAt } } }; };
  const pairs = [['3800048203015', '4335619172173', 'iced tea vs whey protein powder with an iced-tea flavour (a dietary supplement)'], ['5205461232327', '5202576380578', 'a prepared salad with dressing vs green beans in tomato sauce'], ['8002670504026', '4056489068198', 'plant-based burgers vs plain tofu']];
  for (const [a, b, why] of pairs) { const A = get(a), B = get(b); assert.equal(productUseMatch(A.p, B.p, A.family).ok, false, why); assert.equal(compatibleFoods(A.p, B.p, () => '', A.family), false, why + ' (discovery)'); }
  // the grade behind the third item was a letter-only agreement with an estimate: it is the source's own letter, not a comparable verified grade
  const beans = dom.assessGrade(get('5202576380578').p); assert.equal(beans.status, 'reported'); assert.equal(beans.method, null);
});

test('audit P0-1: Greek and imported variants of the same mistakes', () => {
  const P = (name, categories = []) => ({ name, categories, basis: 'g', nutrition: {} });
  assert.equal(ok('meal', 'Σαλάτα Caesar με dressing', 'Φασολάκια σε σάλτσα ντομάτας'), false, 'head noun decides, not "με dressing" / "σε σάλτσα"');
  assert.equal(ok('meal', "Caesar's Salad with Dressing", 'Green beans in tomato sauce'), false);
  assert.equal(ok('sauce', 'Caesar dressing', 'Tomato sauce'), false, 'two real condiments still differ by kind');
  assert.equal(ok('coffee-tea', 'Ice Tea Peach', 'ISO WHEY Peach Ice Tea Flavour'), false);
  assert.equal(ok('coffee-tea', 'Ice Tea Peach', 'Συμπλήρωμα διατροφής ice tea'), false);
  assert.equal(isSupplement(P('Creatine Monohydrate')), true); assert.equal(isSupplement(P('Whey Protein Isolate')), true); assert.equal(isSupplement(P('Protein Powder - Cookies & Cream')), true);
  assert.equal(isSupplement(P('Crunchy Protein Bar', ['en:protein-bars'])), false, 'a protein bar is a snack bar and is compared as one');
  assert.equal(isSupplement(P('Greek yogurt 2%')), false); assert.equal(isSupplement(P('Peach ice tea', ['en:iced-teas'])), false);
  assert.equal(ok('meat', 'Plant based sausages', 'Tofu'), false); assert.equal(ok('meat', 'Vegan nuggets', 'Vegan burger'), false);
  assert.equal(ok('meat', 'Vegan μπιφτέκια', 'Plant based burgers'), true);
});
