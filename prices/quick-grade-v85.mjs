/* FoodScan 85: the quick grade. A product with no Nutri-Score on record very often has the numbers a grade needs (in the Greek catalogue: 3,069 of 7,961 products
 * without a grade carry energy, sugars, saturated fat and salt). FoodScan does not calculate a grade for them because the record has no confirmed category, so it cannot
 * tell which of the four Nutri-Score 2023 tables applies. This module answers that without asking the shopper anything:
 *   1. which tables could apply: from the category or PNNS group when the record has one, otherwise from the product name, its unit (ml or g) and its composition;
 *   2. the letters the official calculation gives over every table that could apply and over every value the missing favourable nutrients (fibre, protein, fruit and
 *      vegetables) could take, limited by what physics allows (the same bounds the app uses to verify source grades: ns23Tier);
 *   3. one letter when they all agree, two when they do not, nothing when they span more.
 * The result is an ESTIMATE, labelled as such, and never feeds rankings or "better choice". It is measured against Open Food Facts' own published letters on
 * every graded Greek product (tools/quick-grade-validate.mjs, qa/quick-grade.test.mjs). Pure functions, no DOM. */
import { ns23Tier, ns23Inputs, ns23Kinds, ns23Sweeteners, ns23Fold } from '../assets/domain-v8500.mjs';
import { ns23Score } from '../assets/domain-v8500.mjs';

const fold = ns23Fold;
const L = words => new RegExp(`(?<![\\p{L}])(?:${words})(?![\\p{L}])`, 'u');
/** Name words (English, Greek, French, German, Spanish, Italian, Bulgarian), matched on text with accents removed. \b does not work for Greek, so Unicode lookarounds are used. */
const W = {
  water: L('water|eau|agua|acqua|wasser|νερο|νερα|μεταλλικο|aqua'),
  drink: L('drinks?|beverages?|juices?|nectars?|sodas?|cola|lemonade|tonic|iced? tea|ice tea|smoothies?|kefir|milk|shakes?|boissons?|jus|getrank|getranke|saft|bebidas?|zumos?|bevanda|succo|napoj|napoje|drank|χυμοσ|χυμοι|νεκταρ|αναψυκτικο|αναψυκτικα|λεμοναδα|πορτοκαλαδα|ροφημα|γαλα|τσαι|kombucha|energy|rtd|latte|mocha|cappuccino|frappe|φραπε|καφεσ|βιταμινουχο'),
  hot: L('tea|teas|τσαι|τσαγι|coffee|coffees|καφεσ|καφε|χαμομηλι|infusion|infusions|ροφημα|cocoa|cacao|κακαο|nesquik|goody|ovomaltine|ovaltine|chai|matcha|mate|rooibos|herbal|βοτανο'),
  soup: L('soups?|σουπα|σουπεσ|veloute|brodo|broth|bouillon|ζωμοσ|sauce|σαλτσα|dressing|ketchup|mayonnaise|μαγιονεζα|mustard|μουσταρδα|syrup|σιροπι|vinegar|ξυδι|yogurt|yoghurt|γιαουρτι|dessert|pudding|custard|ice cream|παγωτο|gelato|crema|compote|puree|jam|μαρμελαδα'),
  cheese: L('сирене|кашкавал|сыр|anthotyro|anthoturo|ξινομυζηθρα|ξινοτυρο|κασκαβαλι|cheeses?|τυρι|τυρια|τυρακι|φετα|feta|gouda|edam|emmental|emmentaler|mozzarella|παρμεζανα|parmesan|parmigiano|grana|padano|cheddar|κασερι|kasseri|kaskaval|γραβιερα|graviera|μανουρι|ανθοτυρο|χαλουμι|halloumi|hellim|brie|camembert|ricotta|μυζηθρα|κεφαλοτυρι|kefalotyri|fromages?|kase|queso|formaggio|formaggi|mascarpone|τυροκομικο|babybel|vache qui rit|philadelphia|gruyere|maasdam|leerdammer|roquefort|gorgonzola|pecorino|manchego|provolone|raclette|fontina|cottage|quark|skyr|σκηρ|labneh|rallado|grated cheese'),
  cheeseNot: L('pizza|πιτσα|pie|πιτα|πιτακια|τυροπιτα|σαλτσα|sauce|snack|crisps|chips|burger|σαντουιτσ|sandwich|toast|τοστ|cracker|κρακερ|biscuits?|μπισκοτα|bar|salad|σαλατα|pasta|ζυμαρικα|ravioli|tortellini|cake|κεικ|tarte|quiche|baguette|μπαγκετα|bread|ψωμι|κουλουρι|παξιμαδ|πατατακια|dip|σως|spread|αλειφομενο|soup|σουπα|noodles|nuggets|croquette|κροκετες|stick|sticks|μπαστουνακια|puffs|σνακ'),
  fatw: L('oils?|ελαιολαδο|ελαιολαδου|λαδι|ελαιο|butter|βουτυρο|margarine|μαργαρινη|nuts?|καρυδια|καρυδι|αμυγδαλα|φυστικι|φυστικια|peanuts?|almonds?|walnuts?|cashews?|hazelnuts?|φουντουκι|φουντουκια|tahini|ταχινι|seeds?|σπορο|σπορουσ|σπορων|lard|ghee|pistachios?|κρεμα γαλακτοσ|sahne|cream|olive|pecans?|macadamia|kernels?|ηλιοσπορο|σουσαμι|sesame|chia|λιναρι|flax'),
  fatNot: L('chocolate|σοκολατα|biscuits?|cookies?|μπισκοτα|cake|bar|cereal|δημητριακα|muesli|granola|spread|πραλινα|praline|nutella|crisps|chips|candy|drink|milk|γαλα|sauce|dressing|ice cream|παγωτο|cheese|bread'),
  ice: L('ice cream|παγωτο|glace|gelato|eis'),
  alcohol: L('wines?|beers?|vodka|whisky|whiskey|gin|rum|tequila|brandy|cognac|liqueurs?|spirits?|champagne|prosecco|cider|ouzo|tsipouro|raki|metaxa|κρασι|μπυρα|βοτκα|ουισκι|τζιν|ραμ|λικερ|ουζο|τσιπουρο|ρακι|μεταξα|σαμπανια|μηλοκιδρο|vin|biere|bier|wein|vino|birra|cerveza|alcohol|αλκοολ'),
  meat: L('beef|pork|lamb|veal|ham|bacon|salami|sausages?|chorizo|prosciutto|burger|μοσχαρι|μοσχαρισιο|χοιρινο|χοιρινα|αρνι|αρνισιο|ζαμπον|μπεικον|σαλαμι|λουκανικο|λουκανικα|παστουρμα|gyros|γυρος|κεφτεδες|κιμας|steak|μπριζολα|μπιφτεκι|κοτοπουλο|γαλοπουλα|chicken|turkey|mince|jerky|pastrami|mortadella|bresaola|speck|pancetta|wurst|rindfleisch|schinken|boeuf|porc|jambon|saucisse|carne|jamon|embutido'),
  fish: L('fish|salmon|tuna|τονοσ|σολομοσ|sardines?|σαρδελα|σαρδελεσ|ψαρι|ψαρια|anchov|γαυροσ|μπακαλιαροσ|cod|shrimp|γαριδα|γαριδεσ|seafood|θαλασσινα|mackerel|σκουμπρι|herring|καπνιστο|smoked|ham|ζαμπον|turkey|γαλοπουλα|chicken|κοτοπουλο|sausage|λουκανικο|salami|σαλαμι|μπεικον|bacon|παστουρμα|pastrami|prosciutto|jamon|wurst|schinken|jambon|saucisse'),
};
const known = v => typeof v === 'number' && Number.isFinite(v);

/** Which Nutri-Score tables could apply, from the name, the unit and the nutrition alone. `via` says what settled it. */
export function inferKinds(p) {
  const name = fold(`${p.name || ''} ${p.brand || ''}`), nu = p.nutrition || {}, kcal = known(nu.kcal) ? nu.kcal : known(nu.kj) ? nu.kj / 4.184 : null;
  const liquid = p.basis === 'ml', red = W.meat.test(name), fat = nu.fat ?? 0, sug = nu.sugars ?? 0;
  if (W.ice.test(name)) return { kinds: ['general'], red, via: 'name' };
  if (liquid) {
    if (fat >= 70 && (W.fatw.test(name) || fat >= 90)) return { kinds: ['fat', 'general'], red, via: 'composition' };
    if (W.soup.test(name) && !W.drink.test(name)) return { kinds: W.fatw.test(name) ? ['general', 'fat'] : ['general'], red, via: 'name' };
    if (W.water.test(name) && (kcal ?? 0) < 5) return { kinds: ['water', 'beverage'], red, via: 'unit' };
    return { kinds: W.soup.test(name) ? ['beverage', 'general'] : ['beverage'], red, via: 'unit' };
  }
  if (W.cheese.test(name)) { const strong = !W.cheeseNot.test(name) && (nu.protein ?? 0) >= 8 && fat >= 10; return { kinds: strong ? ['cheese'] : ['cheese', 'general'], red, via: 'name' }; }
  if (W.drink.test(name) && !W.fatNot.test(name.replace(/milk|γαλα|drink/g, '')) && (kcal ?? 999) < 110) return { kinds: ['beverage', 'general'], red, via: 'name' };
  if (W.hot.test(name) && (kcal ?? 999) < 160 && !W.fatNot.test(name.replace(/cocoa|cacao|κακαο|chocolate|σοκολατα/g, ''))) return { kinds: ['beverage', 'general'], red, via: 'name' };
  if (fat >= 45 && sug < 12 && (W.fatw.test(name) || fat >= 70) && !W.fatNot.test(name)) return { kinds: ['fat', 'general'], red, via: 'name' };
  if (fat >= 80 && sug < 2) return { kinds: ['fat', 'general'], red, via: 'composition' };
  // cheese leaves a fingerprint the name may not carry (a brand such as Dodoni or Kalathaki): protein and fat both high, almost no carbohydrate, salty, no meat or fish in the name
  if ((nu.protein ?? 0) >= 14 && fat >= 14 && (nu.carbohydrates ?? 99) <= 5 && sug <= 5 && (nu.salt ?? 0) >= 0.6 && !W.fish.test(name) && !red) return { kinds: ['cheese', 'general'], red, via: 'composition' };
  return { kinds: ['general'], red, via: 'default' };
}

const NO = (reason, extra = {}) => ({ ok: false, reason, ...extra });
const WHY_NOT = { unusable: 1, 'inputs-missing': 1, exempt: 1, excluded: 1 };

/** The estimate for a normalised product (assets/domain parseProduct). `ok` is true when the letters span at most two grades. */
export function quickGrade(p, { ignoreCategories = false, alcohol = null } = {}) {
  if (!p?.nutrition || p.partial || p.nutritionInvalid) return NO('unusable');
  if (p.nutritionEstimated) return NO('estimated-nutrition');
  if (p.nutriScoreExcluded) return NO('excluded');
  // alcohol is outside the Nutri-Score method; the normalised record drops the alcohol field, so it is passed in from the source record
  if ((known(alcohol) && alcohol > 1.2) || W.alcohol.test(fold(p.name || ''))) return NO('exempt');
  const probe = ignoreCategories ? { ...p, categories: [], pnns: 'unknown' } : p;
  const input = ns23Inputs(probe);
  if (!input) {
    const n = p.nutrition, have = [(known(n.kj) || known(n.kcal)) && 'energy', known(n.sugars) && 'sugars', known(n.saturatedFat) && 'saturated fat', known(n.salt) && 'salt'].filter(Boolean);
    return NO('inputs-missing', { have: have.length, missing: ['energy', 'sugars', 'saturated fat', 'salt'].filter(k => !have.includes(k)) });
  }
  const where = ns23Kinds(probe);
  if (where.exempt) return NO('exempt');
  let kinds = where.kinds, via = where.via, red = where.red === 'certain' ? [true] : where.red === 'maybe' ? [false, true] : [false];
  if (!kinds.length) { const inf = inferKinds(probe); kinds = inf.kinds; via = inf.via; red = inf.red ? [false, true] : [false]; }
  const sweet = ns23Sweeteners(probe), letters = new Set(), missing = new Set(), used = [];
  for (const kind of kinds) {
    if (kind === 'water') { letters.add('A'); used.push(kind); continue; }
    if (kind === 'fat' && input.fat === null) continue;
    for (const redMeat of red) {
      const calc = ns23Score({ ...input, sweeteners: kind === 'beverage' && sweet ? 1 : 0, redMeat }, kind), tier = ns23Tier(probe, input, kind, redMeat, sweet, calc);
      tier.letters.forEach(l => letters.add(l)); tier.missing.forEach(m => missing.add(m)); if (!used.includes(kind)) used.push(kind);
    }
  }
  const list = [...letters].sort();
  if (!list.length) return NO('no-table');
  if (list.length > 2) return NO('too-uncertain', { letters: list, kinds: used });
  const basisAssumed = p.basisSource === 'assumed';
  // measured against Open Food Facts' letters (tools/quick-grade-validate.mjs): foods settled by default or by name 96-99 %, composition and drinks 58-86 %; a basis assumed to be per 100 g is as good as a known one
  const confidence = via === 'unit' || via === 'composition' ? 'low' : 'high';
  return { ok: true, letters: list, grade: list.length === 1 ? list[0] : null, kinds: used, via, missing: [...missing], basisAssumed, confidence, inferredKind: ['name', 'unit', 'composition', 'default'].includes(via) };
}
export { WHY_NOT };
