// src/domain/nutriscore2023.js
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
const ns23ProteinCounts = (negative, kind, fvlPoints) => ns23Drink(kind) || kind === "cheese" ? true : kind === "fat" ? negative < 7 : negative < 11; // 2023 method: no fruit/vegetable exception (that was the 2017 rule)
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
const NS23_WORD = words => new RegExp(`(?<![\\p{L}])(?:${words})(?![\\p{L}])`, 'u');
const NS23_WATER_TAGS = ['en:spring-waters', 'en:waters', 'en:mineral-waters', 'en:natural-mineral-waters', 'en:bottled-waters', 'en:still-waters', 'en:carbonated-waters', 'en:sparkling-waters'];
const NS23_POULTRY_TAGS = /^en:(?:poultries|chickens|turkeys|chicken-breasts|turkey-breasts|chicken-meats|turkey-meats)$/;
const NS23_NAME = {
  water: NS23_WORD('water|eau|acqua|agua|wasser|νερο|νερα|μεταλλικο|επιτραπεζιο'),
  drink: NS23_WORD('drinks?|beverages?|juices?|nectars?|sodas?|cola|lemonade|tonic|iced? tea|smoothies?|kefir|milk|γαλα|χυμοσ|χυμου|χυμοι|νεκταρ|αναψυκτ[α-ω]*|λεμοναδα|πορτοκαλαδα|ροφημα'),
  meat: NS23_WORD('beef|pork|lamb|veal|mutton|ham|bacon|salami|sausages?|chorizo|prosciutto|mortadella|pancetta|burger|μοσχαρ[α-ω]*|χοιριν[α-ω]*|αρνι[α-ω]*|ζαμπον|μπεικον|σαλαμι|λουκανικ[α-ω]*|παστουρμα[α-ω]*'),
  poultry: NS23_WORD('chicken|turkey|poultry|κοτοπουλ[α-ω]*|γαλοπουλ[α-ω]*|πουλερικ[α-ω]*')
};
// categories whose fruit/vegetable/legume share the source fixes at 100 whatever the ingredient estimate says
const NS23_FVL_OVERRIDE = ['en:olive-oils', 'en:rapeseed-oils', 'en:colza-oils', 'en:walnut-oils'];
const NS23_SWEETENER_E = /^e(?:950|951|952|954|955|957|959|960[a-d]?|961|962|969)$/;
// 103: the sweetener component counts the intense sweeteners the Nutri-Score 2023 rules list (E950-E962, E969), named or by number. Polyols (erythritol, xylitol,
// sorbitol...) are not on that list. The bare word "sweetener" does not say which kind is meant, and "without sweeteners" or "sweetening apple concentrate" names none.
const NS23_SWEETENER_WORDS = /acesulfam|aspartam|cyclamat|saccharin|sucralos|thaumatin|neohesperidin|steviol|stevia|neotam|advantam|ασπαρταμ|ακεσουλφαμ|σουκραλοζ|στεβια|στεβιολ|σακχαριν|κυκλαμικ|θαυματιν|νεοεσπεριδιν|(?<![a-zα-ω0-9])[eε] ?(?:950|951|952|954|955|957|959|960[a-d]?|961|962|969)(?![0-9])/;
// 103: a named sweetener after a negation ("without aspartame", "χωρίς ασπαρτάμη", "aspartame-free") is not an ingredient
const NS23_SWEETENER_NAMED = 'acesulfam|aspartam|cyclamat|saccharin|sucralos|thaumatin|neohesperidin|steviol|stevia|neotam|advantam|ασπαρταμ|ακεσουλφαμ|σουκραλοζ|στεβια|στεβιολ|σακχαριν|κυκλαμικ|θαυματιν|νεοεσπεριδιν';
const NS23_SWEETENER_NEG = new RegExp(`(?<![a-zα-ω])(?:without|no|free of|free from|sans|ohne|senza|sin|sem|zonder|χωρισ|δεν περιεχει)(?: [a-zα-ω0-9]+){0,3}? (?:${NS23_SWEETENER_NAMED})[a-zα-ω]*(?:(?: (?:or|and|ou|et|oder|und|o|y|e|η|και) | ?, ?)(?:${NS23_SWEETENER_NAMED})[a-zα-ω]*)*|(?:${NS23_SWEETENER_NAMED})[a-zα-ω]*[ -]free(?![a-zα-ω])`, 'g');
const NS23_SWEETENER_GENERIC = /sweetener|γλυκαντικ|edulcorant|dolcificant|sussstoff|sussungsmittel|zoetstof/;
const NS23_POLYOLS = /erythrit|xylit|sorbit|maltit|isomalt|mannit|lactit|polyol|ερυθριτ|ξυλιτ|σορβιτ|μαλτιτ|ισομαλτ|μαννιτ|λακτιτ|πολυολ|(?<![a-zα-ω0-9])[eε] ?(?:420|421|953|965|966|967|968)(?![0-9])/;
const NS23_SWEETENER_NOT = /(?:without|no|sans|ohne|senza|sin|sem|zonder|χωρισ)(?: (?:added|ajout[a-z]*|zusatz|προσθηκη|προσθετα|τεχνητα|artificial|artificiels?))?(?: [a-zα-ω]+)? (?:sweeteners?|γλυκαντικ[α-ω]*|edulcorants?|dolcificant[a-z]*|edulcorantes?|sussstoff[a-z]*|sussungsmittel[a-z]*|zoetstof[a-z]*)|γλυκαντικ[α-ω]* συμπυκνωμα[α-ω]*|sweetening (?:concentrate|juice)/g;

/* ---- 103: a drink the source graded as a solid food ----
 * Open Food Facts chooses the drinks table from its own English category tags. A record whose category is free text ("el:Αναψυκτικά", "el:Χυμός") or missing is
 * scored with the table for solid foods, where a soda reaches B and a sweetened iced tea A. Under the Nutri-Score 2023 rules only water is A among drinks.
 * A record counts as a drink here only when BOTH hold: its values are per 100 ml (declared, or read from a volume on the pack), and its name or one of its
 * categories, in any language, names a drink, while nothing names a liquid food (sauce, soup, cream, condensed milk, vinegar, oil, syrup, ice cream, yogurt)
 * or alcohol. Anything less clear is left to the source's own table. */
const NS23_DRINK_TEXT = NS23_WORD('drinks?|beverages?|juices?|nectars?|sodas?|colas?|lemonades?|orangeades?|tonic|iced? teas?|teas?|kombuchas?|smoothies?|kefirs?|ayran|milks?|milkshakes?|shakes?|isotonic|latte|cappuccino|frappe|cold brew|boissons?|jus|limonades?|laits?|the glace|getrank|getranke|saft|safte|schorle|eistee|milch|bebidas?|zumos?|refrescos?|leche|batidos?|bevanda|bevande|succo|succhi|bibita|bibite|aranciata|sumos?|refrigerantes?|leite|dranken|drank|sap|melk|frisdrank|napoj|napoje|sok|soki|mleko|icecek|ayrani|sut|сок|сокове|напиток|напитка|молоко|мляко|лимонад|чай|кефир|айран|αναψυκτικ[α-ω]*|χυμ(?:οσ|ου|οι|ων|ουσ|ο)|νεκταρ|φρουτοποτ[α-ω]*|λεμοναδ[α-ω]*|πορτοκαλαδ[α-ω]*|βυσσιναδ[α-ω]*|γκαζοζ[α-ω]*|ροφημα[α-ω]*|γαλα|γαλακτοσ|τσαι|κεφιρ|αριανι|ξινογαλ[α-ω]*|ποτο|ποτα');
const NS23_LIQUID_FOOD = NS23_WORD('sauces?|salsa|ketchup|mayonnaise|mayo|mustard|dressings?|vinaigrette|marinade|soups?|broth|bouillon|stock|creams?|creme|cremes|crema|whipping|sahne|schlagcreme|schlagsahne|panna|nata|condensed|evaporated|concentre|concentrated|concentrate|vinegars?|vinaigre|essig|aceto|balsamic[oa]?|oils?|huile|olio|aceite|syrups?|sirop|sirup|sciroppo|cordial|squash|ice cream|glace|gelato|sorbet|yogh?urts?|yaourts?|desserts?|puddings?|custard|purees?|passata|jam|eggs?|powder|capsules?|tea bags?|instant|ground|beans|κρεμ[α-ω]*|συμπυκνωμεν[α-ω]*|εβαπορε|ξ[ιυ]δ[ιη][α-ω]*|βαλσαμικ[α-ω]*|ελαιολαδ[α-ω]*|λαδι|ελαιο|σιροπ[α-ω]*|παγωτ[α-ω]*|γιαουρτ[α-ω]*|επιδορπι[α-ω]*|σαλτσ[α-ω]*|σουπ[α-ω]*|ζωμ[α-ω]*|μαγιονεζ[α-ω]*|μουσταρδ[α-ω]*|κετσαπ|μαρμελαδ[α-ω]*|αυγ[α-ω]*|σκονη|καψουλ[α-ω]*|φακελακια|στιγμιαι[α-ω]*|φιλτρου|αλεσμεν[α-ω]*|μακαρον[α-ω]*');
const NS23_ALCOHOL_TEXT = NS23_WORD('wines?|beers?|biere|bier|birra|cerveza|vodka|whisky|whiskey|gin|rum|tequila|brandy|cognac|liqueurs?|spirits?|champagne|prosecco|cider|radler|ouzo|tsipouro|raki|vin|wein|vino|μπυρ[α-ω]*|κρασ[α-ω]*|οιν[α-ω]*|βοτκα|ουισκι|λικερ|ουζο|τσιπουρο|ρακι|αλκοολ[α-ω]*');
const NS23_JUICE = 'juices?|jus|saft|zumos?|succo|sumos?|sap|sok|сок|χυμ(?:οσ|ου|οι|ο)';
const NS23_PURE_JUICE = new RegExp(`(?<![\\p{L}\\d])100 ?%[^,;()]{0,24}(?<![\\p{L}])(?:${NS23_JUICE})(?![\\p{L}])|(?<![\\p{L}])(?:${NS23_JUICE})(?![\\p{L}])[^,;()]{0,24}100 ?%|(?<![\\p{L}])φυσικ(?:οσ|ου|οι) χυμ(?:οσ|ου|οι)(?![\\p{L}])`, 'u');
const NS23_FRUIT_DRINK = NS23_WORD(NS23_JUICE + '|χυμων|χυμουσ|nectars?|νεκταρ|smoothies?|φρουτοποτ[α-ω]*');
const NS23_NOT_PURE =NS23_WORD('nectars?|νεκταρ|drinks?|φρουτοποτ[α-ω]*|αναψυκτικ[α-ω]*|boissons?|getrank|bebidas?|bevanda|sodas?');
const ns23Text = p => ns23Fold(`${p?.name || ''} ${(p?.categories || []).join(' ')}`).replace(/[-_:]+/g, ' ');
/** 'beverage' | 'water' when the record is clearly a drink by its own unit and words, else null. */
function ns23DrinkEvidence(p) {
  if (p?.basis !== 'ml' || p.basisSource === 'assumed') return null;
  const text = ns23Text(p), n = p.nutrition || {};
  if (NS23_LIQUID_FOOD.test(text) || NS23_ALCOHOL_TEXT.test(text) || (ns23Known(n.alcohol) && n.alcohol > 1.2)) return null;
  // a pack sold by weight is not taken for a drink, whatever the record's unit says
  const q = ns23Fold(p.quantity || '');
  if (/\d\s*(?:g|gr|kg|γρ|γραμμαρ[α-ω]*)(?![\p{L}])/u.test(q) && !/\d\s*(?:ml|cl|dl|l|lt|lit|litres?|liters?|λιτρ[α-ω]*|fl)(?![\p{L}])/u.test(q)) return null;
  if (NS23_DRINK_TEXT.test(text)) return 'beverage';
  if (!NS23_NAME.water.test(text)) return null;
  return (n.sugars ?? 0) === 0 && (n.kcal ?? (ns23Known(n.kj) ? n.kj / 4.184 : 0)) < 5 && !ns23Sweeteners(p) ? 'water' : 'beverage';
}
/** True when the name or a category states a pure fruit juice ("100 % juice", "φυσικός χυμός"): its fruit share is then 100 by definition of the name. */
function ns23PureJuice(p) {
  if (p?.basis !== 'ml' || p.basisSource === 'assumed') return false;
  const text = ns23Text(p);
  return NS23_PURE_JUICE.test(text) && !NS23_NOT_PURE.test(text) && !NS23_LIQUID_FOOD.test(text);
}

/** Tables that remain possible for the record, how that was settled, and the red-meat state ('certain' | 'maybe' | false).
 * `exempt` is true when the method does not apply (alcohol, baby food, spices, salt...). */
function ns23Kinds(p) {
  const cats = p?.categories || [], n = p?.nutrition || {}, name = ns23Fold(`${p?.name || ''} ${p?.brand || ''}`);
  if (ns23Known(n.alcohol) && n.alcohol > 1.2) return { kinds: [], via: 'composition', exempt: true };
  if (cats.length && (ns23Has(cats, ...NS23_EXEMPT) || cats.some(c => /supplement|\u03c3\u03c5\u03bc\u03c0\u03bb\u03b7\u03c1\u03c9\u03bc/i.test(c)))) return { kinds: [], via: 'category', exempt: true };
  const isPoultry = cats.some(c => NS23_POULTRY_TAGS.test(c)) || (NS23_NAME.poultry.test(name) && !NS23_NAME.meat.test(name));
  const red = isPoultry ? false : cats.some(c => NS23_RED_MEAT.test(c)) ? 'certain' : cats.some(c => NS23_MEAT.test(c)) || NS23_NAME.meat.test(name) ? 'maybe' : false;
  if (cats.length) {
    const beverage = (ns23Has(cats, 'en:beverages', 'en:beverage-preparations') && !ns23Has(cats, 'en:meal-replacement', 'en:soups')) || ns23Has(cats, ...NS23_BEVERAGE_ALSO);
    const water = ns23Has(cats, ...NS23_WATER_TAGS) && !ns23Has(cats, 'en:flavored-waters', 'en:flavoured-waters', 'en:sweetened-beverages', 'en:sodas') && (n.sugars ?? 0) === 0 && (n.kcal ?? 0) < 5;
    const cheese = ns23Has(cats, 'en:cheeses') && !ns23Has(cats, 'fr:fromages-blancs');
    const fat = !ns23Has(cats, 'en:chestnuts') && (ns23Has(cats, 'en:fats', 'en:creams', 'en:seeds') || cats.some(c => NS23_NUT_TAGS.test(c)));
    const kind = beverage ? (water ? 'water' : 'beverage') : cheese ? 'cheese' : fat ? 'fat' : 'general';
    if (kind === 'general') { const drink = ns23DrinkEvidence(p); if (drink) return { kinds: [drink], via: 'evidence', red: false, exempt: false }; }
    return { kinds: [kind], via: 'category', red, exempt: false };
  }
  const group = ns23Fold(p?.pnns || '');
  if (NS23_PNNS[group]) {
    let kinds = NS23_PNNS[group].slice();
    // The name settles a drink-or-food group when it is clear.
    if (kinds.includes('water') && !(NS23_NAME.water.test(name) && !NS23_NAME.drink.test(name))) kinds = kinds.filter(k => k !== 'water');
    return { kinds, via: 'pnns', red, exempt: false };
  }
  const drink = ns23DrinkEvidence(p);
  if (drink) return { kinds: [drink], via: 'evidence', red: false, exempt: false };
  return { kinds: [], via: 'none', exempt: false, unknown: true };
}

/** Number of non-nutritive sweeteners the record shows; `null` when the record has neither ingredients nor additives to tell. */
const ns23SweetenerCategory = p => (Array.isArray(p?.categories) ? p.categories : []).some(c => c === 'en:artificially-sweetened-beverages' || /^en:[a-z0-9-]+-with-sweeteners$/.test(c));
/** Where the sweeteners are on the record: 'named' (additive tag or ingredient list) | 'category' | null. */
function ns23SweetenerEvidence(p) {
  const additives = Array.isArray(p?.additives) ? p.additives : [];
  if (additives.some(a => NS23_SWEETENER_E.test(String(a).toLowerCase())) || NS23_SWEETENER_WORDS.test(ns23Fold(p?.ingredients || '').replace(NS23_SWEETENER_NEG, ' '))) return 'named';
  return ns23SweetenerCategory(p) ? 'category' : null;
}
function ns23Sweeteners(p) {
  const additives = Array.isArray(p?.additives) ? p.additives : [];
  const hits = new Set(additives.filter(a => NS23_SWEETENER_E.test(String(a).toLowerCase())));
  const text = ns23Fold(p?.ingredients || '');
  if (NS23_SWEETENER_WORDS.test(text.replace(NS23_SWEETENER_NEG, ' '))) hits.add('named');
  if (hits.size) return hits.size;
  // the source's own category says so, whatever the ingredient list (missing, or misread by a scanner) leaves open
  if (ns23SweetenerCategory(p)) return 1;
  // "sweetener" with none of the counted ones named: polyols are not counted; with nothing named it is not known which kind it is
  if (NS23_SWEETENER_GENERIC.test(text.replace(NS23_SWEETENER_NOT, ' '))) return NS23_POLYOLS.test(text) ? 0 : null;
  return text.length > 3 || additives.length ? 0 : null;
}

/** Exact inputs for the tables, or null when something the points need is not reported (nothing is guessed). */
function ns23Inputs(p) {
  const n = p?.nutrition || {};
  const kj = ns23Known(n.kj) ? n.kj : ns23Known(n.kcal) ? n.kcal * 4.184 : null;
  if (kj === null || !['sugars', 'saturatedFat', 'salt'].every(k => ns23Known(n[k]))) return null;
  const oil = (p?.categories || []).some(c => NS23_FVL_OVERRIDE.includes(c));
  return { kj, sugars: n.sugars, saturatedFat: n.saturatedFat, fat: ns23Known(n.fat) ? n.fat : null, salt: n.salt,
    fibre: ns23Known(n.fiber) ? n.fiber : 0, protein: ns23Known(n.protein) ? n.protein : 0, fvl: oil ? 100 : ns23Known(n.fvl) && n.fvl <= 100 ? n.fvl : 0,
    protein_known: ns23Known(n.protein), fibre_known: ns23Known(n.fiber), fvl_known: oil || (ns23Known(n.fvl) && n.fvl <= 100) };
}

/* ---- evidence tiers (64.0) ----
 * Open Food Facts counts a fibre, protein or fruit-vegetable value that is not reported as 0 points. Matching the published points under that
 * convention is real evidence, but it is not independent verification when those inputs were missing. So every reproduction is tiered:
 *   complete  - every favourable input (and, for drinks, the sweetener check) was reported: nothing was assumed
 *   robust    - something was missing, but the letter is the same for EVERY value physics and the ingredient list still allow
 *   partial   - something was missing and the letter could differ: the source's own grade, not comparable, with the reason */
const NS23_PLANT = /fruit|vegetable|legume|bean|(?:^| )pea(?:s)?(?: |$)|lentil|chickpea|tomato|nut|almond|olive|spinach|carrot|onion|garlic|pepper|cabbage|apple|orange|lemon|berr|banana|grape|peach|apricot|mango|φρουτ|λαχανικ|οσπρι|φασολ|φακ|ρεβιθ|ντοματ|καρυδ|αμυγδαλ|ελι|σπανακ|καροτ|κρεμμυδ|σκορδ|πιπερ|μηλ|πορτοκαλ|λεμον|φραουλ|μπανα/;
const ns23NoPlantEvidence = p => { const t = ns23Fold(p?.ingredients || ''); return t.length > 3 && !NS23_PLANT.test(t); };
function ns23Options(table, max) { const out = new Set([0]); for (const v of [...table, max]) if (v <= max) out.add(ns23Above(table, v)); out.add(ns23Above(table, max)); return [...out]; }
function ns23Tier(p, input, kind, redMeat, sweet, calc) {
  const drink = ns23Drink(kind), n = p?.nutrition || {}, sweetKnown = !drink || sweet !== null;
  if (input.fibre_known && input.protein_known && input.fvl_known && sweetKnown) return { tier: 'complete', letters: [calc.grade], missing: [] };
  const fat = ns23Known(n.fat) ? n.fat : null, carbs = ns23Known(n.carbohydrates) ? n.carbohydrates : null, kj = input.kj;
  const fibreMax = input.fibre_known ? input.fibre : Math.min(100, carbs !== null ? Math.max(0, carbs - input.sugars) + 1 : kj / 8);
  const proteinMax = input.protein_known ? input.protein : Math.min(100, fat !== null && carbs !== null ? Math.max(0, (kj * 1.03 + 15 - 37 * fat - 17 * carbs) / 17) : kj / 17);
  const fvlMax = input.fvl_known ? input.fvl : ns23NoPlantEvidence(p) ? 0 : 100;
  const fibreOpts = input.fibre_known ? [ns23Above(ns23TH.fibre, input.fibre)] : ns23Options(ns23TH.fibre, fibreMax);
  const protTable = drink ? ns23TH.proteinBev : ns23TH.protein, fvlTable = drink ? ns23TH.fvlBev : ns23TH.fvl;
  const protOpts = (input.protein_known ? [ns23Above(protTable, input.protein)] : ns23Options(protTable, proteinMax)).map(v => Math.min(v, redMeat ? 2 : 7));
  const fvlOpts = input.fvl_known ? [ns23Above(fvlTable, input.fvl)] : ns23Options(fvlTable, fvlMax);
  const sweetOpts = drink ? (sweet === null ? [0, 1] : [sweet]) : [0];
  const baseNeg = calc.negative.total - calc.negative.sweeteners, letters = new Set();
  for (const f of fibreOpts) for (const pr of protOpts) for (const v of fvlOpts) for (const s of sweetOpts) {
    const neg = baseNeg + (drink && s > 0 ? 4 : 0), counted = ns23ProteinCounts(neg, kind, v);
    letters.add(ns23GradeOfScore(neg - (f + v + (counted ? pr : 0)), kind));
  }
  const missing = [!input.fibre_known && 'fibre', !input.protein_known && 'protein', !input.fvl_known && 'fruit, vegetables and legumes', !sweetKnown && 'sweeteners'].filter(Boolean);
  return { tier: letters.size === 1 && letters.has(calc.grade) ? 'robust' : 'partial', letters: [...letters].sort(), missing };
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
      if (calc.score === points && calc.grade === letter) return { status: 'reproduced', kind, calc, input, via: where.via, tried, redMeat, sweeteners: s, ...ns23Tier(p, input, kind, redMeat, sweet, calc) };
    }
  }
  return { status: 'consistent', kinds: fits, via: where.via, tried, reason: 'points-differ' };
}

/**
 * 103: did the source grade a drink with the table for solid foods? Returns null when there is nothing to say (not clearly a drink, the source used the drinks
 * table, or its letter is one the drinks table can give for these values). Otherwise:
 *   corrected  - the drinks table gives exactly one letter for the reported values, and it is not the published one: { calc, input, tier }
 *   band       - the drinks table gives several letters (fruit share or sweeteners not reported), none of them the published one: { letters, missing }
 *   impossible - the published letter is A, which only water can have, and the values needed for the drinks table are missing
 */
/** Inputs for the drinks table. A name that states a pure juice ("100 % juice", "φυσικός χυμός") fixes the fruit share at 100: the source's own share is an
 * estimate from the ingredient list, and it reads 0 whenever that list is missing or not in a language its parser knows. */
function ns23DrinkInputs(p) {
  const input = ns23Inputs(p);
  if (!input) return input;
  if (ns23PureJuice(p)) return { ...input, fvl: 100, fvl_known: true, fvl_from_name: true };
  // a share of 0 on a juice, nectar or smoothie is that estimate failing, not a fact, unless an ingredient list is there and names no plant
  if (input.fvl_known && input.fvl === 0 && NS23_FRUIT_DRINK.test(ns23Text(p)) && !ns23NoPlantEvidence(p)) return { ...input, fvl_known: false };
  return input;
}
function ns23DrinkCheck(p) {
  const letter = typeof p?.nutriScore === 'string' ? p.nutriScore : null;
  if (!/^[A-E]$/.test(letter || '') || p.nutriScoreExcluded) return null;
  const d = p.nutriScoreData;
  if (d && (d.beverage || d.water)) return null; // the source already used the drinks table
  const where = ns23Kinds(p);
  if (where.exempt || where.via !== 'evidence') return null;
  if (where.kinds[0] === 'water') return null; // plain water is A under either table
  const input = ns23DrinkInputs(p);
  if (!input) return letter === 'A' ? { state: 'impossible' } : null;
  // a name that states a pure juice also settles the sweeteners: the law allows none in a fruit juice, so a missing ingredient list leaves nothing open
  const sweet = ns23Sweeteners(p) ?? (input.fvl_from_name ? 0 : null), calc = ns23Score({ ...input, sweeteners: sweet ? 1 : 0, redMeat: false }, 'beverage');
  const tier = ns23Tier(p, input, 'beverage', false, sweet, calc);
  if (tier.letters.includes(letter)) return null;
  if (tier.letters.length === 1) return { state: 'corrected', calc, input, tier: tier.tier, juice: Boolean(input.fvl_from_name) };
  return { state: 'band', letters: tier.letters, missing: tier.missing, calc, input };
}

/**
 * 103: did the source leave out the sweeteners its own record names? Open Food Facts finds sweeteners with its ingredient parser, which reads few Greek lists:
 * a zero-sugar cola then keeps B, where the Nutri-Score 2023 rules add 4 points for any intense sweetener and give C. Returns null unless ALL hold: the record
 * is a drink by the source's own category, its values are per 100 ml as declared, the ingredient list names an intense sweetener (or the record tags one),
 * the published points equal the drinks-table points WITHOUT the sweetener component (so that component is the only difference), and the letter changes.
 */
function ns23SweetenerCheck(p) {
  const letter = typeof p?.nutriScore === 'string' ? p.nutriScore : null, points = p?.nutriScoreValue;
  if (!/^[A-E]$/.test(letter || '') || p.nutriScoreExcluded || !Number.isFinite(points) || p.basis !== 'ml' || p.basisSource === 'assumed') return null;
  const d = p.nutriScoreData;
  if (d && (d.water || (d.negative || []).some(x => x.id === 'non_nutritive_sweeteners' && x.points > 0))) return null; // the source counted them
  const where = ns23Kinds(p);
  if (where.exempt || where.via === 'evidence' || where.kinds.length !== 1 || where.kinds[0] !== 'beverage') return null;
  if (!(ns23Sweeteners(p) > 0)) return null;
  const input = ns23Inputs(p);
  if (!input) return null;
  const without = ns23Score({ ...input, sweeteners: 0, redMeat: false }, 'beverage');
  if (without.score !== points || without.grade !== letter) return null;
  const calc = ns23Score({ ...input, sweeteners: 1, redMeat: false }, 'beverage');
  if (calc.grade === letter) return null;
  return { calc, input, without, evidence: ns23SweetenerEvidence(p) };
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

