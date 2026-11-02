import {cataloguePlan,compatibleFoods} from './comparison-guards-v7540.mjs';
import {marketCatalogue} from './market-catalogue-v7540.mjs';
import {rememberProduct,recentProducts,peekProduct} from "./chunk-BIWX2LG4-v7540.js";
import {verifiedAlternatives} from "./recommendations-core-v7540.mjs";
import { d as B, e as O, f as Z, h as z, i as N } from "./chunk-AHTU2MHF-v7540.js";
import { b as Y } from "./chunk-IO4NLMGT-v7540.js";
import { a as A, c as I, d as U, e as J, f as Q } from "./chunk-BIWX2LG4-v7540.js";
import { d as T, e as P, f as H, g as S, l as j, w as W } from "./chunk-2OB4V521-v7540.js";
import { d as G, n as L, o as M } from "./chunk-TTXUOT36-v7540.js";
import { c as b, l as F } from "./chunk-4O7IN74N-v7540.js";
import { d as i, o as q } from "./chunk-6K6QREZY-v7540.js";
var re = { down: "alert", up: "check", minor: "minus", note: "info" }, K = { high: ["good", "shield", "Source points add up"], medium: ["neutral", "info", "Source-reported"], low: ["warn", "alert", "Limited data"] }, oe = (e, t) => t.status === "estimated" ? ["neutral", "sliders", "Calculated by FoodScan"] : e?.partial ? ["warn", "alert", "Preview record"] : K[t.confidence] || K.medium, R = e => String(e).replace("-", "−"), ie = e => Number.isFinite(e.score) ? `${e.scoreRange && e.scoreRange[0] !== e.scoreRange[1] ? "~" : ""}${R(Math.round(e.score))}` : "—", le = e => e ? e.min <= -15 ? `≤${R(e.max)}` : e.max >= 40 ? `${e.min}+` : e.min === e.max ? R(e.min) : `${R(e.min)}–${R(e.max)}` : "", de = e => b `<li class="snip__why snip__why--${e.tone}"><i>${F(re[e.tone] || "info", 15)}</i><span>${e.text}</span></li>`, ce = (e, t) => { let n = t ? Object.fromEntries(t.rungs.map(a => [a.grade, a])) : null; return b `<div class="snip__scale ${n ? "has-ranges" : ""}" aria-hidden="true">${T.map(a => b `<i class="g-${a} ${a === e ? "is-on" : ""}">${a}</i>`)}${n ? T.map(a => b `<s class="${a === e ? "is-on" : ""}">${le(n[a])}</s>`) : ""}</div>`; };
function Ce(e, t, { variant: n = "report", rootClass: a = "snippet", showReasons: l = !0, showSource: d = !0, better: o = null } = {}) {
    let s = t.grade, g = s ? H[s] : null, u = t.status === "withheld", w = t.status === "estimated", [p, m, h] = u ? ["warn", "alert", "Grade on hold"] : s ? oe(e, t) : ["neutral", "info", "No grade"], r = t.anatomy, y = l ? (r ? r.why.filter(C => C.tone !== "note").slice(0, 2) : []).map(C => C) : [], _ = r ? r.negative.points : null, f = r ? r.positive.points : null, c = t.estimate && !t.estimate.ok && t.estimate.reason !== "unusable" ? t.estimate.reason === "incomplete" ? t.estimate.message : `${i("The source has no grade.")} ${t.estimate.message}` : "", v = u ? i("The record contradicts itself, so the grade isn’t repeated") : w ? i(t.reproducedSourceGrade ? "Source grade independently reproduced using the 2023 calculation. Check the current package." : "Calculated from the label values with the official method, because the source has no grade for this product.") : s ? g.line : c || i("The source doesn’t report one, and FoodScan won’t guess"), $ = u ? i("Grade on hold") : s ? g.word : i("No grade"), x = s && r ? Y(r, e) : null, E = t.scoreRange && t.scoreRange[0] !== t.scoreRange[1], k = Number.isFinite(t.score) ? i("{n} points; lower is better", { n: E ? i("{low} to {high}", { low: R(t.scoreRange[0]), high: R(t.scoreRange[1]) }) : R(Math.round(t.score)) }) : "";
    return b `<article class="${a} snip snip--${n} ${s ? `g-${s}` : "g-none"} ${u ? "is-held" : ""} ${w ? "is-estimated" : ""}" data-grade="${s || "none"}">
    <span class="snip__glow" aria-hidden="true"></span>
    <header class="snip__head">
      <span class="snip__kicker">${i("Nutri-Score")}${w ? b `<span class="snip__ver"><b>·</b>${i("Calculated")}</span>` : r?.version ? b `<span class="snip__ver"><b>·</b>${i("{version} method", { version: r.version })}</span>` : ""}</span>
      <span class="snip__state snip__state--${p}">${F(m, 13)}${i(h)}</span>
    </header>
    <div class="snip__core">
      <div class="snip__seal"><span class="snip__ring" aria-hidden="true"></span><b>${s || "–"}</b>${w ? b `<em class="snip__est" aria-hidden="true">${i("Calculated")}</em>` : ""}</div>
      <div class="snip__verdict"><strong>${$}</strong><span>${v}</span></div>
    </div>
    ${s ? b `<div class="snip__score" ${k ? b `role="group" aria-label="${k}"` : ""}>
      <span class="snip__scorenum"><small>${i("Points")}</small><b>${ie(t)}</b><em>${i("lower is better")}</em></span>
      ${r ? b `<span class="snip__split"><b>${_}</b> ${i("against")}${f ? b ` · <b>${f}</b> ${i("in favour")}` : ""}</span>` : b `<span class="snip__split snip__split--muted">${i(Number.isFinite(t.score)?"Point breakdown not reported":"Points not published")}</span>`}
    </div>
    ${ce(s, x)}` : ""}
    ${y.length ? b `<ul class="snip__why-list" aria-label="${i("Why this grade")}">${y.map(de)}</ul>` : ""}
    ${o ? b `<div class="snip__better"><span class="snip__better-arrow" aria-hidden="true">${F("arrow", 15)}</span><span><small>${i("Better choice")}</small><b>${o.name}</b></span><span class="snip__better-grade g-${o.to}">${o.to}</span></div>` : ""}
    ${d ? b `<footer class="snip__foot"><span>${F("shield", 12)}${w ? i("Calculated by FoodScan · official 2023 method") : i("Open Food Facts · community database")}</span><span>${e?.catalogueSnapshot ? i("Saved catalogue data") : e?.fetchedAt ? i("Checked {when}", { when: W(e.fetchedAt) }) : i("Source-reported")}</span></footer>` : ""}
  </article>`;
}
var V = []; // Bundled historical grades are not recommendation evidence.
var ge=new Map, ae={catalogue:(plan,options)=>marketCatalogue.query(plan,options),remember:rememberProduct,peek:peekProduct,saved:recentProducts,pool(category,options){if(options.fresh===0)return Q(category,options);return I(ge,`${category}|${options.country||"any"}|full|${options.page||1}`,signal=>Q(category,{...options,signal}),options.signal,300000);},search:(query,options)=>J(query,options),product:(code,options)=>U(code,options).then(response=>response.product)};
var ee=value=>String(value||"").replace(/[\d%.,()+\-/]+/g," ").replace(/\s+/g," ").trim().split(" ").slice(0,4).join(" ");
function ye(base,result){return result;}
async function ze(base,profile,options={}) { return verifiedAlternatives(base,profile,{planFor:p=>cataloguePlan(p,Z,B,options.family),sameFood:(a,b)=>compatibleFoods(a,b,B,options.family),assess:j,rank:N,isGrade:S,profileCheck:M,source:options.source||ae},options); }
async function De(result,base,profile,options={}) { return result?.fullRecordsVerified ? result : ze(base,profile,{...options,country:result?.country||"any"}); }
export { Ce as a, V as b, ee as c, ye as d, ze as e, De as f };
