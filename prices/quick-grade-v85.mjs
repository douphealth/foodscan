/* FoodScan 85: the quick grade. A product with no Nutri-Score on record very often has the numbers a grade needs (in the Greek catalogue: 3,069 of 7,961 products
 * without a grade carry energy, sugars, saturated fat and salt). FoodScan does not calculate a grade for them because the record has no confirmed category, so it cannot
 * tell which of the four Nutri-Score 2023 tables applies. This module answers that without asking the shopper anything:
 *   1. which tables could apply: from the category or PNNS group when the record has one, otherwise from the product name, its unit (ml or g) and its composition;
 *   2. the letters the official calculation gives over every table that could apply and over every value the missing favourable nutrients (fibre, protein, fruit and
 *      vegetables) could take, limited by what physics allows (the same bounds the app uses to verify source grades: ns23Tier);
 *   3. one letter when they all agree, up to three when they do not (a band on the A-E scale), nothing when they span more; and a "most likely" letter, the
 *      score the reported values give, where every unreported favourable nutrient counts as zero points (Open Food Facts' own convention).
 *   A product missing exactly ONE of sugars, saturated fat or salt is bounded too: sugars by the carbohydrate, saturates by the fat, salt by a cap of 3 g per 100 g
 *   (96 % of graded products are below it); with a missing unfavourable nutrient there is no "most likely" letter, only the band.
 * The result is an ESTIMATE, labelled as such, and never feeds rankings or "better choice". It is measured against Open Food Facts' own published letters on
 * every graded Greek product (tools/quick-grade-validate.mjs, qa/quick-grade.test.mjs). Pure functions, no DOM. */
import { ns23Tier, ns23Inputs, ns23Kinds, ns23Sweeteners, ns23Fold, ns23Score, ns23GradeOfScore, ns23Data, ns23NoPlantEvidence } from '../assets/domain-v8500.mjs';

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
/** Why the Nutri-Score method does not apply to a product (so there is no grade to find, rather than missing data). */
export function exemptWhy(p, alcohol = null) {
  const cats = (p?.categories || []).join(' '), name = fold(p?.name || '');
  if ((known(alcohol) && alcohol > 1.2) || /alcoholic|wines?\b|beers?\b|spirits/.test(cats) || W.alcohol.test(name)) return 'alcohol';
  if (/\ben:(?:salts?|sea-salts?|iodised-salts?|spices?|herbs?|seasonings?|vinegars?|sugar-substitutes|sweeteners?)\b|salts|spice|vinegar/.test(cats) || /(?<![\p{L}])(?:salt|salz|sel|sale|αλατι|αλατοσ|spice|μπαχαρικα|vinegar|ξυδι|pepper|πιπερι|paprika|oregano|ριγανη)(?![\p{L}])/u.test(name)) return 'seasoning';
  if (/supplement|meal-replacement|dietary/.test(cats)) return 'supplement';
  if (/baby|infant/.test(cats)) return 'baby';
  return 'other';
}
const SALT_CAP = 3; // g per 100 g; 96 % of the graded Greek products are below it (tools/quick-grade-validate.mjs prints the figures)
const LABEL_KEYS = { sugars: 'sugars', saturatedFat: 'saturated fat', salt: 'salt' };
const NEED = ['energy', 'sugars', 'saturated fat', 'salt'];

/** Letter ladder of one table: the lowest and highest score each letter covers (null = open end). */
export function ladder(kind) {
  const out = {};
  for (let s = -30; s <= 60; s++) { const g = ns23GradeOfScore(s, kind); (out[g] ||= [s, s])[1] = s; }
  for (const g of Object.keys(out)) { if (out[g][0] === -30) out[g][0] = null; if (out[g][1] === 60) out[g][1] = null; }
  return out;
}
const grid = (hi, step) => { const o = []; for (let v = 0; v <= hi + 1e-9; v += step) o.push(Math.round(v * 1000) / 1000); if (o.at(-1) < hi) o.push(Math.round(hi * 1000) / 1000); return o; };
const pointsOf = (input, kind, key, value, red) => { const r = ns23Score({ ...input, [key]: value, sweeteners: 0, redMeat: red }, kind); return key === 'fibre' ? r.positive.fibre : key === 'protein' ? r.positive.protein : r.positive.fvl; };

/** What the label would have to say for the grade to move: for each unreported favourable nutrient, the smallest value that changes the letter. */
function movers(input, kind, red, likely, sweet) {
  const out = [], drink = kind === 'beverage' || kind === 'water';
  const carbs = input._carbs, fat = input._fat, kj = input.kj;
  const caps = { fibre: Math.min(100, carbs != null ? Math.max(0, carbs - input.sugars) + 1 : kj / 8), protein: Math.min(100, fat != null && carbs != null ? Math.max(0, (kj * 1.03 + 15 - 37 * fat - 17 * carbs) / 17) : kj / 17), fvl: input._plantless ? 0 : 100 };
  for (const [key, known] of [['fibre', input.fibre_known], ['protein', input.protein_known], ['fvl', input.fvl_known]]) {
    if (known || caps[key] <= 0) continue;
    const step = key === 'fvl' ? 1 : 0.1;
    for (let v = step; v <= caps[key] + 1e-9; v += step) {
      const g = ns23Score({ ...input, [key]: v, sweeteners: drink && sweet ? 1 : 0, redMeat: red }, kind).grade;
      if (g !== likely) { out.push({ key, value: Math.round(v * 10) / 10, becomes: g, max: Math.round(caps[key] * 10) / 10 }); break; }
    }
  }
  return out;
}

/** The estimate for a normalised product (assets/domain parseProduct). `ok` is true when the letters span at most three grades. */
export function quickGrade(p, { ignoreCategories = false, alcohol = null, forced = null, kindsOverride = null } = {}) {
  if (!p?.nutrition || p.partial || p.nutritionInvalid) return NO('unusable');
  if (p.nutritionEstimated) return NO('estimated-nutrition');
  if (p.nutriScoreExcluded) return NO('excluded', { why: exemptWhy(p, alcohol) });
  // alcohol is outside the Nutri-Score method; the normalised record drops the alcohol field, so it is passed in from the source record
  if (!forced && ((known(alcohol) && alcohol > 1.2) || W.alcohol.test(fold(p.name || '')))) return NO('exempt', { why: 'alcohol' });
  const probe = ignoreCategories ? { ...p, categories: [], pnns: 'unknown' } : p;
  const n = p.nutrition, haveEnergy = known(n.kj) || known(n.kcal);
  const absent = [!haveEnergy && 'energy', !known(n.sugars) && 'sugars', !known(n.saturatedFat) && 'saturated fat', !known(n.salt) && 'salt'].filter(Boolean);
  if (absent.length > 1 || (absent.length === 1 && absent[0] === 'energy')) return NO('inputs-missing', { have: 4 - absent.length, missing: absent });
  const missingKey = absent[0] === 'sugars' ? 'sugars' : absent[0] === 'saturated fat' ? 'saturatedFat' : absent[0] === 'salt' ? 'salt' : null;
  const input = ns23Inputs(missingKey ? { ...probe, nutrition: { ...probe.nutrition, [missingKey]: 0 } } : probe);
  if (!input) return NO('inputs-missing', { have: 4 - absent.length, missing: absent });
  const carbs = known(n.carbohydrates) ? n.carbohydrates : null, fat = known(n.fat) ? n.fat : null;
  Object.assign(input, { _carbs: carbs, _fat: fat, _plantless: ns23NoPlantEvidence(probe) });
  const where = forced ? { kinds: [forced.kind], via: 'label', red: false } : ns23Kinds(probe);
  if (where.exempt) return NO('exempt', { why: exemptWhy(p, alcohol) });
  let kinds = where.kinds, via = where.via, reds = where.red === 'certain' ? [true] : where.red === 'maybe' ? [false, true] : [false];
  if (!kinds.length) { const inf = inferKinds(probe); kinds = inf.kinds; via = inf.via; reds = inf.red ? [false, true] : [false]; }
  if (kindsOverride && !forced && !where.kinds.length) { kinds = kindsOverride; via = 'peers'; }
  const sweet = forced ? (forced.kind === 'beverage' ? (forced.sweeteners ? 1 : 0) : 0) : ns23Sweeteners(probe), letters = new Set(), used = [], missing = new Set();
  const hi = missingKey === 'salt' ? SALT_CAP : missingKey === 'sugars' ? Math.min(100, carbs ?? Math.min(100, input.kj / 17)) : missingKey === 'saturatedFat' ? Math.min(100, fat ?? Math.min(100, input.kj / 37)) : 0;
  const samples = missingKey ? grid(hi, missingKey === 'salt' ? 0.05 : 0.25) : [0];
  for (const kind of kinds) {
    if (kind === 'water') { letters.add('A'); used.push(kind); continue; }
    if (kind === 'fat' && input.fat === null) continue;
    for (const redMeat of reds) for (const v of samples) {
      const inp = missingKey ? { ...input, [missingKey]: v } : input;
      const calc = ns23Score({ ...inp, sweeteners: kind === 'beverage' && sweet ? 1 : 0, redMeat }, kind), tier = ns23Tier(probe, inp, kind, redMeat, sweet, calc);
      tier.letters.forEach(l => letters.add(l)); tier.missing.forEach(m => missing.add(m)); if (!used.includes(kind)) used.push(kind);
    }
  }
  const list = [...letters].sort();
  if (!list.length) return NO('no-table');
  if (forced?.kind === 'water') return { ok: true, letters: ['A'], likely: 'A', grade: 'A', kinds: ['water'], kind: 'water', via: 'label', missing: [], confidence: 'high', source: 'label', data: null, ladder: null, movers: [], inputs: {} };
  if (list.length > 3) return NO('too-uncertain', { letters: list, kinds: used });
  const basisAssumed = p.basisSource === 'assumed';
  // measured against Open Food Facts' letters (tools/quick-grade-validate.mjs): foods settled by default or by name 96-99 %, composition and drinks 58-86 %
  let confidence = via === 'unit' || via === 'composition' ? 'low' : 'high';
  if (missingKey || list.length === 3) confidence = confidence === 'low' ? 'low' : 'medium';
  const base = { source: forced ? 'label' : 'estimate', ok: true, letters: list, kinds: used, via, missing: [...missing], missingKey, basisAssumed, confidence, inferredKind: ['name', 'unit', 'composition', 'default', 'peers'].includes(via) };
  const kind0 = used[0] === 'water' ? used[1] || 'water' : used[0], inputsOf = () => ({ kj: Math.round(input.kj), kcal: known(n.kcal) ? n.kcal : Math.round(input.kj / 4.184), fat: input.fat, saturatedFat: missingKey === 'saturatedFat' ? null : input.saturatedFat, carbs, sugars: missingKey === 'sugars' ? null : input.sugars, fibre: input.fibre_known ? input.fibre : null, protein: input.protein_known ? input.protein : null, salt: missingKey === 'salt' ? null : input.salt, fvl: input.fvl_known ? input.fvl : null, fvlText: forced?.fvlText || null });
  if (missingKey) {
    // the numbers that are on record are scored exactly; the missing one is not scored, so the totals are partial and only the band is shown
    const c0 = ns23Score({ ...input, sweeteners: 0, redMeat: reds[0] }, kind0);
    return { ...base, likely: null, grade: list.length === 1 ? list[0] : null, kind: kind0, data: ns23Data(c0, input, kind0), partialData: true, ladder: ladder(kind0), movers: [], inputs: inputsOf(), sweetenersUnknown: kind0 === 'beverage' && sweet === null,
      bound: { key: missingKey, label: LABEL_KEYS[missingKey], max: Math.round(hi * 100) / 100, how: missingKey === 'salt' ? 'cap' : missingKey === 'sugars' ? (carbs != null ? 'carbohydrate' : 'energy') : (fat != null ? 'fat' : 'energy') } };
  }
  // the most likely letter: the reported values as they are, unreported favourable nutrients at zero, no sweeteners unless the record shows them
  const kind = used[0] === 'water' ? used[1] || 'water' : used[0], red = reds[0];
  const calc = ns23Score({ ...input, sweeteners: kind === 'beverage' && sweet ? 1 : 0, redMeat: red }, kind), likely = calc.grade;
  const data = ns23Data(calc, input, kind);
  return { ...base, grade: list.length === 1 ? list[0] : null, likely, score: calc.score, kind, data, ladder: ladder(kind), movers: movers(input, kind, red, likely, sweet), sweetenersUnknown: kind === 'beverage' && sweet === null, redMeat: red, inputs: inputsOf() };
}

/** The exact grade for numbers the shopper confirmed against a label photo, in the same model the estimate uses (so the same card shows it).
 *  v: { kj, kcal, fat, sat, carbs, sugars, fibre, protein, salt } per 100 g/ml; kind: general | beverage | water | cheese | fat; fvl: a value inside the chosen band, or null when unknown. */
export function labelGrade(v, { kind = 'general', fvl = null, fvlText = null, sweeteners = false } = {}) {
  if (kind === 'water') return { source: 'label', ok: true, letters: ['A'], likely: 'A', grade: 'A', kinds: ['water'], kind: 'water', via: 'label', missing: [], confidence: 'high', data: null, ladder: null, movers: [], inputs: {} };
  const p = { name: '', categories: [], ingredients: '', basis: kind === 'beverage' || kind === 'water' ? 'ml' : 'g', nutrition: { kj: v.kj ?? null, kcal: v.kcal ?? null, fat: v.fat ?? null, saturatedFat: v.sat ?? null, carbohydrates: v.carbs ?? null, sugars: v.sugars ?? null, fiber: v.fibre ?? null, protein: v.protein ?? null, salt: v.salt ?? null, fvl } };
  return quickGrade(p, { forced: { kind, sweeteners, fvlText } });
}
