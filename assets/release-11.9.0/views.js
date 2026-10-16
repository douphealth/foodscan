export * from '/assets/release-11.8.0/views.js';
import * as previous from '/assets/release-11.8.0/views.js';
import {mode} from './theme.js';
export function decorate(html){const t=document.createElement('template');t.innerHTML=html;
 for(const el of t.content.querySelectorAll('div,header,footer,aside,nav')){const names=el.className||'';if(/(?:head|hero|banner|source|provenance|composition|jump)/i.test(names)&&!el.matches('.comp-bar,.comp-legend'))el.classList.add('v19-surface');}
 for(const h of t.content.querySelectorAll('h1,h2,h3,h4')){if(/^(Everything behind the answer\.|Nutrition facts|Ingredients & allergens|Source & reliability)$/.test(h.textContent.trim())){h.parentElement?.classList.add('v19-surface');if(h.parentElement?.parentElement?.tagName==='DIV')h.parentElement.parentElement.classList.add('v19-surface');}}
 for(const el of t.content.querySelectorAll('span,small,dt')){if(/^(record|retrieved|source updated|known limitations)$/i.test(el.textContent.trim()))el.parentElement?.classList.add('v19-surface');}
 return t.innerHTML;}
export function home(s){return decorate(previous.home(s));}
export function productView(s){return decorate(previous.productView(s));}
export function header(s){const t=document.createElement('template');t.innerHTML=previous.header(s);const host=t.content.querySelector('.header-actions');if(host){const controls=document.createElement('div');controls.className='v19-theme-switch';controls.setAttribute('role','group');controls.setAttribute('aria-label','Display theme');controls.innerHTML=`<button type="button" data-ui-mode="light" aria-pressed="${mode()==='light'}">☀ Light</button><button type="button" data-ui-mode="dark" aria-pressed="${mode()==='dark'}">☾ Dark</button>`;host.prepend(controls);}return t.innerHTML;}

export function profileView(...args){return decorate(previous.profileView(...args));}
export function savedView(...args){return decorate(previous.savedView(...args));}
export function shoppingView(...args){return decorate(previous.shoppingView(...args));}
export function pantryView(...args){return decorate(previous.pantryView(...args));}
export function compareView(...args){return decorate(previous.compareView(...args));}
export function insightsView(...args){return decorate(previous.insightsView(...args));}
export function aboutView(...args){return decorate(previous.aboutView(...args));}
export function demoView(...args){return decorate(previous.demoView(...args));}
export function alternativesView(...args){return decorate(previous.alternativesView(...args));}
export function pantryReviewView(...args){return decorate(previous.pantryReviewView(...args));}
