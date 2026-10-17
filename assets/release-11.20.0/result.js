/** FoodScan 11.20 | Preserve 11.18 report for usable products.
 * For corrupted/incomplete source records, replace walls of empty numbers with a
 * source-evidence decision panel in the SAME visual system.
 */
export * from '/assets/release-11.18.0/result.js';
import {resultSummary as previous} from '/assets/release-11.18.0/result.js';
import {sourceIntegrity} from './source-trust.js';
function el(tag,cls,txt){const node=document.createElement(tag);if(cls)node.className=cls;if(txt!=null)node.textContent=txt;return node;}
export function resultSummary(p,s){
 const html=previous(p,s),trust=sourceIntegrity(p);
 if(trust.status==='usable'||trust.status==='local')return html;
 const t=document.createElement('template');t.innerHTML=html;
 const report=t.content.querySelector('.v18-product');
 if(!report)return html;
 report.classList.add('fs20-source-review',trust.status==='rejected'?'fs20-source-rejected':'fs20-source-limited');
 const bad=trust.status==='rejected';
 const panel=el('section','fs20-integrity');
 panel.setAttribute('role','alert');panel.setAttribute('aria-label','Source data reliability');
 panel.append(el('span','fs20-kicker',bad?'SOURCE INTEGRITY · FAILED':'SOURCE INTEGRITY · INCOMPLETE'),
  el('h2','',bad?'These nutrition facts cannot be trusted yet':'The nutrition evidence is incomplete'),
  el('p','fs20-intro',bad?
   'This community database entry has contradictory or unverified information. FoodScan has blocked its nutrients rather than showing invented or unsafe figures.':
   'The database does not contain enough confirmed information to calculate and compare this product reliably. Missing values are not zero.'));
 if(trust.reasons.length){
  const list=el('ul','fs20-issues');
  for(const reason of trust.reasons.slice(0,3))list.append(el('li','',reason));
  panel.append(list);
 }
 const actions=el('div','fs20-actions');
 const button=(label,act)=>{
  const node=el('button','fs20-action fs20-action-main',label);node.type='button';
  node.dataset.action=act;node.dataset.code=p.barcode;return node;
 };
 actions.append(button('Enter facts from my package','label-facts'));
 const photo=button('Save a label photo','capture-label');photo.className='fs20-action fs20-action-other';actions.append(photo);
 if(p.sourceUrl&&/^https:\/\/world\.openfoodfacts\.org\/product\/\d+$/.test(p.sourceUrl)){
  const link=el('a','fs20-action fs20-action-link','Inspect the source ↗');
  link.href=p.sourceUrl;link.rel='noopener noreferrer';link.target='_blank';actions.append(link);
 }
 panel.append(actions,el('p','fs20-disclaimer','Values entered from your package remain on this device and are not independently verified. Allergy information must be checked on the current package.'));
 const head=report.querySelector('.v18-product-head');
 if(head)head.after(panel);else report.prepend(panel);
 const finding=report.querySelector('.v18-findings');
 if(finding){
  const headline=finding.querySelector('h2');
  if(headline)headline.textContent=bad?'The source is inconsistent':'Verify the product label';
  const explanation=finding.querySelector(':scope > p');
  if(explanation)explanation.textContent=bad?
    'An exact barcode lookup does not guarantee that the community record is correct. No reliable nutrient conclusion can be drawn from this entry.':
    'The available data cannot support a reliable nutrition conclusion or portion calculation. Use the package label to complete it.';
  const allergies=finding.querySelector('.v18-allergen');
  if(allergies){
   allergies.querySelector('strong').textContent='Allergen status not verified';
   const body=allergies.querySelector('p');if(body)body.textContent='Do not treat missing allergen information as an absence claim.';
  }
 }
 const photoNode=report.querySelector('.fs16-photo-caption');
 if(photoNode&&bad)photoNode.textContent='Community-submitted image · product identity not verified';
 if(bad){
  const img=report.querySelector('.v18-product-image img');
  if(img)img.alt='Community-submitted photo; verify this is the same item as your package';
 }
 // The original visual components remain unchanged on supported records.
 // Suppress meaningless empty analytics only for source records failing the gate.
 for(const selector of ['.fs15-classification-band','.fs16-data-panel','.v18-metric-heading',
  '.v18-metrics','.fs15-macro-header','.fs15-macro-grid','.v19-ring-note','.v18-report-actions']){
  report.querySelector(selector)?.remove();
 }
 return t.innerHTML;
}
