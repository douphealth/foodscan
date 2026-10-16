export * from '/assets/release-11.9.0/views.js';
import * as previous from '/assets/release-11.9.0/views.js';
import {escapeHTML as e} from './model.js';
import {getLastCategoryStatus} from './api.js';
function snapshotNote(at){const label=Number.isFinite(at)?new Date(at).toLocaleString():'date unavailable';return `<p class="v20-snapshot" role="note">Saved database snapshot · ${e(label)}. Live refresh is unavailable; these are not newly retrieved facts. Verify the current package.</p>`;}
export function normalize(html){const t=document.createElement('template');t.innerHTML=html;
 for(const label of t.content.querySelectorAll('div,span,small,dt')){if(/^(record|retrieved|source updated|known limitations)$/i.test(label.textContent.trim()))label.parentElement?.classList.add('v20-source-card');}
 for(const box of t.content.querySelectorAll('.notice,[role="alert"]')){let seen=false;const walker=document.createTreeWalker(box,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode()){text.textContent=text.textContent.replace(/Your saved foods still work\.?/gi,match=>{if(seen)return '';seen=true;return match;});}}
 return t.innerHTML;}
export function home(s){return normalize(previous.home(s));}
export function productView(s){return normalize(previous.productView(s));}
export function shoppingView(s){return normalize(previous.shoppingView(s));}
export function productCard(p,s,...args){const html=previous.productCard(p,s,...args);if(!p.connection?.stale)return html;const t=document.createElement('template');t.innerHTML=html;const card=t.content.querySelector('.food-card');if(card){card.insertAdjacentHTML('afterbegin',snapshotNote(p.fetchedAt));return t.innerHTML;}return snapshotNote(p.fetchedAt)+html;}
export function swapsSection(s){const x=s.swaps;if(x?.status==='error'){const retryAt=Number.isFinite(x.retryAt)?x.retryAt:0;const message=String(x.error||'The live comparison could not be retrieved.').replace(/Your saved foods still work\.?/gi,'').trim();return `<div class="v20-error" role="status"><span class="v20-error-icon" aria-hidden="true">↻</span><div><h3>Comparison temporarily unavailable</h3><p>${e(message)}</p><p>Your current food report and saved foods remain available.</p><div class="v20-error-actions"><button type="button" data-action="load-swaps" data-code="${e(s.active?.barcode||x.code||'')}" data-search-retry-at="${retryAt}" ${retryAt>Date.now()?'disabled':''}><span data-retry-label>Try again</span></button><a href="#saved">Open my foods →</a></div></div></div>`;}
 const html=normalize(previous.swapsSection(s)),status=getLastCategoryStatus();return x?.status==='done'&&status?.stale&&status.category===x.category?snapshotNote(status.fetchedAt)+html:html;}
export function alternativesView(s){const html=normalize(previous.alternativesView(s)),status=getLastCategoryStatus();return status?.stale&&status.category===s.alternatives?.category?snapshotNote(status.fetchedAt)+html:html;}
