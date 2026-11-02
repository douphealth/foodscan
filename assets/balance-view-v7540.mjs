/** Descriptive UI index, not Nutri-Score, intake percentages, or a health outcome.
 * Preserve the existing documented visual mapping for complete solid-food data;
 * missing/negative/nonfinite values have no percentage and no overall index.
 */
const known=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));
export function balanceVector(product) {
 const n=product?.nutrition||{}, liquid=product?.basis==='ml';
 const keys=['sugars','saturatedFat','salt','fiber','protein'];
 const cutoffs=liquid?[11.25,2.5,.75]:[22.5,5,1.5];
 const scores=keys.map((key,index)=>!known(n[key])?null:index<3?
   clamp(100-85*n[key]/cutoffs[index]):clamp(25+75*n[key]/(key==='fiber'?6:12)));
 const available=scores.filter(v=>v!==null).length;
 return {keys,scores,available,index:available===5?Math.round(scores.reduce((a,b)=>a+b,0)/5):null};
}
