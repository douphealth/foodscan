// src/lib/i18n.js
var dict = null;
var domainTranslator = null;
function setDomainTranslator(fn) { domainTranslator = typeof fn === "function" ? fn : null; }
var LANGUAGES = Object.freeze([["", "Automatic"], ["en", "English"], ["el", "Ελληνικά"]]);
var fill = (s, vars) => vars ? s.replace(/\{(\w+)\}/g, (m, k) => k in vars ? String(vars[k]) : m) : s;
var missing = /* @__PURE__ */ new Set();
if (typeof globalThis !== "undefined") globalThis.__fsMissing = missing;
function t(text2, vars) {
  if (domainTranslator) return domainTranslator(text2, vars);
  const hit2 = dict?.[text2];
  if (dict && hit2 === void 0 && typeof text2 === "string" && /[a-z]/i.test(text2)) missing.add(text2);
  return fill(hit2 ?? text2, vars);
}
var tn = (n, one, many, vars = {}) => t(n === 1 ? one : many, { n, ...vars });

// src/domain/model.js
var SCHEMA = 10;
var NUTRIENTS = [
  ["kcal", "Energy", "kcal", "energy-kcal"],
  ["protein", "Protein", "g", "proteins"],
  ["carbohydrates", "Carbohydrate", "g", "carbohydrates"],
  ["sugars", "Total sugars", "g", "sugars"],
  ["fat", "Total fat", "g", "fat"],
  ["saturatedFat", "Saturated fat", "g", "saturated-fat"],
  ["fiber", "Fibre", "g", "fiber"],
  ["salt", "Salt", "g", "salt"]
];
var NUTRIENT_KEYS = NUTRIENTS.map((n) => n[0]);
var cleanBarcode = (value) => String(value ?? "").replace(/[\s-]/g, "");
function validBarcode(value) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) || /^0+$/.test(value)) return false;
  let sum = 0;
  for (let i = value.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(value[i]) * weight;
  return (10 - sum % 10) % 10 === Number(value.at(-1));
}
var tidyAmount = (value) => String(value || "").replace(/(\d)[.,]0+(?=\s*[a-zA-Zμ%)]|\s*$)/g, "$1").replace(/(\d[.,]\d*?[1-9])0+(?=\s*[a-zA-Zμ%)]|\s*$)/g, "$1");
var text = (v, limit = 500) => typeof v === "string" ? v.trim().slice(0, limit) : "";
var known = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
var number = (v) => known(v) ? v : null;
function nutrientNumber(value) {
  if (typeof value === "string" && /^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return number(Number(value));
  return number(value);
}
function invalidNutritionValue(value) {
  if (typeof value === "number") return !Number.isFinite(value) || value < 0;
  if (typeof value !== "string") return false;
  const clean = value.trim().replace(/[−－]/g, "-");
  if (/^(?:nan|[+-]?(?:inf|infinity))$/i.test(clean)) return true;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(clean)) return false;
  const numeric = Number(clean);
  return !Number.isFinite(numeric) || numeric < 0;
}
var CHECKED_NUTRIENTS = ["energy-kcal", "energy-kj", "fat", "saturated-fat", "carbohydrates", "sugars", "fiber", "proteins", "salt", "sodium"];
var INGREDIENT_LANGS = ["fr", "el", "de", "it", "es", "pt", "nl"];
function ingredientText(p) {
  const main = String(p?.ingredients_text || p?.ingredients_text_en || "").trim();
  if (main) return main;
  const own = /^[a-z]{2}$/.test(String(p?.lang || "")) ? `ingredients_text_${p.lang}` : null;
  const key = [own, ...INGREDIENT_LANGS.map((l) => `ingredients_text_${l}`)].find((k) => k && typeof p[k] === "string" && p[k].trim().length > 1);
  return key ? p[key].trim() : "";
}
function safeImage(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && (u.hostname === "images.openfoodfacts.org" || u.hostname === "static.openfoodfacts.org") ? u.href : "";
  } catch {
    return "";
  }
}
var tags = (v, limit = 100) => Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x.length < 180).slice(0, limit))] : [];
var tagWord = (x) => x.replace(/^[a-z]{2}:/, "").replace(/-/g, " ");
var words = (v) => [...new Set(tags(v, 50).map(tagWord))];
var unitOf = (value) => {
  const u = String(value || "").toLowerCase();
  return ["g", "kg", "mg"].includes(u) ? "g" : ["ml", "cl", "dl", "l"].includes(u) ? "ml" : null;
};
var unitInText = (value) => unitOf(String(value || "").match(/(?:^|[\s(\d])(kg|mg|g|ml|cl|dl|l)\s*\)?\s*$/i)?.[1]) ?? unitOf(String(value || "").match(/\d\s*(kg|mg|g|ml|cl|dl|l)\b/i)?.[1]);
function resolveBasis(raw, hasPer100) {
  const declared = ["100g", "100ml", "serving"].includes(raw.nutrition_data_per) ? raw.nutrition_data_per : null;
  const evidence = [unitOf(raw.product_quantity_unit), unitInText(raw.quantity), unitOf(raw.serving_quantity_unit), unitInText(raw.serving_size)].filter(Boolean);
  const liquid = evidence.includes("ml") && !evidence.includes("g"), solid = evidence.includes("g") && !evidence.includes("ml");
  const flag = raw.nutriscore?.["2023"]?.data?.is_beverage;
  const beverage = flag === 1 ? true : flag === 0 ? false : beverageByCategory(raw.categories_tags);
  if (declared === "100ml") return { basis: "ml", source: "declared", per: declared };
  if (declared === "100g") return { basis: liquid || beverage && !solid ? "ml" : "g", source: "declared", per: declared };
  if (liquid) return { basis: "ml", source: "units", per: declared };
  if (solid) return { basis: "g", source: "units", per: declared };
  if (beverage) return { basis: "ml", source: "category", per: declared };
  if (hasPer100) return { basis: "g", source: "assumed", per: declared };
  return { basis: null, source: null, per: declared };
}
var DRINK_TAGS = /^en:(?:beverages|non-alcoholic-beverages|drinks|soft-drinks|sodas|waters|water|fruit-juices|juices|milk-drinks|drinking-yogurts|tea-drinks|coffee-drinks|energy-drinks|smoothies|plant-based-beverages|alcoholic-beverages|[a-z0-9-]+-(?:drinks|juices|waters))$/;
var GENERIC_PARENT = /foods?-and-beverages|beverages-and-beverages/;
var beverageByCategory = (list2) => Array.isArray(list2) && list2.some((t2) => DRINK_TAGS.test(t2) && !GENERIC_PARENT.test(t2));
function parseNutriscore(raw) {
  const rawGrade = text(raw.nutriscore_grade || raw.nutrition_grades).toLowerCase();
  const grade = rawGrade.toUpperCase();
  const letter = /^[A-E]$/.test(grade) ? grade : null;
  const score = Number.isFinite(raw.nutriscore_score) ? raw.nutriscore_score : null;
  const current = raw.nutriscore?.["2023"];
  let data = null;
  if (letter && current && String(current.grade || "").toUpperCase() === letter && current.data) {
    const part = (list2) => (Array.isArray(list2) ? list2 : []).map((x) => x && { ...x, max: x.max ?? x.points_max }).filter((x) => x && typeof x.id === "string" && Number.isFinite(x.points) && Number.isFinite(x.max)).map((x) => ({ id: x.id, points: x.points, max: x.max, value: Number.isFinite(x.value) ? x.value : null, unit: text(x.unit, 8) }));
    const d = current.data, negative = part(d.negative ?? d.components?.negative), positive = part(d.positive ?? d.components?.positive);
    const sum = (list2) => list2.reduce((a, x) => a + x.points, 0);
    const finalScore = Number.isFinite(current.score) ? current.score : Number.isFinite(score) ? score : null;
    const closes = negative.length && sum(negative) === d.negative_points && sum(positive) === (d.positive_points ?? 0) && (finalScore === null || finalScore === d.negative_points - (d.positive_points ?? 0));
    if (closes) data = {
      version: "2023",
      negative,
      positive,
      negativePoints: d.negative_points,
      positivePoints: d.positive_points ?? 0,
      countProteins: d.count_proteins === 1,
      proteinReason: text(d.count_proteins_reason, 80),
      beverage: d.is_beverage === 1,
      cheese: d.is_cheese === 1,
      fatOil: d.is_fat_oil_nuts_seeds === 1,
      redMeat: d.is_red_meat_product === 1,
      water: d.is_water === 1
    };
  }
  const currentGrade = String(current?.grade || "").toUpperCase();
  const primary = String(raw.nutriscore_grade || "").toUpperCase(), other = String(raw.nutrition_grades || "").toUpperCase(), isLetter = (g) => /^[A-E]$/.test(g);
  const conflict = isLetter(primary) && isLetter(other) && primary !== other || Boolean(letter && isLetter(currentGrade) && letter !== currentGrade);
  const shown = conflict ? null : letter || (isLetter(currentGrade) ? currentGrade : null);
  const excluded = !shown && !conflict && (rawGrade === "not-applicable" || current?.category_available === 1 && (current?.data?.negative ?? current?.data?.components?.negative)?.length > 0);
  const points = shown && currentGrade === shown && Number.isFinite(current?.score) ? current.score : Number.isFinite(score) ? score : null;
  return { letter: shown, excluded, conflict, method: shown && currentGrade === shown ? "2023" : null, score: conflict ? null : points, data: conflict ? null : data };
}
function per100(n, suffix) {
  const out = Object.fromEntries(NUTRIENTS.map(([key, , , field]) => [key, nutrientNumber(n[`${field}_${suffix}`])]));
  const kj = nutrientNumber(n[`energy-kj_${suffix}`]) ?? nutrientNumber(n[`energy_${suffix}`]);
  let converted = false;
  if (out.kcal === null && kj !== null) {
    out.kcal = kj / 4.184;
    converted = true;
  }
  out.kj = kj;
  out.fvl = nutrientNumber(n[`fruits-vegetables-legumes-estimate-from-ingredients_${suffix}`]) ?? nutrientNumber(n[`fruits-vegetables-legumes_${suffix}`]);
  out.sodium = nutrientNumber(n[`sodium_${suffix}`]);
  const derived = out.sodium === null && out.salt !== null;
  out.sodium = out.sodium !== null ? out.sodium * 1e3 : derived ? out.salt * 400 : null;
  if (out.salt === null && out.sodium !== null && !derived) out.salt = out.sodium / 400;
  return { values: out, converted, sodiumDerived: derived };
}
function parseProduct(payload, requestedCode, now = Date.now()) {
  if (!payload || typeof payload !== "object" || payload.status === 0 || payload.status === "failure" || payload.result?.id === "product_not_found") return null;
  const p = payload.product;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  if (["beauty", "petfood", "product"].includes(p.product_type) || String(p.obsolete) === "1" || p.obsolete === "on") return null;
  const code = cleanBarcode(p.code || requestedCode);
  if (!validBarcode(code) || validBarcode(requestedCode) && code.padStart(14, "0") !== requestedCode.padStart(14, "0")) return null;
  const n = p.nutriments && typeof p.nutriments === "object" ? p.nutriments : {};
  const total = per100(n, "100g"), serving = per100(n, "serving");
  const hasPer100 = NUTRIENT_KEYS.some((k) => total.values[k] !== null);
  const meaningful = ["product_name", "product_name_en", "product_name_el", "brands", "quantity"].some((k) => text(p[k])) || Boolean(ingredientText(p)) || hasPer100;
  if (!meaningful) return null;
  const ns = parseNutriscore(p), basis = resolveBasis(p, hasPer100);
  const lastModified = number(p.last_modified_t);
  const servingMatch = String(p.serving_size || "").match(/(?:^|\s|\()(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
  const rawServing = nutrientNumber(p.serving_quantity), scale = { g: 1, kg: 1e3, mg: 1e-3, ml: 1, cl: 10, dl: 100, l: 1e3 }[String(p.serving_quantity_unit || "").toLowerCase()];
  const named = text(p.product_name || p.product_name_el || p.product_name_en || p.generic_name || p.generic_name_el || p.generic_name_en || p.abbreviated_product_name || p.product_name_de || p.product_name_fr || p.product_name_it || p.product_name_es, 240), group = text(p.pnns_groups_2, 60);
  const category = words(p.categories_tags).filter((x) => !/foods|beverages|plant based|groceries|snacks/i.test(x)).at(-1) || "", brand = text(String(p.brands || "").split(",")[0], 80);
  const title = named || (group && !/^unknown$/i.test(group) ? brand ? `${brand} ${group}` : group : category ? brand ? `${brand} ${category}` : category.replace(/^w/, (c) => c.toUpperCase()) : brand || `Product ${code}`);
  return {
    barcode: code,
    name: title,
    nameMissing: !named,
    // The small front image (200 px) is enough for every card and the report header; it is a link, never stored bytes.
    brand: text(p.brands, 240),
    image: safeImage(p.image_front_small_url) || safeImage(p.image_front_url) || safeImage(p.image_url),
    quantity: tidyAmount(text(p.quantity, 100)),
    serving: tidyAmount(text(p.serving_size, 180)),
    nutrition: total.values,
    servingNutrition: serving.values,
    energyConverted: total.converted,
    servingEnergyConverted: serving.converted,
    nutriScore: ns.letter,
    nutriScoreValue: ns.score,
    nutriScoreData: ns.data,
    nutriScoreMethod: ns.method,
    nutriScoreExcluded: ns.excluded,
    nutriScoreConflict: ns.conflict,
    // 62.0: the bulk export merges nutrients Open Food Facts ESTIMATED from the ingredient list (a fatty-acid panel no label prints) into the
    // same columns as label values. Live read: the record reports no salt, the export does. Such values never produce a calculated grade.
    nutritionEstimated: n["butyric-acid_100g"] !== undefined && n["caproic-acid_100g"] !== undefined,
    nutritionInvalid: CHECKED_NUTRIENTS.some((k) => invalidNutritionValue(n[`${k}_100g`]) || invalidNutritionValue(n[`${k}_serving`])),
    nova: [1, 2, 3, 4].includes(p.nova_group) ? p.nova_group : null,
    ingredients: text(ingredientText(p), 14e3),
    allergens: words(p.allergens_tags),
    traces: words(p.traces_tags),
    sourceUrl: `https://world.openfoodfacts.org/product/${code}`,
    fetchedAt: number(payload.fetchedAt) ?? now,
    sourceModified: lastModified && lastModified < now / 1e3 + 86400 ? lastModified * 1e3 : null,
    schemaVersion: SCHEMA,
    labels: tags(p.labels_tags),
    analysis: tags(p.ingredients_analysis_tags),
    categories: tags(p.categories_tags),
    countries: tags(p.countries_tags),
    additivesCount: nutrientNumber(p.additives_n),
    additives: tags(p.additives_tags, 40).map((t2) => t2.replace(/^[a-z]{2}:/, "")),
    addedSugars: nutrientNumber(n["added-sugars_100g"]),
    qualityWarnings: tags(p.data_quality_errors_tags).filter((t2) => !/^foodscan:/i.test(t2)),
    pnns: text(p.pnns_groups_2, 60),
    basis: basis.basis,
    basisSource: basis.source,
    nutritionPer: basis.per,
    servingAmount: rawServing != null && scale ? rawServing * scale : servingMatch ? Number(servingMatch[1].replace(",", ".")) : null,
    servingUnit: unitOf(p.serving_quantity_unit) || (servingMatch ? servingMatch[2].toLowerCase() : null),
    provenance: "off",
    partial: p.partial === true,
    sodiumDerived: total.sodiumDerived,
    servingSodiumDerived: serving.sodiumDerived
  };
}

// src/domain/estimate.js
var ENERGY_KJ = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350];
var SUGARS = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51];
var SAT_FAT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var SALT = Array.from({ length: 20 }, (_, i) => (i + 1) / 5);
var FIBRE = [3, 4.1, 5.2, 6.3, 7.4];
var PROTEIN = [2.4, 4.8, 7.2, 9.6, 12, 14, 17];
var steps = (list2, v) => list2.reduce((n, s) => n + (v > s ? 1 : 0), 0);
var POINTS = Object.freeze({
  energy: (v) => steps(ENERGY_KJ, v),
  sugars: (v) => steps(SUGARS, v),
  saturatedFat: (v) => steps(SAT_FAT, v),
  salt: (v) => steps(SALT, v),
  fibre: (v) => steps(FIBRE, v),
  protein: (v) => steps(PROTEIN, v),
  fvl: (pct) => pct > 80 ? 5 : pct > 60 ? 2 : pct > 40 ? 1 : 0
});
var gradeOfScore = (s) => s <= 0 ? "A" : s <= 2 ? "B" : s <= 10 ? "C" : s <= 18 ? "D" : "E";
var proteinCounts = (negative, fvlPoints) => negative < 11;
function scoreFrom({ kj, sugars, saturatedFat, salt, fibre = 0, protein = 0, fvl = 0 }) {
  const negative = { energy: POINTS.energy(kj), sugars: POINTS.sugars(sugars), saturatedFat: POINTS.saturatedFat(saturatedFat), salt: POINTS.salt(salt) };
  negative.total = negative.energy + negative.sugars + negative.saturatedFat + negative.salt;
  const f = POINTS.fvl(fvl), counted = proteinCounts(negative.total, f);
  const positive = { fibre: POINTS.fibre(fibre), protein: POINTS.protein(protein), fvl: f, counted };
  positive.total = positive.fibre + positive.fvl + (counted ? positive.protein : 0);
  const score = negative.total - positive.total;
  return { negative, positive, score, grade: gradeOfScore(score) };
}
var SPECIAL_TAG = /^[a-z]{2}:(?:[a-z0-9-]*-)?(?:oils?|fats?|butters?|margarines?|nuts?|seeds?|oilseeds?|cheeses?|waters?|meats?|beef|pork|lamb|veal|hams?|sausages?|bacons?|salamis?|charcuteries?|poultry)$/;
var OUTSIDE_TAG = /^[a-z]{2}:(?:[a-z0-9-]*-)?(?:bouillons?|broths?|stock-cubes?|spices?|herbs?|seasonings?|coffees?|teas?|infusions?|baby-foods?|infant-formulas?|dietary-supplements?|meal-replacements?|salts?|sweeteners?)(?:-[a-z0-9-]+)?$/;
var KIND_WHY = {
  drink: () => t("Drinks follow their own Nutri-Score tables, so FoodScan does not calculate one for a drink."),
  special: () => t("Cheese, fats, oils, nuts, seeds and meat follow special Nutri-Score rules, so FoodScan does not calculate one for them.")
};
var NAME = { energy: () => t("energy"), sugars: () => t("sugars"), saturatedFat: () => t("saturated fat"), salt: () => t("salt"), fibre: () => t("fibre"), protein: () => t("protein"), fvl: () => t("fruit, vegetables and legumes") };
var list = (keys) => keys.map((k) => NAME[k]()).join(", ");
function limits(n, kj) {
  const v = (k) => known(n[k]) ? n[k] : null;
  const fat = v("fat"), carbs = v("carbohydrates"), sugars = v("sugars"), protein = v("protein"), fibre = v("fiber");
  const slack = 15 + 0.03 * kj;
  const parts = { fat: 37 * (fat ?? 0), sugars: 17 * (sugars ?? 0), other: carbs !== null && sugars !== null ? 10 * Math.max(0, carbs - sugars) : 0, protein: 17 * (protein ?? 0) };
  const left = (...skip) => kj + slack - Object.entries(parts).filter(([k]) => !skip.includes(k)).reduce((a, [, e]) => a + e, 0);
  const out = { saturatedFat: Infinity, sugars: Infinity, fibre: Infinity, protein: Infinity };
  if (left() < 0) return out;
  const cap = (value, rate) => Math.min(100, Math.max(0, value) / rate);
  if (fat === null) out.saturatedFat = cap(left("fat"), 37);
  if (fibre === null) out.fibre = cap(left("fibre"), 8);
  if (protein === null) out.protein = cap(left("protein"), 17);
  return out;
}
function estimateNutriScore(p) {
  const fail = (reason, message, extra = {}) => ({ ok: false, reason, message, ...extra });
  const n = p?.nutrition, cats = p?.categories || [];
  if (!n || p.partial) return fail("unusable", t("A full source record is needed to calculate a grade."));
  if (p.nutritionEstimated) return fail("estimated-nutrition", t("These values were estimated from the ingredient list rather than read from the label, so FoodScan does not calculate a grade from them."));
  if (known(n.fvl) && n.fvl > 100) return fail("invalid-composition", t("The source fruit, vegetable and legume percentage is outside 0 to 100. It is not used to calculate a grade."));
  if (p.nutriScoreExcluded || cats.some(c => OUTSIDE_TAG.test(c))) return fail("declined", t("This product is outside the supported calculation scope."));
  if (p.basis === "ml" || beverageByCategory(cats)) return fail("drink", KIND_WHY.drink());
  if (cats.some(c => SPECIAL_TAG.test(c))) return fail("special", KIND_WHY.special());
  if (p.basis !== "g" || !cats.length) return fail("incomplete", t("A confirmed food category and per-100-g basis are needed."));
  if (p.basisSource === "assumed") return fail("incomplete", t("A confirmed per-100-g basis is needed before calculating a grade."));
  const identity = String(p.name || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (cats.some(c => /^en:(?:milks|fermented-milks|kefirs|drinking-yogurts|dairy-drinks|milk-drinks|plant-based-milk-alternatives)$/.test(c)) || /^(?:cow(?:'s)? milk|milk\b|\u03b3\u03b1\u03bb\u03b1(?:\s|$)|\u03b1\u03c1\u03b9\u03b1\u03bd\u03b9|kefir)/.test(identity)) return fail("drink", KIND_WHY.drink());
  const ordinary = /^en:(?:[a-z0-9-]*-)?(?:breads?|biscuits?|cookies?|cakes?|chocolates?|cereals?|bars?|pastas?|pizzas?|yogurts?|yoghurts?|jams?|spreads?|candies|confectionery|desserts?|meals?|vegetables?|fruits?|legumes?|pulses?|tofu|rice|rices|salty-snacks|crisps|chips|popcorn|soups?|sauces?|crackers?|tortillas?)(?:-[a-z0-9-]+)?$/;
  if (!cats.some(c => ordinary.test(c))) return fail("incomplete", t("This food category is not confirmed for the general calculation rules."));
  const kj = known(n.kj) ? n.kj : known(n.kcal) ? n.kcal * 4.184 : null;
  const missing = [...(kj === null ? ["energy"] : []), ...["sugars", "saturatedFat", "salt"].filter(k => !known(n[k]))];
  if (missing.length) return fail("incomplete", t("The source is missing {list}. These values are not assumed or replaced with category averages.", {list:list(missing)}), {missing});
  const fibre = known(n.fiber) ? [POINTS.fibre(n.fiber)] : [0,1,2,3,4,5];
  const protein = known(n.protein) ? [POINTS.protein(n.protein)] : [0,1,2,3,4,5,6,7];
  const fvl = known(n.fvl) ? [POINTS.fvl(n.fvl)] : [0,1,2,5];
  const neg = POINTS.energy(kj) + POINTS.sugars(n.sugars) + POINTS.saturatedFat(n.saturatedFat) + POINTS.salt(n.salt);
  let low=Infinity, high=-Infinity;
  for (const f of fibre) for (const p of protein) for (const v of fvl) {
    const score = neg-f-v-(proteinCounts(neg,v)?p:0); low=Math.min(low,score); high=Math.max(high,score);
  }
  if (gradeOfScore(low)!==gradeOfScore(high)) return fail("incomplete",t("Unreported nutrients could change the grade ({best} to {worst}). No single grade is shown.",{best:gradeOfScore(low),worst:gradeOfScore(high)}),{range:[low,high]});
  const grade=gradeOfScore(low), assumptions=[];
  if (low!==high) assumptions.push(t("Missing favourable nutrients change the points, but not the displayed grade across their full possible range."));
  const exact=low===high, nominal=scoreFrom({kj,sugars:n.sugars,saturatedFat:n.saturatedFat,salt:n.salt,fibre:n.fiber??0,protein:n.protein??0,fvl:n.fvl??0});
  const part=(id,points,max,value,unit)=>({id,points,max,value,unit});
  const data=exact?{version:"2023",beverage:false,cheese:false,fatOil:false,redMeat:false,water:false,estimated:true,
    negative:[part("energy",nominal.negative.energy,10,kj,"kJ"),part("sugars",nominal.negative.sugars,15,n.sugars,"g"),part("saturated_fat",nominal.negative.saturatedFat,10,n.saturatedFat,"g"),part("salt",nominal.negative.salt,20,n.salt,"g")],
    positive:[part("fiber",nominal.positive.fibre,5,n.fiber??null,"g"),part("proteins",nominal.positive.counted?nominal.positive.protein:0,7,n.protein??null,"g"),part("fruits_vegetables_legumes",nominal.positive.fvl,5,n.fvl??null,"%")],
    negativePoints:neg,positivePoints:neg-low,countProteins:nominal.positive.counted,proteinReason:nominal.positive.counted?"negative_points_less_than_11":"negative_points_greater_than_or_equal_to_11"}:null;
  return {ok:true,grade,score:exact?low:null,range:[low,high],data,assumptions};
}

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
const ns23ProteinCounts = (negative, kind, fvlPoints) => ns23Drink(kind) || kind === 'cheese' ? true : kind === 'fat' ? negative < 7 : negative < 11;
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
// categories whose fruit/vegetable/legume share the source fixes at 100 whatever the ingredient estimate says
const NS23_FVL_OVERRIDE = ['en:olive-oils', 'en:rapeseed-oils', 'en:colza-oils', 'en:walnut-oils'];
const NS23_SWEETENER_E = /^e(?:950|951|952|954|955|957|959|960[a-d]?|961|962|969)$/;
const NS23_SWEETENER_WORDS = /acesulfam|aspartam|cyclamat|saccharin|sucralos|thaumatin|neohesperidin|steviol|stevia|neotam|advantam|ασπαρταμ|ακεσουλφαμ|σουκραλοζ|στεβια|γλυκαντικ|sweetener|edulcorant|dolcificant|edulcorante|sussstoff|zoetstof/;

/** Tables that remain possible for the record, how that was settled, and the red-meat state ('certain' | 'maybe' | false).
 * `exempt` is true when the method does not apply (alcohol, baby food, spices, salt...). */
function ns23Kinds(p) {
  const cats = p?.categories || [], n = p?.nutrition || {}, name = ns23Fold(`${p?.name || ''} ${p?.brand || ''}`);
  if (ns23Known(n.alcohol) && n.alcohol > 1.2) return { kinds: [], via: 'composition', exempt: true };
  if (cats.length && (ns23Has(cats, ...NS23_EXEMPT) || cats.some(c => /supplement|\u03c3\u03c5\u03bc\u03c0\u03bb\u03b7\u03c1\u03c9\u03bc/i.test(c)))) return { kinds: [], via: 'category', exempt: true };
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

// src/domain/grade.js
var ORDER = Object.freeze({ A: 0, B: 1, C: 2, D: 3, E: 4 });
var INFO = {
  A: ["Excellent", "Most favourable nutrient profile"],
  B: ["Good", "Favourable nutrient profile"],
  C: ["Fair", "Middling nutrient profile"],
  D: ["Poor", "Less favourable nutrient profile"],
  E: ["Very poor", "Least favourable nutrient profile"]
};
var GRADE_INFO = Object.freeze(Object.fromEntries(Object.entries(INFO).map(([g, [word, line]]) => [g, Object.freeze({ get word() {
  return t(word);
}, get line() {
  return t(line);
} })])));
var isGrade = (g) => typeof g === "string" && Object.hasOwn(ORDER, g);
var SEVERE = /nutrition.*(?:values-are-all-identical|energy-value-in-kcal-does-not-match-value-in-kj|energy-value-in-kj-does-not-match-value-in-kcal|100g-.*greater-than-100)|foodscan:(?:energy-contradiction|identity-unconfirmed)/i;
var SOUPLIKE = /soup|broth|bouillon|stock|sauce|condiment|brine|pickl|seasoning/i;
function implausible(p) {
  const n = p?.nutrition || {}, out = [], unit = p?.basis === "ml" ? "100 ml" : "100 g";
  const g = (v) => `${new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(v)} g`;
  for (const [key, label] of [["fat", "Fat"], ["carbohydrates", "Carbohydrate"], ["protein", "Protein"], ["sugars", "Sugars"], ["salt", "Salt"]])
    if (known(n[key]) && n[key] > 100.5) out.push({ key, text: t("{label} of {amount} per {unit} is impossible", { label: t(label), amount: g(n[key]), unit }) });
  if (known(n.kcal) && n.kcal > 910) out.push({ key: "kcal", text: t("{kcal} kcal per {unit} is more than pure fat contains", { kcal: Math.round(n.kcal), unit }) });
  const macros = (known(n.fat) ? n.fat : 0) + (known(n.carbohydrates) ? n.carbohydrates : 0) + (known(n.protein) ? n.protein : 0);
  if (macros > 105) out.push({ key: "fat", text: t("Fat, carbohydrate and protein add up to {amount} per {unit}", { amount: g(macros), unit }) });
  const drink = p?.nutriScoreData ? p.nutriScoreData.beverage : (p?.categories || []).some((t2) => /^en:(?:beverages|sodas|fruit-juices|juices|waters|soft-drinks)/.test(t2));
  const context = `${(p?.categories || []).join(" ")} ${p?.name || ""}`;
  if (drink && known(n.salt) && n.salt > 2 && !SOUPLIKE.test(context)) out.push({ key: "salt", text: t("{amount} of salt per {unit} is not plausible for a drink; it looks like a data-entry mistake", { amount: g(n.salt), unit }) });
  // 81: salt typed in the wrong unit (1.33 g entered as 1.33 mg) or left at zero in foods that are always salted. One salt point is up to
  // 8 grade points, so a bread label with 1.33 g salt stored as 0.003 g read as A instead of C. Such a record gets no grade.
  const salted = !drink && known(n.salt) && n.salt < 0.05 ? saltedKind(p) : null;
  if (salted) out.push({ key: "salt", text: t("Salt of {amount} per {unit} is not plausible for {kind}, which usually has {range}. The source value looks like a data-entry mistake, so no grade is shown. Check the salt line on the package", { amount: `${new Intl.NumberFormat(void 0, { maximumSignificantDigits: 2 }).format(n.salt)} g`, unit, kind: t(salted[0]), range: salted[1] }) });
  return out;
}
var SALTED_KINDS = [
  [/^en:(?:olives|table-olives|green-olives|black-olives|kalamata-olives)$/, null, ["olives", "2–6 g"]],
  [/^en:(?:hams|cooked-hams|cured-hams|cured-meats|sausages|salamis|bacons?|prepared-meats|cold-cuts|smoked-meats|turkey-breast-cold-cuts|chicken-breast-cold-cuts)$/, /^processed meat$/i, ["cured and processed meat", "1.5–5 g"]],
  [/^en:(?:cheeses|feta-cheeses|feta|hard-cheeses|yellow-cheeses|semi-hard-cheeses|goat-cheeses|sheep-cheeses|cow-cheeses|gouda|edam|emmentaler|graviera|kefalotyri|halloumi|sliced-cheeses|processed-cheese)$/, /^cheese$/i, ["cheese", "0.5–3 g"]],
  [/^en:(?:crisps|potato-crisps|chips|tortilla-chips|corn-chips|salty-snacks|puffed-salty-snacks|crackers|pretzels|breadsticks|popcorn-salted)$/, /^appetizers$|^salty and fatty products$/i, ["crisps, crackers and salty snacks", "0.5–2.5 g"]],
  [/^en:(?:breads|sliced-breads|white-breads|wholemeal-breads|multigrain-breads|special-breads|sandwich-breads|toasts|rusks|pitas|flatbreads|tortillas|pizzas)$/, /^bread$|^pizza pies and quiches$|^sandwiches$/i, ["bread and baked savoury goods", "0.8–1.6 g"]]
];
// products sold without salt, or put in a salted group by a broad tag (seeds and flours sit under "bread" in some records)
var SALT_FREE_TEXT = /(?:^|\s)0\s*%(?:\s|$)|0\s*%\s*αλατι|αναλατ|χωρις\s+(?:προσθηκη\s+|προσθετο\s+)?αλατι|ρικοτα|ανθοτυρ|μυζηθρα|αλευρ|μαγια|γλυκ|κρουασ|τσουρεκ|κεικ|ζυμαρικ|σπαγγ|μακαρον|κριθαρ|χυλοπιτ|linseed|flaxseed|pasta|spaghetti|penne|fusilli|noodle|unsalted|salt[- ]?free|no[- ]added[- ]salt|without[- ]salt|no[- ]salt|0\s*%\s*(?:added\s*)?salt|sodium[- ]free|ανάλατ|χωρίς\s+(?:προσθήκη\s+|προσθετο\s+|πρόσθετο\s+)?αλάτι|χωρις\s+αλατι|ricotta|ρικότα|ρικοτα|mascarpone|μασκαρπ|ανθότυρ|ανθοτυρ|μυζήθρα|μυζηθρα|cottage|κότατζ|flour|αλεύρ|αλευρ|yeast|μαγιά|sweet|γλυκ|croissant|κρουασ|brioche|τσουρέκ|τσουρεκ|cake|κέικ|κεικ|cream cheese|unsalted butter/i;
var SALT_FREE_TAG = /^[a-z]{2}:(?:no-added-salt|no-salt|unsalted|salt-free|low-salt|very-low-salt|low-sodium|very-low-sodium|sodium-free|seeds|flours|yeasts|pastas|dry-pastas|spaghetti|noodles|sweet-breads|viennoiseries|croissants|brioches|cakes|desserts|fresh-cheeses|cream-cheeses|ricotta|mascarpone|cottage-cheeses|unsalted-butters|plant-based-cheeses|cheese-substitutes)$/;
function saltedKind(p) {
  const tags = [...(p?.categories || []), ...(p?.labels || [])];
  const text = `${p?.name || ""} ${p?.brand || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (tags.some((x) => SALT_FREE_TAG.test(x)) || SALT_FREE_TEXT.test(text)) return null;
  const pnns = String(p?.pnns || "").trim();
  for (const [tag, group, kind] of SALTED_KINDS) if ((p?.categories || []).some((x) => tag.test(x)) || group && group.test(pnns)) return kind;
  return null;
}
// Conservative source-conflict flag, not a correction or ingredient-based sugar estimate.
// Only explicit bulk sugar ingredients are considered; sugar-free claims and polyols
// are excluded. Reported trace percentages at or below 0.5% are not contradictions.
function zeroSugarIngredientConflict(p) {
  if (p?.nutrition?.sugars !== 0 || !p?.ingredients) return false;
  let text = p.ingredients.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const start=text.match(/(?:ingredients?|\u03c3\u03c5\u03c3\u03c4\u03b1\u03c4\u03b9\u03ba\u03b1)\s*:/);
  if(start)text=text.slice(start.index+start[0].length);
  text=text.split(/(?:nutrition(?:al)?\s+(?:facts|information|values)|\u03b4\u03b9\u03b1\u03c4\u03c1\u03bf\u03c6\u03b9\u03ba\u03b7\s+\u03b1\u03be\u03b9\u03b1)/)[0];
  const parts=text.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean).slice(0,2);
  const sugars=/^(?:sugar|sucrose|fructose|glucose|dextrose|sucres?|saccharose|\u03b6\u03b1\u03c7\u03b1\u03c1\u03b7|\u03c6\u03c1\u03bf\u03c5\u03ba\u03c4\u03bf\u03b6\u03b7|\u03b3\u03bb\u03c5\u03ba\u03bf\u03b6\u03b7|\u03b4\u03b5\u03be\u03c4\u03c1\u03bf\u03b6\u03b7)(?=$|[\s(\-*])/;
  const jam=(p.categories||[]).some(c=>/^en:(?:[a-z-]+-)?jams$/.test(c));
  return parts.some((part,index)=>{
    if(!sugars.test(part)||/sugar[- ]free|sugar alcohol|no added|without|sans|\u03c7\u03c9\u03c1\u03b9\u03c3/.test(part))return false;
    const percent=part.match(/(\d+(?:\.\d+)?)\s*%/);
    if(percent)return Number(percent[1])>0.5;
    if(index===0)return true;
    return jam&&/\b(?:[1-8]?\d|90)\s*%/.test(parts[0])&&!/^water|^\u03bd\u03b5\u03c1\u03bf/.test(parts[0]);
  });
}
function contradictions(p) {
  const n = p?.nutrition || {}, out = implausible(p).map((x) => x.text);
  if (zeroSugarIngredientConflict(p)) out.push(t("The source reports zero sugars, but its ingredient list names a bulk sugar ingredient. Confirm the nutrition table on the package; this record is held for review."));
  if (known(n.sugars) && known(n.carbohydrates) && n.sugars > n.carbohydrates + 0.5) out.push(t("Sugars exceed carbohydrates"));
  if (known(n.saturatedFat) && known(n.fat) && n.saturatedFat > n.fat + 0.5) out.push(t("Saturated fat exceeds total fat"));
  const lower = 9 * (known(n.fat) ? n.fat : 0) + 4 * (known(n.carbohydrates) ? n.carbohydrates : 0) + 4 * (known(n.protein) ? n.protein : 0);
  if (known(n.kcal) && lower > 0 && n.kcal + Math.max(20, lower * 0.18) < lower) out.push(t("Calories contradict the reported macronutrients"));
  return out;
}
var fieldCount = (p) => NUTRIENT_KEYS.filter((k) => known(p?.nutrition?.[k])).length;
var isUnnamed = (p) => p?.nameMissing === true || !p?.name || p.name === `Product ${p.barcode}`;
function dataQuality(p) {
  if (p?.provenance === "local") {
    const check=dataQuality({...p,provenance:"off"});
    return check.state==="blocked"?check:{state:"local",short:t("Your label entry"),title:t("Entered from your package"),detail:t("These facts were entered on this device and have not been independently checked."),reasons:[]};
  }
  const reasons = [];
  if (p?.nutriScoreConflict) reasons.push(t("Conflicting Nutri-Score grades in the source record"));
  if (p?.nutritionInvalid) reasons.push(t("Invalid negative nutritional values in the source record"));
  const ordinary=p?.nutriScoreMethod==="2023" && p?.basis==="g" && p.categories?.length &&
    !p.categories.some(c=>SPECIAL_TAG.test(c)||OUTSIDE_TAG.test(c)) && !beverageByCategory(p.categories);
  if(ordinary&&isGrade(p.nutriScore)&&Number.isFinite(p.nutriScoreValue)&&gradeOfScore(p.nutriScoreValue)!==p.nutriScore)
    reasons.push(t("The reported grade does not match the reported 2023 points for this food."));
  if (Array.isArray(p?.qualityWarnings) && p.qualityWarnings.some((x) => SEVERE.test(x))) reasons.push(t("The database flags inconsistent nutritional values"));
  reasons.push(...contradictions(p));
  if (reasons.length) return { state: "blocked", short: t("Needs verification"), title: t("This label needs checking"), detail: t("The record contradicts itself, so no dependable conclusion can be drawn from it."), reasons };
  if (isUnnamed(p)) return { state: "limited", unnamed: true, short: t("Name missing"), title: t("The source has no product name"), detail: t("The barcode matched and nothing in the numbers contradicts itself, so they are shown. Check that the photo matches your pack."), reasons: [] };
  if (p.partial) return { state: "limited", short: t("Preview"), title: t("Preview record"), detail: t("This is a short search preview. Open the product for the full record."), reasons: [] };
  if (!["g", "ml"].includes(p.basis) || fieldCount(p) < 2) return { state: "limited", short: t("Partial source"), title: t("Some label facts are missing"), detail: t("The record is incomplete, so only the facts it reports are shown."), reasons: [] };
  return { state: "usable", short: t("Source-reported"), title: t("Source-reported nutrition"), detail: t("Numbers come from a community database and are not laboratory-verified."), reasons: [] };
}
function assessGrade(p, { estimate = true } = {}) {
  const none = (status, why, extra = {}) => ({ status, grade: null, score: null, confidence: null, caveats: [], reasons: [why], anatomy: null, method: null, ...extra });
  if (!p) return none("missing", t("No product"));
  if(p.provenance==="local") {
    const quality=dataQuality(p),said=t("You entered these values yourself. This is not a source-reported grade.");
    if(quality.state==="blocked")return none("withheld",quality.reasons.join(". "),{quality});
    return estimate?calculated(p,quality,said):none("local",said,{quality});
  }
  const quality = dataQuality(p);
  if (quality.state === "blocked") return none("withheld", quality.reasons.join(". ") + ".", { quality });
  if (p.partial) return none("preview", t("Search preview: open the full record before comparing grades."), {quality});
  if (!isGrade(p.nutriScore)) {
    const said = t("The source does not report a Nutri-Score for this product. FoodScan will not guess one.");
    if (!estimate) return none("missing", said, { quality });
    // 62.0: the bulk export blends in nutrients Open Food Facts estimated from ingredients (a live read of 16 such records: 2 had no salt on the label),
    // so a dated catalogue copy never yields a grade FoodScan calculates itself. Open the product to read the current record.
    if (p.catalogueSnapshot) return none("missing", `${said} ${t("This is a dated catalogue copy: refresh it from the live database to see whether the label supports a calculated grade.")}`, { quality });
    return calculated(p, quality, said);
  }
  if (!p.nutriScoreMethod && !p.nutriScoreData && estimate && !quality.unnamed) {
    // 62.0: every Nutri-Score table (drinks, cheese, fats, nuts and seeds as well as ordinary foods) is recomputed from the nutrition we
    // hold and compared with the POINTS the source published. Equal points reproduce the grade; a letter no table can give for those
    // points is a contradiction and is withheld. Differing points leave the grade unversioned and out of every "higher grade" claim.
    const proof = ns23Verify(p);
    if (proof.status === "contradicts") return none("withheld", t("The reported grade cannot follow from the reported 2023 points for this food."), { quality, sourceGrade: p.nutriScore, calculationConflict: true });
    if (proof.status === "reproduced") return reproducedByPoints(p, quality, proof);
    if (proof.status === "consistent" && proof.reason === "points-differ") p = { ...p, pointsDiffer: proof.tried?.[0]?.score };
    const check = estimateNutriScore(p);
    if (check.ok) {
      if (check.grade !== p.nutriScore) return none("withheld", t("The unversioned source grade does not match the supported 2023 calculation. Check the current package before relying on a grade."), {quality, sourceGrade:p.nutriScore, calculationConflict:true});
      // 64.0: a dated catalogue copy whose letter merely AGREES with an estimate (no matching points) is not a verified grade: it stays the source's own, unversioned.
      if (!p.catalogueSnapshot) {
      const result = calculated(p, quality, "");
      return {...result, sourceGrade:p.nutriScore, sourceGradeVersion:null, reproducedSourceGrade:true,
        caveats:[t("The source did not identify its grade version. FoodScan independently reproduced this grade using the 2023 rules; this is not a physical-package verification."), ...result.caveats]};
      }
    }
  }
  const caveats = [];
  if (!p.nutriScoreMethod) caveats.push(t("The source did not identify the grade algorithm version. It is not used to claim a higher grade than another product."));
  if (Number.isFinite(p.pointsDiffer)) caveats.push(p.nutritionEstimated
    ? t("Some values in this record were estimated from the ingredient list, so the nutrition shown works out to {score} points, not the {published} the source published from the label. Check the package.", { score: p.pointsDiffer, published: p.nutriScoreValue })
    : t("The nutrition shown works out to {score} points, not the {published} the source published, so the record may have been edited after it was graded. Check the package.", { score: p.pointsDiffer, published: p.nutriScoreValue }));
  if (snapshotExpired(p)) caveats.push(t("This catalogue snapshot is more than 90 days old, so its grade may not be current. Check the live record or the package."));
  if (quality.unnamed) caveats.push(t("The source has no product name. The grade follows the barcode and the numbers; check that the photo matches your pack."));
  if (p.basisSource === "assumed") caveats.push(t("The record does not say whether values are per 100 g or 100 ml, so per 100 g was assumed for the facts below."));
  const fields = fieldCount(p);
  if (fields < 4) caveats.push(t("Few label values are reported for this product."));
  const anatomy = explainGrade(p);
  if (!anatomy && !p.partial) caveats.push(t("The source did not publish the point-by-point calculation for this record."));
  // 84.0 audit: a grade whose core label values (energy, sugars, saturated fat, salt) are absent from the record cannot be checked against the label;
  // say exactly which are missing and never present it with more than low confidence.
  const coreN = p?.nutrition || {}, coreKnown = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const coreMissing = [!coreKnown(coreN.kj) && !coreKnown(coreN.kcal) && "energy", !coreKnown(coreN.sugars) && "sugars", !coreKnown(coreN.saturatedFat) && "saturated fat", !coreKnown(coreN.salt) && "salt"].filter(Boolean);
  if (coreMissing.length && !p.partial) caveats.unshift(t("Unverified grade: the record is missing {list}, so this grade cannot be checked against the label. Check the package.", { list: coreMissing.map((x) => t(x)).join(", ") }));
  const confidence = p.partial || coreMissing.length ? "low" : fields >= 6 && anatomy ? "high" : fields >= 3 ? "medium" : "low";
  return { status: p.partial ? "preview" : "reported", missingInputs: coreMissing.length ? coreMissing : void 0, unverified: coreMissing.length > 0 || void 0, grade: p.nutriScore, score: Number.isFinite(p.nutriScoreValue) ? p.nutriScoreValue : null, confidence, caveats, reasons: [], anatomy, method: p.nutriScoreMethod || (anatomy ? "2023" : null), quality };
}
const snapshotExpired = p => Number.isFinite(p?.catalogueSnapshot?.exportedAt) && Date.now() - p.catalogueSnapshot.exportedAt > 90 * 864e5;
function reproducedByPoints(p, quality, proof) {
  const data = ns23Data(proof.calc, proof.input, proof.kind);
  const anatomy = explainGrade({ ...p, nutriScore: proof.calc.grade, nutriScoreValue: proof.calc.score, nutriScoreData: data });
  if (anatomy) { anatomy.estimated = false; anatomy.flags = { beverage: proof.kind === "beverage", water: false, fatOil: proof.kind === "fat" }; }
  const comparable = proof.tier !== "partial";
  const caveat = comparable
    ? t("The source did not identify its grade version. FoodScan independently reproduced this grade and its {points} points with the 2023 rules for this kind of food; this is not a physical-package verification.", { points: proof.calc.score })
    : t("The published points ({points}) agree with the nutrition shown, but the record does not report {list}, and the letter could be {letters} depending on it. This is the source's own grade, not used to claim a higher grade than another product.", { points: proof.calc.score, list: proof.missing.map(x => t(x)).join(", "), letters: proof.letters.join(" or ") });
  // Status stays "reported": the grade is the SOURCE's, and FoodScan's own calculation reproduced it point for point. Only grades FoodScan
  // had to calculate itself are "estimated" (and shown as calculated). The method marks it comparable with other 2023 grades.
  return { status: "reported", grade: proof.calc.grade, score: proof.calc.score, confidence: proof.tier === "complete" ? "high" : proof.tier === "robust" ? "medium" : "low", caveats: snapshotExpired(p) ? [caveat, t("This catalogue snapshot is more than 90 days old, so its grade may not be current. Check the live record or the package.")] : [caveat], reasons: [], anatomy, method: comparable ? "2023-calculated" : null, evidenceTier: proof.tier === "complete" ? "complete-input" : proof.tier === "robust" ? "robust-to-missing-inputs" : "partial-input-agreement", missingInputs: proof.missing, quality,
    estimate: { ok: true, grade: proof.calc.grade, score: proof.calc.score, range: [proof.calc.score, proof.calc.score], data, assumptions: [] }, sourceGrade: p.nutriScore, sourceGradeVersion: null, reproducedSourceGrade: true, reproducedByPoints: true, reproducedKind: proof.kind };
}
function calculated(p, quality, said) {
  const e = estimateNutriScore(p);
  if (!e.ok) return { status: "missing", grade: null, score: null, confidence: null, caveats: [], reasons: [e.reason === "unusable" ? said : `${said} ${e.message}`], anatomy: null, method: null, quality, estimate: e };
  const anatomy = explainGrade({ ...p, nutriScore: e.grade, nutriScoreValue: e.score, nutriScoreData: e.data });
  const [low, high] = e.range;
  if (anatomy) {
    anatomy.estimated = true;
    anatomy.range = e.range;
    anatomy.flags = { beverage: false, water: false, fatOil: false };
    if (low !== high) anatomy.summary = t("Points: about {score}, anywhere from {low} to {high}", { score: e.score, low, high });
  }
  return { status: "estimated", grade: e.grade, score: e.score, scoreRange: e.range, confidence: "medium", caveats: e.assumptions, reasons: [], anatomy, method: "2023-calculated", quality, estimate: e };
}
var LABEL = {
  energy: "Energy",
  sugars: "Sugars",
  saturated_fat: "Saturated fat",
  salt: "Salt",
  non_nutritive_sweeteners: "Sweeteners",
  proteins: "Protein",
  fiber: "Fibre",
  fruits_vegetables_legumes: "Fruit, veg & legumes",
  energy_from_saturated_fat: "Energy from saturated fat",
  saturated_fat_ratio: "Saturated share of fat"
};
var labelOf = (id) => LABEL[id] ? t(LABEL[id]) : id.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
function amount(item) {
  if (item.value === null) return "";
  const n = Math.abs(item.value) >= 100 ? Math.round(item.value) : Math.round(item.value * 10) / 10;
  return `${new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(n)} ${item.unit || ""}`.trim();
}
function explainGrade(p) {
  const d = p?.nutriScoreData;
  if (!d || !isGrade(p.nutriScore) || !d.negative.length) return null;
  const row = (x) => ({ id: x.id, label: labelOf(x.id), points: x.points, max: x.max, amount: amount(x), share: x.max ? x.points / x.max : 0 });
  const negative = d.negative.map(row), positive = d.positive.map(row);
  const maxOf = (list2) => list2.reduce((a, x) => a + x.max, 0);
  const score = Number.isFinite(p.nutriScoreValue) ? p.nutriScoreValue : null;
  const counted = d.countProteins;
  const note = !counted && !d.water ? /greater_than_or_equal_to_11|negative_points/.test(d.proteinReason) && !d.cheese ? (/greater_than_or_equal_to_7/.test(d.proteinReason) ? t("Protein is not counted here: for fats, oils, nuts and seeds the Nutri-Score rules leave it out when a product has 7 or more unfavourable points.") : t("Protein is not counted here: the Nutri-Score rules leave it out when a product has 11 or more unfavourable points.")) : t("Protein is not counted for this product under the Nutri-Score rules.") : "";
  const why = [], what = (x) => x.amount ? t("{label} at {amount}", { label: x.label.toLowerCase(), amount: x.amount }) : x.label.toLowerCase();
  const parts = (x, side) => ({ label: x.label, amount: x.amount, points: x.points, max: x.max, side });
  for (const x of [...negative].filter((x2) => x2.points > 0).sort((a, b) => b.share - a.share || b.points - a.points).slice(0, 2))
    why.push({ tone: x.share >= 0.34 ? "down" : "minor", ...parts(x, "against"), text: t(x.points >= x.max ? "Against it: {what}, {points} of {max} points (the maximum)." : "Against it: {what}, {points} of {max} points.", { what: what(x), points: x.points, max: x.max }) });
  for (const x of [...positive].filter((x2) => x2.points > 0).sort((a, b) => b.points - a.points).slice(0, 2))
    why.push({ tone: "up", ...parts(x, "favour"), text: t("In its favour: {what}, {points} of {max} points.", { what: what(x), points: x.points, max: x.max }) });
  if (!why.some((w) => w.tone === "down" || w.tone === "minor")) why.unshift({ tone: "up", text: t("No unfavourable points were recorded for energy, sugars, saturated fat or salt.") });
  if (["A", "B"].includes(p.nutriScore)) why.sort((a, b) => (a.tone === "up" ? 0 : 1) - (b.tone === "up" ? 0 : 1));
  if (note) why.push({ tone: "note", text: note });
  return {
    score,
    grade: p.nutriScore,
    version: d.version,
    beverage: d.beverage,
    negative: { points: d.negativePoints, max: maxOf(negative), items: negative },
    positive: { points: d.positivePoints, max: maxOf(positive), items: positive, counted },
    why,
    note,
    summary: score === null ? "" : tn(d.negativePoints, "Points {score}: {n} point against it", "Points {score}: {n} points against it", { score }) + (d.positivePoints ? t(", minus {n} in its favour", { n: d.positivePoints }) : "")
  };
}


export {parseProduct,assessGrade,estimateNutriScore,dataQuality,explainGrade,setDomainTranslator,validBarcode,parseNutriscore,ns23Verify,ns23Score,ns23GradeOfScore};
