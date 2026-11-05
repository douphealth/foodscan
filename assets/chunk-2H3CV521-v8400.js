import{n as Bt}from"./chunk-I3TRV521-v8400.js";import{a as Ft,b as It,c as jt}from"./chunk-QWAD3TTI-v8400.js";import{a as z,b as Rt,c as G,d as Lt,e as Nt,g as Dt,h as it,i as ct}from"./chunk-GA22IG5W-v8400.js";import{b as openBasketShare}from"./chunk-SN3WV521-v8400.js";import{i as makeBasketToken}from"./chunk-6K2A3QNO-v8400.js";import{d as yeBasketCat,e as Mt}from"./chunk-57E5ZLYU-v8400.js";import{b as Et}from"./chunk-AHTU2MHF-v8400.js";import"./chunk-IO4NLMGT-v7540.js";import"./chunk-LGF5RK5L-v8400.js";import{d as Z}from"./chunk-BIWX2LG4-v8400.js";import"./chunk-4SO6OQI3-v8400.js";import{b as ot,e as nt,g as Q,l as At,n as Tt,o as rt,r as Ct}from"./chunk-2OB4V521-v8400.js";import{b as kt,d as $t,e as yt,h as X,m as _t,p as H,q as vt,r as St,s as K,u as J,v as xt}from"./chunk-JOUXBJOG-v8400.js";import{k as gt,o as wt}from"./chunk-TTXUOT36-v8400.js";import{b as U,c as n,d as E,e as W,g,i as k,j as V,l as u}from"./chunk-4O7IN74N-v8400.js";import{d as t,e as _,j as st,r as Y}from"./chunk-6K6QREZY-v8400.js";var Ot={low:"good",medium:"warn",high:"bad"},Pt=4,dt=20;function qt(h){let i=new URLSearchParams(String(h).split("?")[1]||"").get("codes");if(!i)return{codes:[],invalid:0,truncated:!1};let c=new Set,l=[],r=0;for(let b of i.slice(0,1e4).split(",")){let p=b.trim();if(!st(p)){r++;continue}let w=p.padStart(14,"0");c.has(w)||(c.add(w),l.push(p))}return{codes:l.slice(0,dt),invalid:r,truncated:l.length>dt}}var Ut=()=>{try{let h=new URL(location.href);h.hash="/choices",history.replaceState(null,"",h.href)}catch{}};function Yt(h){let i=Et(h),c=Object.fromEntries(i.rows.map(p=>[p.key,p])),l={sugars:t("Sugars"),saturatedFat:t("Sat. fat"),salt:t("Salt")},r=p=>c[p]&&c[p].value!==null?n`<span class="wk__stat">${i.bands&&Ot[c[p].band]?n`<i class="dot dot--${Ot[c[p].band]}"></i>`:""}<b>${Y(c[p].value,c[p].value<1?2:1)}</b> g <small>${l[p]}</small></span>`:"",b=["sugars","saturatedFat","salt"].map(r).filter(Boolean);return b.length?n`<div class="wk__stats" role="group" aria-label="${t("Key values {unit}",{unit:i.unit})}">${b}<small class="wk__per">${i.unit}</small></div>`:""}function Wt(h,i){if(!i)return"";if(i.status==="loading")return n`<div class="wk__note wk__note--busy" role="status"><span class="spin"></span>${t("Looking for a better choice…")}</div>`;if(i.status==="error")return n`<div class="wk__note wk__note--warn">${u("alert",15)}<span>${t("Couldn’t check just now. The food database may be busy.")}</span></div>`;if(i.status==="none")return n`<div class="wk__note">${u("check",15)}<span>${t("No higher grade found for this one.")}</span></div>`;if(i.status==="have")return n`<div class="wk__note">${u("check",15)}<span>${t("A better choice is already in your workspace: {name}",{name:i.pick.product.name})}</span></div>`;let c=i.pick,l=c.product,r=c.reasons.slice(0,2);return n`<div class="wk__better g-${c.to}">
    <div class="wk__bhead"><span class="wk__bgrade">${rt(c.from,c.to)}</span><small>${t("Better choice")}</small>${i.res?.fallback?n`<small class="wk__cat">${u("shield",12)}${t("Built-in catalogue")}</small>`:""}</div>
    <a class="wk__bprod" href="#/p/${l.barcode}"><span class="wk__bimg">${ot(l,{size:"sm"})}</span><span class="wk__text"><b>${l.name}</b><small>${[l.brand?.split(",")[0],l.quantity].filter(Boolean).join(" · ")||t("Brand not listed")}</small></span></a>
    ${r.length?n`<div class="chips">${r.map(b=>n`<span class="chip chip--good">${u("check",13)}${b.text}</span>`)}${c.tradeoffs.slice(0,1).map(b=>n`<span class="chip chip--warn">${u("alert",13)}${t("but {what}",{what:b.text})}</span>`)}</div>`:""}
    <div class="wk__bact"><button type="button" class="btn btn--primary btn--xs" data-act="wk:swap" data-arg="${h.barcode}">${u("swap",15)}${t("Swap")}</button><button type="button" class="btn btn--soft btn--xs" data-act="wk:vs" data-arg="${h.barcode}">${u("columns",15)}${t("Compare")}</button></div>
  </div>`}var Vt={kcal:"Energy",sugars:"Sugars",saturatedFat:"Saturated fat",salt:"Salt",fiber:"Fibre",protein:"Protein"};function Xt(h){if(!h)return"";if(h.status==="checking")return n`<div class="wk__note wk__note--busy" role="status"><span class="spin"></span>${t("Checking the current record…")}</div>`;if(h.status==="error")return n`<div class="wk__note wk__note--warn">${u("alert",15)}<span>${t("Couldn’t check just now. The food database may be busy.")}</span></div>`;if(h.status==="gone")return n`<div class="wk__note wk__note--warn">${u("alert",15)}<span>${t("No longer in the food database. Your saved copy is kept; check the pack.")}</span></div>`;if(h.status==="same")return n`<div class="wk__note">${u("check",15)}<span>${t("Checked: no changes worth knowing.")}</span></div>`;let i=h.diff,c=[];i.grade&&c.push(i.grade.direction==="up"?t("Grade improved: {from} → {to}",i.grade):i.grade.direction==="down"?t("Grade dropped: {from} → {to}",i.grade):i.grade.direction==="new"?t("Now graded {to}",i.grade):t("No grade any more (was {from})",i.grade)),i.held&&c.push(t("Grade on hold: the record now contradicts itself"));for(let r of i.nutrients.slice(0,2))c.push(t("{nutrient}: {from} → {to} per 100",{nutrient:t(Vt[r.key]),from:Y(r.from,1),to:Y(r.to,1)}));i.lostIngredients?c.push(t("The ingredient list was removed from the record")):i.lostValues&&c.push(_(i.lostValues,"{n} label value is no longer reported","{n} label values are no longer reported")),i.name&&c.push(t("Renamed: {to}",i.name));let l=i.held||i.lostValues||i.lostIngredients||i.grade?.direction==="down"||i.grade?.direction==="lost";return n`<div class="wk__note ${l?"wk__note--warn":"wk__note--top"}">${u(l?"alert":"info",15)}<span><b>${t("Changed since you saved it")}</b> ${c.join(" · ")}</span></div>`}function Ht(h,{found:i,picked:c,checks:l}){let r=h.product,b=z(r),p=i.get(r.barcode),w=!Q(b)&&r.nutriScore,T=G(r),x=p?.status==="loading";return n`<div class="wk__main"><a class="wk__link" href="#/p/${r.barcode}"><span class="wk__img">${ot(r,{size:"md"})}</span><span class="wk__text"><b>${r.name}</b><small>${[r.brand?.split(",")[0],r.quantity].filter(Boolean).join(" · ")||r.barcode}</small></span></a>${Tt(b,{size:"lg",estimated:At(r).status==="estimated"})}</div>
    ${Yt(r)}${Xt(l?.get(r.barcode))}
    ${b==="A"?n`<div class="wk__note wk__note--top">${u("check",15)}<span>${t("Already the top grade")}</span></div>`:w?n`<div class="wk__note wk__note--warn">${u("alert",15)}<span>${t("Grade on hold")}</span></div>`:""}
    <div class="wk__slot" aria-live="polite">${Wt(r,p)}</div>
    <div class="wk__bar">
      <button type="button" class="wk__cmp" data-act="wk:select" data-arg="${r.barcode}" aria-pressed="${String(c)}"><span class="wk__box" aria-hidden="true">${c?u("check",14):""}</span>${t("Compare")}</button>
      ${T&&(!p||p.status==="error"||p.status==="none")&&!x?n`<button type="button" class="btn btn--soft btn--xs" data-act="wk:find" data-arg="${r.barcode}">${u("sparkle",15)}${p?p.status==="error"?t("Try again"):t("Look again"):t("Find a better choice")}</button>`:""}
      <button type="button" class="icon-btn wk__rm" data-act="wk:remove" data-arg="${r.barcode}" aria-label="${t("Remove {name}",{name:r.name})}">${u("trash",18)}</button>
    </div>`}var Kt=()=>n`<div class="ws__empty">
  <ul class="ws__ghosts" aria-hidden="true">${[["E","a"],["C","b"],["A","c"]].map(([h,i])=>n`<li class="g-${h} ws__ghost ws__ghost--${i}"><i></i><span><s></s><s></s></span><b>${h}</b></li>`)}</ul>
  ${Ct({icon:"layers",title:t("Your workspace is empty"),body:t("Save the products you are choosing between: tap the bookmark on any report. Then see better choices, swap them in with one tap, and compare them side by side."),actions:n`<a class="btn btn--primary" href="#/scan">${u("scan",18)}${t("Scan something")}</a>${J().length?n`<button type="button" class="btn btn--soft" data-act="wk:load-usual">${u("heart",18)}${t("Load my usual shop")}</button>`:n`<a class="btn btn--ghost" href="#/demo">${u("play",18)}${t("See how it works")}</a>`}`})}</div>`;

function calcBasketScore(mix){
  if(!mix||!mix.graded)return null;
  let w={A:100,B:78,C:52,D:26,E:8},sum=0;
  for(let g of["A","B","C","D","E"])sum+=(mix.counts[g]||0)*w[g];
  return Math.round(sum/mix.graded);
}
function renderBasketScoreRing(beforeMix,afterMix,hasSwaps){
  let s1=calcBasketScore(beforeMix),s2=hasSwaps&&afterMix?calcBasketScore(afterMix):s1;
  if(s1===null)return"";
  let target=s2??s1,circum=2*Math.PI*22,offset=Math.round(circum*(1-target/100));
  let tone=target>=75?"#038141":target>=50?"#85BB2F":target>=35?"#FECB02":"#EE8100";
  return n`<div class="basket-ring" role="img" aria-label="${t("Basket health score")}: ${target}/100">
    <svg viewBox="0 0 56 56" width="54" height="54" aria-hidden="true">
      <circle cx="28" cy="28" r="22" fill="none" stroke="var(--line)" stroke-width="5"></circle>
      <circle cx="28" cy="28" r="22" fill="none" stroke="${tone}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${Math.round(circum)}" stroke-dashoffset="${offset}" transform="rotate(-90 28 28)"></circle>
      <text x="28" y="33" text-anchor="middle" font-size="15" font-weight="800" fill="var(--ink)">${target}</text>
    </svg>
    <div class="basket-ring__copy">
      <b>${hasSwaps&&s2>s1?`${t("Basket score")}: ${s1} → ${s2}/100`:`${t("Basket score")}: ${s1}/100`}</b>
      <small>${hasSwaps&&s2>s1?t("+{n} pts cleaner with recommended swaps",{n:s2-s1}):t("Based on Nutri-Score mix (0–100 scale)")}</small>
    </div>
  </div>`;
}

function calcBasketSavings(items,swapsMap){
  let sug=0,sat=0,salt=0,fib=0,prot=0,count=0;
  for(let prod of items){
    let sw=swapsMap[prod.barcode];
    if(!sw||!sw.product||prod.basis!==sw.product.basis)continue;
    count++;
    let a=prod.nutrition||{},b=sw.product.nutrition||{};
    typeof a.sugars=="number"&&typeof b.sugars=="number"&&b.sugars<a.sugars&&(sug+=a.sugars-b.sugars);
    typeof a.saturatedFat=="number"&&typeof b.saturatedFat=="number"&&b.saturatedFat<a.saturatedFat&&(sat+=a.saturatedFat-b.saturatedFat);
    typeof a.salt=="number"&&typeof b.salt=="number"&&b.salt<a.salt&&(salt+=a.salt-b.salt);
    typeof a.fiber=="number"&&typeof b.fiber=="number"&&b.fiber>a.fiber&&(fib+=b.fiber-a.fiber);
    typeof a.protein=="number"&&typeof b.protein=="number"&&b.protein>a.protein&&(prot+=b.protein-a.protein);
  }
  let pills=[];
  sug>=2&&pills.push(`−${Y(sug,1)} g ${t("sugars")} (${Math.max(1,Math.round(sug/4))} ${t("cubes")})`);
  sat>=1&&pills.push(`−${Y(sat,1)} g ${t("saturated fat")}`);
  salt>=0.2&&pills.push(`−${Y(salt,2)} g ${t("salt")}`);
  fib>=1.5&&pills.push(`+${Y(fib,1)} g ${t("fibre")}`);
  prot>=2&&pills.push(`+${Y(prot,1)} g ${t("protein")}`);
  return{count,sug,cubes:Math.round(sug/4),sat,salt,fib,prot,pills};
}
var bkG={A:"#038141",B:"#85BB2F",C:"#FECB02",D:"#EE8100",E:"#D63A0F",none:"#66736C"},bkI={A:"#FFFFFF",B:"#16240A",C:"#2A2200",D:"#2A1600",E:"#FFFFFF",none:"#FFFFFF"};
function bkRect(c,x,y,w,h,r){c.beginPath(),c.moveTo(x+r,y),c.arcTo(x+w,y,x+w,y+h,r),c.arcTo(x+w,y+h,x,y+h,r),c.arcTo(x,y+h,x,y,r),c.arcTo(x,y,x+w,y,r),c.closePath()}
function bkBadge(c,g,x,y,s,FD){let gr=g||"–";c.fillStyle=bkG[g]||bkG.none,bkRect(c,x,y,s,s,s*.26),c.fill(),c.fillStyle=bkI[g]||"#FFF",c.font=`800 ${Math.round(s*.62)}px ${FD}`,c.textAlign="center",c.textBaseline="middle",c.fillText(gr,x+s/2,y+s/2+2),c.textAlign="left",c.textBaseline="alphabetic"}
function bkMixBar(c,mix,x,y,w,h,FD){
  let grades=["A","B","C","D","E"].filter(g=>mix.counts[g]>0),tot=mix.graded||1,curX=x;
  grades.forEach((g,idx)=>{
    let segW=idx===grades.length-1?x+w-curX:Math.max(54,Math.round(w*(mix.counts[g]/tot)));
    c.fillStyle=bkG[g],bkRect(c,curX,y,segW-4,h,14),c.fill();
    c.fillStyle=bkI[g],c.font=`800 24px ${FD}`,c.textAlign="center",c.textBaseline="middle";
    c.fillText(`${g}×${mix.counts[g]}`,curX+(segW-4)/2,y+h/2+1);
    curX+=segW;
  });
  c.textAlign="left",c.textBaseline="alphabetic";
}
async function makeBasketCard(items,swapsMap,beforeMix,afterMix,{variant:fmt="post",link:lnk="food-scan.gearuptofit.com"}={}){
  try{await Promise.all([document.fonts.load("800 56px Fraunces"),document.fonts.load('600 26px "Instrument Sans"')])}catch{}
  let isStory=fmt==="story",isDark=fmt==="receipt",isAltOnly=fmt==="swap",W=1080,H=isStory?1920:1350,top=isStory?168:0,cv=document.createElement("canvas");
  cv.width=W,cv.height=H;
  let c=cv.getContext("2d"),FD='"Fraunces", Georgia, serif',FS='"Instrument Sans", system-ui, sans-serif',dark=isDark||isAltOnly;
  let bg=c.createLinearGradient(0,0,0,H);
  isAltOnly?(bg.addColorStop(0,"#061A12"),bg.addColorStop(1,"#0D2E20")):isDark?(bg.addColorStop(0,"#06120D"),bg.addColorStop(1,"#0C1E16")):(bg.addColorStop(0,"#F6F1E4"),bg.addColorStop(1,"#EAE1CB"));
  c.fillStyle=bg,c.fillRect(0,0,W,H);
  let fg=dark?"#F5F2EA":"#0D1F16",sub=dark?"#9FB0A6":"#4F5E56",surf=dark?"rgba(255,255,255,0.07)":"#FFFFFF",stroke=dark?"rgba(255,255,255,0.15)":"#DFD7C2";
  let hy=top+52;
  c.fillStyle=dark?"#1B8F5C":"#0A5C3C",bkRect(c,64,hy,52,52,15),c.fill(),c.fillStyle=fg,c.font=`800 36px ${FD}`;
  c.fillText(isAltOnly?t("FoodScan · Healthier Alternative Basket"):t("FoodScan · Basket & Swaps Audit"),132,hy+37);
  let swapKeys=Object.keys(swapsMap).filter(code=>items.some(p=>p.barcode===code));
  let sav=calcBasketSavings(items,swapsMap);
  let summaryY=top+124,summaryH=swapKeys.length?266:152;
  c.fillStyle=surf,bkRect(c,64,summaryY,W-128,summaryH,32),c.fill(),c.strokeStyle=stroke,c.lineWidth=2,c.stroke();
  c.fillStyle=dark?"#6CE0A6":"#0A5C3C",c.font=`800 20px ${FS}`;
  c.fillText(`${_(items.length,"{n} PRODUCT IN BASKET","{n} PRODUCTS IN BASKET").toUpperCase()}${swapKeys.length?`  ·  ${swapKeys.length} HEALTHIER SWAPS READY`:""}`,96,summaryY+38);
  c.fillStyle=sub,c.font=`700 19px ${FS}`,c.fillText(isAltOnly?t("Upgraded basket grades"):t("Current basket grades"),96,summaryY+70);
  bkMixBar(c,isAltOnly&&swapKeys.length?afterMix:beforeMix,96,summaryY+80,W-192,44,FD);
  if(swapKeys.length&&!isAltOnly){
    c.fillStyle="#1B8F5C",c.font=`800 19px ${FS}`,c.fillText(`↓  ${t("After swapping to healthier choices")}`,96,summaryY+152);
    bkMixBar(c,afterMix,96,summaryY+162,W-192,44,FD);
  }
  if(sav.pills.length){
    c.fillStyle=dark?"#8CE9B8":"#17693F",c.font=`800 20px ${FS}`;
    c.fillText(`★ ${t("Per 100 g swap impact")}: ${sav.pills.slice(0,3).join("  ·  ")}`,96,summaryY+summaryH-20);
  }
  let maxRows=isStory?7:5,listY=summaryY+summaryH+20,rowH=isStory?158:136;
  let shown=items.slice(0,maxRows);
  shown.forEach((prod,idx)=>{
    let ry=listY+idx*(rowH+11),sw=swapsMap[prod.barcode],g=z(prod)||"none";
    c.fillStyle=surf,bkRect(c,64,ry,W-128,rowH,26),c.fill(),c.strokeStyle=sw?"#1B8F5C":stroke,c.lineWidth=sw?2.5:1.5,c.stroke();
    if(isAltOnly&&sw){
      let sp=sw.product;
      bkBadge(c,sw.to,88,ry+(rowH-74)/2,74,FD);
      c.fillStyle="#6CE0A6",c.font=`800 18px ${FS}`,c.fillText(`★ ${t("SWAP FOR")} ${prod.name.slice(0,22).toUpperCase()} (${sw.from} → ${sw.to})`,184,ry+36);
      c.fillStyle=fg,c.font=`700 31px ${FD}`,c.fillText(String(sp.name||"").slice(0,32),184,ry+74);
      c.fillStyle=sub,c.font=`600 21px ${FS}`,c.fillText([sp.brand?.split(",")[0],sw.reasons?.[0]?.text].filter(Boolean).join(" · "),184,ry+108);
    }else if(sw){
      bkBadge(c,g,84,ry+(rowH-66)/2,66,FD);
      c.fillStyle=fg,c.font=`700 26px ${FD}`,c.fillText(String(prod.name||"").slice(0,20),166,ry+54);
      c.fillStyle=sub,c.font=`600 19px ${FS}`,c.fillText(String(prod.brand||"").split(",")[0].slice(0,18),166,ry+84);
      c.fillStyle="#1B8F5C",c.font=`800 28px ${FS}`,c.fillText("→",488,ry+rowH/2+10);
      bkBadge(c,sw.to,532,ry+(rowH-72)/2,72,FD);
      c.fillStyle=dark?"#6CE0A6":"#0A5C3C",c.font=`800 17px ${FS}`,c.fillText(`★ ${t("BETTER CHOICE")}`,620,ry+36);
      c.fillStyle=fg,c.font=`700 27px ${FD}`,c.fillText(String(sw.product.name||"").slice(0,22),620,ry+70);
      c.fillStyle=dark?"#8CE9B8":"#17693F",c.font=`700 20px ${FS}`,c.fillText(sw.reasons?.[0]?.text||`Grade ${sw.to}`,620,ry+104);
    }else{
      bkBadge(c,g,84,ry+(rowH-66)/2,66,FD);
      c.fillStyle=fg,c.font=`700 29px ${FD}`,c.fillText(String(prod.name||"").slice(0,34),170,ry+58);
      c.fillStyle=sub,c.font=`600 21px ${FS}`,c.fillText([prod.brand?.split(",")[0],prod.quantity,g==="A"?`✓ ${t("Already the top grade")}`:""].filter(Boolean).join(" · "),170,ry+94);
    }
  });
  let footY=H-(isStory?210:108);
  c.fillStyle=dark?"#6CE0A6":"#0A5C3C",c.font=`800 26px ${FS}`,c.fillText(lnk.replace(/^https?:\/\//,"").replace(/\?.*$/,""),64,footY+36);
  c.fillStyle=sub,c.font=`500 21px ${FS}`,c.fillText(t("Open link in FoodScan to import this basket & compare healthier swaps · Free, no account"),64,footY+70);
  return new Promise(res=>cv.toBlob(res,"image/png"));
}

function ge(h,i={}){let c=new AbortController;i.signal?.addEventListener("abort",()=>c.abort(),{once:!0});let l=new Map,r=new Set,b=new Map,p=!1,w=!1,T=null,x=!1,tt="",C=qt(location.hash),A=C.codes,R=!1,M="",P=0,lt=null,L=new Set,N=()=>T??=_t(),D=()=>N().map(a=>a.product),B=a=>N().find(e=>e.barcode===a)?.product||null,O=()=>Object.fromEntries([...l].filter(([,a])=>a.status==="better").map(([a,e])=>[a,e.pick])),Jt=()=>W(".ws",h),ut=()=>A.length||M||C.invalid||C.truncated?n`<section class="card shared-import" aria-labelledby="shared-title"><h2 id="shared-title">${t("Shared product list")}</h2>
    <p>${t("Importing fetches public barcode records and saves them on this device. Your personal rules are not shared.")}</p>
    <p class="small">${_(A.length,"{n} product ready to import","{n} products ready to import")}${C.invalid||C.truncated?n` · ${t("Invalid codes were excluded. At most 20 products are accepted per link.")}`:""}</p>
    <p role="status">${M}</p>
    <div class="row-actions">${A.length?n`<button type="button" class="btn btn--primary" data-act="wk:import-list" ${R||P>Date.now()?U("disabled"):""}>${R?t("Importing…"):t("Import products")}</button>`:""}<button type="button" class="btn btn--ghost" data-act="wk:dismiss-list" ${R?U("disabled"):""}>${t("Dismiss")}</button></div></section>`:"";function $(){let a=W("#ws-summary",h);if(!a)return;let e=D(),o=Rt(e),s=Object.keys(O()).filter(m=>e.some(j=>j.barcode===m)),d=e.filter(m=>G(m)&&!l.has(m.barcode)),f=e.filter(m=>l.has(m.barcode)),y=f.filter(m=>l.get(m.barcode).status==="loading").length,S=f.filter(m=>l.get(m.barcode).status==="error").length,I;p||y?I=t("Looking… {done} of {n} checked",{done:f.length-y,n:f.length}):s.length?I=_(s.length,"{n} better choice found. Swap it in, or compare it first.","{n} better choices found. Swap them in one at a time, or all at once."):S?I=_(S,"{n} lookup didn’t finish: the food database may be busy. Try again.","{n} lookups didn’t finish: the food database may be busy. Try again."):d.length?I=_(d.length,"{n} product could have a better choice. Let FoodScan look.","{n} products could have a better choice. Let FoodScan look."):f.length?I=t("No higher grade found for the rest of your list right now."):I=e.length&&o.counts.A===o.graded&&o.graded?t("Every graded product here is already an A."):t("Nothing here has a grade to improve on yet.");let q=s.length&&!p&&!y?Nt(e,O()):null,ft=q?e.filter(m=>O()[m.barcode]).slice(0,3).map(m=>{let j=O()[m.barcode];return n`<li>${rt(j.from,j.to)}<span><b>${j.product.name}</b> ${t("instead of {name}",{name:m.name})}${j.reasons[0]?n` <small>· ${j.reasons[0].text}</small>`:""}</span></li>`}):[],mt=$t().recheckedAt,at=It(mt),Gt=jt({count:e.length,checkedAt:mt,oldest:Math.min(...e.map(m=>m.fetchedAt||0))});E(a,n`<div class="ws__top"><span class="eyebrow">${u("layers",14)}${t("Your workspace")}</span><span class="ws__count">${_(e.length,"{n} product","{n} products")}</span></div>
      ${renderBasketScoreRing(o,q,s.length>0)}${it(o,{label:`${t("Grades in your workspace")}: ${ct(o,t("No grade"))}`})}
      ${q?n`<div class="ws__after"><span class="ws__arrow" aria-hidden="true">${u("down",16)}</span><span class="ws__aftertext">${t("After swapping")}</span></div>${it(q,{label:`${t("After swapping")}: ${ct(q,t("No grade"))}`})}`:""}
      ${ft.length?n`<ul class="ws__plan" aria-label="${t("Swaps ready to make")}">${ft}</ul>`:""}${(()=>{let sv=calcBasketSavings(e,O());return sv.pills.length?n`<div class="chips">${sv.pills.map(pl=>n`<span class="chip chip--good">${u("sparkle",13)}${pl}</span>`)}</div>`:""})()}
      <p class="ws__status" role="status">${I}</p>
      <p class="ws__recheck small ${Gt&&!x?"is-due":""}">${u("refresh",14)}<span>${x?t("Rechecking your list against the food database…"):tt||(at===null?t("Records change: recheck your list for new grades, missing values and better choices."):at===0?t("Rechecked today."):_(at,"Last rechecked {n} day ago.","Last rechecked {n} days ago."))}</span>${x?"":n`<button type="button" class="btn btn--ghost btn--xs" data-act="wk:recheck">${t("Recheck my list")}</button>`}</p>
      <div class="ws__actions">
        ${d.length||S?n`<button type="button" class="btn btn--primary" data-act="wk:find-all" ${p||y?U("disabled"):""}>${u("sparkle",18)}${p||y?t("Looking…"):S&&!d.length?t("Try again"):t("Find better choices")}</button>`:""}
        ${s.length>=2&&!p&&!y?n`<button type="button" class="btn btn--soft" data-act="wk:swap-all">${u("swap",18)}${t("Swap in all {n}",{n:s.length})}</button>`:""}
        ${e.length?n`<button type="button" class="btn btn--soft btn--sm" data-act="wk:share-list">${u("share",16)}${t("Share basket & swaps")}</button>${s.length?n`<button type="button" class="btn btn--soft btn--sm" data-act="wk:share-alt">${u("sparkle",16)}${t("Share alternative basket")}</button>`:""}<button type="button" class="btn btn--ghost btn--sm" data-act="wk:save-usual">${u("bookmark",16)}${t("Save as my usual shop")}</button>`:""}
        ${J().length?n`<button type="button" class="btn btn--soft btn--sm" data-act="wk:load-usual">${u("heart",16)}${t("Load my usual shop")}</button>`:""}
      </div>`)}function v(a){let e=h.querySelector(`.wk[data-code="${a}"]`),o=N().find(s=>s.barcode===a);!e||!o||E(e,Ht(o,{found:l,picked:r.has(a),checks:b}))}function et(){let a=W("#ws-tray",h);if(!a)return;let e=r.size;if(a.hidden=e===0,!e){a.textContent="";return}E(a,n`<span class="ws__traytext"><b>${e}</b> ${e===1?t("selected: pick one more to compare"):t("selected")}</span>
      <button type="button" class="btn btn--primary btn--sm" data-act="wk:compare" ${e<2?U("disabled"):""}>${u("columns",16)}${_(e,"Compare {n} product","Compare {n} products")}</button><button type="button" class="btn btn--soft btn--sm" data-act="wk:share-list">${u("share",16)}${t("Share selected")}</button>
      <button type="button" class="icon-btn" data-act="wk:clear" aria-label="${t("Clear selection")}">${u("x",18)}</button>`)}function F(){if(w)return;T=null;let a=N();for(let e of[...r])a.some(o=>o.barcode===e)||r.delete(e);for(let e of[...l.keys()])a.some(o=>o.barcode===e)||l.delete(e);for(let e of[...b.keys()])a.some(o=>o.barcode===e)||b.delete(e);if(!a.length){E(h,n`<div class="ws">${ut()}${Kt()}</div><div class="ws__tray" id="ws-tray" hidden></div>`);return}E(h,n`<div class="ws">${ut()}<section class="ws__summary card" id="ws-summary" aria-label="${t("Your workspace")}"></section>
      <ul class="ws__list">${a.map(e=>n`<li class="wk g-${z(e.product)||"none"} ${L.has(e.barcode)?"is-new":""}" data-code="${e.barcode}"></li>`)}</ul></div>
      <div class="ws__tray" id="ws-tray" hidden></div>`);for(let e of a)v(e.barcode);if($(),et(),L.size){let e=[...L];L.clear(),setTimeout(()=>{for(let o of e)h.querySelector(`.wk[data-code="${o}"]`)?.classList.remove("is-new")},1800)}}async function pt(a){let e=a.barcode;l.set(e,{status:"loading"}),v(e),$();let o;try{let s=await Mt(a,X(),{signal:c.signal,country:gt(X())}),d=s.status==="error"&&s.catalogue?{...s.catalogue,fallback:!0}:s,f=Lt(d),y=new Set(N().map(S=>S.barcode));o=f?y.has(f.product.barcode)?{status:"have",pick:f}:{status:"better",pick:f,res:d}:s.status==="error"?{status:"error"}:{status:"none"}}catch{if(c.signal.aborted)return;o={status:"error"}}w||(l.set(e,o),v(e),$())}async function ht(a){let e=a.filter(o=>!l.has(o.barcode)||["error","none"].includes(l.get(o.barcode).status));if(e.length){for(p=!0,$();e.length&&!c.signal.aborted;)await pt(e.shift());p=!1,w||$()}}async function bt(a){let e=l.get(a),o=B(a);if(e?.status!=="better"||!o||c.signal.aborted)return null;let s;try{s=(await Z(e.pick.product.barcode,{signal:c.signal})).product}catch{return w||(l.set(a,{status:"error"}),v(a),$()),"unverified"}if(c.signal.aborted)return null;let d=z(o),f=z(s),y=wt(s,X());if(!s||s.partial||!Number.isFinite(s.fetchedAt)||Date.now()-s.fetchedAt>864e5||!["none","clear"].includes(y.status)||!Q(d)||!Q(f)||nt[f]>=nt[d])return l.set(a,{status:"none"}),v(a),$(),"changed";r.delete(a)&&r.add(s.barcode),l.delete(a),L.add(s.barcode);let S=K(a,s);return S?{old:S,next:s,before:d,after:f}:(L.delete(s.barcode),null)}g("wk:swap",async a=>{a.disabled=!0;let e=await bt(a.dataset.arg);if(e){if(e==="unverified"){k(t("The current product could not be verified. Nothing was swapped."),{tone:"bad"});return}if(e==="changed"){k(t("That product changed: it no longer has a higher grade, so nothing was swapped."),{tone:"bad"});return}k(t("Swapped for {name}",{name:e.next.name}),{action:{label:t("Undo"),run:()=>{K(e.next.barcode,e.old.product)}}})}}),g("wk:swap-all",async a=>{a.disabled=!0;let e=Object.keys(O()),o=[];for(let s of e){let d=await bt(s);d&&typeof d=="object"&&o.push(d)}if(!o.length){k(t("That product changed: it no longer has a higher grade, so nothing was swapped."),{tone:"bad"});return}k(_(o.length,"Swapped {n} product","Swapped {n} products"),{action:{label:t("Undo"),run:()=>{for(let s of o.reverse())K(s.next.barcode,s.old.product)}}})}),g("wk:recheck",async()=>{if(x||p)return;x=!0,tt="",$();let a=N().map(s=>s.product),e=[],o={changed:0,same:0,other:0};for(let s of a){if(c.signal.aborted)break;b.set(s.barcode,{status:"checking"}),v(s.barcode);try{let{product:d}=await Z(s.barcode,{signal:c.signal}),f=Ft(s,d);b.set(s.barcode,{status:f.status,diff:f}),e.push(d),o[f.status]++}catch(d){if(c.signal.aborted)break;b.set(s.barcode,{status:["not_found","not_food"].includes(d?.code)?"gone":"error"}),o.other++}v(s.barcode)}if(x=!1,!(w||c.signal.aborted)){tt=t("Rechecked {n} products: {changed} changed, {same} unchanged, {other} not checked.",{n:a.length,...o}),e.length&&(yt({recheckedAt:Date.now()}),St(e)),$();for(let s of e)b.get(s.barcode)?.status==="changed"&&l.delete(s.barcode);ht(D().filter(G))}}),g("wk:find",a=>{let e=B(a.dataset.arg);e&&(l.delete(e.barcode),pt(e))}),g("wk:find-all",()=>ht(D().filter(G))),g("wk:select",a=>{let e=a.dataset.arg;if(r.has(e))r.delete(e);else if(r.size>=Pt){k(t("Compare up to four products at a time."));return}else r.add(e);v(e),et()}),g("wk:clear",()=>{let a=[...r];r.clear(),a.forEach(v),et()}),g("wk:compare",()=>{let a=[...r].map(B).filter(Boolean);a.length<2||V(t("Side by side"),n`${Dt(a)}${a.length===2?n`<div class="row-actions"><a class="btn btn--soft" href="#/compare/${a[0].barcode}/${a[1].barcode}" data-act="cmp:open" data-keep="true">${u("columns",18)}${t("Full comparison to share")}</a></div>`:""}`)}),g("wk:vs",a=>{let e=B(a.dataset.arg),o=l.get(a.dataset.arg);e&&o?.status==="better"&&V(t("Side by side"),Bt(e,o.pick))}),g("wk:remove",a=>{let e=a.dataset.arg,o=B(e),s=vt(e);s&&k(t("Removed {name} from your workspace",{name:o?.name||""}),{action:{label:t("Undo"),run:()=>{H(s.entry.product,s.index)}}})}),g("wk:save-usual",()=>{let a=xt(D());a&&(k(t("Saved {n} products as your usual shop",{n:a})),$())}),g("wk:load-usual",()=>{let a=J();if(a.length){for(let e of[...a].reverse())H(e,0)&&L.add(e.barcode);k(t("Loaded your usual shop ({n} products)",{n:a.length}))}}),g("wk:share-list",()=>{
  let items=r.size?D().filter(d=>r.has(d.barcode)):D();
  if(!items.length)return;
  if(items.length>dt){k(t("Share at most 20 products per link. Select a smaller set first."));return}
  let prof=X(),ctry=gt(prof),swaps={...O()};
  for(let prod of items){
    if(!swaps[prod.barcode]&&G(prod)){
      let catRes=yeBasketCat(prod,{status:"none",better:[],peers:[],biggest:null},prof,ctry),pick=Lt(catRes);
      if(pick)swaps[prod.barcode]=pick;
    }
  }
  let beforeMix=Rt(items),afterMix=Nt(items,swaps),swapCount=Object.keys(swaps).filter(code=>items.some(p=>p.barcode===code)).length,sav=calcBasketSavings(items,swaps);
  let origCodes=items.map(d=>d.barcode).filter(st),altCodes=items.map(d=>swaps[d.barcode]?.product?.barcode||d.barcode).filter(st);
  let baseUrl=`${location.origin}/#/choices?codes=${encodeURIComponent(origCodes.join(","))}`,altUrl=`${location.origin}/#/choices?codes=${encodeURIComponent(altCodes.join(","))}`;
  let shObj=makeBasketToken({path:"/choices",kind:"product",via:"basket"});
  shObj.url=baseUrl;
  let summaryTxt=swapCount?`${_(items.length,"My {n}-product grocery basket","My {n}-product grocery basket")} on FoodScan: ${ct(beforeMix,t("No grade"))} → ${ct(afterMix,t("No grade"))} after ${_(swapCount,"{n} healthier swap","{n} healthier swaps")}${sav.pills.length?` (${sav.pills.slice(0,2).join(", ")})`:""}!`:`${_(items.length,"My {n}-product grocery basket","My {n}-product grocery basket")} on FoodScan (${ct(beforeMix,t("No grade"))}).`;
  openBasketShare({
    heading:t("Share basket & swaps"),
    title:`FoodScan · ${t("Choice workspace")}`,
    text:summaryTxt,
    initialVariant:"post",
    swapLabel:t("Alt Basket"),
    onUrlForVariant:vFmt=>vFmt==="swap"&&swapCount?altUrl:baseUrl,
    hooks:[
      {id:"verdict",label:t("Basket + Swaps"),text:summaryTxt},
      {id:"story",label:t("Viral hook"),text:swapCount?`I audited my ${items.length}-item grocery basket on FoodScan and found ${swapCount} healthier swaps${sav.cubes>=2?` (cutting ~${sav.cubes} sugar cubes!)`:""}! 🛒✨ Tap to import the upgraded basket:`:`Check out my ${items.length}-item grocery basket audit on FoodScan! 🛒👇`},
      {id:"clean",label:t("Alt Basket link"),text:swapCount?`Import my upgraded ${items.length}-product healthier grocery basket on FoodScan:`:summaryTxt}
    ],
    share:shObj,
    filename:`FoodScan-Basket-${items.length}-items.png`,
    makeImage:({variant:vFmt="post"}={})=>makeBasketCard(items,swaps,beforeMix,afterMix,{variant:vFmt,link:vFmt==="swap"&&swapCount?altUrl:baseUrl})
  });
}),g("wk:share-alt",()=>{
  let items=r.size?D().filter(d=>r.has(d.barcode)):D();
  if(!items.length)return;
  if(items.length>dt){k(t("Share at most 20 products per link. Select a smaller set first."));return}
  let prof=X(),ctry=gt(prof),swaps={...O()};
  for(let prod of items){
    if(!swaps[prod.barcode]&&G(prod)){
      let catRes=yeBasketCat(prod,{status:"none",better:[],peers:[],biggest:null},prof,ctry),pick=Lt(catRes);
      if(pick)swaps[prod.barcode]=pick;
    }
  }
  let beforeMix=Rt(items),afterMix=Nt(items,swaps),swapCount=Object.keys(swaps).filter(code=>items.some(p=>p.barcode===code)).length,sav=calcBasketSavings(items,swaps);
  let origCodes=items.map(d=>d.barcode).filter(st),altCodes=items.map(d=>swaps[d.barcode]?.product?.barcode||d.barcode).filter(st);
  let baseUrl=`${location.origin}/#/choices?codes=${encodeURIComponent(origCodes.join(","))}`,altUrl=`${location.origin}/#/choices?codes=${encodeURIComponent(altCodes.join(","))}`;
  let shObj=makeBasketToken({path:"/choices",kind:"product",via:"basket"});
  shObj.url=swapCount?altUrl:baseUrl;
  let summaryTxt=swapCount?`Import my upgraded ${items.length}-product healthier grocery basket on FoodScan (${ct(beforeMix,t("No grade"))} → ${ct(afterMix,t("No grade"))}${sav.pills.length?`, ${sav.pills.slice(0,2).join(", ")}`:""}):`:`${_(items.length,"My {n}-product grocery basket","My {n}-product grocery basket")} on FoodScan (${ct(beforeMix,t("No grade"))}).`;
  openBasketShare({
    heading:t("Share alternative basket"),
    title:`FoodScan · ${t("Share alternative basket")}`,
    text:summaryTxt,
    initialVariant:"swap",
    swapLabel:t("Alt Basket"),
    onUrlForVariant:vFmt=>vFmt==="swap"&&swapCount?altUrl:baseUrl,
    hooks:[
      {id:"verdict",label:t("Alt Basket link"),text:summaryTxt},
      {id:"story",label:t("Viral hook"),text:swapCount?`I upgraded my ${items.length}-item grocery basket on FoodScan with ${swapCount} healthier swaps! 🛒✨ Tap to import my healthier alternative basket:`:`Check out my ${items.length}-item grocery basket on FoodScan! 🛒👇`},
      {id:"clean",label:t("Basket + Swaps"),text:summaryTxt}
    ],
    share:shObj,
    filename:`FoodScan-Alternative-Basket-${items.length}-items.png`,
    makeImage:({variant:vFmt="swap"}={})=>makeBasketCard(items,swaps,beforeMix,afterMix,{variant:vFmt,link:vFmt==="swap"&&swapCount?altUrl:baseUrl})
  });
}),g("wk:dismiss-list",()=>{R||(A=[],M="",C.invalid=0,C.truncated=!1,Ut(),F())}),g("wk:import-list",async()=>{if(R||P>Date.now())return;R=!0;let a=0,e=0;F();for(let o of[...A]){if(c.signal.aborted)break;let s=()=>{A=A.filter(d=>d!==o)};if(N().some(d=>d.barcode.padStart(14,"0")===o.padStart(14,"0"))){s();continue}try{let{product:d}=await Z(o,{signal:c.signal});d&&(H(d,0)?a++:e++,s(),T=null)}catch(d){if(c.signal.aborted)break;if(e++,["not_found","not_food","invalid_barcode"].includes(d?.code)&&s(),["rate_limited","local_rate_limited","upstream_busy"].includes(d?.code)){P=Date.now()+Math.max(1,d.retryAfter||60)*1e3,lt=setTimeout(()=>{w||F()},P-Date.now());break}}M=t("Imported {n} product records.",{n:a}),F()}R=!1,!w&&(M=t("Imported {n} product records.",{n:a})+(e?` ${t("Some records could not be loaded. Retry remaining products when available.")}`:""),A.length||Ut(),T=null,F())});let zt=kt(a=>{["saved","import","clear","usual"].includes(a)&&(T=null,F())});return F(),location.hash.includes("share=1")&&setTimeout(()=>{try{history.replaceState(null,"","#/choices")}catch{};let btn=h.querySelector('[data-act="wk:share-list"]');btn&&btn.click()},180),()=>{w=!0,c.abort(),clearTimeout(lt),zt()}}export{ge as mountWorkspace,qt as sharedCodes};
