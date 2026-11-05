// src/domain/categories.js
var GENERIC = /* @__PURE__ */ new Set([
  "plant-based-foods-and-beverages",
  "plant-based-foods",
  "beverages-and-beverages-preparations",
  "beverages",
  "non-alcoholic-beverages",
  "fruit-based-foods-and-beverages",
  "vegetable-based-foods-and-beverages",
  "dairies",
  "fermented-foods",
  "fermented-milk-products",
  "breakfasts",
  "cereals-and-potatoes",
  "cereals-and-their-products",
  "groceries",
  "snacks",
  "meals",
  "canned-foods",
  "frozen-foods",
  "dried-products",
  "dried-products-to-be-rehydrated",
  "dried-plant-based-foods",
  "pasteurised-products",
  "pasteurized-products",
  "fruits-and-vegetables-based-foods",
  "sweet-snacks",
  "salty-snacks",
  "meats-and-their-products",
  "seafood",
  "unsweetened-beverages",
  "carbonated-drinks",
  "plant-based-beverages",
  "fruit-based-beverages",
  "en:other"
]);
var SUSPECT = /* @__PURE__ */ new Set(["dairy-substitutes", "milk-substitutes", "other", "products", "foods"]);
var NAME_TYPES = [
  {
    tag: "en:pastas",
    label: "pasta",
    agree: /pasta|spaghetti|macaroni|noodle|penne|fusilli|tagliatelle|linguine|farfalle|rigatoni|durum/,
    name: /(?<![\p{L}])(?:spaghetti|penne|fusilli|macaroni|tagliatelle|linguine|farfalle|rigatoni|pasta|nudeln|μακαρονια|σπαγγετι|πεννε|φουζιλι|ζυμαρικα)/u,
    not: /sauce|salad|σαλατα|σως/
  },
  { tag: "en:rices", label: "rice", agree: /rice/, name: /(?<![\p{L}])(?:rice|riso|riz|reis|arroz|ρυζι)(?![\p{L}])/u, not: /milk|drink|cake|cracker|pudding|vinegar|noodle|cooker|γαλα/ },
  { tag: "en:yogurts", label: "yogurt", agree: /yogurt|yoghurt/, name: /(?<![\p{L}])(?:yogurt|yoghurt|joghurt|yaourt|γιαουρτ)/u, not: /drink|ποτο|chocolate|candy/ },
  { tag: "en:colas", label: "cola", agree: /cola/, name: /(?<![\p{L}])(?:cola|κολα)(?![\p{L}])/u, not: /coconut/ },
  { tag: "en:orange-juices", label: "orange juice", agree: /orange-juice|juices/, name: /orange juice|jus d orange|orangensaft|χυμος πορτοκαλι|zumo de naranja/u, not: /soda|fizz/ },
  { tag: "en:olive-oils", label: "olive oil", agree: /olive-oil/, name: /olive oil|ελαιολαδο|huile d olive|olivenol|aceite de oliva|olio d oliva/u, not: /mayonnaise|spray|μαγιονεζα/ },
  { tag: "en:cornflakes", label: "cornflakes", agree: /corn-?flakes|breakfast-cereals/, name: /corn ?flakes|κορν φλεικς/u, not: /bar/ },
  { tag: "en:peanut-butters", label: "peanut butter", agree: /peanut-butter/, name: /peanut butter|erdnussbutter|beurre de cacahuete|φυστικοβουτυρο/u, not: /cookie|biscuit|cup/ },
  { tag: "en:ketchup", label: "ketchup", agree: /ketchup/, name: /(?<![\p{L}])(?:ketchup|κετσαπ)(?![\p{L}])/u, not: /^$/ },
  { tag: "en:honeys", label: "honey", agree: /honey/, name: /(?<![\p{L}])(?:honey|miel|honig|μελι)(?![\p{L}])/u, not: /bar|cereal|glaze|mustard|cake/ },
  // Greek staples, by the Greek words on local packs: many local records have a name but no usable category. Greek words only:
  // an English "chocolate biscuit bar" must stay a hybrid, decided by the family word lists below.
  { tag: "en:breads", label: "bread", agree: /bread|rusk|crispbread|toast/, name: /(?<![\p{L}])(?:παξιμαδ|κριτσιν|φρυγαν|ψωμ|αρτος|τοστ|μπαγκετ)/u, not: /γλυκ/ },
  { tag: "en:cheeses", label: "cheese", agree: /cheese|feta/, name: /(?<![\p{L}])(?:φετα|γραβιερ|κασερ|κεφαλοτυρ|κεφαλογραβιερ|μυζηθρ|ανθοτυρ|χαλουμ|μοτσαρελ|γκουντα|ενταμ|παρμεζαν|τυρι|feta|halloumi|graviera)/u, not: /γευση|πατατακ/ },
  { tag: "en:biscuits", label: "biscuit", agree: /biscuit|cookie|wafer/, name: /(?<![\p{L}])(?:μπισκοτ|κουλουρ|πτι μπερ|μιραντα|γκοφρετ)/u, not: /παγωτ/ },
  { tag: "en:chocolates", label: "chocolate", agree: /chocolate/, name: /(?<![\p{L}])(?:σοκολατ|κουβερτουρ)/u, not: /ροφημα|γαλα|μπισκοτ|δημητριακ/ },
  { tag: "en:breakfast-cereals", label: "cereal", agree: /cereal|oat|muesli|granola|flake/, name: /(?<![\p{L}])(?:δημητριακ|βρωμ|νιφαδες|μουσλι|γκρανολα)/u, not: /μπαρα|ροφημα|μπισκοτ/ },
  { tag: "en:cereal-bars", label: "bar", agree: /bar/, name: /(?<![\p{L}])(?:μπαρα δημητριακων|μπαρα βρωμης|μπαρα πρωτεινης)/u, not: /^$/ },
  { tag: "en:salty-snacks", label: "savoury-snack", agree: /snack|chip|crisp|cracker/, name: /(?<![\p{L}])(?:πατατακ|τσιπς|γαριδακ|ποπ κορν|κρακερ)/u, not: /^$/ },
  { tag: "en:legumes", label: "legume-veg", agree: /legume|bean|lentil|chickpea/, name: /(?<![\p{L}])(?:φακες|ρεβιθ|φασολ|φαβα|αρακα)/u, not: /^$/ },
  { tag: "en:meats", label: "meat", agree: /meat|ham|sausage|turkey|chicken/, name: /(?<![\p{L}])(?:γαλοπουλ|ζαμπον|λουκανικ|σαλαμ|μπεικον|κοτοπουλ|αλλαντικ)/u, not: /γευση/ },
  { tag: "en:fishes", label: "fish", agree: /fish|tuna|sardine|salmon/, name: /(?<![\p{L}])(?:τονος|σαρδελ|σολομ|γαυρ|σκουμπρ)/u, not: /^$/ },
  { tag: "en:sweet-spreads", label: "spread", agree: /spread|tahini|jam|praline/, name: /(?<![\p{L}])(?:ταχιν|πραλιν|μαρμελαδ|αμυγδαλοβουτυρ)/u, not: /μπισκοτ|κρουασαν/ }
];
var english = (list2) => (Array.isArray(list2) ? list2 : []).filter((t2) => /^en:[a-z0-9][a-z0-9-]{1,100}$/.test(t2)).map((t2) => t2.slice(3));
var FAMILIES = [
  ["bread", ["bread", "toast", "baguette", "brioche", "bun", "bagel", "wrap", "pita", "rusk", "crispbread", "loave", "loaf", "ciabatta", "focaccia"]],
  ["cheese", ["cheese", "fromage", "feta", "mozzarella", "cheddar", "brie", "camembert", "gouda", "emmental", "parmesan", "halloumi", "ricotta", "mascarpone", "comte", "raclette"]],
  ["yogurt", ["yogurt", "yoghurt", "skyr", "kefir", "quark"]],
  ["chocolate", ["chocolate", "praline", "truffle"]],
  ["biscuit", ["biscuit", "cookie", "wafer", "shortbread", "madeleine", "gingerbread"]],
  ["cake", ["cake", "muffin", "brownie", "pastry", "pastrie", "viennoiserie", "croissant", "doughnut", "donut", "pancake", "crepe", "waffle"]],
  ["savoury-snack", ["cracker", "breadstick", "grissini", "rice-cake", "crisp", "chip", "popcorn", "pretzel", "appetizer", "tortilla-chip"]],
  ["cereal", ["breakfast-cereal", "muesli", "granola", "cornflake", "porridge", "oatmeal", "flake"]],
  ["bar", ["bar"]],
  ["spread", ["spread", "jam", "marmalade", "honey", "preserve", "peanut-butter", "nut-butter", "tahini", "hummus"]],
  ["juice", ["juice", "nectar", "smoothie"]],
  ["soda", ["soda", "cola", "lemonade", "soft-drink", "energy-drink", "iced-tea"]],
  ["water", ["water"]],
  ["plant-drink", ["milk-substitute", "plant-based-milk", "oat-based-drink", "soy-based-drink", "almond-based-drink", "rice-based-drink", "cereal-based-drink", "plant-based-beverage"]],
  ["dessert", ["dessert", "pudding", "mousse", "custard", "flan", "panna-cotta"]],
  ["ice-cream", ["ice-cream", "sorbet", "frozen-dessert", "gelato"]],
  ["pasta", ["pasta", "spaghetti", "noodle", "macaroni", "lasagne", "penne", "fusilli", "tagliatelle", "ravioli", "tortellini", "gnocchi"]],
  ["rice-grain", ["rice", "risotto", "couscous", "quinoa", "bulgur"]],
  ["sauce", ["sauce", "pesto", "ketchup", "mayonnaise", "dressing", "condiment", "mustard", "vinaigrette"]],
  ["pizza", ["pizza", "quiche"]],
  ["meat", ["sausage", "ham", "bacon", "salami", "chorizo", "meat", "poultry", "chicken", "beef", "pork", "knack", "fuet", "frankfurter", "turkey", "charcuterie", "pate", "burger"]],
  ["fish", ["fish", "tuna", "salmon", "sardine", "seafood", "shrimp", "prawn", "surimi", "mackerel", "anchovy", "cod", "herring"]],
  ["soup", ["soup", "broth", "bouillon", "stock"]],
  ["fat", ["oil", "margarine", "butter", "ghee"]],
  ["meal", ["meal", "dish", "sandwich", "ready-meal", "lasagna-dish"]],
  ["dried-fruit", ["dried-fruit", "dried-mixed-fruit", "raisin", "sultana", "prune", "dried-date", "dried-fig", "dried-apricot", "dried-mango", "dried-cranberrie", "dried-banana"]],
  ["nut", ["nut", "seed", "almond", "pistachio", "cashew", "walnut", "hazelnut", "peanut"]],
  ["legume-veg", ["legume", "bean", "lentil", "chickpea", "vegetable", "pea", "tomato", "mushroom"]],
  ["coffee-tea", ["coffee", "tea", "herbal-tea", "infusion"]],
  ["alcohol", ["wine", "beer", "spirit", "cider", "liqueur"]],
  ["sweets", ["candie", "candy", "confectionery", "confectionerie", "gummy", "gummie", "lollipop", "marshmallow", "chewing-gum", "licorice", "liquorice"]],
  ["milk", ["milk"]]
];
var singular = (w) => w.length <= 3 ? w : /(?:ch|sh|x|ss|o)es$/.test(w) ? w.slice(0, -2) : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
function votesOf(slug, { prune = true } = {}) {
  const tokens = slug.split("-").map(singular), joined = tokens.join("-"), out = /* @__PURE__ */ new Set();
  for (const [family, words2] of FAMILIES) for (const w of words2) {
    if (w.includes("-") ? `-${joined}-`.includes(`-${w}-`) : tokens.includes(w)) {
      out.add(family);
      break;
    }
  }
  if (out.has("milk") && tokens.at(-1) !== "milk") out.delete("milk");
  if (tokens.at(-1) === "cereal") return /* @__PURE__ */ new Set(["cereal"]);
  if (out.has("spread")) {
    out.delete("nut");
    out.delete("fat");
  }
  if (prune && [...out].some((f) => !BROAD.has(f))) for (const f of BROAD) out.delete(f);
  return out;
}
var BROAD = /* @__PURE__ */ new Set(["legume-veg", "nut", "milk", "dessert", "meal", "spread"]);
var PNNS = {
  "Bread": "bread",
  "Cheese": "cheese",
  "Breakfast cereals": "cereal",
  "Chocolate products": "chocolate",
  "Fruit juices": "juice",
  "Fruit nectars": "juice",
  "Sweetened beverages": "soda",
  "Artificially sweetened beverages": "soda",
  "Waters and flavored waters": "water",
  "Plant-based milk substitutes": "plant-drink",
  "Dairy desserts": "dessert",
  "Ice cream": "ice-cream",
  "Pizza pies and quiche": "pizza",
  "Processed meat": "meat",
  "Meat": "meat",
  "Fish and seafood": "fish",
  "Dried fruits": "dried-fruit",
  "Dressings and sauces": "sauce",
  "Fats": "fat",
  "Appetizers": "savoury-snack",
  "Salty and fatty products": "savoury-snack",
  "Soups": "soup",
  "Sweets": "sweets",
  "One-dish meals": "meal",
  "Legumes": "legume-veg",
  "Vegetables": "legume-veg",
  "Nuts": "nut",
  "Teas and herbal teas and coffees": "coffee-tea",
  "Alcoholic beverages": "alcohol"
};
function verdictOf(categories, hint = "") {
  const tally = /* @__PURE__ */ new Map();
  for (const slug of english(categories).filter((s) => !GENERIC.has(s) && !SUSPECT.has(s))) for (const f of votesOf(slug)) tally.set(f, (tally.get(f) || 0) + 1);
  const most = Math.max(0, ...tally.values());
  if (!most) return { family: "", tied: [] };
  const top = [...tally].filter(([, n]) => n === most).map(([f]) => f);
  if (top.length === 1) return { family: top[0], tied: [] };
  if (hint && top.includes(hint)) return { family: hint, tied: [] };
  const specific = top.filter((f) => !BROAD.has(f));
  return specific.length === 1 ? { family: specific[0], tied: [] } : { family: "", tied: top };
}
var familyOf = (categories, hint = "") => verdictOf(categories, hint).family;
var NUTTY = /(?:^|-)(?:nuts?|almonds?|pistachios?|cashews?|walnuts?|hazelnuts?|peanuts?|trail-mix)(?:-|$)/;
function familyVerdict(p) {
  const name = fold(`${p?.name || ""}`), type = NAME_TYPES.find((t2) => t2.name.test(name) && !t2.not.test(name));
  const hint = PNNS[p?.pnns] || (type ? familyOf([type.tag]) : "");
  let v = verdictOf(p?.categories, hint);
  const hasTags = english(p?.categories).some((s) => !GENERIC.has(s) && !SUSPECT.has(s));
  if (!v.family && !v.tied.length && !hasTags) {
    const words2 = name.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const byName = /* @__PURE__ */ new Map();
    for (const w of words2) for (const f of votesOf(w)) byName.set(f, (byName.get(f) || 0) + 1);
    const top = [...byName.keys()];
    if (top.length === 1) v = { family: top[0], tied: [] };
    else if (top.length > 1) v = { family: "", tied: top };
  }
  if (!v.family && hint) v = { family: hint, tied: [] };
  if (v.family === "dried-fruit" && english(p?.categories).some((s) => NUTTY.test(s))) v = { family: "nut-mix", tied: [] };
  return v;
}
var productFamily = (p) => familyVerdict(p).family;

