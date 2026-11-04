import {nutrientDelta} from './match-policy-v7540.mjs';
import {comparableMethods} from './recommendations-core-v8100.mjs';
import {FAMILY_LABELS} from './comparison-guards-v7540.mjs';
import {balanceVector} from "./balance-view-v7540.mjs";
import { a as J, c as Z } from "./chunk-57E5ZLYU-v8300.js";
import { a as P, b as I, c as X, j } from "./chunk-AHTU2MHF-v8300.js";
import { b as Q } from "./chunk-IO4NLMGT-v7540.js";
import { g as aa } from "./chunk-LGF5RK5L-v8300.js";
import { b as H } from "./chunk-BIWX2LG4-v8300.js";
import { b as V, c as G, d as K, e as Y } from "./chunk-4SO6OQI3-v8300.js";
import { b as z, d as U, h as W, k as T, l as A, n as x, o as O, p as b, q as B, s as C, t as R, w as E } from "./chunk-2OB4V521-v8300.js";
import { c as q, l as k } from "./chunk-TTXUOT36-v8300.js";
import { c as t, f as w, l as i } from "./chunk-4O7IN74N-v8300.js";
import { b as D, d as e, e as S, g as f, m as g, r as _, s as M } from "./chunk-6K6QREZY-v8300.js";
var ea = { down: "alert", up: "check", note: "info", minor: "minus" };
var sa = { low: "good", medium: "warn", high: "bad" };
function ta(a, s) { return t`${J(a,s,{variant:"report",rootClass:"gradecard",showReasons:!1})}${a.catalogueSnapshot?t`<p class="note catalogue-record">${i("info",16)}<span>${e("Catalogue snapshot from {date}. This is saved source data, not a live product check. Compare the nutrition and ingredients with your package.",{date:new Intl.DateTimeFormat(D()==='el'?'el-GR':'en-GB',{dateStyle:'medium'}).format(a.catalogueSnapshot.exportedAt)})}</span></p>`:""}`; }
function na(a) { let s = I(a); if (!s.rows.length)
    return ""; let o = Object.fromEntries(s.rows.map(l => [l.key, l])), n = (l, p, u, c, fill = 0) => t `<div class="stat ${c && sa[c] ? `stat--${sa[c]}` : ""}"><b>${p === null ? "—" : p > 0 && p < .01 ? "<0.01" : _(p, p < 1 ? 2 : p >= 100 ? 0 : 1)}<small>${u}</small></b><span>${c && sa[c] ? t `<i class="dot dot--${sa[c]}"></i>` : ""}${l}</span><i class="stat__bar" aria-hidden="true"><s data-css="--w:${w(fill)}"></s></i></div>`, r = { sugars: e("Sugars"), saturatedFat: e("Sat. fat"), salt: e("Salt") }, kcalVal = g(a.nutrition.kcal) ? Math.round(a.nutrition.kcal) : null, kcalFill = kcalVal !== null ? Math.min(100, Math.round(kcalVal / 6.5)) : 0, sugVal = o.sugars?.value, cubesCount = g(sugVal) && sugVal >= 8 ? Math.round(sugVal / 4) : 0; return t `<div class="hero__stats" role="group" aria-label="${e("Key values {unit}", { unit: s.unit })}">${n(e("Energy"), kcalVal, " kcal", "", kcalFill)}${["sugars", "saturatedFat", "salt"].map(l => o[l] ? n(r[l], o[l].value, " g", s.bands && !(l === "salt" && o[l].value < .01) ? o[l].band : "", o[l].fill || 0) : "")}${cubesCount >= 2 ? t `<div class="hero__cubes-bar">${R(sugVal)}<span>${S(cubesCount, "≈ {n} sugar cube per 100 g", "≈ {n} sugar cubes per 100 g")}</span></div>` : ""}<small class="hero__unit">${s.unit}</small></div>`; }
function da(a) {
    if (!a.label || !a.max)
        return t `<li class="why why--${a.tone} why--fact"><i>${i(ea[a.tone] || "info", 16)}</i><span class="why__main"><b>${a.factLabel||a.text}</b>${a.factDetail?t`<small class="why__factamount">${a.factDetail}</small>`:""}</span></li>`;
    let s = a.side === "favour" ? e("In its favour") : a.points >= a.max ? e("Maximum points against") : e("Counts against it");
    return t `<li class="why why--${a.tone} why--split"><i>${i(ea[a.tone] || "info", 16)}</i>
    <span class="why__main" aria-hidden="true"><b>${a.label}</b>${a.amount ? t `<span class="why__amt">${a.amount}</span>` : ""}<small>${s}</small></span>
    <span class="why__pts" aria-hidden="true"><span class="why__meter"><s data-css="--w:${w(100 * a.points / a.max)}"></s></span><em>${a.side === "favour" ? "+" : ""}${a.points}<small>/${a.max}</small></em></span>
    <span class="sr">${a.text}</span></li>`;
}
function Ya(a, s) {
    let o = s.quality || T(a), n = s.anatomy ? s.anatomy.why.filter(p => p.tone !== "note").slice(0, 3) : X(a).slice(0, 3).map(p => ({ tone: p.tone === "good" ? "up" : p.tone === "watch" ? "down" : "note", text: `${p.text}: ${p.detail}.`, factLabel:p.text, factDetail:p.detail })), r = t `<div class="hero__prod"><span class="hero__img">${z(a, { size: "lg", alt: e("{name} package", { name: a.name }) })}</span><div class="hero__name"><small class="eyebrow">${a.brand ? a.brand.split(",")[0] : e("Food report")}</small><h1 id="product-title">${a.name}</h1><p>${[a.quantity, a.barcode].filter(Boolean).join(" · ")}</p></div></div>`;
    if (s.grade)
        return t `<article class="hero g-${s.grade}" aria-labelledby="product-title">${r}
      ${ta(a, s)}
      ${na(a)}
      ${n.length ? t `${!s.anatomy?t`<h2 class="hero__insight-title">${e("Label highlights")}</h2>`:""}<ul class="hero__why" aria-label="${e(s.anatomy?"Why this grade":"Label highlights")}">${n.map(da)}</ul>` : ""}
      <div class="hero__foot">${B(a.nova)}${o.unnamed ? t `<a class="link" href="https://world.openfoodfacts.org/cgi/product.pl?type=edit&amp;code=${a.barcode}" target="_blank" rel="noopener noreferrer">${e("Add the name on Open Food Facts")} ${i("external", 13)}</a>` : ""}<button type="button" class="link" data-act="how-grade">${e("How is this decided?")}</button></div>
      ${s.status === "estimated" ? t `<p class="hero__caveat">${i("info", 14)}<span>${s.reproducedSourceGrade?s.caveats[0]:e("This grade is calculated by FoodScan, not published by the source. “Why this grade” below shows the working and every assumption.")}</span></p>` : s.caveats.length ? t `<p class="hero__caveat">${i("info", 14)}<span>${s.caveats[0]}</span></p>` : ""}</article>`;
    let l = s.status === "withheld";
    return t `<article class="hero hero--none ${l ? "is-held" : ""}" aria-labelledby="product-title">${r}
    ${ta(a, s)}
    ${na(a)}
    ${!l&&n.length?t`<h2 class="hero__insight-title">${e("Label highlights")}</h2><ul class="hero__why" aria-label="${e("Label highlights")}">${n.map(da)}</ul>`:""}
    ${l ? t `<ul class="hero__why">${s.reasons.slice(0, 4).map(p => t `<li class="why why--down"><i>${i("alert", 16)}</i><span>${p}</span></li>`)}</ul>` : ""}
    <div class="hero__foot">${B(a.nova)}${b(o.short, l ? "warn" : "neutral", l ? "alert" : "info")}${l || ["incomplete", "range"].includes(s.estimate?.reason) ? t `<a class="link" href="https://world.openfoodfacts.org/cgi/product.pl?type=edit&amp;code=${a.barcode}" target="_blank" rel="noopener noreferrer">${l ? e("Fix it on Open Food Facts") : e("Add the missing values on Open Food Facts")} ${i("external", 13)}</a>` : t `<button type="button" class="link" data-act="how-grade">${e("Why is there no grade?")}</button>`}</div></article>`;
}
function Qa(a) { return a.status === "none" ? "" : a.status === "conflict" ? t `<section class="banner banner--bad" role="alert"><i>${i("alert", 22)}</i><div><h2>${e("Not a match for you")}</h2><ul>${a.conflicts.map(s => t `<li>${s.text}</li>`)}</ul>${a.notes.map(s => t `<p>${s}</p>`)}</div><a class="link" href="#/me">${e("Edit")}</a></section>` : a.status === "unconfirmed" ? t `<section class="banner banner--warn" role="status"><i>${i("info", 22)}</i><div><h2>${e("We can’t fully confirm this for you")}</h2>${a.notes.map(s => t `<p>${s}</p>`)}</div><a class="link" href="#/me">${e("Edit")}</a></section>` : t `<section class="banner banner--good" role="status"><i>${i("check", 22)}</i><div><h2>${e("Matches your preferences")}</h2><p>${e("Nothing in the data conflicts with your allergens or diet. Always check the pack.")}</p></div></section>`; }
var Ja = () => t `<section class="card card--swap" aria-busy="true" aria-live="polite"><header class="card__head"><h2>${i("sparkle", 18)}${e("Finding a better choice…")}</h2></header><div class="swap swap--skel"><span class="skel skel--img"></span><span class="prow__text"><i class="skel skel--line"></i><i class="skel skel--line short"></i></span></div><p class="muted small">${e("Checking the included catalogue first. No live food API is needed for catalogue matches.")}</p></section>`, Xa = () => t `<section class="card card--swap" aria-live="polite"><header class="card__head"><h2>${i("sparkle", 18)}${e("Better choices")}</h2></header><div class="inline-state"><p>${e("The suggestions could not be drawn just now. This is a display problem, not a problem with the product.")}</p>${C(e("Try again"), "alt-retry", { kind: "soft", ic: "refresh" })}</div></section>`, pa = a => a.allergens?.added?.length ? t `<span class="chip chip--warn">${i("wheat", 13)}${e("Contains {what}: not in yours", { what: a.allergens.added.map(a.allergens.label).join(", ").toLowerCase() })}</span>` : a.allergens?.unknown && !a.product?.partial ? t `<span class="chip chip--neutral">${i("info", 13)}${e("Allergens not checked: no ingredient list")}</span>` : "", ha = a => t `${a.reasons.map(s => t `<span class="chip chip--good">${i("check", 13)}${s.text}</span>`)}${a.tradeoffs.map(s => t `<span class="chip chip--warn" title="${s.detail}">${i("alert", 13)}${e("but {what}", { what: s.text })}</span>`)}${pa(a)}`, ua = (a, s) => !s || a.local === null || a.local === void 0 ? "" : a.local ? t `<span class="swap__where is-local">${i("flag", 13)}${e("Source lists {country}", { country: k(s) })}</span>` : t `<span class="swap__where">${i("flag", 13)}${e("Not listed in {country}", { country: k(s) })}</span>`, ma = (a, s) => t `<button type="button" class="icon-btn swap__save" data-act="r:save-swap" data-arg="${a.barcode}" aria-pressed="${String(s)}" aria-label="${s ? e("Remove {name} from your workspace", { name: a.name }) : e("Add {name} to your workspace", { name: a.name })}">${i("bookmark", 19)}</button>`, $a = a => a.level >= 2 && a.via ? t `<small class="muted">${D() === "el" ? e("Broader match") : `${e("Broader match")} · ${a.via}`}</small>` : "", oa = { "united-kingdom": ["amazon.co.uk", ""], ireland: ["amazon.co.uk", ""], germany: ["amazon.de", ""], austria: ["amazon.de", ""], switzerland: ["amazon.de", ""], greece: ["amazon.de", ""], cyprus: ["amazon.de", ""], luxembourg: ["amazon.de", ""], "czech-republic": ["amazon.de", ""], denmark: ["amazon.de", ""], netherlands: ["amazon.nl", ""], belgium: ["amazon.com.be", ""], france: ["amazon.fr", ""], italy: ["amazon.it", ""], spain: ["amazon.es", ""], portugal: ["amazon.es", ""], sweden: ["amazon.se", ""], poland: ["amazon.pl", ""], turkey: ["amazon.com.tr", ""], "united-arab-emirates": ["amazon.ae", ""], "saudi-arabia": ["amazon.sa", ""], egypt: ["amazon.eg", ""], india: ["amazon.in", ""], japan: ["amazon.co.jp", ""], australia: ["amazon.com.au", ""], "new-zealand": ["amazon.com.au", ""], singapore: ["amazon.sg", ""], canada: ["amazon.ca", ""], mexico: ["amazon.com.mx", ""], brazil: ["amazon.com.br", ""], "united-states": ["amazon.com", "papalex-20"] }, ga = (a, s) => { let [o, n] = oa[s] || oa["united-states"], r = encodeURIComponent(`${(a.brand || "").split(",")[0]} ${a.name || ""}`.trim()); return `https://www.${o}/s?k=${r}${n ? `&tag=${encodeURIComponent(n)}` : ""}`; };
function ia(a, s, { country: o = "", isSaved: n = () => !1 } = {}) {
    let r = a.product;
    return t `<div class="swap g-${a.to}"><a class="swap__link" href="#/p/${r.barcode}"><span class="swap__top">${O(a.from, a.to)}<small class="swap__label">${s}</small></span>
    <span class="swap__main"><span class="swap__img">${z(r, { size: "md" })}</span><span class="swap__body"><b>${r.name}</b><span class="swap__brand">${[r.brand?.split(",")[0], r.quantity].filter(Boolean).join(" · ") || e("Brand not listed")}</span>${$a(a)}</span><i class="swap__go">${i("right", 18)}</i></span>
    <span class="swap__chips">${a.marginal ? b(e("Slightly higher grade, similar numbers"), "neutral") : ""}${ha(a)}</span></a>
    <div class="swap__foot"><span class="swap__facts">${ua(a, o)}${a.verified ? t `<span class="swap__checked">${i("shield", 13)}${e("Source record assessed")}${a.gradeMethod?` · ${a.gradeMethod.replace('-calculated','')}`:` · ${e("Source method not reported")}`}${a.gradeStatus==="estimated"?` · ${e("Calculated by FoodScan")}`:""}</span>` : ""}</span>
      <button type="button" class="btn btn--primary btn--xs" data-act="r:quick-swap" data-arg="${r.barcode}" aria-label="${e("Swap into basket")}: ${r.name}">${i("sparkle", 14)}${e("Swap into basket")}</button><button type="button" class="btn btn--soft btn--xs" data-act="r:compare" data-arg="${r.barcode}" aria-label="${e("Compare side by side")}: ${r.name}">${i("swap", 15)}${e("Compare")}</button><a class="btn btn--ghost btn--xs" href="${ga(r, o)}" target="_blank" rel="noopener noreferrer sponsored" data-keep="true" aria-label="${e("Search Amazon")}: ${r.name}">${e("Search Amazon")} ${i("external", 13)}</a></div>${ma(r, n(r.barcode))}
    <p class="swap__disclosure">${e("Search results, not verified stock or exact matches. Amazon.com affiliate link: I earn from qualifying purchases.")}</p></div>`;
}
var F = (a, s, o) => t `<li class="prow prow--verified"><a class="prow__link" href="#/p/${a.product.barcode}"><span class="prow__img">${z(a.product, { size: "sm" })}</span><span class="prow__text"><b>${a.product.name}</b><small>${[a.product.brand?.split(",")[0], a.reasons[0]?.text, o && a.local ? e("source lists {country}", { country: k(o) }) : ""].filter(Boolean).join(" · ")}</small></span>${s}</a><div class="peer-evidence">${pa(a)}${a.tradeoffs?.map(v=>t`<span class="chip chip--warn">${v.text}</span>`)}<small>${e("per 100 {unit}",{unit:a.product.basis||"g"})} · ${e("Source record assessed")} · ${a.gradeMethod?`Nutri-Score ${a.gradeMethod.replace('-calculated','')}`:e("Source method not reported")}${a.gradeStatus==="estimated"?` · ${e("Calculated by FoodScan")}`:""}</small></div></li>`;

function catalogueNote(a) {
 const c=a.catalogue;if(!c||!Number.isFinite(c.exportedAt)||!Number.isFinite(c.count))return "";
 const date=new Intl.DateTimeFormat(D()==='el'?'el-GR':'en-GB',{dateStyle:'medium'}).format(c.exportedAt);
 return t`<details class="market-evidence"><summary>${i("info",16)}<span>${e("Included catalogue")} <small>${e("Snapshot {date}",{date})}</small></span></summary><p>${e("{n} source-listed products \u00b7 snapshot {date}",{n:c.count.toLocaleString(),date})}</p><p>${e("Includes Greek brands and imports. Coverage is not complete and supermarket stock is not verified. Check the current package.")}</p>${c.marketCoverage==='listed-subset'?t`<p>${e("For this market, only records explicitly listed there by the source are used. This is a subset, not a complete national catalogue.")}</p>`:""}<p>${e("{n} matching source records assessed",{n:a.candidateCount||0})}. ${e("Source dates are not physical-package verification.")}</p></details>`;
}
function nutritionCards(a,base) {
 const labels={sugars:e("Sugars"),saturatedFat:e("Sat. fat"),salt:e("Salt")};
 const number=x=>x>0&&x<0.01?'<0.01':new Intl.NumberFormat(D()==='el'?'el-GR':'en-GB',{maximumFractionDigits:2}).format(x);
 return t`<div class="nutrition-options">${(a.nutritionBetter||[]).map(x=>t`<article class="nutrition-option">
 <a class="nutrition-option__title" href="#/p/${x.product.barcode}">${z(x.product,{size:"sm",alt:""})}<span><small>${x.product.brand}</small><strong>${x.product.name}</strong><small>${x.product.quantity}</small></span></a>
 <ul>${x.improvements.map(n=>t`<li><strong>${e("{n}% less {nutrient}",{n:n.percent,nutrient:labels[n.key]})}</strong><span>${number(n.from)} → ${number(n.to)} g / 100 ${x.basis}</span></li>`)}</ul>
 ${x.product.stores?t`<p class="small muted">${e("Retailers named by the source")}: ${x.product.stores}. ${e("Stock not checked.")}</p>`:""}
 <div class="row-actions row-actions--wrap"><a class="btn btn--soft" href="#/p/${x.product.barcode}">${e("Open its report")}</a><a class="btn btn--ghost" href="#/compare/${base.barcode}/${x.product.barcode}" data-act="cmp:open" data-keep="true">${e("Compare")}</a></div>
 </article>`)}</div>`;
}

function catalogueRecovery(a) {
 const c=a.catalogue;
 if(!c)return "";
 if(c.status==='unsupported')return t`<p class="note">${e("The bundled catalogue covers Greece. Live search is needed for your selected market.")}</p>`;
 if(c.status==='expired')return t`<p class="note" role="status">${e("This catalogue snapshot needs an update. It is not used for new recommendations.")}</p>`;
 if(c.status==='unavailable')return t`<p class="note" role="status">${e("The bundled catalogue could not load. Check your connection and reload the latest app; this is separate from the live food API.")}</p>`;
 return c.status==='partial'?t`<p class="note" role="status">${e("Some catalogue files could not load. Comparisons from the available files remain visible.")}</p>`:"";
}
function categoryPicker(a) {
 return t`<div class="catalogue-picker"><label for="alt-family">${e("Choose the food category to compare")}</label><div class="catalogue-picker__row"><select id="alt-family" aria-describedby="alt-family-note"><option value="">${e("Select a food category")}</option>${Object.entries(FAMILY_LABELS).map(([id,label])=>t`<option value="${id}" ${a.plan?.family===id?t`selected`:""}>${e(label)}</option>`)}</select><button type="button" class="btn btn--primary" data-act="alt-category">${e("Find catalogue choices")}</button></div><p class="small muted" id="alt-family-note">${e("Your selection guides comparisons only. It does not change the product grade or publish your data.")}</p></div>`;
}
function comparisonCards(a,base) {
 const keys=[['sugars','Sugars'],['saturatedFat','Sat. fat'],['salt','Salt']];
 const known=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 const amount=x=>!known(x)?e('Not reported'):(x>0&&x<.01?'<0.01':new Intl.NumberFormat(D()==='el'?'el-GR':'en-GB',{maximumFractionDigits:2}).format(x))+' g';
 const delta=(from,to)=>{
  if(base.basisSource==='assumed')return t`<small class="fact-delta fact-delta--unknown">${e('Basis unconfirmed')}</small>`;
  if(!known(from)||!known(to))return t`<small class="fact-delta fact-delta--unknown">${e('Not comparable')}</small>`;
  const d=nutrientDelta(from,to);
  if(d.kind==='same'||d.kind==='rounded')return t`<small class="fact-delta fact-delta--same">${e(d.kind==='same'?'Same amount':'Same at shown precision')}</small>`;
  return t`<small class="fact-delta fact-delta--${d.kind}"><span aria-hidden="true">${d.kind==='higher'?'\u2191':'\u2193'}</span> ${e(d.kind==='higher'?'Higher by {amount}':'Lower by {amount}',{amount:amount(d.amount)})}</small>`;
 };
 return t`${base.basisSource==='assumed'?t`<p class="note comparison-unit-note">${e('Your record does not confirm g or ml. Its values are shown as reported per 100; numerical differences are not calculated.')}</p>`:''}<div class="nutrition-options comparison-options">${(a.comparisonFoods||[]).map(x=>t`<article class="nutrition-option comparison-option">
 <a class="nutrition-option__title" href="#/p/${x.product.barcode}">${z(x.product,{size:"sm",alt:""})}<span><small class="comparison-brand">${x.product.brand}</small><strong>${x.product.name}</strong><small>${x.product.quantity}</small></span><span class="comparison-open" aria-hidden="true">${i('right',18)}</span></a>
 <p class="comparison-kind">${i('columns',14)} ${e('Same food type')} <span>${e('Comparison only')}</span></p>
 <table class="catalogue-facts"><caption>${base.basisSource==='assumed'?e('Per 100 - confirm your label unit'):e("Per {unit}",{unit:'100 '+x.basis})}</caption><thead><tr><th scope="col">${e('Label fact')}</th><th scope="col">${e('Your food')}</th><th scope="col">${e('This food')}</th></tr></thead><tbody>${keys.map(([key,label])=>t`<tr><th scope="row">${e(label)}</th><td>${amount(base.nutrition?.[key])}</td><td><strong>${amount(x.product.nutrition?.[key])}</strong>${delta(base.nutrition?.[key],x.product.nutrition?.[key])}</td></tr>`)}</tbody></table>
 <div class="row-actions row-actions--wrap comparison-actions"><a class="btn btn--soft" href="#/p/${x.product.barcode}">${i('info',16)} ${e('Open its report')}</a><a class="btn btn--primary" href="#/compare/${base.barcode}/${x.product.barcode}" data-act="cmp:open" data-keep="true">${i('columns',16)} ${e('Compare')}</a></div>
 <p class="comparison-safety">${e('Differences are label facts, not an overall health ranking. Check allergens on both packs.')}</p>
 </article>`)}</div>`;
}
function Za(a, s, { isSaved: o = () => !1, held: n = !1 } = {}) {
    const baseGrade=A(s).grade;
    if(!a.better?.length&&!a.peers?.length&&a.nutritionBetter?.length)a={...a,status:'nutrition'};
    else if(!a.better?.length&&!a.peers?.length&&!a.nutritionBetter?.length&&a.comparisonFoods?.length)a={...a,status:'compare'};
    const eligible=item=>item?.verified===true&&!item.product?.partial&&A(item.product).grade===item.to&&(!a.country||item.product.countries?.includes(`en:${a.country}`))&&
      (!a.country||(item.product.countries||[]).includes(`en:${a.country}`));
    a={...a,better:(a.better||[]).filter(eligible),peers:(a.peers||[]).filter(eligible),biggest:eligible(a.biggest)?a.biggest:null};
    if(a.status==="better"){a.better=a.better.filter(item=>U.indexOf(item.to)<U.indexOf(baseGrade)&&comparableMethods(A(s),A(item.product)));if(!a.better.length)a.status="none";}
    if(a.status==="top"){a.peers=a.peers.filter(item=>item.to==="A");if(baseGrade!=="A")a.status="none";}
    const retryAt=a.error?.retryAt||((a.error?.retryAfter||0)>0?Date.now()+a.error.retryAfter*1000:0);
    const wait=Math.max(0,Math.ceil((retryAt-Date.now())/1000));
    const retry=t`<button type="button" class="btn btn--soft" data-act="alt-retry" data-retry-at="${retryAt}" ${wait?t`disabled aria-disabled="true"`:""}>${i("refresh",18)}<span data-retry-label>${wait?e("Check again in {s}s",{s:wait}):e("Check again")}</span></button>`;
    const controls=t`<div class="market-controls"><span>${e("Market")}: <b>${a.country?k(a.country):e("All countries")}</b> <a href="#/me">${e("Change")}</a></span><div class="row-actions row-actions--wrap">${a.hasMore?C(e("Check more products"),"alt-more",{kind:"soft",ic:"search"}):(a.savedChecks||a.catalogue)&&!a.partialSearch?C(e("Check live choices"),"alt-live",{kind:"soft",ic:"search"}):""}${a.country?C(e("Search other markets"),"alt-worldwide",{kind:"ghost",ic:"flag"}):C(e("Use my market"),"alt-local",{kind:"ghost",ic:"flag"})}</div></div>`;
    let r = a.country || "", l = { country: r, isSaved: o };
    if(a.status==='category')return t`<section class="card card--swap" aria-labelledby="swap-title"><header class="card__head"><h2 id="swap-title">${i('sparkle',18)}${e('Find comparable foods')}</h2></header><p>${e("This record has no reliable food category. Choose one to search the included catalogue without waiting for the food API.")}</p>${categoryPicker(a)}${catalogueNote(a)}${catalogueRecovery(a)}${controls}</section>`;
    if(a.status==='compare')return t`<section class="card card--swap" aria-labelledby="swap-title"><header class="card__head"><h2 id="swap-title">${i('columns',18)}${e('Other foods to compare')}</h2><span class="card__note">${e('Not a higher-grade claim')}</span></header><p class="small">${e("No clearly better match passed all checks. These same-category foods are shown for comparison, not labelled healthier. Compare the facts and check allergens on both packs.")}</p>${comparisonCards(a,s)}${catalogueNote(a)}${catalogueRecovery(a)}${a.partialSearch?t`<p class="note">${e('Live search is unavailable. Catalogue comparisons remain available.')}</p>`:""}${controls}</section>`;
    if(a.status==='nutrition'&&a.nutritionBetter?.length) return t`<section class="card card--swap" aria-labelledby="swap-title"><header class="card__head"><h2 id="swap-title">${i("sliders",18)}${e("Nutrient comparisons")}</h2><span class="card__note">${e("Nutrition comparison")}</span></header><p class="small">${e("These comparable foods have less of the nutrients shown per 100 g or 100 ml. This is a label comparison, not a claim of a higher Nutri-Score.")}</p>${nutritionCards(a,s)}<p class="small muted">${e("Ingredients and allergens can differ. Always check both packs.")}</p>${catalogueNote(a)}${catalogueRecovery(a)}${a.partialSearch?t`<p class="note">${e("Live search is unavailable. Catalogue comparisons remain available.")}</p>`:""}${controls}</section>`;
    if (a.status === "error") {
        const message=H(a.error);
        return t`<section class="card card--swap" aria-live="polite"><header class="card__head"><h2>${i("sparkle",18)}${e("Better choices")}</h2></header>
          <div class="inline-state"><p><b>${message.title}.</b> ${message.body}</p>
          ${catalogueRecovery(a)}<p class="small">${e("No checked recommendation is available from the loaded data. This does not mean there are no better products.")}</p>
          <div class="row-actions row-actions--wrap">${retry}<button type="button" class="btn btn--ghost" data-act="r:aisle-compare">${i("columns",18)}${e("Compare a food you have")}</button><a class="btn btn--ghost" href="#/foods">${e("Open saved foods")}</a></div></div>${catalogueNote(a)}${controls}</section>`;
    }
    const availability=t`${catalogueNote(a)}${catalogueRecovery(a)}${a.refreshing?t`<p class="note" role="status">${e("Checking for more choices. Your checked results stay visible.")}</p>`:""}${a.savedChecks?t`<p class="note">${i("shield",14)}<span>${e("Includes source records checked within the last 24 hours and saved on this device. Check the current package.")}</span></p>`:""}${a.partialSearch?t`<div class="note"><span>${e("Live checking is limited right now. The displayed records passed the same grade checks as their reports; dated catalogue records are labelled.")}</span></div>${retry}`:""}`;

    let p = [a.hidden?.conflict ? e("{n} hidden: conflict with your allergens or diet", { n: a.hidden.conflict }) : "", a.hidden?.preview ? e("{n} hidden: not enough detail to check against your allergens", { n: a.hidden.preview }) : ""].filter(Boolean).join(". "), u = t `${a.plan?.note ? t `<p class="note">${i("info", 14)}<span>${a.plan.note}</span></p>` : ""}${a.fallback ? t `<p class="note note--catalogue">${i("shield", 14)}<span>${a.degraded ? e("Live search is unavailable. These are older bundled examples, not freshly verified recommendations. Open the record and check your package.") : e("These older bundled examples may have changed. Open the current record before choosing or buying.")}</span></p>` : ""}${p ? t `<p class="note">${i("shield", 14)}<span>${p}.</span></p>` : ""}${a.retry ? t `<div class="row-actions">${C(e("Try again"), "alt-retry", { kind: "soft", ic: "refresh" })}</div>` : ""}`, c = a.widened ? t `<p class="note">${i("flag", 14)}<span>${e("You selected results from other markets.")}</span></p>` : "", h = t`${availability}${a.hidden?.unverified?t`<p class="note">${i("shield",14)}<span>${e("Records with insufficient or conflicting evidence are excluded. This is not an exhaustive search.")}</span></p>`:""}${a.unexamined?t`<p class="small muted">${e("Additional candidates were left unchecked to respect source request limits.")}</p>`:""}${controls}<footer class="card__foot">${e("{n} records assessed",{n:a.candidateCount||a.verifiedCount||0})}. ${r?e("Only products source-listed for {country} are shown.",{country:k(r)}):e("Worldwide results may not be sold locally.")} ${e("Country tags are not supermarket stock. Compare the pack, ingredients and allergens before switching.")}</footer>`;
    if (a.status === "better") {
        let [$, ...y] = a.better;
        return t `<section class="card card--swap card--lift" aria-labelledby="swap-title"><header class="card__head"><h2 id="swap-title">${i("sparkle", 18)}${e("Higher-grade choices")}</h2><span class="card__note">${j(a, s)}</span></header>
      ${ia($, a.marginalOnly ? e("Slightly higher grade") : e("Closest match"), l)}
      ${a.biggest ? t `<div class="swap-more">${ia(a.biggest, e("Biggest step up"), l)}</div>` : ""}
      ${y.length ? t `<ul class="plist plist--tight">${y.map(N => F(N, O(N.from, N.to), r))}</ul>` : ""}${c}${u}${h}</section>`;
    }
    if (a.status === "top")
        return t `<section class="card card--swap card--top"><header class="card__head"><h2>${i("sparkle", 18)}${e("Same-grade options")}</h2><span class="card__note">${e("Already the top grade")}</span></header>
      <p class="lead">${i("check", 18)}<span><b>${e("Nothing scores higher than an A.")}</b> ${e("You’ve picked a top-grade product.")}${a.peers.length ? ` ${e("These checked records also show A, with a specific difference:")}` : ""}</span></p>
      ${a.peers.length ? t `<ul class="plist plist--tight">${a.peers.map($ => F($, x($.to, { size: "sm" }), r))}</ul>` : ""}${u}${h}</section>`;
    if (a.status === "nograde") {
        let $ = n ? e("This product’s grade is on hold, so none of these is claimed to be “better”. They are well-graded products in the same category.") : e("This product has no grade to compare with, so none of these is claimed to be “better”. They are well-graded products in the same category.");
        return t `<section class="card card--swap"><header class="card__head"><h2>${i("sparkle", 18)}${e("Well-graded in this category")}</h2></header><p class="muted small">${$}</p>
      <ul class="plist plist--tight">${a.better.map(y => F(n ? { ...y, reasons: [] } : y, x(y.to, { size: "sm" }), r))}</ul>${c}${u}${h}</section>`;
    }
    let m = a.reason === "no-category" ? e("This record has no usable food category, so there is nothing reliable to compare it with.") : n || !A(s).grade ? e("This product has no trustworthy grade to compare against, and no well-graded products turned up in its category.") : e("No suitable higher-grade choice was confirmed in the loaded catalogue. Missing data or your preferences may limit matches.").replace("  ", " "), d = !n && a.peers?.length ? t `<p class="lead">${i("info", 18)}<span><b>${e("Same grade, with a real difference:")}</b></span></p><ul class="plist plist--tight">${a.peers.map($ => F($, x($.to, { size: "sm" }), r))}</ul>` : "", v = Z(s?.name), ca = t `<div class="row-actions row-actions--wrap">${v.length >= 3 ? t `<a class="btn btn--soft btn--sm" href="#/s/${encodeURIComponent(v)}">${i("search", 16)}${e("Search similar products")}</a>` : ""}<button type="button" class="btn btn--ghost btn--sm" data-act="r:aisle-compare">${i("columns", 16)}${e("Compare with a product you have")}</button></div>`;
    return t `<section class="card card--swap"><header class="card__head"><h2>${i("sparkle", 18)}${e("Food comparisons")}</h2><span class="card__note">${n ? e("No comparison available") : j(a, s)}</span></header><p class="muted">${m}</p>${d}${u}${ca}${h}</section>`;
}
function fa(a, s) { let o = Q(a.anatomy, s); if (!o)
    return ""; let n = a.anatomy.score, r = Object.fromEntries(o.rungs.map(d => [d.grade, d])), l = U.map(d => r[d] || { grade: d, min: null, max: null }), p = l.findIndex(d => d.min !== null && n >= d.min && n <= d.max), u = l[p], c = Math.min(u.max, 40) - Math.max(u.min, -15) + 1, h = Math.min(.92, Math.max(.08, (n - Math.max(u.min, -15) + .5) / c)), m = d => d.min === null ? e("water") : d.min <= -15 ? `≤${d.max}` : d.max >= 40 ? `${d.min}+` : d.min === d.max ? `${d.min}` : `${d.min}–${d.max}`; return t `<div class="ladder" role="img" aria-label="${e("Points {score} fall in grade {grade}, which covers {range}", { score: n, grade: a.grade, range: m(u) })}"><div class="ladder__bar">${l.map(d => t `<span class="ladder__seg g-${d.grade} ${d.grade === a.grade ? "is-on" : ""}"><b>${d.grade}</b><small>${m(d)}</small></span>`)}</div><i class="ladder__pin" data-css="--at:${w(100 * (p + h) / l.length)}"><span>${n}</span></i></div>`; }
var ra = (a, s, o) => s.items.length ? t `<div class="pts pts--${o}"><h3>${a}<small>${e("{points} of {max} points", { points: s.points, max: s.max })}</small></h3>${s.items.map(n => t `<div class="pt"><span class="pt__label">${n.label}${n.amount ? t `<small>${n.amount}</small>` : ""}</span><span class="pt__bar" role="img" aria-label="${e("{points} of {max} points", { points: n.points, max: n.max })}"><i class="${o === "up" ? "up" : n.share >= .66 ? "hi" : n.share >= .33 ? "mid" : "lo"}" data-css="--w:${w(100 * n.share)}"></i></span><b>${n.points}<small>/${n.max}</small></b></div>`)}</div>` : "";
function ae(a, s) {
    let o = s.anatomy;
    return o ? t `<section class="card" aria-labelledby="why-title"><header class="card__head"><h2 id="why-title">${i("leaf", 18)}${e("Why this grade")}</h2><span class="card__note">Nutri-Score ${o.version}${o.beverage ? ` · ${e("drinks")}` : ""}${o.estimated ? ` · ${e("Calculated")}` : ""}</span></header>
    <p class="calc"><span>${o.summary}</span>${o.score !== null ? t `<span class="calc__grade">${i("arrow", 15)} ${e("grade")} ${x(o.grade, { size: "xs", label: !1 })}</span>` : ""}</p>
    ${fa(s, a)}
    <div class="pts-grid">${ra(e("Counts against it"), o.negative, "down")}${ra(o.positive.counted ? e("Counts in its favour") : e("In its favour"), o.positive, "up")}</div>
    ${o.note ? t `<p class="note">${i("info", 14)}<span>${o.note}</span></p>` : ""}
    ${o.estimated && s.caveats.length ? t `<ul class="ticks assume" aria-label="${e("How this was calculated")}">${s.caveats.map(n => t `<li>${i("info", 15)}${n}</li>`)}</ul>` : ""}
    <footer class="card__foot">${o.estimated ? e("Calculated by FoodScan with the official Nutri-Score 2023 method from the label values, because the source has no grade for this product. Fewer points is better.") : e("Points published by Open Food Facts (Nutri-Score 2023), shown only when they add up. Fewer points against means a better grade.")}</footer></section>` : s.grade ? t `<section class="card"><header class="card__head"><h2>${i("leaf", 18)}${e("Why this grade")}</h2></header><p class="muted">${e("The source did not publish the point-by-point calculation for this record, so FoodScan can’t show it. The label facts below are what the numbers say.")}</p></section>` : "";
}
var la = { low: "Low", medium: "Medium", high: "High", unknown: "Not reported", neutral: "", "high-fibre": "High fibre", "source-fibre": "Source of fibre" }, L = a => la[a] ? e(la[a]) : "";
function nutritionRadar(product) {
 const vector=balanceVector(product);if(!vector.available)return "";
 const {scores,index:avg}=vector;
 const labels=[e("Low sugar"),e("Low sat. fat"),e("Low salt"),e("Fibre"),e("Protein")];
 const point=(axis,value)=>{const angle=-Math.PI/2+axis*2*Math.PI/5,rad=56*value/100;return `${(90+rad*Math.cos(angle)).toFixed(1)},${(86+rad*Math.sin(angle)).toFixed(1)}`;};
 return t`<div class="nutri-radar" role="group" aria-label="${e("FoodScan balance view")}">
 <svg class="nutri-radar__svg" viewBox="0 0 180 172" width="156" height="148" aria-hidden="true"><polygon points="${scores.map((_,i)=>point(i,100)).join(" ")}" fill="none" stroke="var(--line2)" stroke-dasharray="3 2"></polygon><polygon points="${scores.map((_,i)=>point(i,60)).join(" ")}" fill="none" stroke="var(--line)"></polygon>${avg!==null?t`<polygon points="${scores.map((score,i)=>point(i,score)).join(" ")}" fill="#0381412e" stroke="#129969" stroke-width="2.5"></polygon>`:""}${scores.map((score,i)=>score===null?"":t`<circle cx="${point(i,score).split(",")[0]}" cy="${point(i,score).split(",")[1]}" r="3.5" fill="#129969"></circle>`)}</svg>
 <div class="nutri-radar__axes"><div class="nutri-radar__title"><b>${e("FoodScan balance view")}</b><small>${avg===null?e("Incomplete label"):e("Not a health score")}</small></div>
 ${labels.map((label,i)=>t`<div class="nutri-radar__row"><span>${label}</span><span class="nutri-radar__track" ${scores[i]===null?t`aria-label="${label}: ${e("Not reported")}"`:t`role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${scores[i]}"`}><i data-css="--w:${w(scores[i]??0)}" class="${scores[i]===null?"is-unknown":scores[i]>=68?"is-good":scores[i]>=42?"is-mid":"is-low"}"></i></span><b>${scores[i]===null?"—":`${scores[i]}%`}</b></div>`)}
 <details class="balance-method"><summary>${e("What do these percentages mean?")}</summary><p>${e("A FoodScan visual guide per 100 g/ml, not Nutri-Score or daily-intake percentages. Missing values are not scored. More green is favourable only on that nutrient, not a health verdict.")}</p><p>${e("Mapping: lower sugar, saturated fat and salt use 100 minus 85 times the amount divided by the label-facts high cutoff. Fibre and protein use 25 plus 75 times the amount divided by 6 g and 12 g respectively. Values are rounded and limited to 0-100; the overall index requires all five values.")}</p></details>
 </div></div>`;
}
function macroSplitBar(a) {
    let n = a?.nutrition || {};
    if (![n.fat,n.carbohydrates,n.protein].every(g)) return "";
    let fat = g(n.fat) ? Math.max(0, n.fat) : g(n.saturatedFat) ? Math.max(0, n.saturatedFat) : 0;
    let carbs = g(n.carbohydrates) ? Math.max(0, n.carbohydrates) : g(n.sugars) ? Math.max(0, n.sugars) : 0;
    let prot = g(n.protein) ? Math.max(0, n.protein) : 0;
    let fCal = fat * 9, cCal = carbs * 4, pCal = prot * 4, tot = fCal + cCal + pCal;
    if (tot < 8)
        return "";
    let cPct = Math.round(100 * cCal / tot), fPct = Math.round(100 * fCal / tot), pPct = Math.max(0, 100 - cPct - fPct);
    return t `<div class="macro-split" role="group" aria-label="${e("Calorie breakdown by macronutrient")}">
    <div class="macro-split__head"><span>${e("Macro energy split")}</span><small>${e("Share of calories")}</small></div>
    <div class="macro-split__bar">
      ${cPct > 0 ? t `<span class="macro-split__seg is-carb" data-css="--w:${w(cPct)}" title="${e("Carbohydrate")}: ${cPct}%"></span>` : ""}
      ${fPct > 0 ? t `<span class="macro-split__seg is-fat" data-css="--w:${w(fPct)}" title="${e("Fat")}: ${fPct}%"></span>` : ""}
      ${pPct > 0 ? t `<span class="macro-split__seg is-prot" data-css="--w:${w(pPct)}" title="${e("Protein")}: ${pPct}%"></span>` : ""}
    </div>
    <div class="macro-split__legend">
      <span class="macro-pill"><i class="is-carb"></i><b>${e("Carbohydrate")}</b> <em>${cPct}%</em></span>
      <span class="macro-pill"><i class="is-fat"></i><b>${e("Fat")}</b> <em>${fPct}%</em></span>
      <span class="macro-pill"><i class="is-prot"></i><b>${e("Protein")}</b> <em>${pPct}%</em></span>
    </div>
  </div>`;
}
function ee(a) {
    let s = I(a), o = T(a);
    return s.rows.length ? t `<section class="card" aria-labelledby="facts-title"><header class="card__head"><h2 id="facts-title">${i("sliders", 18)}${e("Label facts")}</h2><span class="card__note">${s.unit}</span></header>
    ${nutritionRadar(a)}${macroSplitBar(a)}<div class="facts">${s.rows.map(n => t `<div class="fact fact--${n.band}"><div class="fact__top"><span>${n.label}</span><b>${n.value === null ? "—" : t `${n.value > 0 && n.value < .01 ? "<0.01" : _(n.value, n.value < 1 ? 2 : 1)}<small> g</small>`}</b>${L(n.band) ? t `<em class="pill pill--${n.band}">${L(n.band)}</em>` : ""}</div>
      <div class="fact__bar" role="img" aria-label="${n.label}: ${n.value === null ? e("not reported") : `${_(n.value)} g, ${L(n.band) || e("no band")}`}"><i data-css="--w:${w(n.fill)}"></i>${s.bands && n.key !== "fiber" ? t `<u data-css="--at:${w(100 * n.low / n.high)}"></u>` : ""}</div>
      ${n.tsp ? t `<div class="fact__cubes">${R(n.value)}<span>${S(Math.round(n.value / 4), "about {n} sugar cube (4 g each)", "about {n} sugar cubes (4 g each)")}</span></div>` : ""}</div>`)}</div>
    ${s.assumed ? t `<p class="note">${i("info", 14)}<span>${e("The record doesn’t say if values are per 100 g or 100 ml, so per 100 g was assumed.")}</span></p>` : ""}
    <footer class="card__foot">${s.bands ? e("Bars run up to the UK front-of-pack “high” cut-off; the tick marks where “low” ends.") : e("Colour bands aren’t applied to this kind of product.")}</footer></section>` : o.state === "blocked" ? t `<section class="card"><header class="card__head"><h2>${i("sliders", 18)}${e("Label facts")}</h2></header><p class="muted">${e("The numbers in this record contradict each other, so FoodScan isn’t presenting them as facts. The raw values are listed under “All nutrition values” below.")}</p></section>` : "";
}
var ba = a => a ? t `<a class="btn btn--soft" href="#/foods?t=today">${i("check", 18)}${e("Added · see today")}</a>` : C(e("Add to today"), "log", { ic: "plus" });
function wa(a, s) {
    let o = G(a, s) || {};
    return t `<div class="tiles">${V.map(n => { let r = o[n.key], l = K(n.key, r); return t `<div class="tile"><small>${e(n.label)}</small><b>${r == null ? "—" : _(r, n.key === "kcal" ? 0 : 1)}<em> ${n.unit}</em></b><span class="tile__bar" role="img" aria-label="${l === null ? e("not reported") : e("{pc} percent of the reference intake", { pc: l })}"><i data-css="--w:${w(l ?? 0)}"></i></span><small>${l === null ? e("not reported") : e("{pc}% of daily reference", { pc: l })}</small></div>`; })}</div>
    ${g(o.sugars) && o.sugars >= 4 ? t `<div class="fact__cubes">${R(o.sugars)}<span>${S(Math.round(o.sugars / 4), "about {n} sugar cube in this portion", "about {n} sugar cubes in this portion")}</span></div>` : ""}`;
}
function se(a, s, o) {
    if (!["g", "ml"].includes(a.basis) || !f.some(([l]) => g(a.nutrition[l])) || T(a).state === "blocked")
        return "";
    let n = a.basis, r = Y(a);
    return t `<section class="card" aria-labelledby="portion-title"><header class="card__head"><h2 id="portion-title">${i("calendar", 18)}${e("What you actually eat")}</h2><span class="card__note">${e("Per portion")}</span></header>
    <div class="chips" role="radiogroup" aria-label="${e("Portion size")}">${r.map(l => t `<button type="button" role="radio" aria-checked="${String(l.amount === s)}" class="opt ${l.amount === s ? "is-on" : ""}" data-act="portion" data-arg="${l.amount}">${l.label}</button>`)}</div>
    <div class="amount"><label for="amount">${e("Or enter an amount")}</label><div class="amount__row"><input id="amount-range" class="amount__slider" type="range" min="1" max="${Math.min(2e3, Math.max(600, Math.ceil(s / 100) * 100))}" step="0.1" value="${s}" aria-label="${e("Portion slider")}" aria-valuetext="${s} ${n}">
      <span class="amount__field"><input id="amount" type="number" inputmode="decimal" min="1" max="2000" step="0.1" value="${Math.round(s * 10) / 10}" aria-label="${e("Amount in {unit}", { unit: n })}" aria-describedby="amount-error"><b>${n}</b></span></div><p id="amount-error" class="small" role="status"></p></div>
    <div id="portion-out">${wa(a, s)}</div>
    <div class="row-actions" id="log-slot">${ba(o)}</div>
    ${aa()}
    <footer class="card__foot">${e("Daily reference: EU adult reference intakes (2,000 kcal, 90 g sugars, 20 g saturated fat, 6 g salt). Not personal advice.")}</footer></section>`;
}
function te(a) {
    let s = q(a), o = r => s.label(r), n = !s.declared.length && !s.gaps.length && !s.traces.length;
    return t `<section class="card" aria-labelledby="alg-title"><header class="card__head"><h2 id="alg-title">${i("wheat", 18)}${e("Allergens")}</h2><span class="card__note">${e("Always check the pack")}</span></header>
    ${s.declared.length ? t `<div class="alg"><h3>${e("Listed by the source")}</h3><div class="chips">${s.declared.map(r => b(o(r), "warn"))}</div></div>` : ""}
    ${s.gaps.length ? t `<div class="alg alg--gap"><h3>${i("alert", 15)}${e("Found in the ingredient text, not listed as allergens")}</h3><div class="chips">${s.gaps.map(r => b(o(r), "bad"))}</div><p class="small">${e("The allergen list in this record is incomplete. The ingredients mention {what}. Treat it as present and confirm on the package.", { what: s.gaps.map(r => o(r).toLowerCase().replace(/ \(.*\)/, "")).join(", ") })}</p></div>` : ""}
    ${s.traces.length ? t `<div class="alg"><h3>${e("May contain traces")}</h3><div class="chips">${s.traces.map(r => b(o(r), "neutral"))}</div></div>` : ""}
    ${s.unknown ? t `<p class="lead lead--warn">${i("alert", 18)}<span><b>${e("No allergen information.")}</b> ${e("This record has no allergens and no ingredient list. That does not mean it is allergen-free.")}</span></p>` : ""}
    ${n && !s.unknown ? t `<p class="muted">${e("The source lists no allergens and none were found in the ingredient text. That is not a guarantee: always read the pack.")}</p>` : ""}
    ${a.partial ? t `<p class="note">${i("info", 14)}<span>${e("Preview records have no ingredient list, so the cross-check couldn’t run. Open the full record to check.")}</span></p>` : ""}
    <footer class="card__foot">${e("Allergen tags are cross-checked with the ingredient text. This check only adds warnings, never removes one.")}</footer></section>`;
}
function va(a) { let s = new Set(W(a).map(r => r.key)), o = ["g", "ml"].includes(a.basis) && f.some(([r]) => g(a.servingNutrition?.[r])) && a.serving, n = ([r, l, p]) => { let u = a.nutrition[r], c = a.servingNutrition?.[r]; return t `<tr class="${s.has(r) ? "is-bad" : ""}"><th scope="row">${e(l)}${r === "kcal" && a.energyConverted ? t `<small> ${e("(from kJ)")}</small>` : ""}</th><td>${g(u) ? t `${M(u)} ${p}` : "—"}${s.has(r) ? t ` <em class="pill pill--high">${e("Looks wrong")}</em>` : ""}</td>${o ? t `<td>${g(c) ? t `${M(c)} ${p}` : "—"}</td>` : ""}</tr>`; }; return t `<table class="table"><caption class="sr">${e("Nutrition values")}</caption><thead><tr><th scope="col">${e("Nutrient")}</th><th scope="col">${P(a)}</th>${o ? t `<th scope="col">${e("Per serving")}<small> ${a.serving}</small></th>` : ""}</tr></thead><tbody>${f.map(n)}</tbody></table>`; }
var ya = { e102: "Tartrazine", e110: "Sunset Yellow", e129: "Allura Red", e150d: "Sulphite ammonia caramel", e160: "Carotenoids", e171: "Titanium dioxide", e202: "Potassium sorbate", e211: "Sodium benzoate", e220: "Sulphur dioxide", e249: "Potassium nitrite", e250: "Sodium nitrite", e251: "Sodium nitrate", e252: "Potassium nitrate", e300: "Ascorbic acid (Vitamin C)", e306: "Tocopherols (Vitamin E)", e320: "BHA", e321: "BHT", e322: "Lecithins", e330: "Citric acid", e331: "Sodium citrates", e338: "Phosphoric acid", e340: "Potassium phosphates", e340ii: "Dipotassium phosphate", e407: "Carrageenan", e412: "Guar gum", e415: "Xanthan gum", e433: "Polysorbate 80", e440: "Pectins", e450: "Diphosphates", e466: "Carboxymethylcellulose", e471: "Mono- and diglycerides of fatty acids", e476: "Polyglycerol polyricinoleate", e500: "Sodium carbonates", e503: "Ammonium carbonates", e621: "Monosodium glutamate (MSG)", e950: "Acesulfame K", e951: "Aspartame", e955: "Sucralose", e960: "Steviol glycosides", e960c: "Steviol glycosides" };
function ne(a) {
    let s = a.additives.map(n => { let r = ya[n.toLowerCase().replace(/[^a-z0-9]/g, "")]; return b(r ? `${n.toUpperCase()} · ${e(r)}` : n.toUpperCase(), "neutral"); }), o = a.labels.map(n => n.replace(/^[a-z]{2}:/, "").replace(/-/g, " ")).filter(n => /organic|vegan|vegetarian|fair|gluten-free|no |palm|non gmo|bio|whole|sugar/i.test(n)).slice(0, 8);
    return t `<section class="card card--flush">
    <details class="acc"><summary>${i("sliders", 18)}${e("All nutrition values")}${i("down", 18, "acc__chev")}</summary><div class="acc__body">${va(a)}</div></details>
    <details class="acc"><summary>${i("leaf", 18)}${e("Ingredients")}${a.additivesCount ? t ` <small>· ${S(a.additivesCount, "{n} additive", "{n} additives")}</small>` : ""}${i("down", 18, "acc__chev")}</summary><div class="acc__body">${a.ingredients ? t `<p class="ingredients">${a.ingredients}</p>` : t `<p class="muted">${e("No ingredient list in this record.")}</p>`}${o.length ? t `<div class="chips">${o.map(n => b(n, "neutral"))}</div>` : ""}${s.length ? t `<div class="alg"><h3>${e("Additives listed in this record")}</h3><div class="chips">${s}</div><p class="small muted">${e("These are ingredient names, not safety ratings. The record does not give additive doses or establish safety for an individual.")}</p><p class="small"><a class="link" href="https://www.efsa.europa.eu/en/glossary/acceptable-daily-intake" target="_blank" rel="noopener noreferrer">${e("How additive exposure is assessed")}</a></p></div>` : ""}</div></details></section>`;
}
function oe(a, s, { via: o = "", cache: n = "", saved: r = !1 } = {}) {
    let l = s.quality || T(a), p = [];
    s.anatomy && p.push(s.status === "estimated" ? e("The grade was calculated from the label values with the official method") : e("The points add up to the reported score")), l.state !== "blocked" && p.push(e("Nutrient values are consistent with each other")), a.ingredients && p.push(e("Allergen tags compared with the ingredient text")), a.basisSource === "declared" && p.push(e("The per-100 unit is stated by the source"));
    let u = a.fetchedAt ? E(a.fetchedAt) : "", c = f.filter(([d]) => g(a.nutrition?.[d])).length, h = a.sourceModified ? (Date.now() - a.sourceModified) / (365.25 * 864e5) : null, m = [c < f.length ? S(f.length - c, "{n} label value not reported", "{n} label values not reported") : "", a.ingredients ? "" : e("no ingredient list"), !a.allergens.length && !a.ingredients ? e("no allergen information") : ""].filter(Boolean);
    return t `<section class="card" aria-labelledby="trust-title"><header class="card__head"><h2 id="trust-title">${i("shield", 18)}${e("Source & trust")}</h2></header>
    <dl class="meta"><div><dt>${e("Source")}</dt><dd>${e("Open Food Facts · community database")}</dd></div><div><dt>${e("Record last edited")}</dt><dd>${a.sourceModified ? E(a.sourceModified) : e("unknown")}</dd></div><div><dt>${e("Checked by FoodScan")}</dt><dd>${u}${r ? ` · ${e("saved copy")}` : o === "direct" ? ` · ${e("read directly")}` : n === "STALE" ? ` · ${e("cached copy")}` : ""}</dd></div><div><dt>${e("Data check")}</dt><dd>${l.short}</dd></div>
      <div><dt>${e("Completeness")}</dt><dd>${e("{n} of {total} label values", { n: c, total: f.length })}${a.ingredients ? ` · ${e("ingredients listed")}` : ""}</dd></div></dl>
    ${m.length ? t `<p class="note">${i("info", 14)}<span>${e("Missing from this record: {what}. Missing values are never counted as zero.", { what: m.join(", ") })}</span></p>` : ""}
    ${h !== null && h >= 3 ? t `<p class="note">${i("clock", 14)}<span>${e("This record has not been edited for about {n} years. Recipes change: compare it with the pack in your hand.", { n: Math.floor(h) })}</span></p>` : ""}
    ${p.length ? t `<ul class="ticks">${p.map(d => t `<li>${i("check", 15)}${d}</li>`)}</ul>` : ""}
    <p class="small muted">${l.detail} ${e("If something looks wrong, you can fix it for everyone.")}</p>
    <div class="row-actions row-actions--wrap"><a class="btn btn--ghost" href="${a.sourceUrl}" target="_blank" rel="noopener noreferrer">${e("View record")} ${i("external", 15)}</a><a class="btn btn--ghost" href="https://world.openfoodfacts.org/cgi/product.pl?type=edit&amp;code=${a.barcode}" target="_blank" rel="noopener noreferrer">${e("Report or fix")} ${i("flag", 15)}</a></div></section>`;
}
var _a = [["kcal", "Energy", "kcal", 0], ["sugars", "Sugars", "g", 1], ["saturatedFat", "Saturated fat", "g", 1], ["salt", "Salt", "g", 2], ["fiber", "Fibre", "g", 1], ["protein", "Protein", "g", 1]], ka = new Set(["fiber", "protein"]);
function ie(a, s) {
    let o = a, n = s.product, r = P(o), l = (c, h, m) => g(c.nutrition?.[h]) ? _(c.nutrition[h], m) : "—", p = c => { let h = o.nutrition?.[c], m = n.nutrition?.[c]; return !g(h) || !g(m) || Math.abs(h - m) < (c === "kcal" ? 5 : c === "salt" ? .05 : .3) ? "" : (ka.has(c) ? m > h : m < h) ? "b" : "a"; }, u = c => { let h = A(c); return t `<div class="cmp__head"><span class="cmp__img">${z(c, { size: "md" })}</span><b>${c.name}</b><small>${c.brand?.split(",")[0] || ""}</small>${x(h.grade, { size: "lg", estimated: h.status === "estimated" })}</div>`; };
    return t `<div class="cmp"><div class="cmp__heads">${u(o)}<span class="cmp__vs">${i("arrow", 20)}</span>${u(n)}</div>
    <table class="cmp__table"><caption class="sr">${e("Nutrition")} ${r}</caption><thead><tr><th scope="col">${r}</th><th scope="col">${e("Yours")}</th><th scope="col">${e("Better choice")}</th></tr></thead><tbody>
    ${_a.map(([c, h, m, d]) => { let v = o.basis === n.basis ? p(c) : ""; return t `<tr><th scope="row">${e(h)}</th><td class="${v === "a" ? "is-win" : ""}">${l(o, c, d)}<small> ${m}</small></td><td class="${v === "b" ? "is-win" : ""}">${l(n, c, d)}<small> ${m}</small>${v === "b" ? i("check", 14) : ""}</td></tr>`; })}
    <tr><th scope="row">${e("Processing")}</th><td>${o.nova ? `NOVA ${o.nova}` : "—"}</td><td class="${o.nova && n.nova && n.nova < o.nova ? "is-win" : ""}">${n.nova ? `NOVA ${n.nova}` : "—"}</td></tr></tbody></table>
    ${s.tradeoffs.length ? t `<p class="note">${i("alert", 14)}<span>${e("Trade-off: {what} ({detail}).", { what: s.tradeoffs.map(c => c.text).join(", "), detail: s.tradeoffs[0].detail })}</span></p>` : ""}
    <p class="small muted">${s.verified ? e("Values from Open Food Facts, both records checked just now. Always compare with the packs in front of you.") : e("Values from Open Food Facts. Always compare with the packs in front of you.")}</p>
    <div class="row-actions row-actions--wrap"><a class="btn btn--primary" href="#/p/${n.barcode}">${i("right", 18)}${e("Open its report")}</a><a class="btn btn--soft" href="#/compare/${o.barcode}/${n.barcode}" data-act="cmp:open" data-keep="true">${i("columns", 18)}${e("Full comparison to share")}</a></div></div>`;
}
export { Ya as a, Qa as b, Ja as c, Xa as d, Za as e, ae as f, ee as g, ba as h, wa as i, se as j, te as k, ne as l, oe as m, ie as n };
