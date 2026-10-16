/** FoodScan 11.14: the conclusion first, classifications full width, no invented values. */
export * from '/assets/release-11.13.0/result.js';
import {resultSummary as prior} from '/assets/release-11.13.0/result.js';
import {nutrientConflicts} from '/assets/release-11.3.0/lib/profile.js';
function el(tag,klass,value){
 const node=document.createElement(tag);
 if(klass)node.className=klass;
 if(value!==undefined)node.textContent=value;
 return node;
}
export function resultSummary(p,s){
 const template=document.createElement('template');template.innerHTML=prior(p,s);
 const report=template.content.querySelector('.v18-product');
 if(!report)return template.innerHTML;
 report.classList.add('fs15-product-report');
 const overview=report.querySelector('.v18-overview');
 const photo=report.querySelector('.v18-product-image');
 const classification=photo?.querySelector('.fs14-classifications');
 if(overview&&classification){
  classification.classList.add('fs15-classification-band');
  overview.after(classification);
  const head=classification.querySelector('.fs14-heading h3');
  if(head)head.textContent='Two labels. Two different questions.';
  const summary=classification.querySelector('.fs14-intro');
  if(summary)summary.textContent='Nutri-Score describes nutrient balance; NOVA describes the degree of processing.';
 }
 const findings=report.querySelector('.v18-findings');
 if(findings){
  findings.classList.add('fs15-findings');
  const kicker=findings.querySelector('.v18-kicker');
  if(kicker)kicker.textContent='THE DECISION, IN SECONDS';
  const headline=findings.querySelector('h2');
  if(headline)headline.textContent=headline.textContent.replace(/\s*\+\s*more\s*$/i,'');
  const bad=new Set(nutrientConflicts(p));
  const validBasis=['g','ml'].includes(p.basis);
  const priority=[['sugars','Total sugars','g'],['saturatedFat','Saturated fat','g'],['kcal','Energy','kcal'],['protein','Protein','g']]
   .filter(([key])=>validBasis&&!bad.has(key)&&Number.isFinite(p.nutrition?.[key])).slice(0,2);
  if(priority.length){
   const list=el('div','fs15-evidence-grid');
   list.setAttribute('aria-label','Source nutrition values per 100 '+p.basis);
   const format=num=>new Intl.NumberFormat(s.store?.settings?.locale||'en-GB',{maximumFractionDigits:num<1?2:1}).format(num);
   for(const [key,name,unit] of priority){
    const cell=el('div','fs15-evidence-cell');
    cell.append(el('span','fs15-evidence-label',name+' / 100 '+p.basis),
                el('strong','fs15-evidence-number',format(p.nutrition[key])+' '+unit));
    list.append(cell);
   }
   const allergy=findings.querySelector('.v18-allergen');
   if(allergy)allergy.before(list);else findings.append(list);
  }
 }
 const metrics=report.querySelector('.v18-metrics');
 const metricHead=report.querySelector('.v18-metric-heading');
 const macros=report.querySelector('.v19-macros');
 const macroNote=report.querySelector('.v19-ring-note');
 if(classification&&metrics&&metricHead)classification.after(metricHead,metrics);
 if(macros){
  macros.classList.add('fs15-macro-grid');
  const mini=el('div','fs15-macro-header');
  mini.append(el('span','fs15-eyebrow','MACRO BREAKDOWN'),el('span','fs15-macro-basis',p.basis?'Per 100 '+p.basis:'Basis not confirmed'));
  macros.before(mini);
 }
 if(macroNote)macroNote.textContent='Reported gram amounts, not percentages of a daily target. Values may be incomplete.';
 return template.innerHTML;
}
