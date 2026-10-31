import { ns23Data, ns23Verify } from './domain/nutriscore2023.mjs';
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
var proteinCounts = (negative, fvlPoints) => negative < 11 || fvlPoints === 5;
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
  return out;
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
  const confidence = p.partial ? "low" : fields >= 6 && anatomy ? "high" : fields >= 3 ? "medium" : "low";
  return { status: p.partial ? "preview" : "reported", grade: p.nutriScore, score: Number.isFinite(p.nutriScoreValue) ? p.nutriScoreValue : null, confidence, caveats, reasons: [], anatomy, method: p.nutriScoreMethod || (anatomy ? "2023" : null), quality };
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
  const note = !counted && !d.water ? /greater_than_or_equal_to_11|negative_points/.test(d.proteinReason) && !d.cheese ? t("Protein is not counted here: the Nutri-Score rules leave it out when a product has 11 or more unfavourable points and little fruit or vegetable.") : t("Protein is not counted for this product under the Nutri-Score rules.") : "";
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


export {parseProduct,assessGrade,estimateNutriScore,dataQuality,explainGrade,setDomainTranslator,validBarcode,parseNutriscore,ns23Verify};
