/* Nutri-Score 2023, exact-input scoring for every table the method has (general foods, drinks, water, cheese, fats/oils/nuts/seeds,
 * red-meat protein cap). FoodScan uses it to VERIFY a grade the source published, never to invent one:
 *   - a source grade is "reproduced" only when the points computed here equal the points the source published, to the integer;
 *   - a grade that cannot be the published points' grade under ANY table the record could belong to is a contradiction;
 *   - nothing here fills a missing nutrient with a guess (unknown inputs end the calculation).
 * Tables follow Santé publique France 2023 as implemented by Open Food Facts' reference code (ProductOpener::Nutriscore).
 * This file has no imports: tools/build-v62.mjs inlines it (without `export`) into the domain module and the Worker. */

const ns23TH = {
  energy: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350],
  energyBev: [30, 90, 150, 210, 240, 270, 300, 330, 360, 390],
  sugars: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
  sugarsBev: [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11],
  saturatedFat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  salt: Array.from({ length: 20 }, (_, i) => (i + 1) / 5),
  energySat: [120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200],
  satRatio: [10, 16, 22, 28, 34, 40, 46, 52, 58, 64],
  fvl: [40, 60, 80, 80, 80],
  fvlBev: [40, 40, 60, 60, 80, 80],
  fibre: [3, 4.1, 5.2, 6.3, 7.4],
  protein: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
  proteinBev: [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3]
};
const ns23Above = (list, v) => list.reduce((n, s) => n + (v > s ? 1 : 0), 0);
const ns23AtLeast = (list, v) => list.reduce((n, s) => n + (v >= s ? 1 : 0), 0);
const ns23Known = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const ns23Fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
const ns23Drink = kind => kind === 'beverage' || kind === 'water';

/** Letter for a point total in each table. Water is always A. */
function ns23GradeOfScore(score, kind = 'general') {
  if (kind === 'water') return 'A';
  if (kind === 'beverage') return score <= 2 ? 'B' : score <= 6 ? 'C' : score <= 9 ? 'D' : 'E';
  if (kind === 'fat') return score <= -6 ? 'A' : score <= 2 ? 'B' : score <= 10 ? 'C' : score <= 18 ? 'D' : 'E';
  return score <= 0 ? 'A' : score <= 2 ? 'B' : score <= 10 ? 'C' : score <= 18 ? 'D' : 'E';
}
const ns23ProteinCounts = (negative, kind, fvlPoints) => ns23Drink(kind) || kind === 'cheese' ? true : kind === 'fat' ? negative < 7 || fvlPoints === 5 : negative < 11 || fvlPoints === 5;
const ns23Ratio = (sat, fat) => (sat > 0 ? Math.round(sat / (fat > 0 ? fat : sat) * 1000) / 10 : 0);

/** The whole calculation for exact inputs. `sweeteners` is the count of non-nutritive sweeteners (drinks only). */
function ns23Score({ kj, sugars, saturatedFat, fat = null, salt, fibre = 0, protein = 0, fvl = 0, sweeteners = 0, redMeat = false }, kind = 'general') {
  const drink = ns23Drink(kind), fats = kind === 'fat';
  const negative = {
    energy: fats ? ns23Above(ns23TH.energySat, saturatedFat * 37) : ns23Above(drink ? ns23TH.energyBev : ns23TH.energy, kj),
    sugars: ns23Above(drink ? ns23TH.sugarsBev : ns23TH.sugars, sugars),
    saturatedFat: fats ? ns23AtLeast(ns23TH.satRatio, ns23Ratio(saturatedFat, fat)) : ns23Above(ns23TH.saturatedFat, saturatedFat),
    salt: ns23Above(ns23TH.salt, salt),
    sweeteners: drink && sweeteners > 0 ? 4 : 0
  };
  negative.total = negative.energy + negative.sugars + negative.saturatedFat + negative.salt + negative.sweeteners;
  const fvlPoints = ns23Above(drink ? ns23TH.fvlBev : ns23TH.fvl, fvl);
  const counted = ns23ProteinCounts(negative.total, kind, fvlPoints);
  const positive = { fibre: ns23Above(ns23TH.fibre, fibre), protein: Math.min(ns23Above(drink ? ns23TH.proteinBev : ns23TH.protein, protein), redMeat ? 2 : 7), fvl: fvlPoints, counted };
  positive.total = positive.fibre + positive.fvl + (counted ? positive.protein : 0);
  const score = negative.total - positive.total;
  return { negative, positive, score, grade: ns23GradeOfScore(score, kind), kind };
}

/* ---------- which table could this record belong to? ---------- */
const ns23Has = (cats, ...ids) => ids.some(id => cats.includes(id));
const NS23_BEVERAGE_ALSO = ['en:milks', 'en:plant-based-milk-alternatives', 'en:dairy-drinks', 'en:plant-based-beverages', 'en:tea-based-beverages', 'en:iced-teas', 'en:herbal-tea-beverages', 'en:coffee-beverages', 'en:coffee-drinks', 'en:coffees', 'en:teas', 'en:herbal-teas'];
const NS23_NUT_TAGS = /^en:(?:nuts|peanuts|almonds|hazelnuts|walnuts|cashew-nuts|pistachios|pecan-nuts|macadamia-nuts|brazil-nuts|pine-nuts|mixed-nuts|shelled-nuts|roasted-nuts|salted-nuts|nut-butters|peanut-butters|almond-butters|hazelnut-butters|cashew-butters)$/;
const NS23_RED_MEAT = /^en:(?:beef|beefs|veal|pork|porks|lamb|lambs|mutton|horse-meat|game-meat|venison|beef-meat|pork-meat|lamb-meat|veal-meat|minced-beef|ground-beef|beef-steaks|pork-chops|hams|cooked-hams|dry-hams|bacons|salamis|chorizo|beef-jerky|corned-beef|pork-sausages|beef-sausages)$/;
const NS23_MEAT = /^en:(?:meats|meats-and-their-products|prepared-meats|sausages|charcuteries|cold-cuts|deli-meats|frankfurter-sausages|cooked-sausages)$/;
const NS23_EXEMPT = ['en:alcoholic-beverages', 'en:baby-foods', 'en:baby-milks', 'en:chewing-gum', 'en:food-additives', 'en:dietary-supplements', 'en:meal-replacements', 'en:salts', 'en:spices', 'en:sugar-substitutes', 'en:vinegars', 'en:non-food-products'];
/** PNNS group 2 (assigned by Open Food Facts from the categories) -> tables that remain possible. Several entries = not settled. */
const NS23_PNNS = {
  'artificially sweetened beverages': ['beverage'], 'fruit juices': ['beverage'], 'fruit nectars': ['beverage'], 'sweetened beverages': ['beverage'],
  'unsweetened beverages': ['beverage', 'water'], 'waters and flavored waters': ['beverage', 'water'], 'plant-based milk substitutes': ['beverage'],
  'teas and herbal teas and coffees': ['beverage'], 'tea and coffee': ['beverage'], 'milk and yogurt': ['beverage', 'general'],
  cheese: ['cheese'], fats: ['fat'], nuts: ['fat', 'general'],
  'biscuits and cakes': ['general'], bread: ['general'], 'breakfast cereals': ['general'], cereals: ['general'], 'chocolate products': ['general'],
  'dairy desserts': ['general'], 'dressings and sauces': ['general', 'fat'], 'dried fruits': ['general'], fruits: ['general'], legumes: ['general'],
  'one-dish meals': ['general'], 'pizza pies and quiche': ['general'], 'salty and fatty products': ['general'], sandwiches: ['general'], soups: ['general'],
  sweets: ['general'], vegetables: ['general'], 'ice cream': ['general'], appetizers: ['general'], potatoes: ['general'], 'fish and seafood': ['general'],
  eggs: ['general'], meat: ['general'], 'processed meat': ['general'], 'fish meat eggs': ['general']
};
const NS23_NAME = {
  water: /\b(?:water|eau|acqua|agua|wasser|νερο|μεταλλικο)\b/,
  drink: /\b(?:drink|beverage|juice|nectar|soda|cola|lemonade|tonic|iced tea|smoothie|kefir|milk|γαλα|χυμοσ|χυμου|νεκταρ|αναψυκτ|λεμοναδα|πορτοκαλαδα|ροφημα)\b/,
  meat: /\b(?:beef|pork|lamb|veal|ham|bacon|salami|sausage|chorizo|prosciutto|burger|μοσχαρ|χοιριν|αρνι|ζαμπον|μπεικον|σαλαμι|λουκανικ)\b/
};
const NS23_SWEETENER_E = /^e(?:950|951|952|954|955|957|959|960[a-d]?|961|962|969)$/;
const NS23_SWEETENER_WORDS = /acesulfam|aspartam|cyclamat|saccharin|sucralos|thaumatin|neohesperidin|steviol|stevia|neotam|advantam|ασπαρταμ|ακεσουλφαμ|σουκραλοζ|στεβια|γλυκαντικ|sweetener|edulcorant|dolcificant|edulcorante|sussstoff|zoetstof/;

/** Tables that remain possible for the record, how that was settled, and the red-meat state ('certain' | 'maybe' | false).
 * `exempt` is true when the method does not apply (alcohol, baby food, spices, salt...). */
function ns23Kinds(p) {
  const cats = p?.categories || [], n = p?.nutrition || {}, name = ns23Fold(`${p?.name || ''} ${p?.brand || ''}`);
  if (ns23Known(n.alcohol) && n.alcohol > 1.2) return { kinds: [], via: 'composition', exempt: true };
  if (cats.length && ns23Has(cats, ...NS23_EXEMPT)) return { kinds: [], via: 'category', exempt: true };
  const red = cats.some(c => NS23_RED_MEAT.test(c)) ? 'certain' : cats.some(c => NS23_MEAT.test(c)) || NS23_NAME.meat.test(name) ? 'maybe' : false;
  if (cats.length) {
    const beverage = (ns23Has(cats, 'en:beverages', 'en:beverage-preparations') && !ns23Has(cats, 'en:meal-replacement', 'en:soups')) || ns23Has(cats, ...NS23_BEVERAGE_ALSO);
    const water = ns23Has(cats, 'en:spring-waters') && !ns23Has(cats, 'en:flavored-waters', 'en:flavoured-waters');
    const cheese = ns23Has(cats, 'en:cheeses') && !ns23Has(cats, 'fr:fromages-blancs');
    const fat = !ns23Has(cats, 'en:chestnuts') && (ns23Has(cats, 'en:fats', 'en:creams', 'en:seeds') || cats.some(c => NS23_NUT_TAGS.test(c)));
    const kind = beverage ? (water ? 'water' : 'beverage') : cheese ? 'cheese' : fat ? 'fat' : 'general';
    return { kinds: [kind], via: 'category', red, exempt: false };
  }
  const group = ns23Fold(p?.pnns || '');
  if (NS23_PNNS[group]) {
    let kinds = NS23_PNNS[group].slice();
    // The name settles a drink-or-food group when it is clear.
    if (kinds.includes('water') && !(NS23_NAME.water.test(name) && !NS23_NAME.drink.test(name))) kinds = kinds.filter(k => k !== 'water');
    return { kinds, via: 'pnns', red, exempt: false };
  }
  return { kinds: [], via: 'none', exempt: false, unknown: true };
}

/** Number of non-nutritive sweeteners the record shows; `null` when the record has neither ingredients nor additives to tell. */
function ns23Sweeteners(p) {
  const additives = Array.isArray(p?.additives) ? p.additives : [];
  const hits = new Set(additives.filter(a => NS23_SWEETENER_E.test(String(a).toLowerCase())));
  const text = ns23Fold(p?.ingredients || '');
  if (NS23_SWEETENER_WORDS.test(text)) hits.add('named');
  if (hits.size) return hits.size;
  return text.length > 3 || additives.length ? 0 : null;
}

/** Exact inputs for the tables, or null when something the points need is not reported (nothing is guessed). */
function ns23Inputs(p) {
  const n = p?.nutrition || {};
  const kj = ns23Known(n.kj) ? n.kj : ns23Known(n.kcal) ? n.kcal * 4.184 : null;
  if (kj === null || !['sugars', 'saturatedFat', 'salt'].every(k => ns23Known(n[k]))) return null;
  return { kj, sugars: n.sugars, saturatedFat: n.saturatedFat, fat: ns23Known(n.fat) ? n.fat : null, salt: n.salt,
    fibre: ns23Known(n.fiber) ? n.fiber : 0, protein: ns23Known(n.protein) ? n.protein : 0, fvl: ns23Known(n.fvl) && n.fvl <= 100 ? n.fvl : 0,
    protein_known: ns23Known(n.protein), fibre_known: ns23Known(n.fiber) };
}

/**
 * Verifies a source-published grade against the published points.
 *   reproduced  - exact inputs give EXACTLY the published points and letter under a table the record may belong to
 *   contradicts - the published letter is impossible for the published points under every table the record may belong to
 *   consistent  - the letter fits the points under at least one table (so nothing contradicts it), but we could not recompute it
 *   unchecked   - no published points, or the method does not apply
 * Returns { status, kind?, calc?, tried }. Never throws for odd records.
 */
function ns23Verify(p) {
  const letter = typeof p?.nutriScore === 'string' ? p.nutriScore : null, points = p?.nutriScoreValue;
  if (!/^[A-E]$/.test(letter || '') || !Number.isFinite(points)) return { status: 'unchecked', reason: 'no-points' };
  const where = ns23Kinds(p);
  if (where.exempt) return { status: 'unchecked', reason: 'method-not-applicable' };
  const possible = where.unknown ? ['general', 'beverage', 'fat', 'cheese', 'water'] : where.kinds;
  if (!possible.length) return { status: 'unchecked', reason: 'kind-unknown' };
  // Category tags are inherited (rice sits under "seeds"), so a record placed in the fat table may really be scored as an ordinary food:
  // a letter is only a contradiction when no table that could apply gives it for the published points.
  const fits = possible.filter(k => ns23GradeOfScore(points, k) === letter);
  const alsoGeneral = possible.includes('fat') && !fits.length && ns23GradeOfScore(points, 'general') === letter;
  if (!fits.length && !alsoGeneral) return { status: 'contradicts', letter, points, kinds: possible, via: where.via };
  if (!fits.length) return { status: 'consistent', kinds: ['general'], via: where.via, reason: 'table-ambiguous' };
  const input = ns23Inputs(p);
  if (!input || p.basisSource === 'assumed' && possible.some(ns23Drink)) return { status: 'consistent', kinds: fits, via: where.via, reason: input ? 'basis-assumed' : 'inputs-missing' };
  const sweet = ns23Sweeteners(p), tried = [];
  for (const kind of fits) {
    if (kind === 'water') continue; // water is A by definition; its points are not recomputed
    if (kind === 'fat' && input.fat === null) continue;
    const reds = where.red === 'certain' ? [true] : where.red === 'maybe' ? [false, true] : [false];
    for (const redMeat of reds) for (const s of ns23Drink(kind) ? (sweet === null ? [0, 1] : [sweet]) : [0]) {
      const calc = ns23Score({ ...input, sweeteners: s, redMeat }, kind);
      tried.push({ kind, score: calc.score, redMeat, sweeteners: s });
      if (calc.score === points && calc.grade === letter) return { status: 'reproduced', kind, calc, input, via: where.via, tried, redMeat, sweeteners: s };
    }
  }
  return { status: 'consistent', kinds: fits, via: where.via, tried, reason: 'points-differ' };
}

/** The point-by-point breakdown (the shape the report's "why this grade" reads) for a reproduced grade. */
function ns23Data(calc, input, kind) {
  const part = (id, points, max, value, unit) => ({ id, points, max, value, unit });
  const drink = ns23Drink(kind), fats = kind === 'fat', neg = calc.negative, pos = calc.positive;
  const negative = fats
    ? [part('energy_from_saturated_fat', neg.energy, 10, Math.round(input.saturatedFat * 37), 'kJ'), part('sugars', neg.sugars, 15, input.sugars, 'g'), part('saturated_fat_ratio', neg.saturatedFat, 10, ns23Ratio(input.saturatedFat, input.fat), '%'), part('salt', neg.salt, 20, input.salt, 'g')]
    : [part('energy', neg.energy, 10, Math.round(input.kj), 'kJ'), part('sugars', neg.sugars, drink ? 10 : 15, input.sugars, 'g'), part('saturated_fat', neg.saturatedFat, 10, input.saturatedFat, 'g'), part('salt', neg.salt, 20, input.salt, 'g'), ...(drink ? [part('non_nutritive_sweeteners', neg.sweeteners, 4, neg.sweeteners ? 1 : 0, 'number')] : [])];
  const positive = [part('fiber', pos.fibre, 5, input.fibre_known ? input.fibre : null, 'g'), part('proteins', pos.counted ? pos.protein : 0, 7, input.protein_known ? input.protein : null, 'g'), part('fruits_vegetables_legumes', pos.fvl, drink ? 6 : 5, input.fvl, '%')];
  return { version: '2023', negative, positive, negativePoints: neg.total, positivePoints: pos.total, countProteins: pos.counted,
    proteinReason: pos.counted ? (drink ? 'beverage' : kind === 'cheese' ? 'cheese' : 'negative_points_less_than_11') : 'negative_points_greater_than_or_equal_to_11',
    beverage: kind === 'beverage', water: kind === 'water', cheese: kind === 'cheese', fatOil: fats, redMeat: false, estimated: true };
}

export { ns23Data, ns23Verify, ns23Score, ns23Kinds, ns23GradeOfScore, ns23Inputs, ns23Sweeteners, ns23TH }; // @strip-on-inline
