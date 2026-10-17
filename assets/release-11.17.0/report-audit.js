/** FoodScan 11.17 - source coverage and reference-basis gate.
 * Open Food Facts *_100g fields refer to 100 g OR 100 ml (liquids).
 * No guessing which quantity is intended when packaging units are absent.
 */
export const CORE=Object.freeze([
 ['kcal','Energy','kcal'],['protein','Protein','g'],['carbohydrates','Carbohydrates','g'],
 ['sugars','Total sugars','g'],['fat','Fat','g'],['saturatedFat','Saturated fat','g'],
 ['fiber','Fiber','g'],['salt','Salt','g']
]);
export function reportAudit(p){
 const n=p?.nutrition||{},basis=['g','ml'].includes(p?.basis)?p.basis:null;
 const facts=CORE.filter(([key])=>typeof n[key]==='number'&&Number.isFinite(n[key])&&n[key]>=0)
   .map(([key,label,unit])=>({key,label,unit,value:n[key]}));
 const ratingCount=(/^[A-E]$/.test(p?.nutriScore||'')?1:0)+([1,2,3,4].includes(p?.nova)?1:0);
 const safeToCalculate=Boolean(basis&&facts.length>=2&&!p?.partial);
 return {
  facts,known:facts.length,total:CORE.length,basis,ratingCount,
  reliableReference:!!basis, safeToCalculate,
  sparse:facts.length<2, limited:!safeToCalculate,
  reason:p?.partial?'preview':facts.length===0?'missing':!basis?'unit':facts.length<2?'sparse':'ready'
 };
}
export function isRecoverableWeakProduct(p){
 const q=reportAudit(p);
 return q.reason==='missing'||q.reason==='sparse'||q.reason==='unit'||q.reason==='preview';
}
export function renderValue(value){
 if(!Number.isFinite(value))return 'Not reported';
 return new Intl.NumberFormat('en-GB',{maximumFractionDigits:value>0&&value<1?2:1}).format(value);
}
