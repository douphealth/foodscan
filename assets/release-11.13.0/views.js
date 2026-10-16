export * from '/assets/release-11.12.0/views.js';
import {swapsSection as previous} from '/assets/release-11.12.0/views.js';
import {escapeHTML as e} from './model.js';
function actions(p,sw,hasSaved){
 const code=e(p.barcode),wait=Number.isFinite(sw?.retryAt)?sw.retryAt:0,paused=wait>Date.now();
 const first='<button class="fs14-action-main" type="button" data-action="compare-add" data-code="'+code+'">Compare this food side by side <span aria-hidden="true">→</span></button>';
 const category=/^en:[a-z0-9][a-z0-9-]{1,100}$/.test(sw?.category||'')?sw.category.slice(3):'';
 const link=category?'<a class="fs14-source-link" href="https://world.openfoodfacts.org/category/'+e(category)+'" target="_blank" rel="noopener noreferrer">Browse public category ↗</a>':'';
 return '<div class="fs14-recovery-actions">'+first+'<button class="fs14-action-alt" type="button" data-action="load-swaps" data-code="'+code+'" data-search-retry-at="'+wait+'" '+(paused?'disabled':'')+'><span data-retry-label>Try live search again</span></button>'+link+'</div>';
}
export function swapsSection(s){
 const sw=s.swaps,p=s.active;
 if(!p||!sw)return previous(s);
 if(sw.code===p.barcode&&sw.status==='error'){
  const hasSaved=(s.store.saved?.length||0)+(s.store.library?.length||0)>1;
  return '<section class="fs14-recovery" role="status" aria-label="Better options temporarily unavailable">'+
   '<div class="fs14-recovery-header"><span class="fs14-recovery-symbol" aria-hidden="true">↗</span><div><span class="fs14-eyebrow">KEEP COMPARING</span><h3>Explore your next option</h3></div></div>'+
   '<p>Live product search is unavailable right now. This does not mean there are no better options.</p>'+
   '<p class="fs14-recovery-tip">Start with this food, then scan or select a similar product for a genuine nutrition comparison.'+(hasSaved?' Your saved records are available in Compare.':'')+'</p>'+
   actions(p,sw,hasSaved)+
   '<details class="fs14-technical"><summary>Why did live search fail?</summary><p>'+e(sw.error||'The database did not respond.')+'</p></details></section>';
 }
 if(sw.code===p.barcode&&sw.status==='done'&&!sw.items?.length){
  return '<section class="fs14-recovery" role="status"><div class="fs14-recovery-header"><span class="fs14-recovery-symbol" aria-hidden="true">i</span><div><span class="fs14-eyebrow">NO LIVE MATCHES IN THIS SAMPLE</span><h3>Compare another product</h3></div></div><p>No usable records were returned for this category search. That is not evidence that your current food is the best option.</p>'+actions(p,sw,false)+'</section>';
 }
 const html=previous(s);
 if(sw.code===p.barcode&&sw.status==='done'&&sw.mode==='browser'){
  return '<div class="fs14-browser-note" role="note"><strong>Live results recovered through your browser</strong><p>These are public Open Food Facts records; some may be incomplete. Nutrition comparisons use reported values, and dietary restrictions must be verified on the current package.</p></div>'+html;
 }
 if(sw.code===p.barcode&&sw.status==='done'&&sw.mode==='local'&&sw.refreshing){
  return '<div class="fs14-browser-note" role="status"><strong>Saved foods shown immediately</strong><p>Checking for fresher records in the background. Your current results come from complete previously retrieved foods.</p></div>'+html;
 }
 return html;
}
