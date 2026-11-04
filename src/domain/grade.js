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

