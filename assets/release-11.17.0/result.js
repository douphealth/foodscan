/** FoodScan 11.17: do not render empty "finished reports" for sparse source records. */
export * from '/assets/release-11.16.0/result.js';
import {resultSummary as previous} from '/assets/release-11.16.0/result.js';
import {reportAudit,renderValue} from './report-audit.js';
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;};
function refLink(p){
 if(p.provenance==='local'||!/^https:\/\/world\.openfoodfacts\.org\/product\/\d+$/.test(p.sourceUrl||''))return null;
 const link=el('a','fs18-action fs18-action-secondary','See this exact source record ↗');
 link.href=p.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
 return link;
}
export function resultSummary(p,s){
 const t=document.createElement('template');t.innerHTML=previous(p,s);
 const article=t.content.querySelector('.v18-product');if(!article)return t.innerHTML;
 const q=reportAudit(p);
 article.classList.add('fs18-report',q.limited?'fs18-report-limited':'fs18-report-supported');
 if(!q.limited){
  const classifications=article.querySelector('.fs15-classification-band');
  if(classifications&&q.ratingCount===0){
   const intro=el('div','fs18-no-grade','Nutri-Score and NOVA are not recorded for this barcode. Nutrition values below can still be used on their own terms; missing ratings do not mean a poor or good product.');
   classifications.replaceWith(intro);
  }
  return t.innerHTML;
 }
 const header=article.querySelector('.v18-product-head');
 const alert=el('section','fs18-evidence-alert');
 alert.setAttribute('role','status');
 alert.append(el('span','fs18-eyebrow','SOURCE CHECK · INCOMPLETE RECORD'),
              el('h2','',q.reason==='unit'?'Nutrient values found. Reference unit unknown.':
                q.reason==='preview'?'This result is only a database preview.':
                'This barcode needs more nutrition data.'));
 const description= q.reason==='unit'
  ?'The source contains nutrient values but does not confirm whether the standard reference means 100 g or 100 ml. FoodScan will not make a serving calculation or a numeric comparison until that basis is known.'
  :q.reason==='missing'
   ?'The database returned product information but no usable core nutrition values. This is not a zero-nutrition food, and no nutritional verdict can be determined.'
   :q.reason==='preview'
    ?'Search previews can omit essential nutrition and allergen details. Open the complete record to check the package facts before relying on a result.'
    :'This record does not contain enough nutrition fields to support a complete report. The few supplied numbers should not be interpreted as a full nutritional assessment.';
 alert.append(el('p','fs18-explanation',description));
 const actions=el('div','fs18-evidence-actions');
 const retry=el('button','fs18-action fs18-action-primary','↻ Check for updated nutrition');
 retry.type='button';retry.dataset.action='reload';retry.dataset.code=p.barcode;actions.append(retry);
 const link=refLink(p);if(link)actions.append(link);
 const photo=el('button','fs18-action fs18-action-secondary','Save packaging label photo');
 photo.type='button';photo.dataset.action='capture-label';photo.dataset.code=p.barcode;actions.append(photo);
 alert.append(actions,el('p','fs18-footnote','Label photos stay on this device and are not automatically converted into nutrition facts.'));
 if(header)header.after(alert);else article.prepend(alert);
 const findings=article.querySelector('.v18-findings');
 if(findings){
  findings.replaceChildren(el('span','fs18-eyebrow','WHAT THE DATABASE ACTUALLY CONTAINS'));
  findings.append(el('h3','',q.known?q.known+' of 8 nutrient values recorded':'No reliable nutrition numbers to show'));
  if(q.known){
   const heading=el('p','fs18-explanation',q.basis?'These reported amounts are per 100 '+q.basis+'.':'Open Food Facts provides normalized values per 100 g or 100 ml; the applicable unit cannot be established from this record.');
   findings.append(heading);
   const dl=el('dl','fs18-fact-list');
   for(const item of q.facts){
    const row=el('div','fs18-fact');row.append(el('dt','',item.label),el('dd','',renderValue(item.value)+' '+item.unit));dl.append(row);
   }
   findings.append(dl);
  }else findings.append(el('p','fs18-explanation','You can still check the source, the ingredient list and any source-reported allergen information. Verify details on the physical package.'));
 }
 const toRemove=['.fs15-classification-band','.v18-metric-heading','.v18-metrics','.fs15-macro-header','.fs15-macro-grid','.v19-ring-note'];
 for(const selector of toRemove)article.querySelector(selector)?.remove();
 const data=article.querySelector('.fs16-data-panel');
 if(data){
  const desc=data.querySelector('p');if(desc&&!q.basis&&q.known){
   desc.textContent=q.known+' source nutrient fields are present. Per-100 unit (g versus ml) remains unverified, so portion totals are withheld.';
  }
 }
 return t.innerHTML;
}
