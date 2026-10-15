export * from '/assets/release-11.5.0/views.js';
import {home as previousHome,productView as previousProduct} from '/assets/release-11.5.0/views.js';
import {getDiarySummary} from '/assets/release-11.3.0/lib/meal-diary.js';
export function home(s){
 const t=document.createElement('template');t.innerHTML=previousHome(s);const root=t.content.querySelector('.r15-home'),find=t.content.querySelector('.r15-find');if(!root||!find)return t.innerHTML;
 root.classList.add('r16-home');root.prepend(find);
 const title=find.querySelector('h2'),heading=document.createElement('h1');heading.innerHTML='Scan your food.<br><em>Know what matters.</em>';title?.replaceWith(heading);
 const intro=find.querySelector(':scope > p');if(intro)intro.textContent='Understand the ingredients. Check the nutrition. See what your portion contains.';
 const benefits=document.createElement('div');benefits.className='r16-benefits';benefits.innerHTML='<span><b>01</b> Read the ingredients</span><span><b>02</b> Check your portion</span><span><b>03</b> Keep a private diary</span>';if(intro)intro.after(benefits);
 const primary=find.querySelector('.fs-scan-primary span');if(primary)primary.innerHTML='Scan a food<small>Point at the package barcode</small>';
 const dashboard=root.querySelector('.r15-dashboard'),oldTitle=dashboard?.querySelector('h1');if(oldTitle){const h=document.createElement('h2');h.textContent='Your day, at a glance.';oldTitle.replaceWith(h);}
 if(dashboard&&!getDiarySummary().count){const box=document.createElement('details');box.className='r16-start-diary';const summary=document.createElement('summary');summary.textContent='Your daily report starts with your first logged meal';dashboard.before(box);box.append(summary,dashboard);}
 return t.innerHTML;
}
export function productView(s){const t=document.createElement('template');t.innerHTML=previousProduct(s);const report=t.content.querySelector('.r16-details'),portion=t.content.querySelector('.fs12-portion');if(report&&portion)report.after(portion);return t.innerHTML;}
