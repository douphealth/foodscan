/** Data normalization shared by the UI and tests. Never interpret absent facts as zero. */
export const VERSION = '9.1.0';
export const FIELDS = [
  ['kcal', 'Energy', 'kcal', 'energy-kcal'], ['protein', 'Protein', 'g', 'proteins'],
  ['carbohydrates', 'Carbohydrate', 'g', 'carbohydrates'], ['sugars', 'Sugars', 'g', 'sugars'],
  ['fat', 'Fat', 'g', 'fat'], ['saturatedFat', 'Saturated fat', 'g', 'saturated-fat'],
  ['fiber', 'Fiber', 'g', 'fiber'], ['salt', 'Salt', 'g', 'salt']
];
export const cleanBarcode = value => String(value ?? '').replace(/[\s-]/g, '');
export function validBarcode(value) {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value) || /^0+$/.test(value)) return false;
  let sum = 0;
  for (let i = value.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(value[i]) * weight;
  return (10 - sum % 10) % 10 === Number(value.at(-1));
}
export function barcodeError(value) {
  const code = cleanBarcode(value);
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return 'Use the 8, 12, 13 or 14 digits printed below the barcode. Spaces and hyphens are okay.';
  if (!validBarcode(code)) return 'The barcode check digit does not match. Check the number on the package and try again.';
  return '';
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = (v, limit = 500) => typeof v === 'string' ? v.trim().slice(0, limit) : '';
export function safeImage(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && (u.hostname === 'images.openfoodfacts.org' || u.hostname === 'static.openfoodfacts.org') ? u.href : ''; } catch { return ''; }
}
export function number(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}
export function nutrientNumber(value) {
  if (typeof value === 'string' && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return number(Number(value));
  return number(value);
}
function nutrition(n, suffix) {
  const output = Object.fromEntries(FIELDS.map(([key, , , field]) => [key, nutrientNumber(n[`${field}_${suffix}`])]));
  const kj = nutrientNumber(n[`energy-kj_${suffix}`]) ?? nutrientNumber(n[`energy_${suffix}`]);
  let converted = false;
  if (output.kcal === null && kj !== null) { output.kcal = kj / 4.184; converted = true; }
  // Missing energy is not zero. Only standardized *_100g and *_serving fields are read.
  output.sodium = nutrientNumber(n[`sodium_${suffix}`]);
  const sodiumDerived = output.sodium === null && output.salt !== null;
  output.sodium = output.sodium !== null ? output.sodium * 1000 : sodiumDerived ? output.salt * 400 : null;
  return { values: output, converted, sodiumDerived };
}
export function parseProduct(payload, requestedCode, now = Date.now()) {
  if (!payload || typeof payload !== 'object' || payload.status === 0 || payload.status === 'failure' || payload.result?.id === 'product_not_found') return null;
  const p = payload.product;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  if (['beauty','petfood','product'].includes(p.product_type) || String(p.obsolete)==='1' || p.obsolete==='on') return null;
  const code = cleanBarcode(p.code || requestedCode);
  if (!validBarcode(code) || (validBarcode(requestedCode) && code.padStart(14,'0') !== requestedCode.padStart(14,'0'))) return null;
  const n = p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {};
  const total = nutrition(n, '100g'), serving = nutrition(n, 'serving');
  const grade = text(p.nutriscore_grade || p.nutrition_grades).toUpperCase();
  const tags = v => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string').slice(0, 50).map(x => x.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')))] : [];
  const lastModified = number(p.last_modified_t);
  const meaningful = ['product_name', 'product_name_en', 'product_name_el', 'brands', 'ingredients_text', 'quantity'].some(k => text(p[k])) || FIELDS.some(([k]) => total.values[k] !== null);
  if (!meaningful) return null;
  return {
    barcode: code, name: text(p.product_name || p.product_name_en || p.product_name_el, 240) || `Product ${code}`,
    brand: text(p.brands, 240), image: safeImage(p.image_front_url || p.image_url), quantity: text(p.quantity, 100),
    serving: text(p.serving_size, 180), nutrition: total.values, servingNutrition: serving.values,
    energyConverted: total.converted, servingEnergyConverted: serving.converted,
    nutriScore: /^[A-E]$/.test(grade) ? grade : null,
    nova: [1,2,3,4].includes(p.nova_group) ? p.nova_group : null,
    ingredients: text(p.ingredients_text || p.ingredients_text_en || p.ingredients_text_el, 14000),
    allergens: tags(p.allergens_tags), traces: tags(p.traces_tags),
    sourceUrl: `https://world.openfoodfacts.org/product/${code}`,
    fetchedAt: number(payload.fetchedAt) ?? now,
    sourceModified: lastModified && lastModified < now / 1000 + 86400 ? lastModified * 1000 : null,
    schemaVersion: 3, ...extraFields(p), partial: p.partial === true, sodiumDerived: total.sodiumDerived, servingSodiumDerived: serving.sodiumDerived
  };
}
/** Validate saved/imported records and reconstruct every trusted field; never trust imported HTML or URLs. */
export function validateStoredProduct(value) {
  if (!value || typeof value !== 'object' || !validBarcode(value.barcode) || !text(value.name)) return null;
  const makeNutrition = v => Object.fromEntries([...FIELDS.map(([k]) => [k, number(v?.[k])]), ['sodium', number(v?.sodium) ?? (number(v?.salt) !== null ? number(v?.salt) * 400 : null)]]);
  const strings = v => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 50).map(x => text(x, 120)) : [];
  return {
    barcode: value.barcode, name: text(value.name,240), brand: text(value.brand,240), image: safeImage(value.image),
    quantity: text(value.quantity,100), serving: text(value.serving,180), nutrition: makeNutrition(value.nutrition),
    servingNutrition: makeNutrition(value.servingNutrition), energyConverted: value.energyConverted === true,
    servingEnergyConverted: value.servingEnergyConverted === true,
    nutriScore: /^[A-E]$/.test(value.nutriScore) ? value.nutriScore : null,
    nova: [1,2,3,4].includes(value.nova) ? value.nova : null,
    ingredients: text(value.ingredients,14000), allergens: strings(value.allergens), traces: strings(value.traces),
    sourceUrl: value.provenance === 'local' ? '' : `https://world.openfoodfacts.org/product/${value.barcode}`,
    fetchedAt: number(value.fetchedAt) ?? 0, sourceModified: number(value.sourceModified), schemaVersion: 3,
    labels: cleanTags(value.labels), analysis: cleanTags(value.analysis), categories: cleanTags(value.categories), countries: cleanTags(value.countries),
    additivesCount: number(value.additivesCount), addedSugars: number(value.addedSugars), qualityWarnings: cleanTags(value.qualityWarnings),
    basis: ['g','ml'].includes(value.basis)?value.basis:null, servingAmount:number(value.servingAmount), servingUnit:['g','ml'].includes(value.servingUnit)?value.servingUnit:null,
    provenance:value.provenance==='local'?'local':'off', partial:value.partial===true, sodiumDerived:value.sodiumDerived===true || (number(value.nutrition?.sodium)===null && number(value.nutrition?.salt)!==null), servingSodiumDerived:value.servingSodiumDerived===true
  };
}
let displayLocale='en-GB';
export function setLocale(locale){try{displayLocale=Intl.getCanonicalLocales(locale)[0]||'en-GB';}catch{displayLocale='en-GB';}}
export function formatNumber(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '\u2014';
  if (v > 0 && v < .01) return '<0.01';
  return new Intl.NumberFormat(displayLocale, { maximumFractionDigits: v < 1 ? 2 : 1 }).format(v);
}
export const formatValue = (v, unit = 'g') => v == null ? '\u2014' : `${formatNumber(v)} ${unit}`;
export const availableNutrients = p => FIELDS.filter(([key]) => p.nutrition[key] !== null).length;
export const hasServing = p => Boolean(p.serving) && FIELDS.some(([key]) => p.servingNutrition[key] !== null);
export function snapshotLabel(timestamp) {
  if (!timestamp) return 'Saved record; date unavailable';
  return `Database snapshot: ${new Date(timestamp).toLocaleString('en', {month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}`;
}

/** Additional structured facts, kept as source tags rather than interpreted marketing claims. */
const cleanTags = v => Array.isArray(v) ? [...new Set(v.filter(x=>typeof x==='string' && x.length<180).slice(0,100))] : [];
function unit(value) {const u=String(value||'').toLowerCase();return ['g','kg','mg'].includes(u)?'g':['ml','cl','dl','l'].includes(u)?'ml':null;}
function extraFields(p) {
 const servingMatch=String(p.serving_size||'').match(/(?:^|\s|\()(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
 const rawServing=nutrientNumber(p.serving_quantity),scale={g:1,kg:1000,mg:0.001,ml:1,cl:10,dl:100,l:1000}[String(p.serving_quantity_unit||'').toLowerCase()];
 const servingAmount=rawServing!=null&&scale?rawServing*scale:(servingMatch?Number(servingMatch[1].replace(',','.')):null);
 const servingUnit=unit(p.serving_quantity_unit) || (servingMatch?servingMatch[2].toLowerCase():null);
 const quantityUnit=String(p.quantity||'').match(/\b(?:\d+(?:[.,]\d+)?)\s*(kg|mg|g|ml|cl|dl|l)\s*$/i)?.[1];
 return {labels:cleanTags(p.labels_tags),analysis:cleanTags(p.ingredients_analysis_tags),categories:cleanTags(p.categories_tags),countries:cleanTags(p.countries_tags),
  additivesCount:nutrientNumber(p.additives_n),addedSugars:nutrientNumber(p.nutriments?.['added-sugars_100g']),qualityWarnings:cleanTags(p.data_quality_errors_tags),
  basis:unit(p.product_quantity_unit)||unit(quantityUnit),servingAmount,servingUnit,provenance:'off'};
}
