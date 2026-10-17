/** Source trust panel, and no-false-certainty food classifications. */
export * from '/assets/release-11.14.0/views.js';
import {productView as prior} from '/assets/release-11.14.0/views.js';
const el=(tag,cls,txt)=>{const n=document.createElement(tag);n.className=cls;if(txt!=null)n.textContent=txt;return n;};
const date=t=>Number.isFinite(t)&&t>0?new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Date not provided';
export function productView(state){
 const t=document.createElement('template');t.innerHTML=prior(state);
 const p=state.active,report=t.content.querySelector('#fs-complete-report');
 if(!p||!report)return t.innerHTML;
 const source=report.querySelector('#fs-source .fs-source-summary');
 if(source){
  const q=p.nutritionQuality||null;
  const n=p.nutrition||{};
  const missing=['Energy','Protein','Carbs','Sugars','Fat','Saturated fat','Fiber','Salt'].filter((_,i)=>n[['kcal','protein','carbohydrates','sugars','fat','saturatedFat','fiber','salt'][i]]==null);
  const wrapper=el('div','fs17-trust-grid');
  const row=(label,value,cls='')=>{
   const item=el('div','fs17-trust-row '+cls);
   item.append(el('span','fs17-trust-label',label),el('strong','fs17-trust-value',value));
   return item;
  };
  const record=el('div','fs17-trust-row fs17-record');
  record.append(el('span','fs17-trust-label','SOURCE RECORD'));
  if(p.provenance==='local'){record.append(el('strong','fs17-trust-value','Your local entry · not externally verified'));}
  else {
   const link=el('a','fs17-trust-link','Open Food Facts ↗');
   link.href=p.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
   record.append(link);
  }
  wrapper.append(record,row('RETRIEVED',date(p.fetchedAt)),row('SOURCE LAST UPDATED',date(p.sourceModified)));
  const count=Object.keys(n).filter(k=>['kcal','protein','carbohydrates','sugars','fat','saturatedFat','fiber','salt'].includes(k)&&n[k]!=null).length;
  const limits=el('div','fs17-trust-row fs17-limits');
  limits.append(el('span','fs17-trust-label','NUTRITION COMPLETENESS'),el('strong','fs17-trust-value',count+' of 8 core values available'));
  limits.append(el('p','fs17-trust-description',missing.length?'Not available: '+missing.join(', ')+'. Missing values are not zero.':'All eight core fields have usable values; this does not verify label accuracy.'));
  if(p.qualityWarnings?.length)limits.append(el('p','fs17-source-warning','The source flagged this record for review. Check the physical label.'));
  if(q?.issues?.length)limits.append(el('p','fs17-source-warning',q.issues.length+' source-value conflict(s) detected. Check the source and packaging.'));
  wrapper.append(limits);
  source.replaceWith(wrapper);
 }
 return t.innerHTML;
}
