export * from '/assets/release-11.5.0/result.js';
import {resultSummary as previousSummary} from '/assets/release-11.5.0/result.js';
export function resultSummary(p,s){
 const t=document.createElement('template');t.innerHTML=previousSummary(p,s);const report=t.content.querySelector('.r15-details');if(!report)return t.innerHTML;report.classList.add('r16-details');
 const finding=report.querySelector('.r15-finding'),name=report.querySelector('#decision-title'),allergens=report.querySelector('.r15-allergens');
 const glance=document.createElement('section');glance.className='r16-glance';glance.setAttribute('aria-label','Product and key reported finding');
 if(name)glance.append(name);if(finding)glance.append(finding);if(allergens)glance.append(allergens);
 const actions=document.createElement('nav');actions.className='r16-next';actions.setAttribute('aria-label','Explore this report');actions.innerHTML='<a href="#fs-product-log-heading">Check my portion <span aria-hidden="true">↘</span></a><a href="#fs-ingredients">Read ingredients <span aria-hidden="true">↓</span></a>';glance.append(actions);report.prepend(glance);
 return t.innerHTML;
}
