/** Evidence-first presentation. Report sections are directly readable without expanding panels. */
import {escapeHTML as e,formatNumber,formatValue,availableNutrients} from './model.js';
import {icon as i} from './icons.js';
import {PRIORITIES,AVOIDS,normalizeProfile,servingValue,METRICS,profileSummary,nutrientConflicts,hasProfile} from './profile.js';
import {resolveProduct} from './policy.js';
import {betterChoices,teaspoons,swapsWorthOffering,trafficLights} from './nutrition.js';
import {lightTiles} from './components.js';
import {parseIngredientsAccurately} from './ingredient-parser.js';
import {decisionFor,pantryReview,decisionPortion,canonicalCode} from './decision.js';
import {packArt} from './art.js';
const date=v=>v&&Number.isFinite(new Date(v).getTime())?new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not supplied';
export function sourceMini(p){
 const local=p.provenance==='local';
 return `<div class="d8-source"><span>${i('info')} ${local?'Your entry &middot; unverified':`<a href="https://world.openfoodfacts.org/product/${e(p.barcode)}" target="_blank" rel="noopener noreferrer">Open Food Facts</a>`}</span><span>Updated: ${date(p.sourceModified)} &middot; Retrieved: ${date(p.fetchedAt)}</span></div>`;
}
function picture(p){return `<div class="d8-pack">${p.image?`<img src="${e(p.image)}" alt="${e(p.name)} packaging" loading="lazy" referrerpolicy="no-referrer">`:packArt(p)}</div>`;}
function fact(flag){return `<div class="d8-fact fs-open-fact"><div class="fs-open-fact-top"><span class="d8-fact-mark ${flag.status}">${i(flag.status==='match'?'check':flag.status==='attention'?'alert':'info')}</span><strong>${e(flag.title)}</strong></div><p>${e(flag.why)}</p>${flag.sourceField?`<small class="d8-fact-source">Source field: ${e(flag.sourceField)}</small>`:''}</div>`;}
export function quickProfile(s){
 const p=normalizeProfile(s.store.profile),hasAny=p.avoids.length||p.priorities.length||p.diets.length,open=!hasAny||s.quickSetupOpen;
 if(!open)return `<button class="d8-profile-link" data-action="decision-profile-open">${i('leaf')} Adjust what matters ${i('chevron')}</button>`;
 const avoidIds=['nuts','peanuts','milk','gluten'];
 const goals=['sugars','protein','sodium'];
 return `<section class="d8-profile" data-quick-profile aria-label="Quick food profile"><div class="d8-subhead"><div><span class="eyebrow">ONE QUICK QUESTION</span><h2>What should we never miss?</h2></div><a href="#profile">All options</a></div><fieldset><legend>Always avoid <small>Unknown is shown as unknown \u2014 never assumed safe.</small></legend><div class="d8-toggle-grid">${avoidIds.map(id=>{const a=AVOIDS.find(x=>x.id===id);return `<label class="d8-toggle"><input type="checkbox" data-profile="avoid" value="${id}"${p.avoids.includes(id)?' checked':''}><span>${a.name}</span></label>`;}).join('')}</div></fieldset><fieldset><legend>Then pick a preference <small>Ranks foods; never hides them.</small></legend><div class="d8-goals">${goals.map(id=>{const r=PRIORITIES.find(x=>x.id===id),on=p.priorities.includes(id);return `<div class="d8-goal"><label class="d8-toggle"><input type="checkbox" data-profile="priority" value="${id}"${on?' checked':''}><span>${r.name}</span></label>${on?`<label class="d8-threshold">${r.direction==='lower'?'Below':'At least'} <input type="number" inputmode="decimal" min="0.1" max="${id==='sodium'?40000:100}" step="0.1" value="${p.thresholds[id]}" data-threshold="${id}" aria-label="${r.name} target"> ${r.unit}/100 g or ml</label>`:''}</div>`;}).join('')}</div></fieldset><div class="d8-setup-end"><span>Valid changes save immediately.</span><button class="button button-dark button-sm" data-action="decision-profile-done">${p.priorities.length+p.avoids.length+p.diets.length?'Done':'Continue without preferences'} ${i('arrow')}</button></div></section>`;
}
/* On a fail, the first button is the swap — name, delta, one tap. The failed product is a quiet second action. */
function swapFirstCTA(p,s,d){
 if(d.kind!=='check')return '';
 const sw=s.swaps;
 const quiet=`<button class="link-button d8-quiet-add" data-action="list-add" data-code="${p.barcode}">Add ${e(p.name)} anyway</button>`;
 if(!sw||sw.code!==p.barcode||sw.status==='idle')return `<div class="d8-swap-first"><button class="button button-primary button-lg" data-action="load-swaps" data-code="${p.barcode}">${i('swap')} Find a swap you can use</button>${quiet}</div>`;
 if(sw.status==='loading')return `<div class="d8-swap-first"><span class="spinner"></span><span class="muted">Finding a better choice&hellip;</span>${quiet}</div>`;
 if(sw.status==='error'||!sw.items?.length)return '';
 const {items}=betterChoices(p,sw.items,s.store.profile,sw.category);
 if(!items.length)return '';
 const top=items[0],sp=top.product,delta=top.why.slice(0,2).join(' \u00b7 ');
 const listed=s.store.shopping.some(x=>!x.checked&&x.intent==='buy-again'&&canonicalCode(x.barcode)===canonicalCode(sp.barcode));
 return `<div class="d8-swap-first"><span class="eyebrow">SWAP IT</span><div class="d8-swap-first-main">${sp.image?`<img src="${e(sp.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<div><strong>${e(sp.name)}</strong><span>${e(delta)}</span></div></div>${listed?`<a class="button button-dark button-lg" href="#shopping">${i('check')} Swap on today\u2019s list</a>`:`<button class="button button-primary button-lg" data-action="decision-swap" data-base="${p.barcode}" data-code="${sp.barcode}" data-category="${e(sw.category||'')}">${i('swap')} Add swap to today\u2019s list</button>`}${quiet}</div>`;
}
function confidenceFor(p){
 const nutrients=availableNutrients(p),hasIngredients=Boolean(p.ingredients),hasIdentity=Boolean(p.name&&p.brand),warnings=p.qualityWarnings?.length||0;
 const comprehensive=nutrients>=6&&hasIngredients&&hasIdentity&&!p.partial&&!warnings;
 const partial=nutrients>=3||hasIngredients;
 const tone=comprehensive?'strong':partial?'partial':'limited';
 return {tone,label:comprehensive?'Detailed source record':partial?'Partly filled source record':'Limited source record',detail:`${nutrients} of 8 core nutrition facts${hasIngredients?' · ingredients listed':' · ingredients missing'} · not independently verified`};
}
function trustStrip(p){
 const c=confidenceFor(p),sugar=nutrientConflicts(p).includes('sugars')?null:p.nutrition?.sugars,tsp=teaspoons(sugar);
 return `<div class="d10-trust" aria-label="Report reliability"><div class="d10-confidence d10-${c.tone}"><span class="d10-confidence-dot" aria-hidden="true"></span><div><strong>${e(c.label)} · source completeness</strong><small>${e(c.detail)}</small></div></div>${sugar!=null&&p.basis?`<div class="d10-sugar"><span>${i('cube')}</span><div><strong>About ${formatNumber(tsp)} tsp sugar</strong><small>per 100 ${p.basis} · 1 tsp ≈ 4 g</small></div></div>`:''}<a class="d10-method" href="#privacy">How we decide ${i('chevron')}</a></div>`;
}
/** A short nutrition finding, computed only from non-conflicting, basis-qualified facts.
 * It is NOT an unconditional verdict that a food is safe/unsafe to eat. */
export function executiveFinding(p){
 const high=trafficLights(p).items.filter(x=>x.level==='high').sort((a,b)=>['sugars','saturatedFat','fat','salt'].indexOf(a.key)-['sugars','saturatedFat','fat','salt'].indexOf(b.key));
 const names={sugars:'sugars',saturatedFat:'saturated fat',fat:'total fat',salt:'salt'};
 const first=parseIngredientsAccurately(p.ingredients).items[0];
 const sugarFirst=Boolean(first?.tone==='sugar');
 const summaryBits=[];
 if(sugarFirst)summaryBits.push('Sugar is listed first in the ingredient text.');
 if(p.nova===4)summaryBits.push('The database lists NOVA group 4 (ultra-processed).');
 if(p.nutriScore)summaryBits.push(`Nutri-Score ${p.nutriScore} is reported for this product.`);
 const headline=high.length?`High in ${high.slice(0,2).map(x=>names[x.key]).join(' and ')}${high.length>2?' + more':''}`
     :p.nova===4?'Ultra-processed according to the source'
     :p.nutriScore?`Source-reported Nutri-Score ${p.nutriScore}`:'Read the label facts before choosing';
 const explanation=high.length?`UK front-of-pack bands mark ${high.map(x=>names[x.key]).join(', ')} as high per 100 ${p.basis}. ${summaryBits.join(' ')}`
     :summaryBits.length?summaryBits.join(' '):'This source record may not include all nutrition or ingredient details.';
 return {headline,explanation,highCount:high.length};
}
/* Studio 11 — an immediate, evidence-led result. Keep eligibility and source logic unchanged. */
/* v11.2: First-screen ingredients preview — top 5 by weight with honest flags.
   Full list lives at #fs-ingredients; this is the glanceable entry point. */
function ingredientsPreview(p){
 const {items}=parseIngredientsAccurately(p.ingredients||'');
 if(!items.length)return '';
 const top=items.slice(0,5);
 return `<section class="d8-ing-preview" aria-label="Ingredients preview"><div class="d8-ing-preview-head"><span class="fs-mini-kicker">WHAT'S ACTUALLY IN IT</span><a href="#fs-ingredients">Full list ${i('arrow')}</a></div><ol>${top.map(it=>{
  const cls=it.tone==='additive'?'ing-additive':it.tone==='allergen'?'ing-allergen':it.tone==='sugar'?'ing-sugar':it.tone==='oil'?'ing-palm':'';
  const badge=it.tone==='additive'?'<span class="ing-badge">additive</span>':it.tone==='allergen'?'<span class="ing-badge ing-badge-allergen">allergen</span>':'';
  return `<li class="${cls}"><span class="ing-pos">${it.rank}</span><span class="ing-name">${e(it.name)}${it.percentage!=null?` <span class="ing-pct">${String(it.percentage).replace('.',',')}%</span>`:''}</span>${badge}</li>`;
 }).join('')}</ol>${items.length>5?`<p class="d8-ing-more">+ ${items.length-5} more in the full list</p>`:''}</section>`;
}
export function resultSummary(p,s){
 const d=decisionFor(p,s.store.profile),selected=s.store.profile.priorities;
 const metricIds=(selected.length?selected.filter(k=>k!=='additives'):['kcal','protein','sugars','fiber']).slice(0,4);
 const portion=decisionPortion(p),saved=s.store.saved.some(x=>x.barcode===p.barcode),listed=s.store.shopping.some(x=>!x.checked&&x.intent==='buy-again'&&canonicalCode(x.barcode)===canonicalCode(p.barcode));
 const cards=metricIds.map(id=>{const r=PRIORITIES.find(x=>x.id===id)||{metric:id,unit:'kcal'},sv=servingValue(p,r.metric),flag=d.flags.find(x=>x.key===id),unknown=flag?.status==='unknown'||nutrientConflicts(p).includes(r.metric);const n=p.nutrition?.[r.metric];const label=METRICS[r.metric]?.name||r.name;
  return `<div class="d8-metric"><span>${e(label)}</span><strong>${unknown?'Check data':portion&&sv.value!=null?formatValue(sv.value,r.unit):n==null?'Not reported':formatValue(n,r.unit)}</strong><small>${portion&&sv.value!=null?`Per reported ${formatNumber(portion.amount)} ${portion.unit} serving${sv.estimated?' · calculated':''}`:p.basis?`Per 100 ${p.basis}`:'Basis not reported'}</small></div>`;
 }).join('');
 const conflicts=new Set(nutrientConflicts(p));
 const rawEvidence=d.flags.filter(f=>f.status!=='unknown').slice(0,2);
 // With no chosen priorities, lead with two real source facts instead of an empty verdict.
 const evidenceFallback=[];
 if(p.allergens?.length) evidenceFallback.push({status:'fact',title:`Allergens listed: ${p.allergens.slice(0,3).join(', ')}${p.allergens.length>3?'…':''}`,why:'As recorded by the source. Always confirm against the current package.'});
 if(p.basis&&!conflicts.has('sugars')&&Number.isFinite(p.nutrition?.sugars)) evidenceFallback.push({status:'fact',title:`${formatNumber(p.nutrition.sugars)} g sugar per 100 ${p.basis}`,why:'A reported amount, not a personal nutrition threshold.'});
 if(p.basis&&!conflicts.has('protein')&&Number.isFinite(p.nutrition?.protein)) evidenceFallback.push({status:'fact',title:`${formatNumber(p.nutrition.protein)} g protein per 100 ${p.basis}`,why:'Reported by the food record; actual recipes and portions may differ.'});
 const meaningful=rawEvidence.length?rawEvidence:evidenceFallback.slice(0,2);
 const known=d.flags.filter(f=>f.status==='unknown');
 // These chips are reported label facts, never a safety rating. Only show values with an accepted basis.
 const immediate=[];
 if(p.allergens?.length) immediate.push({label:'Reported allergens',value:p.allergens.slice(0,3).join(' · ')+(p.allergens.length>3?' + more':'')});
 if(p.basis&&!conflicts.has('sugars')&&Number.isFinite(p.nutrition?.sugars)) immediate.push({label:`Sugar / 100 ${p.basis}`,value:`${formatNumber(p.nutrition.sugars)} g`});
 if(p.basis&&!conflicts.has('protein')&&Number.isFinite(p.nutrition?.protein)&&immediate.length<2) immediate.push({label:`Protein / 100 ${p.basis}`,value:`${formatNumber(p.nutrition.protein)} g`});
 const glance=immediate.length?`<div class="fs11-immediate" aria-label="Important source facts">${immediate.slice(0,2).map(x=>`<div><span>${e(x.label)}</span><strong>${e(x.value)}</strong></div>`).join('')}</div>`:'';

 const kindName={match:'MATCHES YOUR PREFERENCES',check:'REVIEW BEFORE YOU CHOOSE',unconfirmed:'VERIFY THE INFORMATION',neutral:'YOUR FOOD FACTS'}[d.kind]||'FOOD REPORT';
 const action=d.kind==='check'?'Compare this product with others against your selected priorities.':d.kind==='match'?'The listed facts match your selected preferences. Always check the current package.':d.kind==='unconfirmed'?'Some information is missing or inconsistent. Confirm on the physical package.':'Use these recorded facts to understand the product. Choose preferences for a more relevant comparison.';
 const detailBits=meaningful.map(x=>`<li><span class="fs11-evidence-dot fs11-${x.status}">${i(x.status==='match'?'check':'info')}</span><div><strong>${e(x.title)}</strong><p>${e(x.why||'Reported source fact.')}</p></div></li>`).join('');
 const allergenHits=d.flags.filter(f=>f.status==='attention'&&AVOIDS.some(a=>a.id===f.key));
 const allergenAlert=allergenHits.length?`<div class="d8-allergen-alert" role="alert">${i('alert')}<div><strong>${e(allergenHits[0].title)}</strong><span>${e(allergenHits[0].why)}</span></div></div>`:'';
 const actions=`<div class="d8-result-actions">${d.kind==='check'?(swapsWorthOffering(p,s.store.profile)?`<button class="button button-primary" data-action="load-swaps" data-code="${e(p.barcode)}">${i('compare')} Compare options</button>`:`<a class="button button-primary" href="#fs-nutrition">${i('info')} Review nutrition</a>`):listed?`<a class="button button-primary" href="#shopping">${i('check')} On shopping list</a>`:`<button class="button button-primary" data-action="list-add" data-code="${e(p.barcode)}">${i('list')} Add to shopping list</button>`}<button class="button button-outline" data-action="save" data-code="${e(p.barcode)}" aria-pressed="${saved}">${i('heart')} ${saved?'Saved':'Save food'}</button><button class="button button-outline" data-action="compare-add" data-code="${e(p.barcode)}">${i('compare')} Compare</button><button class="button button-outline" data-action="share" data-code="${e(p.barcode)}">${i('share')} Share</button></div>`;
 const finding=executiveFinding(p),grade=p.nutriScore,nova=p.nova;
 const gradeBox=grade?`<span class="fs12-score fs12-grade-${grade.toLowerCase()}"><small>Nutri-Score</small><strong>${grade}</strong></span>`:'<span class="fs12-score fs12-score-missing"><small>Nutri-Score</small><strong>—</strong><span>Not provided</span></span>';
 const novaBox=nova?`<span class="fs12-score fs12-nova-${nova}"><small>NOVA group</small><strong>${nova}</strong><span>${nova===4?'Ultra-processed':nova===1?'Minimally processed':nova===2?'Culinary ingredient':'Processed'}</span></span>`:'<span class="fs12-score fs12-score-missing"><small>NOVA group</small><strong>—</strong><span>Not provided</span></span>';
 const mainButton=swapsWorthOffering(p,s.store.profile)?`<button type="button" class="fs12-hero-primary" data-action="load-swaps" data-code="${e(p.barcode)}">${i('compare')} See compared foods ${i('arrow')}</button>`:`<a class="fs12-hero-primary" href="#fs-ingredients">${i('leaf')} Read ingredients ${i('arrow')}</a>`;
 return `<article class="d8-result d8-${d.kind} fs11-result fs12-result" aria-labelledby="decision-title">
 <div class="fs12-hero"><div class="fs12-hero-bar"><span class="fs12-source-status">${i('info')} ${p.provenance==='local'?'Your unverified entry':'Open Food Facts · community-maintained'}</span><span class="fs12-hero-code">Barcode ${e(p.barcode)}</span></div>
 <div class="fs12-hero-grid"><div class="fs12-identity">${picture(p)}<div><span class="fs12-product-kicker">${e(p.brand||'Brand not supplied')}</span><h2>${e(p.name)}</h2><p>${e(p.quantity||'Pack size not supplied')}</p></div></div>
 <div class="fs12-executive"><div class="fs12-executive-top"><span class="fs12-verdict-label">THE FIRST-GLANCE FINDING</span><div class="fs12-score-row">${gradeBox}${novaBox}</div></div>
 <h1 id="decision-title">${e(finding.headline)}</h1><p class="fs12-verdict-lead">${e(finding.explanation)}</p>
 ${d.kind==='neutral'?'':`<div class="fs12-preferences fs12-pref-${d.kind}"><strong>${e(kindName)}</strong><span>${e(d.title)} ${e(d.summary)}</span></div>`}
 ${allergenAlert}
 <div class="fs12-traffic"><div class="fs12-traffic-head"><strong>Nutrition traffic lights</strong><span>${p.basis?`per 100 ${e(p.basis)}`:'Unit not confirmed'} · UK thresholds</span></div>${lightTiles(p)}</div>
 <div class="fs12-hero-actions">${mainButton}<a href="#fs-product-log-heading" class="fs12-hero-secondary">${i('check')} Calculate a portion</a><button type="button" class="fs12-hero-secondary" data-action="share" data-code="${e(p.barcode)}">${i('share')} Share</button></div>
 <p class="fs12-hero-disclaimer">FoodScan compares reported data, not food safety or medical suitability. Check the current package for allergies.</p>
 </div></div></div>
 <div class="fs11-evidence-row"><div class="fs11-evidence-heading"><span class="fs11-tag">HOW TO USE THIS RESULT</span><h2>Here’s what matters.</h2><p>${e(action)}</p></div><div class="fs11-evidence-list">${detailBits?`<ul>${detailBits}</ul>`:`<p class="fs11-no-rules">${known.length?`${known.length} selected fact${known.length===1?' is':'s are'} not confirmed in this record.`:'Review the label details below to make an informed choice.'}</p>`}</div></div>
 <div class="fs11-metrics-head"><div><span class="fs11-tag">AT A GLANCE</span><h2>Key nutrition numbers</h2></div><span>${portion?`Per recorded ${formatNumber(portion.amount)} ${portion.unit} serving`:`${p.basis?`Per 100 ${p.basis}`:'Basis not reported'}`}</span></div><div class="d8-metrics">${cards}</div>
 <div class="fs11-result-source">${trustStrip(p)}${sourceMini(p)}${s.snapshotNotice?'<p class="d8-cache-note">Stored snapshot. Refresh to check for newer data.</p>':''}</div>
 ${actions}
 ${d.flags.length?`<div class="fs11-personal-checks"><div><span class="fs11-tag">YOUR RULES</span><h3>Checks against your preferences</h3></div><div class="d8-facts">${d.flags.map(fact).join('')}</div></div>`:''}
 <div class="d8-result-tools"><button data-action="report" data-code="${p.barcode}">${i('alert')} Report a source issue</button><button data-action="reload" data-code="${p.barcode}">${i('refresh')} Refresh record</button></div></article>${ingredientsPreview(p)}${quickProfile(s)}`;
}
export function gatePanel(s){
 const x=s.excludedResult,conflict=x.status==='excluded';
 return `<div class="container d8-page"><article class="d8-gate ${conflict?'conflict':'unknown'}" aria-labelledby="gate-title"><span class="d8-gate-icon" aria-hidden="true">${i(conflict?'alert':'info')}</span><span class="eyebrow">${conflict?'AVOID-RULE CONFLICT':'INFORMATION MISSING'}</span><h1 id="gate-title" tabindex="-1">${conflict?'Does not fit your avoid rules.':'Your restrictions cannot be confirmed.'}</h1><p class="d8-gate-lead">${e(x.reasons?.[0]?.title||'Check the current package.')}</p><div class="barcode-chip">${i('scan')} ${e(x.barcode)}</div><p>${conflict?'This source record is withheld from your food and shopping views.':'Missing information is not evidence that an ingredient is absent.'} Check the package and manufacturer; FoodScan cannot confirm allergy safety.</p>${sourceMini(x)}<div class="d8-facts">${(x.reasons||[]).map(fact).join('')}</div><div class="d8-result-actions"><button class="button button-primary" data-action="camera">${i('scan')} Scan another</button><a class="button button-outline" href="#profile">Review my rules</a></div><div class="d8-result-tools"><button data-action="report" data-code="${x.barcode}">${i('alert')} Report data issue</button><a href="#home">Back to Home</a></div></article></div>`;
}
export function savedFails(state){
 const store=state.store||state,profile=normalizeProfile(store.profile);
 if(!hasProfile(profile))return [];
 const out=[];
 for(const row of store.saved||[]){
  if(!row.barcode)continue;
  const p=resolveProduct(state,row.barcode);
  if(!p)continue;
  const d=decisionFor(p,profile);
  if(d.kind==='check'||d.kind==='excluded')out.push({barcode:row.barcode,name:p.name,decision:d});
 }
 return out;
}
export function pantryNudge(review,savedCount=0){
 if((!review?.total||!review.profiled)&&!savedCount)return '';
 const hard=review?.hard.length||0,soft=review?.soft.length||0;
 const bits=[];
 if(soft)bits.push(`${soft} pantry ${soft===1?'product is':'products are'} outside your nutrition targets`);
 if(hard)bits.push(`${hard} pantry ${hard===1?'record needs':'records need'} a restriction check`);
 if(savedCount)bits.push(`${savedCount} saved ${savedCount===1?'food breaks':'foods break'} your active rule`);
 if(!bits.length&&review?.total)bits.push(`${review.total} pantry ${review.total===1?'record has':'records have'} missing or uncertain details`);
 const joined=bits.join(' \u00b7 ');
 const title=joined?joined.charAt(0).toUpperCase()+joined.slice(1)+'.':'';
 return `<section class="d8-nudge" aria-labelledby="nudge-title"><span class="d8-nudge-icon" aria-hidden="true">${i('package')}</span><div><span class="eyebrow">BEFORE YOUR NEXT SHOP</span><h2 id="nudge-title">${e(title)}</h2><p>${hard&&soft?`${hard} additional restriction checks. `:''}Review what is already at home. Nothing is removed or swapped automatically.</p></div><div class="d8-nudge-actions"><a class="button button-dark" href="#review">Review pantry ${i('arrow')}</a>${savedCount?`<a class="button button-outline" href="#saved">Review saved ${i('arrow')}</a>`:''}</div></section>`;
}
export function reviewPage(state){
 const r=pantryReview(state),profile=normalizeProfile(state.store.profile);
 const items=r.items.map(x=>{const p=x.product,d=x.decision;if(x.hidden)return `<article class="d8-review-item d8-withheld"><span class="d8-review-symbol">${i(d.kind==='excluded'?'alert':'info')}</span><div><h2>${e(d.title)}</h2><p>${e(d.summary)}</p><small>Barcode: ${e(x.barcode||'Not linked to a source record')}</small>${x.source?sourceMini(x.source):'<p class="small muted">Your list note &middot; source and update date unavailable.</p>'}</div>${x.barcode?`<a class="button button-outline button-sm" href="#food/${e(x.barcode)}">Review restriction</a>`:'<button class="button button-outline button-sm" data-action="camera">Scan package</button>'}</article>`;
 return `<article class="d8-review-item">${picture(p)}<div><h2>${e(p.name)}</h2><p>${e(d.summary)}</p>${sourceMini(p)}</div><a class="button button-primary button-sm" href="#food/${e(p.barcode)}">Review &amp; compare ${i('arrow')}</a></article>`;
 }).join('');
 return `<div class="container d8-page"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="#home">${i('back')} Home</a><a href="#pantry">My pantry</a></nav><div class="d8-review-head"><span class="eyebrow">A QUICK CHECK BEFORE YOU SHOP</span><h1>Make the next shop<br><em>fit your priorities.</em></h1><p>${r.checked} distinct pantry records checked against your current choices. This is a review of stored package data, not what you ate.</p><p class="d8-profile-caption">${e(profileSummary(profile))}</p></div>${items?`<div class="d8-review-list">${items}</div>`:`<div class="empty"><span class="empty-icon">${i('package')}</span><h2>${r.profiled?'No review items in your current records.':'Choose a priority to review your pantry.'}</h2><p>${r.profiled?'This is not an all-clear for allergens or freshness. Keep checking the current package.':'Set an avoid rule or a nutrition preference. Your records stay on this device.'}</p><div class="button-row"><a class="button button-primary" href="${r.profiled?'#shopping':'#profile'}">${r.profiled?'Open shopping list':'Choose priorities'}</a><button class="button button-outline" data-action="camera">Scan a package</button></div></div>`}<div class="d8-review-footer"><a class="button button-dark" href="#shopping">${i('list')} Today's list</a><button class="button button-outline" data-action="grocery-review">Review restock suggestions</button></div></div>`;
}
export function swapChoiceCard(item,base,s,category){
 const p=item.product,original=s.store.shopping.some(x=>!x.checked&&x.intent==='buy-again'&&canonicalCode(x.barcode)===canonicalCode(base.barcode)),listed=s.store.shopping.some(x=>!x.checked&&x.intent==='buy-again'&&canonicalCode(x.barcode)===canonicalCode(p.barcode));
 return `<article class="d8-swap"><div class="d8-swap-top">${picture(p)}<div><span class="food-brand">${e(p.brand||'Brand not supplied')}</span><h3>${e(p.name)}</h3><span class="d8-swap-label">A measured difference, not a health score</span></div></div><div class="d8-deltas">${item.why.map(t=>`<span>${e(t)}</span>`).join('')}</div>${sourceMini(p)}<div class="d8-swap-actions">${listed?`<a class="button button-dark" href="#shopping">${i('check')} On today's list</a>`:p.partial?`<a class="button button-primary" href="#food/${p.barcode}">Open complete record</a>`:`<button class="button button-primary" data-action="decision-swap" data-base="${base.barcode}" data-code="${p.barcode}" data-category="${e(category)}">${i('swap')} ${original?"Swap on today's list":"Add swap to today's list"}</button>`}<a class="button button-ghost button-sm" href="#food/${p.barcode}">Details ${i('arrow')}</a></div><p class="d8-swap-note">${original?'Replaces this pending product only. Quantity and note stay; its old price is cleared.':'Adds one item. No existing list item is removed.'} Different pack sizes may need a quantity check. Store availability is not verified.</p></article>`;
}
