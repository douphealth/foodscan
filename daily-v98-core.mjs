/* FoodScan 98.1 · logic of the Daily check-in (daily-v98.js): no DOM here, so qa/daily98.test.mjs runs it in Node.
 *
 * What changed from the 98.0.0 draft, each measured or checked against the app's own data model:
 *  - a food's lens verdict follows the EU nutrition-claim thresholds (Regulation 1924/2006), including the stricter drinks limit;
 *  - the energy check uses the EU labelling factors (carbs 4, protein 4, fat 9, fibre 2 kcal/g) and is informational: the app's own
 *    dataQuality() stays the only judge of "needs checking" (on the 9,270 catalogue products with all four numbers the draft's 4-4-9 rule called 41
 *    correct labels wrong, 17 sugar-alcohol and 24 high-fibre foods, and missed 54 that do not add up);
 *  - ingredients are a string in the product model (the draft looked for an array, so every product "lacked" them);
 *  - averages are shown per 100 g of the foods logged, never as a share of a daily limit: a one-tap check-in has no portion size. */

export const MAX_COMPARE = 3;

export const num = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
export const r1 = n => Math.round(n * 10) / 10;

/** The numbers of a product record, as the product model names them (src/domain/model.js: kcal, protein, carbohydrates, sugars, fat, saturatedFat, fiber, salt). */
export function numbers(p) {
  const n = p?.nutrition || {};
  return { kcal: num(n.kcal), carbs: num(n.carbohydrates), sugars: num(n.sugars), fat: num(n.fat), sat: num(n.saturatedFat), protein: num(n.protein), fiber: num(n.fiber), salt: num(n.salt) };
}

const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ALCOHOL = /alcoholic|\bbeers?\b|\bwines?\b|\bspirits?\b|liqueur|vodka|whisk|brandy|\brum\b|\bgin\b|cider|ouzo|tsipouro|μπυρα|κρασι|οινοπνευμ|αλκοολουχ/;
const NO_ALCOHOL = /non[- ]?alcoholic|alcohol[- ]?free|\bsans alcool|χωρις αλκοολ|μη αλκοολουχ|αναλκοολ/;   // "en:non-alcoholic-beverages" is a soft drink, not a beer
export const isAlcoholic = p => { const ctx = fold(`${(p?.categories || []).join(' ')} ${p?.name || ''}`); return !NO_ALCOHOL.test(ctx) && ALCOHOL.test(ctx); };
const POLYOLS = /polyol|sorbitol|maltitol|xylitol|erythritol|isomalt|mannitol|lactitol|sugar alcohol|πολυολ|σορβιτολ|μαλτιτολ|ξυλιτολ|ερυθριτολ|ισομαλτ|μαννιτολ|λακτιτολ/;

/** Energy against the macros with the EU labelling factors. Returns null when a number is missing; { skip } when the macros cannot explain the energy
 *  (alcoholic drinks, sugar alcohols); else { rep, est, ok, dir }. Tolerance: 20 % or 25 kcal, whichever is larger (rounding on a label). */
export function energyCheck(p) {
  const n = numbers(p);
  if ([n.kcal, n.carbs, n.fat, n.protein].some(v => v == null)) return null;
  if (isAlcoholic(p)) return { skip: 'alcohol' };
  if (POLYOLS.test(fold(p.ingredients || ''))) return { skip: 'polyols' };
  const est = n.carbs * 4 + n.protein * 4 + n.fat * 9 + (n.fiber ?? 0) * 2;
  const ok = Math.abs(n.kcal - est) <= Math.max(25, est * 0.2);
  return { rep: n.kcal, est, ok, dir: n.kcal > est ? 'high' : 'low' };
}

/** What the card shows for one record. `dq` is the app's dataQuality(p); it alone decides "low". */
export function auditProduct(p, dq) {
  const n = numbers(p);
  const energy = energyCheck(p);
  const fields = [
    ['kcal', n.kcal != null], ['sugars', n.sugars != null], ['sat. fat', n.sat != null], ['salt', n.salt != null],
    ['protein', n.protein != null], ['fibre', n.fiber != null],
    ['ingredients', typeof p?.ingredients === 'string' ? p.ingredients.trim().length > 2 : Array.isArray(p?.ingredients) && p.ingredients.length > 0],
    ['NOVA', [1, 2, 3, 4].includes(Number(p?.nova))]
  ];
  const have = fields.filter(f => f[1]).length, missing = fields.filter(f => !f[1]).map(f => f[0]);
  const state = dq?.state || 'usable';
  const energyWarn = !!(energy && energy.ok === false);
  const tier = state === 'blocked' ? 'low' : (state === 'limited' || state === 'local' || have < 6 || energyWarn) ? 'med' : 'high';
  return { tier, energy, have, total: fields.length, missing, reasons: state === 'blocked' ? (dq.reasons || []) : [], n };
}

/* ---- My Lens: EU nutrition-claim thresholds ------------------------------------------------------------ */
const per = p => (p?.basis === 'ml' ? 'ml' : 'g');
export const LENSES = [
  { id: 'lowSugar', en: 'Low sugar', el: 'Χαμηλή ζάχαρη',
    ruleEn: 'EU “low sugars”: at most 5 g per 100 g, or 2.5 g per 100 ml', ruleEl: 'ΕΕ «χαμηλή ζάχαρη»: έως 5 g ανά 100 g ή 2,5 g ανά 100 ml',
    test: (n, p) => (n.sugars == null ? null : n.sugars <= (per(p) === 'ml' ? 2.5 : 5)) },
  { id: 'highProt', en: 'High protein', el: 'Υψηλή πρωτεΐνη',
    ruleEn: 'EU “high protein”: protein gives at least 20 % of the energy', ruleEl: 'ΕΕ «υψηλή πρωτεΐνη»: η πρωτεΐνη δίνει τουλάχιστον το 20% της ενέργειας',
    test: n => (n.protein == null || n.kcal == null || n.kcal <= 0 ? null : (n.protein * 4) / n.kcal >= 0.2) },
  { id: 'lowSalt', en: 'Low salt', el: 'Χαμηλό αλάτι',
    ruleEn: 'EU “low salt”: at most 0.3 g salt (0.12 g sodium) per 100 g or 100 ml', ruleEl: 'ΕΕ «χαμηλό αλάτι»: έως 0,3 g αλάτι (0,12 g νάτριο) ανά 100 g ή 100 ml',
    test: n => (n.salt == null ? null : n.salt <= 0.3) },
  { id: 'highFiber', en: 'High fibre', el: 'Πλούσιο σε φυτικές ίνες',
    ruleEn: 'EU “high fibre”: at least 6 g per 100 g', ruleEl: 'ΕΕ «υψηλή περιεκτικότητα σε φυτικές ίνες»: τουλάχιστον 6 g ανά 100 g',
    test: n => (n.fiber == null ? null : n.fiber >= 6) },
  { id: 'lessProc', en: 'Not ultra-processed', el: 'Όχι υπερεπεξεργασμένο',
    ruleEn: 'NOVA group 1 to 3 (not group 4, ultra-processed)', ruleEl: 'Ομάδα NOVA 1 έως 3 (όχι η 4, υπερεπεξεργασμένα)',
    test: (n, p) => ([1, 2, 3, 4].includes(Number(p?.nova)) ? Number(p.nova) <= 3 : null) }
];
/** true / false / null (unknown) for one lens id on a product-like record: { nutrition... } or the flat compare record. */
export function lensVerdict(id, rec) {
  const def = LENSES.find(l => l.id === id);
  if (!def || !rec) return null;
  const flat = rec.nutrition ? numbers(rec) : { kcal: num(rec.kcal), sugars: num(rec.sugars), protein: num(rec.protein), fiber: num(rec.fiber), salt: num(rec.salt) };
  return def.test(flat, rec);
}

/* ---- Daily check-in -------------------------------------------------------------------------------------- */
const dayMs = 86400000;
const toUtc = day => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const fromUtc = ms => new Date(ms).toISOString().slice(0, 10);

/** Consecutive days with a check-in, ending today (or yesterday, so the streak is not lost before today's first check-in). Day strings are local calendar dates. */
export function computeStreak(days, today) {
  const set = new Set([...days].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  if (!set.size) return 0;
  let ms = toUtc(today);
  if (!set.has(fromUtc(ms))) ms -= dayMs;
  let streak = 0;
  while (set.has(fromUtc(ms))) { streak++; ms -= dayMs; }
  return streak;
}

/** Averages over the foods logged today: per 100 g (or ml) of those foods, NOT the amount eaten. null when no logged food has the number. */
export function dayStats(rows) {
  const avg = key => { const v = rows.map(r => r[key]).filter(x => x != null); return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  return { count: rows.length, sugars: avg('sugars'), salt: avg('salt') };
}

/* ---- Backup ----------------------------------------------------------------------------------------------- */
export const BACKUP_KEY = /^(?:fs13:|foodscan[:.])/;
export const BACKUP_MAX_CHARS = 3_000_000;
/** Validates a backup file's text and returns [key, value] pairs to restore. Throws on anything that is not a FoodScan backup. */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > BACKUP_MAX_CHARS) throw new Error('too_large');
  const doc = JSON.parse(text);
  if (!doc || doc.app !== 'FoodScan' || typeof doc.data !== 'object' || !doc.data || Array.isArray(doc.data)) throw new Error('invalid_backup');
  const out = [];
  for (const [k, v] of Object.entries(doc.data)) if (BACKUP_KEY.test(k) && typeof v === 'string') out.push([k, v]);
  if (!out.length) throw new Error('empty_backup');
  return out;
}
