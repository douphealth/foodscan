import {k as selectedMarket} from "./chunk-TTXUOT36-v8100.js";
import {marketCatalogue,snapshotUsable} from './market-catalogue-v8100.mjs';
import { d as c, i as g, j as b, o as h } from "./chunk-6K6QREZY-v8100.js";
var l = class extends Error {
    constructor(t, n = 0, r = {}) { super(t), this.code = t, this.status = n, this.retryAfter = r.retryAfter || 0, this.attempts = r.attempts, this.requestId = r.requestId; }
    get retryable() { return !["not_found", "not_food", "invalid_barcode", "invalid_query", "invalid_category"].includes(this.code); }
};
function M(e) { let t = e?.code || "network"; if (typeof navigator < "u" && navigator.onLine === !1)
    return { title: c("You are offline"), body: c("Saved foods still open. Reconnect to look up something new.") }; switch (t) {
    case "not_found": return { title: c("Not in the database yet"), body: c("Open Food Facts has no record for this exact barcode.") };
    case "not_food": return { title: c("Not a food product"), body: c("This barcode belongs to a different kind of product, such as cosmetics or pet food.") };
    case "invalid_barcode": return { title: c("Check the barcode"), body: c("The number or its check digit looks wrong. Check the digits printed under the bars.") };
    case "invalid_query": return { title: c("Type a little more"), body: c("Enter at least two letters to search.") };
    case "rate_limited":
    case "local_rate_limited": return { title: c("Live lookups are temporarily paused"), body: c("The source or this server has reached a request limit. Recent checked records and your saved foods remain available.") };
    case "upstream_busy": return { title: c("Live lookups are temporarily unavailable"), body: c("The source did not accept this request. Recent checked records stay visible where available; your saved foods still open.") };
    case "upstream_blocked": return { title: c("The food database refused the request"), body: c("This is a server setting, not something you did. Try again later.") };
    default: return { title: c("The food database did not answer"), body: c("A connection or source-service problem stopped this lookup. Saved foods still open.") };
} }
var x = "code,product_name,product_name_en,product_name_el,product_name_de,product_name_fr,product_name_it,product_name_es,generic_name,generic_name_en,generic_name_el,abbreviated_product_name,brands,image_front_small_url,image_front_url,image_url,quantity,product_quantity,product_quantity_unit,serving_size,serving_quantity,serving_quantity_unit,nutriments,nutrition_data_per,nutrition_data_prepared_per,nutriscore_grade,nutriscore_score,nutriscore,nutrition_grades,nova_group,ingredients_text,ingredients_text_en,ingredients_text_fr,ingredients_text_el,ingredients_text_de,ingredients_text_it,ingredients_text_es,ingredients_text_pt,ingredients_text_nl,lang,allergens_tags,traces_tags,last_modified_t,labels_tags,ingredients_analysis_tags,categories_tags,countries_tags,additives_n,additives_tags,pnns_groups_1,pnns_groups_2,data_quality_errors_tags,product_type,obsolete";
async function _(e, { signal: t, timeout: n = 9e3 } = {}) { if (t?.aborted)
    throw new DOMException("Aborted", "AbortError"); let r = new AbortController, i = setTimeout(() => r.abort(new DOMException("Timed out", "TimeoutError")), n), o = () => r.abort(t.reason); t?.addEventListener("abort", o, { once: !0 }); try {
    let a = await fetch(e, { signal: r.signal, headers: { Accept: "application/json" } }), s = null;
    if (/json/i.test(a.headers.get("content-type") || ""))
        try {
            s = await a.json();
        }
        catch { }
    return { res: a, body: s, cache: a.headers.get("x-foodscan-cache") || "" };
}
catch (a) {
    throw t?.aborted ? a : new l(r.signal.aborted ? "upstream_timeout" : "network");
}
finally {
    clearTimeout(i), t?.removeEventListener("abort", o);
} }
function m(e, t) { let n = e?.error; return new l(n?.code || (t.status === 404 ? "not_found" : t.status === 429 ? "rate_limited" : t.status === 503 ? "upstream_busy" : "upstream_http"), t.status, { retryAfter: n?.retryAfter || Math.max(0,Number(t.headers.get("Retry-After"))||0), attempts: n?.attempts, requestId: n?.requestId }); }
function E(e, t, n, r, i = 3e5) { if (r?.aborted)
    return Promise.reject(new DOMException("Aborted", "AbortError")); let o = e.get(t); if (o?.done && o.expires > Date.now())
    return Promise.resolve(o.value); if ((o?.done || o?.controller.signal.aborted) && (e.delete(t), o = null), !o) {
    for (let [a, s] of e)
        s.done && s.expires <= Date.now() && e.delete(a);
    if (e.size >= 64) {
        let a = [...e].find(([, s]) => s.done);
        a && e.delete(a[0]);
    }
    if (e.size >= 128)
        return Promise.reject(new l("local_rate_limited", 429, { retryAfter: 10 }));
    o = { controller: new AbortController, waiters: 0, done: !1, value: null, expires: 0 }, e.set(t, o), o.promise = Promise.resolve().then(() => n(o.controller.signal)).then(a => (o.done = !0, o.value = a, o.expires = Date.now() + i, a), a => { throw e.get(t) === o && e.delete(t), a; }), o.promise.catch(() => { });
} return o.waiters++, new Promise((a, s) => { let u = !1, d = (f, A) => { u || (u = !0, r?.removeEventListener("abort", p), o.waiters--, f(A), !o.done && o.waiters === 0 && o.controller.abort()); }, p = () => d(s, new DOMException("Aborted", "AbortError")); r?.addEventListener("abort", p, { once: !0 }), o.promise.then(f => d(a, f), f => d(s, f)); }); }
var D = new Map;
const pauses={product:0,search:0}, SNAPSHOTS='fs591:source-snapshots';
const fresh=p=>snapshotUsable(p)||p?.provenance==='off'&&!p.partial&&(p.schemaVersion||0)>=10&&b(String(p.barcode||''))&&Number.isFinite(p.fetchedAt)&&p.fetchedAt>0&&Date.now()-p.fetchedAt<=86400000&&p.fetchedAt<=Date.now()+300000;
function pauseError(kind){const until=pauses[kind];if(until>Date.now()){const error=new l('rate_limited',429,{retryAfter:Math.ceil((until-Date.now())/1000)});error.retryAt=until;return error;}return null;}
function notePause(kind,error){if(['rate_limited','local_rate_limited','upstream_busy'].includes(error?.code)&&error.retryAfter>0){pauses[kind]=Math.max(pauses[kind],error.retryAt||Date.now()+error.retryAfter*1000);error.retryAt=pauses[kind];}}
function chooseRecord(a,b){if(fresh(a)&&fresh(b)&&!!a.catalogueSnapshot!==!!b.catalogueSnapshot)return a.catalogueSnapshot?b:a;if(!fresh(a))return b;if(!fresh(b))return a;if(a.sourceModified&&b.sourceModified&&a.sourceModified!==b.sourceModified)return a.sourceModified>b.sourceModified?a:b;return a.fetchedAt>b.fetchedAt?a:b;}
let snapshotsText=null,snapshotsParsed=[];
function readSnapshots(){try{const text=localStorage.getItem(SNAPSHOTS)||'[]';if(text!==snapshotsText){const list=JSON.parse(text);snapshotsParsed=Array.isArray(list)?list.slice(0,36):[];snapshotsText=text;}return snapshotsParsed.filter(fresh);}catch{return[];}}
export function rememberProduct(product,via='source'){
 if(!fresh(product))return product;
 const key=String(product.barcode).padStart(14,'0'),entry=D.get(key),list=readSnapshots();
 const old=entry?.done?entry.value?.product:null;
 const prior=list.find(p=>String(p.barcode).padStart(14,'0')===key);
 const chosen=chooseRecord(chooseRecord(old,prior),product);
 if(!entry||entry.done)D.set(key,{done:true,value:{product:chosen,via,cache:'CHECKED-SNAPSHOT'},expires:Math.min(Date.now()+300000,chosen.catalogueSnapshot?Date.now()+300000:chosen.fetchedAt+86400000)});
 // Bounded per-tab memory. Never cancel an in-flight user scan to make room.
 if(D.size>64){for(const [k,v]of D){if(D.size<=64)break;if(k!==key&&v.done)D.delete(k);}}
 try{if(JSON.stringify(chosen).length<50000)localStorage.setItem(SNAPSHOTS,JSON.stringify([chosen,...list.filter(p=>String(p.barcode).padStart(14,'0')!==key)].slice(0,36)));}catch{}
 return chosen;
}
export function recentProducts(){
 const records=readSnapshots();for(const entry of D.values())if(entry.done&&fresh(entry.value?.product))records.push(entry.value.product);
 try{for(const key of ['fs13:history','fs13:saved']){const rows=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(rows))for(const row of rows.slice(0,120))if(fresh(row?.product))records.push(row.product);}}catch{}
 const unique=new Map();for(const p of records){const key=String(p.barcode).padStart(14,'0');unique.set(key,chooseRecord(unique.get(key),p));}return [...unique.values()];
}
function normalizePool(body){
 const snapshot=body?.recordMode==='dated-catalogue-record-v1'&&body?.provider==='off-catalogue'&&body.partial===false;
 const complete=snapshot||body?.recordMode==='complete-source-record-v1'&&body?.provider==='off-search'&&body.partial===false;
 const raw=(body?.products||[]).map(p=>({...p,partial:p.partial===true||body.partial===true||!complete}));
 return {raw,products:y(raw,body?.fetchedAt).map(p=>snapshot?{...p,catalogueSnapshot:{provider:'openfoodfacts-daily-export',exportedAt:body.fetchedAt,revision:body.catalogue?.revision,source:body.catalogue?.source}}:p),provider:body?.provider||'',recordMode:complete?body.recordMode:'preview',partial:!complete};
}
async function P(e, t) { let n; try {
    let { res: r, body: i, cache: o } = await _(`/api/product/${e}`, { signal: t });
    if (r.ok && i?.product) {
        let a = h(i, e);
        if(a&&i.catalogueSnapshot)a={...a,catalogueSnapshot:i.catalogueSnapshot};
        if (a)
            return { product: a, via: "server", cache: o };
        throw new l("not_found", 404);
    }
    n = m(i, r);
}
catch (r) {
    if (t?.aborted)
        throw r;
    n = r instanceof l ? r : new l("network");
} throw n; }
async function O(e, t) { let { res: n, body: r } = await _(`https://world.openfoodfacts.org/api/v2/product/${e}.json?fields=${x}`, { signal: t, timeout: 9e3 }); if (r?.status === 0 || r?.result?.id === "product_not_found")
    throw new l("not_found", 404); if (n.ok && r?.product) {
    let i = h({ ...r, fetchedAt: Date.now() }, e);
    if (i)
        return { product: i, via: "direct", cache: "" };
} throw new l("upstream_http", n.status); }
var S = 1600;
async function T(code, signal) {
 const saved=recentProducts().find(p=>String(p.barcode).padStart(14,'0')===String(code).padStart(14,'0'));
 if(saved)return {product:rememberProduct(saved,'saved'),via:'saved',cache:'CHECKED-SNAPSHOT'};
 let bundled=null;try{bundled=await marketCatalogue.product(code,{signal});}catch(e){if(signal?.aborted)throw e;}
 if(bundled)return {product:rememberProduct(bundled,'catalogue'),via:'catalogue',cache:'DATED-CATALOGUE'};
 const paused=pauseError('product');if(paused)throw paused;
 try { const result=await P(code,signal);return {...result,product:rememberProduct(result.product,'product')}; }
 catch(error) {
   notePause('product',error);
   if(signal?.aborted || !error.retryable || ["rate_limited","local_rate_limited","upstream_busy"].includes(error.code)) throw error;
   const result=await O(code,signal);return {...result,product:rememberProduct(result.product,'direct')};
 }
}
function j(e, { signal: t } = {}) { let n = g(e); return b(n) ? E(D, n.padStart(14, "0"), r => T(n, r), t) : Promise.reject(new l("invalid_barcode", 400)); }
var y = (e, t) => (Array.isArray(e) ? e : []).map(n => h({ status: 1, product: n, fetchedAt: Number.isFinite(t) ? t : 0 }, String(n?.code || ""))).filter(Boolean);
async function B(query,{signal,full=false,country,live=false,page=1}={}) {
 let profile={};try{profile=JSON.parse(localStorage.getItem('fs13:profile')||'{}');}catch{}
 const wanted=country??selectedMarket(profile);
 if(!live){try{const local=await marketCatalogue.search(query,{country:wanted,signal,page});if(local.products.length)return {...local,cache:'DATED-CATALOGUE',at:local.catalogue.exportedAt};}catch(e){if(signal?.aborted)throw e;}}
 const paused=pauseError('search');if(paused)throw paused;
 const {res,body,cache}=await _(`/api/search?q=${encodeURIComponent(query)}${full?'&detail=full':''}`,{signal,timeout:10000});
 if(!res.ok){const error=m(body,res);notePause('search',error);throw error;}
 const parsed=normalizePool(body);return {...parsed,source:body?.source||'',cache};
}
var k=2*3600000,I=14*86400000,$=24,v='fs591:pools',w=e=>`fs591:pool:${e}`;
function q(key){try{const value=JSON.parse(localStorage.getItem(w(key))||'null');return value&&Array.isArray(value.products)&&Number.isFinite(value.at)&&value.at<=Date.now()+60000&&Date.now()-value.at<I?value:null;}catch{return null;}}
function L(key,entry){try{let keys=JSON.parse(localStorage.getItem(v)||'[]');if(!Array.isArray(keys))keys=[];keys=keys.filter(x=>x!==key);keys.unshift(key);for(const old of keys.splice($))localStorage.removeItem(w(old));localStorage.setItem(w(key),JSON.stringify({...entry,at:Date.now()}));localStorage.setItem(v,JSON.stringify(keys));}catch{}}
async function F(category,{country='',full=true,signal,fresh=k,page=1}={}) {
 page=Math.max(1,Math.min(50,Number(page)||1));
 const query=`category=${encodeURIComponent(category)}&country=${encodeURIComponent(country||'any')}&page=${page}${full?'&detail=full':''}`;
 const cached=q(query),fromCache=stale=>({...normalizePool(cached),cache:stale?'DEVICE-STALE':'DEVICE',at:cached.fetchedAt,page,hasMore:cached.hasMore===true,total:cached.total??null,stale});
 if(cached&&Date.now()-cached.at<fresh)return fromCache(false);
 try {
   const paused=pauseError('search');if(paused)throw paused;
   const {res,body,cache}=await _(`/api/alternatives?${query}${fresh===0?"&refresh=1":""}`,{signal,timeout:11000});
   if(!res.ok){const error=m(body,res);notePause('search',error);throw error;}
   if(!Array.isArray(body?.products))throw new l('upstream_format',502);
   const parsed=normalizePool(body);
   L(query,{products:parsed.raw,fetchedAt:body.fetchedAt,partial:parsed.partial,provider:parsed.provider,recordMode:parsed.recordMode,hasMore:body.hasMore===true,total:body.total??null});
   return {...parsed,cache,coverage:body?.coverage||'',page,hasMore:body.hasMore===true,total:body?.total??null};
 }catch(error){if(signal?.aborted)throw error;if(cached&&error.retryable!==false)return fromCache(true);throw error;}
}
async function R(e = !1, { signal: t } = {}) { let { res: n, body: r } = await _(`/api/health${e ? "?deep=1" : ""}`, { signal: t, timeout: 12e3 }); if (!n.ok)
    throw m(r, n); return r; }
export { l as a, M as b, E as c, j as d, B as e, F as f, R as g };

export function peekProduct(code) { const hit = D.get(String(code).padStart(14,"0")); return hit?.done && hit.expires > Date.now() && !hit.value?.product?.partial ? hit.value.product : null; }
