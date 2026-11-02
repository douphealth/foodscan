import { e as W, h as M } from "./chunk-TTXUOT36-v7540.js";
import { d as O, j as v, m as $, p as A } from "./chunk-6K6QREZY-v7540.js";
var m = "fs13:", k = ["fs31:", "fs30:", "fs29:"], g = { history: 40, saved: 120, diary: 1500, usual: 60 }, V = /^fs\d*:/, N = new Map, x = new Map, y = new Map, H = !0, T = new Set, ot = t => (T.add(t), () => T.delete(t)), c = t => { for (let e of T)
    try {
        e(t);
    }
    catch { } }, Y = t => { x.delete(t), y.delete(t); };
function I(t, e) { if (N.has(t))
    return structuredClone(N.get(t)); if (x.has(t))
    return x.get(t) ?? e; try {
    let r = localStorage.getItem(m + t), a = r ? JSON.parse(r) : null;
    return a !== null && e && typeof e == "object" && (typeof a != "object" || Array.isArray(a) !== Array.isArray(e)) && (a = null), x.set(t, a), a ?? e;
}
catch {
    return H = !1, e;
} }
var q = () => { try {
    for (let t of Object.keys(localStorage))
        /^fs\d*:pools?(?::|$)/.test(t) && localStorage.removeItem(t);
}
catch { } };
function l(t, e) { Y(t); let r = JSON.stringify(e); for (let a = 0; a < 2; a++)
    try {
        return localStorage.setItem(m + t, r), N.delete(t), !0;
    }
    catch (o) {
        if (a === 0 && /quota/i.test(`${o?.name} ${o?.message}`)) {
            q();
            continue;
        }
        break;
    } return H = !1, N.set(t, structuredClone(e)), c("storage-full"), !1; }
typeof addEventListener == "function" && addEventListener("storage", t => { if (t.key === null) {
    x.clear(), y.clear(), c("clear");
    return;
} t.key.startsWith(m) && (Y(t.key.slice(m.length)), c(t.key.slice(m.length))); });
var J = (t, e) => { try {
    let r = JSON.parse(localStorage.getItem(t + e) || "null");
    return Array.isArray(r) ? r : [];
}
catch {
    return [];
} }, z = t => { let e = t?.product; return !e || typeof e.image != "string" || !e.image.startsWith("data:") ? t : { ...t, product: { ...e, image: "", schemaVersion: 0 } }; };
function st() { let t; try {
    t = Object.keys(localStorage);
}
catch {
    return !1;
} let e = t.filter(s => k.some(n => s.startsWith(n))), r = ["history", "saved", "usual"].some(s => (localStorage.getItem(m + s) || "").includes('"data:image/')); if (!e.length && !r)
    return !1; let a = [m, ...k], o = []; for (let s of ["history", "saved"]) {
    let n = new Map;
    for (let b of a)
        for (let d of J(b, s)) {
            let i = d?.product?.barcode || d?.barcode;
            v(i) && Number.isFinite(d.at) && !(n.get(i)?.at >= d.at) && n.set(i, z(d));
        }
    n.size && o.push([s, JSON.stringify([...n.values()].sort((b, d) => d.at - b.at).slice(0, g[s]))]);
} let h = new Map; for (let s of a)
    for (let n of J(s, "diary"))
        n && typeof n.id == "string" && !h.has(n.id) && h.set(n.id, n); h.size && o.push(["diary", JSON.stringify([...h.values()].sort((s, n) => (s.at || 0) - (n.at || 0)).slice(-g.diary))]); for (let s of ["settings", "profile", "usual"]) {
    let n = [...k, m].find(d => localStorage.getItem(d + s));
    if (!n)
        continue;
    let b = s === "usual" ? JSON.stringify(J(n, s).map(d => z({ product: d }).product)) : localStorage.getItem(n + s);
    o.push([s, b]);
} q(); let u = !0; for (let [s, n] of o)
    try {
        localStorage.setItem(m + s, n);
    }
    catch {
        u = !1;
    } if (u)
    for (let s of e)
        try {
            localStorage.removeItem(s);
        }
        catch { } return x.clear(), y.clear(), !0; }
var E = () => { let t = I("settings", {}); return { theme: ["light", "dark", "system"].includes(t.theme) ? t.theme : "system", language: ["en", "el"].includes(t.language) ? t.language : "", welcomed: t.welcomed === !0, feedback: t.feedback === !0, persistAsked: t.persistAsked === !0, recheckedAt: Number.isFinite(t.recheckedAt) && t.recheckedAt > 0 ? t.recheckedAt : 0, dismissed: Array.isArray(t.dismissed) ? t.dismissed.filter(e => typeof e == "string" && e.length < 30).slice(0, 12) : [] }; }, K = t => { l("settings", { ...E(), ...t }), c("settings"); }, nt = t => E().dismissed.includes(t), it = t => K({ dismissed: [...new Set([...E().dismissed, t])] }), Q = () => M(I("profile", W)), ct = t => { l("profile", M(t)), c("profile"); };
function B() { E().persistAsked || !globalThis.navigator?.storage?.persist || (K({ persistAsked: !0 }), navigator.storage.persisted().then(t => t || navigator.storage.persist()).catch(() => { })); }
var j = t => { if (!y.has(t)) {
    let e = I(t, []);
    y.set(t, (Array.isArray(e) ? e : []).map(r => { let a = A(r?.product); return a && Number.isFinite(r.at) ? { barcode: a.barcode, at: r.at, product: a } : null; }).filter(Boolean));
} return y.get(t).map(e => ({ ...e })); }, L = () => j("history");
function lt(product) {
 if(!product || !v(product.barcode)) return;
 const key=String(product.barcode).padStart(14,"0");
 const entries=L().filter(row=>String(row.barcode).padStart(14,"0")!==key);
 entries.unshift({barcode:product.barcode,at:Date.now(),product});
 l("history",entries.slice(0,g.history));
 if(product.provenance!=="local"&&!product.partial) yt([product]);
 c("history");
}
function dt() { l("history", []), c("history"); }
var S = () => j("saved"), ft = t => S().some(e => e.barcode === t);
function ut(t) { let e = S(), r = e.some(o => o.barcode === t.barcode), a = r ? e.filter(o => o.barcode !== t.barcode) : [{ barcode: t.barcode, at: Date.now(), product: t }, ...e].slice(0, g.saved); return l("saved", a), c("saved"), r || B(), !r; }
function pt(t, e = 0) { if (!t || !v(t.barcode))
    return !1; let r = S(); return r.some(a => a.barcode === t.barcode) ? !1 : (r.splice(Math.max(0, Math.min(e, r.length)), 0, { barcode: t.barcode, at: Date.now(), product: t }), l("saved", r.slice(0, g.saved)), c("saved"), B(), !0); }
function gt(t) { let e = S(), r = e.findIndex(o => o.barcode === t); if (r < 0)
    return null; let [a] = e.splice(r, 1); return l("saved", e), c("saved"), { entry: a, index: r }; }
function yt(t) { let e = new Map((t || []).filter(o => o && v(o.barcode)).map(o => [o.barcode, o])); if (!e.size)
    return 0; let r = 0, a = S().map(o => e.has(o.barcode) ? (r++, { ...o, product: e.get(o.barcode) }) : o); return r && (l("saved", a), c("saved")), r; }
function mt(t, e) { if (!e || !v(e.barcode))
    return null; let r = S(), a = r.findIndex(u => u.barcode === t); if (a < 0)
    return null; let o = r[a]; r[a] = { barcode: e.barcode, at: Date.now(), product: e }; let h = r.filter((u, s) => s === a || u.barcode !== e.barcode); return l("saved", h), c("saved"), o; }
var ht = t => [...S(),...L()].filter(e => String(e.barcode).padStart(14,"0") === String(t).padStart(14,"0")).sort((a,b)=>(b.product.fetchedAt||0)-(a.product.fetchedAt||0))[0]?.product || null, R = () => { let t = I("usual", []); return (Array.isArray(t) ? t : []).map(A).filter(Boolean); };
function X(t) { let e = (t || []).map(A).filter(Boolean).slice(0, g.usual); return e.length && l("usual", e) ? (c("usual"), e.length) : 0; }
var Z = (t = new Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`, tt = ["kcal", "protein", "carbohydrates", "sugars", "fat", "saturatedFat", "salt"];
function P(t) { if (!t || typeof t != "object" || !v(t.barcode) || !$(t.amount) || t.amount <= 0 || t.amount > 1e4 || !/^\d{4}-\d{2}-\d{2}$/.test(t.day))
    return null; let e = Object.fromEntries(tt.map(r => [r, $(t.nutrients?.[r]) ? t.nutrients[r] : null])); return { id: String(t.id || "").slice(0, 40) || `${t.day}-${t.barcode}-${Math.round(t.at || 0)}`, at: Number.isFinite(t.at) ? t.at : Date.now(), day: t.day, barcode: t.barcode, name: String(t.name || "").slice(0, 160), brand: String(t.brand || "").slice(0, 120), grade: /^[A-E]$/.test(t.grade) ? t.grade : null, amount: t.amount, unit: t.unit === "ml" ? "ml" : "g", nutrients: e }; }
var D = () => { if (!y.has("diary")) {
    let t = I("diary", []);
    y.set("diary", (Array.isArray(t) ? t : []).map(P).filter(Boolean));
} return y.get("diary").map(t => ({ ...t })); }, bt = t => D().filter(e => e.day === t).sort((e, r) => r.at - e.at);
function St(t) { let e = P({ ...t, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), day: t.day || Z() }); return e ? (l("diary", [...D(), e].slice(-g.diary)), c("diary"), B(), e) : null; }
function vt(t) { l("diary", D().filter(e => e.id !== t)), c("diary"); }
function xt() { return JSON.stringify({ app: "FoodScan", schema: 13, exportedAt: new Date().toISOString(), profile: Q(), history: L(), saved: S(), diary: D(), usual: R() }, null, 1); }
function wt(t) { if (typeof t != "string" || t.length > 5e6)
    throw new Error(O("Backup file is too large (maximum 5 MB).")); let e; try {
    e = JSON.parse(t);
}
catch {
    throw new Error(O("That file is not valid JSON."));
} if (e?.app !== "FoodScan")
    throw new Error(O("That file is not a FoodScan backup.")); let r = i => (Array.isArray(i) ? i : []).slice(0, 600).map(p => { let w = A(p?.product); return w ? { barcode: w.barcode, at: Number.isFinite(p.at) ? p.at : Date.now(), product: w } : null; }).filter(Boolean), a = (i, p, w) => { let C = j(i), _ = new Set(C.map(f => f.barcode)), F = new Map(C.map(f => [f.barcode, f])); for (let f of p)
    F.has(f.barcode) || F.set(f.barcode, f); let U = [...F.values()].sort((f, G) => G.at - f.at).slice(0, w); return l(i, U), U.filter(f => !_.has(f.barcode)).length; }, o = a("history", r(e.history), g.history), h = a("saved", r(e.saved), g.saved), u = D(), s = new Set(u.map(i => i.id)), n = []; for (let i of (Array.isArray(e.diary) ? e.diary : []).slice(0, 3e3)) {
    let p = P(i);
    p && !s.has(p.id) && (s.add(p.id), n.push(p));
} let b = [...u, ...n].slice(-g.diary), d = new Set(u.map(i => i.id)); return l("diary", b), e.profile && l("profile", M(e.profile)), Array.isArray(e.usual) && !R().length && X(e.usual), c("import"), { history: o, saved: h, diary: b.filter(i => !d.has(i.id)).length }; }
function At() { for (let t of [globalThis.localStorage, globalThis.sessionStorage])
    try {
        for (let e of Object.keys(t))
            V.test(e) && t.removeItem(e);
    }
    catch { } N.clear(), x.clear(), y.clear(), c("clear"); }
export { H as a, ot as b, st as c, E as d, K as e, nt as f, it as g, Q as h, ct as i, L as j, lt as k, dt as l, S as m, ft as n, ut as o, pt as p, gt as q, yt as r, mt as s, ht as t, R as u, X as v, Z as w, bt as x, St as y, vt as z, xt as A, wt as B, At as C };
