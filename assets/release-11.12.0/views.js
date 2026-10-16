export * from '/assets/release-11.10.0/views.js';
import {swapsSection as previous} from '/assets/release-11.10.0/views.js';
import {escapeHTML as e} from './model.js';
import {hasRestrictions} from '/assets/release-11.3.0/lib/profile.js';
export function swapsSection(s){
 const sw=s.swaps,p=s.active;
 if(sw?.code===p?.barcode&&sw.status==='error'){
   const wait=Number.isFinite(sw.retryAt)?sw.retryAt:0;
   return `<section class="fs13-recovery" role="status" aria-label="Comparison recovery"><div class="fs13-recovery-heading"><span aria-hidden="true">↻</span><div><strong>Live alternatives could not load</strong><p>This is a database connection problem, not evidence that no better foods exist.</p></div></div><p class="fs13-recovery-next">Compare foods already on this device, or scan a similar product to build a reliable side-by-side comparison.</p><div class="fs13-recovery-actions"><a class="fs13-local-action" href="#compare">Compare my foods →</a><button type="button" data-action="load-swaps" data-code="${e(p.barcode)}" data-search-retry-at="${wait}" ${wait>Date.now()?'disabled':''}><span data-retry-label>Try live search again</span></button></div><p class="fs13-error-detail">Database detail: ${e(sw.error||'No response from the provider.')}</p></section>`;
 }
 if(sw?.status==='done'&&sw.code===p?.barcode&&sw.items?.length&&hasRestrictions(s.store.profile)&&sw.items.every(x=>x.partial)){
   return `<div class="fs13-recovery" role="status"><strong>These product previews cannot confirm your restrictions.</strong><p>To protect allergy and dietary decisions, FoodScan will not recommend these incomplete records. Compare saved complete records or scan another product label.</p><a class="fs13-local-action" href="#compare">Compare complete saved foods →</a></div>`;
 }
 const html=previous(s);
 if(sw?.status==='done'&&sw.mode==='local'){
   const retry=Number.isFinite(sw.retryAt)?sw.retryAt:0;
   return `<div class="fs13-local-note" role="note"><strong>Compared ${sw.checked} saved complete food ${sw.checked===1?'record':'records'}</strong><p>These are previously retrieved products, not new live results. Source details may have changed; check the current packaging.</p>${sw.sourceError?`<small>Live search: ${e(sw.sourceError)}</small>`:''}<button type="button" data-action="load-swaps" data-code="${e(p.barcode)}" data-search-retry-at="${retry}" ${retry>Date.now()?'disabled':''}><span data-retry-label>Refresh live results</span></button></div>`+html;
 }
 return html;
}
