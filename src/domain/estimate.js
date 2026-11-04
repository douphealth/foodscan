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

