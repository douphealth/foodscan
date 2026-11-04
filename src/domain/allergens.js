// src/domain/allergens.js
var ALLERGENS = Object.freeze([
  { key: "gluten", tag: ["gluten"], label: "Gluten (wheat, rye, barley, oats)" },
  { key: "milk", tag: ["milk"], label: "Milk" },
  { key: "eggs", tag: ["eggs"], label: "Eggs" },
  { key: "nuts", tag: ["nuts", "tree nuts"], label: "Tree nuts" },
  { key: "peanuts", tag: ["peanuts"], label: "Peanuts" },
  { key: "soy", tag: ["soybeans", "soy"], label: "Soy" },
  { key: "fish", tag: ["fish"], label: "Fish" },
  { key: "crustaceans", tag: ["crustaceans"], label: "Crustaceans" },
  { key: "molluscs", tag: ["molluscs"], label: "Molluscs" },
  { key: "sesame", tag: ["sesame seeds", "sesame"], label: "Sesame" },
  { key: "celery", tag: ["celery"], label: "Celery" },
  { key: "mustard", tag: ["mustard"], label: "Mustard" },
  { key: "lupin", tag: ["lupin"], label: "Lupin" },
  { key: "sulphites", tag: ["sulphur dioxide and sulphites", "sulphites"], label: "Sulphites" },
  // Optional ingredient preferences, not allergens: checked the same way, shown apart, and never called a safety issue.
  { key: "seed_oil", tag: ["palm-oil", "palm oil", "sunflower-oil", "soybean-oil", "rapeseed-oil"], label: "Palm & seed oils (palm, sunflower, soy, canola)" },
  { key: "sweeteners", tag: ["aspartame", "sucralose", "acesulfame", "e950", "e951", "e952", "e954", "e955", "e961", "e969"], label: "Artificial sweeteners (aspartame, sucralose, acesulfame K)" },
  { key: "azo_dyes", tag: ["e102", "e104", "e110", "e122", "e124", "e129"], label: "Six artificial colours (E102, E104, E110, E122, E124, E129)" }
]);
var PREFERENCES = /* @__PURE__ */ new Set(["seed_oil", "sweeteners", "azo_dyes"]);
var LABEL2 = Object.fromEntries(ALLERGENS.map((a) => [a.key, a.label]));
var STEMS = {
  gluten: [
    "wheat",
    "durum",
    "semolina",
    "spelt",
    "kamut",
    "rye",
    "barley",
    "oat",
    "malt",
    "bulgur",
    "couscous",
    "farro",
    "ble ",
    "froment",
    "semoule",
    "epeautre",
    "seigle",
    "orge",
    "avoine",
    "farine de ble",
    "boulgour",
    "weizen",
    "dinkel",
    "roggen",
    "gerste",
    "hafer",
    "grieb",
    "hartweizen",
    "trigo",
    "espelta",
    "centeno",
    "cebada",
    "avena",
    "sémola",
    "semola",
    "grano",
    "farro",
    "segale",
    "orzo",
    "avena",
    "frumento",
    "tarwe",
    "spelt",
    "rogge",
    "gerst",
    "haver",
    "griesmeel",
    "σιτ",
    "σιμιγδαλ",
    "σικαλ",
    "κριθ",
    "βρωμ",
    "ζεια",
    "πλιγουρ",
    "κουσκους",
    "αλευρι σιταριου",
    "ντουρουμ"
  ],
  milk: [
    "milk",
    "whey",
    "casein",
    "lactose",
    "cream",
    "butter",
    "cheese",
    "yogurt",
    "yoghurt",
    "skimmed milk",
    "lait",
    "creme",
    "beurre",
    "fromage",
    "lactoserum",
    "petit-lait",
    "milch",
    "molke",
    "sahne",
    "butter",
    "kase",
    "joghurt",
    "laktose",
    "leche",
    "suero de leche",
    "nata",
    "mantequilla",
    "queso",
    "lactosa",
    "latte",
    "siero di latte",
    "panna",
    "burro",
    "formaggio",
    "lattosio",
    "melk",
    "wei",
    "room",
    "boter",
    "kaas",
    "γαλα",
    "γαλακτ",
    "ορος γαλακτος",
    "καζεινη",
    "λακτοζ",
    "κρεμα γαλακτος",
    "τυρι",
    "γιαουρτ"
  ],
  eggs: ["egg", "albumen", "ovalbumin", "oeuf", "oeufs", "ei ", "eier", "eigelb", "huevo", "uovo", "uova", "ovo", "eieren", "αυγ", "αβγ"],
  nuts: [
    "almond",
    "hazelnut",
    "walnut",
    "cashew",
    "pecan",
    "pistachio",
    "macadamia",
    "brazil nut",
    "amande",
    "noisette",
    "noix",
    "pistache",
    "mandel",
    "haselnuss",
    "walnuss",
    "cashewkern",
    "almendra",
    "avellana",
    "nuez",
    "nueces",
    "mandorla",
    "nocciola",
    "noce",
    "amandel",
    "hazelnoot",
    "walnoot",
    "αμυγδαλ",
    "φουντουκ",
    "καρυδ",
    "κασιους",
    "φιστικ αιγινης",
    "πεκαν"
  ],
  peanuts: ["peanut", "groundnut", "arachide", "cacahuete", "cacahuète", "erdnuss", "erdnüsse", "cacahuate", "arachidi", "pindas", "φυστικ", "αραχιδ"],
  soy: ["soy", "soya", "soja", "soia", "sojabohne", "σογι", "σόγι"],
  fish: ["fish", "anchov", "salmon", "tuna", "cod ", "poisson", "saumon", "thon", "anchois", "fisch", "lachs", "thunfisch", "pescado", "atun", "salmon", "pesce", "tonno", "acciuga", "vis ", "zalm", "ψαρι", "ψαρ", "γαυρος", "αντζουγ", "τονος", "σολομ"],
  crustaceans: ["shrimp", "prawn", "crab", "lobster", "crayfish", "crevette", "crabe", "homard", "garnele", "krabbe", "hummer", "gamba", "camaron", "cangrejo", "gambero", "granchio", "garnaal", "γαριδ", "καβουρ", "αστακ"],
  molluscs: ["mussel", "oyster", "squid", "clam", "octopus", "snail", "moule", "huitre", "calmar", "poulpe", "muschel", "auster", "tintenfisch", "mejillon", "ostra", "calamar", "cozza", "vongol", "polpo", "μυδι", "στρειδ", "καλαμαρ", "χταποδ"],
  sesame: ["sesame", "tahini", "tahin", "sesam", "sésame", "sesamo", "σουσαμ", "ταχιν"],
  celery: ["celery", "celeriac", "celeri", "sellerie", "apio", "sedano", "selderij", "σελιν", "σέλιν"],
  mustard: ["mustard", "moutarde", "senf", "mostaza", "senape", "mosterd", "μουστορδ", "μουσταρδ"],
  lupin: ["lupin", "lupine", "lupino", "λουπιν"],
  sulphites: ["sulphite", "sulfite", "sulphur dioxide", "sulfur dioxide", "sulfit", "e220", "e221", "e222", "e223", "e224", "e226", "e227", "e228", "διοξειδιο του θειου", "θειωδ"],
  seed_oil: [
    "palm oil",
    "palm fat",
    "palmolein",
    "palm kernel",
    "sunflower oil",
    "rapeseed oil",
    "canola oil",
    "soybean oil",
    "soya oil",
    "cottonseed oil",
    "corn oil",
    "huile de palme",
    "huile de tournesol",
    "huile de colza",
    "huile de soja",
    "palmol",
    "palmfett",
    "sonnenblumenol",
    "rapsol",
    "sojaol",
    "aceite de palma",
    "aceite de girasol",
    "aceite de soja",
    "olio di palma",
    "olio di girasole",
    "olio di colza",
    "olio di soia",
    "palmolie",
    "zonnebloemolie",
    "raapzaadolie",
    "sojaolie",
    "φοινικελαιο",
    "ηλιελαιο",
    "σογιελαιο",
    "κραμβελαιο",
    "αραβοσιτελαιο",
    "βαμβακελαιο"
  ],
  sweeteners: [
    "aspartame",
    "sucralose",
    "acesulfame",
    "saccharin",
    "cyclamate",
    "neotame",
    "advantame",
    "e950",
    "e951",
    "e952",
    "e954",
    "e955",
    "e961",
    "e969",
    "ασπαρταμ",
    "σουκραλοζ",
    "ακεσουλφαμ",
    "σακχαριν",
    "κυκλαμικ"
  ],
  azo_dyes: [
    "tartrazine",
    "quinoline yellow",
    "sunset yellow",
    "carmoisine",
    "azorubine",
    "ponceau 4r",
    "allura red",
    "jaune orange s",
    "rouge allura",
    "gelborange s",
    "allurarot",
    "amarillo ocaso",
    "rojo allura",
    "e102",
    "e104",
    "e110",
    "e122",
    "e124",
    "e129",
    "ταρτραζιν",
    "κινολιν",
    "ερυθρο allura"
  ]
};
var WHOLE_WORD = /* @__PURE__ */ new Set(["ei ", "cod ", "vis ", "ble ", "wei", "room", "nata", "butter", "cream", "malt", "thon", "noix", "cheese", "soy", "soja", "egg", "rye", "kase", "boter", "kaas", "crab", "tahin", "γαλα"]);
var BENIGN = /buchweizen\p{L}*|grano\s+saraceno|bl[eé]\s+noir|sarrasin|φαγ[οό]πυρ\p{L}*|\b(coconut|almond|oat|soy|soya|rice|cashew|hazelnut|pea|plant|nut|peanut|sesame|cocoa|cacao|shea|apple|fruit|garlic|herb|sunflower|palm)\s+(?:milk|drink|cream|butter)\b|\b(?:lait|beurre|creme)\s+(?:de\s+)?(coco|cacao|karite|amande)\b|\bbeurre\s+de\s+cacao\b|\bkakaobutter\b|\bcrab\s+apples?\b|\bwater\s+chestnuts?\b|\bnutmeg\b|\bmuskatnuss\b|\bnoix\s+de\s+(?:muscade|coco)\b|\bcoconut\b|μπουτυρο\s+κακαο|βουτυρο\s+κακαο/giu;
var KEEP = /* @__PURE__ */ new Set(["peanut", "almond", "hazelnut", "cashew", "soy", "soya", "sesame", "oat", "amande"]);
var stripBenign = (text2) => String(text2 ?? "").replace(BENIGN, (m, a, b) => {
  const w = (a || b || "").toLowerCase();
  return KEEP.has(w) ? ` ${w} ` : " ";
});
var fold = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ς/g, "σ").replace(/\be[\s-]*(\d{3,4})\b/g, "e$1").replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/ß/g, "ss").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
var PREPARED = Object.fromEntries(Object.entries(STEMS).map(([key, list2]) => [key, [...new Set(list2.map(fold).filter(Boolean))]]));
var INFIX = new Set(["milch", "weizen", "roggen", "gerste", "hafer", "dinkel", "sahne", "kase", "joghurt", "senf", "sellerie", "haselnuss", "walnuss", "erdnuss"].map(fold));
var matcher = (stem, whole) => {
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const trimmed = escaped.trim();
  return new RegExp(`${INFIX.has(trimmed) ? "" : "(?<![\\p{L}\\p{N}])"}${trimmed}${whole || stem.endsWith(" ") ? "(?![\\p{L}\\p{N}])" : ""}`, "u");
};
var ENTRIES = Object.entries(PREPARED).map(([key, list2]) => [key, list2.map((stem) => ({ needle: stem.trim(), stem, whole: /^e\d/.test(stem) || WHOLE_WORD.has(stem) || WHOLE_WORD.has(stem + " "), re: null }))]);
var hit = (entry, folded) => folded.includes(entry.needle) && (entry.re ??= matcher(entry.stem, entry.whole)).test(folded);
function allergensInText(text2) {
  const grouped = String(text2 || "").replace(/(?:vegetable oils?|oils?|huiles?|oli|aceites?|olien)\s*\(([^)]{0,180})\)/gi, (_, list2) => list2.replace(/sunflower|rapeseed|canola|soybean|soya|corn|palm/gi, (name) => `${name} oil`));
  const folded = fold(stripBenign(grouped));
  if (!folded) return [];
  const found = [];
  for (const [key, list2] of ENTRIES) if (list2.some((entry) => hit(entry, folded))) found.push(key);
  return found;
}
function keysFromTags(list2) {
  const set = new Set((list2 || []).map((x) => fold(String(x).replace(/^[a-z]{2}:/, ""))));
  return ALLERGENS.filter((a) => a.tag.some((t2) => set.has(fold(t2)))).map((a) => a.key);
}
function reconcileAllergens(p) {
  const allergen = (k) => !PREFERENCES.has(k);
  const declared = keysFromTags(p?.allergens).filter(allergen), traces = keysFromTags(p?.traces).filter(allergen);
  const mentioned = allergensInText(p?.ingredients).filter(allergen);
  const gaps = mentioned.filter((k) => !declared.includes(k));
  return {
    declared,
    traces: traces.filter((k) => !declared.includes(k)),
    mentioned,
    gaps,
    label: (k) => t(LABEL2[k] || k),
    // No readable ingredient list: this is "unknown", and must never be read as "allergen-free". A declared allergen list
    // alone does not settle it either, because it is the list the community most often leaves incomplete.
    unknown: !String(p?.ingredients || "").trim(),
    confirmed: declared.length > 0
  };
}
function allergenChange(a, b) {
  const ra = reconcileAllergens(a), rb = reconcileAllergens(b);
  const inA = /* @__PURE__ */ new Set([...ra.declared, ...ra.mentioned, ...ra.traces]);
  const added = [.../* @__PURE__ */ new Set([...rb.declared, ...rb.mentioned])].filter((k) => !inA.has(k));
  return { added, unknown: rb.unknown, label: rb.label, baselineUnknown: ra.unknown };
}

