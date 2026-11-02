/* FoodScan 67.0.0 Prices service routing and server-side proxy release. Generated from source/build.mjs. */

/* BEGIN worker-base.js */
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

// src/data/countries.js
var COUNTRY_BY_REGION = Object.freeze({
  AD: "andorra",
  AE: "united-arab-emirates",
  AF: "afghanistan",
  AG: "antigua-and-barbuda",
  AI: "anguilla",
  AL: "albania",
  AM: "armenia",
  AO: "angola",
  AQ: "antarctic",
  AR: "argentina",
  AS: "american-samoa",
  AT: "austria",
  AU: "australia",
  AW: "aruba",
  AX: "aland-islands",
  AZ: "azerbaijan",
  BA: "bosnia-and-herzegovina",
  BB: "barbados",
  BD: "bangladesh",
  BE: "belgium",
  BF: "burkina-faso",
  BG: "bulgaria",
  BH: "bahrain",
  BI: "burundi",
  BJ: "benin",
  BL: "saint-barthelemy",
  BM: "bermuda",
  BN: "brunei",
  BO: "bolivia",
  BQ: "caribbean-netherlands",
  BR: "brazil",
  BS: "the-bahamas",
  BT: "bhutan",
  BV: "bouvet-island",
  BW: "botswana",
  BY: "belarus",
  BZ: "belize",
  CA: "canada",
  CC: "cocos-keeling-islands",
  CD: "democratic-republic-of-the-congo",
  CF: "central-african-republic",
  CG: "republic-of-the-congo",
  CH: "switzerland",
  CI: "cote-d-ivoire",
  CK: "cook-islands",
  CL: "chile",
  CM: "cameroon",
  CN: "china",
  CO: "colombia",
  CR: "costa-rica",
  CU: "cuba",
  CV: "cape-verde",
  CW: "curacao",
  CX: "christmas-island",
  CY: "cyprus",
  CZ: "czech-republic",
  DE: "germany",
  DJ: "djibouti",
  DK: "denmark",
  DM: "dominica",
  DO: "dominican-republic",
  DZ: "algeria",
  EC: "ecuador",
  EE: "estonia",
  EG: "egypt",
  EH: "western-sahara",
  ER: "eritrea",
  ES: "spain",
  ET: "ethiopia",
  FI: "finland",
  FJ: "fiji",
  FK: "falkland-islands",
  FM: "federated-states-of-micronesia",
  FO: "faroe-islands",
  FR: "france",
  GA: "gabon",
  GD: "grenada",
  GE: "georgia",
  GF: "french-guiana",
  GG: "guernsey",
  GH: "ghana",
  GI: "gibraltar",
  GL: "greenland",
  GM: "gambia",
  GN: "guinea",
  GP: "guadeloupe",
  GQ: "equatorial-guinea",
  GR: "greece",
  GT: "guatemala",
  GU: "guam",
  GW: "guinea-bissau",
  GY: "guyana",
  HK: "hong-kong",
  HM: "heard-island-and-mcdonald-islands",
  HN: "honduras",
  HR: "croatia",
  HT: "haiti",
  HU: "hungary",
  ID: "indonesia",
  IE: "ireland",
  IL: "israel",
  IM: "isle-of-man",
  IN: "india",
  IO: "british-indian-ocean-territory",
  IQ: "iraq",
  IR: "iran",
  IS: "iceland",
  IT: "italy",
  JE: "jersey",
  JM: "jamaica",
  JO: "jordan",
  JP: "japan",
  KE: "kenya",
  KG: "kyrgyzstan",
  KH: "cambodia",
  KI: "kiribati",
  KM: "comoros",
  KN: "saint-kitts-and-nevis",
  KP: "north-korea",
  KR: "south-korea",
  KW: "kuwait",
  KY: "cayman-islands",
  KZ: "kazakhstan",
  LA: "laos",
  LB: "lebanon",
  LC: "saint-lucia",
  LI: "liechtenstein",
  LK: "sri-lanka",
  LR: "liberia",
  LS: "lesotho",
  LT: "lithuania",
  LU: "luxembourg",
  LV: "latvia",
  LY: "libya",
  MA: "morocco",
  MC: "monaco",
  MD: "moldova",
  ME: "montenegro",
  MF: "saint-martin",
  MG: "madagascar",
  MH: "marshall-islands",
  MK: "north-macedonia",
  ML: "mali",
  MM: "myanmar",
  MN: "mongolia",
  MO: "macau",
  MP: "northern-mariana-islands",
  MQ: "martinique",
  MR: "mauritania",
  MS: "montserrat",
  MT: "malta",
  MU: "mauritius",
  MV: "maldives",
  MW: "malawi",
  MX: "mexico",
  MY: "malaysia",
  MZ: "mozambique",
  NA: "namibia",
  NC: "new-caledonia",
  NE: "niger",
  NF: "norfolk-island",
  NG: "nigeria",
  NI: "nicaragua",
  NL: "netherlands",
  NO: "norway",
  NP: "nepal",
  NR: "nauru",
  NU: "niue",
  NZ: "new-zealand",
  OM: "oman",
  PA: "panama",
  PE: "peru",
  PF: "french-polynesia",
  PG: "papua-new-guinea",
  PH: "philippines",
  PK: "pakistan",
  PL: "poland",
  PM: "saint-pierre-and-miquelon",
  PN: "pitcairn",
  PR: "puerto-rico",
  PS: "state-of-palestine",
  PT: "portugal",
  PW: "palau",
  PY: "paraguay",
  QA: "qatar",
  RE: "reunion",
  RO: "romania",
  RS: "serbia",
  RU: "russia",
  RW: "rwanda",
  SA: "saudi-arabia",
  SB: "solomon-islands",
  SC: "seychelles",
  SD: "sudan",
  SE: "sweden",
  SG: "singapore",
  SH: "saint-helena",
  SI: "slovenia",
  SJ: "svalbard-and-jan-mayen",
  SK: "slovakia",
  SL: "sierra-leone",
  SM: "san-marino",
  SN: "senegal",
  SO: "somalia",
  SR: "suriname",
  SS: "south-sudan",
  ST: "sao-tome-and-principe",
  SV: "el-salvador",
  SX: "sint-maarten",
  SY: "syria",
  SZ: "swaziland",
  TC: "turks-and-caicos-islands",
  TD: "chad",
  TF: "french-southern-and-antarctic-lands",
  TG: "togo",
  TH: "thailand",
  TJ: "tajikistan",
  TK: "tokelau",
  TL: "timor-leste",
  TM: "turkmenistan",
  TN: "tunisia",
  TO: "tonga",
  TR: "turkey",
  TT: "trinidad-and-tobago",
  TV: "tuvalu",
  TW: "taiwan",
  TZ: "tanzania",
  UA: "ukraine",
  UG: "uganda",
  GB: "united-kingdom",
  UM: "united-states-minor-outlying-islands",
  US: "united-states",
  UY: "uruguay",
  UZ: "uzbekistan",
  VA: "vatican-city",
  VC: "saint-vincent-and-the-grenadines",
  VE: "venezuela",
  VG: "british-virgin-islands",
  VI: "virgin-islands-of-the-united-states",
  VN: "vietnam",
  VU: "vanuatu",
  WF: "wallis-and-futuna",
  WS: "samoa",
  XK: "kosovo",
  YE: "yemen",
  YT: "mayotte",
  YU: "yugoslavia",
  ZA: "south-africa",
  ZM: "zambia",
  ZW: "zimbabwe"
});

// src/domain/profile.js
var DEFAULT_PROFILE = Object.freeze({ avoids: [], diet: "none", country: "" });
var DIETS = Object.freeze({ none: "No preference", vegetarian: "Vegetarian", vegan: "Vegan" });
var AVOID_CHOICES = Object.freeze(ALLERGENS.map((a) => Object.freeze({ key: a.key, get label() {
  return t(a.label.replace(/ \(.*\)/, ""));
} })));
var REGION_BY_COUNTRY = Object.freeze(Object.fromEntries(Object.entries(COUNTRY_BY_REGION).map(([region, slug]) => [slug, region])));

// src/domain/facts.js
var LIMITS = Object.freeze({
  g: { sugars: [5, 22.5], saturatedFat: [1.5, 5], salt: [0.3, 1.5], fat: [3, 17.5] },
  ml: { sugars: [2.5, 11.25], saturatedFat: [0.75, 2.5], salt: [0.3, 0.75], fat: [1.5, 8.75] }
});

// src/domain/alternatives.js
var YEAR = 365.25 * 864e5;
var DELTAS = [
  { key: "sugars", label: "sugars", want: "lower", min: 2, rel: 0.25 },
  { key: "saturatedFat", label: "saturated fat", want: "lower", min: 1, rel: 0.25 },
  { key: "salt", label: "salt", want: "lower", min: 0.2, rel: 0.25 },
  { key: "fiber", label: "fibre", want: "higher", min: 1.5, rel: 0.25 },
  { key: "protein", label: "protein", want: "higher", min: 2, rel: 0.25 }
];
var fmt = (v) => new Intl.NumberFormat(void 0, { maximumFractionDigits: v < 20 ? 1 : 0 }).format(v);
function differences(current, cand) {
  if (!current || !cand || current.basis !== cand.basis || !["g", "ml"].includes(cand.basis)) return [];
  const unit = cand.basis === "ml" ? "100 ml" : "100 g", out = [];
  for (const d of DELTAS) {
    const a = current.nutrition?.[d.key], b = cand.nutrition?.[d.key];
    if (!known(a) || !known(b)) continue;
    const diff = b - a, size = Math.abs(diff);
    if (size < d.min || size < Math.max(a, b) * d.rel) continue;
    const good = d.want === "lower" ? diff < 0 : diff > 0;
    out.push({ key: d.key, good, size: size / Math.max(d.min, 1e-9), text: `${diff < 0 ? "−" : "+"}${fmt(size)} g ${t(d.label)}`, detail: t("{b} g vs {a} g per {unit}", { b: fmt(b), a: fmt(a), unit }) });
  }
  return out.sort((x, y) => Number(y.good) - Number(x.good) || y.size - x.size);
}

// src/domain/versus.js
function versus(a, b) {
  const col = (p) => {
    const g = assessGrade(p), q = dataQuality(p);
    return { product: p, grade: g.grade, status: g.status, estimated: g.status === "estimated", quality: q.state, qualityLabel: q.short, family: productFamily(p), allergens: reconcileAllergens(p) };
  };
  const left = col(a), right = col(b);
  const sameUnit = Boolean(a?.basis) && a.basis === b?.basis && ["g", "ml"].includes(a.basis);
  const diffs = sameUnit ? differences(a, b) : [];
  const nova = known(a?.nova) && known(b?.nova) && a.nova !== b.nova ? b.nova < a.nova ? "b" : "a" : "";
  const grade = isGrade(left.grade) && isGrade(right.grade) ? ORDER[left.grade] === ORDER[right.grade] ? "same" : ORDER[right.grade] < ORDER[left.grade] ? "b" : "a" : "unknown";
  const side = (mine) => diffs.filter((d) => mine === "b" === d.good).map((d) => {
    const own = (mine === "a" ? a : b).nutrition[d.key], other = (mine === "a" ? b : a).nutrition[d.key];
    return { key: d.key, mine: own, other, unit: a.basis === "ml" ? "100 ml" : "100 g" };
  });
  return {
    left,
    right,
    sameUnit,
    sameKind: !left.family || !right.family || left.family === right.family,
    grade,
    gradeGap: grade === "a" || grade === "b" ? Math.abs(ORDER[left.grade] - ORDER[right.grade]) : 0,
    // Each side's measured advantages, with both values: A's list holds what A does better, B's what B does better.
    better: { a: side("a"), b: side("b") },
    nova,
    allergens: { inBNotA: allergenChange(a, b), inANotB: allergenChange(b, a) }
  };
}
function versusLine(v, t2) {
  const name = (c) => c.product.name;
  if (v.grade === "same") return t2("{a} and {b} have the same grade ({grade}).", { a: name(v.left), b: name(v.right), grade: v.left.grade });
  if (v.grade === "unknown") return t2("{a} vs {b}: only one of them has a grade to compare.", { a: name(v.left), b: name(v.right) });
  const [hi, lo] = v.grade === "a" ? [v.left, v.right] : [v.right, v.left];
  return t2("{hi} has the higher grade: {hiGrade} vs {loGrade} for {lo}.", { hi: name(hi), hiGrade: hi.grade, lo: name(lo), loGrade: lo.grade });
}

// src/domain/seo.js
var MIN_FIELDS = 6;
var MIN_INGREDIENTS = 20;
function indexWorthy(p, a = p ? assessGrade(p, { estimate: false }) : null) {
  const reasons = [];
  if (!p) return { index: false, reasons: ["missing"] };
  if (p.nameMissing) reasons.push("no-name");
  if (a?.status !== "reported") reasons.push(`grade-${a?.status || "missing"}`);
  if (p.partial) reasons.push("preview");
  if (String(p.ingredients || "").trim().length < MIN_INGREDIENTS) reasons.push("no-ingredients");
  if (fieldCount(p) < MIN_FIELDS) reasons.push("few-values");
  if (!["g", "ml"].includes(p.basis) || p.basisSource === "assumed") reasons.push("unit-unclear");
  return { index: reasons.length === 0, reasons };
}
var gtinKey = (code) => ({ 8: "gtin8", 12: "gtin12", 13: "gtin13", 14: "gtin14" })[String(code).length] || "gtin";
function canonicalCode(code) {
  const c = String(code || "");
  if (/^\d{12}$/.test(c)) return `0${c}`;
  if (/^0\d{13}$/.test(c)) return c.slice(1);
  return "";
}
function excerpt(text2, limit = 2e3) {
  const s = String(text2 || "").replace(/\s+/g, " ").trim();
  if (s.length <= limit) return { text: s, cut: false };
  const at = s.lastIndexOf(" ", limit - 1);
  return { text: `${s.slice(0, at > limit * 0.6 ? at : limit).replace(/[,;:\s]+$/, "")}…`, cut: true };
}

// src/data/indexable.js
var INDEXABLE = [
  {
    "code": "20006105",
    "name": "Roggenvollkornbrot",
    "brand": "Gräfschafer",
    "grade": "B",
    "family": "bread",
    "modified": "2026-09-14"
  },
  {
    "code": "3161711001971",
    "name": "Fromage de France",
    "brand": "BG SAS",
    "grade": "D",
    "family": "cheese",
    "modified": "2026-10-05"
  },
  {
    "code": "7622300441937",
    "name": "Philadelphia Original",
    "brand": "Mondelez Schweiz GmbH",
    "grade": "D",
    "family": "cheese",
    "modified": "2026-10-07"
  },
  {
    "code": "5000157024671",
    "name": "Beanz in a rich tomato sauce",
    "brand": "H J Heinz Foods UK Ltd",
    "grade": "A",
    "family": "legume-veg",
    "modified": "2026-10-16"
  },
  {
    "code": "5201193100019",
    "name": "Spaghetti n6",
    "brand": "Melissa",
    "grade": "A",
    "family": "pasta",
    "modified": "2026-08-28"
  },
  {
    "code": "8076800195057",
    "name": "Spaghetti Nº5",
    "brand": "Barilla",
    "grade": "A",
    "family": "pasta",
    "modified": "2026-10-13"
  },
  {
    "code": "7394376616228",
    "name": "The original oat-ly barista edition oat drink",
    "brand": "Oatly",
    "grade": "D",
    "family": "plant-drink",
    "modified": "2026-10-11"
  },
  {
    "code": "5449000000996",
    "name": "Coca-Cola Original",
    "brand": "COCA-COLA SERVICES SA/NV",
    "grade": "E",
    "family": "soda",
    "modified": "2026-10-15"
  },
  {
    "code": "5449000131805",
    "name": "Coca-Cola Zero Sugar",
    "brand": "Coca Cola",
    "grade": "C",
    "family": "soda",
    "modified": "2026-10-14"
  },
  {
    "code": "5449000011527",
    "name": "fanta Orange 0,33",
    "brand": "COCA-COLA SERVICES SA/NV",
    "grade": "C",
    "family": "soda",
    "modified": "2026-09-28"
  },
  {
    "code": "3017624010701",
    "name": "Nutella",
    "brand": "Ferrero",
    "grade": "E",
    "family": "spread",
    "modified": "2026-10-02"
  },
  {
    "code": "3068320114453",
    "name": "Badoit 1 L PET",
    "brand": "BADOIT",
    "grade": "A",
    "family": "water",
    "modified": "2026-08-13"
  },
  {
    "code": "5201054017432",
    "name": "Total 5% Fat Greek Yogurt",
    "brand": "FAGE",
    "grade": "B",
    "family": "yogurt",
    "modified": "2026-06-26"
  }
];

// worker/_worker.js
/* FoodScan 79.0.0: ONE release number for the HTML, /api/health, /api/prices/health, the price files, the service worker and the release notes. */
var VERSION = "81.0.0";
var BUILD = "8100-honest-prices";
var CACHE_SCHEMA = "p23-greece-catalogue";
var SITE = "https://food-scan.gearuptofit.com".startsWith("__") ? "" : "https://food-scan.gearuptofit.com";
var VIRAL_EVENTS = /* @__PURE__ */ new Set(["product_share_started", "product_share_handoff", "product_link_copied", "shared_product_opened", "shared_scan_cta_clicked", "shared_scan_completed", "shared_product_reshared", "public_shared_open", "public_shared_scan_cta", "public_shared_report_open", "public_challenge_open", "public_challenge_referral_scan_cta"]);
var EVENT_NAMES = /* @__PURE__ */ new Set(["visit", "scan", "lookup", "alternative", "search", "action", "vitals", "public_product_view", "public_product_share", "public_scorecard_download", "public_scan_cta", "public_battle_view", "public_battle_share", "public_battle_vote", "public_challenge_share", "public_challenge_scan_cta", "public_challenge_saved", ...VIRAL_EVENTS]);
var EVENT_COLUMNS = ["source", "route", "lang", "returning", "method", "outcome", "cache", "via", "kind", "standalone", "referral", "parent"];
var LABEL3 = /^[a-z][a-z0-9_-]{0,23}$/;
var SHARE_TOKEN = /^f[a-z0-9]{11}$/;
var EVENT_ID = /^f[a-z0-9]{15}$/;
var eventBudget = /* @__PURE__ */ new Map();
var seenEvents = /* @__PURE__ */ new Map();
var ORIGIN = "https://world.openfoodfacts.org";
var INDEX_ORIGIN = "https://search.openfoodfacts.org/search";
var FIELDS = "code,product_name,product_name_en,product_name_el,product_name_de,product_name_fr,product_name_it,product_name_es,generic_name,generic_name_en,generic_name_el,abbreviated_product_name,brands,image_front_small_url,image_front_url,image_url,quantity,product_quantity,product_quantity_unit,serving_size,serving_quantity,serving_quantity_unit,nutriments,nutrition_data_per,nutrition_data_prepared_per,nutriscore_grade,nutriscore_score,nutriscore,nutrition_grades,nova_group,ingredients_text,ingredients_text_en,ingredients_text_fr,ingredients_text_el,ingredients_text_de,ingredients_text_it,ingredients_text_es,ingredients_text_pt,ingredients_text_nl,lang,allergens_tags,traces_tags,last_modified_t,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,additives_n,additives_tags,pnns_groups_1,pnns_groups_2,data_quality_errors_tags,product_type,obsolete";
var INDEX_FIELDS = "nutriscore,nutrition_grades,nutrition_data_per,product_quantity_unit,serving_quantity_unit,ingredients_text_el,lang,data_quality_errors_tags,product_type,obsolete,code,product_name,product_name_en,product_name_el,generic_name,brands,image_front_small_url,image_front_url,quantity,nutriments,nutriscore_grade,nutriscore_score,nova_group,ingredients_text,ingredients_text_en,additives_n,additives_tags,allergens_tags,traces_tags,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,last_modified_t,unique_scans_n";
var SEARCH_LANGS = "en,fr,de,es,it,el,pt,nl";
var MAX_BODY = 6e5;
var DEADLINE_MS = 8500;
var STALE_SECONDS = 30 * 86400;
var FRESH = { product: 43200, category: 7200, search: 3600 };
var inflight = /* @__PURE__ */ new Map();
var cooldown = { off: 0, index: 0 };
var providerCooldown = 0;
function validBarcode2(code) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) || /^0+$/.test(code)) return false;
  let sum = 0;
  for (let i = code.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(code[i]) * w;
  return (10 - sum % 10) % 10 === Number(code.at(-1));
}
var equivalent = (a, b) => validBarcode2(a) && validBarcode2(b) && a.padStart(14, "0") === b.padStart(14, "0");
var json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-FoodScan-Version": VERSION,
  ...headers
} });
var error = (code, message, status, details = {}, headers = {}) => json({ error: { code, message, ...details }, version: VERSION }, status, headers);
function withCache(response, state, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  headers.set("X-FoodScan-Cache", state);
  headers.set("X-FoodScan-Version", VERSION);
  headers.set("Cache-Control", response.status === 200 && state !== "STALE" ? "public, max-age=60, must-revalidate" : "no-store");
  if (state === "STALE") headers.set("X-FoodScan-Data-Age", "stale");
  headers.delete("Age");
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value) headers.set(key, value);
    else headers.delete(key);
  }
  return new Response(response.body, { status: response.status, headers });
}
function retrySeconds(value) {
  const seconds = /^\d+$/.test(value || "") ? Number(value) : (Date.parse(value || "") - Date.now()) / 1e3;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : 60;
}
function slimNutriscore(raw) {
  const current = raw?.["2023"];
  if (!current || typeof current !== "object") return void 0;
  const d = current.data || {};
  const part = (list2) => (Array.isArray(list2) ? list2 : []).slice(0, 10).map((x) => ({ id: String(x?.id || "").slice(0, 40), points: Number(x?.points), max: Number(x?.points_max ?? x?.max), value: typeof x?.value === "number" ? x.value : null, unit: String(x?.unit || "").slice(0, 8) })).filter((x) => x.id && Number.isFinite(x.points) && Number.isFinite(x.max));
  return { "2023": {
    grade: String(current.grade || "").slice(0, 1),
    score: Number.isFinite(current.score) ? current.score : null,
    category_available: current.category_available === 1 ? 1 : 0,
    data: {
      negative: part(d.negative ?? d.components?.negative),
      positive: part(d.positive ?? d.components?.positive),
      negative_points: Number.isFinite(d.negative_points) ? d.negative_points : null,
      positive_points: Number.isFinite(d.positive_points) ? d.positive_points : null,
      count_proteins: d.count_proteins === 1 ? 1 : 0,
      count_proteins_reason: String(d.count_proteins_reason || "").slice(0, 80),
      is_beverage: d.is_beverage === 1 ? 1 : 0,
      is_cheese: d.is_cheese === 1 ? 1 : 0,
      is_fat_oil_nuts_seeds: d.is_fat_oil_nuts_seeds === 1 ? 1 : 0,
      is_red_meat_product: d.is_red_meat_product === 1 ? 1 : 0,
      is_water: d.is_water === 1 ? 1 : 0
    }
  } };
}
var contactFor = (env, origin) => typeof env?.CONTACT_EMAIL === "string" && /^[^\s<>()[\]@]+@[^\s<>()[\]@]+\.[^\s<>()[\]@]+$/.test(env.CONTACT_EMAIL) ? env.CONTACT_EMAIL.slice(0, 200) : `${origin}/how/`;
async function remember(cache, ctx, key, staleKey, response, freshSeconds) {
  if (!cache || response.status !== 200) return;
  const copy = (seconds) => {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", `public, max-age=${seconds}, s-maxage=${seconds}`);
    return new Response(response.clone().body, { status: 200, headers });
  };
  const stale = cache.put(staleKey, copy(STALE_SECONDS)).catch(() => {
  });
  const fresh = cache.put(key, copy(freshSeconds)).catch(() => {
  });
  if (ctx?.waitUntil) {
    ctx.waitUntil(fresh);
    await stale;
  } else await Promise.all([stale, fresh]);
}
async function staleCopy(cache, staleKey) {
  if (!cache) return null;
  try {
    const hit2 = await cache.match(staleKey);
    if (hit2?.status !== 200) return null;
    const headers = new Headers(hit2.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-FoodScan-Cache", "STALE");
    return new Response(hit2.body, { status: 200, headers });
  } catch {
    return null;
  }
}
async function reserveRead(ip, env, kind = "product") {
  if (idxEnabled(env)) return await idxReserveUpstream(env, kind);
  const now = Date.now(), list2 = budget[kind];
  while (list2.length && list2[0] <= now - 6e4) list2.shift();
  if (kind === "product" && providerCooldown > now) return { code: "rate_limited", wait: Math.ceil((providerCooldown - now) / 1e3) };
  const maximum = kind === "product" ? PRODUCT_MINUTE : kind === "index" ? INDEX_MINUTE : SEARCH_MINUTE;
  if (list2.length >= maximum) return { code: "local_rate_limited", wait: Math.max(1, Math.ceil((list2[0] + 6e4 - now) / 1e3)) };
  const userKey = `${kind}:${ip}`, entry = fairness.get(userKey) || [];
  const hits = entry.filter((t2) => t2 > now - 6e4);
  if (hits.length >= (kind === "product" ? 60 : 45)) return { code: "local_rate_limited", wait: Math.max(1, Math.ceil((hits[0] + 6e4 - now) / 1e3)) };
  if (fairness.size > 2048) {
    for (const [key, times] of fairness) if (!times.length || times.at(-1) <= now - 6e4) fairness.delete(key);
  }
  if (fairness.size > 4096 && !fairness.has(userKey)) return { code: "local_rate_limited", wait: 30 };
  hits.push(now);
  fairness.set(userKey, hits);
  list2.push(now);
  if (env?.UPSTREAM_RATE_LIMITER?.limit) {
    try {
      const out = await env.UPSTREAM_RATE_LIMITER.limit({ key: `open-food-facts:${kind}` });
      if (!out.success) return { code: "local_rate_limited", wait: 60 };
    } catch {
      return { code: "local_rate_limited", wait: 60 };
    }
  }
  return null;
}
function approvedURL(value, base, code) {
  try {
    const u = new URL(value, base);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    if (!/^(?:world(?:-[a-z]{2})?|[a-z]{2}(?:-[a-z]{2})?|(?:ssl-)?api)\.openfoodfacts\.org$/.test(u.hostname)) return null;
    const match = u.pathname.match(/^\/api\/v(?:2|3(?:\.\d+)?)\/product\/(\d+)(?:\.json)?$/);
    if (!match || !equivalent(match[1], code)) return null;
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}
async function limitedText(response, maximum = MAX_BODY) {
  if (Number(response.headers.get("Content-Length")) > maximum) throw new Error("response_size");
  if (!response.body?.getReader) {
    const text3 = await response.text();
    if (text3.length > maximum) throw new Error("response_size");
    return text3;
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text2 = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new Error("response_size");
      }
      text2 += decoder.decode(value, { stream: true });
    }
    return text2 + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
function completeSourceProduct(raw, code) {
  const product = Object.fromEntries(FIELDS.split(",").filter((key) => Object.hasOwn(raw, key)).map((key) => [key, raw[key]]));
  product.code = code;
  if(raw.partial===true)product.partial=true;
  if (product.nutriscore) product.nutriscore = slimNutriscore(product.nutriscore);
  for (const [k, v] of Object.entries(raw)) {
    if (!product.product_name && /^(?:product_name|generic_name|abbreviated_product_name)/i.test(k) && typeof v === "string" && v.trim()) {
      product.product_name = v.trim();
    }
  }
  if (!String(product.ingredients_text || product.ingredients_text_en || "").trim()) {
    const local = ingredientText(product);
    if (local) product.ingredients_text = local.slice(0, 14e3);
  }
  return product;
}
async function fetchProduct(request, env, code) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  const site = new URL(request.url).origin, contact = contactFor(env, site);
  const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const attempts = [], ip = request.headers.get("CF-Connecting-IP") || "unknown";
  let redirects = 0, compatibility = false, paddedTried = false;
  let url = new URL(`${ORIGIN}/api/v3/product/${code}`);
  url.searchParams.set("fields", FIELDS);
  const fail = (type, message, status, extra = {}, headers = {}) => error(type, message, status, { requestId, attempts, ...extra }, headers);
  try {
    for (let hop = 0; hop < 5; hop++) {
      const limit = await reserveRead(ip, env);
      if (limit) return fail(
        limit.code,
        limit.code === "rate_limited" ? "Open Food Facts asked us to pause requests. Please wait before trying again." : "This FoodScan server has reached its temporary request budget. Please wait before trying again.",
        429,
        { retryAfter: limit.wait },
        { "Retry-After": String(limit.wait) }
      );
      const started = Date.now(), attempt = { endpoint: url.origin + url.pathname, httpStatus: null, elapsedMs: 0 };
      attempts.push(attempt);
      const response = await fetch(url.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": `FoodScan/${VERSION} (${contact})`, "Accept": "application/json" }
      });
      attempt.httpStatus = response.status;
      attempt.elapsedMs = Date.now() - started;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = approvedURL(response.headers.get("Location"), url, code);
        try {
          await response.body?.cancel();
        } catch {
        }
        if (!next || ++redirects > 2) return fail("upstream_redirect", "The database redirected this request outside the allowed food API route.", 502);
        url = next;
        continue;
      }
      if (response.status === 429) {
        const wait = retrySeconds(response.headers.get("Retry-After"));
        providerCooldown = Date.now() + wait * 1e3;
        try {
          await response.body?.cancel();
        } catch {
        }
        await idxApplyUpstreamCooldown(env, "product", wait);
        return fail(
          "rate_limited",
          "Open Food Facts is limiting requests. Your saved foods still work.",
          429,
          { upstreamStatus: 429, retryAfter: wait },
          { "Retry-After": String(wait) }
        );
      }
      if ([401, 403].includes(response.status)) {
        providerCooldown = Date.now() + 3e5;
        try {
          await response.body?.cancel();
        } catch {
        }
        await idxApplyUpstreamCooldown(env, "product", 300);
        return fail("upstream_blocked", "Open Food Facts refused this server request. The site operator should check API identification and access.", 502, { upstreamStatus: response.status });
      }
      if (response.status === 503) {
        const wait = retrySeconds(response.headers.get("Retry-After"));
        providerCooldown = Date.now() + wait * 1e3;
        try {
          await response.body?.cancel();
        } catch {
        }
        await idxApplyUpstreamCooldown(env, "product", wait);
        return fail(
          "upstream_busy",
          "The food database is busy or unavailable. Please wait before retrying.",
          503,
          { upstreamStatus: 503, retryAfter: wait },
          { "Retry-After": String(wait) }
        );
      }
      const isJSON = /(?:application\/json|\+json)/i.test(response.headers.get("Content-Type") || "");
      let body = null;
      if (!isJSON) {
        try {
          await response.body?.cancel();
        } catch {
        }
      }
      if (isJSON) {
        const raw = await limitedText(response);
        try {
          body = JSON.parse(raw);
        } catch {
          return fail("upstream_format", "The database returned unreadable JSON.", 502);
        }
      }
      const nonFood = /different product type/i.test(body?.status_verbose || "") || (body?.result?.id || "").includes("different_product_type");
      if (nonFood) return fail("not_food", "This barcode belongs to a different product type, not a food record.", 404);
      const missing2 = body?.result?.id === "product_not_found" || body?.status === 0 && /product not found/i.test(body?.status_verbose || "");
      if (missing2) {
        if (code.length === 12 && !paddedTried) {
          paddedTried = true;
          url = new URL(`${ORIGIN}/api/v3/product/0${code}`);
          url.searchParams.set("fields", FIELDS);
          continue;
        }
        return fail("not_found", "Open Food Facts does not have a record for this exact barcode.", 404, { upstreamStatus: response.status });
      }
      if (!isJSON && (response.status === 404 || response.status >= 500) || [405, 501].includes(response.status)) {
        if (!compatibility) {
          compatibility = true;
          url = new URL(`${ORIGIN}/api/v2/product/${code}.json`);
          url.searchParams.set("fields", FIELDS);
          continue;
        }
        return fail("upstream_endpoint", "The requested food API endpoint did not return product data.", 502, { upstreamStatus: response.status });
      }
      if (!response.ok) return fail("upstream_http", "The food database returned a server error.", 502, { upstreamStatus: response.status });
      if (!isJSON) return fail("upstream_format", "The food API returned a web page instead of JSON. No product data was accepted.", 502);
      if (!body || typeof body !== "object" || body.status === "failure" || body.status === 0)
        return fail("upstream_failure", "The database could not complete this request. This is not a confirmed product miss.", 502);
      if (!body.product || typeof body.product !== "object" || Array.isArray(body.product))
        return fail("upstream_format", "The food API returned no product object.", 502);
      const returned = String(body.product.code || body.code || "");
      if (body.product.code && !usable(body.product)) return fail("not_food", "This is not a current food record.", 404);
      if (!equivalent(returned, code)) return fail("upstream_mismatch", "The returned barcode did not match the package. No substitute product was displayed.", 502);
      const product = completeSourceProduct(body.product, code);
      return json(
        {
          status: "success",
          product,
          fetchedAt: Date.now(),
          source: "Open Food Facts",
          version: 2,
          connection: { version: VERSION, requestId, endpoint: url.origin + url.pathname, attempts, compatibility }
        },
        200,
        { "Cache-Control": "public, max-age=60, must-revalidate" }
      );
    }
    return fail("upstream_redirect", "The food API exceeded the safe redirect limit.", 502);
  } catch (exception) {
    const last = attempts.at(-1);
    if (last) last.failure = controller.signal.aborted ? "timeout" : exception.message === "response_size" ? "response_size" : "network_error";
    if (exception.message === "response_size") return fail("upstream_size", "The product response exceeded the safe size limit.", 502);
    const type = controller.signal.aborted ? "upstream_timeout" : "upstream_network";
    console.warn(JSON.stringify({ app: "FoodScan", version: VERSION, requestId, error: type, attempts }));
    return fail(type, controller.signal.aborted ? "The server connection to Open Food Facts timed out." : "This server could not connect to Open Food Facts.", controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
var SearchFailure = class extends Error {
  constructor(code, status, wait = 0) {
    super(code);
    this.code = code;
    this.status = status;
    this.wait = wait;
  }
};
function searchRedirect(value, base) {
  try {
    const u = new URL(value || "", base);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    return /^(?:world(?:-[a-z]{2})?|search)\.openfoodfacts\.org$/.test(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}
async function upstreamJSON(href, env, origin, which, ip = "unknown") {
  if (cooldown[which] > Date.now()) throw new SearchFailure("rate_limited", 429, Math.ceil((cooldown[which] - Date.now()) / 1e3));
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const headers = { Accept: "application/json", "User-Agent": `FoodScan/${VERSION} (${contactFor(env, origin)})` };
    let target = href, response;
    for (let hop = 0; ; hop++) {
      const limit = await reserveRead(ip, env, which === "index" ? "index" : "search");
      if (limit) throw new SearchFailure(limit.code, 429, limit.wait);
      response = await fetch(target, { method: "GET", signal: controller.signal, redirect: "manual", headers });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const next = searchRedirect(response.headers.get("Location"), target);
      try {
        await response.body?.cancel();
      } catch {
      }
      if (!next || hop >= 1) throw new SearchFailure("upstream_redirect", 502);
      target = next;
    }
    if ([429, 503].includes(response.status)) {
      const wait = retrySeconds(response.headers.get("Retry-After"));
      cooldown[which] = Date.now() + wait * 1e3;
      try {
        await response.body?.cancel();
      } catch {
      }
      await idxApplyUpstreamCooldown(env, "search", wait);
      throw new SearchFailure(response.status === 429 ? "rate_limited" : "upstream_busy", response.status, wait);
    }
    if ([401, 403].includes(response.status)) {
      cooldown[which] = Date.now() + 3e5;
      try {
        await response.body?.cancel();
      } catch {
      }
      await idxApplyUpstreamCooldown(env, "search", 300);
      throw new SearchFailure("upstream_blocked", 502, 300);
    }
    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
      }
      throw new SearchFailure("upstream_http", 502);
    }
    if (!/json/i.test(response.headers.get("Content-Type") || "")) {
      try {
        await response.body?.cancel();
      } catch {
      }
      throw new SearchFailure("upstream_format", 502);
    }
    try {
      return JSON.parse(await limitedText(response, 2000000));
    } catch (e) {
      throw new SearchFailure(e.message === "response_size" ? "upstream_size" : "upstream_format", 502);
    }
  } catch (e) {
    if (e instanceof SearchFailure) throw e;
    throw new SearchFailure(controller.signal.aborted ? "upstream_timeout" : "upstream_network", controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
var usable = (p) => p && validBarcode2(String(p.code || "")) && !["beauty", "petfood", "product"].includes(p.product_type) && p.obsolete !== "on" && String(p.obsolete) !== "1";
var pick = (p, fields) => Object.fromEntries(fields.split(",").filter((k) => Object.hasOwn(p, k)).map((k) => [k, p[k]]));
function fromIndex(hit2) {
  const record = pick(hit2, INDEX_FIELDS);
  record.code = String(hit2.code);
  record.brands = Array.isArray(hit2.brands) ? hit2.brands.join(", ") : String(hit2.brands || "");
  record.partial = true; // Search projections are never authoritative product records.
  return record;
}
var isoName = (text2) => String(text2).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
async function indexSearch(env, origin, query, sort, size, ip = "unknown", page = 1) {
  const u = new URL(INDEX_ORIGIN);
  u.searchParams.set("q", query);
  u.searchParams.set("langs", SEARCH_LANGS);
  u.searchParams.set("page_size", String(size));
  u.searchParams.set("page", String(page));
  u.searchParams.set("fields", INDEX_FIELDS);
  if (sort) u.searchParams.set("sort_by", sort);
  const raw = await upstreamJSON(u.href, env, origin, "index", ip);
  if (!Array.isArray(raw.hits)) throw new SearchFailure("upstream_format", 502);
  return { products: raw.hits.filter(usable).map(fromIndex), checked: raw.hits.length, source: "search-index", partial: true, page, total: Number.isFinite(raw.count)?raw.count:null, hasMore: Number.isFinite(raw.count)?page*size<raw.count:raw.hits.length===size };
}
async function offSearch(env, origin, params, size, text2, ip = "unknown", page = 1) {
  const u = new URL(text2 ? `${ORIGIN}/cgi/search.pl` : `${ORIGIN}/api/v2/search`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("page_size", String(size));
  u.searchParams.set("page", String(page));
  u.searchParams.set("fields", FIELDS);
  const raw = await upstreamJSON(u.href, env, origin, "off", ip);
  if (!Array.isArray(raw.products)) throw new SearchFailure("upstream_format", 502);
  return { products: raw.products.filter(usable).map(p => completeSourceProduct(p, String(p.code))),
    checked: raw.products.length, source: "off-search", partial: false,
    recordMode: "complete-source-record-v1", page, total: Number.isFinite(raw.count)?raw.count:null,
    hasMore: Number.isFinite(raw.count)?page*size<raw.count:raw.products.length===size };
}
async function firstWorking(providers) {
  let last, empty;
  for (const run of providers) {
    try {
      const value = await run();
      if (value.products?.length) return value;
      empty = value;
    } catch (e) {
      last = e;
      if (["local_rate_limited","rate_limited","upstream_busy"].includes(e.code)) break;
    }
  }
  if (empty) return empty;
  throw last || new SearchFailure("upstream_network", 502);
}
function searchError(exception) {
  const code = exception?.code || "upstream_network";
  if (["rate_limited", "local_rate_limited", "upstream_busy"].includes(code)) {
    const wait = exception.wait || 60;
    return error(code, "Search is temporarily paused. Saved products still work. Wait before trying again.", code === "upstream_busy" ? 503 : 429, { retryAfter: wait }, { "Retry-After": String(wait) });
  }
  return error(code, code === "upstream_blocked" ? "The food database refused this search." : "Live search is unavailable. Saved records may still be available; no alternative is guaranteed.", 503);
}
async function cacheCompleteBatch(request, ctx, batch, checkedAt) {
  const cache=globalThis.caches?.default;
  if(!cache||batch.recordMode!=="complete-source-record-v1"||batch.source!=="off-search"||batch.partial!==false)return;
  const origin=new URL(request.url).origin;
  // Bounded edge writes, not 24 extra upstream lookups. More recent exact records win.
  const work=(async()=>{
    let writes=0;
    for(const raw of batch.products||[]) {
      if(writes>=8)break;
      const code=String(raw.code||'');if(!usable(raw))continue;
      const product=parseProduct({product:raw,fetchedAt:checkedAt},code);
      if(!product||product.partial||dataQuality(product).state==='blocked')continue;
      const key=new Request(`${origin}/api/cache/${CACHE_SCHEMA}/product/${code.padStart(14,'0')}`);
      const staleKey=new Request(`${origin}/api/cache/${CACHE_SCHEMA}/stale/product/${code.padStart(14,'0')}`);
      if(inflight.has(key.url))continue;
      try {
        const existing=await cache.match(key);
        if(existing?.ok){const previous=await existing.json();if(Number(previous.product?.last_modified_t)>Number(raw.last_modified_t||0)||previous.fetchedAt>checkedAt)continue;}
        const response=json({status:'success',product:raw,fetchedAt:checkedAt,source:'Open Food Facts',version:2,
          connection:{version:VERSION,endpoint:ORIGIN+'/api/v2/search',recordMode:'complete-source-record-v1'}});
        // Age is not reset by serving a cached result. Retain a short shared snapshot.
        await remember(cache,null,key,staleKey,response,Math.min(FRESH.category,FRESH.product));writes++;
      }catch{}
    }
  })();
  if(ctx?.waitUntil)ctx.waitUntil(work);else await work;
}
async function cachedSearch(request, ctx, kind, keyPart, run) {
  const url = new URL(request.url), cache = globalThis.caches?.default;
  const key = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/${kind}/${keyPart}`), staleKey = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/stale/${kind}/${keyPart}`);
  if (cache) {
    try {
      const hit2 = await cache.match(key);
      if (hit2?.status === 200) return withCache(hit2, "HIT");
    } catch {
    }
  }
  const pending = inflight.get(key.url);
  if (pending) return (await pending).clone();
  if (inflight.size >= MAX_PENDING) return error("local_rate_limited", "Too many lookups are in progress.", 429, { retryAfter: 10 }, { "Retry-After": "10" });
  const job = (async () => {
    try {
      const result = await run(), checkedAt=Date.now();
      await cacheCompleteBatch(request,ctx,result,checkedAt);
      const response = json({ ...result, provider: result.source, fetchedAt: checkedAt, source: "Open Food Facts", version: VERSION });
      await remember(cache, ctx, key, staleKey, response, result.products?.length ? FRESH[kind === "search" ? "search" : "category"] : 300);
      return withCache(response, "MISS");
    } catch (e) {
      return await staleCopy(cache, staleKey) || searchError(e);
    }
  })();
  inflight.set(key.url, job);
  try {
    return (await job).clone();
  } finally {
    inflight.delete(key.url);
  }
}
function marketCountry(request) {
 const query=new URL(request.url).searchParams;
 const selected=query.get("country");
 if(selected === "any")return "";
 if(selected)return selected;
 return COUNTRY_BY_REGION[String(request.cf?.country||"").toUpperCase()]||"";
}
function marketPage(request) {
 const raw=new URL(request.url).searchParams.get("page")||"1";
 return /^\d{1,2}$/.test(raw)&&Number(raw)>=1&&Number(raw)<=50?Number(raw):null;
}
function categorySearch(request,env,ctx) {
 const url=new URL(request.url),category=url.searchParams.get("category")||"",country=marketCountry(request),page=marketPage(request);
 const full=url.searchParams.get("detail")!=="fast",ip=request.headers.get("CF-Connecting-IP")||"unknown";
 if(!/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/.test(category))return error("invalid_category","Choose a source-listed food category.",400);
 if(country&&!/^[a-z][a-z-]{2,40}$/.test(country))return error("invalid_country","Choose a source-listed country.",400);
 if(!page)return error("invalid_page","Page must be from 1 to 50.",400);
 const query=`categories_tags:"${category}"${country?` AND countries_tags:"en:${country}"`:""}`;
 const viaIndex=()=>indexSearch(env,url.origin,query,"-unique_scans_n",24,ip,page);
 const viaOff=()=>offSearch(env,url.origin,{categories_tags:category,sort_by:"nutriscore_score",...(country?{countries_tags:`en:${country}`}:{})},24,false,ip,page);
 return cachedSearch(request,ctx,"category",`${encodeURIComponent(category)}/${country||"any"}/${full?"full":"fast"}/${page}`,async()=>{
   const batch=await firstWorking(full?[viaOff,viaIndex]:[viaIndex,viaOff]);
   const products=batch.products.filter(p=>!country||(p.countries_tags||[]).includes(`en:${country}`));
   return {...batch,products,category,country:country||null,page,
    coverage:"Country-filtered paginated source records, including imports. Not all supermarket products, retailer availability, stock or price. Complete primary-source records are checked with the same grading kernel as product reports; partial index hints require enrichment."};
 });
}
function textSearch(request, env, ctx) {
  const url = new URL(request.url), query = isoName(url.searchParams.get("q") || ""), full = url.searchParams.get("detail") === "full", ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (query.length < 2) return error("invalid_query", "Type at least 2 letters or digits to search.", 400);
  const viaIndex = () => indexSearch(env, url.origin, query, "", 12, ip);
  const viaOff = () => offSearch(env, url.origin, { search_terms: query, search_simple: "1", action: "process", json: "1", sort_by: "unique_scans_n" }, 12, true, ip);
  return cachedSearch(request, ctx, "search", `${full ? "full" : "fast"}/${encodeURIComponent(query)}`, async () => ({ ...await firstWorking(full ? [viaOff, viaIndex] : [viaIndex, viaOff]), query }));
}
var healthMemo = null;
async function deepHealth(request, env) {
  if (healthMemo && Date.now() - healthMemo.at < 3e5) return healthMemo.value;
  if (deepPending) return deepPending;
  deepPending = (async () => {
    const probe = async (run) => {
      const t2 = Date.now();
      try {
        await run();
        return { ok: true, ms: Date.now() - t2 };
      } catch (e) {
        return { ok: false, ms: Date.now() - t2, error: e?.code || "failed" };
      }
    };
    const [product, index] = await Promise.all([
      probe(async () => {
        const r = await productResponse(request, env, null, "3017624010701");
        if (!r.ok) throw new SearchFailure(r.status === 429 ? "rate_limited" : "upstream_http", r.status);
      }),
      probe(() => indexSearch(env, new URL(request.url).origin, "nutella", "", 1, request.headers.get("CF-Connecting-IP") || "unknown"))
    ]);
    const catalogue = idxEnabled(env) ? await idxDiagnostic(env) : null;
    const value = { status: product.ok && index.ok ? "ok" : product.ok || index.ok ? "degraded" : "down", checks: { productApi: product, searchIndex: index, ...catalogue ? { catalogue: { ok: Boolean(catalogue.ready) } } : {} }, index: catalogue, checkedAt: (/* @__PURE__ */ new Date()).toISOString() };
    healthMemo = { at: Date.now(), value };
    return value;
  })();
  try {
    return await deepPending;
  } finally {
    deepPending = null;
  }
}
function eventRow(body, country = "") {
  if (!body || typeof body !== "object" || !EVENT_NAMES.has(body.name)) return null;
  const props = body.properties && typeof body.properties === "object" ? body.properties : {};
  const label = (v) => typeof v === "boolean" ? String(v) : typeof v === "string" && LABEL3.test(v) ? v : "";
  const viral = VIRAL_EVENTS.has(body.name);
  if (viral && (!SHARE_TOKEN.test(props.referral || "") || !EVENT_ID.test(body.eventId || ""))) return null;
  const cols = { ...props, referral: viral ? props.referral : "", parent: viral && SHARE_TOKEN.test(props.parent || "") && props.parent !== props.referral ? props.parent : "" };
  const ms = Number(props.durationMs);
  return {
    blobs: [body.name, VERSION, /^[A-Z]{2}$/.test(country) ? country : "", ...EVENT_COLUMNS.map((k) => label(cols[k])), viral ? body.eventId : ""],
    doubles: [1, Number.isFinite(ms) && ms >= 0 && ms < 12e4 ? Math.round(ms) : 0],
    indexes: [viral ? props.referral : body.name]
  };
}
var doNotTrack = (request) => request.headers.get("Sec-GPC") === "1" || /^(?:1|yes)$/i.test(request.headers.get("DNT") || "");
async function collectEvent(request, env) {
  const done = new Response(null, { status: 204, headers: { "Cache-Control": "no-store", "X-FoodScan-Version": VERSION } });
  if (request.method !== "POST") return error("method_not_allowed", "Use POST.", 405, {}, { Allow: "POST" });
  if (doNotTrack(request)) return done;
  try {
    const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
    if (!from || new URL(from).origin !== new URL(request.url).origin) return done;
  } catch {
    return done;
  }
  if (!env?.ANALYTICS?.writeDataPoint) return done;
  const now = Date.now(), ip = request.headers.get("CF-Connecting-IP") || "unknown", recent = (eventBudget.get(ip) || []).filter((t2) => t2 > now - 6e4);
  if (recent.length >= 60) return done;
  recent.push(now);
  eventBudget.set(ip, recent);
  if (eventBudget.size > 4096) {
    for (const [k, times] of eventBudget) if (times.at(-1) <= now - 6e4) eventBudget.delete(k);
  }
  let body;
  try {
    body = JSON.parse(await boundedRequest(request, 2e3));
  } catch {
    return error("bad_event", "Invalid or oversized event.", 400);
  }
  const row = eventRow(body, request.cf?.country || "");
  if (!row) return error("bad_event", "Unknown event, or a share event without a valid share token and event id.", 400);
  if (VIRAL_EVENTS.has(body.name)) {
    if (seenEvents.has(body.eventId)) return done;
    if (seenEvents.size > 4e3) {
      for (const [id, at] of seenEvents) if (now - at > 6e5) seenEvents.delete(id);
    }
    if (seenEvents.size > 6e3) seenEvents.clear();
    seenEvents.set(body.eventId, now);
  }
  try {
    env.ANALYTICS.writeDataPoint(row);
  } catch {
  }
  return done;
}

/* BEGIN FOODSCAN PRICES 72 */
/* FoodScan 65: isolated price service. Inserted into the existing Pages advanced Worker build.
   Public observations: Open Prices (ODbL); authorized retailer data: optional D1.
   Never treat a community sighting as a current shelf-price guarantee. */
const FS_PRICE_VERSION = VERSION; // 78: the price service reports the same release as the app
const FS_PRICE_UPSTREAM = 'https://prices.openfoodfacts.org/api/v1/prices';
const FS_PRICE_CHAINS = [
  ['ab','AB Βασιλόπουλος',/(?:^|\b)(?:ab vassilopoulos|ab vasilopoulos|ab basilopoulos|abvassilopoulos|alfa beta|alpha beta|αβ)(?:\b|$)|(?:αβ\s*βασιλ|αλφα\s*βητα|άλφα\s*βήτα|βασιλοπουλ|βασιλόπουλ)/i],
  ['sklavenitis','Σκλαβενίτης',/sklavenit|σκλαβενιτ|σκλαβενίτ/i],
  ['lidl','Lidl',/\blidl\b|λιντλ|λίντλ/i],
  ['mymarket','My market',/my\s*market|my\s*μάρκετ|mymarket/i],
  ['masoutis','Μασούτης',/masout|μασουτ|μασούτ/i],
  ['kritikos','Κρητικός',/kritikos|κρητικο[σς]|κρητικό[σς]/i],
  ['galaxias','Γαλαξίας',/galaxias|γαλαξια|γαλαξία/i],
  ['marketin','Market In',/market\s*in|μαρκετ\s*ιν/i],
  ['synka','ΣΥΝΚΑ',/\bsynka\b|συνκα|σύνκα/i],
  ['chalkiadakis','Χαλκιαδάκης',/chalkiad|xalkiad|χαλκιαδακ|χαλκιαδάκ/i],
  ['bazaar','Bazaar',/\bbazaar\b|μπαζαρ|μπαζάρ/i],
  ['discount-markt','Discount Markt',/discount\s*markt/i],
];

function fsPriceValidBarcode(s) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(s) || /^0+$/.test(s)) return false;
  let total = 0;
  for (let i = s.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) total += Number(s[i]) * weight;
  return (10 - total % 10) % 10 === Number(s.at(-1));
}
const fsPriceKey = code => String(code).padStart(14, '0');
const fsPriceText = (value, len=100) => typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0,len) : '';
const fsPriceNumber = v => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+(?:[.,]\d+)?$/.test(v.trim())) {
    const n = Number(v.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
function fsPriceISO(s) {
  if (typeof s !== 'string') return null;
  const clean = s.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const ms = Date.parse(clean+'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10)===clean ? clean : null;
}
/** Today's date in Greece (Europe/Athens), YYYY-MM-DD. Observations are dated in local Greek days. */
function fsPriceToday(now = Date.now()) {
  try { return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)); }
  catch { return new Date(now + 2*3600000).toISOString().slice(0,10); }
}
/** Age in whole Greek calendar days. 78: never clamped. A future date gives a NEGATIVE age and every caller rejects it,
 *  so a mis-dated observation can never pass as "today" (v77 clamped future dates to age 0 and capped ages at 14). */
function fsPriceAge(s, now = Date.now()) {
  const date = fsPriceISO(s); if (!date) return null;
  return Math.round((Date.parse(fsPriceToday(now)+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);
}
function fsPriceSourceURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.length>3 && !['localhost','127.0.0.1'].includes(u.hostname) ? u.toString().slice(0,400) : ''; }
  catch { return ''; }
}
function fsPriceRetailer(raw) {
  const name = fsPriceText(raw, 100);
  for (const [id,label,regex] of FS_PRICE_CHAINS) if (regex.test(name)) return {id,label,known:true};
  return {id:'other',label:name || 'Supermarket observation',known:false};
}
function fsPriceDistanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI/180, a = Math.sin((lat2-lat1)*rad/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(a)));
}
function fsPriceScope(url) {
  const latS=url.searchParams.get('lat'),lonS=url.searchParams.get('lon'),radiusS=url.searchParams.get('radius_km');
  const nearby = latS !== null || lonS !== null || radiusS !== null;
  if (!nearby) return {nearby:false};
  if (![latS,lonS,radiusS].every(x=>x!==null && /^-?\d+(?:\.\d+)?$/.test(x))) return null;
  const lat=Number(latS),lon=Number(lonS),radius=Number(radiusS);
  if (!(lat>=34&&lat<=42&&lon>=19&&lon<=30&&radius>=1&&radius<=50)) return null;
  return {nearby:true, lat:Math.round(lat*100)/100,lon:Math.round(lon*100)/100,radius:Math.round(radius)};
}
/* FoodScan prices 71: evidence only. Every offer is a real, dated observation from a named source.
 * No estimates, category benchmarks, chain multipliers or scraped name matches. Missing prices stay missing.
 * Freshness: current <= 7 days (only these can be "the cheapest"), older 8-90 days, historical > 90 days.
 * Greece and elsewhere are kept apart: an observation outside Greece is never shown as a Greek shelf price. */
const FS_PRICE_CURRENT_DAYS = 7, FS_PRICE_OLDER_DAYS = 90;
const FS_PRICE_RESTRICTED_PROMOS = ['LOYALTY_PROGRAM','QUANTITY','PICK_IT_YOURSELF','EXPIRES_SOON','SECOND_HAND'];
function fsPriceFreshness(age) { return age <= FS_PRICE_CURRENT_DAYS ? 'current' : age <= FS_PRICE_OLDER_DAYS ? 'older' : 'historical'; }
/** Country of an Open Prices location, from its own address fields only. A Greek-language shop name is not evidence
 *  of Greece: Σκλαβενίτης, Lidl and others trade in Cyprus too (Open Prices has Λεμεσός observations). */
function fsPriceLocationCountry(location) {
  const code = fsPriceText(location?.osm_address_country_code || location?.country_code, 8).toUpperCase();
  if (code === 'GR' || code === 'EL') return 'GR';
  if (/^[A-Z]{2}$/.test(code)) return code;
  const country = fsPriceText(location?.osm_address_country, 60).toLowerCase();
  if (/^(?:greece|hellas|ελλάδα|ελλαδα|ελλάς)$/.test(country)) return 'GR';
  if (/cyprus|κύπρος|κυπρος/.test(country)) return 'CY';
  return '';
}
function fsPriceProof(item) {
  const p = item?.proof;
  if (p?.draft === true) return false;
  return p && typeof p.type === 'string' && /^[A-Z_]{3,30}$/.test(p.type.trim().toUpperCase()) ? p.type.trim().toUpperCase() : null;
}
/** Pack size from a label quantity: "450 g" -> {amount:0.45, unit:'kg'}; "6 x 330 ml" -> {amount:1.98, unit:'l'}. Null when unclear. */
function fsPricePack(quantity, amount, unit) {
  const conv = (v, u) => { u = String(u||'').toLowerCase(); const n = Number(String(v).replace(',', '.'));
    if (!(n > 0)) return null;
    if (u === 'kg') return {amount:n, unit:'kg'}; if (u === 'g' || u === 'gr') return {amount:n/1000, unit:'kg'};
    if (u === 'l' || u === 'lt') return {amount:n, unit:'l'}; if (u === 'ml') return {amount:n/1000, unit:'l'}; if (u === 'cl') return {amount:n/100, unit:'l'};
    return null; };
  // 79: Greek unit words (γρ., λτ, μλ, κιλό) as written by Greek shops and labels; JS \b does not see Greek letters, hence the lookahead.
  const q = fsPriceText(quantity, 60).replace(/(\d)\s*(?:γραμμάρια|γραμ\.?|γρμ?\.?)(?![\p{L}])/giu, '$1g ').replace(/(\d)\s*(?:κιλά|κιλό|κιλ\.?)(?![\p{L}])/giu, '$1kg ')
    .replace(/(\d)\s*(?:λίτρα|λίτρο|λιτ\.?|λτ\.?)(?![\p{L}])/giu, '$1l ').replace(/(\d)\s*(?:μλ\.?)(?![\p{L}])/giu, '$1ml ');
  const multi = q.match(/(\d{1,3})\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|lt|l)\b/i);
  let out = multi ? conv(multi[2], multi[3]) : null;
  if (out) out = {amount:out.amount*Number(multi[1]), unit:out.unit};
  if (!out) { const one = q.match(/(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|lt|l)\b/i); if (one) out = conv(one[1], one[2]); }
  if (!out && amount != null) out = conv(amount, unit);
  if (!out || out.amount < 0.005 || out.amount > 50) return null;
  return {amount:Math.round(out.amount*10000)/10000, unit:out.unit};
}
function fsPriceUnit(offer, pack) {
  if (offer.basis === 'kg' || offer.basis === 'l') return {unitPrice:offer.price, unitBasis:offer.basis};
  if (offer.basis === 'item' && pack) return {unitPrice:Math.round(offer.price/pack.amount*100)/100, unitBasis:pack.unit};
  return {unitPrice:null, unitBasis:null};
}
function fsPriceNormalizeOpen(item, code, scope, now=Date.now()) {
  if (!item || (item.type && item.type !== 'PRODUCT')) return null;
  const itemCode = item.product_code ?? item.product?.code;
  if (!itemCode || fsPriceKey(itemCode) !== fsPriceKey(code)) return null;
  if (item.currency !== 'EUR') return null;
  if (item.duplicate_of !== null && item.duplicate_of !== undefined) return null;
  const id = Number(item.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const price = fsPriceNumber(item.price);
  if (price === null || !(price > 0 && price < 10000)) return null;
  const dateStr = fsPriceISO(item.date);
  const age = fsPriceAge(dateStr, now);
  if (age === null || age < 0 || age > 1825) return null; // 78: future-dated observations are rejected, not clamped
  const proofType = fsPriceProof(item);
  if (proofType === false) return null;
  const location = item.location || {};
  const rawName = fsPriceText(location.osm_brand || location.osm_name || item.location_osm_name || '', 100);
  if (!rawName) return null;
  const countryCode = location.type === 'ONLINE' ? '' : fsPriceLocationCountry(location);
  const isGreece = countryCode === 'GR';
  const lat = fsPriceNumber(location.osm_lat), lon = fsPriceNumber(location.osm_lon);
  if (scope.nearby && (!isGreece || lat===null || lon===null || fsPriceDistanceKm(scope.lat,scope.lon,lat,lon)>scope.radius)) return null;
  const retailer = fsPriceRetailer(rawName);
  const basis = item.price_per === 'KILOGRAM' || item.price_per === 'KG' ? 'kg' : item.price_per === 'LITER' || item.price_per === 'L' ? 'l' : 'item';
  const discountType = fsPriceText(item.discount_type, 50).toUpperCase();
  const discounted = item.price_is_discounted === true || Boolean(discountType);
  const regular = fsPriceNumber(item.price_without_discount);
  const freshness = fsPriceFreshness(age);
  const conditional = FS_PRICE_RESTRICTED_PROMOS.includes(discountType);
  const file = String(item.proof?.file_path || '');
  return {
    id:'op:'+id, barcode:code, price:Math.round(price*100)/100,
    regularPrice:discounted && regular!==null && regular>price ? Math.round(regular*100)/100 : null,
    currency:'EUR', basis, date:dateStr, ageDays:age, validUntil:null, freshness,
    // 78: only observations with a proof (receipt / shelf photo) rank; unproven ones are listed, never "the cheapest".
    rankingEligible:isGreece && freshness === 'current' && basis === 'item' && !conditional && Boolean(proofType),
    countryCode:countryCode || 'unknown', market:isGreece ? 'GR' : 'elsewhere',
    retailer:retailer.label, retailerId:retailer.known ? retailer.id : 'other',
    storeName:fsPriceText(location.osm_name || rawName, 120), storeId:(Number(location.id ?? item.location_id) > 0 ? 'op-location:'+Number(location.id ?? item.location_id) : 'op-price:'+id),
    storeScope:location.type==='ONLINE' ? 'online' : 'branch',
    city:fsPriceText(location.osm_address_city || '', 60),
    discounted, discountType, offerConditions:conditional ? discountType : '',
    proofType, source:'Open Prices', sourceKind:'community', sourceLicense:'ODbL',
    sourceURL:`https://prices.openfoodfacts.org/prices/${id}`,
    proofURL:/^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(file) ? `https://prices.openfoodfacts.org/img/${file}` : null,
    latitude:lat, longitude:lon,
    productName:fsPriceText(item.product?.product_name || '', 120),
    productQuantity:fsPriceText(item.product?.quantity || '', 40),
    productAmount:fsPriceNumber(item.product?.product_quantity), productAmountUnit:fsPriceText(item.product?.product_quantity_unit || '', 4),
  };
}
function fsPriceNormalizeLicensed(row, code, scope, now=Date.now()) {
  const official=FS_GR_SOURCES[row?.source_id];
  if (official) { const o=fsGrOffer(official, code, fsPriceText(row.retailer_id,50), Number(row.price_cents)/100, fsPriceISO(row.observed_at), row.discounted===1, now);
    if (!o) return null;
    const out={...o, id:official.prefix+fsPriceText(row.offer_key,180), fetchedAt:fsPriceStamp(row.updated_at), origin:'d1'};
    if (official.kind==='retailer') {
      // Web-shop rows (written by the cron Worker): the product page the price was read from, and the shop's crossed-out price.
      const shop=fsPriceSourceURL(row.source_url), reg=row.regular_price_cents ? Number(row.regular_price_cents)/100 : null;
      const regular=reg!==null&&reg>o.price ? Math.round(reg*100)/100 : null;
      Object.assign(out,{regularPrice:regular, discounted:regular!==null||o.discounted, discountType:regular!==null||o.discounted?'SALE':'', match:'barcode', evidenceURL:official.url,
        sourceURL:shop && shop.startsWith(official.url.replace(/\/$/,'')) ? shop : official.url});
    }
    return out; }
  if (!row || fsPriceKey(String(row.barcode||''))!==fsPriceKey(code)) return null;
  const date=fsPriceISO(row.observed_at),age=fsPriceAge(date,now);
  if (age===null || age<0 || age>FS_PRICE_OLDER_DAYS) return null; // 78: future-dated feed rows are rejected
  const today=fsPriceToday(now);
  const expiration=row.valid_until ? fsPriceISO(row.valid_until):null;
  const expired=Boolean(row.valid_until && (!expiration || expiration < today));
  const price=Number(row.price_cents)/100;
  if (!Number.isFinite(price)||price<=0||price>10000) return null;
  const lat=fsPriceNumber(row.latitude),lon=fsPriceNumber(row.longitude);
  if (scope.nearby && row.store_scope==='branch' && (lat===null||lon===null||fsPriceDistanceKm(scope.lat,scope.lon,lat,lon)>scope.radius)) return null;
  const basis=['item','kg','l'].includes(row.price_basis)?row.price_basis:'item';
  const conditional=row.discount_type==='LOYALTY_PROGRAM'||row.discount_type==='QUANTITY';
  const freshness=expired?'expired':fsPriceFreshness(age);
  const regular=row.regular_price_cents ? Number(row.regular_price_cents)/100 : null;
  return {
    id:'lf:'+fsPriceText(row.offer_key,180),barcode:code,price,regularPrice:regular!==null&&regular>price?regular:null,
    currency:'EUR',basis,date,ageDays:age,validUntil:expiration,freshness,
    rankingEligible:freshness==='current'&&basis==='item'&&!conditional,
    countryCode:'GR',market:'GR',
    retailer:fsPriceText(row.retailer,100),retailerId:fsPriceText(row.retailer_id,50),storeName:fsPriceText(row.store_name,120),
    storeId:'licensed:'+fsPriceText(row.store_id,100),storeScope:row.store_scope,city:fsPriceText(row.city,60),
    discounted:row.discounted===1,discountType:fsPriceText(row.discount_type,50),offerConditions:fsPriceText(row.offer_conditions,140),
    proofType:'RETAILER_FEED',source:fsPriceText(row.source_label,80),sourceKind:'licensed',sourceLicense:fsPriceText(row.license_ref,120),
    sourceURL:fsPriceSourceURL(row.source_url),proofURL:null,latitude:lat,longitude:lon,
  };
}
/** One row per store and price basis: the most recent observation wins; same-day conflicts keep the lower price but are flagged. */
/** An ISO timestamp the cron Worker or a seed file recorded when it read the price ("fetched at"), or null. */
function fsPriceStamp(v) { const t=Date.parse(String(v||'')); return Number.isFinite(t) && t>Date.parse('2024-01-01') && t<Date.now()+86400000 ? new Date(t).toISOString() : null; }
function fsPriceDeduplicate(items) {
  const buckets=new Map();
  for(const o of items){
    const key=[o.storeId,o.basis].join('|');
    const old=buckets.get(key);
    if(!old){buckets.set(key,{...o});continue;}
    if(o.date>old.date) buckets.set(key,{...o,earlierObservations:(old.earlierObservations||0)+1});
    else if(o.date===old.date && o.fetchedAt && old.fetchedAt && o.fetchedAt!==old.fetchedAt) buckets.set(key,{...(o.fetchedAt>old.fetchedAt?o:old),earlierObservations:(old.earlierObservations||0)+1});
    else if(o.date===old.date && o.price!==old.price) buckets.set(key,{...(o.price<old.price?o:old),conflictingEvidence:true,earlierObservations:(old.earlierObservations||0)+1});
    else old.earlierObservations=(old.earlierObservations||0)+1;
  }
  return [...buckets.values()].sort(fsPriceOrder);
}
function fsPriceOrder(a,b){
  return Number(b.rankingEligible)-Number(a.rankingEligible) || (a.rankingEligible ? a.price-b.price : 0) || b.date.localeCompare(a.date) || a.price-b.price;
}

const FS_PRICE_SCHEMA = `CREATE TABLE IF NOT EXISTS foodscan_price_offers (
 offer_key TEXT PRIMARY KEY, barcode TEXT NOT NULL, retailer_id TEXT NOT NULL, retailer TEXT NOT NULL,
 store_id TEXT NOT NULL, store_name TEXT NOT NULL, store_scope TEXT NOT NULL, city TEXT NOT NULL DEFAULT '',
 latitude REAL, longitude REAL, price_cents INTEGER NOT NULL, regular_price_cents INTEGER,
 price_basis TEXT NOT NULL DEFAULT 'item', discounted INTEGER NOT NULL DEFAULT 0, discount_type TEXT NOT NULL DEFAULT '',
 offer_conditions TEXT NOT NULL DEFAULT '', observed_at TEXT NOT NULL, valid_until TEXT,
 source_id TEXT NOT NULL, source_label TEXT NOT NULL, source_url TEXT NOT NULL, license_ref TEXT NOT NULL,
 updated_at TEXT NOT NULL
);`;
const FS_PRICE_INDEX = 'CREATE INDEX IF NOT EXISTS foodscan_price_barcode ON foodscan_price_offers (barcode, observed_at DESC);';
async function fsPriceLicensedOffers(env, code, scope) {
  if (!env?.FOODSCAN_PRICES_DB) return {status:'disabled',reason:'not_configured',items:[]};
  try {
    const db=env.FOODSCAN_PRICES_DB, since=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
    const result=await db.prepare('SELECT * FROM foodscan_price_offers WHERE barcode = ? AND observed_at >= ? ORDER BY observed_at DESC LIMIT 150').bind(fsPriceKey(code),since).all();
    // FoodScan 74: the cron Worker records every price change it sees (old -> new, both dated). Attach the latest one per offer.
    let changes=new Map();
    try { const c=await db.prepare('SELECT offer_key, old_cents, new_cents, old_observed_at, new_observed_at, detected_at FROM foodscan_price_changes WHERE barcode = ? AND detected_at >= ? ORDER BY detected_at DESC LIMIT 100').bind(fsPriceKey(code),since).all();
      for (const r of c?.results||[]) if (!changes.has(r.offer_key)) changes.set(r.offer_key,r); } catch {}
    const items=(result?.results||[]).map(r=>{ const o=fsPriceNormalizeLicensed(r,code,scope); if(!o)return null; const ch=changes.get(r.offer_key);
      if (ch && Number(ch.new_cents)===Number(r.price_cents) && Number(ch.old_cents)>0) o.priceChange={from:Number(ch.old_cents)/100, to:Number(ch.new_cents)/100, fromDate:fsPriceISO(ch.old_observed_at), toDate:fsPriceISO(ch.new_observed_at), detectedAt:fsPriceStamp(ch.detected_at)};
      return o; }).filter(Boolean);
    return {status:items.length?'ok_with_data':'ok_empty',items};
  } catch {
    return {status:'unavailable',items:[],reason:'database_not_ready'};
  }
}
const fsPriceBuckets=new Map();
function fsPriceCanFetch(ip) {
  const now=Date.now();
  const xs=(fsPriceBuckets.get(ip)||[]).filter(at=>at>now-60000);
  if(xs.length>=60) return false;
  xs.push(now);fsPriceBuckets.set(ip,xs);
  if(fsPriceBuckets.size>2500) for(const [key,arr] of fsPriceBuckets) if(arr.at(-1)<now-60000)fsPriceBuckets.delete(key);
  return true;
}
function fsPriceJson(data,status=200, extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-FoodScan-Version':FS_PRICE_VERSION,...extra}});
}
function fsPriceValidateImportRecord(rec,source) {
  if(!rec||typeof rec!=='object'||Array.isArray(rec))return null;
  const barcode=String(rec.barcode||'').trim();
  if(!fsPriceValidBarcode(barcode))return null;
  const retailer=FS_PRICE_CHAINS.find(x=>x[0]===rec.retailer_id);
  if(!retailer)return null;
  const scope=rec.store_scope==='national'?'national':rec.store_scope==='branch'?'branch':null;
  const storeId=fsPriceText(rec.store_id,80),storeName=fsPriceText(rec.store_name,120);
  if(!scope||!storeId||!storeName)return null;
  const fullStoreId=retailer[0]+':'+storeId;
  const price=fsPriceNumber(rec.price);
  if(price===null||price<0.01||price>10000)return null;
  const observed=fsPriceISO(rec.observed_at);
  const age=fsPriceAge(observed);
  if(age===null||age<0||age>30)return null;
  const until=rec.valid_until==null ? null:fsPriceISO(rec.valid_until);
  if(rec.valid_until!=null && (!until||until<observed))return null;
  const basis=['item','kg','l'].includes(rec.basis)?rec.basis:null;
  if(!basis)return null;
  const discountType=rec.discount_type==null?'':fsPriceText(rec.discount_type,40);
  const allowed=['','SALE','LOYALTY_PROGRAM','QUANTITY','SEASONAL','OTHER'];
  if(!allowed.includes(discountType))return null;
  const discounted=Boolean(discountType),regular=rec.regular_price==null?null:fsPriceNumber(rec.regular_price);
  if(regular!==null && (regular<price||regular>10000))return null;
  const lat=rec.latitude==null?null:fsPriceNumber(rec.latitude),lon=rec.longitude==null?null:fsPriceNumber(rec.longitude);
  if(scope==='branch' && (lat===null||lon===null||lat<34||lat>42||lon<19||lon>30))return null;
  const city=fsPriceText(rec.city,60),conditions=fsPriceText(rec.offer_conditions,140);
  if((discountType==='LOYALTY_PROGRAM'||discountType==='QUANTITY')&&!conditions)return null;
  const sourceUrl=fsPriceSourceURL(rec.source_url);
  if(!sourceUrl)return null;
  const recordKey=[source.id,fsPriceKey(barcode),fullStoreId,basis,discountType].join('|');
  return {offer_key:recordKey,barcode:fsPriceKey(barcode),retailer_id:retailer[0],retailer:retailer[1],store_id:fullStoreId,store_name:storeName,
    store_scope:scope,city,latitude:lat,longitude:lon,price_cents:Math.round(price*100),regular_price_cents:regular===null?null:Math.round(regular*100),
    price_basis:basis,discounted:discounted?1:0,discount_type:discountType,offer_conditions:conditions,observed_at:observed,
    valid_until:until,source_id:source.id,source_label:source.label,source_url:sourceUrl,license_ref:source.license,
    updated_at:new Date().toISOString()};
}
function fsPriceSameOrigin(request) {
  const url=new URL(request.url), origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return false;
  return request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
async function fsPriceAdminImport(request,env) {
  if(request.method!=='POST')return fsPriceJson({error:'method_not_allowed'},405,{Allow:'POST'});
  if(!env?.FOODSCAN_PRICES_DB||!env?.FOODSCAN_PRICES_ADMIN_TOKEN || String(env.FOODSCAN_PRICES_ADMIN_TOKEN).length<32) return fsPriceJson({error:'import_not_configured'},503);
  const bearer=request.headers.get('Authorization')||'';
  const given=bearer.startsWith('Bearer ')?bearer.slice(7):'';
  const d=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([d(given),d(String(env.FOODSCAN_PRICES_ADMIN_TOKEN))]);
  let x=0; for(let i=0;i<a.length;i++)x|=a[i]^b[i];
  if(!given||x!==0)return fsPriceJson({error:'unauthorized'},401);
  if(Number(request.headers.get('Content-Length')||0)>180000)return fsPriceJson({error:'too_large'},413);
  let text;
  try{ text=await request.text();if(text.length>180000)throw new Error('large');}catch{return fsPriceJson({error:'too_large'},413);}
  let body;try{body=JSON.parse(text);}catch{return fsPriceJson({error:'bad_json'},400);}
  if(!body||!Array.isArray(body.records)||body.records.length<1||body.records.length>100)return fsPriceJson({error:'invalid_batch'},400);
  const source={id:fsPriceText(body.source_id,60),label:fsPriceText(body.source_label,80),license:fsPriceText(body.license_ref,120)};
  if(!/^[a-z0-9_-]{3,60}$/.test(source.id)||!source.label||source.license.length<6 || body.rights_confirmed!==true)
    return fsPriceJson({error:'rights_confirmation_required'},400);
  const records=body.records.map(r=>fsPriceValidateImportRecord(r,source));
  if(records.some(x=>!x))return fsPriceJson({error:'invalid_record',invalidIndices:records.map((r,i)=>r?null:i).filter(i=>i!==null)},400);
  const query=`INSERT INTO foodscan_price_offers (offer_key,barcode,retailer_id,retailer,store_id,store_name,store_scope,city,latitude,longitude,price_cents,regular_price_cents,price_basis,discounted,discount_type,offer_conditions,observed_at,valid_until,source_id,source_label,source_url,license_ref,updated_at)
 VALUES (${Array(23).fill('?').join(',')}) ON CONFLICT(offer_key) DO UPDATE SET price_cents=excluded.price_cents,regular_price_cents=excluded.regular_price_cents,
 discounted=excluded.discounted,offer_conditions=excluded.offer_conditions,observed_at=excluded.observed_at,valid_until=excluded.valid_until,source_url=excluded.source_url,license_ref=excluded.license_ref,updated_at=excluded.updated_at
 WHERE excluded.observed_at >= foodscan_price_offers.observed_at`;
  try{
    await env.FOODSCAN_PRICES_DB.batch(records.map(row=>env.FOODSCAN_PRICES_DB.prepare(query).bind(...[
      row.offer_key,row.barcode,row.retailer_id,row.retailer,row.store_id,row.store_name,row.store_scope,row.city,row.latitude,row.longitude,row.price_cents,row.regular_price_cents,row.price_basis,row.discounted,row.discount_type,row.offer_conditions,row.observed_at,row.valid_until,row.source_id,row.source_label,row.source_url,row.license_ref,row.updated_at])));
    return fsPriceJson({ok:true,accepted:records.length,source:source.label});
  }catch {return fsPriceJson({error:'database_not_ready'},503);}
}
/** Open Prices, newest first. All spellings of the code are asked at once. "unavailable" means the source did not answer:
 *  it is never reported as "no prices". */
async function fsPriceOpenOffers(code, scope, env, request) {
  const site = request ? new URL(request.url).origin : 'https://food-scan.gearuptofit.com';
  const contact = typeof contactFor === 'function' ? contactFor(env, site) : 'https://food-scan.gearuptofit.com/how/';
  const codes = [...new Set([String(code).trim(), String(code).replace(/^0+/, ''), String(code).padStart(13, '0')])].filter(c => c.length >= 8 && c.length <= 14);
  const headers = {'Accept':'application/json','User-Agent':`FoodScan/${FS_PRICE_VERSION} (${contact})`};
  // 79: popular products can have more than 100 observations (most from other countries); newest first, up to 3 pages.
  const one = async candidate => {
    const first = await page(candidate, 1);
    if (first.status !== 'available' || !(first.total > first.items.length)) return first;
    const more = await Promise.all([2, 3].filter(n => (n - 1) * 100 < first.total).map(n => page(candidate, n)));
    return {...first, items:[...first.items, ...more.filter(r => r.status === 'available').flatMap(r => r.items)], pages:1 + more.length};
  };
  const page = async (candidate, n) => {
    try {
      const res = await fetch(`${FS_PRICE_UPSTREAM}?product_code=${encodeURIComponent(candidate)}&size=100&page=${n}&order_by=-date`, {headers, redirect:'follow', signal:AbortSignal.timeout(4500)});
      if (res.status === 429) return {status:'rate_limited', items:[], httpStatus:429};
      if (!res.ok) return {status:'unavailable', items:[], httpStatus:res.status};
      const raw = await res.text();
      if (raw.length > 2500000) return {status:'unavailable', items:[]};
      const data = JSON.parse(raw);
      const list = Array.isArray(data?.items) ? data.items : null;
      return list ? {status:'available', items:list, total:Number(data.total)||list.length} : {status:'unavailable', items:[]};
    } catch { return {status:'unavailable', items:[]}; }
  };
  const results = await Promise.all(codes.map(one));
  const answered = results.filter(r => r.status === 'available');
  if (!answered.length) return {status:'unavailable', reason:results.some(r=>r.status==='rate_limited')?'rate_limited':(results.find(r=>r.httpStatus)?'http_'+results.find(r=>r.httpStatus).httpStatus:'network'), items:[], inspected:0};
  const seen = new Set(), raw = [];
  for (const r of answered) for (const i of r.items) if (!seen.has(i?.id)) { seen.add(i?.id); raw.push(i); }
  const items = raw.map(i => fsPriceNormalizeOpen(i, code, scope)).filter(Boolean);
  // 78: truthful health. 'ok_with_data' only when at least one usable observation survived validation.
  return {status:items.length?'ok_with_data':'ok_empty', items, inspected:raw.length, total:Math.max(...answered.map(r=>r.total))};
}
/** Name, brand and pack size only (for the label and per-kg maths). Never prices. */
/** The pack/identity fields FoodScan reads from a product record (bundled catalogue or Open Food Facts). */
function fsPricePickMeta(p) {
  return {
    name: fsPriceText(p.product_name_el || p.product_name || p.generic_name_el || p.generic_name || '', 120),
    brand: fsPriceText(String(p.brands || '').split(',')[0], 60),
    quantity: fsPriceText(p.quantity || '', 40),
    productAmount: fsPriceNumber(p.product_quantity), productAmountUnit: fsPriceText(p.product_quantity_unit || '', 4),
    nutriScore: /^[a-e]$/i.test(String(p.nutriscore_grade || '')) ? String(p.nutriscore_grade).toUpperCase() : null,
    image: fsPriceSourceURL(p.image_front_small_url || p.image_front_url || ''),
  };
}
/** The validated Open Food Facts product record (identity, quantity, grade). Never a price source. */
async function fsPriceOffRecord(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_el,brands,quantity,product_quantity,product_quantity_unit,nutriscore_grade,image_front_small_url`, {
    headers:{'Accept':'application/json','User-Agent':`FoodScan/${FS_PRICE_VERSION} (https://food-scan.gearuptofit.com)`}, signal:AbortSignal.timeout(2600)});
  if (!res.ok) return null;
  const p = (await res.json())?.product; return p ? {...fsPricePickMeta(p), source:'open_food_facts'} : null;
}
/** 78: product identity, quantity and grade come ONLY from here: the bundled catalogue, then Open Food Facts.
 *  (v77 read them from a hardcoded price index first, which mislabelled e.g. 5202336082308.) */
async function fsPriceLocalCatalogueMeta(request, env, code) {
  const key = fsPriceKey(code);
  try {
    const m = await fs60Manifest(request, env, true);
    const bucket = String(Number(key.slice(-6)) % 32).padStart(2, '0');
    const index = await fs60ReadAsset(request, env, `codes-${bucket}.json`);
    if (index.revision === m.revision && index.codes?.[key]) {
      const data = await fs61Rows(request, env, m, [index.codes[key]]);
      const p = data.products.find(x => String(x.code).padStart(14, '0') === key);
      if (p) { const cat = {...fsPricePickMeta(p), source:'catalogue'};
        // The bundled catalogue sometimes omits the pack size; the validated Open Food Facts record may complete it.
        if (!cat.quantity && !cat.productAmount) { const off = await fsPriceOffRecord(code).catch(()=>null);
          if (off && (off.quantity || off.productAmount)) Object.assign(cat, {quantity:off.quantity, productAmount:off.productAmount, productAmountUnit:off.productAmountUnit, quantitySource:'open_food_facts'}); }
        return cat; }
    }
  } catch {}
  try { return await fsPriceOffRecord(code); } catch { return null; }
}

/* FoodScan 72/73: Greek prices from dated, public sources.
 *  - posokanei.gov.gr price observatory (Ministry of Development): daily national chain prices for ~10,000 products, no
 *    barcodes. A price reaches a barcode only through the link file (ingest/data/ean-posokanei-map-v3.json): links checked
 *    by a person ('h') plus automatic exact matches ('a': same brand, same pack size and unit count, all words and variants
 *    agree, one candidate only, same-week shelf prices consistent; measured 0 errors on the held-out hand-checked links).
 *    The offer says which ('reviewed' / 'auto-exact'). Every other barcode gets nothing from it.
 *  - e-katanalotis: barcode-keyed basket prices. The file has not changed since 16 Jun 2026, so they are history only.
 *  - bazaar-online.gr (v73): the chain's web shop prints the barcode next to the price; online price, dated, linked.
 *  Sources: the dated seed files below (built by ingest/scripts/import.mjs and ingest/scripts/bazaar.py) and, when
 *  configured, the D1 rows written by the daily ingest Worker. The newest dated price per chain wins. Prices are copied,
 *  never computed. */
const FS_GR_SEED_ROOT = '/assets/gr-prices-v72/';
const FS_GR_SOURCES = {
  posokanei:{prefix:'pk:', file:'posokanei-latest.json', store:'posokanei-national', source:'Παρατηρητήριο Τιμών · posokanei.gov.gr', proofType:'GOV_OBSERVATORY',
    url:'https://posokanei.gov.gr/', license:'Public-sector data (Law 4727/2020); daily archive github.com/spyrosavl/posokanei (MIT)'},
  ekatanalotis:{prefix:'ek:', file:'ekatanalotis-latest.json', store:'ekatanalotis', source:'e-katanalotis · Υπουργείο Ανάπτυξης', proofType:'GOV_BASKET',
    url:'https://e-katanalotis.gov.gr/', license:'Public-sector data (Law 4727/2020)'},
  // FoodScan 73: the chain's own web shop, which prints the barcode next to each price. Read politely from public category
  // pages that robots.txt allows (ingest/scripts/bazaar.py), cached, one request at a time. Online price, dated, linked.
  bazaar:{prefix:'bz:', file:'bazaar-eshop-latest.json', store:'eshop', source:'bazaar-online.gr · e-shop', proofType:'RETAILER_WEB', kind:'retailer',
    url:'https://www.bazaar-online.gr/', license:'Publicly displayed retailer price, quoted with link and date', chain:'bazaar', scope:'online', live:'microdata'},
  // FoodScan 74: lidl.gr product pages (robots.txt allows /p/; the sitemap lists them) carry the GTIN and one price in JSON-LD.
  // Lidl prices can differ by region; the site shows its default price, which is what is quoted.
  lidl:{prefix:'li:', file:'lidl-eshop-latest.json', store:'lidl-gr-web', source:'lidl.gr · τιμή ιστοσελίδας (προεπιλεγμένη περιοχή)', proofType:'RETAILER_WEB', kind:'retailer',
    url:'https://www.lidl.gr/', license:'Publicly displayed retailer price, quoted with link and date', chain:'lidl', scope:'online', live:'jsonld',
    // 79: lidl.gr now answers 301 to www.lidl-hellas.gr (same company, same /p/ pages, robots.txt allows /p/); only that hop is followed.
    liveHosts:['www.lidl.gr','www.lidl-hellas.gr']},
  // FoodScan 79: the Kritikos web shop (kritikos-sm.gr; robots.txt: Allow /). Its own product records carry the barcodes and the
  // price in cents. Read off-Workers by ingest/scripts/kritikos-seed.mjs (the shop's CDN may refuse Workers), sharded by barcode.
  // At scan time the product page is re-read once (live check); if that fails the dated seed price is shown with its date.
  kritikos:{prefix:'kr:', file:'kritikos-eshop-latest.json', store:'kritikos-eshop', source:'kritikos-sm.gr · τιμή e-shop', proofType:'RETAILER_WEB', kind:'retailer',
    url:'https://kritikos-sm.gr/', license:'Publicly displayed retailer price, quoted with link and date (price facts only; no shop texts or images)', chain:'kritikos', scope:'online', live:'next',
    // 79: OFF unless the operator sets FS_KRITIKOS=1. The shop's terms (kritikos-sm.gr/pages/oroi-xrhshs/, "Υποχρεώσεις Χρηστών")
    // forbid copying or any use of the site's content beyond the uses the site defines, so it may be switched on only with the
    // chain's written permission. Its seed files are not in the site zip (tools zip: optional/kritikos-seed/).
    optIn:'FS_KRITIKOS'},
};
const FS_GR_RETAILER_WEB = Object.keys(FS_GR_SOURCES).filter(id => FS_GR_SOURCES[id].kind === 'retailer');
/** 79: a source with optIn is read only when the operator has set that variable to '1' (needs the owner's permission). */
const fsGrEnabled = (id, env) => !FS_GR_SOURCES[id]?.optIn || String(env?.[FS_GR_SOURCES[id].optIn] ?? '') === '1';
const fsGrFiles = new Map();
function fsGrSeedFile(request, env, key, file, check) {
  if (!fsGrFiles.has(key)) {
    const task = (async () => {
      const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + file, request.url)));
      if (!res.ok) throw new Error('seed_missing');
      const raw = await res.text(); if (raw.length > 3 * 1024 * 1024) throw new Error('seed_too_large');
      const data = JSON.parse(raw); if (!check(data)) throw new Error('seed_invalid');
      return data;
    })();
    fsGrFiles.set(key, task); task.catch(() => { if (fsGrFiles.get(key) === task) fsGrFiles.delete(key); });
  }
  return fsGrFiles.get(key);
}
/** 79: one source's seed. A sharded seed (Kritikos, ~19k barcodes) is a small manifest plus 100 shards named by the last two
 *  digits of the 14-digit barcode, so a scan parses ~50 KB instead of megabytes. With a code, the shard is merged in. */
async function fsGrSeedV79(request, env, id, code=null) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return null;
  const origin = new URL(request.url).origin;
  try {
    const man = await fsGrSeedLegacy(request, env, id);
    if (!man) return null;
    if (!man.sharded || code === null) return man;
    const shard = fsPriceKey(code).slice(-2), dir = /^[a-z0-9-]+\/$/.test(man.sharded) ? man.sharded : null; if (!dir) return null;
    const part = await fsGrSeedFile(request, env, origin + '|' + id + '|' + shard, dir + shard + '.json',
      d => d?.schema === 2 && d.products && Array.isArray(d.rows) && d.source?.snapshot === man.source.snapshot).catch(e => (e.message === 'seed_missing' ? {products:{}, rows:[]} : null));
    if (!part) return null;
    return {...man, products:part.products, rows:part.rows};
  } catch { return null; }
}
function fsGrSeedLegacyV79(request, env, id) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return Promise.resolve(null);
  const key = new URL(request.url).origin + '|' + id;
  if (!fsGrFiles.has(key)) {
    const task = (async () => {
      const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + def.file, request.url)));
      if (!res.ok) throw new Error('seed_missing');
      const raw = await res.text(); if (raw.length > 3 * 1024 * 1024) throw new Error('seed_too_large');
      const data = JSON.parse(raw); if (![1, 2].includes(data?.schema) || !data.products || !fsPriceISO(data.source?.snapshot)) throw new Error('seed_invalid');
      return data;
    })();
    fsGrFiles.set(key, task); task.catch(() => { if (fsGrFiles.get(key) === task) fsGrFiles.delete(key); });
  }
  return fsGrFiles.get(key).catch(() => null);
}
/** One official chain price -> a FoodScan offer. National chain price (not one branch). */
function fsGrOffer(def, code, chainId, price, date, sale, now=Date.now()) {
  const chain = FS_PRICE_CHAINS.find(c => c[0] === chainId); if (!chain || !date) return null;
  if (!Number.isFinite(price) || price < 0.01 || price > 10000) return null;
  const age = fsPriceAge(date, now); if (age === null || age < 0) return null; // 78: no future dates, ages never capped
  const freshness = fsPriceFreshness(age);
  return {
    id:def.prefix+[date, chain[0], fsPriceKey(code)].join(':'), barcode:code, price:Math.round(price*100)/100, regularPrice:null,
    currency:'EUR', basis:'item', date, ageDays:age, validUntil:null, freshness,
    rankingEligible:freshness === 'current', countryCode:'GR', market:'GR',
    retailer:chain[1], retailerId:chain[0], storeName:chain[1], storeId:'licensed:'+chain[0]+':'+def.store, storeScope:def.scope || 'national', city:'',
    discounted:Boolean(sale), discountType:sale ? 'SALE' : '', offerConditions:'',
    proofType:def.proofType, source:def.source, sourceKind:def.kind || 'official', sourceLicense:def.license, sourceURL:def.url, proofURL:null, latitude:null, longitude:null,
  };
}
/** 79: live check of one Kritikos product page (the seed's own link, never a search). Reads the shop's record for this barcode
 *  from the page's __NEXT_DATA__ and returns today's price. 'unavailable' (network, HTTP error, challenge, timeout) keeps the
 *  dated seed price; 'barcode_not_on_page'/'gone' (the page answers but no longer lists the barcode, or 404) drops it. */
const FS_KR_SIMPLE = new Set(['none','percentage','super','amount','price']);
async function fsGrLiveCheck(def, path, code, now=Date.now()) {
  if (def.live === 'microdata' || def.live === 'jsonld') return fsGrLiveHtml(def, path, code, now);
  try {
    const res = await fetch(def.url.replace(/\/$/, '') + path, {headers:{'Accept':'text/html','User-Agent':`FoodScan/${FS_PRICE_VERSION} (+https://food-scan.gearuptofit.com/how/; one product page per scan)`}, redirect:'manual', signal:AbortSignal.timeout(2500)});
    if (res.status === 404 || res.status === 410) { await res.body?.cancel(); return {status:'gone'}; }
    if (!res.ok) { await res.body?.cancel(); return {status:'unavailable', http:res.status}; }
    const html = await res.text(); if (html.length > 3000000) return {status:'unavailable'};
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (!m) return {status:'unavailable', reason:'no_product_data'};
    let pp = null; try { pp = JSON.parse(m[1])?.props?.pageProps || null; } catch { return {status:'unavailable', reason:'bad_product_data'}; }
    const list = [...['productSelected','product'].map(k => pp?.[k]).filter(x => x && typeof x === 'object'), ...Object.values(pp?.staticProducts || {}).flat()].filter(x => x && typeof x === 'object');
    const key = fsPriceKey(code);
    const rec = list.find(x => Array.isArray(x.barcodes) && x.barcodes.some(b => /^\d{8,14}$/.test(String(b)) && fsPriceKey(String(b)) === key));
    if (!rec) return {status:'barcode_not_on_page'};
    if (rec.enabled === false || rec.archived === true) return {status:'gone'};
    const c = v => Number.isInteger(v) && v >= 1 && v <= 1000000 ? v : null;
    const fin = c(rec.finalPrice), begin = c(rec.beginPrice) ?? c(rec.itemPrice); if (!fin || rec.isWeighed !== false) return {status:'unavailable', reason:'no_item_price'};
    const simple = FS_KR_SIMPLE.has(String(rec.offerType || 'none'));
    const price = (simple ? fin : (begin || fin)) / 100, regular = simple && begin && begin > fin ? begin / 100 : null;
    const date = fsPriceToday(now);
    return {status:'confirmed', offer:{price:Math.round(price*100)/100, regularPrice:regular, discounted:regular !== null, discountType:regular !== null ? 'SALE' : '',
      date, ageDays:0, freshness:'current', rankingEligible:rec.available !== false, available:rec.available !== false,
      extraOffer:simple ? '' : 'offer:' + String(rec.offerType).slice(0, 24), fetchedAt:new Date(now).toISOString(), origin:'live',
      id:def.prefix + [date, def.chain, key].join(':'), ...(fsPricePack(fsPriceText(rec.quantity || '', 60)) ? {shopPack:fsPricePack(fsPriceText(rec.quantity || '', 60))} : {})}};
  } catch { return {status:'unavailable'}; }
}
/** 79: live check of one Bazaar (schema.org microdata) or Lidl (schema.org JSON-LD) product page: the seed's own link, a page
 *  robots.txt allows, one request per scan. The page must name THIS barcode (Bazaar itemprop "model", Lidl gtin13) and print
 *  exactly one EUR price; then that price is today's. Anything else keeps the dated seed price ('unavailable'), except a page that
 *  clearly describes a product under another barcode ('barcode_not_on_page'), which drops it. A 404 is NOT taken as proof the item
 *  is gone (the shop may be refusing the fetch); the dated seed price stays, with its date. */
async function fsGrLiveHtml(def, path, code, now=Date.now()) {
  try {
    const get = u => fetch(u, {headers:{'Accept':'text/html','User-Agent':`FoodScan/${FS_PRICE_VERSION} (+https://food-scan.gearuptofit.com/how/; one product page per scan)`}, redirect:'manual', signal:AbortSignal.timeout(2500)});
    let res = await get(def.url.replace(/\/$/, '') + path);
    if ([301,302,307,308].includes(res.status) && def.liveHosts) { // one hop, only to the shop's own listed host, same /p/ path
      let to = null; try { to = new URL(res.headers.get('location') || '', def.url); } catch {}
      await res.body?.cancel();
      if (!to || to.protocol !== 'https:' || !def.liveHosts.includes(to.hostname) || to.pathname !== path.split('?')[0]) return {status:'unavailable', http:res.status};
      res = await get(to.href);
    }
    if (!res.ok) { await res.body?.cancel(); return {status:'unavailable', http:res.status}; }
    const html = await res.text(); if (html.length > 3000000) return {status:'unavailable'};
    const key = fsPriceKey(code), same = b => /^\d{8,14}$/.test(String(b || '')) && fsPriceKey(String(b)) === key;
    let codes = [], prices = [], available = true;
    if (def.live === 'microdata') {
      if ((html.match(/itemtype="https?:\/\/schema\.org\/Product"/g) || []).length !== 1) return {status:'unavailable', reason:'no_single_product'};
      codes = [...html.matchAll(/itemprop="(?:model|gtin13|gtin)"\s+content="(\d{8,14})"/g)].map(m => m[1]);
      prices = [...html.matchAll(/itemprop="price"\s+content="(\d{1,4}(?:\.\d{1,2})?)"/g)].map(m => Number(m[1]));
      const cur = html.match(/itemprop="priceCurrency"\s+content="([A-Z]{3})"/); if (cur && cur[1] !== 'EUR') return {status:'unavailable', reason:'currency'};
      if (/itemprop="availability"\s+href="https?:\/\/schema\.org\/(OutOfStock|Discontinued|SoldOut)"/.test(html)) available = false;
    } else {
      const nodes = []; const walk = x => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(walk);
        const t = [].concat(x['@type'] || []); if (t.includes('Product')) nodes.push(x); if (x['@graph']) walk(x['@graph']); };
      for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) { try { walk(JSON.parse(m[1])); } catch {} }
      if (nodes.length !== 1) return {status:'unavailable', reason:'no_single_product'};
      const n = nodes[0]; codes = ['gtin13','gtin','gtin14','gtin12','gtin8'].flatMap(k => [].concat(n[k] ?? [])).map(String);
      for (const o of [].concat(n.offers || [])) { if (o?.priceCurrency && o.priceCurrency !== 'EUR') continue; const v = Number(o?.price); if (Number.isFinite(v)) prices.push(v);
        if (/OutOfStock|Discontinued|SoldOut/.test(String(o?.availability || ''))) available = false; } // InStoreOnly: the shop's shelf price, still a price
    }
    if (!codes.length) return {status:'unavailable', reason:'no_barcode_on_page'};
    if (!codes.some(same)) return {status:'barcode_not_on_page'};
    const distinct = [...new Set(prices.filter(v => v > 0 && v < 1000).map(v => Math.round(v * 100)))];
    if (distinct.length !== 1) return {status:'unavailable', reason:distinct.length ? 'ambiguous_price' : 'no_price'};
    const date = fsPriceToday(now);
    return {status:'confirmed', offer:{price:distinct[0] / 100, date, ageDays:0, freshness:'current', fetchedAt:new Date(now).toISOString(), origin:'live',
      ...(available ? {} : {available:false, rankingEligible:false}), id:def.prefix + [date, def.chain, key].join(':')}};
  } catch { return {status:'unavailable'}; }
}
/** Seed offers for one barcode, plus what the payload needs to name the product and its real pack size. */
async function fsGrSeedOffers(request, env, code, now=Date.now()) {
  const key = fsPriceKey(code), out = {items:[], providers:{}, product:null, pack:null}, pending = [];
  for (const id of Object.keys(FS_GR_SOURCES)) {
    if (!fsGrEnabled(id, env)) { out.providers[id] = {status:'disabled', reason:'needs_permission', count:0}; continue; }
    const def = FS_GR_SOURCES[id], seed = await fsGrSeed(request, env, id, code);
    if (!seed) { out.providers[id] = {status:'unavailable', reason:'seed_missing', count:0}; continue; }
    let p = seed.products[key];
    if (typeof p === 'number') p = Array.isArray(seed.rows) ? seed.rows[p] || null : null; // 79: rows shared by the barcodes of one shop item
    const items = [];
    if (def.kind === 'retailer') {
      // One web-shop price per barcode: {n name, u product path, p price, o previous price, d date, f fetch time}. The barcode is the shop's own.
      const path = typeof p?.u === 'string' && /^\/[a-z0-9\-\/,.]+$/i.test(p.u) && !p.u.includes('..') ? p.u : null;
      const o = p ? fsGrOffer(def, code, def.chain, Number(p.p), fsPriceISO(p.d), Number(p.o) > Number(p.p), now) : null;
      if (o) items.push({...o, regularPrice:Number(p.o) > Number(p.p) ? Math.round(Number(p.o)*100)/100 : null, discountType:Number(p.o) > Number(p.p) ? 'SALE' : '',
        sourceURL:path ? def.url.replace(/\/$/, '') + path : def.url, evidenceURL:def.url, match:'barcode', productName:undefined,
        fetchedAt:fsPriceStamp(p.f || seed.source.fetched_at), origin:'seed',
        // 79: the pack the shop lists for its item (checked against the label in the payload), how many barcodes the shop puts on
        // that item, its stock flag and any offer condition. Weight/volume unit price as the shop prints it, when it has one.
        shopPack:fsPricePack(fsPriceText(p.q || p.n || '', 60)), shopBarcodes:Number(p.nb) > 1 ? Math.min(99, Number(p.nb)) : 1,
        ...(p.a === 'out_of_stock' ? {available:false, rankingEligible:false} : {}),
        // A multi-buy / gift offer on the item: the price shown is the plain single-item price, so it still ranks; the offer is noted.
        ...(typeof p.c === 'string' && p.c ? {extraOffer:fsPriceText(p.c, 40)} : {})});
      // 79: the live checks of the shops run in parallel (each at most 2.5 s); see fsGrLiveCheck / fsGrLiveHtml.
      const liveOn = def.live && items.length && path && env?.FS_SHOP_LIVE !== '0' && !(id === 'kritikos' && env?.FS_KRITIKOS_LIVE === '0');
      if (liveOn) { pending.push(fsGrLiveCheck(def, path, code, now).then(r => {
        if (r.status === 'confirmed') Object.assign(items[0], r.offer);
        else if (r.status === 'barcode_not_on_page' || r.status === 'gone') items.length = 0; // the shop no longer sells it under this barcode
        const pv = out.providers[id]; pv.live = r.status; if (r.status !== 'confirmed') pv.liveReason = r.reason || (r.http ? 'http_' + r.http : undefined);
        pv.count = items.length; pv.status = items.length ? 'ok_with_data' : 'ok_empty';
        out.items.push(...items);
      })); } else out.items.push(...items);
      out.providers[id] = {status:items.length?'ok_with_data':'ok_empty', snapshot:seed.source.snapshot, fetchedAt:fsPriceStamp(seed.source.fetched_at), count:items.length, source:new URL(def.url).hostname.replace(/^www\./,''), license:def.license};
      continue; // 78: the shop's product name is never used as the product identity
    }
    // Observatory links carry how the barcode was tied to the observatory product: 'h' reviewed by a person, 'a' automatic exact match.
    const match = id === 'posokanei' ? (p?.m === 'a' ? 'auto-exact' : 'reviewed') : 'barcode';
    if (id === 'posokanei' && p) out.linkMatch = match;
    if (p && Array.isArray(p.p)) for (const [chainId, price, date, sale] of p.p) {
      // posokanei flags a temporary discount; the e-katanalotis flag means a permanent reduction, i.e. the regular price.
      const o = fsGrOffer(def, code, chainId, Number(price), fsPriceISO(date), id === 'posokanei' && sale === 1, now);
      if (o) items.push({...o, match, evidenceURL:fsPriceSourceURL(seed.source.archive || seed.source.feed || '') || def.url, fetchedAt:fsPriceStamp(seed.source.fetched_at), origin:'seed'});
    }
    out.items.push(...items);
    out.providers[id] = {status:items.length?'ok_with_data':'ok_empty', snapshot:seed.source.snapshot, count:items.length, linked:id === 'posokanei' ? Boolean(p) : undefined, license:def.license};
    // 78: the observatory's pack size is kept ONLY to check the link against the validated label; it never sets the quantity.
    if (p && !out.pack && (p.u === 'kg' || p.u === 'l') && p.q > 0.005 && p.q <= 50) out.pack = {amount:Math.round(p.q*10000)/10000, unit:p.u, source:id};
  }
  const est = await fsEstimateFor(request, env, code).catch(() => null);
  if (est) { out.estimate = est.estimate; out.estimateMeta = est.meta; out.estimateName = est.name; }
  await Promise.all(pending);
  return out;
}
/** 78: truthful provider health. Every provider reports exactly one of:
 *  ok_with_data (answered, and at least one usable observation for this barcode), ok_empty (answered, nothing usable),
 *  unavailable (did not answer: network, HTTP error, rate limit, missing file) or disabled (not configured on this deployment). */
const FS_PROVIDER_STATES = ['ok_with_data','ok_empty','unavailable','disabled'];
function fsProvider(p, extra={}) {
  const status = FS_PROVIDER_STATES.includes(p?.status) ? p.status : 'unavailable';
  const {items, ...rest} = p || {};
  return {...rest, ...extra, status, ...(p?.status && p.status !== status ? {reason:p.reason || p.status} : {})};
}
/** Per-source licence and provenance, shown with every price. Only these sources can rank. */
const FS_PRICE_LICENSES = {
  'op:':'ODbL (Open Prices, Open Food Facts)',
  'pk:':FS_GR_SOURCES.posokanei.license, 'ek:':FS_GR_SOURCES.ekatanalotis.license,
  'bz:':FS_GR_SOURCES.bazaar.license, 'li:':FS_GR_SOURCES.lidl.license, 'kr:':FS_GR_SOURCES.kritikos.license,
};
const fsPriceLicenseOf = o => { const pre = String(o.id||'').slice(0,3); return pre === 'lf:' ? (o.sourceLicense || 'Licensed retailer feed') : (FS_PRICE_LICENSES[pre] || o.sourceLicense || ''); };
/** The whole answer, built from evidence only. Exported shape is shared with prices/price-core-v79.mjs. */
function fsPriceBuildPayload({code, scope, meta, open, licensed, official={items:[],providers:{},pack:null}, now=Date.now()}) {
  // D1 observatory rows carry no link method; the seed's link file says how this barcode was tied to the observatory product.
  const off = FS_GR_RETAILER_WEB.filter(id => official.providers?.[id]?.status === 'disabled').map(id => FS_GR_SOURCES[id].prefix);
  const lic = licensed.items.filter(o => !off.some(pre => String(o.id||'').startsWith(pre))) // 79: a disabled source never shows, even from D1
    .map(o => o.id?.startsWith('pk:') ? {...o, match:official.linkMatch || o.match} : o);
  const all = [...official.items, ...lic, ...open.items];
  // 78: product identity, quantity and grade come ONLY from the validated catalogue / Open Food Facts record.
  // Open Prices embeds the Open Food Facts product record, so it is accepted as a fallback and labelled as such.
  const sample = open.items.find(o => o.productName || o.productQuantity || o.productAmount) || {};
  const labelPack = fsPricePack(meta?.quantity || sample.productQuantity, meta?.productAmount ?? sample.productAmount, meta?.productAmountUnit || sample.productAmountUnit);
  // 79: the barcode identifies the item, the label size comes from a crowd-sourced record. When at least two independent shops
  // list THIS exact barcode (one barcode per shop item) with the same size and the label says otherwise, the label record is the
  // odd one out: the shops' size is used, and the response says so (packCheck.resolvedBy). One shop alone never overrides it.
  const differs = (a, b) => a.unit !== b.unit || Math.abs(a.amount - b.amount) / a.amount > 0.05;
  const shopPacks = []; for (const o of all) if (o.shopPack && o.shopBarcodes === 1 && o.market === 'GR') { const src = o.id.split(':')[0]; if (!shopPacks.some(x => x.src === src)) shopPacks.push({src, pack:o.shopPack}); }
  // 79: the observatory's own product record (linked by this barcode, reviewed or exact auto-match) is an independent second
  // source: one shop + the observatory agreeing on the size also outvote a crowd-sourced label (e.g. a 410 g cereal labelled 30 g).
  if (shopPacks.length && official.pack?.source === 'posokanei') shopPacks.push({src:'pk', pack:{amount:official.pack.amount, unit:official.pack.unit}});
  const agreed = shopPacks.length >= 2 && shopPacks.every(x => !differs(shopPacks[0].pack, x.pack)) ? shopPacks[0].pack : null;
  const resolvedBy = agreed && (!labelPack || differs(labelPack, agreed)) ? shopPacks.map(x => x.src) : null;
  const pack = resolvedBy ? {amount:agreed.amount, unit:agreed.unit} : labelPack;
  // The observatory links a barcode to its own product by name; if its pack size disagrees with the label, the link is
  // suspect: its prices are shown with a warning and never rank.
  const obsPack = official.pack || null;
  const packMismatch = Boolean(pack && obsPack && (pack.unit !== obsPack.unit || Math.abs(pack.amount - obsPack.amount) / pack.amount > 0.05));
  // 78: the observatory row is for a different pack than this barcode's label: keep it visible as evidence, never rank it,
  // and give its unit price for the pack actually observed (so it is never compared as if it were this product).
  const checkLink = o => {
    if (packMismatch && /^(?:pk|ek):/.test(o.id)) return {...o, rankingEligible:false, packMismatch:true, observedPack:{amount:obsPack.amount, unit:obsPack.unit}};
    // 79: a web-shop price is checked against the label too. The shop's own item size differs from this barcode's label (shops
    // list old/new or multipack barcodes on one item): "same product, other size", never ranked, unit price for the shop's size.
    if (o.shopPack && pack && differs(pack, o.shopPack)) return {...o, rankingEligible:false, packMismatch:true, observedPack:o.shopPack};
    // The shop puts several barcodes on this item and the size cannot be checked: shown, never ranked.
    if (o.shopBarcodes > 1 && !(o.shopPack && pack)) return {...o, rankingEligible:false, packUnconfirmed:true};
    return o;
  };
  // 79: every offer says which tier it is in; only 'current' can be the cheapest.
  const tierOf = o => o.rankingEligible ? 'current' : o.packMismatch ? 'otherSize' : o.packUnconfirmed ? 'packUnconfirmed' : o.available === false ? 'outOfStock'
    : o.freshness !== 'current' ? 'older' : 'notRanked';
  const greek = fsPriceDeduplicate(all.filter(o => o.market === 'GR').map(checkLink));
  const elsewhere = fsPriceDeduplicate(all.filter(o => o.market !== 'GR')).filter(o => o.freshness !== 'historical').sort((a,b)=>b.date.localeCompare(a.date)).slice(0, 12)
    .map(o => ({...o, rankingEligible:false}));
  const strip = o => { const {productName, productQuantity, productAmount, productAmountUnit, market, shopPack, ...rest} = o; return {...rest, tier:tierOf(o), sourceLicense:fsPriceLicenseOf(o), ...(o.packMismatch && o.observedPack ? fsPriceUnit(o, o.observedPack) : fsPriceUnit(o, pack))}; };
  const offers = greek.slice(0, 60).map(strip), others = elsewhere.map(strip);
  const eligible = offers.filter(o => o.rankingEligible);
  const best = eligible.slice().sort((a,b)=>a.price-b.price || b.date.localeCompare(a.date))[0] || null;
  const latest = offers.slice().sort((a,b)=>b.date.localeCompare(a.date))[0] || null;
  // 78: cheapest per chain, keeping every branch: each chain's cheapest current offer plus how many branches/sources it has.
  const perChain = {};
  for (const o of eligible) { if (!o.retailerId || o.retailerId === 'other') continue;
    const c = perChain[o.retailerId] || (perChain[o.retailerId] = {retailerId:o.retailerId, retailer:o.retailer, bestOfferId:o.id, storeId:o.storeId, price:o.price, observations:0, storeIds:[]});
    c.observations++; if (!c.storeIds.includes(o.storeId)) c.storeIds.push(o.storeId); if (o.price < c.price) Object.assign(c, {bestOfferId:o.id, storeId:o.storeId, price:o.price}); }
  const providers = {
    openPrices:fsProvider(open, {inspected:open.inspected||0, greek:open.items.filter(o=>o.market==='GR').length, elsewhere:open.items.filter(o=>o.market!=='GR').length, license:FS_PRICE_LICENSES['op:']}),
    liveDatabase:fsProvider(licensed, {count:licensed.items.length}),
    observatory:fsProvider(official.providers.posokanei, {source:'posokanei.gov.gr', d1:licensed.items.filter(o=>o.id.startsWith('pk:')).length, packMismatch}),
    ekatanalotis:fsProvider(official.providers.ekatanalotis, {source:'e-katanalotis.gov.gr', historical:true}),
    ...Object.fromEntries(FS_GR_RETAILER_WEB.map(id=>[id, fsProvider(official.providers[id], {d1:licensed.items.filter(o=>o.id.startsWith(FS_GR_SOURCES[id].prefix)).length})])),
  };
  const active = Object.values(providers).filter(p => p.status !== 'disabled');
  const down = active.filter(p => p.status === 'unavailable').length;
  // All providers down: the result is NOT available (never "no data"). Some down and nothing found: incomplete.
  // 80: an estimate is offered only when no recorded price of this exact barcode can lead the card (a current, older, not-ranked or out-of-stock one)
  const leadable = offers.some(o => ['current', 'older', 'notRanked', 'outOfStock'].includes(o.tier));
  // 81: no price is ever estimated. A range from "similar products" read as this product's price and was often far off
  // (EUR 5.40-22.33/kg). When this barcode has no recorded price, up to 3 CLOSE products (same-brand class A/B matches, >= 55 %
  // similar) are listed as `related`: each with its OWN recorded price, name, source and date, and never as this product's price.
  const near = !leadable ? (official.estimate || null) : null;
  const related = near && ['A', 'B'].includes(near.cls) ? (near.examples || []).filter(x => x && x.name && x.price > 0 && x.similarity >= 55).slice(0, 3) : [];
  const estimate = null;
  const status = offers.length || others.length ? 'observations_available' : !active.length || down === active.length ? 'temporarily_unavailable' : down ? 'incomplete' : 'no_data';
  return {
    version:FS_PRICE_VERSION, barcode:code, country:'GR', scope:scope.nearby?'nearby':'greece', checkedAt:new Date(now).toISOString(),
    status, transport:'pages_worker',
    product: meta ? {name:meta.name, brand:meta.brand, quantity:meta.quantity, nutriScore:meta.nutriScore, image:meta.image, source:meta.source} :
      (sample.productName ? {name:sample.productName, brand:'', quantity:sample.productQuantity||'', nutriScore:null, image:'', source:'open_food_facts_via_open_prices'} : null),
    productName: meta ? [meta.name, meta.brand && !meta.name.toLowerCase().includes(meta.brand.toLowerCase()) ? meta.brand : '', meta.quantity].filter(Boolean).join(' · ') : (sample.productName || official.estimateName || ''),
    pack, packCheck: obsPack || resolvedBy ? {label:labelPack, ...(obsPack ? {observatory:{amount:obsPack.amount, unit:obsPack.unit}, consistent:!packMismatch} : {}), ...(resolvedBy ? {resolvedBy, shops:{amount:agreed.amount, unit:agreed.unit}} : {})} : null,
    offers, elsewhere:others, estimate, related, data:official.estimateMeta || null, providers,
    providerSummary:{active:active.length, unavailable:down, disabled:Object.values(providers).length-active.length},
    summary:{bestOfferId:best?.id||null, lowestCurrentPrice:best?.price??null, currentOffers:eligible.length,
      retailers:new Set(eligible.map(o=>o.retailer)).size, stores:new Set(eligible.map(o=>o.storeId)).size, perChain:Object.values(perChain).sort((a,b)=>a.price-b.price),
      latestGreekOfferId:latest?.id||null, latestGreekDate:latest?.date||null,
      tiers:Object.fromEntries(['current','otherSize','packUnconfirmed','older','outOfStock','notRanked'].map(t => [t, offers.filter(o => o.tier === t).length]))},
    limitations:[
      `Only real, dated prices are shown, each with its own source and licence: the Ministry of Development price observatory (posokanei.gov.gr, national chain prices), e-katanalotis (history only), Open Prices (community receipts and shelf photos, ODbL), the chains' own web shops (${FS_GR_RETAILER_WEB.filter(id => official.providers?.[id]?.status !== 'disabled').map(id => new URL(FS_GR_SOURCES[id].url).hostname.replace(/^www\./, '')).join(', ')}) and licensed retailer feeds when configured. No price is ever estimated (81). When a barcode has no recorded price, "related" may list up to 3 close products (same brand, similar name and size) with THEIR OWN recorded price, source and date; they are never presented as this product's price.`,
      'Only observations from the last 7 days, with no expired promotion and a dated proof, can be "the cheapest". Older prices are still shown, as the last recorded price, with their age. Future-dated observations are rejected.',
      'The observatory publishes no barcodes. Its prices appear only for barcodes linked to its products by a reviewed link, an automatic exact match, or (81) a price-anchored match (a chain web shop and the observatory report the same chain\'s regular price to the cent, same brand and size, one product only); each price says which. If its pack size disagrees with the label, its prices never rank.',
      'Lidl prices can vary by region; lidl.gr shows its default (national) price. Web-shop prices are the shop\'s online price; shelf prices in stores may differ.',
      'A web-shop price is checked against the label size. If the shop sells this barcode as another size it is shown as "same product, other size" with its own unit price, and never ranks. Prices older than 7 days are shown as "older price" with their date and age.',
      'A store with no observation shows "Not available". Shelf prices change and offers expire: check the price in store or at checkout.',
    ],
  };
}
/** GET /api/prices/health: is the automatic price refresh working? Read-only. From D1 (cron Worker runs, crawl cursors, row
 *  counts, price changes) when bound; otherwise the dates of the bundled seed files. 'stale' when a source has not succeeded
 *  within its expected interval. */
const FS_PRICE_HEALTH_LIMITS = {posokanei:{hours:50, cadence:'daily'}, ekatanalotis:{hours:24*45, cadence:'when the ministry publishes (historical)'}, bazaar:{hours:12, cadence:'hourly slices'}, lidl:{hours:12, cadence:'hourly slices'},
  kritikos:{hours:24*8, cadence:'weekly off-Workers crawl (ingest/scripts/kritikos-seed.mjs) + one live product-page check per scan'}};
async function fsPriceHealthV79(request, env, now=Date.now()) {
  const out = {version:FS_PRICE_VERSION, release:VERSION, checkedAt:new Date(now).toISOString(), currentDays:FS_PRICE_CURRENT_DAYS, mode:'seed', sources:{}};
  for (const id of Object.keys(FS_GR_SOURCES)) {
    if (!fsGrEnabled(id, env)) { out.sources[id] = {label:FS_GR_SOURCES[id].source, state:'disabled', reason:`needs the shop's permission; set ${FS_GR_SOURCES[id].optIn}=1 only when granted`}; continue; }
    const seed = await fsGrSeed(request, env, id);
    out.sources[id] = {label:FS_GR_SOURCES[id].source, cadence:FS_PRICE_HEALTH_LIMITS[id]?.cadence || '', seed:seed ? {snapshot:seed.source.snapshot, fetchedAt:fsPriceStamp(seed.source.fetched_at), products:seed.sharded ? Number(seed.source.counts?.products) || 0 : Object.keys(seed.products).length,
      ageDays:fsPriceAge(seed.source.snapshot, now)} : null};
  }
  const db = env?.FOODSCAN_PRICES_DB;
  if (db) {
    try {
      const since7 = new Date(now - 7*86400000).toISOString();
      const [runs, okRuns, counts, crawl, changes, first] = await Promise.all([
        db.prepare('SELECT r.source_id, r.status, r.run_at, r.snapshot_date, r.rows FROM foodscan_price_ingest_runs r JOIN (SELECT source_id, MAX(run_at) m FROM foodscan_price_ingest_runs GROUP BY source_id) x ON x.source_id = r.source_id AND x.m = r.run_at').all(),
        db.prepare("SELECT source_id, MAX(run_at) last_ok FROM foodscan_price_ingest_runs WHERE status IN ('ok','cycle_done','unchanged') GROUP BY source_id").all(),
        db.prepare('SELECT source_id, COUNT(*) offers, COUNT(DISTINCT barcode) barcodes, MAX(observed_at) newest, MAX(updated_at) last_write FROM foodscan_price_offers GROUP BY source_id').all(),
        db.prepare('SELECT source_id, json_array_length(targets) targets, position, cycle, cycle_started_at, last_cycle_done_at, last_run_at, last_ok_at, last_status, pages_ok, pages_failed, consecutive_failures FROM foodscan_crawl_state').all().catch(() => ({results:[]})),
        db.prepare('SELECT source_id, COUNT(*) n FROM foodscan_price_changes WHERE detected_at >= ? GROUP BY source_id').bind(since7).all().catch(() => ({results:[]})),
        db.prepare('SELECT MIN(run_at) first_run FROM foodscan_price_ingest_runs').first().catch(() => null),
      ]);
      // a fresh deployment: sources that have not had their first scheduled run yet (daily ones wait up to 24 h) are 'awaiting_first_run', not failures
      const young = !first?.first_run || now - Date.parse(first.first_run) < 26*3600000;
      const by = (r, k='source_id') => Object.fromEntries((r?.results || []).map(x => [x[k], x]));
      const R = by(runs), O = by(okRuns), C = by(counts), S = by(crawl), X = by(changes);
      out.mode = 'live';
      for (const id of Object.keys(out.sources)) {
        if (out.sources[id].state === 'disabled') continue;
        const lastOk = O[id]?.last_ok || null, hours = lastOk ? (now - Date.parse(lastOk)) / 3600000 : null, lim = FS_PRICE_HEALTH_LIMITS[id]?.hours ?? 48;
        out.sources[id].live = {lastRun:R[id] ? {status:R[id].status, at:R[id].run_at, snapshot:R[id].snapshot_date, rows:R[id].rows} : null, lastOk,
          hoursSinceOk:hours === null ? null : Math.round(hours*10)/10, offers:C[id]?.offers || 0, barcodes:C[id]?.barcodes || 0, newestObservation:C[id]?.newest || null, lastWrite:C[id]?.last_write || null,
          crawl:S[id] ? {targets:S[id].targets, position:S[id].position, cycle:S[id].cycle, progress:S[id].targets ? Math.round(1000*S[id].position/S[id].targets)/10 : null,
            lastCycleDoneAt:S[id].last_cycle_done_at, lastStatus:S[id].last_status, consecutiveFailures:S[id].consecutive_failures} : null,
          priceChanges7d:X[id]?.n || 0};
        out.sources[id].state = !lastOk ? (R[id] ? 'failing' : young ? 'awaiting_first_run' : 'never_ran') : hours > lim ? 'stale' : (S[id]?.consecutive_failures || 0) >= 3 ? 'failing' : 'ok';
      }
    } catch { out.mode = 'seed'; out.database = 'not_ready'; }
  }
  if (out.mode === 'seed') for (const id of Object.keys(out.sources)) {
    if (out.sources[id].state === 'disabled') continue;
    const s = out.sources[id].seed; out.sources[id].state = !s ? 'missing' : s.ageDays <= FS_PRICE_CURRENT_DAYS ? 'seed_current' : 'seed_older';
  }
  for (const id of Object.keys(out.sources)) out.sources[id].license = FS_GR_SOURCES[id]?.license || null; // 78: per-source licence, never a blanket ODbL
  out.openPrices = {checked:'per request (public API)', license:FS_PRICE_LICENSES['op:']};
  const states = Object.values(out.sources).map(s => s.state).filter(s => s !== 'disabled');
  out.status = states.every(s => s === 'ok') ? 'ok' : out.mode === 'live' ? (states.every(s => s === 'ok' || s === 'awaiting_first_run') ? 'starting' : states.some(s => s === 'ok') ? 'degraded' : 'down') : 'seed_only';
  out.note = out.mode === 'live' ? 'Live: prices are refreshed by the foodscan-price-ingest cron Worker and read from D1 on every request.'
    : 'No live database is bound: prices come from the bundled seed files (dated). Run scripts/deploy-prices.sh to switch on automatic refresh.';
  return fsPriceJson(out, out.status === 'down' ? 503 : 200);
}
/* ===== FoodScan 80: labelled estimates + live data refresh =====
 * 1. ESTIMATES. /assets/gr-est-v80/e-NN.json (64 files by barcode) holds, only for barcodes that have NO recorded price, an estimate
 *    from comparable products with a recorded price. It is returned as `estimate`, a separate object: never an offer, never ranked.
 *    Its range is the measured error of the method (leave-one-out, checked on held-out data); see manifest.json in the same folder.
 * 2. REFRESH WITHOUT REDEPLOYING. The daily refresh job (.github/workflows/refresh-prices.yml) publishes newer copies of the seed
 *    files (seeds/*.json) and the estimate shards to the `prices-data` branch. When FS_V80_REMOTE (or FOODSCAN_PRICE_DATA_URL) is
 *    reachable, the NEWER of the bundled and the remote copy is used; a missing, older, invalid or unreachable remote copy is ignored.
 *    FOODSCAN_PRICE_DATA_URL=off switches it off. Every observation keeps its own date. */
const FS_V80_REMOTE = 'https://raw.githubusercontent.com/douphealth/foodscan/prices-data';
const FS_V80_TTL = 30 * 60 * 1000;
const FS_EST_ROOT = '/assets/gr-est-v80/';
const FS_EST_SHARDS = 64;
const fsV80Base = env => { const v = env?.FOODSCAN_PRICE_DATA_URL; if (v === 'off') return ''; return typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v) ? v.replace(/\/+$/, '') : FS_V80_REMOTE; };
const fsV80Cache = new Map();
function fsV80Cached(key, load) {
  const hit = fsV80Cache.get(key);
  if (hit && Date.now() - hit.at < FS_V80_TTL) return hit.task;
  const task = load(); const entry = {at:Date.now(), task}; fsV80Cache.set(key, entry);
  task.catch(() => { if (fsV80Cache.get(key) === entry) fsV80Cache.delete(key); });
  if (fsV80Cache.size > 200) for (const [k, v] of fsV80Cache) { if (Date.now() - v.at > FS_V80_TTL) fsV80Cache.delete(k); }
  return task;
}
/** Bundled copy and (optionally) remote copy, in parallel; the newer by `stamp` wins. */
async function fsV80Read(request, env, bundledPath, remoteName, validate, stamp, accept = () => true) {
  const own = async () => {
    const res = await env.ASSETS.fetch(new Request(new URL(bundledPath, request.url)));
    if (!res.ok) throw new Error('missing');
    const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) throw new Error('too_large');
    const data = JSON.parse(raw); if (!validate(data)) throw new Error('invalid'); return data;
  };
  const remote = async () => {
    const base = fsV80Base(env); if (!base) return null;
    const res = await fetch(base + '/' + remoteName, {signal:AbortSignal.timeout(1500), headers:{'Accept':'application/json'}, cf:{cacheEverything:true, cacheTtlByStatus:{'200-299':1800, '404':60, '500-599':0}}});
    if (!res.ok) return null;
    const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) return null;
    const data = JSON.parse(raw); return validate(data) ? data : null;
  };
  const [a, b] = await Promise.all([own().catch(() => null), remote().catch(() => null)]);
  if (!a && !b) throw new Error('unavailable');
  if (a && b) return (stamp(b) || 0) > (stamp(a) || 0) && accept(b, a) ? Object.assign(b, {origin:'remote'}) : Object.assign(a, {origin:'bundled'});
  return b ? Object.assign(b, {origin:'remote'}) : Object.assign(a, {origin:'bundled'});
}
const fsEstShardId = code => String(Number(String(code).padStart(14, '0').slice(-6)) % FS_EST_SHARDS).padStart(2, '0');
const fsEstShard = (request, env, code) => fsV80Cached(new URL(request.url).origin + '|e-' + fsEstShardId(code), () =>
  fsV80Read(request, env, FS_EST_ROOT + 'e-' + fsEstShardId(code) + '.json', 'e-' + fsEstShardId(code) + '.json', d => d && d.v === 80 && d.items && typeof d.items === 'object', d => Date.parse(d.built)));
const fsEstManifest = (request, env) => fsV80Cached(new URL(request.url).origin + '|e-manifest', () =>
  fsV80Read(request, env, FS_EST_ROOT + 'manifest.json', 'manifest.json', d => d && d.version === 80 && d.estimator, d => Date.parse(d.built)));
/** Estimate record from a shard -> the payload object (checked again by the client). */
function fsEstObject(e, manifest) {
  if (!e || typeof e !== 'object' || !['kg', 'l', 'pcs'].includes(e.u) || !(e.m > 0) || !(e.a > 0) || !(e.b >= e.m) || !['A', 'B', 'C', 'D', 'E'].includes(e.c)) return null;
  const cal = manifest?.estimator?.classes?.[e.c];
  const label = s => /^pk\d+$/.test(s) ? 'Παρατηρητήριο Τιμών' : s === 'bz' ? 'bazaar-online.gr' : s === 'li' ? 'lidl.gr' : '';
  return {
    unit:e.u, unitLow:e.a, unitMid:e.m, unitHigh:e.b, pack:Array.isArray(e.p) && e.p.length === 3 ? e.p : null, n:e.n, cls:e.c, category:fsPriceText(e.g || '', 60),
    examples:(Array.isArray(e.x) ? e.x : []).slice(0, 3).map(x => ({name:fsPriceText(x[0], 90), price:Number(x[1]), source:label(String(x[2])), date:fsPriceISO(x[3]), similarity:Number(x[4]) || 0})),
    validation:cal && cal.usable ? {medianErrorPct:cal.medianAbsPctError, coverage80:manifest.estimator?.holdout?.[e.c]?.coverage80 ?? null, tested:cal.n} : null,
    builtAt:fsPriceISO(String(manifest?.built || '')),
  };
}
async function fsEstimateFor(request, env, code) {
  const [shard, manifest] = await Promise.all([fsEstShard(request, env, code), fsEstManifest(request, env).catch(() => null)]);
  const e = shard.items[fsPriceKey(code)]; if (!e?.e) return null;
  const estimate = fsEstObject(e.e, manifest); if (!estimate) return null;
  return {estimate, name:fsPriceText(e.n || '', 120), meta:{builtAt:manifest?.built || shard.built || null, origin:shard.origin || 'bundled'}};
}
/** The four source seeds (observatory, e-katanalotis, Bazaar, Lidl) are SHARDED (see tools/lib/shard-seeds.mjs): the manifest is ~2 KB, a
 *  lookup reads one ~9 KB shard per source. That is ~1 ms of parsing instead of ~18 ms for the monolithic files, which is more than the
 *  Workers Free plan's ~10 ms CPU budget on a cold start. This loads the MANIFEST: the bundled one, or a NEWER remote one that kept at
 *  least 90 % of the bundled products (a truncated crawl never replaces a good file). A monolithic remote file still works (older job). */
function fsGrSeedLegacy(request, env, id) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return Promise.resolve(null);
  return fsV80Cached(new URL(request.url).origin + '|seed|' + id, async () => {
    const valid = d => [1, 2].includes(d?.schema) && d.products && typeof d.products === 'object' && fsPriceISO(d.source?.snapshot);
    const count = d => d.sharded ? Number(d.source?.counts?.products) || 0 : Object.keys(d.products).length;
    const stamp = d => Date.parse(d.source?.fetched_at || d.source?.snapshot) || 0;
    const own = async () => {
      const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + def.file, request.url)));
      if (!res.ok) throw new Error('seed_missing');
      const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) throw new Error('seed_too_large');
      const data = JSON.parse(raw); if (!valid(data)) throw new Error('seed_invalid'); return data;
    };
    const remote = async () => {
      const base = fsV80Base(env); if (!base) return null;
      const res = await fetch(base + '/seeds/' + def.file, {signal:AbortSignal.timeout(1500), headers:{'Accept':'application/json'}, cf:{cacheEverything:true, cacheTtlByStatus:{'200-299':1800, '404':60, '500-599':0}}});
      if (!res.ok) return null;
      const raw = await res.text(); if (raw.length > 4 * 1024 * 1024) return null;
      const data = JSON.parse(raw); return valid(data) ? data : null;
    };
    const [a, b] = await Promise.all([own().catch(() => null), remote().catch(() => null)]);
    if (!a && !b) throw new Error('unavailable');
    if (a && b && stamp(b) > stamp(a) && count(b) >= count(a) * 0.9) return {...b, origin:'remote', alt:a};
    return a ? {...a, origin:'bundled'} : {...b, origin:'remote'};
  }).catch(() => null);
}
/** One source's seed for one barcode: the manifest merged with that barcode's shard (bundled, or remote when the remote manifest won;
 *  if the remote shard cannot be read the consistent bundled set is used instead). With no code (health) the manifest alone. */
async function fsGrSeed(request, env, id, code=null) {
  const def = FS_GR_SOURCES[id]; if (!def || !env?.ASSETS) return null;
  try {
    let man = await fsGrSeedLegacy(request, env, id); if (!man) return null;
    if (!man.sharded || code === null) return man;
    const origin = new URL(request.url).origin, shardId = fsPriceKey(code).slice(-2);
    const read = m => {
      const dir = /^[a-z0-9-]+\/$/.test(m.sharded) ? m.sharded : null; if (!dir) return Promise.resolve(null);
      const name = dir + shardId + '.json', ok = d => d?.schema === 2 && d.products && Array.isArray(d.rows) && d.source?.snapshot === m.source.snapshot;
      return fsV80Cached(origin + '|seedshard|' + id + '|' + m.origin + '|' + m.source.snapshot + '|' + shardId, async () => {
        if (m.origin === 'remote') {
          const res = await fetch(fsV80Base(env) + '/seeds/' + name, {signal:AbortSignal.timeout(1500), headers:{'Accept':'application/json'}, cf:{cacheEverything:true, cacheTtlByStatus:{'200-299':1800, '404':60, '500-599':0}}});
          if (!res.ok) throw new Error('remote_shard');
          const raw = await res.text(); if (raw.length > 1024 * 1024) throw new Error('shard_too_large');
          const d = JSON.parse(raw); if (!ok(d)) throw new Error('seed_invalid'); return d;
        }
        const res = await env.ASSETS.fetch(new Request(new URL(FS_GR_SEED_ROOT + name, request.url)));
        if (res.status === 404) return {products:{}, rows:[]};
        if (!res.ok) throw new Error('seed_missing');
        const raw = await res.text(); if (raw.length > 1024 * 1024) throw new Error('shard_too_large');
        const d = JSON.parse(raw); if (!ok(d)) throw new Error('seed_invalid'); return d;
      }).catch(() => null);
    };
    let part = await read(man);
    if (!part && man.origin === 'remote' && man.alt?.sharded) { man = {...man.alt, origin:'bundled'}; part = await read(man); }
    if (!part) return null;
    return {...man, products:part.products, rows:part.rows};
  } catch { return null; }
}
/** GET /api/prices/health: the v79 report plus the estimator and the data origin. */
async function fsPriceHealth(request, env, now=Date.now()) {
  const res = await fsPriceHealthV79(request, env, now); let body; try { body = await res.clone().json(); } catch { return res; }
  try {
    const m = await fsEstManifest(request, env);
    body.estimator = {builtAt:m.built, origin:m.origin || 'bundled', referenceItems:m.estimator?.referenceItems || 0, estimates:m.withEstimate || 0, byClass:m.estimatesByClass || {}, validation:m.estimator?.classes || null, holdout:m.estimator?.holdout || null};
  } catch { body.estimator = null; }
  body.remote = {url:fsV80Base(env) || null, note:'The newer of the bundled and the remote copy is used for the seed files and the estimates.'};
  return fsPriceJson(body, res.status);
}
/* ===== end FoodScan 80 ===== */

async function fsPricesRoute(request,env,ctx) {
  const url=new URL(request.url);
  const publicPath=url.pathname.startsWith('/prices/service/') ? url.pathname.slice('/prices/service/'.length) :
    url.pathname.startsWith('/api/prices/') ? url.pathname.slice('/api/prices/'.length) : null;
  if(publicPath===null)return null;
  if(!fsPriceSameOrigin(request))return fsPriceJson({error:'origin_not_allowed'},403);
  if(url.pathname==='/api/prices/admin/import')return fsPriceAdminImport(request,env);
  const canPost=publicPath==='compare';
  if(!['GET','HEAD',...(canPost?['POST']:[])].includes(request.method))return fsPriceJson({error:'method_not_allowed'},405,{Allow:canPost?'GET, HEAD, POST':'GET, HEAD'});
  if(request.method==='HEAD')return new Response(null,{status:200,headers:{'Cache-Control':'no-store','X-FoodScan-Version':FS_PRICE_VERSION}});
  if(publicPath==='health')return fsPriceHealth(request,env);
  if(publicPath==='status'){
    let probe='not_run';
    if(url.searchParams.get('probe')==='1'){
      try{const r=await fetch('https://prices.openfoodfacts.org/api/v1/status',{headers:{'Accept':'application/json','User-Agent':`FoodScan/${FS_PRICE_VERSION} (https://food-scan.gearuptofit.com)`},signal:AbortSignal.timeout(4000)});probe=r.ok?'responding':'http_'+r.status;}
      catch{probe='network_unavailable';}
    }
    return fsPriceJson({version:FS_PRICE_VERSION,route:'ready',endpoint:url.pathname,serverSideProxy:true,sources:{openPrices:'public_api',licensedFeeds:env?.FOODSCAN_PRICES_DB?'configured':'not_configured',observatory:'seed+d1',ekatanalotis:'seed_historical',retailerWeb:'seed+d1 (bazaar-online.gr, lidl.gr, kritikos-sm.gr + live product-page check)'},health:'/api/prices/health',probe,
      policy:'evidence_only: no estimated, benchmark or multiplier prices; missing prices are reported as not available',currentDays:FS_PRICE_CURRENT_DAYS,
      sourceLicenses:{openPrices:FS_PRICE_LICENSES['op:'],observatory:FS_GR_SOURCES.posokanei.license,ekatanalotis:FS_GR_SOURCES.ekatanalotis.license,bazaar:FS_GR_SOURCES.bazaar.license,lidl:FS_GR_SOURCES.lidl.license,kritikos:FS_GR_SOURCES.kritikos.license,licensedFeeds:'per feed (license_ref on every row)'}});
  }
  if(publicPath!=='compare')return fsPriceJson({error:'not_found'},404);
  const code=url.searchParams.get('barcode')||'',scope=fsPriceScope(url);
  if(!fsPriceValidBarcode(code)||!scope)return fsPriceJson({error:'invalid_query',message:'Provide a valid 8/12/13/14-digit GTIN and optional Greek latitude, longitude and radius (1–50 km).'},400);
  const cache = typeof caches!=='undefined' ? caches.default : null;
  const cacheURL=new URL(url.origin+'/prices/cache/v'+FS_PRICE_VERSION+'/'+fsPriceKey(code));
  if(scope.nearby){cacheURL.searchParams.set('lat',String(scope.lat));cacheURL.searchParams.set('lon',String(scope.lon));cacheURL.searchParams.set('r',String(scope.radius));}
  const cacheKey=new Request(cacheURL.toString());
  // 78: ?fresh=1 (sent on a rescan or "Try again") skips the edge copy and asks every source again.
  const forceFresh=url.searchParams.get('fresh')==='1';
  if(cache&&!forceFresh){try{const cached=await cache.match(cacheKey);if(cached)return cached;}catch{}}
  if(!fsPriceCanFetch(request.headers.get('CF-Connecting-IP')||'unknown'))return fsPriceJson({error:'rate_limited',message:'Please retry shortly.'},429,{'Retry-After':'60'});
  const [meta, open, licensed, official] = await Promise.all([
    fsPriceLocalCatalogueMeta(request, env, code).catch(()=>null),
    fsPriceOpenOffers(code, scope, env, request),
    fsPriceLicensedOffers(env, code, scope),
    fsGrSeedOffers(request, env, code).catch(()=>({items:[],providers:{},product:null,pack:null})),
  ]);
  const payload = fsPriceBuildPayload({code, scope, meta, open, licensed, official});
  // 78: an answer with any provider down is never cached (the next scan asks again). Complete answers are kept 10 minutes.
  const ttl = payload.providerSummary.unavailable === 0 && payload.status !== 'temporarily_unavailable' ? 600 : 0;
  const output=fsPriceJson(payload,200,{'Cache-Control':ttl?`public, max-age=0, s-maxage=${ttl}`:'no-store','X-Price-Cache-TTL':String(ttl)});
  if(cache&&ttl){try{const copy=output.clone();const cacheable=new Response(copy.body,{status:200,headers:{...Object.fromEntries(copy.headers),'Cache-Control':`public, max-age=${ttl}`}});ctx?.waitUntil?.(cache.put(cacheKey,cacheable).catch(()=>{}));}catch{}}
  return output;
}

/* END FOODSCAN PRICES 72 */
var worker_default = {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    try {
      // v55: preserve v52 scanner, with isolated opt-in catalog and growth routes.
      const growthResponse = await fs54Route(request, env, ctx);
      if (growthResponse) return growthResponse;
      const catalogResponse = await fscPublicRoute(request, env, ctx);
      if (catalogResponse) return catalogResponse;
      if (url.href.length > 4096) return error("request_too_long", "The request URL is too long.", 414);
      // Handle both paths before the non-/api static asset branch.
      // Older custom-domain Workers may still intercept /api/*; /prices/service/*
      // is served by this Pages Worker on the same origin, without browser CORS.
      if (url.pathname === '/ingest' || url.pathname.startsWith('/ingest/')) return new Response('Not found', {status:404, headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
      const priceResponse = await fsPricesRoute(request, env, ctx);
      if (priceResponse) return priceResponse;
      const page = url.pathname.match(/^\/p\/(\d{8,14})\/?$/);
      if (page) {
        if (!["GET", "HEAD"].includes(request.method)) return error("method_not_allowed", "Use GET or HEAD.", 405, {}, { Allow: "GET, HEAD" });
        if (!validBarcode2(page[1])) return Response.redirect(`${url.origin}/`, 302);
        const canon = canonicalCode(page[1]);
        if (canon) return Response.redirect(`${url.origin}/p/${canon}${url.search}`, 301);
        if (request.method === "HEAD") return new Response(null, { headers: pageHeaders(url, { "X-Robots-Tag": "noindex, follow" }) });
        return await productPage(request, env, ctx, page[1]);
      }
      const pair = url.pathname.match(/^\/compare\/(\d{8,14})\/(\d{8,14})\/?$/);
      if (pair) {
        if (!["GET", "HEAD"].includes(request.method)) return error("method_not_allowed", "Use GET or HEAD.", 405, {}, { Allow: "GET, HEAD" });
        if (!validBarcode2(pair[1]) || !validBarcode2(pair[2])) return Response.redirect(`${url.origin}/`, 302);
        const [a, b] = [canonicalCode(pair[1]) || pair[1], canonicalCode(pair[2]) || pair[2]];
        if (`/compare/${a}/${b}` !== url.pathname) return Response.redirect(`${url.origin}/compare/${a}/${b}${url.search}`, 301);
        if (request.method === "HEAD") return new Response(null, { headers: pageHeaders(url, { "X-Robots-Tag": "noindex, follow" }) });
        return await comparePage(request, env, ctx, a, b);
      }
      if (!url.pathname.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(request.method)) return error("method_not_allowed", "Use GET or HEAD.", 405, {}, { Allow: "GET, HEAD" });
        const docs = /* @__PURE__ */ new Set(["/", "/index.html", "/demo/", "/how/", "/demo/index.html", "/how/index.html", "/robots.txt", "/sitemap.xml", "/sitemap-pages.xml", "/sitemap-products.xml", "/llms.txt", "/manifest.webmanifest"]);
        if (["/demo", "/how"].includes(url.pathname)) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 308);
        if (["/index.html", "/demo/index.html", "/how/index.html"].includes(url.pathname)) return Response.redirect(`${url.origin}${url.pathname.replace("index.html", "")}${url.search}`, 308);
        const out = docs.has(url.pathname) ? await siteDocument(request, env) : await env.ASSETS.fetch(request);
        return request.method === "HEAD" ? new Response(null, { status: out.status, headers: out.headers }) : out;
      }
      if (request.headers.get("Sec-Fetch-Site") === "cross-site" || request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return error("origin_not_allowed", "Use this API from the FoodScan site.", 403);
      
      if (url.pathname === "/api/sync") return await fs63Sync(request, env);

      if (url.pathname === "/api/events") return await collectEvent(request, env);
      if (!["GET", "HEAD"].includes(request.method)) return error("method_not_allowed", "Only GET requests are supported.", 405, {}, { Allow: "GET, HEAD" });
      if (request.method === "HEAD") return new Response(null, { status: 200, headers: { "Cache-Control": "no-store", "X-FoodScan-Version": VERSION, "Content-Type": "application/json; charset=utf-8" } });
      if (url.pathname === "/api/health") {
        let catalogue=null;try{const m=await fs60Manifest(request,env);catalogue={status:"ready",country:"greece",products:m.productCount,exportedAt:m.exportedAt,source:m.source,coverage:m.coverage,routingSchema:2,categoryFiles:Object.keys(m.shards).length,sourceAgeDays:Math.floor((Date.now()-m.exportedAt)/86400000)};}catch{catalogue={status:"unavailable"};}
        const deep = url.searchParams.get("deep") === "1" ? await deepHealth(request, env) : null;
        const d1 = idxEnabled(env);
        return json({
          app: "FoodScan",
          catalogue,
          version: VERSION,
          build: BUILD,
          backend: "ready",
          upstream: deep ? deep.status : "not-checked",
          checks: deep?.checks,
          checkedAt: deep?.checkedAt,
          index: deep?.index || { bound: Boolean(env.FOOD_DB), enabled: d1, mode: d1 ? "index-first" : "legacy" },
          contactConfigured: Boolean(env.CONTACT_EMAIL),
          analyticsConfigured: Boolean(env.ANALYTICS),
          publicCatalog: { enabled: FSC_ENABLED(env), bound: Boolean(env.FOODSCAN_PUBLIC_DB), autoIngest: FSC_AUTO_ENABLED(env), queueBound: Boolean(env.FOODSCAN_INGEST_QUEUE), votingReady: Boolean(env.FOODSCAN_TURNSTILE_SECRET&&env.FOODSCAN_TURNSTILE_SITE_KEY), publication: 'manual_approval_required' },
          country: request.cf?.country || null,
          prices: { version: FS_PRICE_VERSION, openPrices: "public-api", licensedFeed: Boolean(env.FOODSCAN_PRICES_DB), adminImportConfigured: Boolean(env.FOODSCAN_PRICES_DB && env.FOODSCAN_PRICES_ADMIN_TOKEN) },
          source: ORIGIN,
          search: d1 ? "d1-fts5+live-fallback" : "index+off-search",
          recovery: d1 ? "edge-cache+d1-snapshots+saved-records+browser-read" : "edge-stale-and-saved-records+browser-read",
          serverDeadlineMs: DEADLINE_MS,
          features: ["isolated-catalogue-file-recovery", "compact-catalogue-routing", "missing-category-recovery", "same-use-comparison-guards", "complete-batch-record-reuse", "bounded-preview-enrichment", "shared-grade-decision-v59", "verified-alternatives-before-render", "country-filtered-paginated-discovery", "accurate-percentage-bars", ...FSC_ENABLED(env) ? ['approved-public-products', 'branded-social-png', 'privacy-first-battles', 'seven-discovery-challenge', 'catalog-sitemap-v2', 'queue-producer'] : [], "share-funnel-v2", "compare-pages", "server-rendered-reports", "product-sitemap", "durable-index-v5", "conflicting-grade-withholding", "negative-nutrition-guard", "verified-2023-points", "localized-ingredient-evidence", "confirmed-missing-backoff", "shared-upstream-cooldown", "price-comparison-evidence-v67", "licensed-price-feed-import-optional", "browser-product-fallback", "catalogue-live-fallback", "stale-catalogue-refresh", "cheap-head"],
          requestBudgets: { scope: d1 ? "D1-atomic" : "worker-instance", productPerMinute: d1 ? 10 : PRODUCT_MINUTE, searchPerMinute: d1 ? 7 : SEARCH_MINUTE, searchIndexPerMinute: d1 ? 7 : INDEX_MINUTE, globallyCoordinated: d1, overflow: "browser reads the product directly from Open Food Facts" },
          notes: [d1 ? "Index-first mode: the catalogue answers first; empty answers fall back to the live search unless FOODSCAN_REQUIRE_INDEX=1." : "The bundled Greek catalogue works without D1. Live lookup is used only when needed or explicitly requested.", "Open Food Facts records are community-reported and may be incomplete.", ...!env.CONTACT_EMAIL ? ["Set CONTACT_EMAIL to identify this app to Open Food Facts."] : []]
        });
      }
      if (url.pathname === "/api/alternatives") return await fs60LocalAlternatives(request,env) || await idxAlternatives(request, env, ctx);
      if (url.pathname === "/api/search") return await idxSearch(request, env, ctx);
      const match = url.pathname.match(/^\/api\/product\/(\d+)$/);
      if (!match) return error("route_not_found", "Unknown API route.", 404);
      if (!validBarcode2(match[1])) return error("invalid_barcode", "The barcode length or check digit is invalid.", 400);
      const productResult = (url.searchParams.get("refresh")!=="1" ? await fs60LocalProduct(request,env,match[1]) : null) || await productResponse(request, env, ctx, match[1]);
      if (FSC_AUTO_ENABLED(env) && productResult.status === 200 && typeof ctx?.waitUntil === 'function')
        ctx.waitUntil(fscIngestFromScan(productResult.clone(),env));
      return productResult;
    } catch (e) {
      console.error(JSON.stringify({ app: "FoodScan", version: VERSION, error: "worker_failure", message: String(e?.message || "").slice(0, 120) }));
      return error("server_error", "The request could not be completed. Saved foods still work.", 503, {}, { "Retry-After": "30" });
    }
  }
};
async function productResponse(request, env, ctx, code) {
  const required = idxRequiredError(env);
  if (required) return required;
  const url = new URL(request.url), cache = globalThis.caches?.default;
  const country = request.cf?.country || "", canonicalCode2 = code.length === 12 ? `0${code}` : code;
  const key = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/product/${code.padStart(14, "0")}`), staleKey = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/stale/product/${code.padStart(14, "0")}`);
  const cronMode = ctx?.foodscanCronRefresh === true && env?.FOODSCAN_CRON_EXECUTION === "1";
  if (cache && !cronMode) {
    try {
      const hit2 = await cache.match(key);
      if (hit2?.status === 200) return withCache(hit2, "HIT", { "X-FoodScan-Country": country });
    } catch {
    }
  }
  const pending = inflight.get(key.url);
  if (pending && !cronMode) {
    const out = (await pending).clone();
    return withCache(out, out.headers.get("X-FoodScan-Cache") === "STALE" ? "STALE" : "COALESCED", { "X-FoodScan-Country": country });
  }
  if (inflight.size >= MAX_PENDING) return error("local_rate_limited", "Too many lookups are in progress.", 429, { retryAfter: 10 }, { "Retry-After": "10" });
  const later = (work) => ctx?.waitUntil ? ctx.waitUntil(work) : work;
  const job = (async () => {
    const indexed = await idxGetProduct(env, code);
    if (indexed?.error && idxRequired(env)) return await staleCopy(cache, staleKey) || error("index_unavailable", "The indexed catalogue is temporarily unavailable. Saved foods still work.", 503, {}, { "Retry-After": "30" });
    if (indexed && !indexed.error && !indexed.stale) {
      idxRefreshStale(request, env, ctx, code, indexed.verifiedAt);
      if (!cronMode) await later(remember(cache, ctx, key, staleKey, indexed.response, 180));
      return indexed.response;
    }
    if (!indexed && await idxIsNegative(env, code)) return error("not_found", "The indexed source does not have this barcode yet.", 404);
    const result = await fetchProduct(request, env, canonicalCode2);
    if (result.status === 200) {
      if (idxEnabled(env)) await later(idxSaveProduct(env, result, code));
      await remember(cache, ctx, key, staleKey, result, idxEnabled(env) ? 180 : FRESH.product);
    } else if (result.status === 404 && idxEnabled(env)) {
      try {
        const detail = await result.clone().json();
        if (detail?.error?.code === "not_found") await later(idxMarkNegative(env, code));
      } catch {
      }
    } else if (![400, 403, 404].includes(result.status)) {
      if (indexed?.response) return indexed.response;
      const stale = await staleCopy(cache, staleKey);
      if (stale) return stale;
    }
    return withCache(result, "MISS");
  })();
  if (!cronMode) inflight.set(key.url, job);
  try {
    const out = (await job).clone();
    return withCache(out, out.headers.get("X-FoodScan-Cache") || "MISS", { "X-FoodScan-Country": country });
  } finally {
    if (!cronMode) inflight.delete(key.url);
  }
}
var CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob: https://images.openfoodfacts.org https://static.openfoodfacts.org; media-src 'self' blob:; connect-src 'self' https://world.openfoodfacts.org; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'".startsWith("__") ? "default-src 'self'" : "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob: https://images.openfoodfacts.org https://static.openfoodfacts.org; media-src 'self' blob:; connect-src 'self' https://world.openfoodfacts.org; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
var escapeHTML = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var plain = (v, n = 140) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
function pageHeaders(url, extra = {}) {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
    "Cache-Control": "no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "X-FoodScan-Version": VERSION,
    ...extra
  };
}
var GUIDES = '<p class="boot__more"><a href="https://gearuptofit.com/nutrition/free-food-scanner-app/">Free Food Scanner App Guide</a> · <a href="https://gearuptofit.com/nutrition/is-nutella-healthy/">Is Nutella Healthy?</a> · <a href="https://gearuptofit.com/">GearUpToFit.com</a></p>';
var num = (v) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: v < 1 ? 2 : 1 }).format(v);
var parsed = (raw, code) => raw ? parseProduct({ status: 1, product: raw, fetchedAt: Date.now() }, code) : null;
var per = (p) => p?.basis === "ml" ? "100 ml" : "100 g";
var ROWS = [["kcal", "Energy", "kcal"], ["fat", "Fat", "g"], ["saturatedFat", "Saturated fat", "g"], ["carbohydrates", "Carbohydrate", "g"], ["sugars", "Sugars", "g"], ["fiber", "Fibre", "g"], ["protein", "Protein", "g"], ["salt", "Salt", "g"]];
function gradeSentence(p, a) {
  if (a.status === "withheld") return `Grade on hold: the record contradicts itself (${a.reasons.join(" ").replace(/\.$/, "")}). FoodScan does not repeat a grade built on impossible values.`;
  if (a.status === "estimated" && a.reproducedSourceGrade) return `FoodScan independently reproduced Nutri-Score ${a.grade} using the 2023 calculation from the source values. The source grade did not identify its version. This is a calculated estimate, not a physical-package verification.`;
  if (a.status === "estimated") return `No grade is published for this record. FoodScan calculated Nutri-Score ${a.grade} from the label values with the official 2023 method; this is an estimate, labelled as such in the app.`;
  if (a.grade) return `Nutri-Score ${a.grade}, as reported by Open Food Facts${a.method === "2023" ? " (2023 calculation, points checked)" : " (the record does not show which method produced it)"}${Number.isFinite(a.score) ? `, with ${a.score} source-reported points (lower is better)` : ""}.`;
  return "No Nutri-Score is reported for this record, and FoodScan does not guess one.";
}
function describe(p, a) {
  const n = p.nutrition, vals = [["sugars", "sugars"], ["saturatedFat", "saturated fat"], ["salt", "salt"]].filter(([k]) => n[k] !== null).map(([k, w]) => `${num(n[k])} g ${w}`);
  const cubes = n.sugars !== null && n.sugars >= 4 ? ` (~${Math.round(n.sugars / 4)} sugar cubes)` : "";
  const pts = Number.isFinite(a.score) ? ` (${a.score} pts)` : "";
  const nova = p.nova ? ` · NOVA ${p.nova}` : "";
  const grade = a.status === "reported" ? `source-reported Nutri-Score ${a.grade}${pts}` : a.status === "estimated" ? `calculated Nutri-Score ${a.grade}${pts}` : a.status === "withheld" ? "grade on hold (the record contradicts itself)" : "no published Nutri-Score";
  return plain(`${p.name}${p.brand ? ` by ${String(p.brand).split(",")[0]}` : ""}: ${grade}${cubes}${nova}${vals.length ? `; per ${per(p)}: ${vals.join(", ")}` : ""}. Ingredients and allergen cross-check, with the method and its limits.`, 300);
}
function factsTable(p) {
  const rows = ROWS.filter(([k]) => p.nutrition[k] !== null).map(([k, label, unit]) => `<tr><th scope="row">${label}</th><td>${escapeHTML(k === "kcal" ? Math.round(p.nutrition[k]) : num(p.nutrition[k]))} ${unit}</td></tr>`).join("");
  return rows ? `<h2>Nutrition per ${per(p)}${p.basisSource === "assumed" ? " (unit assumed)" : ""}</h2><table><tbody>${rows}</tbody></table>` : "";
}
function allergenLines(p) {
  const r = reconcileAllergens(p), list2 = (keys) => keys.map((k) => escapeHTML(r.label(k))).join(", ");
  const lines = [r.declared.length ? `<li>Listed by the source: ${list2(r.declared)}</li>` : "", r.gaps.length ? `<li>Found in the ingredient text but not listed: ${list2(r.gaps)}</li>` : "", r.traces.length ? `<li>May contain traces: ${list2(r.traces)}</li>` : ""].join("");
  if (r.unknown) return "<h2>Allergens</h2><p>This record has no ingredient list, so allergens are unknown, not absent. Always read the pack.</p>";
  return `<h2>Allergens</h2>${lines ? `<ul>${lines}</ul>` : "<p>None listed and none found in the ingredient text. That is not a guarantee: always read the pack.</p>"}`;
}
function related(p, code) {
  const fam = p ? productFamily(p) : "", others = INDEXABLE.filter((x) => x.code.padStart(14, "0") !== String(code).padStart(14, "0"));
  const pick2 = [...others.filter((x) => fam && x.family === fam), ...others.filter((x) => !fam || x.family !== fam)].slice(0, 6);
  return pick2.length ? `<h2>More products explained</h2><ul>${pick2.map((x) => `<li><a href="/p/${x.code}">${escapeHTML(x.name)}${x.brand ? ` (${escapeHTML(x.brand)})` : ""}</a></li>`).join("")}</ul>` : "";
}
function retag(shell, { origin, path, title, description, image, robots, ld }) {
  const page = `${origin}${path}`;
  shell = shell.replaceAll("https://food-scan.gearuptofit.com", origin).replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHTML(page)}">`).replace(/<title>[^<]*<\/title>/, `<title>${escapeHTML(title)}</title>`).replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${robots}">`);
  for (const key of ["description", "twitter:description", "og:description"]) shell = shell.replace(new RegExp(`<meta (?:name|property)="${key}" content="[^"]*">`), `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escapeHTML(description)}">`);
  for (const key of ["twitter:title", "og:title"]) shell = shell.replace(new RegExp(`<meta (?:name|property)="${key}" content="[^"]*">`), `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escapeHTML(title)}">`);
  shell = shell.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHTML(page)}">`);
  if (image) shell = shell.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapeHTML(image)}">`).replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${escapeHTML(image)}">`).replace(/<meta property="og:image:(?:width|height)"[^>]*>\s*/g, "");
  return shell.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
}
var photo = (raw, origin) => /^https:\/\/(?:images|static)\.openfoodfacts\.org\//.test(raw?.image_front_url || "") ? raw.image_front_url : `${origin}/og.png`;
function productDocument(shell, raw, { origin, code, indexable }) {
  const path = `/p/${code}`, p = parsed(raw, code);
  if (!p) {
    const title2 = `Product ${code} | FoodScan`;
    return retag(shell, { origin, path, title: title2, description: "This food record could not be loaded. Search or scan again in FoodScan.", image: `${origin}/og.png`, robots: "noindex, follow", ld: { "@context": "https://schema.org", "@type": "WebPage", name: title2, url: origin + path } }).replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, `<!--boot--><div class="boot"><h1>Product ${escapeHTML(code)}</h1><p>This food record could not be loaded right now. Your saved foods still open in the app.</p><p><a href="/#/scan">Scan a barcode</a> · <a href="/how/">Method and limitations</a></p><p class="boot__load">Loading FoodScan…</p></div><!--/boot-->`);
  }
  const a = assessGrade(p), published = a.status === "reported" ? a.grade : null, image = photo(raw, origin);
  const title = `${p.name}${published ? `: source-reported Nutri-Score ${published}` : ""} | FoodScan`, description = describe(p, a);
  const brand = String(p.brand || "").split(",")[0].trim(), q = dataQuality(p), ing = excerpt(p.ingredients, 2e3);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    [gtinKey(code)]: code,
    image,
    description,
    url: origin + path,
    ...brand ? { brand: { "@type": "Brand", name: plain(brand, 80) } } : {},
    ...published ? { additionalProperty: [{ "@type": "PropertyValue", name: a.method === "2023" ? "Nutri-Score (source-reported, 2023 method)" : "Nutri-Score (source-reported, method not stated)", value: published }, ...Number.isFinite(a.score) ? [{ "@type": "PropertyValue", name: "Nutri-Score points", value: a.score }] : []] } : {}
  };
  const why = (a.anatomy?.why || []).filter((w) => w.tone !== "note").slice(0, 3).map((w) => `<li>${escapeHTML(w.text)}</li>`).join("");
  const body = `<div class="boot"><p class="eyebrow">${brand ? `${escapeHTML(brand)} · ` : ""}Barcode ${escapeHTML(code)}${p.quantity ? ` · ${escapeHTML(p.quantity)}` : ""}</p><h1>${escapeHTML(p.name)}</h1>
<p>${escapeHTML(gradeSentence(p, a))}</p>${why ? `<ul>${why}</ul>` : ""}
${factsTable(p)}${p.nova ? `<p>Processing: NOVA group ${p.nova} of 4, as reported.</p>` : ""}
${allergenLines(p)}
${ing.text ? `<h2>Ingredients as recorded</h2><p>${escapeHTML(ing.text)}</p>${ing.cut ? "<p>The ingredient list is longer than shown here; the full text is in the app and on the source record.</p>" : ""}` : "<h2>Ingredients</h2><p>No ingredient list in this record.</p>"}
<h2>Source and checks</h2><p>Data: Open Food Facts contributors (Open Database Licence), not laboratory-verified. Record last edited: ${p.sourceModified ? new Date(p.sourceModified).toISOString().slice(0, 10) : "unknown"}. ${fieldCount(p)} of 8 label values reported. Data check: ${escapeHTML(q.short)}.</p>
<p><a href="${ORIGIN}/product/${code}" rel="noopener noreferrer">View the source record</a> · <a href="/how/">Method and limitations</a> · <a href="/#/scan">Scan your own food</a></p>
${related(p, code)}${GUIDES}<p class="boot__load">Loading the interactive report…</p></div>`;
  return retag(shell, { origin, path, title, description, image, robots: indexable ? "index, follow, max-image-preview:large" : "noindex, follow", ld }).replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, `<!--boot-->${body}<!--/boot-->`);
}
async function recordFor(request, env, ctx, code) {
  let out;
  try {
    const result = await productResponse(request, env, ctx, code), cache = result.headers.get("X-FoodScan-Cache") || "";
    out = { status: result.status === 404 ? 404 : result.status === 200 ? 200 : 503, raw: result.ok ? (await result.json()).product : null, cache };
  } catch {
    out = { status: 503, raw: null, cache: "" };
  }
  // 62.0: when the upstream food database is busy, a shared link still opens with the bundled, dated catalogue record (never indexed).
  if (out.status === 503) {
    try {
      const local = await fs60LocalProduct(request, env, code);
      const product = local?.ok ? (await local.json())?.product : null;
      if (product) return { status: 200, raw: product, cache: "DATED-CATALOGUE" };
    } catch { /* keep the 503 */ }
  }
  return out;
}
var shellFor = async (env, url) => (await env.ASSETS.fetch(new Request(`${url.origin}/`, { headers: { Accept: "text/html" } }))).text();
async function productPage(request, env, ctx, code) {
  const url = new URL(request.url), origin = siteOrigin(url, env);
  const [shell, rec] = await Promise.all([shellFor(env, url), recordFor(request, env, ctx, code)]);
  const p = parsed(rec.raw, code), indexable = rec.status === 200 && env.INDEX_PRODUCT_PAGES !== "0" && !preview(url, env) && rec.cache !== "STALE" && rec.cache !== "DATED-CATALOGUE" && indexWorthy(p).index;
  let html = productDocument(shell, rec.raw, { origin, code, indexable });
  // Preserve legacy /p/ share links while consolidating an already-approved public catalog page.
  if (indexable && FSC_ENABLED(env)) {
    try {
      const publicCode = fscCanon(code), catalogRow = publicCode ? await fscGetRow(env,publicCode) : null;
      if (catalogRow) {
        const primary = `${origin}/products/${publicCode}`;
        html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHTML(primary)}">`);
        html = html.replace(`"url":"${origin}/p/${code}"`, `"url":"${primary}"`);
      }
    } catch (e) { console.warn('public canonical lookup:',String(e?.message||'').slice(0,80)); }
  }
  return secureHtml(html, url, env, rec.status, { "Cache-Control": "no-store", ...rec.cache ? { "X-FoodScan-Cache": rec.cache } : {}, ...!indexable ? { "X-Robots-Tag": "noindex, follow" } : {}, ...rec.status === 503 ? { "Retry-After": "60" } : {} }, request.cf?.country);
}
function compareDocument(shell, rawA, rawB, { origin, a, b }) {
  const path = `/compare/${a}/${b}`, pa = parsed(rawA, a), pb = parsed(rawB, b);
  if (!pa || !pb) {
    const title2 = "Product comparison | FoodScan";
    return retag(shell, { origin, path, title: title2, description: "Two food products side by side in FoodScan.", image: `${origin}/og.png`, robots: "noindex, follow", ld: { "@context": "https://schema.org", "@type": "WebPage", name: title2, url: origin + path } }).replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, `<!--boot--><div class="boot"><h1>Product comparison</h1><p>One of these records could not be loaded right now.</p><p><a href="/p/${a}">Product ${a}</a> · <a href="/p/${b}">Product ${b}</a></p><p class="boot__load">Loading FoodScan…</p></div><!--/boot-->`);
  }
  const v = versus(pa, pb), line = versusLine(v, t), shown = (c) => c.status === "reported" ? c.grade : null;
  const title = `${pa.name} vs ${pb.name}${shown(v.left) && shown(v.right) ? `: Nutri-Score ${v.left.grade} vs ${v.right.grade}` : ""} | FoodScan`;
  const adv = (c, list2) => list2.map((d) => `${d.key === "fiber" || d.key === "protein" ? "more" : "less"} ${d.key === "saturatedFat" ? "saturated fat" : d.key === "fiber" ? "fibre" : d.key} (${num(d.mine)} g vs ${num(d.other)} g per ${d.unit})`).join(", ");
  const parts = [v.better.a.length ? `${pa.name}: ${adv(v.left, v.better.a)}` : "", v.better.b.length ? `${pb.name}: ${adv(v.right, v.better.b)}` : ""].filter(Boolean);
  const description = plain(`${line} ${parts.length ? `Measured differences: ${parts.join("; ")}.` : ""}`, 300);
  const col = (p, c) => `<li><a href="/p/${p.barcode}">${escapeHTML(p.name)}</a>: ${escapeHTML(gradeSentence(p, assessGrade(p)))}</li>`;
  const body = `<div class="boot"><p class="eyebrow">Side by side</p><h1>${escapeHTML(pa.name)} vs ${escapeHTML(pb.name)}</h1><p>${escapeHTML(line)}</p><ul>${col(pa, v.left)}${col(pb, v.right)}</ul>
${parts.length ? `<h2>Measured differences</h2><ul>${parts.map((x) => `<li>${escapeHTML(x)}</li>`).join("")}</ul>` : ""}${!v.sameUnit ? "<p>The two records use different units (per 100 g and per 100 ml), so no nutrient is compared.</p>" : ""}
<p><a href="/#/scan">Scan and compare your own</a> · <a href="/how/">Method and limitations</a></p><p class="boot__load">Loading the comparison…</p></div>`;
  return retag(shell, { origin, path, title, description, image: photo(rawA, origin), robots: "noindex, follow", ld: { "@context": "https://schema.org", "@type": "WebPage", name: title, url: origin + path, description, about: [pa, pb].map((p) => ({ "@type": "Product", name: p.name, [gtinKey(p.barcode)]: p.barcode, url: `${origin}/p/${p.barcode}` })) } }).replace(/<!--boot-->[\s\S]*?<!--\/boot-->/, `<!--boot-->${body}<!--/boot-->`);
}
async function comparePage(request, env, ctx, a, b) {
  const url = new URL(request.url), origin = siteOrigin(url, env);
  const [shell, ra, rb] = await Promise.all([shellFor(env, url), recordFor(request, env, ctx, a), recordFor(request, env, ctx, b)]);
  const status = ra.status === 404 || rb.status === 404 ? 404 : ra.status === 200 && rb.status === 200 ? 200 : 503;
  return secureHtml(compareDocument(shell, ra.raw, rb.raw, { origin, a, b }), url, env, status, { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, follow", ...status === 503 ? { "Retry-After": "60" } : {} }, request.cf?.country);
}
var budget = { product: [], search: [], index: [] };
var fairness = /* @__PURE__ */ new Map();
var MAX_PENDING = 64;
var PRODUCT_MINUTE = 12;
var SEARCH_MINUTE = 8;
var INDEX_MINUTE = 60;
var deepPending = null;
async function boundedRequest(request, maximum) {
  if (Number(request.headers.get("Content-Length")) > maximum) throw new Error("size");
  const reader = request.body?.getReader();
  if (!reader) return "";
  let size = 0, text2 = "", decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new Error("size");
      }
      text2 += decoder.decode(value, { stream: true });
    }
    return text2 + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
function siteOrigin(url, env) {
  try {
    const u = new URL(env.PUBLIC_ORIGIN);
    if (u.protocol === "https:" && !u.username && !u.password && !u.port && u.pathname === "/" && !u.search && !u.hash) return u.origin;
  } catch {
  }
  return SITE || url.origin;
}
function preview(url, env) {
  return env.NOINDEX === "1" || url.hostname.endsWith(".pages.dev") || env.PUBLIC_ORIGIN && siteOrigin(url, env) !== url.origin;
}
async function secureHtml(html, url, env, status = 200, extra = {}, country = "") {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const hashes = await Promise.all(scripts.map(async (m) => {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(m[1])));
    return `'sha256-${btoa(String.fromCharCode(...digest))}'`;
  }));
  const csp = CSP.replace("script-src 'self'", `script-src 'self'${hashes.length ? " " + hashes.join(" ") : ""}`);
  if (preview(url, env)) html = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, follow">');
  const where = String(country || "").toUpperCase();
  if (/^[A-Z]{2}$/.test(where)) html = html.replace("</head>", `<meta name="fs-country" content="${where}">
</head>`);
  return new Response(html, { status, headers: pageHeaders(url, { "Content-Security-Policy": csp, ...(where?{"Cache-Control":"private, no-cache, must-revalidate"}:{}), ...preview(url, env) ? { "X-Robots-Tag": "noindex, follow" } : {}, ...extra }) });
}
async function siteDocument(request, env) {
  const url = new URL(request.url), origin = siteOrigin(url, env);
  let asset = await env.ASSETS.fetch(new Request(url.href, { method: "GET", headers: { Accept: "text/html" } }));
  let text2 = await asset.text();
  text2 = text2.replaceAll("https://food-scan.gearuptofit.com", origin);
  if (url.pathname === '/sitemap.xml' && FSC_ENABLED(env) && !preview(url,env))
    text2 = text2.replace('</sitemapindex>', `<sitemap><loc>${origin}/sitemap-catalog.xml</loc></sitemap></sitemapindex>`);
  const type = asset.headers.get("Content-Type") || "";
  if (type.includes("text/html") || /(?:\/|\.html)$/.test(url.pathname)) return secureHtml(text2, url, env, asset.status, {}, request.cf?.country);
  if (url.pathname === "/robots.txt") text2 = `${preview(url, env) ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\nDisallow: /api/\n"}Sitemap: ${origin}/sitemap.xml
`;
  const headers = new Headers(asset.headers);
  headers.set("X-FoodScan-Version", VERSION);
  headers.set("Cache-Control", "public, max-age=300, must-revalidate");
  if (preview(url, env)) headers.set("X-Robots-Tag", "noindex, follow");
  return new Response(text2, { status: asset.status, headers });
}
var FS_NUTRIENTS = /* @__PURE__ */ new Set([
  "energy-kcal",
  "energy-kj",
  "energy",
  "fat",
  "saturated-fat",
  "carbohydrates",
  "sugars",
  "proteins",
  "fiber",
  "salt",
  "sodium",
  "added-sugars",
  "fruits-vegetables-legumes-estimate-from-ingredients",
  "fruits-vegetables-legumes"
]);
var FS_TAG_LIMITS = Object.freeze({
  categories_tags: 40,
  countries_tags: 32,
  allergens_tags: 100,
  traces_tags: 100,
  labels_tags: 100,
  ingredients_analysis_tags: 100,
  additives_tags: 60,
  data_quality_errors_tags: 100
});
function fsCompactNutrients(n) {
  if (!n || typeof n !== "object" || Array.isArray(n)) return {};
  const out = {};
  for (const [key, value] of Object.entries(n)) {
    const suffix = key.endsWith("_100g") ? "_100g" : key.endsWith("_serving") ? "_serving" : null;
    if (!suffix || !FS_NUTRIENTS.has(key.slice(0, -suffix.length))) continue;
    if (typeof value === "number" && Number.isFinite(value) || typeof value === "string" && value.length <= 60) out[key] = value;
    else if (typeof value === "number") out[key] = "NaN";
  }
  return out;
}
function fsCompactNutriscore(value) {
  const current = value?.["2023"];
  if (!current || typeof current !== "object") return void 0;
  const d = current.data || {};
  const part = (list2) => (Array.isArray(list2) ? list2 : []).slice(0, 15).map((x) => ({
    id: String(x?.id || "").slice(0, 50),
    points: typeof x?.points === "number" && Number.isFinite(x.points) ? x.points : null,
    points_max: typeof (x?.points_max ?? x?.max) === "number" && Number.isFinite(x.points_max ?? x.max) ? x.points_max ?? x.max : null,
    value: typeof x?.value === "number" && Number.isFinite(x.value) ? x.value : null,
    unit: String(x?.unit || "").slice(0, 10)
  })).filter((x) => x.id && x.points !== null && x.points_max !== null);
  return { "2023": {
    grade: String(current.grade || "").slice(0, 1),
    score: typeof current.score === "number" && Number.isFinite(current.score) ? current.score : null,
    category_available: current.category_available === 1 ? 1 : 0,
    data: {
      negative: part(d.negative ?? d.components?.negative),
      positive: part(d.positive ?? d.components?.positive),
      negative_points: typeof d.negative_points === "number" && Number.isFinite(d.negative_points) ? d.negative_points : null,
      positive_points: typeof d.positive_points === "number" && Number.isFinite(d.positive_points) ? d.positive_points : null,
      count_proteins: d.count_proteins === 1 ? 1 : 0,
      count_proteins_reason: String(d.count_proteins_reason || "").slice(0, 80),
      is_beverage: d.is_beverage === 1 ? 1 : 0,
      is_cheese: d.is_cheese === 1 ? 1 : 0,
      is_fat_oil_nuts_seeds: d.is_fat_oil_nuts_seeds === 1 ? 1 : 0,
      is_red_meat_product: d.is_red_meat_product === 1 ? 1 : 0,
      is_water: d.is_water === 1 ? 1 : 0
    }
  } };
}
function compactFoodRecord(raw) {
  const p = { ...raw };
  const localeFields = ["fr", "el", "de", "it", "es", "pt", "nl"].map((lang) => `ingredients_text_${lang}`);
  if (!String(p.ingredients_text || p.ingredients_text_en || "").trim()) {
    const pref = /^[a-z]{2}$/.test(String(p.lang || "")) ? `ingredients_text_${p.lang}` : null;
    const fallback = [pref, ...localeFields].filter(Boolean).find((key) => typeof p[key] === "string" && p[key].trim().length > 1);
    if (fallback) p.ingredients_text = p[fallback].trim().slice(0, 14e3);
  }
  for (const key of localeFields) delete p[key];
  p.nutriments = fsCompactNutrients(raw.nutriments);
  if (raw.nutriscore) {
    p.nutriscore = fsCompactNutriscore(raw.nutriscore);
    if (!p.nutriscore) delete p.nutriscore;
  }
  for (const [key, max] of Object.entries(FS_TAG_LIMITS)) if (Array.isArray(p[key])) {
    const valid = p[key].filter((x) => typeof x === "string" && x.length <= 160);
    const severe = key === "data_quality_errors_tags" ? valid.filter((x) => /nutrition.*(energy-value-in-kcal-does-not-match-value-in-kj|energy-value-in-kj-does-not-match-value-in-kcal|100g-.*greater-than-100|values-are-all-identical)/i.test(x)).slice(0, 20) : [];
    p[key] = [.../* @__PURE__ */ new Set([...severe, ...valid.slice(0, max)])].slice(0, max);
  }
  for (const name of ["ingredients_text", "ingredients_text_en"]) if (typeof p[name] === "string" && p[name].length > 14e3) p[name] = p[name].slice(0, 14e3);
  for (const key of Object.keys(p)) if (/^product_name|^generic_name|^abbreviated_product_name/.test(key) && typeof p[key] === "string" && p[key].length > 240) p[key] = p[key].slice(0, 240);
  return p;
}
function hasIngredientEvidence(value) {
  if (typeof value !== "string") return false;
  const text2 = value.trim();
  if (text2.length < 2 || !/[\p{L}]/u.test(text2)) return false;
  if (/^(?:unknown|n\/?a|not (?:available|provided|specified|listed|known)|none|unspecified|no ingredients? (?:data|listed|available)|inconnu|indisponible|nicht angegeben|desconocido|no disponible)[.!\s]*$/iu.test(text2)) return false;
  return true;
}
var IDX_STALE_MS = 86400000; // Older snapshots remain offline-readable, not current recommendation evidence.
var IDX_REFRESH_AFTER_MS = 20 * 3600000;
var IDX_REFRESH_RETRY_MS = 6 * 3600 * 1e3;
var IDX_CATEGORY_SIZE = 64;
var IDX_CATEGORY_RANK_POOL = 160;
var IDX_ALTERNATIVES_LIMIT = 36;
var IDX_SEARCH_LIMIT = 20;
var IDX_ALTERNATIVES_MAX_BYTES = 36e4;
var IDX_SEARCH_MAX_BYTES = 24e4;
var IDX_CATEGORY_READ_BUDGET = 6e5;
var IDX_SEARCH_READ_BUDGET = 48e4;
var idxReplicaBackoff = /* @__PURE__ */ new WeakMap();
var idxReadDB = (env) => env?.FOODSCAN_D1_READ_REPLICAS === "1" && env?.FOODSCAN_D1_DISCOVERY_REPLICAS === "1" && typeof env?.FOOD_DB?.withSession === "function" && (idxReplicaBackoff.get(env.FOOD_DB) || 0) <= Date.now() ? env.FOOD_DB.withSession("first-unconstrained") : env.FOOD_DB;
var IDX_SOURCE = "Open Food Facts";
var idxEnabled = (env) => Boolean(env?.FOOD_DB && env?.FOODSCAN_INDEX_READS !== "0");
var idxRequired = (env) => env?.FOODSCAN_REQUIRE_INDEX === "1";
var idxLiveFallback = (env) => !idxRequired(env) && env?.FOODSCAN_ALLOW_LIVE_SEARCH !== "0";
var idxGTIN = (code) => String(code || "").padStart(14, "0");
var idxLog = (kind, err) => console.warn(JSON.stringify({ app: "FoodScan", version: VERSION, component: "index", kind, error: String(err?.message || err || "unknown").slice(0, 110) }));
var idxRequiredError = (env) => idxRequired(env) && !idxEnabled(env) ? error("index_unavailable", "Product catalogue is temporarily unavailable. Saved products remain accessible offline.", 503, {}, { "Retry-After": "30" }) : null;
function idxFromRow(row) {
  if (!row || typeof row.raw_json !== "string") return null;
  try {
    const raw = JSON.parse(row.raw_json);
    const parsed2 = parseProduct({ status: 1, product: raw, fetchedAt: Number(row.verified_at) || Date.now() }, String(row.barcode));
    if (!parsed2 || !equivalent(parsed2.barcode, row.barcode)) return null;
    return { raw, parsed: parsed2, fetchedAt: Number(row.verified_at) || 0 };
  } catch {
    return null;
  }
}
function idxResponse(record) {
  const stale = !record.fetchedAt || Date.now() - record.fetchedAt > IDX_STALE_MS;
  return withCache(
    json({
      status: "success",
      product: record.raw,
      fetchedAt: record.fetchedAt,
      source: IDX_SOURCE,
      version: 2,
      connection: { version: VERSION, endpoint: "foodscan-d1" }
    }),
    stale ? "STALE" : "INDEX",
    { "X-FoodScan-Provider": "D1", "X-FoodScan-Data-Age": stale ? "stale" : "indexed" }
  );
}
async function idxReadWithPrimary(env, reader, { retryEmpty = false } = {}) {
  const replica = idxReadDB(env), primary = env.FOOD_DB;
  if (replica === primary) return await reader(primary);
  try {
    const result = await reader(replica);
    if (!retryEmpty || (Array.isArray(result) ? result.length > 0 : Boolean(result))) return result;
  } catch (e) {
    idxReplicaBackoff.set(primary, Date.now() + 3e4);
    idxLog("replica_read_fallback", e);
  }
  return await reader(primary);
}
async function idxGetProduct(env, code) {
  if (!idxEnabled(env)) return null;
  try {
    const query = "SELECT barcode,raw_json,verified_at FROM products WHERE gtin14=?";
    const read = async (db) => {
      const row2 = await db.prepare(query).bind(idxGTIN(code)).first();
      if (row2 && !idxFromRow(row2)) throw Error("invalid_index_row");
      return row2;
    };
    const row = await read(env.FOOD_DB);
    const record = idxFromRow(row);
    return record ? { response: idxResponse(record), verifiedAt: record.fetchedAt, stale: !record.fetchedAt || Date.now() - record.fetchedAt > IDX_STALE_MS } : null;
  } catch (e) {
    idxLog("product_read", e);
    return { error: true };
  }
}
async function idxIsNegative(env, code) {
  if (!idxEnabled(env)) return false;
  try {
    return !!await env.FOOD_DB.prepare("SELECT 1 AS hit FROM negative_lookups WHERE gtin14=? AND expires_at>?").bind(idxGTIN(code), Date.now()).first();
  } catch (e) {
    idxLog("negative_read", e);
    return false;
  }
}
async function idxMarkNegative(env, code) {
  if (!idxEnabled(env)) return;
  try {
    await env.FOOD_DB.prepare("INSERT INTO negative_lookups(gtin14,expires_at,reason) VALUES(?,?,'not_found') ON CONFLICT(gtin14) DO UPDATE SET expires_at=excluded.expires_at").bind(idxGTIN(code), Date.now() + 6 * 3600 * 1e3).run();
  } catch (e) {
    idxLog("negative_write", e);
  }
}
async function idxReserveUpstream(env, kind) {
  if (!idxEnabled(env)) return null;
  const now = Date.now(), gap = kind === "product" ? 5500 : 8e3;
  try {
    const allowed = await env.FOOD_DB.prepare("UPDATE upstream_budget SET next_allowed_ms=? WHERE kind=? AND next_allowed_ms<=? RETURNING next_allowed_ms").bind(now + gap, kind, now).first();
    if (allowed) return null;
    let next = await env.FOOD_DB.prepare("SELECT next_allowed_ms FROM upstream_budget WHERE kind=?").bind(kind).first();
    if (!next) {
      const seeded = await env.FOOD_DB.prepare("INSERT INTO upstream_budget(kind,next_allowed_ms) VALUES(?,?) ON CONFLICT(kind) DO NOTHING RETURNING next_allowed_ms").bind(kind, now + gap).first();
      if (seeded) return null;
      next = await env.FOOD_DB.prepare("SELECT next_allowed_ms FROM upstream_budget WHERE kind=?").bind(kind).first();
    }
    return { code: "local_rate_limited", wait: next ? Math.min(60, Math.max(1, Math.ceil((Number(next.next_allowed_ms) - now) / 1e3))) : 30 };
  } catch (e) {
    idxLog("upstream_budget", e);
    return { code: "local_rate_limited", wait: 30 };
  }
}
async function idxApplyUpstreamCooldown(env, kind, seconds) {
  if (!idxEnabled(env)) return;
  const delay = Math.min(86400, Math.max(10, Math.ceil(Number(seconds) || 60)));
  try {
    await env.FOOD_DB.prepare("UPDATE upstream_budget SET next_allowed_ms=MAX(next_allowed_ms,?) WHERE kind=?").bind(Date.now() + delay * 1e3, kind).run();
  } catch (e) {
    idxLog("upstream_cooldown", e);
  }
}
function idxFields(raw, code) {
  const product = Object.fromEntries(FIELDS.split(",").filter((k) => Object.hasOwn(raw, k)).map((k) => [k, raw[k]]));
  product.code = code;
  const tags2 = (x, max) => Array.isArray(x) ? [...new Set(x.filter((t2) => typeof t2 === "string" && /^[a-z]{2}:[a-z0-9-]{2,106}$/.test(t2)).slice(0, max))] : [];
  product.categories_tags = tags2(product.categories_tags, 40);
  product.countries_tags = tags2(product.countries_tags, 32);
  return compactFoodRecord(product);
}
async function idxDigest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function idxSaveProduct(env, response, code) {
  if (!idxEnabled(env) || response.status !== 200) return;
  try {
    const payload = await response.clone().json(), raw = payload?.product;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const product = idxFields(raw, code), verifiedAt = Date.now();
    const parsed2 = parseProduct({ status: 1, product, fetchedAt: verifiedAt }, code);
    if (!parsed2 || !equivalent(parsed2.barcode, code)) return;
    const gradeResult = assessGrade(parsed2, { estimate: false });
    const sourceGrade = String(product.nutriscore_grade || product.nutrition_grades || "").trim().toUpperCase();
    const currentGrade = String(product.nutriscore?.["2023"]?.grade || "").trim().toUpperCase();
    const conflictingGrade = /^[A-E]$/.test(sourceGrade) && /^[A-E]$/.test(currentGrade) && sourceGrade !== currentGrade;
    const grade = !conflictingGrade && gradeResult.status === "reported" ? gradeResult.grade : null;
    const nutrients = fieldCount(parsed2), nameMissing = parsed2.nameMissing;
    const qualityOk = Number(!!(grade && !nameMissing && nutrients >= 6 && hasIngredientEvidence(parsed2.ingredients) && parsed2.categories.length && dataQuality(parsed2).state === "usable"));
    const score = Math.min(100, nutrients * 8 + (nameMissing ? 0 : 12) + (grade ? 10 : 0) + (hasIngredientEvidence(parsed2.ingredients) ? 10 : 0) + (parsed2.categories.length ? 4 : 0));
    const sourceModified = Math.max(0, Math.floor((parsed2.sourceModified || 0) / 1e3));
    const jsonText = JSON.stringify(product), rawBytes = new TextEncoder().encode(jsonText).length;
    if (rawBytes > 55e3) return;
    const name = String(product.product_name || product.product_name_en || product.product_name_el || parsed2.name || "").slice(0, 240);
    const normalize = (s) => String(s).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    const brand = String(product.brands || "").slice(0, 200);
    const digest = await idxDigest(jsonText);
    await env.FOOD_DB.prepare(`INSERT INTO products(gtin14,barcode,name,name_norm,brand_norm,raw_json,grade,grade_rank,quality_ok,quality_score,source_modified_at,verified_at,digest,raw_bytes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(gtin14) DO UPDATE SET
      barcode=excluded.barcode,name=excluded.name,name_norm=excluded.name_norm,brand_norm=excluded.brand_norm,raw_json=excluded.raw_json,
      grade=excluded.grade,grade_rank=excluded.grade_rank,quality_ok=excluded.quality_ok,quality_score=excluded.quality_score,
      source_modified_at=excluded.source_modified_at,verified_at=excluded.verified_at,digest=excluded.digest,raw_bytes=excluded.raw_bytes
      WHERE COALESCE(excluded.source_modified_at,0)>COALESCE(products.source_modified_at,0)
        OR (COALESCE(excluded.source_modified_at,0)=COALESCE(products.source_modified_at,0)
            AND (excluded.digest!=products.digest OR products.verified_at<excluded.verified_at-3600000))`).bind(
      idxGTIN(code),
      code,
      name,
      normalize(name),
      normalize(brand),
      jsonText,
      grade,
      grade ? "ABCDE".indexOf(grade) : 5,
      qualityOk,
      score,
      sourceModified,
      verifiedAt,
      digest,
      rawBytes
    ).run();
  } catch (e) {
    idxLog("write_through", e);
  }
}
function idxRefreshStale(request, env, ctx, code, verifiedAt) {
  if (!idxEnabled(env) || env.FOODSCAN_BACKGROUND_REFRESH !== "1" || !ctx?.waitUntil || !verifiedAt || Date.now() - verifiedAt < IDX_REFRESH_AFTER_MS) return;
  ctx.waitUntil((async () => {
    try {
      const now = Date.now();
      const claim = await env.FOOD_DB.prepare(`INSERT INTO refresh_claims(gtin14,claimed_at,next_retry_ms)
         VALUES(?,?,?) ON CONFLICT(gtin14) DO UPDATE SET claimed_at=excluded.claimed_at,next_retry_ms=excluded.next_retry_ms
         WHERE refresh_claims.next_retry_ms<=excluded.claimed_at RETURNING gtin14`).bind(idxGTIN(code), now, now + IDX_REFRESH_RETRY_MS).first();
      if (!claim) return;
      const result = await fetchProduct(request, env, code.length === 12 ? "0" + code : code);
      if (result.status === 200) await idxSaveProduct(env, result, code);
      else if (result.status === 429 || result.status === 502 || result.status === 503 || result.status === 504) {
        const retry = Number(result.headers.get("Retry-After"));
        const seconds = result.status === 429 ? Math.min(86400, Math.max(35, Number.isFinite(retry) && retry > 0 ? retry + 5 : 65)) : Math.min(86400, Math.max(900, Number.isFinite(retry) && retry > 0 ? retry + 5 : 900));
        await env.FOOD_DB.prepare("UPDATE refresh_claims SET next_retry_ms=? WHERE gtin14=? AND claimed_at=?").bind(Date.now() + seconds * 1e3, idxGTIN(code), now).run();
      } else if (result.status === 404) {
        const detail = await result.clone().json().catch(() => null);
        if (["not_found", "not_food"].includes(detail?.error?.code)) {
          await env.FOOD_DB.prepare("UPDATE refresh_claims SET next_retry_ms=? WHERE gtin14=? AND claimed_at=?").bind(Date.now() + 7 * 86400 * 1e3, idxGTIN(code), now).run();
        }
      }
    } catch (e) {
      idxLog("background_refresh", e);
    }
  })());
}
function idxTextQuery(value) {
  const terms = isoName(value).split(/\s+/).filter((x) => /^[\p{L}\p{N}]{2,}$/u.test(x)).slice(0, 5);
  return terms.length ? terms.map((x) => '"' + x + '"*').join(" AND ") : "";
}
function idxCollect(rows, limit, { allowIncomplete = false, diversifyBrands = false, maxBytes = 3e5, maxAgeMs = Infinity } = {}) {
  const products = [], unique = /* @__PURE__ */ new Set(), times = [], brands = /* @__PURE__ */ new Map();
  let responseBytes = 0, skippedForSize = 0, skippedForAge = 0;
  for (const row of rows) {
    if (!row || typeof row.raw_json !== "string") continue;
    const length = new TextEncoder().encode(row.raw_json).byteLength;
    if (length > maxBytes || responseBytes + length > maxBytes) {
      skippedForSize++;
      continue;
    }
    const item = idxFromRow(row);
    if (!item) continue;
    const key = idxGTIN(item.parsed.barcode);
    if (unique.has(key)) continue;
    if (Number.isFinite(maxAgeMs) && (!item.fetchedAt || Date.now() - item.fetchedAt > maxAgeMs)) {
      skippedForAge++;
      continue;
    }
    const quality = dataQuality(item.parsed);
    if (quality.state === "blocked" || item.parsed.nameMissing) continue;
    if (!allowIncomplete) {
      if (quality.state !== "usable") continue;
      if (assessGrade(item.parsed, { estimate: false }).status !== "reported") continue;
    }
    const brand = String(row.brand_norm || "").trim();
    if (diversifyBrands && brand && (brands.get(brand) || 0) >= 4) continue;
    if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    responseBytes += length;
    unique.add(key);
    products.push(item.raw);
    times.push(item.fetchedAt);
    if (products.length >= limit) break;
  }
  return {
    products,
    fetchedAt: times.length ? Math.min(...times) : Date.now(),
    sampled: true,
    responseBytes,
    skippedForSize,
    skippedForAge
  };
}
function idxListResponse(out, metadata, coverage) {
  return withCache(
    json({
      ...metadata,
      products: out.products,
      checked: out.products.length,
      partial: metadata.partial === false ? false : true,
      sampled: true,
      selection: { returned: out.products.length, skippedForSize: out.skippedForSize, skippedForAge: out.skippedForAge },
      provider: "foodscan-d1",
      source: IDX_SOURCE,
      fetchedAt: out.fetchedAt,
      coverage,
      version: VERSION
    }),
    "INDEX",
    { "X-FoodScan-Provider": "D1" }
  );
}
async function idxCachedList(request, ctx, kind, keyPart, ttlSeconds, runner) {
  const url = new URL(request.url);
  const key = new Request(`${url.origin}/api/cache/${CACHE_SCHEMA}/idx/${kind}/${encodeURIComponent(keyPart)}`);
  const cache = globalThis.caches?.default;
  if (cache) {
    try {
      const hit2 = await cache.match(key);
      if (hit2?.ok) return withCache(hit2, "HIT", { "X-FoodScan-Provider": "D1" });
    } catch {
    }
  }
  const pending = inflight.get(key.url);
  if (pending) return (await pending).clone();
  if (inflight.size >= MAX_PENDING) return error(
    "local_rate_limited",
    "Search capacity is temporarily busy. Please try again shortly.",
    429,
    { retryAfter: 5 },
    { "Retry-After": "5" }
  );
  const work = (async () => {
    const result = await runner();
    if (cache && result.status === 200) {
      const headers = new Headers(result.headers);
      headers.set("Cache-Control", `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
      const write = cache.put(key, new Response(result.clone().body, { status: result.status, headers })).catch(() => {
      });
      if (ctx?.waitUntil) ctx.waitUntil(write);
      else await write;
    }
    return result;
  })();
  inflight.set(key.url, work);
  try {
    return (await work).clone();
  } finally {
    inflight.delete(key.url);
  }
}
function idxShortlist(rows, maxCount, maxBytes, { diversifyBrands = false } = {}) {
  const selected = [], brands = /* @__PURE__ */ new Map();
  let bytes = 0;
  for (const row of rows) {
    if (!/^[0-9]{14}$/.test(String(row?.gtin14 || ""))) continue;
    const size = Number(row.raw_bytes) || 55e3;
    if (!Number.isFinite(size) || size < 0 || size > 55e3) continue;
    const brand = String(row.brand_norm || "").trim();
    if (diversifyBrands && brand && (brands.get(brand) || 0) >= 4) continue;
    if (bytes + size > maxBytes) continue;
    selected.push(row.gtin14);
    bytes += size;
    if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    if (selected.length >= maxCount) break;
  }
  return selected;
}
async function idxAlternatives(request, env, ctx) {
  const mandatory = idxRequiredError(env);
  if (mandatory) return mandatory;
  if (!idxEnabled(env)) return categorySearch(request, env, ctx);
  const url = new URL(request.url), category = url.searchParams.get("category") || "", country = marketCountry(request), page = marketPage(request);
  if (!/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/.test(category)) return error("invalid_category", "Choose a category returned by the source record.", 400);
  if (!page) return error("invalid_page", "Page must be from 1 to 50.", 400);
  if (country && !/^[a-z][a-z-]{2,40}$/.test(country)) return error("invalid_country", "Use a source-listed country name.", 400);
  return idxCachedList(request, ctx, "alternatives", category + "|" + country + "|" + page, 180, async () => {
    try {
      const sql = `SELECT c.gtin14,p.brand_norm,COALESCE(NULLIF(p.raw_bytes,0),LENGTH(CAST(p.raw_json AS BLOB))) AS raw_bytes
      FROM product_categories c JOIN products p ON p.gtin14=c.gtin14
      WHERE c.category=? AND c.eligible=1 ${country ? "AND EXISTS (SELECT 1 FROM product_countries ct WHERE ct.gtin14=c.gtin14 AND ct.country=?)" : ""}
      ORDER BY c.grade_rank ASC,c.quality_score DESC,c.gtin14 ASC LIMIT 24 OFFSET ${(page-1)*24}`;
      const args = country ? [category, "en:" + country] : [category];
      let pageHasMore=false;
      const load = async (db) => {
        const ranked = (await db.prepare(sql).bind(...args).all()).results || [];
        pageHasMore=ranked.length===24;
        const selection = idxShortlist(ranked, 24, IDX_CATEGORY_READ_BUDGET, { diversifyBrands: false });
        if (!selection.length) return [];
        const placeholders = selection.map(() => "?").join(",");
        const found = (await db.prepare(`SELECT gtin14,barcode,raw_json,verified_at,brand_norm FROM products WHERE gtin14 IN (${placeholders})`).bind(...selection).all()).results || [];
        const byId = new Map(found.map((r) => [r.gtin14, r]));
        return selection.map((id) => byId.get(id)).filter(Boolean);
      };
      const rows = await load(env.FOOD_DB);
      const out = idxCollect(rows, IDX_ALTERNATIVES_LIMIT, { diversifyBrands: false, maxBytes: IDX_ALTERNATIVES_MAX_BYTES, maxAgeMs: Infinity });
      if (!out.products.length && idxLiveFallback(env)) return categorySearch(request, env, ctx);
      const coverage = out.products.length ? "Country-filtered discovery snapshots. Bulk and older records are hints only; every displayed alternative requires a fresh exact-product check. Not supermarket stock or a complete inventory." : "No eligible indexed discovery hints on this page for this category and country. This does not mean that no better product exists.";
      return idxListResponse(out, { category, country: country || null, page, hasMore: page<50 && pageHasMore }, coverage);
    } catch (e) {
      idxLog("alternatives", e);
      if (idxLiveFallback(env)) return categorySearch(request, env, ctx);
      return error("index_unavailable", "Alternative lookup is temporarily unavailable. Saved products still work.", 503);
    }
  });
}
async function idxSearch(request, env, ctx) {
  const mandatory = idxRequiredError(env);
  if (mandatory) return mandatory;
  if (!idxEnabled(env)) return textSearch(request, env, ctx);
  const query = isoName(new URL(request.url).searchParams.get("q") || "");
  if (query.length < 2) return error("invalid_query", "Type at least 2 letters or digits to search.", 400);
  const possibleBarcode = query.replace(/[\s-]/g, "");
  if (validBarcode2(possibleBarcode)) {
    const found = await productResponse(request, env, ctx, possibleBarcode);
    if (found.status === 200) {
      const payload = await found.json();
      return idxListResponse(
        {
          products: [payload.product],
          fetchedAt: Number.isFinite(payload.fetchedAt) ? payload.fetchedAt : 0,
          skippedForSize: 0,
          skippedForAge: 0
        },
        { query, partial: found.headers.get("X-FoodScan-Cache")==="STALE" },
        "Exact barcode match. Source-reported information is not allergy clearance."
      );
    }
    if (found.status === 404) return idxListResponse(
      {
        products: [],
        fetchedAt: Date.now(),
        skippedForSize: 0,
        skippedForAge: 0
      },
      { query },
      "No product found with that barcode in the available catalogue."
    );
    return found;
  }
  const match = idxTextQuery(query);
  if (!match) return idxListResponse({ products: [], fetchedAt: Date.now(), skippedForSize: 0, skippedForAge: 0 }, { query }, "Try a different product name.");
  return idxCachedList(request, ctx, "search", query, 120, async () => {
    try {
      const load = async (db) => {
        const hits = (await db.prepare(`SELECT p.gtin14,p.brand_norm,COALESCE(NULLIF(p.raw_bytes,0),LENGTH(CAST(p.raw_json AS BLOB))) AS raw_bytes
        FROM product_fts f JOIN products p ON p.rowid=f.rowid WHERE product_fts MATCH ?
        ORDER BY bm25(product_fts),p.quality_ok DESC,p.quality_score DESC LIMIT 48`).bind(match).all()).results || [];
        const selection = idxShortlist(hits, 36, IDX_SEARCH_READ_BUDGET);
        if (!selection.length) return [];
        const found = (await db.prepare(`SELECT gtin14,barcode,raw_json,verified_at,brand_norm FROM products WHERE gtin14 IN (${selection.map(() => "?").join(",")})`).bind(...selection).all()).results || [];
        const byId = new Map(found.map((row) => [row.gtin14, row]));
        return selection.map((id) => byId.get(id)).filter(Boolean);
      };
      const rows = await idxReadWithPrimary(env, load, { retryEmpty: true });
      const out = idxCollect(rows, IDX_SEARCH_LIMIT, { allowIncomplete: true, maxBytes: IDX_SEARCH_MAX_BYTES });
      if (!out.products.length && idxLiveFallback(env)) return textSearch(request, env, ctx);
      return idxListResponse(out, { query }, "Results may include incomplete records. A search match is not evidence of a healthy choice.");
    } catch (e) {
      idxLog("search", e);
      if (idxLiveFallback(env)) return textSearch(request, env, ctx);
      return error("index_unavailable", "Product search is temporarily unavailable. Try a barcode or a saved product.", 503);
    }
  });
}
async function idxDiagnostic(env) {
  if (!idxEnabled(env)) return { bound: Boolean(env?.FOOD_DB), enabled: false, mode: "legacy", seeded: false };
  try {
    const sample = await env.FOOD_DB.prepare("SELECT raw_bytes AS payload_size FROM products LIMIT 1").bind().first();
    const eligible = sample ? await env.FOOD_DB.prepare("SELECT 1 AS present FROM products WHERE quality_ok=1 LIMIT 1").bind().first() : null;
    const ready = !!(sample && eligible);
    return {
      bound: true,
      enabled: true,
      mode: !sample ? "index-empty" : ready ? "index-first" : "index-incomplete",
      seeded: !!sample,
      hasRecommendationCandidates: !!eligible,
      ready,
      schemaVersion: 4,
      globalUpstreamPacing: true,
      replicaSessionsEnabled: env?.FOODSCAN_D1_READ_REPLICAS === "1" && env?.FOODSCAN_D1_DISCOVERY_REPLICAS === "1" && typeof env.FOOD_DB.withSession === "function",
      strongGradeReads: true
    };
  } catch (e) {
    idxLog("diagnostic", e);
    return { bound: true, enabled: true, mode: "index-unavailable", seeded: false, error: "schema_or_database_unavailable" };
  }
}

/* END worker-base.js */

/* BEGIN catalog-extension.js */
// FoodScan v54: isolated public discovery catalog, additive to the original v52 worker.
// Binding: FOODSCAN_PUBLIC_DB (dedicated D1). Two explicit feature flags are required for writes.
const FSC_VERSION = '55.0.0';
const FSC_SCHEMA_VERSION = 3;
const FSC_ORIGIN = 'https://food-scan.gearuptofit.com';
const FSC_SITEMAP_SIZE = 2000;
const FSC_FILE_LIMIT = 20000;
const FSC_IMAGE_LIMIT = 180000;
const FSC_ENABLED = env => env?.FOODSCAN_PUBLIC_PAGES_ENABLED === '1' && !!env?.FOODSCAN_PUBLIC_DB;
const FSC_AUTO_ENABLED = env => FSC_ENABLED(env) && env?.FOODSCAN_AUTO_INGEST === '1' && typeof env?.FOODSCAN_INGEST_QUEUE?.send === 'function';
const FSC_FRESH_MS = 120 * 86400000; // keep source verification current
const FSC_INGEST_DEDUP_MS = 6 * 3600000; // one queue attempt per barcode per six-hour window
const FSC_SOURCE_MAX_AGE_S = 3 * 366 * 86400;
const fscEsc = val => String(val ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fscPlain = (value, max = 200) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const fscNum = val => typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : null;
function fscCanon(value){
  let code = String(value ?? '');
  if(!validBarcode2(code))return '';
  if(code.length === 14 && code[0] === '0' && validBarcode2(code.slice(1)))code=code.slice(1);
  if(code.length === 13 && code[0] === '0' && validBarcode2(code.slice(1)))code=code.slice(1);
  return code;
}
function fscQuality(raw){
  const reasons=[];
  if(!raw || typeof raw !== 'object')return {eligible:false,reasons:['no_source_record'],parsed:null};
  const code=fscCanon(raw.code);
  if(!code)reasons.push('invalid_gtin');
  if(['petfood','beauty','product'].includes(raw.product_type) || raw.obsolete === 1 || raw.obsolete === 'on')reasons.push('not_current_food');
  const p=code ? parsed(raw,code) : null;
  if(!p){reasons.push('unreadable');return {eligible:false,reasons,parsed:null};}
  const existing = indexWorthy(p);
  if(!existing.index)reasons.push(...existing.reasons);
  if(dataQuality(p).state !== 'usable')reasons.push('source_conflict_or_incomplete');
  if(!fscPlain(raw.product_name || raw.product_name_en || '',180))reasons.push('missing_product_name');
  if(!fscPlain(raw.brands,180))reasons.push('missing_brand');
  if(!safeImage(raw.image_front_small_url || raw.image_front_url || ''))reasons.push('missing_safe_product_photo');
  if(!String(p.ingredients || '').trim() || String(p.ingredients).trim().length < 20)reasons.push('missing_ingredients');
  if(!['100g','100ml'].includes(String(raw.nutrition_data_per || '').toLowerCase()))reasons.push('ambiguous_per100_basis');
  if(!['g','ml'].includes(p.basis) || p.basisSource==='assumed')reasons.push('ambiguous_unit');
  if(!Array.isArray(raw.data_quality_errors_tags) || raw.data_quality_errors_tags.length>0)reasons.push('source_error_flags');
  if(p.nutriScoreConflict || p.nutritionInvalid || contradictions(p).length)reasons.push('contradictory_nutrition');
  const modified=Number(raw.last_modified_t);
  const now=Date.now()/1000;
  if(!Number.isFinite(modified) || modified < 1e9 || modified > now+86400 || modified < now-3*366*86400)reasons.push('source_age_unclear');
  if(!!p.partial || p.provenance === 'local')reasons.push('private_or_preview_record');
  const n=p.nutrition || {};
  if(['kcal','sugars','salt','fat','saturatedFat','carbohydrates','protein'].some(k => !Number.isFinite(n[k])))reasons.push('missing_key_nutrients');
  if(fscPlain(raw.product_name || '',180).length < 3)reasons.push('name_too_short');
  return {eligible:reasons.length===0,reasons:[...new Set(reasons)],parsed:p,code};
}
function fscReducedRecord(raw){
  // Only public, source-provided fields; never copy request data, PII, diary values or handwritten label entries.
  const out={};
  const allowed=['code','product_name','product_name_en','brands','quantity','nutrition_data_per','nutriments','nutriscore_grade','nutrition_grades','nutriscore_score','nutriscore','nova_group','ingredients_text','ingredients_text_en','lang','allergens_tags','traces_tags','data_quality_errors_tags','categories_tags','last_modified_t','image_front_small_url','image_front_url','product_type','obsolete'];
  for(const key of allowed)if(Object.hasOwn(raw,key))out[key]=raw[key];
  // Nutrition arrays from upstream can be large; limit stored fields to the ones used by the parser and SSR.
  if(out.nutriments && typeof out.nutriments==='object')out.nutriments=Object.fromEntries(Object.entries(out.nutriments).filter(([k,v]) => /^[a-z0-9-]+_(?:100g|serving)$/.test(k) && (typeof v==='number'||typeof v==='string')).slice(0,100));
  for(const k of ['product_name','product_name_en','brands','quantity','ingredients_text','ingredients_text_en'])if(typeof out[k]==='string')out[k]=out[k].slice(0,k.startsWith('ingredients')?6000:220);
  for(const k of ['allergens_tags','traces_tags','data_quality_errors_tags','categories_tags'])if(Array.isArray(out[k]))out[k]=out[k].filter(x=>typeof x==='string').slice(0,60);
  return out;
}
function fscMaterialSnapshot(raw){
  // Source timestamps and incidental metadata must not revoke editorial approval.
  // All facts shown to visitors or used for classification remain review-sensitive.
  const r=fscReducedRecord(raw);
  delete r.last_modified_t;
  return JSON.stringify(r);
}
function fscSame(a,b){const x=fscCanon(a),y=fscCanon(b);return !!(x&&y&&x.padStart(14,'0')===y.padStart(14,'0'));}
function fscResponseError(message,status=503,retry=0){
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Product not available · FoodScan</title></head><body style="font:16px/1.6 system-ui;max-width:680px;margin:4rem auto;padding:1rem;color:#17392f"><h1>Product not available</h1><p>${fscEsc(message)}</p><p><a href="/">Scan another food</a> · <a href="/how/">Data limitations</a></p></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, follow','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(retry?{'Retry-After':String(retry)}:{})}});
}
async function fscGetRow(env,code){
  return env.FOODSCAN_PUBLIC_DB.prepare('SELECT barcode,source_modified_at,verified_at,source_json,grade,family,updated_at FROM foodscan_public_products WHERE gtin14=? AND status=\'eligible\' AND publication_state=\'approved\' AND verified_at>=? AND source_modified_at>=? LIMIT 1').bind(code.padStart(14,'0'),Date.now()-FSC_FRESH_MS,Math.floor(Date.now()/1000-FSC_SOURCE_MAX_AGE_S)).first();
}
async function fscUpsert(env,raw, {allowQuarantine=false}={}){
  const q=fscQuality(raw);
  if(!q.code)return {status:'rejected',reason:q.reasons.slice(0,4).join(',')};
  if(!q.eligible && !allowQuarantine)return {status:'rejected',code:q.code,reason:q.reasons.slice(0,4).join(',')};
  const clean=fscReducedRecord(raw);
  clean.code=q.code;
  let serialized=JSON.stringify(clean);
  if(serialized.length > FSC_FILE_LIMIT)return {status:'rejected',reason:'payload_too_large'};
  const p=q.parsed || {name:String(raw.product_name||raw.product_name_en||''),brand:String(raw.brands||''),nutrition:{}};
  const status=q.eligible?'eligible':'quarantined',code=q.code;
  const grade=q.eligible ? assessGrade(p,{estimate:false}).grade : null;
  const family=q.eligible ? (productFamily(p)||'') : '';
  const old=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT status,source_modified_at,verified_at,source_json,publication_state,reviewed_at FROM foodscan_public_products WHERE gtin14=?').bind(code.padStart(14,'0')).first();
  const modified=Number(raw.last_modified_t)||0;
  let materiallyChanged=!old;
  if(old){
    try{materiallyChanged=fscMaterialSnapshot(JSON.parse(old.source_json))!==fscMaterialSnapshot(clean);}
    catch{materiallyChanged=true;}
  }
  if(old && old.status===status && !materiallyChanged && old.source_json===serialized && Number(old.source_modified_at)>=modified && Date.now()-Number(old.verified_at)<86400000)return {status:'unchanged',code,publication_state:old.publication_state};
  // A source edit to ingredients, nutrients, grade, photo, allergens or category requires reapproval.
  const publicationState=q.eligible && !materiallyChanged && old?.publication_state==='approved' ? 'approved' : (q.eligible?'candidate':'rejected');
  const reviewedAt=publicationState==='approved' ? Number(old?.reviewed_at)||0 : 0;
  await env.FOODSCAN_PUBLIC_DB.prepare(`INSERT INTO foodscan_public_products (gtin14,barcode,product_name,brand,family,grade,source_url,source_modified_at,verified_at,source_json,status,quality_reason,updated_at,publication_state,reviewed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(gtin14) DO UPDATE SET barcode=excluded.barcode,product_name=excluded.product_name,brand=excluded.brand,family=excluded.family,grade=excluded.grade,source_url=excluded.source_url,source_modified_at=excluded.source_modified_at,verified_at=excluded.verified_at,source_json=excluded.source_json,status=excluded.status,quality_reason=excluded.quality_reason,updated_at=excluded.updated_at,publication_state=excluded.publication_state,reviewed_at=excluded.reviewed_at`).bind(
    code.padStart(14,'0'),code,fscPlain(p.name,180),fscPlain(p.brand,120),fscPlain(family,40),grade,`https://world.openfoodfacts.org/product/${code}`,modified,Date.now(),serialized,status,q.reasons.join(',').slice(0,200),Date.now(),publicationState,reviewedAt).run();
  return {status,code,publication_state:publicationState,reason:q.reasons.length?q.reasons.slice(0,4).join(','):undefined};
}
async function fscIngestFromScan(response,env){
  // Queue producer only: never publish directly from a visitor scan.
  if(!FSC_AUTO_ENABLED(env)||!response||response.status!==200||response.headers.get('X-FoodScan-Cache')==='STALE')return;
  let data;try{data=await response.json();}catch{return;}
  if(!data?.product || data.product.provenance==='local')return;
  const code=fscCanon(data.product.code);if(!code)return;
  const id=code.padStart(14,'0'),now=Date.now();
  try{
    const current=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT verified_at FROM foodscan_public_products WHERE gtin14=?').bind(id).first();
    if(current && now-Number(current.verified_at)<86400000)return; // no repeated jobs on verified records
    // A single atomic D1 statement prevents multiple edge instances from enqueueing the
    // same previously unknown barcode on every popular scan.
    const claimed=await env.FOODSCAN_PUBLIC_DB.prepare(`INSERT INTO fsc_ingest_queue_lease (gtin14,last_queued_at) VALUES (?,?)
      ON CONFLICT(gtin14) DO UPDATE SET last_queued_at=excluded.last_queued_at
      WHERE fsc_ingest_queue_lease.last_queued_at<? RETURNING gtin14`).bind(id,now,now-FSC_INGEST_DEDUP_MS).first();
    if(!claimed)return;
    try{await env.FOODSCAN_INGEST_QUEUE.send({barcode:code});}
    catch(e){
      // Release only this claim so that later scans can retry a failed enqueue.
      await env.FOODSCAN_PUBLIC_DB.prepare('DELETE FROM fsc_ingest_queue_lease WHERE gtin14=? AND last_queued_at=?').bind(id,now).run().catch(()=>{});
      throw e;
    }
  }catch(e){console.warn('catalog queue failure',String(e?.message||'unknown').slice(0,100));}
}
function fscAdminAuthorized(request,env){
  const expected=String(env.FOODSCAN_INGEST_TOKEN||'');
  if(expected.length<32)return false;
  const candidate=String(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
  let mismatch=0;for(let i=0;i<Math.max(candidate.length,expected.length);i++)mismatch|=(candidate.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);
  return candidate.length===expected.length&&mismatch===0;
}
async function fscProviderBudget(env){
  // Atomic D1 lease: at most ~7.5 catalog reads/min across consumers+admin.
  // This is supplemental to the original scanner's separate provider budget.
  const db=env.FOODSCAN_PUBLIC_DB,now=Date.now();
  await db.prepare('INSERT OR IGNORE INTO fsc_catalog_budget(name,next_allowed_ms) VALUES(?,0)').bind('off_product').run();
  const claim=await db.prepare('UPDATE fsc_catalog_budget SET next_allowed_ms=? WHERE name=? AND next_allowed_ms<=? RETURNING next_allowed_ms').bind(now+8000,'off_product',now).first();
  if(claim)return {ok:true};
  const latest=await db.prepare('SELECT next_allowed_ms FROM fsc_catalog_budget WHERE name=?').bind('off_product').first();
  return {ok:false,seconds:Math.max(2,Math.ceil((Number(latest?.next_allowed_ms||now+8000)-now)/1000))};
}
async function fscReadVerifiedSource(env,code){
  // Only source data. No user names, manually entered labels or uploaded images.
  const contact=String(env.CONTACT_EMAIL||'').trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact))return {error:'contact_identity_required',status:503};
  const budget=await fscProviderBudget(env);
  if(!budget.ok)return {error:'catalog_rate_limited',status:429,retry:budget.seconds};
  const fields=['code','product_name','product_name_en','brands','quantity','nutrition_data_per','nutriments','nutriscore_grade','nutrition_grades','nutriscore_score','nutriscore','nova_group','ingredients_text','ingredients_text_en','lang','allergens_tags','traces_tags','data_quality_errors_tags','categories_tags','last_modified_t','image_front_small_url','image_front_url','product_type','obsolete'];
  let response;
  try{response=await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields.join(',')}`,{headers:{'User-Agent':`FoodScanCatalog/54.0.0 (${contact}; https://food-scan.gearuptofit.com/)`,'Accept':'application/json'},signal:AbortSignal.timeout(7000),cache:'no-store'});}
  catch{return {error:'upstream_connection_failed',status:503,retry:60};}
  if(response.status===429){
    const retry=Number(response.headers.get('retry-after'));
    return {error:'upstream_rate_limited',status:429,retry:Number.isFinite(retry)&&retry>0?Math.min(3600,retry):90};
  }
  if(response.status===404)return {missing:true};
  if(!response.ok){
    const rawRetry=Number(response.headers.get('retry-after'));
    return {error:'upstream_unavailable',status:503,retry:Number.isFinite(rawRetry)&&rawRetry>0?Math.min(3600,Math.ceil(rawRetry)):120};
  }
  let data;try{data=await response.json();}catch{return {error:'source_json_invalid',status:503,retry:60};}
  if(!data?.product || Number(data.status)===0)return {missing:true};
  if(!fscSame(data.product.code,code))return {error:'source_mismatch',status:422};
  return {product:data.product};
}
async function fscAdminIngest(request,env){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405,{'Allow':'POST'});
  if(!FSC_ENABLED(env))return json({error:'catalog_disabled'},503);
  if(String(env.FOODSCAN_INGEST_TOKEN||'').length<32)return json({error:'admin_ingest_not_configured'},503);
  if(!fscAdminAuthorized(request,env))return json({error:'unauthorized'},401);
  if(!/^application\/json\b/i.test(request.headers.get('Content-Type')||''))return json({error:'json_required'},415);
  let body;try{body=JSON.parse(await boundedRequest(request,512));}catch{return json({error:'invalid_body'},400);}
  const code=fscCanon(body?.barcode);if(!code)return json({error:'invalid_gtin'},422);
  let source;try{source=await fscReadVerifiedSource(env,code);}catch(e){console.warn('catalog source check:',String(e?.message).slice(0,100));return json({error:'catalog_source_failed'},503);}
  if(source.error)return json({error:source.error},source.status,source.retry?{'Retry-After':String(source.retry)}:{});
  if(source.missing){
    // Confirmed OFF not-found status revokes any previously approved snapshot.
    await env.FOODSCAN_PUBLIC_DB.prepare("UPDATE foodscan_public_products SET status='quarantined',publication_state='rejected',quality_reason='source_not_found',reviewed_at=0,updated_at=?,verified_at=? WHERE gtin14=?").bind(Date.now(),Date.now(),code.padStart(14,'0')).run();
    return json({status:'not_found',barcode:code},404);
  }
  try{
    const result=await fscUpsert(env,source.product,{allowQuarantine:true});
    return json(result,result.status==='eligible'||result.status==='unchanged'?200:422);
  }catch(e){console.warn('catalog write:',String(e?.message).slice(0,100));return json({error:'catalog_write_failed'},503);}
}
async function fscAdminReview(request,env){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405,{'Allow':'POST'});
  if(!FSC_ENABLED(env))return json({error:'catalog_disabled'},503);
  if(String(env.FOODSCAN_INGEST_TOKEN||'').length<32)return json({error:'admin_secret_not_configured'},503);
  if(!fscAdminAuthorized(request,env))return json({error:'unauthorized'},401);
  if(!/^application\/json\b/i.test(request.headers.get('Content-Type')||''))return json({error:'json_required'},415);
  let body;try{body=JSON.parse(await boundedRequest(request,512));}catch{return json({error:'invalid_body'},400);}
  const code=fscCanon(body?.barcode),action=body?.action;
  if(!code || !['approve','revoke'].includes(action))return json({error:'invalid_request'},422);
  const row=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT status,source_json,verified_at FROM foodscan_public_products WHERE gtin14=?').bind(code.padStart(14,'0')).first();
  if(!row)return json({error:'not_found'},404);
  if(action==='approve'){
    let raw;try{raw=JSON.parse(row.source_json);}catch{return json({error:'invalid_record'},422);}
    if(row.status!=='eligible'||!fscQuality(raw).eligible||Number(row.verified_at)<Date.now()-FSC_FRESH_MS)return json({error:'quality_review_failed'},422);
  }
  const state=action==='approve'?'approved':'rejected';
  await env.FOODSCAN_PUBLIC_DB.prepare('UPDATE foodscan_public_products SET publication_state=?,reviewed_at=?,updated_at=? WHERE gtin14=?').bind(state,action==='approve'?Date.now():0,Date.now(),code.padStart(14,'0')).run();
  return json({barcode:code,publication_state:state});
}
function fscMarkupResult(p,q){
  const a=assessGrade(p,{estimate:false});
  const result=a.status==='reported'?a.grade:'—';
  const tone={A:'#1b9369',B:'#7cbb62',C:'#efc64d',D:'#e58b37',E:'#c64c51'}[result]||'#547e70';
  return {grade:result,color:tone,method:a.method==='2023'?'2023 points reconciled from source':result!=='—'?'Source method not established':'Grade not reported',summary:gradeSentence(p,a)};
}
function fscStructured(p,q,origin,code){
  const a=assessGrade(p,{estimate:false});const url=`${origin}/products/${code}`;
  const ld={"@context":"https://schema.org","@type":"Product",name:p.name,description:describe(p,a),url,image:p.image,[gtinKey(code)]:code,brand:{"@type":"Brand",name:p.brand.split(',')[0].trim()},additionalProperty:[]};
  if(a.status==='reported')ld.additionalProperty.push({"@type":"PropertyValue",name:a.method==='2023'?'Source-reported Nutri-Score (2023)':'Source-reported Nutri-Score (method unspecified)',value:a.grade});
  if(p.nova)ld.additionalProperty.push({"@type":"PropertyValue",name:'NOVA group (source-reported)',value:String(p.nova)});
  return JSON.stringify(ld).replace(/</g,'\\u003c').replace(/\u2028|\u2029/g,' ');
}
function fscInfoPill(label,value){return `<span class="fsc-stat"><small>${fscEsc(label)}</small><strong>${fscEsc(value)}</strong></span>`;}
function fscFacts(p){
  const list=[['Energy','kcal','kcal'],['Sugars','sugars','g'],['Saturated fat','saturatedFat','g'],['Salt','salt','g'],['Fat','fat','g'],['Carbohydrate','carbohydrates','g'],['Protein','protein','g'],['Fibre','fiber','g']];
  const rows=list.filter(([,key])=>Number.isFinite(p.nutrition[key])).map(([label,key,unit])=>`<tr><th scope="row">${label}</th><td>${fscEsc(new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(p.nutrition[key]))} ${unit}</td></tr>`).join('');
  return `<table class="fsc-table"><caption>Source-reported nutrition per ${p.basis==='ml'?'100 ml':'100 g'}</caption><tbody>${rows}</tbody></table>`;
}
function fscRelated(rows,origin,code,subject){
  if(!rows.length)return '';
  const gradeRank={A:0,B:1,C:2,D:3,E:4},baseGrade=assessGrade(subject,{estimate:false}).grade;
  const rendered=[];
  for(const r of rows){
    let other;try{const quality=fscQuality(JSON.parse(r.source_json));if(!quality.eligible)continue;other=quality.parsed;}catch{continue;}
    if(other.basis!==subject.basis)continue;
    const grade=assessGrade(other,{estimate:false}).grade;
    const score=grade&&baseGrade&&gradeRank[grade]!==undefined&&gradeRank[baseGrade]!==undefined
      ? gradeRank[grade]<gradeRank[baseGrade]?'Higher Nutri-Score grade':gradeRank[grade]===gradeRank[baseGrade]?'Same Nutri-Score grade':'Lower Nutri-Score grade'
      : 'Grade not comparable';
    const diff=(key,label)=>{
      const x=subject.nutrition?.[key],y=other.nutrition?.[key];
      if(!Number.isFinite(x)||!Number.isFinite(y))return '';
      const change=Number((y-x).toFixed(1));
      return `${label}: ${change===0?'same':Math.abs(change)+' g '+(change<0?'less':'more')}`;
    };
    const changes=[diff('sugars','Sugar'),diff('saturatedFat','Sat. fat')].filter(Boolean).join(' · ');
    rendered.push(`<li><a href="/products/${fscEsc(r.barcode)}"><span>${fscEsc(other.name)}</span><span class="fsc-grade-small fsc-grade-${fscEsc(grade||'unknown')}">${fscEsc(grade||'—')}</span></a><span class="fsc-mini">${fscEsc(score)}${changes?' · '+fscEsc(changes):''} per ${subject.basis==='ml'?'100 ml':'100 g'}</span><br><a class="fsc-mini" href="/battles/${fscEsc(code)}/${fscEsc(r.barcode)}">Compare facts / challenge a friend</a></li>`);
  }
  if(!rendered.length)return '';
  return `<section class="fsc-panel fsc-related"><h2>Explore product differences</h2><p>Approved source records in the same broad food family, with nutrient differences per equal 100 g/ml basis. Higher grade does not mean allergy-safe or suitable as a direct substitute.</p><ul>${rendered.join('')}</ul></section>`;
}
async function fscRenderProduct(request,env,code,row,relatedRows){
  const url=new URL(request.url),origin=siteOrigin(url,env);
  let raw;try{raw=JSON.parse(row.source_json);}catch{return fscResponseError('This source record is being checked.',503,60);}
  const q=fscQuality(raw);
  if(!q.eligible)return fscResponseError('This record no longer meets our publication checks.',404);
  const p=q.parsed,a=fscMarkupResult(p,q),canonical=`${origin}/products/${code}`;
  const description=describe(p,assessGrade(p,{estimate:false})),brand=fscPlain(p.brand,120);
  const rawImage=safeImage(raw.image_front_small_url)||safeImage(raw.image_front_url);
  const src=`https://world.openfoodfacts.org/product/${code}`;
  const facts=[['Sugar','sugars'],['Saturated fat','saturatedFat'],['Salt','salt']].filter(([,k])=>Number.isFinite(p.nutrition[k]));
  const fileName=fscPlain(p.name,55);
  const ogImage=`${origin}/scorecards/${code}/og.png?v=${row.updated_at||0}`;
  const why=(assessGrade(p,{estimate:false}).anatomy?.why||[]).filter(x=>x.tone!=='note').slice(0,3).map(x=>`<li>${fscEsc(x.text)}</li>`).join('');
  const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${fscEsc(fileName)} nutrition facts & Nutri-Score | FoodScan</title><meta name="description" content="${fscEsc(description)}"><meta name="robots" content="${preview(url,env)?'noindex,follow':'index,follow,max-image-preview:large'}"><link rel="canonical" href="${fscEsc(canonical)}"><link rel="icon" type="image/svg+xml" href="/icon.svg">
  <meta property="og:type" content="product"><meta property="og:site_name" content="FoodScan"><meta property="og:title" content="${fscEsc(p.name)} · Nutri-Score ${fscEsc(a.grade)} | FoodScan"><meta property="og:description" content="${fscEsc(description)}"><meta property="og:url" content="${fscEsc(canonical)}"><meta property="og:image" content="${fscEsc(ogImage)}"><meta property="og:image:alt" content="${fscEsc('FoodScan nutrition scorecard for '+p.name+' using Open Food Facts data')}">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${fscEsc(p.name)} · FoodScan"><meta name="twitter:description" content="${fscEsc(description)}"><meta name="twitter:image" content="${fscEsc(ogImage)}">
  <link rel="stylesheet" href="/public-catalog.css"><link rel="preconnect" href="https://images.openfoodfacts.org" crossorigin>
  <script type="application/ld+json">${fscStructured(p,q,origin,code)}</script><script src="/public-catalog.js" defer></script></head>
  <body><a class="fsc-skip" href="#main">Skip to product</a><div class="fsc-topbar"><div class="fsc-width fsc-toprow"><a class="fsc-brand" href="/" aria-label="FoodScan home"><span class="fsc-brandmark">F</span> FoodScan<span class="fsc-dot">.</span></a><nav aria-label="Primary"><a href="/#/scan">Scan food</a><a href="/how/">How it works</a></nav></div></div>
  <main id="main" class="fsc-width"><div class="fsc-breadcrumb"><a href="/">FoodScan</a><span>›</span><span>Food discovery</span></div>
  <section class="fsc-hero"><div class="fsc-photo"><img src="${fscEsc(rawImage)}" alt="Package photo of ${fscEsc(p.name)} from Open Food Facts" width="400" height="400" fetchpriority="high"><small>Community-submitted package photo</small></div>
  <div class="fsc-intro"><span class="fsc-eyebrow">THE FOODSCAN LABEL CHECK</span><p class="fsc-brandname">${fscEsc(brand)}${p.quantity?' · '+fscEsc(p.quantity):''}</p><h1>${fscEsc(p.name)}</h1><p class="fsc-summary">${fscEsc(a.summary)}</p><div class="fsc-grade-row"><div class="fsc-grade fsc-grade-${fscEsc(a.grade)}" aria-label="Nutri-Score ${fscEsc(a.grade)}">${fscEsc(a.grade)}</div><div><span class="fsc-label">Nutri-Score</span><strong>${fscEsc(a.method)}</strong><small>As reported by Open Food Facts. No independent lab testing.</small></div></div>
  <div class="fsc-values">${facts.map(([name,k])=>fscInfoPill(`${name} / ${p.basis==='ml'?'100 ml':'100 g'}`,`${num(p.nutrition[k])} g`)).join('')}</div>
  <p><a href="/challenge/">Try the 7-discovery Fridge Challenge</a></p><div class="fsc-actions"><button id="fsc-share" class="fsc-button fsc-button-primary" type="button">Share these facts <span aria-hidden="true">↗</span></button><button id="fsc-share-image" class="fsc-button fsc-button-ghost" type="button">Share image</button><button id="fsc-story" class="fsc-button fsc-button-ghost" type="button">Download story card</button></div><p id="fsc-status" role="status" aria-live="polite" class="fsc-status"></p>
  <a class="fsc-subtle" href="/p/${fscEsc(code)}">Open interactive scan report ↗</a></div></section>
  <div class="fsc-columns"><div class="fsc-primary"><section class="fsc-panel"><div class="fsc-sectionhead"><span class="fsc-eyebrow">THE LABEL, EXPLAINED</span><h2>Nutrition facts</h2><p>All figures use a consistent ${p.basis==='ml'?'100 ml':'100 g'} basis. Source values may change when packaging changes.</p></div>${fscFacts(p)}</section>
  ${why?`<section class="fsc-panel"><span class="fsc-eyebrow">WHY THIS GRADE?</span><h2>Nutrition-score factors</h2><ul class="fsc-why">${why}</ul><p class="fsc-mini">The point breakdown is shown only when FoodScan can reconcile the reported 2023 calculation.</p></section>`:''}
  <section class="fsc-panel"><span class="fsc-eyebrow">INGREDIENTS & SAFETY</span><h2>What is in this product?</h2><p class="fsc-ingredients">${fscEsc(p.ingredients)}</p>${allergenLines(p)}<p class="fsc-warning">Allergen information may be incomplete. Always check the actual packaging before consuming a food, especially with allergies.</p></section>
  ${p.nova?`<section class="fsc-panel"><h2>Processing information</h2><p>The source reports <strong>NOVA group ${fscEsc(p.nova)} of 4</strong>. NOVA is a processing classification, not a safety rating.</p></section>`:''}</div>
  <aside class="fsc-secondary">${fscRelated(relatedRows,origin,code,p)}<section class="fsc-panel fsc-sharebox"><span class="fsc-eyebrow">TAKE IT FURTHER</span><h2>What's really in your food?</h2><p>Scan a barcode for its reported grade, nutrition and alternatives.</p><a class="fsc-button fsc-button-primary" href="/#/scan" data-fsc-event="public_scan_cta">Scan yours for free →</a><p class="fsc-mini">No account required.</p></section><section class="fsc-panel fsc-source"><h2>Source & transparency</h2><p>Public record last edited <strong>${new Date(p.sourceModified || Date.now()).toISOString().slice(0,10)}</strong>. ${fieldCount(p)} of 8 core nutrient values reported.</p><p><a href="${src}" target="_blank" rel="nofollow noopener noreferrer">View source record ↗</a></p><p>Open Food Facts contributors · database <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>, product images have separate licensing and third-party rights; verify the original image terms. Reuse may require attribution and share-alike.</p><p>FoodScan reports community-maintained data and is not medical or allergy advice.</p></section></aside></div>
  <section class="fsc-bottom-cta"><h2>Discover what's really in your food.</h2><p>Make sense of labels, compare products, and share what you learn.</p><a class="fsc-button fsc-button-light" href="/#/scan" data-fsc-event="public_scan_cta">Scan your first product →</a></section></main>
  <footer class="fsc-footer"><div class="fsc-width"><span>FoodScan · Evidence before excitement.</span><span><a href="/how/">Methodology</a> · <a href="/">Scanner</a> · <a href="${src}" rel="nofollow noopener noreferrer">Source</a></span></div></footer>
  <div id="fsc-metadata" hidden data-barcode="${fscEsc(code)}" data-url="${fscEsc(canonical)}" data-name="${fscEsc(p.name)}"></div></body></html>`;
  const output=await secureHtml(page,url,env,200,{'Cache-Control':'public, max-age=30, s-maxage=30','X-Content-Type-Options':'nosniff'},'');
  return request.method==='HEAD'?new Response(null,{status:output.status,headers:output.headers}):output;
}
async function fscCatalogPage(request,env,ctx){
  const url=new URL(request.url),input=url.pathname.match(/^\/products\/([0-9]{8,14})\/?$/)?.[1];
  const code=fscCanon(input);
  if(!code)return fscResponseError('No source-verified record is available for that barcode.',404);
  if(url.pathname!==`/products/${code}`)return Response.redirect(`${url.origin}/products/${code}`,301);
  if(!FSC_ENABLED(env))return fscResponseError('The public food catalog is not configured.',503,120);
  const edge = null; // D1 is checked on every request, so revoked or outdated records disappear promptly.
  const cacheKey = new Request(`${url.origin}${url.pathname}`);
  if(edge){try{const hit=await edge.match(cacheKey);if(hit)return request.method==='HEAD'?new Response(null,{status:hit.status,headers:hit.headers}):hit;}catch{}}
  let row,related=[];
  try{
    row=await fscGetRow(env,code);
    if(row?.family)related=(await env.FOODSCAN_PUBLIC_DB.prepare('SELECT barcode,product_name,grade,source_json FROM foodscan_public_products WHERE family=? AND status=\'eligible\' AND publication_state=\'approved\' AND verified_at>=? AND source_modified_at>=? AND gtin14<>? ORDER BY updated_at DESC LIMIT 6').bind(row.family,Date.now()-FSC_FRESH_MS,Math.floor(Date.now()/1000-FSC_SOURCE_MAX_AGE_S),code.padStart(14,'0')).all()).results||[];
  }catch(e){console.warn('catalog read',String(e?.message).slice(0,100));return fscResponseError('The public food catalog is temporarily unavailable.',503,60);}
  if(!row)return fscResponseError('This barcode has not yet passed our public-page evidence checks. You can still scan it in FoodScan.',404);
  const output=await fscRenderProduct(request,env,code,row,related);
  if(edge && output.status===200 && request.method==='GET' && typeof ctx?.waitUntil==='function')
    ctx.waitUntil(edge.put(cacheKey,output.clone()).catch(()=>{}));
  return output;
}
async function fscImageData(url){
  const address=safeImage(url);
  if(!address)return '';
  try{
    const r=await fetch(address,{headers:{'Accept':'image/jpeg,image/png,image/webp'},signal:AbortSignal.timeout(4500)});
    if(!r.ok)return '';
    const mime=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!['image/jpeg','image/png','image/webp'].includes(mime))return '';
    if(Number(r.headers.get('content-length')||0)>FSC_IMAGE_LIMIT)return '';
    const buf=await r.arrayBuffer();if(buf.byteLength>FSC_IMAGE_LIMIT)return '';
    const bytes=new Uint8Array(buf);let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return `data:${mime};base64,${btoa(bin)}`;
  }catch{return '';}
}
function fscWrap(str,maximum=27,maxLines=3){
  const words=fscPlain(str,145).split(' '),lines=[];let line='';
  for(const w of words){if((line+' '+w).trim().length>maximum && line){lines.push(line);line=w;}else line=(line+' '+w).trim();}
  if(line)lines.push(line);
  const out=lines.slice(0,maxLines);
  if(lines.length>maxLines)out[maxLines-1]=out[maxLines-1].slice(0,maximum-2)+'…';
  return out;
}
async function fscScorecard(request,env,code,ctx){
  const c=fscCanon(code);
  if(!c || !FSC_ENABLED(env))return fscResponseError('Scorecard unavailable',404);
  const url=new URL(request.url),edge=null; // do not retain revoked scorecards in an edge cache
  const cacheKey=new Request(`${url.origin}/scorecards/${c}.svg`);
  if(edge){try{const hit=await edge.match(cacheKey);if(hit)return request.method==='HEAD'?new Response(null,{status:hit.status,headers:hit.headers}):hit;}catch{}}
  let row;try{row=await fscGetRow(env,c);}catch{return fscResponseError('Scorecard temporarily unavailable',503,60);}
  if(!row)return fscResponseError('Scorecard unavailable',404);
  let raw;try{raw=JSON.parse(row.source_json);}catch{return fscResponseError('Scorecard unavailable',404);}
  const q=fscQuality(raw);if(!q.eligible)return fscResponseError('Scorecard unavailable',404);
  const p=q.parsed,a=fscMarkupResult(p,q), origin=siteOrigin(new URL(request.url),env), per100=p.basis==='ml'?'100 ml':'100 g';
  const image=await fscImageData(raw.image_front_small_url||raw.image_front_url);
  const names=fscWrap(p.name,28,3),values=[['SUGAR','sugars'],['SAT. FAT','saturatedFat'],['SALT','salt']].filter(([,key])=>Number.isFinite(p.nutrition[key]));
  const lines=names.map((line,i)=>`<text x="85" y="${240+i*78}" font-size="70" font-weight="800" fill="#17362c">${fscEsc(line)}</text>`).join('');
  const lastName=240+(names.length-1)*78;
  const picture=image?`<rect x="205" y="620" width="670" height="660" rx="62" fill="#fff"/><image href="${image}" x="250" y="655" width="580" height="580" preserveAspectRatio="xMidYMid meet"/>`:`<rect x="205" y="620" width="670" height="660" rx="62" fill="#fff"/><text x="540" y="930" text-anchor="middle" font-weight="800" font-size="94" fill="#2a8068">FoodScan</text>`;
  const highlights=values.map(([label,key],i)=>{const x=85+(i%3)*320;return `<rect x="${x}" y="1450" width="292" height="190" rx="26" fill="#fff"/><text x="${x+22}" y="1510" font-size="26" letter-spacing="2" font-weight="700" fill="#61756d">${label}</text><text x="${x+22}" y="1598" font-size="56" font-weight="800" fill="#17362c">${fscEsc(num(p.nutrition[key]))} g</text>`;}).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><title>${fscEsc(p.name)} food facts by FoodScan</title><desc>Source-reported Nutri-Score and nutrition facts per ${per100}. Always verify the package.</desc><rect width="1080" height="1920" fill="#f5f1e7"/><path d="M0 0H1080V45H0Z" fill="#1e765d"/><text x="85" y="135" font-family="Arial,system-ui,sans-serif" font-size="50" font-weight="800" fill="#1c5d49">FoodScan ●</text><text x="85" y="180" font-size="24" font-family="Arial,system-ui,sans-serif" fill="#678275">KNOW YOUR FOOD. SHARE THE FACTS.</text><g font-family="Arial,system-ui,sans-serif">${lines}<text x="85" y="${Math.max(lastName+65,525)}" font-size="31" font-weight="600" fill="#72817a">${fscEsc(fscPlain(p.brand,44))}</text>${picture}<rect x="730" y="1140" width="240" height="240" rx="70" fill="${a.color}" stroke="#f5f1e7" stroke-width="14"/><text x="850" y="1290" text-anchor="middle" font-size="126" font-weight="900" fill="#fff">${a.grade==='—'?'?':a.grade}</text><text x="85" y="1398" font-size="32" font-weight="600" fill="#1c5946">NUTRI-SCORE · ${a.grade==='—'?'NOT REPORTED':'SOURCE-REPORTED'}</text>${highlights}<rect x="0" y="1740" width="1080" height="180" fill="#1c5946"/><text x="85" y="1805" font-size="38" font-weight="800" fill="#fff">Scan your food for free →</text><text x="85" y="1858" font-size="28" fill="#e0f5eb">food-scan.gearuptofit.com</text></g><text x="85" y="1693" font-family="Arial,system-ui,sans-serif" font-size="24" fill="#52695e">Per ${per100} · Open Food Facts data ODbL / image CC BY-SA · Check pack and allergens</text></svg>`;
  const output=new Response(request.method==='HEAD'?null:svg,{status:200,headers:{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public, max-age=86400, s-maxage=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",'Access-Control-Allow-Origin':'*'}});
  if(edge && request.method==='GET' && typeof ctx?.waitUntil==='function')ctx.waitUntil(edge.put(cacheKey,output.clone()).catch(()=>{}));
  return output;
}
async function fscSitemap(request,env){
  if(!FSC_ENABLED(env))return new Response('Catalog not enabled',{status:404,headers:{'X-Robots-Tag':'noindex'}});
  const url=new URL(request.url), origin=siteOrigin(url,env);
  let xml;
  try{
    if(url.pathname==='/sitemap-catalog.xml'){
      const total=(await env.FOODSCAN_PUBLIC_DB.prepare("SELECT COUNT(*) AS total FROM foodscan_public_products WHERE status='eligible' AND publication_state='approved' AND verified_at>=? AND source_modified_at>=?").bind(Date.now()-FSC_FRESH_MS,Math.floor(Date.now()/1000-FSC_SOURCE_MAX_AGE_S)).first())?.total||0;
      const pages=Math.ceil(total/FSC_SITEMAP_SIZE);
      xml=`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({length:Math.min(pages,1000)},(_,i)=>`<sitemap><loc>${origin}/sitemap-catalog-${i}.xml</loc></sitemap>`).join('')}</sitemapindex>`;
    }else{
      const number=Number(url.pathname.match(/^\/sitemap-catalog-(\d{1,4})\.xml$/)?.[1]);
      if(!Number.isSafeInteger(number)||number<0||number>=1000)return new Response('Not found',{status:404});
      const rows=(await env.FOODSCAN_PUBLIC_DB.prepare("SELECT barcode,updated_at FROM foodscan_public_products WHERE status='eligible' AND publication_state='approved' AND verified_at>=? AND source_modified_at>=? ORDER BY gtin14 ASC LIMIT ? OFFSET ?").bind(Date.now()-FSC_FRESH_MS,Math.floor(Date.now()/1000-FSC_SOURCE_MAX_AGE_S),FSC_SITEMAP_SIZE,FSC_SITEMAP_SIZE*number).all()).results||[];
      xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.filter(r=>!!fscCanon(r.barcode)).map(r=>`<url><loc>${origin}/products/${r.barcode}</loc><lastmod>${new Date(r.updated_at).toISOString().slice(0,10)}</lastmod></url>`).join('')}</urlset>`;
    }
  }catch(e){console.warn('catalog sitemap',String(e?.message).slice(0,100));return new Response('Catalog temporarily unavailable',{status:503,headers:{'Retry-After':'60','X-Robots-Tag':'noindex'}});}
  return new Response(request.method==='HEAD'?null:xml,{status:200,headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=30, s-maxage=30','X-Content-Type-Options':'nosniff',...(preview(url,env)?{'X-Robots-Tag':'noindex,follow'}:{})}});
}
async function fscPublicRoute(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/public-products/ingest')return fscAdminIngest(request,env,ctx);
  if(path==='/api/public-products/review')return fscAdminReview(request,env);
  if(path.startsWith('/products/')){
    if(!['GET','HEAD'].includes(request.method))return fscResponseError('Method not allowed',405);
    return fscCatalogPage(request,env,ctx);
  }
  if(/^\/scorecards\/[0-9]{8,14}\.svg$/.test(path)){
    if(!['GET','HEAD'].includes(request.method))return fscResponseError('Method not allowed',405);
    return fscScorecard(request,env,path.match(/^\/scorecards\/([0-9]+)\.svg$/)[1],ctx);
  }
  if(path==='/sitemap-catalog.xml'||/^\/sitemap-catalog-\d{1,4}\.xml$/.test(path)){
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
    return fscSitemap(request,env);
  }
  return null;
}

export {
  worker_default as default
};

/* END catalog-extension.js */

/* BEGIN og-render.js */
// Dependency-free, deterministic edge PNG renderer for source-backed 1200x630 social previews.
// Uses a compact bitmap display font so it runs in a Cloudflare Worker without canvas/WASM/services.
const fs54Font = {
 'A':['01110','10001','10001','11111','10001','10001','10001'],
 'B':['11110','10001','10001','11110','10001','10001','11110'],
 'C':['01111','10000','10000','10000','10000','10000','01111'],
 'D':['11110','10001','10001','10001','10001','10001','11110'],
 'E':['11111','10000','10000','11110','10000','10000','11111'],
 'F':['11111','10000','10000','11110','10000','10000','10000'],
 'G':['01111','10000','10000','10111','10001','10001','01111'],
 'H':['10001','10001','10001','11111','10001','10001','10001'],
 'I':['11111','00100','00100','00100','00100','00100','11111'],
 'J':['00111','00010','00010','00010','10010','10010','01100'],
 'K':['10001','10010','10100','11000','10100','10010','10001'],
 'L':['10000','10000','10000','10000','10000','10000','11111'],
 'M':['10001','11011','10101','10101','10001','10001','10001'],
 'N':['10001','11001','10101','10011','10001','10001','10001'],
 'O':['01110','10001','10001','10001','10001','10001','01110'],
 'P':['11110','10001','10001','11110','10000','10000','10000'],
 'Q':['01110','10001','10001','10001','10101','10010','01101'],
 'R':['11110','10001','10001','11110','10100','10010','10001'],
 'S':['01111','10000','10000','01110','00001','00001','11110'],
 'T':['11111','00100','00100','00100','00100','00100','00100'],
 'U':['10001','10001','10001','10001','10001','10001','01110'],
 'V':['10001','10001','10001','10001','10001','01010','00100'],
 'W':['10001','10001','10001','10101','10101','10101','01010'],
 'X':['10001','10001','01010','00100','01010','10001','10001'],
 'Y':['10001','10001','01010','00100','00100','00100','00100'],
 'Z':['11111','00001','00010','00100','01000','10000','11111'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00110','01000','10000','11111'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],
 '5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['01111','10000','10000','11110','10001','10001','01110'],
 '7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],
 '9':['01110','10001','10001','01111','00001','00001','11110'],
 ' ':['00000','00000','00000','00000','00000','00000','00000'],
 '.':['00000','00000','00000','00000','00000','00110','00110'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 ':':['00000','00110','00110','00000','00110','00110','00000'],
 '/':['00001','00001','00010','00100','01000','10000','10000'],
 '?':['01110','10001','00001','00010','00100','00000','00100'],
 '+':['00000','00100','00100','11111','00100','00100','00000'],
 '&':['01100','10010','10100','01000','10101','10010','01101'],
 ',':['00000','00000','00000','00000','00110','00110','00100'],
 "'":['00100','00100','01000','00000','00000','00000','00000']
};
// The compact edge rasterizer supports Latin glyphs. Transliterate Greek rather than
// silently erasing Greek product names on social previews; page HTML keeps native text.
const fs55GreekLatin=Object.freeze({'Α':'A','Β':'V','Γ':'G','Δ':'D','Ε':'E','Ζ':'Z','Η':'I','Θ':'TH','Ι':'I','Κ':'K','Λ':'L','Μ':'M','Ν':'N','Ξ':'X','Ο':'O','Π':'P','Ρ':'R','Σ':'S','Τ':'T','Υ':'Y','Φ':'F','Χ':'CH','Ψ':'PS','Ω':'O','Ϊ':'I','Ϋ':'Y'});
function fs54TextSafe(value){
  return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().split('').map(c=>fs55GreekLatin[c]||c).join('').replace(/[^A-Z0-9 .:'?&,+/-]/g,' ').replace(/\s+/g,' ').trim();
}
function fs54Painter(w,h){
  const rgba=new Uint8Array(w*h*4);
  const rect=(x,y,ww,hh,c)=>{x=Math.max(0,Math.floor(x));y=Math.max(0,Math.floor(y));const ex=Math.min(w,Math.floor(x+ww)),ey=Math.min(h,Math.floor(y+hh));for(let j=y;j<ey;j++){let k=(j*w+x)*4;for(let i=x;i<ex;i++){rgba[k++]=c[0];rgba[k++]=c[1];rgba[k++]=c[2];rgba[k++]=255;}}};
  const text=(value,x,y,scale,c,maxChars=42)=>{const txt=fs54TextSafe(value).slice(0,maxChars);for(const char of txt){for(let j=0;j<7;j++){const line=(fs54Font[char]||fs54Font['?'])[j];for(let i=0;i<5;i++)if(line[i]==='1')rect(x+i*scale,y+j*scale,scale,scale,c);}x+=6*scale;}return x;};
  return {rgba,rect,text};
}
function fs54PngChunk(type,body){
  const typeBytes=new TextEncoder().encode(type),out=new Uint8Array(12+body.length);const v=new DataView(out.buffer);
  v.setUint32(0,body.length);out.set(typeBytes,4);out.set(body,8);
  let crc=0xffffffff;for(let i=4;i<body.length+8;i++){crc^=out[i];for(let j=0;j<8;j++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}
  v.setUint32(body.length+8,(crc^0xffffffff)>>>0);return out;
}
async function fs54EncodePng(w,h,rgba){
  const scan=new Uint8Array(h*(w*4+1));for(let y=0;y<h;y++)scan.set(rgba.subarray(y*w*4,(y+1)*w*4),y*(w*4+1)+1);
  const input=new Blob([scan]).stream().pipeThrough(new CompressionStream('deflate'));
  const compressed=new Uint8Array(await new Response(input).arrayBuffer());
  const ihdr=new Uint8Array(13),dv=new DataView(ihdr.buffer);dv.setUint32(0,w);dv.setUint32(4,h);ihdr[8]=8;ihdr[9]=6;
  const chunks=[Uint8Array.of(137,80,78,71,13,10,26,10),fs54PngChunk('IHDR',ihdr),fs54PngChunk('IDAT',compressed),fs54PngChunk('IEND',new Uint8Array())];
  const out=new Uint8Array(chunks.reduce((a,x)=>a+x.length,0));let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
}
async function fs54RenderOg(p,grade){
  const {rgba,rect,text}=fs54Painter(1200,630);const cream=[246,241,230],forest=[24,75,58],light=[237,248,241],muted=[83,108,96];
  const tone={A:[16,148,94],B:[117,179,74],C:[204,165,45],D:[225,130,40],E:[198,68,68]}[grade]||[97,126,118];
  rect(0,0,1200,630,cream);rect(0,0,1200,22,[30,124,93]);rect(0,515,1200,115,forest);
  rect(34,52,890,422,[255,255,255]);rect(944,52,223,422,light);rect(965,205,180,180,tone);
  text('FOODSCAN',66,80,9,forest);text('THE LABEL, EXPLAINED',67,161,4,muted,30);
  const name=fs54TextSafe(p?.name||'Food product')||'FOOD PRODUCT';const words=name.split(' ');const lines=[];let line='';
  for(const word of words){
    if((line+' '+word).trim().length>21 && line){lines.push(line);line=word;}
    else line=(line+' '+word).trim();
  }
  if(line)lines.push(line);
  if(!lines.length)lines.push('FOOD PRODUCT');
  if(lines.length>3)lines[2]=lines[2].slice(0,17)+'...';
  lines.slice(0,3).forEach((v,i)=>text(v,67,230+i*67,6,forest,22));
  text(fs54TextSafe(p?.brand||'')||'COMMUNITY SOURCE',68,443,3,muted,46);
  text(grade&&/^[A-E]$/.test(grade)?grade:'?',1000,238,23,[255,255,255],1);
  text('NUTRI',980,103,5,forest,10);text('SCORE',980,143,5,forest,10);
  const details=[['SUGAR',p?.nutrition?.sugars],['SAT FAT',p?.nutrition?.saturatedFat],['SALT',p?.nutrition?.salt]];
  details.forEach(([label,value],i)=>{const x=65+i*290;text(label,x,539,4,[204,237,218],12);text(typeof value==='number'&&Number.isFinite(value)?`${Number(value.toFixed(1))} G`:'N/A',x,578,5,[255,255,255],14);});
  text(p?.basis==='ml'?'PER 100 ML':'PER 100 G',977,442,2,muted,14);
  text('OFF DATA',977,466,2,muted,11);
  return fs54EncodePng(1200,630,rgba);
}

// Two independently reviewed product records. Visual preference challenge, never a health verdict.
async function fs55RenderBattleOg(p1,p2){
  const {rgba,rect,text}=fs54Painter(1200,630);
  const forest=[24,73,55],cream=[245,242,233],accent=[28,126,92],muted=[74,105,90],white=[255,255,255];
  rect(0,0,1200,630,cream);rect(0,0,1200,18,accent);
  text('FOODSCAN BATTLE',50,48,8,forest,24);
  text('WHICH WOULD YOU CHOOSE?',52,121,4,muted,36);
  function card(p,x){
    rect(x,192,547,315,white);rect(x,192,547,12,accent);
    const name=(fs54TextSafe(p.name||'Food product')||'FOOD PRODUCT').split(' ');let line='',rows=[];
    for(const word of name){if((line+' '+word).trim().length>16&&line){rows.push(line);line=word;}else line=(line+' '+word).trim();}
    if(line)rows.push(line);
    rows.slice(0,2).forEach((v,i)=>text(v,x+24,229+i*42,4,forest,17));
    text(p.brand||'SOURCE REPORTED',x+24,329,3,muted,28);
    const score=fscMarkupResult(p).grade,tones={A:[25,151,101],B:[109,171,73],C:[209,165,44],D:[225,127,45],E:[196,68,71]};
    rect(x+426,222,96,100,tones[score]||muted);text(score==='—'?'?':score,x+441,243,10,white,1);
    const facts=[['SUGAR',p.nutrition?.sugars],['SAT FAT',p.nutrition?.saturatedFat]];
    facts.forEach(([label,val],i)=>{const y=390+i*51;text(label,x+25,y,3,muted,10);text(typeof val==='number'&&Number.isFinite(val)?`${Number(val.toFixed(1))} G`:'UNKNOWN',x+224,y,4,forest,13);});
  }
  card(p1,42);card(p2,612);
  rect(0,527,1200,103,forest);text('PREFERENCE IS NOT A HEALTH VERDICT',46,547,4,white,44);
  text('SOURCE: OPEN FOOD FACTS | CHECK ALLERGENS & PACK',47,592,3,[196,225,211],68);
  return fs54EncodePng(1200,630,rgba);
}

/* END og-render.js */

/* BEGIN growth-extension.js */
// FoodScan 54: public discovery, quality-gated comparisons, anti-abuse voting and branded OG images.
function fs54Pair(a,b){
  const x=fscCanon(a),y=fscCanon(b);
  if(!x||!y||fscSame(x,y))return null;
  return x.padStart(14,'0')<y.padStart(14,'0')?[x,y]:[y,x];
}
function fs54Noindex(message,status=404){return fscResponseError(message,status);}
async function fs54ReadPair(env,a,b){
  if(!FSC_ENABLED(env))return null;
  const pair=fs54Pair(a,b);if(!pair)return null;
  const [left,right]=await Promise.all(pair.map(code=>fscGetRow(env,code)));
  if(!left||!right||!left.family||left.family!==right.family)return null;
  let p1,p2;
  try{p1=fscQuality(JSON.parse(left.source_json));p2=fscQuality(JSON.parse(right.source_json));}catch{return null;}
  if(!p1.eligible||!p2.eligible||p1.parsed.basis!==p2.parsed.basis)return null;
  return {pair,rows:[left,right],products:[p1.parsed,p2.parsed]};
}
function fs54BattleCard(p,code){
  const g=fscMarkupResult(p),source=`https://world.openfoodfacts.org/product/${code}`;
  return `<div class="fsc-fighter"><div class="fsc-photo"><img src="${fscEsc(safeImage(p.image)||'')}" alt="Source package photo of ${fscEsc(p.name)}" loading="lazy" width="300" height="300"></div><p class="fsc-eyebrow">${fscEsc(p.brand)}</p><h2>${fscEsc(p.name)}</h2><p class="fsc-mini">Barcode ${fscEsc(code)}</p><div class="fsc-grade-row"><span class="fsc-grade fsc-grade-${fscEsc(g.grade)}">${fscEsc(g.grade)}</span><span><strong>Nutri-Score</strong><br><small>${fscEsc(g.method)}</small></span></div>${fscFacts(p)}<p><a href="/products/${fscEsc(code)}">View verified facts</a> · <a href="${source}" rel="nofollow noopener noreferrer">Source record</a></p></div>`;
}
async function fs54BattlePage(request,env){
  const url=new URL(request.url),route=url.pathname.match(/^\/battles\/([0-9]{8,14})\/([0-9]{8,14})\/?$/);
  if(!route)return fs54Noindex('Invalid product comparison');
  const pair=fs54Pair(route[1],route[2]);if(!pair)return fs54Noindex('Invalid product comparison');
  if(url.pathname!==`/battles/${pair[0]}/${pair[1]}`)return Response.redirect(`${url.origin}/battles/${pair[0]}/${pair[1]}`,301);
  let info;try{info=await fs54ReadPair(env,...pair);}catch{return fs54Noindex('Comparison temporarily unavailable',503);}
  if(!info)return fs54Noindex('These products are not yet verified, comparable public records. Try the FoodScan scanner.');
  const [p1,p2]=info.products,[a,b]=pair,origin=siteOrigin(url,env),link=`${origin}/battles/${a}/${b}`;
  let votes={votes_a:0,votes_b:0};
  try{votes=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT votes_a,votes_b FROM fsc_battle_votes WHERE pair=?').bind(`${a}:${b}`).first()||votes;}catch{}
  const voteReady=Boolean(env.FOODSCAN_TURNSTILE_SITE_KEY&&env.FOODSCAN_TURNSTILE_SECRET);
  const basis=p1.basis==='ml'?'100 ml':'100 g';
  const allergy1=(p1.allergens||[]).map(x=>String(x)),allergy2=(p2.allergens||[]).map(x=>String(x));
  const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${fscEsc(p1.name)} vs ${fscEsc(p2.name)} | FoodScan comparison</title>
   <meta name="description" content="Compare source-reported nutrition per ${basis} for two broad-category food products. Different ingredients and allergens may matter."><meta name="robots" content="noindex,follow"><link rel="canonical" href="${fscEsc(link)}"><meta property="og:title" content="Food Battle: ${fscEsc(p1.name)} vs ${fscEsc(p2.name)}"><meta property="og:description" content="Which would you choose? Compare nutrition facts, ingredients and allergens. No account needed."><meta property="og:image" content="${origin}/battle-cards/${a}/${b}.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Two verified food products compared using source-reported grades and nutrition"><meta property="og:url" content="${fscEsc(link)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${origin}/battle-cards/${a}/${b}.png"><link rel="stylesheet" href="/public-catalog.css"><link rel="stylesheet" href="/growth-ui.css"><script defer src="/battle-ui.js"></script></head>
   <body><a class="fsc-skip" href="#main">Skip to battle</a><div class="fsc-topbar"><div class="fsc-width fsc-toprow"><a class="fsc-brand" href="/">FoodScan<span class="fsc-dot">.</span></a><nav><a href="/challenge/">Fridge Challenge</a><a href="/#/scan">Scan food</a></nav></div></div><main id="main" class="fsc-width"><div class="fsc-breadcrumb"><a href="/">FoodScan</a> › <a href="/challenge/">Challenges</a> › Food Battle</div>
   <section class="fsc-battle-intro"><span class="fsc-eyebrow">FOODSCAN BATTLE</span><h1>Which would you choose?</h1><p>Compare two products with source-reported facts, not a popularity-based health verdict. These are broad-category comparisons, not guaranteed substitutes.</p><button id="fsc-share-battle" class="fsc-button fsc-button-primary">Challenge a friend ↗</button><span id="fsc-battle-status" role="status" aria-live="polite"></span></section>
   <section class="fsc-fighters" aria-label="Product facts">${fs54BattleCard(p1,a)}${fs54BattleCard(p2,b)}</section>
   <section class="fsc-panel fsc-battle-vote"><h2>Your choice</h2><p>Voting reflects preference only. It does not establish nutritional superiority.</p><p id="fsc-tally">${Number(votes.votes_a)||0} chose the first product · ${Number(votes.votes_b)||0} chose the second.</p>
    ${voteReady?`<div class="cf-turnstile" data-sitekey="${fscEsc(env.FOODSCAN_TURNSTILE_SITE_KEY)}" data-action="foodbattle"></div><div class="fsc-actions"><button data-choice="a" class="fsc-button fsc-button-primary">Choose ${fscEsc(p1.name)}</button><button data-choice="b" class="fsc-button fsc-button-ghost">Choose ${fscEsc(p2.name)}</button></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`:'<p class="fsc-warning">Voting will be available after bot protection is configured. Comparison and sharing work now.</p>'}
   </section><section class="fsc-panel"><h2>Before swapping</h2><p>The nutrition basis is ${basis}. Ingredient profiles, serving sizes and allergens can differ. Nutri-Score is not a food-safety or allergy clearance rating.</p><p>Reported allergens may be incomplete. Always check the physical packs.</p></section>
   <section class="fsc-bottom-cta"><h2>Try your own Food Battle</h2><p>Scan another product and explore source-backed comparisons.</p><a href="/#/scan" class="fsc-button fsc-button-light">Scan yours free</a></section></main>
   <footer class="fsc-footer"><div class="fsc-width">Nutrition: Open Food Facts contributors (ODbL). Package images are community sourced. <a href="/how/">Method and limitations</a>.</div></footer>
   <div id="fsc-battle-data" hidden data-a="${fscEsc(a)}" data-b="${fscEsc(b)}" data-link="${fscEsc(link)}"></div></body></html>`;
  const battleCsp = voteReady ? CSP.replace("script-src 'self'", "script-src 'self' https://challenges.cloudflare.com").replace("connect-src 'self'", "connect-src 'self' https://challenges.cloudflare.com").replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") + '; frame-src https://challenges.cloudflare.com' : CSP;
  const output=await secureHtml(page,url,env,200,{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex,follow','Content-Security-Policy':battleCsp},'');
  return request.method==='HEAD'?new Response(null,{status:output.status,headers:output.headers}):output;
}
async function fs54BattleVote(request,env){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!FSC_ENABLED(env))return json({error:'catalog_disabled'},503);
  const url=new URL(request.url);
  if(request.headers.get('Origin')!==url.origin || request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'origin_not_allowed'},403);
  if(!env.FOODSCAN_TURNSTILE_SECRET||!env.FOODSCAN_TURNSTILE_SITE_KEY)return json({error:'voting_not_configured'},503);
  let data;try{data=JSON.parse(await boundedRequest(request,1024));}catch{return json({error:'invalid_request'},400);}
  const pair=fs54Pair(data?.a,data?.b),choice=data?.choice,token=String(data?.turnstile||'');
  if(!pair||!['a','b'].includes(choice)||token.length<10||token.length>2048)return json({error:'invalid_vote'},422);
  let info;try{info=await fs54ReadPair(env,...pair);}catch{return json({error:'database_unavailable'},503);}
  if(!info)return json({error:'not_comparable'},404);
  const form=new FormData();form.set('secret',String(env.FOODSCAN_TURNSTILE_SECRET));form.set('response',token);
  let valid=false;
  try{const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form,signal:AbortSignal.timeout(5000)});if(response.ok){const verify=await response.json();valid=verify.success===true && (!verify.action||verify.action==='foodbattle') && (!verify.hostname||verify.hostname===url.hostname);}}catch{}
  if(!valid)return json({error:'verification_failed'},403);
  const [a,b]=pair,key=`${a}:${b}`;
  try{
    await env.FOODSCAN_PUBLIC_DB.prepare('INSERT INTO fsc_battle_votes(pair,code_a,code_b,votes_a,votes_b,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(pair) DO UPDATE SET votes_a=votes_a+excluded.votes_a,votes_b=votes_b+excluded.votes_b,updated_at=excluded.updated_at').bind(key,a,b,choice==='a'?1:0,choice==='b'?1:0,Date.now()).run();
    const tally=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT votes_a,votes_b FROM fsc_battle_votes WHERE pair=?').bind(key).first();
    return json({votes_a:tally?.votes_a??0,votes_b:tally?.votes_b??0});
  }catch{return json({error:'vote_persistence_failed'},503);}
}
async function fs54PublicLookup(request,env){
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  const code=fscCanon(new URL(request.url).searchParams.get('barcode'));
  if(!code)return json({public:false});
  if(!FSC_ENABLED(env))return json({public:false});
  try{const row=await fscGetRow(env,code);if(!row)return json({public:false});const q=fscQuality(JSON.parse(row.source_json));return json(q.eligible?{public:true,url:`/products/${code}`}:{public:false});}
  catch{return json({public:false});}
}
async function fs54OgPage(request,env,code){
  const c=fscCanon(code);if(!c||!FSC_ENABLED(env))return fs54Noindex('Card unavailable');
  let row;try{row=await fscGetRow(env,c);}catch{return fs54Noindex('Card unavailable',503);}
  if(!row)return fs54Noindex('Card unavailable');
  let q;try{q=fscQuality(JSON.parse(row.source_json));}catch{return fs54Noindex('Card unavailable');}
  if(!q.eligible)return fs54Noindex('Card unavailable');
  const g=fscMarkupResult(q.parsed).grade;
  let data;try{data=await fs54RenderOg(q.parsed,g);}catch{return fs54Noindex('Card generation temporarily unavailable',503);}
  return new Response(request.method==='HEAD'?null:data,{status:200,headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=60, s-maxage=60','X-Content-Type-Options':'nosniff','Content-Length':String(data.length)}});
}
async function fs55BattleImage(request,env,a,b){
  if(!['GET','HEAD'].includes(request.method))return fs54Noindex('Method not allowed',405);
  const pair=fs54Pair(a,b);if(!pair)return fs54Noindex('Invalid comparison');
  if(a!==pair[0]||b!==pair[1])return Response.redirect(`${new URL(request.url).origin}/battle-cards/${pair[0]}/${pair[1]}.png`,308);
  let info;try{info=await fs54ReadPair(env,...pair);}catch{return fs54Noindex('Card temporarily unavailable',503);}
  if(!info)return fs54Noindex('Verified comparison unavailable');
  let image;try{image=await fs55RenderBattleOg(...info.products);}catch{return fs54Noindex('Card generation unavailable',503);}
  return new Response(request.method==='HEAD'?null:image,{status:200,headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=60, s-maxage=60','Content-Length':String(image.byteLength),'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}});
}
async function fs54Route(request,env,ctx){
  const path=new URL(request.url).pathname;
  const battleImage=path.match(/^\/battle-cards\/([0-9]{8,14})\/([0-9]{8,14})\.png$/);
  if(battleImage)return fs55BattleImage(request,env,battleImage[1],battleImage[2]);
  if(path==='/api/public-products/lookup')return fs54PublicLookup(request,env);
  if(path==='/api/battles/vote')return fs54BattleVote(request,env);
  if(/^\/battles\/\d{8,14}\/\d{8,14}\/?$/.test(path)){
    if(!['GET','HEAD'].includes(request.method))return fs54Noindex('Method not allowed',405);
    return fs54BattlePage(request,env);
  }
  const og=path.match(/^\/scorecards\/([0-9]{8,14})\/og\.png$/);
  if(og){if(!['GET','HEAD'].includes(request.method))return fs54Noindex('Method not allowed',405);return fs54OgPage(request,env,og[1]);}
  if(path==='/challenge')return Response.redirect(`${new URL(request.url).origin}/challenge/`,308);
  return null;
}

/* END growth-extension.js */

/* v63: cloud backup, hardened (replaces the v52-v62 token endpoint).
 * Off unless FOODSCAN_SYNC=1 and a D1 binding FOOD_DB exist. The shipped app does not call it, so it is dormant by default.
 * The backup key is a client-generated 256-bit secret sent only in the Authorization header (never in the address, so it is never logged);
 * the server stores only its SHA-256, accepts only an opaque base64 blob (a readable JSON backup is refused), caps size, rows and write
 * rate, answers unknown keys with a plain 404, lets the owner delete, and forgets backups after 180 days. */
const FS63_SYNC_MAX = 262144, FS63_SYNC_ROWS = 20000, FS63_SYNC_RETENTION = 180 * 86400000, FS63_SYNC_GAP = 5000;
const fs63SyncReady = new WeakMap();
const fs63Sha = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');
const fs63Token = request => (request.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9_-]{43,128})$/)?.[1] || null;
async function fs63Sync(request, env) {
  if (env?.FOODSCAN_SYNC !== '1' || !env?.FOOD_DB) return error('route_not_found', 'Unknown API route.', 404);
  if (new URL(request.url).searchParams.has('token')) return error('token_in_url_refused', 'Send the backup key in the Authorization header, never in the address.', 400);
  const db = env.FOOD_DB, headers = { 'Cache-Control': 'no-store' };
  try {
    if (!fs63SyncReady.has(db)) fs63SyncReady.set(db, db.prepare('CREATE TABLE IF NOT EXISTS cloud_sync_v2(id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)').run().catch(e => { fs63SyncReady.delete(db); throw e; }));
    await fs63SyncReady.get(db);
    if (request.method === 'POST') {
      const token = fs63Token(request); if (!token) return error('unauthorized', 'A 256-bit backup key is required.', 401, {}, headers);
      let body; try { body = JSON.parse(await boundedRequest(request, FS63_SYNC_MAX + 2048)); } catch { return error('bad_request', 'Send JSON.', 400, {}, headers); }
      const data = body?.data;
      if (typeof data !== 'string' || !data || data.length > FS63_SYNC_MAX || !/^[A-Za-z0-9+/_=-]+$/.test(data)) return error('bad_request', 'The backup must be one encrypted base64 blob of at most 256 KB.', 400, {}, headers);
      const id = await fs63Sha(token), now = Date.now();
      const existing = await db.prepare('SELECT updated_at FROM cloud_sync_v2 WHERE id=?').bind(id).first();
      if (existing && now - existing.updated_at < FS63_SYNC_GAP) return error('rate_limited', 'Wait a few seconds between backups.', 429, {}, { ...headers, 'Retry-After': '5' });
      if (!existing) {
        const count = async () => (await db.prepare('SELECT COUNT(*) AS n FROM cloud_sync_v2').first())?.n || 0;
        if (await count() >= FS63_SYNC_ROWS) {
          await db.prepare('DELETE FROM cloud_sync_v2 WHERE updated_at<?').bind(now - FS63_SYNC_RETENTION).run();
          if (await count() >= FS63_SYNC_ROWS) return error('capacity', 'Backups are full. Try again later.', 503, {}, headers);
        }
      }
      await db.prepare('INSERT INTO cloud_sync_v2(id,payload,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at').bind(id, data, now, now).run();
      return new Response(null, { status: 204, headers });
    }
    if (request.method === 'GET' || request.method === 'DELETE') {
      const token = fs63Token(request); if (!token) return error('unauthorized', 'A 256-bit backup key is required.', 401, {}, headers);
      const id = await fs63Sha(token);
      if (request.method === 'DELETE') { await db.prepare('DELETE FROM cloud_sync_v2 WHERE id=?').bind(id).run(); return new Response(null, { status: 204, headers }); }
      const row = await db.prepare('SELECT payload, updated_at FROM cloud_sync_v2 WHERE id=? AND updated_at>=?').bind(id, Date.now() - FS63_SYNC_RETENTION).first();
      if (!row) return error('not_found', 'No backup found.', 404, {}, headers);
      return json({ status: 'success', data: row.payload, updatedAt: row.updated_at }, 200, headers);
    }
    return error('method_not_allowed', 'Use GET, POST or DELETE.', 405, {}, headers);
  } catch { return error('sync_error', 'Cloud backup failed.', 500, {}, headers); }
}
/* END v63 sync */

/* v60.1: static source catalogue, isolated from upstream availability. */
const fs60Files=new Map(),fs61AssetText=new WeakMap(),fs61AssetChecks=new WeakMap();
const FS61_ROOT='/assets/greece-r20261030/';
async function fs60ReadAsset(request,env,name){
 if(!/^(index|categories|search|codes-\d{2}|part-[a-z0-9-]+)\.json$/.test(name))throw new Error('catalogue_path');
 const key=new URL(request.url).origin+'|'+name;
 if(!fs60Files.has(key)){
  const task=(async()=>{const response=await env.ASSETS.fetch(new Request(new URL(FS61_ROOT+name,request.url)));if(!response.ok)throw new Error('catalogue_asset_missing');const raw=await response.text();if(raw.length>4*1024*1024)throw new Error('catalogue_asset_too_large');const data=JSON.parse(raw);if(data.schema!==2)throw new Error('catalogue_asset_invalid');fs61AssetText.set(data,raw);return data;})();
  fs60Files.set(key,task);task.catch(()=>{if(fs60Files.get(key)===task)fs60Files.delete(key);});
  if(fs60Files.size>48)for(const old of fs60Files.keys())if(old!==key&&!old.endsWith('|index.json')){fs60Files.delete(old);break;}
 }
 return fs60Files.get(key);
}
async function fs60Manifest(request,env,allowExpired=false){
 const m=await fs60ReadAsset(request,env,'index.json');
 if(m.schema!==2||m.country!=='greece'||!Number.isFinite(m.exportedAt)||m.exportedAt<=0||m.exportedAt>Date.now()+300000||Date.now()-m.exportedAt>(allowExpired?365:90)*86400000)throw new Error('catalogue_expired');
 return m;
}
async function fs61Rows(request,env,m,files){
 const products=[],failures=[];
 for(let i=0;i<files.length;i+=3){
  const batch=await Promise.allSettled(files.slice(i,i+3).map(async name=>{
   if(!m.shards[name])throw new Error('catalogue_path');const data=await fs60ReadAsset(request,env,name);
   if(data.revision!==m.revision||data.exportedAt!==m.exportedAt||!Array.isArray(data.products)||data.products.length!==m.shards[name].count)throw new Error('catalogue_revision_mismatch');
   if(m.integrity==='sha256'){
    if(!fs61AssetChecks.has(data)){const check=(async()=>{const bytes=new TextEncoder().encode(fs61AssetText.get(data)||'');const expected=m.shards[name];if(bytes.length!==expected.bytes)throw new Error('catalogue_integrity_failed');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected.sha256)throw new Error('catalogue_integrity_failed');})();fs61AssetChecks.set(data,check);check.catch(()=>{fs61AssetChecks.delete(data);fs60Files.delete(new URL(request.url).origin+'|'+name);});}
    await fs61AssetChecks.get(data);
   }return data.products;
  }));
  for(let j=0;j<batch.length;j++){const item=batch[j];if(item.status==='fulfilled')products.push(...item.value);else failures.push({file:files[i+j],code:String(item.reason.message||'catalogue_unavailable')});}
 }
 return {products,failures};
}
async function fs60LocalAlternatives(request,env){
 const u=new URL(request.url),country=marketCountry(request),category=u.searchParams.get('category')||'',page=marketPage(request);
 if(u.searchParams.get('refresh')==='1')return null;
 if(!/^[a-z]{2}:[a-z0-9][a-z0-9-]{1,100}$/.test(category))return error('invalid_category','Choose a source-listed food category.',400);
 if(!page)return error('invalid_page','Page must be from 1 to 50.',400);
 try{
  const m=await fs60Manifest(request,env),index=await fs60ReadAsset(request,env,'categories.json');
  if(index.revision!==m.revision)throw new Error('catalogue_revision_mismatch');
  const data=await fs61Rows(request,env,m,index.categories[category]||[]);
  const products=data.products.filter(p=>(!country||p.countries_tags?.includes('en:'+country))&&p.categories_tags?.includes(category));
  if(!products.length&&(data.failures.length||country&&country!=='greece'))return null;
  products.sort((a,b)=>String(a.code).localeCompare(String(b.code)));const size=48,total=products.length;
  return json({products:products.slice((page-1)*size,page*size),country:country||null,category,page,total,hasMore:page*size<total,partial:false,recordMode:'dated-catalogue-record-v1',provider:'off-catalogue',source:'Open Food Facts daily CSV export',fetchedAt:m.exportedAt,
   catalogue:{status:data.failures.length?'partial':'ready',datasetMarket:'greece',market:country||'any',marketCoverage:country&&country!=='greece'?'listed-subset':'greece-snapshot',failedFiles:data.failures,count:m.productCount,exportedAt:m.exportedAt,revision:m.revision,source:m.source},version:VERSION,coverage:m.coverage},200,{'X-FoodScan-Cache':'BUNDLED-CATALOGUE','Cache-Control':'public, max-age=300'});
 }catch{return null;}
}
async function fs60LocalProduct(request,env,code){
 try{
  const m=await fs60Manifest(request,env,true),key=String(code).padStart(14,'0'),bucket=String(Number(key.slice(-6))%32).padStart(2,'0'),index=await fs60ReadAsset(request,env,`codes-${bucket}.json`);
  if(index.revision!==m.revision)return null;const file=index.codes?.[key];if(!file)return null;
  const data=await fs61Rows(request,env,m,[file]),product=data.products.find(p=>String(p.code).padStart(14,'0')===key);if(!product)return null;
  return json({status:1,product,fetchedAt:m.exportedAt,catalogueSnapshot:{provider:'openfoodfacts-daily-export',exportedAt:m.exportedAt,revision:m.revision,source:m.source},version:VERSION},200,{'X-FoodScan-Cache':'DATED-CATALOGUE'});
 }catch{return null;}
}
