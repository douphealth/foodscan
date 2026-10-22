/** FoodScan 11.21: real app controls inside an editorial, accessible homepage. */
export * from '/assets/release-11.20.0/views.js';
import {home as previousHome,swapsSection as previousSwaps,productView as previousProduct,alternativesView as previousAlternatives} from '/assets/release-11.20.0/views.js';
import {betterChoices,matchFoodType} from './recommendation-quality.js';
import {allergenEvidence} from './allergen-evidence.js';
import {resolveProduct} from '/assets/release-11.3.0/lib/policy.js';

const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function template(html){const t=document.createElement('template');t.innerHTML=html;return t;}
const sample=[['3017620422003','Chocolate spread','See the grade and sugar breakdown','01'],['8076800195057','Everyday pasta','Explore the reported nutrition','02'],['5449000131805','Soft drink','Check the sugars per 100 ml','03']];

export function home(state){
 const t=template(previousHome(state)),old=t.content.querySelector('.v18-home');
 if(!old)return t.innerHTML;
 const scanner=old.querySelector('.v18-scan');
 if(!scanner)return t.innerHTML;
 const day=old.querySelector('.v18-day'),diary=old.querySelector('#v18-diary'),foot=old.querySelector('.v18-footnote');
 const saved=Array.isArray(state?.store?.saved)?state.store.saved.length:0;
 const recent=Array.isArray(state?.store?.recent)?state.store.recent.length:0;
 const hero=template(`<div class="fs21-home">
 <section class="fs21-hero" aria-labelledby="fs21-title">
  <div class="fs21-hero-copy">
   <p class="fs21-kicker"><span aria-hidden="true" class="fs21-kicker-dot"></span> FOOD INTELLIGENCE, MADE HUMAN</p>
   <h1 id="fs21-title">Know your food.<br><em>Choose with confidence.</em></h1>
   <p class="fs21-lede">One source-reported grade. The nutrients behind it. A genuinely comparable higher-grade choice when the evidence supports one.</p>
   <div class="fs21-hero-actions">
    <button type="button" data-action="camera" class="fs21-cta fs21-cta-primary"><span aria-hidden="true">▣</span> Scan a barcode <span aria-hidden="true">↗</span></button>
    <a href="#demo" class="fs21-cta fs21-cta-secondary">Explore the live demo <span aria-hidden="true">→</span></a>
   </div>
   <p class="fs21-hero-trust"><span aria-hidden="true">✓</span> No account needed <span aria-hidden="true">·</span> Private food shelf <span aria-hidden="true">·</span> Transparent sources</p>
  </div>
  <div class="fs21-editorial">
   <div class="fs21-editorial-image"><img src="/art/produce.webp" alt="Fresh produce illustrating informed food choices" width="640" height="720" fetchpriority="high"></div>
   <div class="fs21-explain-card" aria-label="Nutri-Score grade overview">
    <span class="fs21-card-eyebrow">ONE GRADE. MORE CLARITY.</span>
    <strong>The five-grade lens</strong>
    <div class="fs21-grade-strip" aria-label="Nutri-Score letters A through E">
     <span class="g-a">A</span><span class="g-b">B</span><span class="g-c">C</span><span class="g-d">D</span><span class="g-e">E</span>
    </div>
    <small>FoodScan reports the published grade; it does not invent a score.</small>
   </div>
  </div>
 </section>
 <section class="fs21-flow" aria-label="How FoodScan works">
  <div><span>01 <b aria-hidden="true">↗</b></span><strong>Scan or search</strong><p>Pick a real packaged product.</p></div>
  <div><span>02 <b aria-hidden="true">↗</b></span><strong>See what matters</strong><p>One grade, plus source-backed nutrients.</p></div>
  <div><span>03 <b aria-hidden="true">✓</b></span><strong>Choose better</strong><p>Compare only nutritionally stronger, relevant foods.</p></div>
 </section>
 <section class="fs21-workbench" aria-labelledby="fs21-search-title">
  <div class="fs21-section-intro"><span class="fs21-overline">YOUR NEXT FOOD DECISION</span><h2 id="fs21-search-title">A smarter basket starts here.</h2><p>Scan with your camera, upload a barcode photo, or search the food database.</p></div>
  <div class="fs21-finder-host"></div>
 </section>
 <section class="fs21-explore" aria-labelledby="fs21-explore-title">
  <div class="fs21-explore-head"><div><span class="fs21-overline">TRY IT WITH REAL FOODS</span><h2 id="fs21-explore-title">From everyday foods to informed decisions.</h2></div><a href="#demo">See the full tour <span aria-hidden="true">↗</span></a></div>
  <div class="fs21-examples">${sample.map(([barcode,title,desc,num])=>`<button type="button" class="fs21-example" data-action="sample" data-code="${barcode}" aria-label="View the source report for ${E(title)}"><span class="fs21-example-num">${num}</span><span class="fs21-example-glyph" aria-hidden="true">${num==='01'?'◕':num==='02'?'◇':'◉'}</span><span class="fs21-example-body"><strong>${E(title)}</strong><small>${E(desc)}</small></span><span class="fs21-example-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>
 </section>
 <section class="fs21-your-space" aria-labelledby="fs21-space-title">
  <div><span class="fs21-overline">BUILT FOR EVERYDAY USE</span><h2 id="fs21-space-title">Your food shelf, without the clutter.</h2><p>Save useful products, compare alternatives and keep a local food journal. Nothing here assumes what you have actually eaten.</p><div class="fs21-space-actions"><a href="#saved">Open my foods ↗</a><a href="#insights">View my week ↗</a></div></div>
  <div class="fs21-space-stats" aria-label="Your recorded food activity"><div><strong>${saved}</strong><span>foods saved</span></div><div><strong>${recent}</strong><span>recent food records</span></div><p>Only information on this device. Counts are not health outcomes.</p></div>
 </section>
 <section class="fs21-trust" aria-labelledby="fs21-trust-title">
  <div><span class="fs21-overline">EVIDENCE OVER PROMISES</span><h2 id="fs21-trust-title">Good decisions need honest data.</h2></div>
  <p>FoodScan uses Open Food Facts community records, distinguishes incomplete information and shows why a comparison is suggested. Always verify ingredients and allergens on the current package. <a href="/how/">Read how FoodScan decides ↗</a></p>
 </section>
 <div class="fs21-diary-host"></div>
 </div>`);
 hero.content.querySelector('.fs21-finder-host').append(scanner.cloneNode(true));
 const host=hero.content.querySelector('.fs21-diary-host');
 if(day)host.append(day.cloneNode(true));
 if(diary)host.append(diary.cloneNode(true));
 if(foot)host.append(foot.cloneNode(true));
 return hero.innerHTML;
}

/** Filter candidates before legacy cards render; never call an unrelated food a verified swap. */
function screened(state,listField='swaps'){
 const data=state?.[listField],base=listField==='swaps'?state.active:resolveProduct(state,data?.baseCode);
 if(!base||!data||!Array.isArray(data.items)||data.status&&data.status!=='done')return {state,base,ranked:[]};
 const ranked=betterChoices(base,data.items,state.store?.profile,data.category).items;
 return {state:{...state,[listField]:{...data,items:ranked.map(item=>item.product)}},base,ranked};
}
export function swapsSection(state){
 const sw=state?.swaps,base=state?.active;
 if(!base||sw?.status!=='done')return previousSwaps(state);
 const {state:filtered,ranked}=screened(state);
 if(!ranked.length){
  const checked=Number.isFinite(sw.checked)?sw.checked:sw.items?.length||0;
  return `<div class="fs21-no-match" role="status"><strong>No verified, comparable higher-grade swap in this search.</strong><p>Checked ${checked} source records. Higher-grade foods in unrelated categories are not interchangeable, and missing data is not a negative result.</p><div class="fs21-no-match-actions"><button data-action="load-swaps" data-code="${E(base.barcode)}" type="button">Retry lookup</button><a href="#alternatives/${E(base.barcode)}">Explore the category →</a></div></div>`;
 }
 const t=template(previousSwaps(filtered));
 const meta=t.content.querySelector('.sec-sub,.fs15-comparison-context p');
 if(meta)meta.textContent='Nutrition differences between recorded products of a comparable food type. A shared category is not proof of equal taste, ingredients, allergens, availability or serving size.';
 const cards=[...t.content.querySelectorAll('.d8-swap')];
 for(let j=0;j<cards.length;j++){
  const card=cards[j];const r=ranked[j];if(!r)continue;
  const pill=document.createElement('p');pill.className='fs21-confidence';pill.textContent=r.verification==='preview'?'SOURCE INDEX PREVIEW · Open the full report to verify ingredients and dietary suitability.':'SOURCE-REPORTED GRADE · Verify the current packaging and allergens.';
  card.prepend(pill);
 }
 const heading=document.createElement('p');heading.className='fs21-swap-intro';heading.textContent='Only higher Nutri-Score grades with a comparable food type are shown. This is not a safety or medical recommendation.';
 t.content.prepend(heading);
 return t.innerHTML;
}
export function alternativesView(state){
 const d=state?.alternatives;
 if(!d?.baseCode||!Array.isArray(d.items))return previousAlternatives(state);
 const filtered=screened(state,'alternatives').state;
 return previousAlternatives(filtered);
}
export function productView(state){
 const t=template(previousProduct(state)),p=state?.active;
 if(!p)return t.innerHTML;
 const swaps=t.content.querySelector('#swaps-slot');
 if(swaps&&state?.swaps?.code===p.barcode)swaps.innerHTML=swapsSection(state);
 const evidence=allergenEvidence(p);
 const section=t.content.querySelector('#fs-ingredients')||t.content.querySelector('.fs15-report-page');
 if(!section)return t.innerHTML;
 const panel=document.createElement('section');panel.className='fs21-allergen-panel';panel.setAttribute('aria-label','Allergen data quality');
 const eyebrow=document.createElement('span');eyebrow.className='fs21-overline';eyebrow.textContent='ALLERGEN DATA · SOURCE EVIDENCE';
 const title=document.createElement('h3');title.textContent=evidence.unresolved.length?'Check the ingredients against the allergen list':'Understand what the database actually says';
 const note=document.createElement('p');note.textContent=evidence.disclosure;
 panel.append(eyebrow,title,note);
 const list=document.createElement('dl');list.className='fs21-allergen-evidence';
 for(const [label,values,empty] of [
  ['Declared allergens',evidence.declared,'Not reported'],
  ['May contain / traces',evidence.mayContain,'Not reported'],
  ['Ingredient-text terms not declared',evidence.unresolved,'No unmatched English terms detected']
 ]){
  const item=document.createElement('div'),term=document.createElement('dt'),definition=document.createElement('dd');
  term.textContent=label;definition.textContent=values.length?values.join(', '):empty;
  item.append(term,definition);list.append(item);
 }
 panel.append(list);
 const safety=document.createElement('p');safety.className='fs21-package-warning';safety.textContent='Always check the current package. Automated text checks do not establish that a food is allergen-free, including in languages not covered by the text matcher.';
 panel.append(safety);
 section.append(panel);
 return t.innerHTML;
}
