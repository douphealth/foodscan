/** Food profile: informative no-score states, not invented grades. */
export * from '/assets/release-11.15.0/result.js';
import {resultSummary as prior} from '/assets/release-11.15.0/result.js';
export function resultSummary(product,state){
 const t=document.createElement('template');t.innerHTML=prior(product,state);
 const group=t.content.querySelector('.fs15-classification-band');
 if(!group)return t.innerHTML;
 const grades=[['.fs14-nutri',product.nutriScore,'Nutri-Score','A food has no confirmed Nutri-Score in this record. Check the packaging or source before drawing a grade-based conclusion.'],['.fs14-processing',product.nova,'NOVA','No processing group is recorded. Ingredients alone are insufficient to assign NOVA automatically.']];
 for(const [selector,value,title,description] of grades){
  const tile=group.querySelector(selector);if(!tile||value!=null)continue;
  tile.classList.add('fs17-score-unavailable');
  const badge=tile.querySelector('.fs14-mark');if(badge){badge.textContent='?';badge.setAttribute('aria-label',title+' not available');}
  const copy=tile.querySelector('.fs14-tile-reading');
  if(copy){const titleNode=copy.querySelector('strong'),small=copy.querySelector('small');if(titleNode)titleNode.textContent='No source classification';if(small)small.textContent=description;}
  const scale=tile.querySelector('.fs14-grade-scale,.fs14-nova-scale');if(scale){scale.setAttribute('aria-label','Scale shown for reference only; no selected classification');scale.classList.add('fs17-unrated-scale');}
 }
 const note=group.querySelector('.fs14-classification-note');
 if(note)note.textContent='Only source-reported grades are displayed. A missing classification does not imply good or poor nutrition, low processing, or food safety.';
 return t.innerHTML;
}
