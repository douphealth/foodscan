/**
 * FoodScan 11.21: conservative food-type comparisons.
 * Never imply that foods sharing only a broad OFF category are interchangeable.
 * Nutri-Score is source-reported; we do not calculate or invent grades.
 */
export * from '/assets/release-11.3.0/lib/nutrition.js';
import {betterChoices as upstreamBetterChoices, usableCategories as upstreamCategories} from '/assets/release-11.3.0/lib/nutrition.js';
import {sourceIntegrity} from '/assets/release-11.20.0/source-trust.js';

const GRADES='ABCDE';
const GENERIC=new Set([
 'foods','plant-based-foods-and-beverages','plant-based-foods','beverages','non-alcoholic-beverages',
 'snacks','sweet-snacks','salty-snacks','breakfasts','cereals-and-their-products','dairies',
 'spreads','sweet-spreads','savoury-spreads','fruits-and-vegetables-based-foods','desserts',
 'groceries','meals','frozen-foods','fats','packaged-foods','vegetarian-foods','vegan-foods'
]);
const GROUPS=[
 ['cocoa-spread',['chocolate-spreads','hazelnut-spreads','chocolate-hazelnut-spreads','cocoa-spreads']],
 ['peanut-butter',['peanut-butters','peanut-butter']],
 ['nuts',['nuts','walnuts','almonds','hazelnuts','cashew-nuts','peanuts','pistachios']],
 ['jam',['jams','marmalades','fruit-jams','fruit-spreads']],
 ['yogurt',['yogurts','greek-style-yogurts','flavoured-yogurts','plain-yogurts']],
 ['milk',['milks','cow-milks','semi-skimmed-milks','whole-milks','skimmed-milks']],
 ['plant-drink',['plant-based-milks','oat-milks','almond-milks','soy-milks']],
 ['breakfast-cereal',['breakfast-cereals','mueslis','corn-flakes','cereal-flakes']],
 ['cereal-bar',['cereal-bars','energy-bars','protein-bars']],
 ['biscuit',['biscuits','cookies','crackers']],
 ['bread',['breads','sliced-breads','wholemeal-breads','white-breads']],
 ['pasta',['pastas','spaghettis','dry-pastas','noodles']],
 ['rice',['rice','rices']],
 ['soda',['sodas','colas','soft-drinks','carbonated-drinks']],
 ['juice',['fruit-juices','fruit-based-beverages','fruit-nectars']],
 ['chocolate',['chocolates','milk-chocolates','dark-chocolates']],
 ['chips',['chips-and-fries','potato-chips','crisps']],
 ['ice-cream',['ice-creams','frozen-desserts']],
 ['pizza',['pizzas']],
 ['tomato-sauce',['tomato-sauces','pasta-sauces']],
 ['cheese',['cheeses']],
 ['butter',['butters','margarines']]
];
const tagOf=p=>new Set(upstreamCategories(p).map(t=>t.slice(3)));
function groupFor(p){
 const tags=tagOf(p);
 for(const [name,tokens] of GROUPS)if(tokens.some(k=>tags.has(k)))return name;
 return '';
}
/**
 * 'direct' denotes similar food *type*, not brand/taste/allergen equivalence.
 * Missing taxonomic evidence is treated as unknown, not compatible.
 */
export function matchFoodType(base,candidate){
 if(!base||!candidate)return {compatible:false,reason:'Product data unavailable'};
 if(base.basis!==candidate.basis||!['g','ml'].includes(base.basis))return {compatible:false,reason:'Different nutritional basis'};
 const a=groupFor(base),b=groupFor(candidate);
 if(a||b){
  if(a&&b&&a===b)return {compatible:true,tier:'same-food-type',reason:'Same specific food type'};
  return {compatible:false,reason:'Different or unverified food type'};
 }
 const ta=tagOf(base),tb=tagOf(candidate);
 const shared=[...ta].filter(t=>tb.has(t)&&!GENERIC.has(t));
 if(shared.length)return {compatible:true,tier:'shared-specific-category',reason:'Shared specific category'};
 return {compatible:false,reason:'Only broad or unverified categories overlap'};
}
export function betterChoices(base,candidates,profile,category){
 const baseGrade=GRADES.indexOf(base?.nutriScore||'');
 if(baseGrade<0||baseGrade===0)return {items:[],plan:upstreamBetterChoices(base,[],profile,category).plan};
 const filtered=(Array.isArray(candidates)?candidates:[]).filter(p=>{
  const grade=GRADES.indexOf(p?.nutriScore||'');
  if(grade<0||grade>=baseGrade)return false;
  if(!matchFoodType(base,p).compatible)return false;
  const quality=sourceIntegrity(p);
  return quality.status==='usable'||(p?.partial===true&&quality.status==='limited');
 });
 const original=upstreamBetterChoices(base,filtered,profile,category);
 return {...original,items:original.items.map(item=>({
  ...item,comparisonType:matchFoodType(base,item.product).tier,
  verification:item.product.partial===true?'preview':'source-record'
 }))};
}
