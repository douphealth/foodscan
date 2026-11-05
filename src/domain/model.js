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

