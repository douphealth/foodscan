/** FoodScan 11.15: explain evidence and improve image presentation without altering classification logic. */
export * from '/assets/release-11.14.1/result.js';
import {resultSummary as previous} from '/assets/release-11.14.1/result.js';
import {qualitySummary} from './record-quality.js';
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function resultSummary(p,s){
 const t=document.createElement('template');t.innerHTML=previous(p,s);
 const article=t.content.querySelector('.v18-product');if(!article)return t.innerHTML;
 article.classList.add('fs16-report');
 const photo=article.querySelector('.v18-product-image');
 if(photo){
  photo.classList.add('fs16-photo-frame');
  const img=photo.querySelector('img');
  if(img){
   img.classList.add('fs16-product-photo');
   img.loading='eager';img.decoding='async';img.setAttribute('fetchpriority','high');
   img.alt=(p.name||'Product')+' — source-submitted product packaging photo';
   const urls=[p.image,...(Array.isArray(p.imageCandidates)?p.imageCandidates:[])].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,7);
   img.dataset.fsImageUrls=JSON.stringify(urls);
   img.dataset.fsImageIndex='0';
   const caption=document.createElement('span');caption.className='fs16-photo-caption';
   caption.textContent='Source-submitted package photo · packaging may vary';
   photo.append(caption);
  }else{
   const caption=document.createElement('span');caption.className='fs16-photo-caption';
   caption.textContent='No verified front-of-package photo in this record.';
   photo.append(caption);
  }
 }
 const q=qualitySummary(p);
 if(q){
  const section=document.createElement('section');
  section.className='fs16-data-panel';
  section.setAttribute('aria-label','Nutrition data completeness and source quality');
  const head=document.createElement('div');head.className='fs16-data-head';
  const title=document.createElement('strong');title.textContent='Nutrition data coverage';
  const count=document.createElement('span');count.className='fs16-coverage-number';
  count.textContent=q.available+' / '+q.total+' source fields';
  head.append(title,count);section.append(head);
  const progress=document.createElement('div');progress.className='fs16-coverage-track';progress.setAttribute('role','progressbar');
  progress.setAttribute('aria-label','Reported or supported nutrition field coverage');
  progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax',String(q.total));
  progress.setAttribute('aria-valuenow',String(q.available));
  const fill=document.createElement('span');fill.style.width=(100*q.available/Math.max(1,q.total))+'%';progress.append(fill);section.append(progress);
  const desc=document.createElement('p');desc.textContent=q.available===q.total?'All eight displayed core nutrition fields have usable values. This is a record completeness check, not laboratory verification.':'Unavailable values: '+q.missing.join(', ')+'. Missing does not mean zero.';
  section.append(desc);
  if(q.derived?.length){const d=document.createElement('p');d.className='fs16-calculated';d.textContent='Calculated from reported serving quantities: '+q.derived.join(', ')+'.';section.append(d);}
  const energy=q.origins?.kcal;
  if(energy==='kilojoules'){const d=document.createElement('p');d.className='fs16-calculated';d.textContent='Energy (kcal) is converted from reported kJ using 1 kcal = 4.184 kJ.';section.append(d);}
  if(q.issues?.length){
   const details=document.createElement('details');details.className='fs16-quality-warnings';
   const summary=document.createElement('summary');summary.textContent='Source data conflicts or plausibility warnings ('+q.issues.length+')';
   details.append(summary);
   const list=document.createElement('ul');
   for(const text of q.issues){const li=document.createElement('li');li.textContent=text;list.append(li);}
   details.append(list);section.append(details);
  }
  const link=document.createElement('a');link.href=p.sourceUrl||'#fs-ingredients';
  link.rel='noopener noreferrer';link.target='_blank';
  link.textContent='Check the public source record ↗';
  section.append(link);
  const classifications=article.querySelector('.fs15-classification-band');
  const intro=article.querySelector('.v18-overview');
  if(classifications)classifications.after(section);else if(intro)intro.after(section);else article.append(section);
 }
 return t.innerHTML;
}
