/** FoodScan 11.20 | Deterministic source-integrity gate.
 * Never infer a product's identity or nutrient values from a marketing photograph.
 * User-entered packaging facts are labeled local/unverified, not source validated.
 */
const keys=['kcal','protein','carbohydrates','sugars','fat','saturatedFat','fiber','salt','sodium'];
const severe=/(nutrition.*(?:values-are-all-identical|energy-value-in-kcal-does-not-match-value-in-kj|energy-value-in-kj-does-not-match-value-in-kcal|100g-.*-greater-than-100|nutrient-values-exceed)|foodscan:(?:energy-contradiction|identity-unconfirmed|invalid-nutrient-data))/i;
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const safeTags=x=>Array.isArray(x)?x.filter(s=>typeof s==='string').slice(0,40):[];
export function sourceIntegrity(product,raw=null){
 if(!product)return {status:'invalid',reasons:['No source record']};
 if(product.provenance==='local')return {status:'local',reasons:['Entered from packaging by the user; not independently verified'],canCalculate:true};
 const n=product.nutrition||{},tags=[...safeTags(product.qualityWarnings),...safeTags(raw?.data_quality_errors_tags)];
 const reasons=[];
 if(tags.some(tag=>severe.test(tag)))reasons.push('The public database flags inconsistent or duplicated nutrition values.');
 const energy=finite(n.kcal),fat=finite(n.fat),protein=finite(n.protein),carbohydrates=finite(n.carbohydrates);
 // Nutrition labels can be rounded. Reject only a material energy contradiction.
 const lowerBound=9*(fat??0)+4*(protein??0)+4*(carbohydrates??0);
 if(energy!=null&&lowerBound>0&&energy+Math.max(20,lowerBound*.18)<lowerBound)reasons.push('Reported calories are too low for the listed macronutrients.');
 if(n.saturatedFat!=null&&fat!=null&&n.saturatedFat>fat+.5)reasons.push('Saturated fat exceeds total fat.');
 if(n.sugars!=null&&carbohydrates!=null&&n.sugars>carbohydrates+.5)reasons.push('Sugars exceed total carbohydrates.');
 const identity=Boolean(product.name&&product.name!==('Product '+product.barcode));
 if(!identity&&!product.brand)reasons.push('The product name and brand have not been confirmed by the database.');
 const blocked=reasons.length>0;
 const known=['kcal','protein','carbohydrates','sugars','fat','saturatedFat','fiber','salt'].filter(k=>finite(n[k])!=null).length;
 const limited=!blocked&&(!['g','ml'].includes(product.basis)||known<2||product.partial===true);
 return {status:blocked?'rejected':limited?'limited':'usable',reasons,identity,reportedCore:known,
  canCalculate:!blocked&&!limited,missingBasis:!['g','ml'].includes(product.basis)};
}
export function enforceSourceIntegrity(product,raw=null){
 if(!product)return null;
 const result={...product};
 const t=sourceIntegrity(result,raw);
 if(t.status==='rejected'){
  const warnings=new Set(safeTags(result.qualityWarnings));
  if(t.reasons.some(x=>x.includes('brand')))warnings.add('foodscan:identity-unconfirmed');
  else if(t.reasons.some(x=>x.includes('calories')||x.includes('Saturated')||x.includes('Sugars')))warnings.add('foodscan:energy-contradiction');
  result.qualityWarnings=[...warnings];
  result.nutrition=Object.fromEntries(keys.map(k=>[k,null]));
  result.servingNutrition=Object.fromEntries(keys.map(k=>[k,null]));
  result.basis=null;
  result.servingAmount=null;result.servingUnit=null;
  result.partial=true;
  result.nutriScore=null;result.nova=null;
  if(!t.identity){result.ingredients='';result.allergens=[];result.traces=[];result.labels=[];result.analysis=[];result.additivesCount=null;}
  const q=result.nutritionQuality||{};
  result.nutritionQuality={...q,available:0,total:8,
   missing:['Energy','Protein','Carbohydrates','Total sugars','Fat','Saturated fat','Fiber','Salt'],
   issues:[...new Set([...(q.issues||[]),...t.reasons])].slice(0,12),quarantined:true};
 }
 result.sourceIntegrity=sourceIntegrity(result);
 // Guarantee a source with a critical flag stays quarantined after storage roundtrips.
 if(t.status==='rejected')result.sourceIntegrity={...t,status:'rejected',canCalculate:false};
 return result;
}

/** Validate typed values before accepting a locally entered package label. */
export function validateLabelFacts(n,basis){
 const issues=[];
 if(!['g','ml'].includes(basis))issues.push('Choose whether the label values are per 100 g or 100 ml.');
 const max={kcal:950,protein:100,carbohydrates:100,sugars:100,fat:100,saturatedFat:100,fiber:100,salt:100};
 for(const [key,limit] of Object.entries(max)){const v=n?.[key];if(v!=null&&(!Number.isFinite(v)||v<0||v>limit))issues.push(key+' is outside the allowed range.');}
 if(n?.sugars!=null&&n?.carbohydrates!=null&&n.sugars>n.carbohydrates+.5)issues.push('Sugars cannot exceed carbohydrates.');
 if(n?.saturatedFat!=null&&n?.fat!=null&&n.saturatedFat>n.fat+.5)issues.push('Saturated fat cannot exceed total fat.');
 const minimum=9*(n?.fat||0)+4*(n?.protein||0)+4*(n?.carbohydrates||0);
 if(n?.kcal!=null&&minimum>0&&n.kcal+Math.max(20,minimum*.18)<minimum)issues.push('Calories do not agree with the macronutrients.');
 return issues;
}
