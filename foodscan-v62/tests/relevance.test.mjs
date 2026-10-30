import test from 'node:test';
import assert from 'node:assert/strict';
import { productKind, productUseMatch } from '../src/match-policy.mjs';
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
  assert.equal(ok('meat', 'Veggie chicken', 'Tofu natur'), true, 'both meat alternatives');
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
