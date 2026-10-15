/** Reusable visual building blocks (HTML strings). Presentation only: all facts come from nutrition.js. */
import {escapeHTML as e,formatNumber} from './model.js';
import {packArt,sugarCubes} from './art.js';
import {icon as i} from './icons.js';
import {GRADE_STYLE,NOVA_INFO,trafficLights,lightWord,quickRead,composition,portionPlan,portionFacts,percentRI,formatPercent,formatTsp,unitWord,valuePer100} from './nutrition.js';
import {amazonSearchLink} from './commerce.js';
import {parseIngredientsAccurately} from './ingredient-parser.js';

const LEVEL_ICON={high:'alert',medium:'info',low:'check'};

/* ---------- score badges ---------- */
/** Official-style A-E strip with the source grade enlarged. */
export function gradeStrip(grade,{size='md'}={}){
 const label=grade?`Nutri-Score ${grade}, ${GRADE_STYLE[grade].word}`:'Nutri-Score not available';
 return `<span class="nsbar nsbar-${size}${grade?'':' none'}" role="img" aria-label="${e(label)}">${[...'ABCDE'].map(l=>`<span class="ns ns-${l}${l===grade?' on':''}" aria-hidden="true">${l}</span>`).join('')}</span>`;
}
export const gradeDot=grade=>grade?`<span class="ns-dot ns-${grade}" role="img" aria-label="Nutri-Score ${grade}">${grade}</span>`:'';
export function novaBar(group){
 const info=NOVA_INFO[group];
 return `<span class="novabar${info?'':' none'}" role="img" aria-label="${info?`NOVA group ${group}, ${e(info.title)}`:'NOVA not available'}">${[1,2,3,4].map(n=>`<span class="nv nv-${n}${n===group?' on':''}" aria-hidden="true">${n}</span>`).join('')}</span>`;
}
/** The two source-provided scores side by side, each with an honest caption. */
/* v11.2: plain-language captions under each badge — no click needed to understand */
const NS_CAPTION={A:'Best nutritional quality',B:'Good nutritional quality',C:'Average nutritional quality',D:'Poor nutritional quality',E:'Poorest nutritional quality'};
const NOVA_CAPTION={1:'Minimally processed',2:'Processed culinary ingredient',3:'Processed food',4:'Ultra-processed'};
export function scoreCards(p){
 const ns=p.nutriScore,nova=p.nova,info=NOVA_INFO[nova];
 return `<div class="score-cards">
  <div class="score-card${ns?'':' is-empty'}"><div class="score-txt"><span class="score-k">Nutri-Score</span><span class="score-note">${ns?GRADE_STYLE[ns].word:'Not provided'}</span></div>${gradeStrip(ns)}${ns?`<p class="score-caption">${NS_CAPTION[ns]} · A is best, E is poorest</p>`:'<p class="score-caption">No score in the source record</p>'}</div>
  <div class="score-card${info?'':' is-empty'}"><div class="score-txt"><span class="score-k">Processing (NOVA)</span><span class="score-note">${info?e(info.short):'Not provided'}</span></div>${novaBar(nova)}${nova?`<p class="score-caption">${NOVA_CAPTION[nova]}</p>`:'<p class="score-caption">Processing level not reported</p>'}</div>
 </div>
 <details class="score-help"><summary>${i('info')}<span>What do these mean?</span></summary><div><p><strong>Nutri-Score</strong> (A to E) summarizes a food's nutrient profile. It comes from the source record and FoodScan never changes it. It is best used to compare similar foods.</p><p><strong>NOVA</strong> (1 to 4) describes how industrially a food is made, not how much of any nutrient it has. It is not a safety rating.</p></div></details>`;
}

/* ---------- The Real Story: 4 Pillars of Truth ---------- */
export function realStoryPillars(p){
 const ns=p.nutriScore,nova=p.nova,info=NOVA_INFO[nova];
 const sugars=p.nutrition?.sugars;
 const cubes=sugars!=null?Math.round(sugars/4*10)/10:null;
 const unit=unitWord(p);
 const allergens=p.allergens||[];
 const traces=p.traces||[];
 return `<div class="real-story-box">
  <div class="real-story-head"><span class="eyebrow"><span class="dot"></span>THE REAL STORY · ZERO JARGON</span><h2 class="real-story-title">Nutri-Score, processing, sugar cubes &amp; allergens</h2></div>
  <div class="real-story-grid">
   <div class="rs-item rs-grade">
    <div class="rs-top"><span class="rs-title">Nutri-Score</span>${ns?gradeDot(ns):'<span class="muted small">None</span>'}</div>
    <div class="rs-val"><strong>${ns?`Grade ${ns} · ${GRADE_STYLE[ns].word}`:'Not rated'}</strong></div>
    <p class="rs-desc">${ns?`Overall nutrient balance under the European standard. A is best, E is poorest.`:'No Nutri-Score in the source record.'}</p>
   </div>
   <div class="rs-item rs-nova">
    <div class="rs-top"><span class="rs-title">Processing (NOVA)</span>${nova?`<span class="nova-pill nv-${nova}">NOVA ${nova}</span>`:'<span class="muted small">None</span>'}</div>
    <div class="rs-val"><strong>${info?info.short:'Not rated'}</strong></div>
    <p class="rs-desc">${nova===4?'Ultra-processed: industrial formulation with additives or refined extracts.':nova===1?'Minimally processed: close to natural state with no industrial additives.':nova===2?'Culinary ingredient (pure butter, oil, sugar).':nova===3?'Processed: standard recipe.' :'Processing level not reported.'}</p>
   </div>
   <div class="rs-item rs-sugar">
    <div class="rs-top"><span class="rs-title">Sugar in Cubes</span><span class="sugar-cube-count">${cubes!=null?`${cubes} 🧊`:'—'}</span></div>
    <div class="rs-val"><strong>${cubes!=null?`${formatNumber(sugars)} g per 100 ${unit}`:'Not reported'}</strong></div>
    <p class="rs-desc">${cubes!=null?`Equal to ${cubes} teaspoons of sugar (${cubes} cubes) per 100 ${unit}. 1 cube = 4 g.`:'Sugar value not reported in record.'}</p>
    ${sugars!=null&&sugars>0?`<div class="rs-cubes-vis">${sugarCubes(Math.min(sugars,40))}</div>`:''}
   </div>
   <div class="rs-item rs-allergens">
    <div class="rs-top"><span class="rs-title">Allergens Check</span><span class="rs-status ${allergens.length?'has-allergens':'clean-allergens'}">${allergens.length?i('alert')+' Reported':i('info')+' Not listed'}</span></div>
    <div class="rs-val"><strong>${allergens.length?allergens.slice(0,3).join(', '):'Not reported in this record'}</strong></div>
    <p class="rs-desc">${allergens.length?`Declared allergens: ${allergens.join(', ')}.`:(traces.length?`May contain traces of: ${traces.join(', ')}.`:'No allergens listed in the source record. This does not establish allergen safety. Check the physical package.')}</p>
   </div>
  </div>
 </div>`;
}

/* ---------- quick read ---------- */
export function quickReadList(p){
 const items=quickRead(p);
 if(!items.length)return '';
 return `<div class="qr-list">${items.map((x,idx)=>`<details class="qr qr-${x.tone}" style="--q:${idx}"><summary><span class="qr-ico">${i(x.icon)}</span><span class="qr-text"><strong>${e(x.title)}</strong>${x.detail?`<small>${e(x.detail)}</small>`:''}</span><span class="qr-why">Why?</span></summary><div class="qr-body"><p>${e(x.why)}</p></div></details>`).join('')}</div>`;
}

/* ---------- traffic lights ---------- */
export function lightTiles(p){
 const lights=trafficLights(p),unit=unitWord(p);
 const tiles=lights.items.map(x=>{
  const lvl=x.level||'none';
  const value=x.value==null?'—':formatNumber(x.value);
  const word=x.level?lightWord[x.level]:x.reason==='conflict'?'Conflicting':x.reason==='basis'?'Basis unknown':'Not reported';
  const [low,high]=x.thresholds;
  const band=x.level==='high'?`Over ${formatNumber(high)} g`:x.level==='low'?`Up to ${formatNumber(low)} g`:x.level==='medium'?`${formatNumber(low)}–${formatNumber(high)} g`:'';
  const note=x.key==='sugars'&&x.value!=null?`≈ ${formatTsp(x.value)}`:band;
  return `<div class="light l-${lvl}"><span class="light-top"><span class="light-dot" aria-hidden="true"></span><span class="light-name">${x.label}</span></span><strong class="light-val">${value}<small>${x.value==null?'':' g'}</small></strong><span class="light-word">${x.level?i(LEVEL_ICON[x.level]):''}${word}</span>${note?`<small class="light-note">${note}</small>`:''}</div>`;
 }).join('');
 return `<div class="lights" role="group" aria-label="Fat, saturated fat, sugars and salt per 100 ${unit}">${tiles}</div>`;
}
/** Compact value chips for cards. */
export function miniLights(p){
 const items=trafficLights(p).items.filter(x=>x.value!=null);
 if(!items.length)return '';
 const short={fat:'Fat',saturatedFat:'Sat',sugars:'Sugar',salt:'Salt'};
 return `<div class="mini-lights" aria-label="Per 100 ${unitWord(p)}">${items.map(x=>`<span class="mchip l-${x.level||'none'}"><i aria-hidden="true"></i>${short[x.key]} ${formatNumber(x.value)}<small>g</small>${x.level?`<span class="sr-only"> (${lightWord[x.level].toLowerCase()})</span>`:''}</span>`).join('')}</div>`;
}

/* ---------- composition ---------- */
export function compositionBar(p){
 const c=composition(p);
 if(!c)return '';
 return `<div class="comp"><div class="comp-bar" role="img" aria-label="${e(c.parts.map(x=>`${x.label} ${formatNumber(x.value)} g`).join(', '))} per 100 ${c.basisUnit}">${c.parts.map(x=>`<span class="cp cp-${x.key}" style="flex-grow:${Math.max(x.value,.4).toFixed(2)}"></span>`).join('')}</div>
 <ul class="comp-legend">${c.parts.map(x=>`<li><i class="cp-${x.key}" aria-hidden="true"></i><span>${x.label}</span><b>${formatNumber(x.value)} g</b></li>`).join('')}</ul>${c.complete?'':`<p class="small muted">Some values are missing, so this bar shows only what the record reports.</p>`}</div>`;
}

/* ---------- portion ---------- */
const RI_ROWS=[['kcal','Energy','kcal'],['sugars','Sugars','g'],['fat','Fat','g'],['saturatedFat','Saturated fat','g'],['salt','Salt','g'],['protein','Protein','g']];
export function portionBody(p,amount){
 const facts=portionFacts(p,amount),unit=unitWord(p);
 const rows=RI_ROWS.map(([key,label,u])=>{
  const v=facts[key];
  const ri=percentRI(key,v);
  const extra=key==='sugars'&&v!=null?` <small>(≈ ${formatTsp(v)})</small>`:'';
  return `<div class="pf-row"><span class="pf-name">${label}</span><b class="pf-val">${v==null?'—':formatNumber(v)} ${v==null?'':u}${extra}</b><span class="pf-ri" aria-hidden="true"><span style="width:${Math.min(100,ri||0).toFixed(1)}%"></span></span><span class="pf-pct">${v==null?'n/a':`${formatPercent(ri)}<span class="sr-only"> of daily reference</span>`}</span></div>`;
 }).join('');
 const cubes=facts.sugars>0?`${sugarCubes(facts.sugars)}<p class="cube-cap">${facts.sugars<2?'a pinch of sugar':`${formatNumber(facts.sugars)} g of sugar. One cube is a 4 g teaspoon.`}</p>`:'';
 return `<p class="pf-head">${formatNumber(amount)} ${unit} gives you:</p>${cubes}<div class="pf-grid">${rows}</div>
 <p class="small muted pf-foot">% of an adult's daily reference intake on a 2,000 kcal diet (EU label standard). A general guide, not personal advice.</p>`;
}
/* Preserve the source's original label while displaying a faithful parsed reading aid. */
export function ingredientsList(p){
 const raw=p.ingredients;
 if(!raw)return `<div class="fs11-ingredients-unknown" role="note">${i('info')}<div><strong>Ingredient list unavailable</strong><p>Missing ingredient text does not mean allergens are absent. Refer to the physical package.</p></div></div>`;
 const {items,footnote}=parseIngredientsAccurately(raw);
 if(!items.length)return `<p class="fs11-label-original">${e(raw)}</p>`;
 return `<div class="fs12-ingredient-intro"><strong>${items.length} reported ingredients</strong><span>In source order · no quantities estimated</span></div>
 <ol class="fs12-ingredient-list">${items.map(item=>{
  const percentage=item.percentage;
  return `<li class="fs12-ing-row fs12-ing-${item.tone}"><span class="fs12-ing-index" aria-label="Ingredient ${item.rank}">${String(item.rank).padStart(2,'0')}</span>
   <div class="fs12-ing-content"><strong>${e(item.name)}</strong>${item.englishHint&&item.englishHint.toLowerCase()!==item.name.toLowerCase()?`<span class="fs12-ing-translation">${e(item.englishHint)}</span>`:''}<span class="fs12-ing-label">${e(item.tag)}${item.rank===1?' · Listed first':''}</span>
    ${percentage!=null?`<div class="fs12-ing-bar" role="img" aria-label="${e(item.name)}: ${formatNumber(percentage)} percent declared on label"><span style="width:${Math.min(100,percentage)}%"></span></div>`:''}</div>
   <div class="fs12-ing-right">${percentage!=null?`<span class="fs12-ing-percent">${formatNumber(percentage)}%</span><small>On label</small>`:`<span class="fs12-ing-unknown">Not given</span><small>Amount</small>`}</div></li>`;
 }).join('')}</ol>
 ${footnote?`<div class="fs12-label-footnote"><strong>Additional source statement</strong><span>${e(footnote)}</span><small>Reported wording; verify on the current package.</small></div>`:''}
 <div class="fs12-raw-label"><div class="fs12-raw-head">${i('file-text')} <strong>Original label transcription</strong><span>Unedited</span></div><p>${e(raw)}</p></div>
 <p class="fs12-ing-disclaimer">Ingredients are generally listed in descending order by weight. Colored tags help identify words in the text; they are not allergy-safety assessments. Only percentages printed in the source are shown.</p>`;
}
export function portionPanel(p,amount){
 const plan=portionPlan(p),value=Math.min(plan.max,Math.max(plan.min,amount??plan.start));
 return `<div class="portion-ctrl">
  <div class="portion-top"><label for="portion-range">How much will you have?</label><output id="portion-out" for="portion-range">${formatNumber(value)} ${plan.unit}</output></div>
  <input id="portion-range" type="range" min="${plan.min}" max="${plan.max}" step="1" value="${value}" aria-valuetext="${formatNumber(value)} ${plan.unit}">
  <div class="portion-chips" role="group" aria-label="Quick portion sizes">${plan.choices.map(c=>`<button type="button" class="fchip" data-action="portion-set" data-amount="${c.amount}" aria-pressed="${Math.abs(c.amount-value)<.5}">${e(c.label)}<small>${e(c.hint)}</small></button>`).join('')}</div>
 </div><div id="portion-body" aria-live="polite">${portionBody(p,value)}</div>`;
}
export const portionStart=p=>portionPlan(p).start;

/* ---------- better choices ---------- */
export function swapSkeleton(){
 return `<div class="swap7-list" aria-busy="true" aria-label="Looking for better choices">${[1,2,3].map(()=>`<div class="swap7 skeleton"><span class="sk sk-img"></span><span class="sk-lines"><span class="sk sk-l1"></span><span class="sk sk-l2"></span></span></div>`).join('')}</div>`;
}
export function swapCard(item,base,{demo=false,country='' }={}){
 const p=item.product,open=demo?'<span class="swap7-open">':`<a class="swap7-open" href="#food/${p.barcode}">`,close=demo?'</span>':'</a>';
 const amz=amazonSearchLink(p,country);
 return `<article class="swap7">${open}
  <span class="swap7-img">${p.image?`<img src="${e(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:packArt(p)}</span>
  <span class="swap7-main"><span class="food-brand">${e(p.brand||'Brand not reported')}</span><strong>${e(p.name)}</strong>
   <span class="swap7-grades">${item.gradeFrom&&item.gradeTo&&item.gradeFrom!==item.gradeTo?`${gradeDot(item.gradeFrom)}<span aria-hidden="true">${i('arrow')}</span>${gradeDot(item.gradeTo)}<span class="sr-only">Nutri-Score improves from ${item.gradeFrom} to ${item.gradeTo}</span>`:item.gradeTo?`${gradeDot(item.gradeTo)}`:''}</span>
   <span class="swap-delta">${item.why.map(w=>`<span class="delta-pill">${e(w)}</span>`).join('')}</span></span>${close}
  ${demo?'':`<span class="swap7-actions">${amz?`<a class="button button-amazon button-sm" data-commercial-link="amazon" data-placement="swap" href="${e(amz.url)}" target="_blank" rel="${amz.sponsored?'sponsored ':''}noopener noreferrer" aria-label="Search Amazon results for ${e(p.name)}${amz.sponsored?', paid link':''}">${i('search')} Search Amazon${amz.sponsored?' · paid link':''}</a>`:''}<button class="button button-outline button-sm" data-action="swap-save" data-code="${p.barcode}">${i('list')} Add to list</button><a class="button button-ghost button-sm" href="#food/${p.barcode}">Open ${i('arrow')}</a></span>`}</article>`;
}
