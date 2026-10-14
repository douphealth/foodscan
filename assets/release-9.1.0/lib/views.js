/** FoodScan v4 views — "Terra" presentation.
 * Same contracts as v3 (exports + data-action/data-* hooks), new design.
 * Facts-first: no invented scores; every claim carries source + date.
 */
import {escapeHTML as e,FIELDS,formatNumber,formatValue,VERSION,snapshotLabel} from './model.js';
import {icon as i} from './icons.js';
import {PRIORITIES,AVOIDS,DIETS,hasProfile,hasRestrictions,assess,RULE_VERSION,priorityMetrics,METRICS,basisLabel,servingValue,nutrientConflicts,comparable,rankAlternatives,eligibility,rankProducts,profileSummary,profileSignature} from './profile.js';
import {localRecap} from './store.js';
import {projectState,visibleProducts,resolveProduct} from './policy.js';
import {packArt,barcodeBars,ART} from './art.js';
export {demoView,demoStage} from './demo.js';
import {demoProduct,DEMO_CODES} from './demo.js';
import {gradeStrip,gradeDot,novaBar,scoreCards,realStoryPillars,quickReadList,lightTiles,miniLights,compositionBar,portionPanel,portionStart,swapSkeleton,swapCard} from './components.js';
import {quickRead,betterChoices,swapsWorthOffering,swapMetrics,usableCategories,basketSummary,tipOfTheDay,COUNTRIES,swapCountry,GRADE_STYLE,NOVA_INFO,trafficLights} from './nutrition.js';
import {amazonSearchLink,ASSOCIATE_DISCLOSURE} from './commerce.js';
import {shoppingViewV8,pantryBanner} from './grocery-ui.js';
import {todayView} from './today.js';
import {pantryReview,decisionFor} from './decision.js';
import {resultSummary,gatePanel,pantryNudge,reviewPage,swapChoiceCard,savedFails} from './decision-ui.js';

export const allProducts=s=>visibleProducts(s);
const stamp=(ts,locale='en-GB')=>ts?new Date(ts).toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric'}):'Not supplied';
const tag=t=>String(t).replace(/^[a-z]{2}:/,'').replaceAll('-',' ');
const button=(action,label,icon,code='',css='button-outline')=>`<button class="button ${css}" data-action="${action}"${code?` data-code="${e(code)}"`:''}>${icon?i(icon):''}${e(label)}</button>`;

/* ---------- shared bits ---------- */
export function logo(){return `<a class="brand" href="#home" aria-label="FoodScan home"><span class="brand-mark">${i('scan')}</span><span>FoodScan<b aria-hidden="true">.</b></span></a>`;}
export function noticeBox(message,kind='info'){return `<div class="notice ${kind}" role="${kind==='error'?'alert':'note'}">${i(kind==='error'?'alert':kind==='warning'?'alert':'info')}<div>${message}</div></div>`;}
export function productImage(p,classes=''){return `<div class="product-image ${classes}"><span class="image-fallback" aria-hidden="true">${packArt(p)}</span>${p.image?`<img src="${e(p.image)}" alt="${e(p.name)} packaging" loading="lazy" referrerpolicy="no-referrer" decoding="async">`:''}</div>`;}

function provenanceLine(p){
  if(p.provenance==='local')return `<span class="unverified-tag">${i('info')} Your entry · unverified</span>`;
  return `<span class="source-line">${i('info')}<span>Open Food Facts &middot; Updated: ${stamp(p.sourceModified)}<small>Retrieved: ${stamp(p.fetchedAt)}</small></span></span>`;
}
function verdictData(p,s){
  const a=assess(p,s.store.profile),d=decisionFor(p,s.store.profile);
  return {assessment:a,title:d.title,tone:d.kind==='match'?'neutral':['check','excluded'].includes(d.kind)?'attention':'unknown',
    summary:a.cautions?`${a.cautions} detail${a.cautions===1?'':'s'} to check first.`
      :a.unknown?`${a.unknown} uncertain — not treated as zero.`
      :a.matches?`${a.matches} of your filters match.`
      :'Facts below. No food score, ever.'};
}
function verdictLabel(p,s){const v=verdictData(p,s);return v.title;}
function flagCard(flag){
  const label={attention:'Check this',unknown:'Uncertain',match:'Matches this filter',fact:'Reported fact'}[flag.status]||'Note';
  const icon=flag.status==='attention'?'alert':flag.status==='match'?'check':'info';
  return `<details class="why-flag ${flag.status}"><summary><span class="flag-icon">${i(icon)}</span><span>${e(flag.title)}</span><span class="flag-status">${label} · Why?</span></summary><div class="why-body"><p>${e(flag.why)}</p><small>Source field: ${e(flag.sourceField)} · ${e(flag.sourceType)}</small></div></details>`;
}
function dqBadges(p){
  const out=[];
  if(p.energyConverted||p.sodiumDerived)out.push(`<span class="dq-badge estimated">${i('info')} Estimated value</span>`);
  const missing=['kcal','protein','sugars','fiber'].filter(k=>p.nutrition?.[k]==null);
  if(missing.length)out.push(`<span class="dq-badge missing">${i('alert')} Missing: ${missing.join(', ')}</span>`);
  if(nutrientConflicts(p).length)out.push(`<span class="dq-badge conflict">${i('alert')} Conflicting values</span>`);
  if(p.qualityWarnings?.length)out.push(`<span class="dq-badge conflict">${i('alert')} Source flagged for review</span>`);
  if(!out.length)out.push(`<span class="dq-badge verified">${i('info')} No flags in supplied fields</span>`);
  return out.join('');
}
function emptyState(iconName,title,text,actions=''){
  const art={list:ART.basket,package:ART.pantry,heart:ART.heart,chart:ART.chart,compare:ART.search,spark:ART.search}[iconName];
  return `<div class="empty">${art||`<span class="empty-icon">${i(iconName)}</span>`}<h2>${e(title)}</h2><p>${e(text)}</p>${actions?`<div class="button-row" style="justify-content:center">${actions}</div>`:''}</div>`;
}
function pageHead(eyebrow,title,lead='',actions=''){
  return `<div class="section-head"><div>${eyebrow?`<span class="eyebrow"><span class="dot"></span>${e(eyebrow)}</span>`:''}<h2>${title}</h2>${lead?`<p class="lead">${lead}</p>`:''}</div>${actions?`<div>${actions}</div>`:''}</div>`;
}
function withheldNotice(s){
  const key={home:'recent',saved:'saved',shopping:'shopping',pantry:'pantry'}[s.route],count=key?s.withheld?.[key]:0;
  return count?`<div class="container"><p class="withheld-notice" role="status">${count} stored ${count===1?'entry is':'entries are'} withheld by your active restrictions. Conflicting and unconfirmed records stay stored; nothing was deleted.</p></div>`:'';
}

/* ---------- header / footer ---------- */
export function activeProfile(s){
  const p=s.store.profile;
  const names=[...p.avoids.map(k=>'Avoid '+(AVOIDS.find(a=>a.id===k)?.name||k)),...p.diets.map(k=>DIETS.find(d=>d.id===k)?.name||k),...p.priorities.map(k=>PRIORITIES.find(x=>x.id===k)?.name||k)];
  const summary=names.length?names.join(' / '):'No priorities selected';
  return `<div class="profile-strip"><div class="container"><span class="profile-symbol" aria-hidden="true">${i('leaf')}</span><span class="profile-summary"><strong>Active profile</strong><span title="${e(summary)}">${e(summary)}</span></span><a class="profile-edit" href="#profile" aria-label="${names.length?'Edit':'Choose'} your food priorities">${names.length?'Edit':'Choose'} ${i('chevron')}</a></div></div>`;
}
export function header(state){
  const s=projectState(state);
  const routes=[['home','home','Today'],['saved','heart','My foods'],['shopping','list','List'],['insights','chart','My week']];
  const current=r=>s.route===r||(r==='home'&&s.route==='food')||(r==='saved'&&['pantry','compare'].includes(s.route));
  const count=s.store.shopping.filter(x=>!x.checked&&x.intent==='buy-again').length;
  const link=([r,ic,label])=>`<a href="#${r}"${current(r)?' aria-current="page"':''}>${i(ic)}<span>${label}</span>${r==='shopping'&&count?`<b class="nav-count" aria-label="${count} pending items">${count>99?'99+':count}</b>`:''}</a>`;
  const links=routes.map(link).join('');
  const mobile=[['home','home','Today'],['saved','heart','Foods'],null,['shopping','list','List'],['insights','chart','Week']].map(item=>item?link(item):`<span class="nav-scan-slot"><button class="nav-scan" data-action="camera" aria-label="Scan a barcode">${i('scan')}</button></span>`).join('');
  return `<header class="site-header"><div class="container header-inner">${logo()}<nav class="main-nav" aria-label="Main navigation">${links}</nav><div class="header-actions"><a class="header-how" href="#demo">${i('spark')} How it works</a><a class="icon-button" href="#profile" aria-label="Your food profile">${i('leaf')}</a><button class="icon-button" data-action="settings" aria-label="Open settings">${i('settings')}</button></div></div></header>${activeProfile(s)}${!s.online?`<div class="offline-banner" role="status"><div class="container">${i('offline')}<span>Offline &middot; stored foods and lists are available.</span></div></div>`:''}<nav class="bottom-nav" aria-label="Mobile navigation">${mobile}</nav>`;
}
export function footer(){
 return `<footer class="site-footer"><div class="container footer-inner"><div class="footer-brand">${logo()}<span class="release">${VERSION}</span></div><p>Open Food Facts &amp; contributors (ODbL). Check the package. Not medical advice.<br><span class="associate-disclosure">${e(ASSOCIATE_DISCLOSURE)}</span></p><div class="footer-links"><a href="#demo">How it works</a><a href="#privacy">Privacy &amp; sources</a><a href="#about">About</a><button class="link-button" data-action="settings">Settings</button><a href="https://gearuptofit.com/">A GearUpToFit tool</a></div></div></footer>`;
}

/* ---------- home ---------- */
export function scanForm(s){
 return `<div class="scan-card-head"><span class="section-kicker">THE QUICK LOOKUP</span><h2>Have the barcode?</h2><p>Type or paste the digits from your package.</p></div>
 <form id="lookup-form" aria-label="Barcode lookup"><label class="field-label" for="barcode-input">Barcode number</label><div class="barcode-entry"><span aria-hidden="true">${i('scan')}</span><input id="barcode-input" name="barcode" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="e.g. 3017624010701" value="${e(s.input||'')}" maxlength="40" aria-describedby="barcode-help"><button class="lookup-submit" type="submit" aria-label="Look up this barcode">${i('arrow')}</button></div><p class="field-hint" id="barcode-help">Use the numbers underneath the barcode.</p></form>
 ${s.error&&s.route==='home'?noticeBox(e(s.error.message),'error'):''}
 <details class="name-disclosure"><summary>${i('search')}<span>Search by product name</span>${i('chevron')}</summary><form id="name-search-form" class="name-search" role="search"><label class="sr-only" for="name-search-input">Product name</label><div class="field">${i('search')}<input id="name-search-input" name="q" type="search" placeholder="Oat milk, yogurt..." autocomplete="off" value="${e(s.nameQuery||'')}"><button type="button" class="voice-btn" data-action="voice-search" aria-label="Search by voice">${i('mic')}</button></div><button class="button button-dark" type="submit">Search</button></form></details>
 <div class="search-results" id="name-search-results" aria-live="polite">${nameResults(s)}</div>
 <div class="try-row"><span class="try-label">No product handy? Try one:</span><span class="try-chips">${[['3017624010701','Chocolate spread'],['5449000131805','Zero cola'],['7394376616228','Oat drink'],['8076800195057','Spaghetti']].map(([c,l])=>`<button type="button" class="fchip" data-action="sample" data-code="${c}">${l}</button>`).join('')}</span></div>
 <div class="lookup-note">${i('info')}<span>Source records can be incomplete. Missing facts stay marked as unknown.</span></div>`;
}

function nameResults(s){
  const r=s.nameResults;if(!r)return '';
  if(r.loading)return `<div class="lookup-card" style="padding:1.6rem"><span class="spinner" style="width:36px;height:36px"></span><p class="muted">Searching Open Food Facts…</p></div>`;
  if(r.error)return noticeBox(e(r.error),'error');
  if(!r.items.length)return `<p class="muted">No packaged foods found for “${e(r.query)}”. Try the barcode instead.</p>`;
  return `<p class="small muted">${r.items.length} result${r.items.length===1?'':'s'} for “${e(r.query)}” · source: Open Food Facts</p><div class="food-grid mt-1">${r.items.map(p=>productCard(p,s,true)).join('')}</div>`;
}
function tiles(s){
  const st=s.store;
  const defs=[['saved','heart','My foods','Your everyday favorites, kept close.','tone-sage',st.saved.length],
    ['shopping','list','Shopping list','Give your next trip a head start.','tone-butter',st.shopping.filter(x=>!x.checked).length],
    ['pantry','package','Pantry','Less forgetting. More knowing.','tone-peach',st.pantry.length],
    ['compare','compare','Compare','Up to four foods. Your priorities.','tone-lilac',s.compare.filter(Boolean).length]];
  return `<div class="tiles" data-reveal>${defs.map(([r,ic,t,d,tone,n])=>`<a class="tile ${tone} rise" href="#${r}"><span class="tile-top"><span class="tile-icon">${i(ic)}</span><span class="tile-count">${n}</span></span><h3>${t}</h3><p>${d}</p><span class="tile-go">Open ${i('arrow')}</span></a>`).join('')}</div>`;
}
/** First red flag, else first green: one line that tells you why a card looks the way it does. */
function topReason(p){
  const items=quickRead(p),red=items.find(x=>x.tone==='red'),green=items.find(x=>x.tone==='green');
  const x=red||green;
  return x?{tone:red?'red':'green',icon:red?'alert':'check',text:x.title}:null;
}
/** A search hit that cannot yet be checked against hard restrictions: listed, never judged. */
function previewCard(p){
  return `<article class="food-card food-card-small preview"><a class="food-card-open" href="#food/${p.barcode}"><div class="fc-row"><div class="fc-thumb">${p.image?`<img src="${e(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span class="fc-fallback">${packArt(p)}</span>`}</div>
    <div class="fc-main"><span class="food-brand">${e(p.brand||'Brand not reported')}</span><h3>${e(p.name)}</h3><p class="verdict-line tone-unknown">${i('info')}<span>Open to check against your profile</span></p></div></div></a></article>`;
}
export function productCard(p,s,small=false){
  const current=resolveProduct(s,p.barcode)||p;
  const decision=eligibility(current,s.store.profile);
  if(!decision.allowed)return decision.reasons?.[0]?.key==='partial'?previewCard(current):'';
  const saved=s.store.saved.some(x=>x.barcode===current.barcode);
  const personal=hasProfile(s.store.profile);
  const v=verdictData(current,s);
  const reason=personal?null:topReason(current);
  const nova=NOVA_INFO[current.nova];
  return `<article class="food-card${small?' food-card-small':''}">
    <a class="food-card-open" href="#food/${current.barcode}">
    <div class="fc-row"><div class="fc-thumb">${current.image?`<img src="${e(current.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span class="fc-fallback">${packArt(current)}</span>`}${saved?`<span class="fc-saved" aria-hidden="true">${i('heart')}</span>`:''}</div>
    <div class="fc-main"><span class="food-brand">${e(current.brand||'Brand not reported')}</span><h3>${e(current.name)}</h3>
    <div class="fc-scores">${current.nutriScore?gradeDot(current.nutriScore):''}${nova?`<span class="nova-pill nv-${current.nova}" title="${e(nova.title)}">NOVA ${current.nova}</span>`:''}</div></div></div>
    ${small?'':miniLights(current)}
    ${personal?`<p class="verdict-line tone-${v.tone}">${i(v.tone==='attention'?'alert':v.tone==='unknown'?'info':'check')}<span>${e(v.title)}</span></p>`:reason?`<p class="verdict-line tone-${reason.tone}">${i(reason.icon)}<span>${e(reason.text)}</span></p>`:''}
    </a>
    <div class="food-card-actions"><button class="link-button" data-action="list-add" data-code="${current.barcode}" aria-label="Add ${e(current.name)} to shopping list">${i('list')} Buy again</button>
    <button class="icon-button" data-action="compare-add" data-code="${current.barcode}" aria-label="Compare ${e(current.name)}">${i('compare')}</button>
    <button class="icon-button${saved?' is-saved':''}" data-action="save" data-code="${current.barcode}" aria-label="${saved?'Remove from':'Save to'} My foods: ${e(current.name)}" aria-pressed="${saved}">${i('heart')}</button></div></article>`;
}
export function onboardingOverlay(s){
  if(s.onboarding!==true)return '';
  const step=Math.min(2,s.onboardingStep||1),p=s.store.profile;
  const steps=`<div class="onboard-steps" aria-hidden="true">${[1,2].map(n=>`<span class="${n<=step?'done':''}"></span>`).join('')}</div>`;
  const meta={sugars:['cube','t-amber'],protein:['egg','t-green'],fiber:['leaf','t-lime'],sodium:['shaker','t-sky'],satfat:['drop','t-peach'],additives:['flask','t-grape']};
  const body=step===1
    ?`<span class="eyebrow">Step 1 of 2 · what matters to you</span><h2 id="onboard-title" tabindex="-1">What should FoodScan watch for you?</h2><p class="lede">Pick any. Each scan will lead with these facts, and swaps will aim at them. No scores, just relevance.</p>
    <div class="check-chip-grid opt-magic">${PRIORITIES.map((r,idx)=>{const m=meta[r.id]||['spark','t-amber'];return `<label class="opt-card" style="--d:${idx*60}ms"><input type="checkbox" data-profile="priority" value="${r.id}"${p.priorities.includes(r.id)?' checked':''}><span class="opt-tile ${m[1]}" aria-hidden="true">${i(m[0])}</span><span class="opt-text"><strong>${r.name}</strong><small>${e(r.description)}</small></span><span class="opt-box" aria-hidden="true">${i('check')}</span></label>`;}).join('')}</div>`
    :`<span class="eyebrow">Step 2 of 2 · avoid &amp; diets</span><h2 id="onboard-title" tabindex="-1">Anything to always avoid?</h2><p class="lede">Hard rules. A product that conflicts, or can't be confirmed, is withheld everywhere, never guessed.</p>
    <div class="check-chip-grid">${AVOIDS.map(a=>`<label class="opt-card"><input type="checkbox" data-profile="avoid" value="${a.id}"${p.avoids.includes(a.id)?' checked':''}><span class="opt-box" aria-hidden="true">${i('check')}</span><span class="opt-text"><strong>${a.name}</strong></span></label>`).join('')}</div>
    <p class="lede mt-2">Dietary labels you look for:</p>
    <div class="check-chip-grid">${DIETS.map(d=>`<label class="opt-card"><input type="checkbox" data-profile="diet" value="${d.id}"${p.diets.includes(d.id)?' checked':''}><span class="opt-box" aria-hidden="true">${i('check')}</span><span class="opt-text"><strong>${d.name}</strong></span></label>`).join('')}</div>`;
  return `<div class="onboard-overlay" role="dialog" aria-modal="true" aria-labelledby="onboard-title"><div class="onboard-card">${steps}<div class="onboard-body">${body}</div>
    <div class="onboard-nav"><button class="button button-ghost" data-action="onboard-skip">Not now</button>
    <span style="display:flex;gap:.6rem">${step>1?`<button class="button button-outline" data-action="onboard-back">Back</button>`:''}
    ${step<2?`<button class="button button-primary" data-action="onboard-next">Continue</button>`:`<button class="button button-primary" data-action="onboard-finish">${i('check')} Done</button>`}</span></div>
    <p class="small muted mt-2">Stored only on this device. Change anytime in Profile.</p></div></div>`;
}
function tipCard(){
 const tip=tipOfTheDay();
 return `<aside class="tip-card"><span class="tip-ico" aria-hidden="true">${i('tip')}</span><div><span class="eyebrow">Label wisdom of the day</span><h3>${e(tip.title)}</h3><p>${e(tip.body)}</p></div></aside>`;
}
function heroArt(){
 return `<div class="hero-art" aria-hidden="true"><div class="ha-card">${barcodeBars('5012345678900',{height:90})}<span class="ha-laser"></span></div><span class="ha-chip c1"><i></i>Your priorities</span><span class="ha-chip c2"><i></i>Source-backed information</span><span class="ha-chip c3"><i></i>Understand the label</span><span class="ha-chip c4"><i></i>Compare with confidence</span></div>`;
}
function greeting(){
 const h=new Date().getHours(),hello=h<5?'Late-night snack check?':h<12?'Good morning':h<18?'Good afternoon':'Good evening';
 return `<div class="greeting"><h2>${hello}.</h2><p>What are we checking today?</p></div>`;
}
/* 9.0: first-run demo verdict — new users feel the value with zero scans.
   Uses the honest Example Foods demo product through the REAL decision pipeline. */
function firstRunDemo(s){
 const p=demoProduct(DEMO_CODES.spread);
 let d; try{d=decisionFor(p,s.store.profile);}catch{d=null;}
 if(!d)return '';
 return `<section class="first-demo" aria-label="Example verdict"><div class="fd-head"><span class="eyebrow">SEE IT IN ACTION</span><span class="fd-tag">EXAMPLE — NOT A REAL BRAND</span></div>
 <div class="fd-verdict fd-${d.kind}"><span class="fd-emoji">${d.kind==='match'?'✅':d.kind==='check'?'🛑':'ℹ️'}</span><div><strong>${e(d.title)}</strong><p>${e(d.summary)}</p></div></div>
 <p class="fd-note">This is exactly what a real scan looks like — a decision, not a data dump.</p>
 <div class="button-row"><button class="button button-primary" data-action="camera">${i('scan')} Scan my first food</button><a class="button button-outline" href="#demo">Try more examples ${i('arrow')}</a></div></section>`;
}
function _home(s){
 const recent=s.store.recent.slice(0,4),returning=Boolean(recent.length||s.store.shopping.length||s.pantryDecisionReview?.checked);
 const fresh=`<section class="home-lead d8-first-home" aria-label="Scan your food"><div class="welcome-card"><div class="welcome-photo" aria-hidden="true"><img src="/art/produce.webp" alt="" width="816" height="330" fetchpriority="high"></div><div class="welcome-content"><span class="welcome-kicker">YOUR NEXT FOOD DECISION</span><h1>Scan it.<br><em>Shop your way.</em></h1><p>The facts that matter to you.<br>A next step you can use.</p><button class="scan-now" data-action="camera"><span class="scan-now-icon">${i('scan')}</span><span>Scan now<small>Point at a package barcode</small></span>${i('arrow')}</button><div class="scan-shortcuts"><button data-action="photo">${i('camera')} Barcode photo</button><button data-action="manual">${i('keyboard')} Type a barcode</button><button data-action="search-name">${i('search')} Search by name</button></div></div></div><div class="scan-card" id="scan-box">${scanForm(s)}</div></section>`;
 const returningScan=`<section class="tdy-scan-strip" aria-label="Check a new packaged food"><span class="tdy-scan-copy"><strong>Checking something new?</strong><small>Choose how to look up a food.</small></span><div class="tdy-scan-actions"><button data-action="camera" class="tdy-scan-solid">${i('scan')} Scan barcode</button><button data-action="photo">${i('camera')} Photo</button><button data-action="manual">${i('keyboard')} Type digits</button><button data-action="search-name">${i('search')} Search name</button></div></section>`;
 return `<div class="container home-shell d8-home">${returning?`${pantryNudge(s.pantryDecisionReview,savedFails(s).length)}${todayView(s,true)}${returningScan}`:`${fresh}${pantryNudge(s.pantryDecisionReview,savedFails(s).length)}${todayView(s)}${firstRunDemo(s)}`}
 ${returning?`<details class="d8-home-manual" data-panel="home-manual"><summary>Type a barcode or search a food ${i('search')}</summary><div class="scan-card" id="scan-box">${scanForm(s)}</div></details>`:''}
 ${recent.length?`<section class="page-section" aria-label="Recent scans">${pageHead('PICK UP WHERE YOU LEFT OFF','Recent <em>scans.</em>','',`<a class="link-button" href="#saved">View all ${i('arrow')}</a>`)}<div class="food-grid">${recent.map(p=>productCard(p,s)).join('')}</div></section>`:''}
 <section class="page-section tools-section" aria-label="Daily tools">${pageHead('YOUR EVERYDAY TOOLS','From basket <em>to kitchen.</em>','',`<a class="link-button" href="#pantry">Pantry ${i('arrow')}</a>`)}${tiles(s)}</section></div>`;
}

export function home(state,...args){const s={...projectState(state),pantryDecisionReview:pantryReview(state)};return _home(s,...args);}
export const pantryReviewView=reviewPage;

/* ---------- product page ---------- */
function nutrientCards(p,s){
  const pri=priorityMetrics(s.store.profile);
  const keys=[...pri,...FIELDS.map(([k])=>k).filter(k=>!pri.includes(k)&&k!=='salt')];
  const bad=new Set(nutrientConflicts(p));
  return `<div class="nutrient-grid">${keys.map(k=>{
    const meta=METRICS[k],v=p.nutrition?.[k],isPri=pri.includes(k);
    const sv=servingValue(p,k);
    const rule=PRIORITIES.find(r=>r.metric===k);
    let flag='',bar='';
    if(v==null||bad.has(k))flag=`<span class="nc-flag na">${bad.has(k)?'Conflicting data':'Not reported'}</span>`;
    else if(rule&&s.store.profile.priorities.includes(rule.id)){
      const th=s.store.profile.thresholds[rule.id],ok=rule.direction==='lower'?v<th:v>=th;
      flag=`<span class="nc-flag ${ok?'ok':'warn'}">${i(ok?'check':'alert')} ${ok?'Meets':rule.direction==='lower'?'Above':'Below'} your ${rule.direction==='lower'?'limit':'target'} (${formatNumber(th)} ${rule.unit})</span>`;
      const pct=Math.max(2,Math.min(100,(v/Math.max(th,1e-9))*100)).toFixed(0);
      const over=rule.direction==='lower'&&!ok;
      bar=`<div class="nc-bar ${over?'over':'good'}" role="img" aria-label="${formatNumber(v)} ${meta.unit} per 100${p.basis==='ml'?'ml':'g'} against your ${rule.direction==='lower'?'limit':'target'} of ${formatNumber(th)} ${rule.unit}"><span style="--w:${pct}%"></span></div>`;
    }
    return `<div class="nutrient-card${isPri?' is-priority':''}"><div class="nc-name">${meta.name}</div>
      <div class="nc-value">${v==null?'—':formatNumber(v)} <small>${meta.unit} / 100${p.basis==='ml'?'ml':'g'}</small></div>
      <div class="nc-sub">${sv.value!=null?`≈ ${formatNumber(sv.value)} ${meta.unit} per serving${sv.estimated?' (estimated)':''}`:'Serving value not reported'}</div>${flag}${bar}</div>`;
  }).join('')}</div>`;
}
function productTabs(p,s){
  const tab=s.tab||'nutrition';
  const tabs=[['nutrition','Nutrition'],['ingredients','Ingredients'],['source','Source & trust']];
  let body='';
  if(tab==='ingredients'){
    body=`<div class="ingredients-card"><h3>Ingredients</h3>
      ${p.ingredients?`<p>${e(p.ingredients)}</p>`:`<p class="muted">Ingredient text not supplied for this record.</p>`}
      ${p.allergens?.length?`<h3 class="mt-2">Allergens reported</h3><div class="allergen-chips">${p.allergens.map(a=>`<span class="allergen-chip">${e(a)}</span>`).join('')}</div>`:''}
      ${p.traces?.length?`<h3 class="mt-2">May contain traces</h3><div class="allergen-chips">${p.traces.map(a=>`<span class="trace-chip">${e(a)}</span>`).join('')}</div>`:''}
      ${p.additivesCount!=null?`<p class="mt-2"><strong>${p.additivesCount}</strong> additive${p.additivesCount===1?'':'s'} listed in the source record. <span class="muted">A count is not a safety rating.</span></p>`:''}
    </div>`;
  }else if(tab==='source'){
    body=`<div class="source-strip" style="margin-top:1.4rem"><span><strong>Source:</strong> ${p.provenance==='local'?'Your manual entry (unverified)':`<a href="${e(p.sourceUrl)}" target="_blank" rel="noopener">Open Food Facts record</a>`}</span>
      <span><strong>Snapshot:</strong> ${stamp(p.fetchedAt)}</span>
      ${p.sourceModified?`<span><strong>Source updated:</strong> ${stamp(p.sourceModified)}</span>`:''}
      <span><strong>What we show:</strong> ${dqBadges(p)}</span></div>
      <div class="button-row">${button('report','Report an issue','alert',p.barcode)}${p.provenance!=='local'?button('reload','Reload latest','refresh',p.barcode):''}${button('capture-label','Save label photo','camera',p.barcode)}${button('view-label','View my label photo','camera',p.barcode)}</div>
      <p class="small muted mt-2">Spotted something wrong? Your correction draft downloads to this device — nothing is submitted without you. Label photos never leave this device.</p>`;
  }else{
    body=`${nutrientCards(p,s)}
    ${nutrientConflicts(p).length?noticeBox('Some values in this record conflict with each other (e.g. sugars above carbohydrates). Conflicting values are shown for reference but never used for matching or ranking.','warning'):''}
    <p class="small muted mt-2">${e(basisLabel(p))}. Missing values are shown as —, never treated as zero.</p>`;
  }
  return `<div class="tabs" role="tablist" aria-label="Product details">${tabs.map(([id,label])=>`<button role="tab" id="tab-${id}" aria-selected="${tab===id}" aria-controls="product-tab-panel" tabindex="${tab===id?0:-1}" data-action="tab" data-tab="${id}">${label}</button>`).join('')}</div><div id="product-tab-panel" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="0">${body}</div>`;
}
/** Better-choices slot. Re-rendered on its own when the async search settles. */
export function swapsSection(s){
  const p=s.active,sw=s.swaps;
  if(!p)return '';
  if(!sw||sw.code!==p.barcode||sw.status==='idle')return `<div class="swap-empty"><button class="button button-outline" data-action="load-swaps" data-code="${p.barcode}">${i('swap')} Find better choices</button></div>`;
  if(sw.status==='loading')return swapSkeleton();
  if(sw.status==='error')return `<div class="notice warning">${i('info')}<div>${e(sw.error)} <button class="link-button" data-action="load-swaps" data-code="${p.barcode}">Try again</button></div></div>`;
  const {items,plan}=betterChoices(p,sw.items,s.store.profile,sw.category);
  if(!items.length&&hasRestrictions(s.store.profile)&&sw.items.length&&sw.items.every(x=>x.partial))return `<div class="compact-empty">The food database only gave previews just now, which cannot be checked against your restrictions. <button class="link-button" data-action="load-swaps" data-code="${p.barcode}">Try again</button></div>`;
  const meta=`<p class="sec-sub">Same recorded category: ${e(tag(sw.category))}${sw.countryName?` · country tag: ${e(sw.countryName)}`:''}. Compared on ${e(plan.reason)}.${sw.mode==='local'?' Offline: only complete records stored on this device were checked.':''}</p>`;
  if(!items.length)return `${meta}<div class="compact-empty">No supported improvement among the ${sw.checked} source records checked. That does not mean there is none: <a href="#alternatives/${p.barcode}">browse this category</a>.</div>`;
  return `${meta}<div class="swap7-list">${items.slice(0,3).map(x=>swapChoiceCard(x,p,s,sw.category)).join('')}</div><div class="affiliate-box"><span class="affiliate-badge">${i('swap')} Compare before you buy</span><p class="affiliate-note">These are nutrition comparisons among ${sw.checked} source records, not verified merchant listings. <a href="#alternatives/${p.barcode}">See category records</a>. No local stock or package equivalence is implied.</p></div>`;
}
function _productView(s){
 const p=s.active;if(s.excludedResult)return gatePanel(s);if(!p)return lookupState(s);
 const amount=s.portionAmount??portionStart(p),unit=p.basis==='ml'?'ml':p.basis==='g'?'g':'g / ml (basis unspecified)';
 const shop=amazonSearchLink(p,swapCountry(s.store.settings,p));
 return `<div class="container d8-page"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="#home">${i('back')} Back to scan</a><a href="#shopping">${i('list')} Today's list</a></nav>
 ${resultSummary(p,s)}
 ${swapsWorthOffering(p,s.store.profile)?`<section class="d8-swaps" aria-labelledby="sw-h"><div class="d8-subhead"><div><span class="eyebrow">BEFORE IT GOES IN YOUR BASKET</span><h2 id="sw-h">A swap you can use.</h2></div>${i('swap')}</div><div id="swaps-slot">${swapsSection(s)}</div></section>`:''}
 <section class="d8-report" aria-label="Optional product details">
 <details data-panel="full-report"><summary><span>${i('list')} Full nutrition, ingredients &amp; source</span>${i('chevron')}</summary><div class="d8-panel-body">${productTabs(p,s)}</div></details>
 <details data-panel="quick-read"><summary><span>${i('info')} Other label observations</span>${i('chevron')}</summary><div class="d8-panel-body">${quickReadList(p)||'<p>Not enough source information.</p>'}${p.provenance==='local'?'':scoreCards(p)}${lightTiles(p)}</div></details>
 ${p.basis?`<details data-panel="portion"><summary><span>${i('cube')} Portion &amp; composition</span>${i('chevron')}</summary><div class="d8-panel-body"><p class="small muted">Uses the reported serving when available. Otherwise 100 ${unit} is a reference, not a recommended portion. Change to your measured amount.</p>${portionPanel(p,amount)}${compositionBar(p)}</div></details>`:''}
 ${shop?`<details data-panel="merchant"><summary><span>${i('search')} Optional merchant search</span>${i('chevron')}</summary><div class="d8-panel-body"><p>Amazon search results are not a verified match, price or stock check.</p><a class="button button-outline" data-commercial-link="amazon" data-placement="product" href="${e(shop.url)}" target="_blank" rel="${shop.sponsored?'sponsored ':''}noopener noreferrer">Search Amazon${shop.sponsored?' &middot; paid link':''}</a>${shop.sponsored?`<p class="small muted">${e(ASSOCIATE_DISCLOSURE)}</p>`:''}</div></details>`:''}
 </section><div class="d8-next-action"><button class="button button-dark" data-action="camera">${i('scan')} Scan next package</button><a class="button button-outline" href="#shopping">Continue today's list ${i('arrow')}</a></div></div>`;
}
export function productView(state,...args){return _productView(projectState(state),...args);}

/* ---------- lookup states ---------- */
export function lookupState(s){
  const code=s.requested||s.input||'';
  if(s.busy)return `<div class="container"><div class="lookup-wrap load7"><div class="lookup-card" role="status" aria-live="polite">
    <span class="eyebrow"><span class="dot"></span>Reading the label</span>
    <div class="reading">${barcodeBars(/^\d{8,14}$/.test(code)?code:'5012345678900',{height:56})}</div><div class="barcode-chip">${i('scan')} ${e(code)}</div>
    <div class="sk-hero" aria-hidden="true"><span class="sk sk-img"></span><span class="sk-lines"><span class="sk sk-l1"></span><span class="sk sk-l2"></span><span class="sk sk-l3"></span></span></div>
    <div class="sk-chips" aria-hidden="true"><span class="sk"></span><span class="sk"></span><span class="sk"></span></div>
    <p id="lookup-progress-message" class="muted">${e(s.lookupProgress?.message||'Checking this barcode with Open Food Facts…')}</p>
    <div class="button-row" style="justify-content:center"><button class="button button-ghost" data-action="cancel-lookup">Cancel</button></div></div></div></div>`;
  const kind=s.error?.code;
  const missing=kind==='not_found',limited=['rate_limited','local_rate_limited','upstream_busy'].includes(kind);
  const title=missing?'Not listed yet. Not a bad barcode.':limited?'A short pause. Your saved records remain.':kind==='not_food'?'This is not a food record.':kind==='invalid'?"Let's check those digits.":'The connection stopped. Not your scan.';
  const hint=missing?'Open Food Facts doesn\u2019t have this exact barcode yet. Add the facts you can read on the package — they stay marked as your entry.'
    :limited?'The database asked us to pause. Your saved foods are untouched.'
    :'No substitute product was used. Your scan stays yours.';
  return `<div class="container"><div class="lookup-wrap"><div class="lookup-card">
    <a class="link-button" href="#home">${i('back')} Back to scan</a>
    <h1 class="mt-1">${e(title)}</h1><div class="barcode-chip">${i('scan')} ${e(code)}</div>
    <p class="muted">${e(s.error?.message||hint)}</p>
    <div class="missing-actions">${button('retry','Try again','refresh',code,'button-primary')}${button('manual-food','Enter product details','keyboard',code)}${button('capture-label','Save a label photo','camera',code)}${button('report','Report missing product','alert',code)}</div>
    <p class="small muted mt-2">Manual entries are clearly marked unverified. Nothing is invented.</p></div></div></div>`;
}

/* ---------- dialogs ---------- */
export function scannerDialog(){
  return `<div class="dialog-pad scanner-dialog"><div class="modal-head"><div><span class="eyebrow">Barcode scanner</span><h2>Point at the barcode</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close scanner">${i('close')}</button></div>
  <label class="check-label"><input id="trip-scan" type="checkbox"> Trip mode — add each scan to Compare (up to four)</label>
  <div class="camera-stage viewfinder"><video playsinline muted aria-label="Camera viewfinder"></video>
  <span class="vf-corner tl"></span><span class="vf-corner tr"></span><span class="vf-corner bl"></span><span class="vf-corner br"></span>
  <span class="vf-scanline" aria-hidden="true"></span>
  <span class="detecting-pill" style="position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:4"><span class="dot"></span>Detecting</span></div>
  <p class="camera-status" id="camera-status" role="status" style="color:#CFC5B0">${i('scan')} Starting camera…</p>
  <div class="camera-actions"><button class="button button-outline button-sm torch-btn" id="torch-button" data-action="torch" aria-pressed="false" hidden>${i('bolt')} Flashlight</button>
  <button class="button button-ghost button-sm" data-action="photo">${i('camera')} Use a photo</button>
  <button class="button button-ghost button-sm" data-action="manual">${i('keyboard')} Type digits</button></div></div>`;
}
export function installDialog(s){
 return `<div class="dialog-pad"><div class="modal-head"><div><span class="eyebrow">Install</span><h2>Keep FoodScan close.</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close">${i('close')}</button></div><p class="muted">Add FoodScan to your home screen. Open it online first to prepare saved-food access offline.</p>${s.installPrompt?`<div class="button-row"><button class="button button-primary" data-action="native-install">${i('download')} Install FoodScan</button></div>`:`<div class="settings-section"><h3>Use your browser menu</h3><p class="small muted">Android: open the browser menu and choose Install app or Add to Home screen. iPhone: open Share in Safari and choose Add to Home Screen. Availability depends on your browser.</p></div>`}<div class="button-row"><button class="button button-outline" data-action="close-dialog">Done</button></div></div>`;
}
export function settingsDialog(s){
  const st=s.store;
  return `<div class="dialog-pad"><div class="modal-head"><div><span class="eyebrow">Settings</span><h2>Made yours.</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close settings">${i('close')}</button></div>
  ${activeProfile(s)}
  <div class="settings-section"><h3>Appearance</h3>
    <div class="segmented" role="group" aria-label="Theme">${['light','dark','system'].map(t=>`<button data-action="theme" data-value="${t}" aria-pressed="${st.theme===t}">${i(t==='light'?'sun':t==='dark'?'moon':'spark')} ${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>
    <div class="grid-2 mt-2"><label class="field-label">Text size<select id="text-size"><option value="standard"${st.settings.textSize==='standard'?' selected':''}>Standard</option><option value="large"${st.settings.textSize==='large'?' selected':''}>Large</option><option value="extra"${st.settings.textSize==='extra'?' selected':''}>Extra large</option></select></label>
    <label class="field-label">Start screen<select id="start-screen"><option value="home"${st.settings.home==='home'?' selected':''}>Today dashboard</option><option value="shopping"${st.settings.home==='shopping'?' selected':''}>Shopping list</option><option value="insights"${st.settings.home==='insights'?' selected':''}>Insights</option></select></label></div>
    <label class="field-label">Number &amp; date format<input id="locale-setting" value="${e(st.settings.locale)}" pattern="[A-Za-z]{2,3}(-[A-Za-z]{2,4})?" spellcheck="false"><small>Detected from your browser on first use, not GPS.</small></label></div>
  <div class="settings-section"><h3>Where you shop</h3>
    <label class="field-label">My supermarket country<select id="country-setting"><option value="">Automatic (from your language)</option>${COUNTRIES.map(c=>`<option value="${c.code}"${st.settings.country===c.code?' selected':''}>${e(c.name)}</option>`).join('')}</select><small>Used to suggest better choices that are sold where you shop. Stays on this device.</small></label></div>
  <div class="settings-section"><h3>Gentle reminders</h3>
    <label class="check-label"><input id="reminders-setting" type="checkbox"${st.settings.reminders?' checked':''}> Pantry &amp; shopping reminders (in-app only)</label>
    <label class="check-label"><input id="recap-setting" type="checkbox"${st.settings.recap?' checked':''}> Keep activity on this device for my weekly recap</label>
    <p class="small muted">No push, no tracking. Turning recap off deletes its event log.</p>
    <button class="button button-outline button-sm" data-action="persist-storage">${i('lock')} Ask browser to protect offline storage</button></div>
  <div class="settings-section"><h3>Your foods, on this device</h3>
    <p class="small muted">${st.saved.length} favorites · ${st.recent.length} recent · ${st.shopping.length} list items · ${st.pantry.length} pantry entries</p>
    <div class="button-row"><button class="button button-outline button-sm" data-action="export">${i('download')} Export backup</button>
    <button class="button button-outline button-sm" data-action="import">${i('upload')} Import backup</button>
    <button class="button button-ghost button-sm" data-action="print">${i('print')} Print page</button></div>
    <div class="button-row"><button class="button button-ghost button-sm" data-action="clear-history">Clear recent history</button>
    <button class="button button-danger button-sm" data-action="clear-all">Delete local data</button></div></div>
  <div class="settings-section"><h3>App &amp; support</h3><p class="small muted">FoodScan ${VERSION} &middot; local-first web app</p><div class="button-row"><button class="button button-outline button-sm" data-action="install">${i('download')} Install app</button><button class="button button-outline button-sm" data-action="connection">${i('refresh')} Connection check</button></div></div>
  </div>`;
}
export function manualFoodDialog(s){
  const code=s.requested||'';
  return `<div class="dialog-pad"><div class="modal-head"><div><span class="eyebrow">Manual entry</span><h2>Add the facts you can read.</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close">${i('close')}</button></div>
  ${noticeBox('This stays marked as your unverified entry. It is never submitted to the public database.','warning')}
  <form id="manual-food-form"><div class="grid-2">
  <label class="field-label">Barcode*<input name="barcode" value="${e(code)}" inputmode="numeric" required maxlength="40"></label>
  <label class="field-label">Product name*<input name="name" required maxlength="240" placeholder="As printed on the package"></label></div>
  <label class="field-label">Brand<input name="brand" maxlength="240"></label>
  <label class="field-label">Values per<select name="basis"><option value="g">100 g</option><option value="ml">100 ml</option></select><small>Leave blank what the package doesn't say.</small></label>
  <div class="grid-2">${FIELDS.map(([k,label,unit])=>`<label class="field-label">${label} (${unit})<input name="${k}" type="number" min="0" step="any" placeholder="—"></label>`).join('')}</div>
  <label class="field-label">Ingredients (as printed)<textarea name="ingredients" maxlength="14000"></textarea></label>
  <button class="button button-primary" type="submit">${i('check')} Save my entry</button></form></div>`;
}
export function reportDialog(s,code){
  return `<div class="dialog-pad"><div class="modal-head"><div><span class="eyebrow">Report an issue</span><h2>Help fix this record.</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close">${i('close')}</button></div>
  <form id="report-form"><input type="hidden" name="barcode" value="${e(code)}">
  <p>Barcode <strong>${e(code)}</strong> · <a href="https://world.openfoodfacts.org/product/${e(code)}" target="_blank" rel="noopener">source record</a></p>
  <label class="field-label">What looks wrong?<textarea name="note" required maxlength="1500" placeholder="e.g. sugars say 40g but the package says 4g…"></textarea><small>Downloads as a draft on this device. Submit it on the source site — nothing is sent automatically, and no profile data is included.</small></label>
  <button class="button button-primary" type="submit">${i('download')} Download correction draft</button></form></div>`;
}
export function pantryDialog(s,item={}){
  return `<div class="dialog-pad"><div class="modal-head"><div><span class="eyebrow">Pantry</span><h2>${item.id?'Edit':'Add'} pantry item</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close">${i('close')}</button></div>
  <form id="pantry-form"><input type="hidden" name="id" value="${e(item.id||'')}">
  <label class="field-label">Item name*<input name="name" required maxlength="180" value="${e(item.name||'')}" id="pantry-name"></label>
  <div class="grid-2"><label class="field-label">Barcode (optional)<input name="barcode" value="${e(item.barcode||'')}" inputmode="numeric" maxlength="40"></label>
  <label class="field-label">Quantity<input name="quantity" type="number" min="1" max="99" value="${item.quantity||1}"></label></div>
  <div class="grid-2"><label class="field-label">Date kind<select name="dateKind"><option value="unspecified"${item.dateKind==='unspecified'?' selected':''}>No date</option><option value="use-by"${item.dateKind==='use-by'?' selected':''}>Use by</option><option value="best-before"${item.dateKind==='best-before'?' selected':''}>Best before</option></select></label>
  <label class="field-label">Date<input name="expires" type="date" value="${e(item.expires||'')}"></label></div>
  <label class="check-label"><input type="checkbox" name="remind"${item.remind?' checked':''}> Remind me (in-app, gentle)</label>
  <button class="button button-primary" type="submit">${i('check')} Save to pantry</button></form></div>`;
}

/* ---------- compare ---------- */
const SPOTLIGHTS=[['','All'],['sugar5','Under 5g sugar'],['protein15','15g+ protein'],['nosweet','No artificial sweeteners'],['nutfree','Nut-free']];
function spotlightPass(p,f){
  if(!f)return true;
  const n=p.nutrition||{};
  if(f==='sugar5')return n.sugars!=null&&n.sugars<5;
  if(f==='protein15')return n.protein!=null&&n.protein>=15;
  if(f==='nosweet')return eligibility(p,{avoids:['sweeteners']}).allowed;
  if(f==='nutfree')return eligibility(p,{avoids:['nuts','peanuts']}).allowed;
  return true;
}
function compareSlots(s){
  return `<div class="compare-slots">${[0,1,2,3].map(slot=>{
    const code=s.compare[slot],p=code?resolveProduct(s,code):null;
    return `<div class="compare-slot${p?' filled':''}"><span class="eyebrow">Slot ${slot+1}</span>
      ${p?`<strong>${e(p.name)}</strong><span class="small muted">${e(p.brand||'')}</span>`:''}
      <select data-slot="${slot}" id="compare-${slot}" aria-label="Choose food for slot ${slot+1}">
      <option value="">Choose a scanned food…</option>
      ${allProducts(s).map(x=>`<option value="${x.barcode}"${x.barcode===code?' selected':''}>${e(x.name)}</option>`).join('')}</select>
      <button class="button button-outline button-sm" data-action="compare-scan" data-slot="${slot}">${i('scan')} Scan into slot ${slot+1}</button></div>`;
  }).join('')}</div>`;
}
export function filterControls(s){return '';}
export function compareView(state){
  const s=projectState(state);
  const products=s.compare.map(c=>c?resolveProduct(s,c):null).filter(Boolean);
  const ranked=products.length?rankProducts(products,s.store.profile):[];
  const best=ranked[0];
  const spot=s.spotlight||'';
  const pri=priorityMetrics(s.store.profile);
  const rowKeys=[...pri,...['kcal','protein','sugars','fiber','sodium','carbohydrates','fat','saturatedFat'].filter(k=>!pri.includes(k))];
  const whyBest=best&&s.store.profile.priorities.length?`Ranked first for your ${s.store.profile.priorities.map(k=>PRIORITIES.find(r=>r.id===k)?.name.toLowerCase()).filter(Boolean).join(', ')}.`:'';
  return `<div class="container">${pageHead('Side by side','Compare <em>foods.</em>','Up to four foods, ranked by your priorities — never hidden by them.')}
  ${compareSlots(s)}
  ${products.length?`<div class="compare-toolbar">
    <div class="spotlight-filters" role="group" aria-label="Spotlight filters">${SPOTLIGHTS.map(([f,label])=>`<button class="fchip" data-action="spotlight" data-filter="${f}" aria-pressed="${spot===f}">${f==='nosweet'||f==='nutfree'?i('shield'):i('spark')} ${label}</button>`).join('')}</div>
    <span class="small muted">Spotlight dims — never hides. ${spot?`Showing “${SPOTLIGHTS.find(x=>x[0]===spot)[1]}” as a highlight.`:'Pick one to highlight matches.'}</span></div>
  <div class="compare-table-wrap" tabindex="0" role="region" aria-label="Food comparison. Scroll horizontally for more products."><table class="compare-table"><thead><tr><th scope="col"><span class="sr-only">Metric</span></th>
    ${products.map(p=>{const dim=spot&&!spotlightPass(p,spot);return `<th scope="col"><div class="cmp-product${dim?' dimmed':''}">${p.image?`<img src="${e(p.image)}" alt="" loading="lazy">`:''}<span class="cmp-name">${e(p.name)}</span>${p===best&&hasProfile(s.store.profile)?`<span class="best-badge">${i('spark')} First by priority</span>`:''}<a class="link-button" href="#food/${p.barcode}">Open ${i('arrow')}</a></div></th>`;}).join('')}</tr></thead>
  <tbody>
    <tr><th scope="row">Your verdict</th>${products.map(p=>{const v=verdictData(p,s);return `<td class="${spot&&!spotlightPass(p,spot)?'dimmed':''}"><span class="verdict-line tone-${v.tone}" style="margin:0">${i(v.tone==='attention'?'alert':'check')}<span>${e(v.title)}</span></span></td>`;}).join('')}</tr>
    <tr><th scope="row">Nutri-Score</th>${products.map(p=>`<td class="${spot&&!spotlightPass(p,spot)?'dimmed':''}">${p.nutriScore?gradeStrip(p.nutriScore,{size:'sm'}):'<span class="muted small">Not provided</span>'}</td>`).join('')}</tr>
    <tr><th scope="row">Processing (NOVA)</th>${products.map(p=>`<td class="${spot&&!spotlightPass(p,spot)?'dimmed':''}">${p.nova?`${novaBar(p.nova)}<br><span class="cmp-sub">${e(NOVA_INFO[p.nova].short)}</span>`:'<span class="muted small">Not provided</span>'}</td>`).join('')}</tr>
    ${rowKeys.map(k=>{const meta=METRICS[k],isPri=pri.includes(k);return `<tr class="${isPri?'is-priority':''}"><th scope="row">${meta.name}${isPri?' ★':''}</th>${products.map(p=>{
      const v=p.nutrition?.[k],sv=servingValue(p,k),dim=spot&&!spotlightPass(p,spot);
      return `<td class="${dim?'dimmed':''}"><span class="cmp-value">${v==null?'—':formatNumber(v)} <small>${meta.unit}/100${p.basis==='ml'?'ml':'g'}</small></span><br><span class="cmp-sub">${sv.value!=null?`≈ ${formatNumber(sv.value)} ${meta.unit} / serving${sv.estimated?'*':''}`:'per serving n/a'}</span></td>`;}).join('')}</tr>`;}).join('')}
    <tr><th scope="row">Why this ranking</th><td colspan="${products.length}"><span class="small muted">${whyBest||'Add priorities in your profile to rank these foods.'} *estimated from package serving size.</span></td></tr>
  </tbody></table></div>`:`<div class="mt-2">${emptyState('compare','Pick up to four foods.','Scan products or choose scanned foods above, then see them side by side through the lens of your priorities.',`<button class="button button-primary" data-action="camera">${i('scan')} Scan a food</button>`)}</div>`}
  </div>`;
}

/* ---------- saved / my foods ---------- */
export function savedGrid(s){
  const q=(s.filter||'').toLowerCase();
  const items=s.store.saved.filter(p=>(p.name+' '+(p.brand||'')+' '+p.barcode).toLowerCase().includes(q));
  const sorted=[...items].sort((a,b)=>s.sort==='name'?a.name.localeCompare(b.name):(b.fetchedAt||0)-(a.fetchedAt||0));
  if(!sorted.length)return emptyState('heart','Nothing here yet.','Save foods from any product page and they\u2019ll wait for you here.',`<button class="button button-primary" data-action="camera">${i('scan')} Scan something</button>`);
  return `<div class="food-grid" data-reveal >${sorted.map(p=>productCard(p,s)).join('')}</div>`;
}
export function savedView(state){
  const s=projectState(state);
  const q=(s.filter||'').toLowerCase();
  const recent=s.store.recent.filter(p=>(p.name+' '+(p.brand||'')+' '+p.barcode).toLowerCase().includes(q)).slice(0,12);
  return `<div class="container">${pageHead('Kept close','My <em>foods.</em>','Favorites and recent scans live on this device — stored locally.',`<button class="button button-outline" data-action="grocery-review">${i('cart')} Build next list</button>`)}
  <div class="add-form"><div class="field" style="flex:1;display:flex;align-items:center;gap:.6rem;background:var(--paper-2);border:1.5px solid var(--line);border-radius:14px;padding:.35rem .35rem .35rem 1rem">${i('search')}<input type="search" id="saved-filter" placeholder="Filter your foods…" value="${e(s.filter||'')}" aria-label="Filter saved foods" style="flex:1;border:0;background:transparent;outline:none"></div>
  <select id="saved-sort" aria-label="Sort saved foods"><option value="recent"${s.sort==='recent'?' selected':''}>Most recent</option><option value="name"${s.sort==='name'?' selected':''}>Name A–Z</option></select>
  ${s.filter?`<button class="button button-ghost button-sm" data-action="clear-filter">Clear</button>`:''}</div>
  <div id="food-grid">${savedGrid(s)}</div>
  <div class="mt-4">${pageHead('','Recent <em>scans.</em>','')}
  ${recent.length?`<div class="food-grid" data-reveal id="recent-grid">${recent.map(p=>productCard(p,s,true)).join('')}</div>`:`<div class="compact-empty">No recent scans yet. <button class="link-button" data-action="camera">Scan your first food</button></div>`}</div></div>`;
}

/* ---------- shopping list ---------- */
function basketCard(products,total){
  const b=basketSummary(products);
  const bars=[...'ABCDE'].filter(g=>b.grades[g]).map(g=>`<span class="bk-seg ns-${g}" style="flex-grow:${b.grades[g]}" title="${b.grades[g]} with Nutri-Score ${g}"><b>${g}</b>${b.grades[g]}</span>`).join('');
  const notes=[];
  if(b.ultra)notes.push(`${b.ultra} ultra-processed (NOVA 4)`);
  if(b.high.sugars)notes.push(`${b.high.sugars} high in sugar`);
  if(b.high.saturatedFat)notes.push(`${b.high.saturatedFat} high in saturated fat`);
  if(b.high.salt)notes.push(`${b.high.salt} high in salt`);
  const lead=b.scored?`${Math.round((b.grades.A+b.grades.B)/b.scored*100)}% of the scored items are Nutri-Score A or B.`:'None of these have a Nutri-Score yet.';
  return `<section class="card-sec basket" aria-labelledby="bk-h"><div class="sec-head"><h2 id="bk-h">${i('chart')} Your trip at a glance</h2><p class="sec-sub">${products.length} of ${total} items have nutrition facts. ${lead}</p></div>
  ${bars?`<div class="bk-bar" role="img" aria-label="Nutri-Score mix of your list">${bars}</div>`:''}
  ${notes.length?`<ul class="bk-notes">${notes.map(n=>`<li>${e(n)}</li>`).join('')}</ul>`:'<p class="small muted">Nothing on this list stands out as high in sugar, saturated fat or salt.</p>'}
  <p class="small muted">Open any item and use <strong>Better choices</strong> to swap before you shop. A summary of facts, not a verdict.</p></section>`;
}
export function shoppingView(state){return shoppingViewV8(projectState(state));}

/* ---------- pantry ---------- */
function expiryInfo(x){
  if(!x.expires)return {cls:'',tag:''};
  const days=Math.round((new Date(x.expires+'T12:00:00Z')-Date.now())/86400000);
  if(days<0)return {cls:'expiry-over',tag:'<span class="expiry-tag over">Past date</span>'};
  if(days<=7)return {cls:'expiry-soon',tag:`<span class="expiry-tag soon">${days}d left</span>`};
  return {cls:'',tag:`<span class="expiry-tag ok">${stamp(x.expires)}</span>`};
}
export function pantryView(state){
  const s=projectState(state);
  const items=[...s.store.pantry].sort((a,b)=>(a.expires||'9999').localeCompare(b.expires||'9999'));
  return `<div class="container">${pageHead('At home','My <em>pantry.</em>','What\u2019s open, what\u2019s running low, what needs using.',`<button class="button button-primary button-sm" data-action="pantry-add">${i('plus')} Add item</button>`)}${pantryBanner(s)}
  ${items.length?`<div class="list-panel">${items.map(x=>{const info=expiryInfo(x),p=x.barcode?resolveProduct(s,x.barcode):null;
    return `<div class="list-row ${info.cls}"><div class="lr-main"><div class="lr-name">${e(x.name)}</div><div class="lr-sub">${x.quantity>1?x.quantity+' × ':''}${e(x.dateKind!=='unspecified'?x.dateKind.replace('-',' ')+' ': '')}${p?'Linked: '+e(p.name):e(x.barcode||'no barcode')}</div></div>${info.tag}${x.runningLow?`<span class="g8-low-pill">Running low</span>`:''}
    <button class="g8-stock-toggle" data-action="pantry-low" data-id="${x.id}" aria-pressed="${x.runningLow?'true':'false'}">${i(x.runningLow?'check':'plus')} ${x.runningLow?'Restocked':'Running low'}</button>
    ${x.remind?`<span title="Reminder on">${i('clock')}</span>`:''}
    ${p?`<a class="icon-button" href="#food/${p.barcode}" aria-label="Open ${e(p.name)}">${i('arrow')}</a>`:''}
    <button class="icon-button" data-action="pantry-buy" data-id="${x.id}" aria-label="Buy ${e(x.name)} again">${i('list')}</button>
    ${x.expires?`<button class="icon-button" data-action="pantry-calendar" data-id="${x.id}" aria-label="Calendar reminder for ${e(x.name)}">${i('clock')}</button>`:''}
    <button class="icon-button" data-action="pantry-edit" data-id="${x.id}" aria-label="Edit ${e(x.name)}">${i('settings')}</button>
    <button class="icon-button" data-action="pantry-used" data-id="${x.id}" aria-label="Remove ${e(x.name)}">${i('trash')}</button></div>`;}).join('')}</div>`
  :emptyState('package','Less forgetting. More knowing.','Bought items land here automatically. Add expiry dates for gentle reminders.',`<button class="button button-primary" data-action="pantry-add">${i('plus')} Add your first item</button>`)}
  <p class="small muted mt-2">Dates are your entries from the package. FoodScan never guesses safety.</p></div>`;
}

/* ---------- insights ---------- */
/* Decision timeline: your recent scans with their verdicts — the reporting upgrade. */
/* Home decisions widget: your verdicts at a glance, impossible to miss. */
function homeDecisions(s){
 const items=(s.store.recent||[]).slice(0,3);
 if(!items.length)return '';
 const rows=items.map(prod=>{
  if(!prod||!prod.barcode)return '';
  let d; try{d=decisionFor(prod,s.store.profile);}catch{d=null;}
  if(!d)return '';
  const pill=d.kind==='match'?'<span class="hd-pill hd-ok">Fine for you</span>':d.kind==='check'?'<span class="hd-pill hd-warn">Leave it</span>':d.kind==='excluded'?'<span class="hd-pill hd-bad">Avoid</span>':'<span class="hd-pill hd-neutral">Checked</span>';
  return `<a class="hd-row" href="#food/${e(prod.barcode)}">${prod.image?`<img src="${e(prod.image)}" alt="" loading="lazy">`:`<span class="hd-noimg">${i('package')}</span>`}<span class="hd-name">${e(prod.name||'Unknown')}</span>${pill}</a>`;
 }).join('');
 if(!rows)return '';
 return `<section class="home-decisions" aria-label="Your recent decisions"><div class="hd-head"><span class="eyebrow">YOUR CALLS</span><a class="link-button" href="#insights">All activity ${i('arrow')}</a></div><div class="hd-list">${rows}</div></section>`;
}
function timelineSection(s){
 const items=(s.store.recent||[]).slice(0,6);
 if(!items.length)return '';
 return `<div class="mt-3"><span class="eyebrow">Recent decisions</span><div class="timeline">${items.map(prod=>{
  if(!prod||!prod.barcode)return '';
  let d; try{d=decisionFor(prod,s.store.profile);}catch{d=null;}
  if(!d)return '';
  const icon=d.kind==='match'?'check':d.kind==='check'?'alert':'info';
  const cls=d.kind==='match'?'t-match':d.kind==='check'?'t-check':'t-neutral';
  return `<a class="timeline-row ${cls}" href="#food/${e(prod.barcode)}"><span class="t-icon">${i(icon)}</span><span class="t-main"><strong>${e(prod.name||'Unknown product')}</strong><span>${e(d.title)}</span></span>${i('chevron')}</a>`;
 }).join('')}</div></div>`;
}
export function insightsView(state){
  const s=projectState(state);
  if(!s.store.settings.recap)return `<div class="container">${pageHead('Private by default','Your <em>week.</em>','')}
  ${emptyState('chart','Recap is off — and that\u2019s fine.','Turn on the local recap to see scans, swaps and gentle next actions. Everything is computed on this device; nothing is uploaded.',`<button class="button button-primary" data-action="enable-recap">${i('chart')} Enable my local recap</button>`)}</div>`;
  const r=localRecap(s.store);
  const stats=[[r.success,'Successful scans'],[r.repeat,'Repeat scans'],[r.saves,'Foods saved'],[r.listed,'Added to list'],[r.swaps,'Better choices saved'],[r.merchantSearches,'Merchant searches (not sales)'],[r.missing,'Not in database']];
  const mixTotal=Object.values(r.grades).reduce((a,b)=>a+b,0);
  const mix=mixTotal?`<div class="mt-3"><span class="eyebrow">Nutri-Score mix of this week's scans</span><div class="bk-bar mt-1" role="img" aria-label="Nutri-Score mix of scans this week">${[...'ABCDE'].filter(g=>r.grades[g]).map(g=>`<span class="bk-seg ns-${g}" style="flex-grow:${r.grades[g]}"><b>${g}</b>${r.grades[g]}</span>`).join('')}</div><p class="small muted mt-1">Based on the source grade of each product you scanned. Every food has a place, so this is a picture, not a score for you.</p></div>`:'';
  const milestones=[];
  if(r.swaps>=5)milestones.push(['spark','5 smarter swaps','You\u2019ve saved 5 better-aligned options this week. Small swaps, compounding.']);
  if(r.repeat>=3)milestones.push(['refresh','Staple checker','You re-scanned favorites instead of re-reading labels. That\u2019s the habit working.']);
  if(r.cached&&r.cacheMedianMs!=null)milestones.push(['bolt',`${(r.cacheMedianMs/1000).toFixed(1)}s median`,'Your repeat scans open from the on-device cache — instant, even with no signal.']);
  return `<div class="container">${pageHead('Computed on this device','Your <em>week.</em>','No guilt, no streaks to protect — just what happened and what\u2019s useful next.')}
  <div class="recap-grid">${stats.map(([n,l])=>`<div class="stat-card rise"><div class="stat-num">${n}</div><div class="stat-label">${l}</div></div>`).join('')}</div>
  ${mix}
  ${milestones.length?`<div class="mt-3"><span class="eyebrow">Milestones</span>${milestones.map(([ic,t,d])=>`<div class="milestone"><span class="m-icon">${i(ic)}</span><div><strong>${e(t)}</strong><br><span class="small muted">${e(d)}</span></div></div>`).join('')}</div>`:''}
  ${timelineSection(s)}
  <div class="mt-3"><span class="eyebrow">Suggested next actions</span><div class="next-actions">
    <a class="next-action" href="#shopping">${i('list')}<span><strong>Review your shopping list</strong><br><span class="small muted">Going soon? Your saved swaps are one tap away.</span></span></a>
    <a class="next-action" href="#profile">${i('leaf')}<span><strong>Refine your food profile</strong><br><span class="small muted">Tighter priorities → sharper verdicts.</span></span></a>
    ${r.missing?`<a class="next-action" href="#saved">${i('package')}<span><strong>${r.missing} scan${r.missing===1?' was':'s were'} missing</strong><br><span class="small muted">Add package details or save a label photo.</span></span></a>`:''}
  </div></div>
  <p class="small muted mt-3">Activity log lives only here. Merchant searches are clicks, not purchases or affiliate earnings. Turn recap off in Settings to delete it.</p></div>`;
}

/* ---------- alternatives ---------- */
export function alternativesView(state){
  const s=projectState(state),d=s.alternatives||{};
  const base=d.baseCode?allProducts(s).find(p=>p.barcode===d.baseCode):null;
  if(!base)return `<div class="container">${emptyState('spark','Pick a product first.','Open any product and tap “Find better choices” to see better-aligned options.',`<a class="button button-primary" href="#home">${i('scan')} Scan a product</a>`)}</div>`;
  const categories=usableCategories(base);
  const {items:ranked,plan}=betterChoices(base,d.items||[],s.store.profile,d.category);
  const rankedSet=new Set(ranked.map(x=>x.product.barcode));
  const country=swapCountry(s.store.settings,base);
  return `<div class="container"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="#food/${base.barcode}">${i('back')} Back to ${e(base.name)}</a></nav>${pageHead('Explainable swaps','Better <em>options.</em>',`Similar to <strong>${e(base.name)}</strong>, compared on ${e(plan.reason||'your priorities')}, with the reason shown, never a score.`)}
  <div class="add-form"><label class="field-label" style="margin:0;flex:1">Aisle<select id="swap-category">${categories.slice().reverse().map(c=>`<option value="${c}"${c===d.category?' selected':''}>${e(tag(c))}</option>`).join('')||'<option value="">No category data</option>'}</select></label>
  <button class="button button-primary" data-action="find-swaps"${d.loading?' disabled':''}>${d.loading?'Searching…':i('spark')+' Find swaps'}</button></div>
  ${d.error?noticeBox(e(d.error),'error'):''}
  ${d.loading?`<div class="lookup-card"><span class="spinner"></span><p class="muted">Searching this category…</p></div>`:''}
  ${ranked.length?`<div class="swap7-list">${ranked.map(x=>swapChoiceCard(x,base,s,d.category)).join('')}</div>
  <div class="affiliate-box mt-2"><span class="affiliate-badge">${i('swap')} Compare the evidence</span><p class="affiliate-note">${d.checked!=null?`Checked ${d.checked} popular source records · `:''}Suggested foods must meet the current comparison rules. Amazon searches, if available, do not verify product identity or local stock. Some merchant links may earn a commission.</p></div>`:(!d.loading&&d.category&&d.checked!=null?`<p class="muted mt-2">No better-aligned options found in the checked records. This does not establish that your current product meets your priorities.</p>`:'')}
  ${others.length?`<div class="mt-4">${pageHead('','Other records in this aisle.','These do not improve on every nutrient compared, so they are not suggested as swaps.')}
  <div class="food-grid" data-reveal>${others.map(p=>productCard(p,s,true)).join('')}</div></div>`:''}</div>`;
}

/* ---------- profile ---------- */
export function profileView(state){
  const s=projectState(state),p=s.store.profile;
  return `<div class="container"><div class="profile-hero rise"><span class="eyebrow" style="color:#D8C9A8"><span class="dot"></span>Private · on this device only</span>
  <h1>Your food <em style="color:#F2B183">profile.</em></h1>
  <p>Priorities rank what we surface. Avoids are hard restrictions — conflicting or unconfirmed products get withheld everywhere. Nothing here ever leaves this device.</p></div>
  <form id="profile-form">
  <fieldset class="form-card"><legend>Quick picks</legend><p>One tap to start. Refine below.</p>
  <div class="button-row">${[['protein','More protein'],['sugars','Less sugar'],['satfat','Less saturated fat'],['fiber','More fiber'],['gluten','No gluten'],['lactose','No lactose'],['palmOil','No palm oil']].map(([k,l])=>{const on=p.priorities.includes(k)||p.avoids.includes(k);return `<button type="button" class="fchip" data-action="quick-profile" data-key="${k}" aria-pressed="${on}">${on?i('check'):i('plus')} ${l}</button>`;}).join('')}</div></fieldset>
  <fieldset class="form-card"><legend>Priorities — ranked</legend><p>Checked priorities appear first on every product. Use the arrows to change the order; ties break top-down. Thresholds are editable shopping filters, not medical targets.</p>
  <div class="check-chip-grid">${PRIORITIES.map(r=>`<label class="opt-card"><input type="checkbox" data-profile="priority" value="${r.id}"${p.priorities.includes(r.id)?'checked':''}><span class="opt-box" aria-hidden="true">${i('check')}</span><span class="opt-text"><strong>${r.name}</strong></span></label>`).join('')}</div>
  ${p.priorities.length?`<div class="priority-rank mt-2">${p.priorities.map((k,idx)=>{const r=PRIORITIES.find(x=>x.id===k);return `<div class="priority-row"><span class="rank-num">${idx+1}</span><span style="flex:1"><span class="p-name">${r.name}</span><br><span class="p-desc">${e(r.description)}</span></span>${r.default!=null?`<label class="small muted">Limit/target <input class="threshold-input" data-threshold="${k}" type="number" min="0.1" max="${k==='sodium'?40000:100}" step="any" value="${p.thresholds[k]}" aria-label="${r.name} threshold"></label>`:''}<span class="rank-btns"><button type="button" class="icon-button" data-action="rank-up" data-key="${k}" aria-label="Move ${r.name} up"${idx===0?' disabled':''}>${i('up')}</button><button type="button" class="icon-button" data-action="rank-down" data-key="${k}" aria-label="Move ${r.name} down"${idx===p.priorities.length-1?' disabled':''}>${i('down')}</button></span></div>`;}).join('')}</div>`:`<p class="muted mt-2">Tick at least one priority above — less sugar, more protein, more fiber…</p>`}</fieldset>
  <fieldset class="form-card"><legend>Always avoid — hard restrictions</legend><p>Conflicting or unconfirmed records are withheld everywhere. Existing records are kept, not deleted. Tree nuts and peanuts are separate choices.</p>
  <div class="check-chip-grid"><label class="opt-card"><input type="checkbox" data-profile="nut-bundle"${p.avoids.includes('nuts')&&p.avoids.includes('peanuts')?' checked':''}><span class="opt-box" aria-hidden="true">${i('check')}</span><span class="opt-text"><strong>Tree nuts + peanuts</strong></span></label>${AVOIDS.map(a=>`<label class="opt-card"><input type="checkbox" data-profile="avoid" value="${a.id}"${p.avoids.includes(a.id)?'checked':''}><span class="opt-box" aria-hidden="true">${i('check')}</span><span class="opt-text"><strong>${a.name}</strong></span></label>`).join('')}</div></fieldset>
  <fieldset class="form-card"><legend>Dietary labels you look for</legend><p>Explicit, non-conflicting source labels are required. Missing data can never pass as a match.</p>
  <div class="check-chip-grid">${DIETS.map(d=>`<label class="opt-card"><input type="checkbox" data-profile="diet" value="${d.id}"${p.diets.includes(d.id)?'checked':''}><span class="opt-box" aria-hidden="true">${i('check')}</span><span class="opt-text"><strong>${d.name}</strong></span></label>`).join('')}</div></fieldset>
  <div class="button-row"><button class="button button-primary" type="submit">${i('check')} Done</button><a class="button button-outline" href="#home">${i('scan')} Back to scan</a></div>
  <p class="small muted mt-2" role="status">Changes save immediately and apply to every screen. Rules version ${RULE_VERSION}.</p></form></div>`;
}

/* ---------- about / privacy ---------- */
export function aboutView(privacy=false){
  const cards=[
    ['scan','Instant, with receipts','Every line on a product page explains itself. Tap Why? and see the number, the threshold it was compared with, and where it came from. If we cannot show our working, we do not say it.'],
    ['shield','No made-up score','FoodScan never invents a grade. Nutri-Score and NOVA appear exactly as the source gives them. Color bands follow the UK front-of-pack standard and daily percentages use the EU reference intake. All published, all checkable.'],
    ['cube','Dose, not fear','A spoonful of olive oil is not a bottle of cola. Slide to your real portion and see what it adds up to, in teaspoons of sugar and as a share of a daily guide. Foods are not good or bad. Amounts matter.'],
    ['leaf','Your profile, your rules','Priorities, avoids and diets live only on this device. Hard restrictions withhold conflicting products everywhere instead of quietly substituting. Unknown never counts as safe.'],
    ['lock','Private by design','No account or third-party tracking scripts. Profiles, lists, and camera photos stay on this device. A requested food lookup sends barcode/search terms, and an optional Amazon search opens only when you tap it.'],
    ...(privacy?[['lock','Exactly what leaves your device','<ul><li>The barcode digits you scan or type</li><li>Words you type into product search</li><li>A product category (and selected country) for alternatives</li><li>If you tap an Amazon merchant-search link, its product-name query and affiliate identifier go to that retailer</li></ul><p>Food lookups go to the FoodScan server and Open Food Facts, or directly to Open Food Facts if the server cannot be reached. Your profile, lists, pantry and photos stay on the device. Amazon sees the search query only after you click its link.</p>']]:[]),
    ['alert','Not medical advice','FoodScan is a shopping companion, not a clinician. Allergen and diet flags come from package records, which can be wrong or out of date. Always check the physical label.'],
    ['info','How we read a label',`<ul><li>Color bands: UK FSA front-of-pack thresholds</li><li>Daily percentages: EU 1169/2011 reference intakes (2,000 kcal adult)</li><li>Fiber and protein notes: EU 1924/2006 claim criteria</li><li>One teaspoon of sugar is counted as 4 g</li><li>Nutri-Score, NOVA, allergens, labels, additives: Open Food Facts, unchanged</li></ul>`],
    ['info','Sources &amp; licenses','Product data: Open Food Facts and contributors (ODbL 1.0); images CC BY-SA 3.0. Community data can be incomplete, so manufacturer labels override everything.']
  ];
  return `<div class="container">${pageHead(privacy?'Your data, plainly':'Why we exist',privacy?'Privacy <em>&amp; sources.</em>':'Eat smarter, <em>not scared.</em>',privacy?'Your private records remain local; requested searches use outside services.':'Food decisions are personal and labels are confusing. FoodScan turns a barcode into plain-English facts that explain themselves, without a black-box score or a lecture.')}
  <div class="about-grid">${cards.map(([ic,t,d])=>`<div class="about-card rise"><span class="empty-icon" style="margin:0 0 1rem">${i(ic)}</span><h3>${t}</h3><div class="muted about-text">${d.startsWith('<ul>')?d:`<p>${d}</p>`}</div></div>`).join('')}</div>
  <div class="button-row"><a class="button button-primary" href="#home">${i('scan')} Start scanning</a><a class="button button-outline" href="#demo">${i('spark')} See how it works</a>${privacy?'':`<a class="button button-outline" href="#privacy">Privacy details</a>`}</div></div>`;
}
