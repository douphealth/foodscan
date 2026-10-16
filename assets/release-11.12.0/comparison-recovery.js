/** Choose real, previously retrieved complete records for offline/failed category comparisons. */
export function bestLocalComparison(base,records,categories,profile,rankChoices){
 if(!base||!Array.isArray(records)||!Array.isArray(categories)||typeof rankChoices!=='function')return null;
 const self=String(base.barcode||'').padStart(14,'0'),seen=new Set();
 const eligible=(records||[]).filter(p=>{
  if(!p||p.partial||p.provenance==='local'||p.basis!==base.basis||!Array.isArray(p.categories))return false;
  const code=String(p.barcode||'').padStart(14,'0');
  if(!p.barcode||code===self||seen.has(code))return false;
  seen.add(code);return true;
 });
 let best=null;
 for(const [order,category] of categories.entries()){
  const items=eligible.filter(p=>p.categories.includes(category));
  if(!items.length)continue;
  const improvements=rankChoices(base,items,profile,category).items?.length||0;
  const candidate={category,items,checked:items.length,improvements,order};
  if(!best||candidate.improvements>best.improvements||(candidate.improvements===best.improvements&&candidate.checked>best.checked))best=candidate;
 }
 return best;
}
