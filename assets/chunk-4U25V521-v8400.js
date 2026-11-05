import {peekProduct} from "./chunk-BIWX2LG4-v8400.js";
import { a as ie, b as le } from "./chunk-SN3WV521-v8400.js";
import { b as jt } from "./chunk-CMYEZZXL-v8400.js";
import { b as Yt, c as Jt, e as zt, g as Qt, h as Xt, i as ht } from "./chunk-6K2A3QNO-v8400.js";
import { b as st, d as it } from "./chunk-TM35ZLZG-v8400.js";
import { a as ce, b as de, c as ue, d as pe, e as fe, f as me, g as be, h as $t, i as ge, j as yt, k as he, l as $e, m as ye, n as lt } from "./chunk-I3TRV521-v8400.js";
import { d as yeCat, e as re, f as oe } from "./chunk-57E5ZLYU-v8400.js";
import { a as loadBundledDemo } from "./chunk-NAM4V521-v8400.js";
import { c as ee, d as ae } from "./chunk-AHTU2MHF-v8400.js";
import "./chunk-IO4NLMGT-v7540.js";
import { e as ne, f as se } from "./chunk-LGF5RK5L-v8400.js";
import { a as tt, b as Ht, d as Kt } from "./chunk-BIWX2LG4-v8400.js";
import { c as Zt, e as te } from "./chunk-4SO6OQI3-v8400.js";
import { a as Dt, b as qt, d as Gt, f as Z, l as nt, n as gt, o as Wt, r as Ut, s as Vt } from "./chunk-2OB4V521-v8400.js";
import { h as Pt, j as Ot, k as ft, m as Rt, n as mt, o as ot, t as bt, w as Lt, y as Mt } from "./chunk-JOUXBJOG-v8400.js";
import { k as Bt, o as Nt } from "./chunk-TTXUOT36-v8400.js";
import { c as h, d as E, e as I, g as v, i as U, j as Q, l as y } from "./chunk-4O7IN74N-v8400.js";
import { d as a, o as Et, q as It } from "./chunk-6K6QREZY-v8400.js";
var Be = new RegExp("́", "g"), ct = e => String(e).normalize("NFD").replace(Be, "").toUpperCase().normalize("NFC");
function wt(e, o, n, c, u, b, p, S) { let w = b; for (e.font = S(w); w > p && e.measureText(o).width > u;)
    w -= 1, e.font = S(w); e.fillText(o, n, c); }
var vt = { A: "#038141", B: "#85BB2F", C: "#FECB02", D: "#EE8100", E: "#D63A0F", none: "#66736C" }, St = { A: "#FFFFFF", B: "#16240A", C: "#2A2200", D: "#2A1600", E: "#FFFFFF", none: "#FFFFFF" }, et = "#0D1F16", dt = "#4F5E56", V = '"Fraunces", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif', O = '"Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
function ut(e, o, n, c, u, b, p) { let S = String(o).split(/\s+/), w = "", t = 0; for (let C = 0; C < S.length; C++) {
    let x = w ? `${w} ${S[C]}` : S[C];
    if (e.measureText(x).width > u && w) {
        if (t++, t >= p)
            return e.fillText(w.replace(/[ ,.;:]+$/, "") + "…", n, c), c + b;
        e.fillText(w, n, c), c += b, w = S[C];
    }
    else
        w = x;
} return w && (e.fillText(w, n, c), c += b), c; }
var we = e => new Promise(o => { let n = new Image; n.crossOrigin = "anonymous", n.referrerPolicy = "no-referrer", n.onload = () => o(n), n.onerror = () => o(null), setTimeout(() => o(null), 4e3), n.src = e; });
function R(e, o, n, c, u, b) { e.beginPath(), e.moveTo(o + b, n), e.arcTo(o + c, n, o + c, n + u, b), e.arcTo(o + c, n + u, o, n + u, b), e.arcTo(o, n + u, o, n, b), e.arcTo(o, n, o + c, n, b), e.closePath(); }
function ve(e, o, n, c, u) { e.fillStyle = vt[o], R(e, n, c, u, u, u * .26), e.fill(), e.fillStyle = St[o], e.textAlign = "center", e.textBaseline = "middle", e.font = `800 ${Math.round(u * .62)}px ${V}`, e.fillText(o, n + u / 2, c + u / 2 + u * .04), e.textAlign = "left", e.textBaseline = "alphabetic"; }
function drawBarcode(t, code, x, y, w, h, ink = "#0D1F16", bg = "#FFFFFF") {
    t.save();
    t.fillStyle = bg;
    R(t, x, y, w, h, 20);
    t.fill();
    let digits = String(code || "3017624010701").replace(/\D/g, "").padEnd(13, "0").slice(0, 13);
    let bx = x + 22, by = y + 14, bh = h - 44, bw = w - 44;
    t.fillStyle = ink;
    let seed = 0;
    for (let i = 0; i < digits.length; i++)
        seed = (seed * 31 + digits.charCodeAt(i)) >>> 0;
    let pos = bx, end = bx + bw;
    while (pos < end - 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        let barW = 1.2 + (seed % 3) * 1.4, gapW = 1.4 + ((seed >> 4) % 3) * 1.2;
        if (pos + barW > end)
            break;
        t.fillRect(pos, by, barW, bh);
        pos += barW + gapW;
    }
    t.font = `700 17px ${O}`;
    t.textAlign = "center";
    t.textBaseline = "alphabetic";
    t.fillText(digits.split("").join(" "), x + w / 2, y + h - 11);
    t.restore();
}
function drawSugarCubes(t, count, x, y, maxCubes = 5) {
    let n = Math.min(Math.max(0, Math.round(count)), maxCubes);
    for (let i = 0; i < n; i++) {
        let cx = x + i * 19, cy = y;
        t.save();
        t.shadowColor = "rgba(13,31,22,0.18)";
        t.shadowBlur = 4;
        t.shadowOffsetY = 2;
        t.fillStyle = "#FFFFFF";
        R(t, cx, cy, 15, 15, 4);
        t.fill();
        t.restore();
        t.strokeStyle = "#C8BFA3";
        t.lineWidth = 1.5;
        R(t, cx, cy, 15, 15, 4);
        t.stroke();
        t.fillStyle = "rgba(255,255,255,0.85)";
        t.fillRect(cx + 2, cy + 2, 11, 4);
    }
}
function buildHooks(e, o, alt) {
    let base = Ae(e, o, alt), sugars = e?.nutrition?.sugars, cubes = typeof sugars == "number" && sugars >= 8 ? Math.round(sugars / 4) : 0, swap = alt?.status === "better" ? alt.biggest || alt.better?.[0] : null;
    let viral = swap ? `I scanned ${e.name} (Nutri-Score ${o.grade || "–"}${cubes >= 4 ? `, ~${cubes} sugar cubes/100g` : ""}) on FoodScan → Better swap in the same aisle: ${swap.product.name} (Grade ${swap.to}${swap.reasons?.[0]?.text ? `, ${swap.reasons[0].text}` : ""})!` : cubes >= 4 ? `Would you eat ${cubes} sugar cubes per 100 g? 😱 Checked ${e.name} on FoodScan (${o.grade ? `Nutri-Score ${o.grade}` : a("Food report")}).` : o.grade === "A" ? `Finally a genuinely clean pick! ✅ ${e.name} scored Nutri-Score A on FoodScan.` : base;
    return [{ id: "verdict", label: a("Verdict"), text: base }, { id: "story", label: a("Viral hook"), text: viral }, { id: "clean", label: a("Short"), text: `${e.name}: ${o.grade ? `Nutri-Score ${o.grade}` : a("Food report")}${swap ? ` → Swap: ${swap.product.name} (${swap.to})` : ""} · FoodScan` }];
}
async function Se(e, o, { better: n = null, top: c = !1, reasons: u = [], link: b = "", variant: fmt = "post" } = {}) {
    try {
        await Promise.all([document.fonts.load("800 60px Fraunces"), document.fonts.load('500 28px "Instrument Sans"')]);
    }
    catch { }
    let isStory = fmt === "story", isDark = fmt === "receipt", isSwap = fmt === "swap", p = 1080, S = isStory ? 1920 : 1350, topPad = isStory ? 168 : 0, w = document.createElement("canvas");
    w.width = p, w.height = S;
    let t = w.getContext("2d"), C = o.grade || "none", x = vt[C], j = St[C], Y = t.createLinearGradient(0, 0, 0, S);
    isDark ? (Y.addColorStop(0, "#06120D"), Y.addColorStop(1, "#0C1E16")) : isSwap ? (Y.addColorStop(0, "#081C14"), Y.addColorStop(1, "#0F2E21")) : (Y.addColorStop(0, "#F6F1E4"), Y.addColorStop(1, "#EAE1CB")), t.fillStyle = Y, t.fillRect(0, 0, p, S);
    let darkTheme = isDark || isSwap;
    let X = t.createRadialGradient(p * .88, topPad + 260, 30, p * .88, topPad + 260, 920);
    X.addColorStop(0, `${n ? vt[n.to] || x : x}${darkTheme ? "55" : "36"}`), X.addColorStop(1, `${x}00`), t.fillStyle = X, t.fillRect(0, 0, p, S);
    let fg = darkTheme ? "#F5F2EA" : et, sub = darkTheme ? "#A3B8AD" : dt, surf = darkTheme ? "rgba(255,255,255,0.07)" : "#FFFFFF", stroke = darkTheme ? "rgba(255,255,255,0.15)" : "#DFD7C2", hy = topPad + 54;
    t.fillStyle = darkTheme ? "#1B8F5C" : "#0A5C3C", R(t, 64, hy, 52, 52, 15), t.fill(), t.strokeStyle = "#fff", t.lineWidth = 4, t.lineCap = "round", t.beginPath();
    for (let [l, P, L, N, pt, at] of [[76, hy + 18, 76, hy + 12, 82, hy + 12], [98, hy + 12, 104, hy + 12, 104, hy + 18], [104, hy + 34, 104, hy + 40, 98, hy + 40], [82, hy + 40, 76, hy + 40, 76, hy + 34]])
        t.moveTo(l, P), t.lineTo(L, N), t.lineTo(pt, at);
    t.moveTo(78, hy + 26), t.lineTo(102, hy + 26), t.stroke(), t.fillStyle = fg, t.font = `800 38px ${V}`, t.fillText("FoodScan", 132, hy + 38);
    let pillTxt = isSwap && n ? `★ ${ct(a("Swap & Upgrade"))}` : C === "A" || C === "B" ? ct(a("Clean Choice")) : C === "D" || C === "E" ? ct(a("Watch Out")) : ct(a("Label Audit"));
    t.font = `800 20px ${O}`;
    let pw = t.measureText(pillTxt).width + 42;
    t.fillStyle = darkTheme ? "rgba(108,224,166,0.16)" : "rgba(10,92,60,0.1)", R(t, p - 64 - pw, hy + 4, pw, 44, 22), t.fill(), t.fillStyle = darkTheme ? "#6CE0A6" : "#0A5C3C", t.textAlign = "center", t.fillText(pillTxt, p - 64 - pw / 2, hy + 33), t.textAlign = "left";
    let py = topPad + 130, H = prod => we(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(Dt(prod).__raw)}`), r = (e.image ? await we(e.image) : null) || await H(e);
    if (t.fillStyle = "#fff", R(t, 64, py, 164, 164, 34), t.fill(), r) {
        let l = e.image && r.width !== 120 ? 138 : 156, P = Math.min(l / (r.width || 120), l / (r.height || 120)), L = (r.width || 120) * P, N = (r.height || 120) * P;
        t.drawImage(r, 64 + (164 - L) / 2, py + (164 - N) / 2, L, N);
    }
    t.fillStyle = darkTheme ? "#6CE0A6" : "#0A5C3C", t.font = `800 23px ${O}`, t.fillText(ct((e.brand || a("Food report")).split(",")[0]).slice(0, 36), 256, py + 38), t.fillStyle = fg, t.font = `700 50px ${V}`;
    let B = ut(t, e.name, 256, py + 94, p - 256 - 64, 54, 2);
    t.fillStyle = sub, t.font = `600 24px ${O}`, t.fillText([e.quantity, e.nova ? `NOVA ${e.nova}` : "", o.score !== null ? `${o.score} pts` : ""].filter(Boolean).join("  ·  "), 256, Math.max(B + 4, py + 150));
    let _ = 64, k = topPad + 316, F = p - 128, d = isSwap && n ? 216 : 282;
    t.save(), t.shadowColor = `${x}66`, t.shadowBlur = 40, t.shadowOffsetY = 16;
    let f = t.createLinearGradient(_, k, _ + F, k + d);
    f.addColorStop(0, x), f.addColorStop(.55, x), f.addColorStop(1, Ne(x)), t.fillStyle = f, R(t, _, k, F, d, 40), t.fill(), t.restore();
    t.fillStyle = j === "#FFFFFF" ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.1)", R(t, _ + 28, k + 26, 142, 142, 34), t.fill(), t.fillStyle = j, t.textAlign = "center", t.textBaseline = "middle", t.font = `800 120px ${V}`, t.fillText(o.grade || "–", _ + 99, k + 102), t.textAlign = "left", t.textBaseline = "alphabetic", t.font = `800 21px ${O}`, t.fillText(o.status === "estimated" ? `NUTRI-SCORE 2023 · ${ct(a("Calculated"))}` : "NUTRI-SCORE 2023 · VERIFIED", _ + 198, k + 62);
    wt(t, o.grade ? Z[o.grade].word : o.status === "withheld" ? a("Grade on hold") : a("No grade"), _ + 196, k + 122, F - 230, 58, 38, l => `800 ${l}px ${V}`), t.font = `500 25px ${O}`, ut(t, o.grade ? Z[o.grade].line : o.status === "withheld" ? a("The record contradicts itself") : a("Not reported by the source"), _ + 198, k + 160, F - 230, 30, 2);
    if (!isSwap || !n) {
        let D = _ + 28, q = k + 198, G = F - 56, A = 54;
        t.fillStyle = "rgba(255,255,255,.95)", R(t, D, q, G, A, 18), t.fill();
        let K = (G - 12 - 32) / 5;
        Gt.forEach((l, P) => { let L = D + 6 + P * (K + 8), N = l === o.grade; t.globalAlpha = N ? 1 : .35, t.fillStyle = vt[l], N ? (R(t, L - 5, q - 5, K + 10, A + 10, 15), t.fill(), t.strokeStyle = "#fff", t.lineWidth = 4, t.stroke()) : (R(t, L, q + 5, K, A - 10, 12), t.fill()), t.fillStyle = St[l], t.textAlign = "center", t.textBaseline = "middle", t.font = `800 ${N ? 34 : 26}px ${V}`, t.fillText(l, L + K / 2, q + A / 2 + 2), t.textAlign = "left", t.textBaseline = "alphabetic", t.globalAlpha = 1; });
    }
    let my = k + d + 20, nut = e.nutrition || {}, fmtV = (v, dec = 1) => typeof v == "number" && Number.isFinite(v) ? new Intl.NumberFormat(void 0, { maximumFractionDigits: dec }).format(v) : "—", cubeCount = typeof nut.sugars == "number" && nut.sugars >= 4 ? Math.round(nut.sugars / 4) : 0, cubes = cubeCount ? `≈ ${cubeCount} ${a("cubes")}` : e.basis === "ml" ? a("per 100 ml") : a("per 100 g");
    let tiles = [
        { k: a("Energy"), v: typeof nut.kcal == "number" ? `${Math.round(nut.kcal)}` : "—", u: "kcal", sub: e.basis === "ml" ? a("per 100 ml") : a("per 100 g"), hi: !1 },
        { k: a("Sugars"), v: fmtV(nut.sugars), u: "g", sub: cubes, hi: typeof nut.sugars == "number" && nut.sugars > 22.5, cubes: cubeCount },
        { k: a("Sat. fat"), v: fmtV(nut.saturatedFat), u: "g", sub: e.basis === "ml" ? a("per 100 ml") : a("per 100 g"), hi: typeof nut.saturatedFat == "number" && nut.saturatedFat > 5 },
        { k: a("Salt"), v: fmtV(nut.salt, 2), u: "g", sub: e.nova ? `NOVA ${e.nova}` : a("per 100 g"), hi: typeof nut.salt == "number" && nut.salt > 1.5 }
    ], tw = (F - 36) / 4;
    tiles.forEach((tl, idx) => {
        let tx = _ + idx * (tw + 12);
        t.fillStyle = tl.hi ? (darkTheme ? "rgba(214,58,15,0.25)" : "#FFF0EB") : surf, R(t, tx, my, tw, 116, 22), t.fill(), t.strokeStyle = tl.hi ? "#E8590C" : stroke, t.lineWidth = 2, t.stroke();
        t.fillStyle = tl.hi ? "#FF9C8F" : sub, t.font = `700 18px ${O}`, t.fillText(tl.k.toUpperCase(), tx + 18, my + 30);
        t.fillStyle = fg, t.font = `800 33px ${V}`, t.fillText(`${tl.v} ${tl.u}`, tx + 18, my + 68);
        t.fillStyle = tl.hi ? (darkTheme ? "#FFB4A8" : "#D9480F") : sub, t.font = `600 18px ${O}`, t.fillText(String(tl.sub), tx + 18, my + 94);
        tl.cubes >= 2 && drawSugarCubes(t, Math.min(tl.cubes, 5), tx + tw - 112, my + 14, 5);
    });
    let W = my + 148;
    if (!isSwap || !n) {
        t.font = `600 28px ${O}`;
        for (let l of u.slice(0, isStory ? 4 : 2))
            t.fillStyle = l.tone === "up" ? "#1B8F5C" : l.tone === "down" ? "#D9480F" : "#8A978F", t.beginPath(), t.arc(88, W - 10, 9, 0, Math.PI * 2), t.fill(), t.fillStyle = fg, W = ut(t, l.text, 114, W, p - 114 - 64, 35, 2) + 11;
    }
    let swapY = isSwap && n ? my + 136 : isStory ? Math.max(W + 22, 1260) : Math.max(W + 4, 974);
    if (n) {
        let P = isSwap ? 396 : isStory ? 250 : 218;
        let altImg = (n.product?.image ? await we(n.product.image) : null) || await H(n.product);
        t.save();
        t.shadowColor = "rgba(3,129,65,0.32)";
        t.shadowBlur = 36;
        t.shadowOffsetY = 12;
        t.fillStyle = darkTheme ? "#0D2B1E" : "#FFFFFF", R(t, 64, swapY, p - 128, P, 36), t.fill(), t.restore();
        t.strokeStyle = "#1B8F5C", t.lineWidth = 3.5, R(t, 64, swapY, p - 128, P, 36), t.stroke();
        t.fillStyle = "#038141", R(t, 94, swapY + 22, 360, 38, 19), t.fill();
        t.fillStyle = "#FFFFFF", t.font = `800 19px ${O}`, t.fillText(`★  ${ct(a("Healthier choice found"))}`, 114, swapY + 47);
        let imgSize = isSwap ? 156 : 124, imgY = swapY + 74;
        t.fillStyle = "#FFFFFF", R(t, 94, imgY, imgSize, imgSize, 28), t.fill();
        if (altImg) {
            let sc = Math.min((imgSize - 18) / (altImg.width || 120), (imgSize - 18) / (altImg.height || 120)), dw = (altImg.width || 120) * sc, dh = (altImg.height || 120) * sc;
            t.drawImage(altImg, 94 + (imgSize - dw) / 2, imgY + (imgSize - dh) / 2, dw, dh);
        }
        let tx = 94 + imgSize + 24;
        t.fillStyle = darkTheme ? "#6CE0A6" : "#0A5C3C", t.font = `800 21px ${O}`;
        t.fillText(ct((n.product.brand || "FoodScan").split(",")[0]).slice(0, 30), tx, imgY + 30);
        t.fillStyle = fg, t.font = `700 ${isSwap ? 42 : 36}px ${V}`;
        ut(t, n.product.name, tx, imgY + 74, p - tx - 340, 40, isSwap ? 2 : 1);
        let reasonsList = (n.reasons || []).slice(0, isSwap ? 3 : 2);
        reasonsList.forEach((rs, ri) => {
            let ry = imgY + (isSwap ? 128 : 92) + ri * 38;
            t.fillStyle = darkTheme ? "rgba(27,143,92,0.28)" : "#DFF0E2";
            let rw = Math.min(520, t.measureText(rs.text).width + 42);
            R(t, tx, ry, rw, 32, 16);
            t.fill();
            t.fillStyle = darkTheme ? "#8CE9B8" : "#17693F";
            t.font = `700 21px ${O}`;
            t.fillText(`✓ ${rs.text}`, tx + 14, ry + 23);
        });
        if (isSwap) {
            let sNut = n.product.nutrition || {};
            let sy = swapY + 256;
            t.fillStyle = darkTheme ? "rgba(255,255,255,0.06)" : "#F4EFE2";
            R(t, 94, sy, p - 188, 112, 24);
            t.fill();
            t.fillStyle = fg;
            t.font = `700 24px ${O}`;
            t.fillText(`${a("Sugars")}: ${fmtV(sNut.sugars)} g (${a("vs")} ${fmtV(nut.sugars)} g)`, 120, sy + 44);
            t.fillText(`${a("Sat. fat")}: ${fmtV(sNut.saturatedFat)} g (${a("vs")} ${fmtV(nut.saturatedFat)} g)`, 120, sy + 84);
            n.product.nova && t.fillText(`NOVA ${n.product.nova}${e.nova ? ` (vs NOVA ${e.nova})` : ""}`, 580, sy + 44);
            t.fillStyle = darkTheme ? "#6CE0A6" : "#038141";
            t.font = `800 24px ${O}`;
            t.fillText(a("Same aisle · Source record checked"), 580, sy + 84);
        }
        ve(t, n.from || o.grade || "E", p - 330, swapY + 64, 70);
        t.strokeStyle = sub, t.lineWidth = 5, t.lineCap = "round", t.beginPath(), t.moveTo(p - 242, swapY + 99), t.lineTo(p - 198, swapY + 99), t.moveTo(p - 212, swapY + 85), t.lineTo(p - 198, swapY + 99), t.lineTo(p - 212, swapY + 113), t.stroke();
        ve(t, n.to, p - 182, swapY + 48, 98);
    }
    else if (c) {
        t.fillStyle = darkTheme ? "#0F291E" : "#FFFFFF", R(t, 64, swapY, p - 128, 150, 34), t.fill(), t.strokeStyle = "#1B8F5C", t.lineWidth = 3, t.stroke(), t.fillStyle = darkTheme ? "#6CE0A6" : "#0A5C3C", t.font = `800 23px ${O}`, t.fillText(`★  ${ct(a("Already the top grade"))}`, 98, swapY + 52), t.fillStyle = fg, t.font = `700 36px ${V}`, t.fillText(a("Nothing scores higher than an A."), 98, swapY + 104);
    }
    let footY = S - (isStory ? 228 : 124);
    return t.fillStyle = darkTheme ? "#6CE0A6" : "#0A5C3C", wt(t, b || "food-scan.gearuptofit.com", 64, footY + 42, p - 420, 29, 20, l => `800 ${l}px ${O}`), t.fillStyle = sub, t.font = `500 22px ${O}`, t.fillText(o.status === "estimated" ? a("Nutri-Score calculated by FoodScan from the label · not medical advice") : a("Nutri-Score as reported by Open Food Facts · not medical advice"), 64, footY + 78), drawBarcode(t, e.barcode, p - 324, footY - 4, 260, 94, et, "#FFFFFF"), new Promise(l => w.toBlob(l, "image/png"));
}
function Ne(e) { let o = parseInt(e.slice(1), 16), n = c => Math.round(c * .82).toString(16).padStart(2, "0"); return `#${n(o >> 16)}${n(o >> 8 & 255)}${n(o & 255)}`; }
var ke = e => String(e || "").replace(/^https?:\/\//, "").replace(/[?#].*$/, "");
var Fe = e => e ? h `<section class="wscta is-saved" aria-label="${a("Choice workspace")}"><span class="wscta__ic" aria-hidden="true">${y("check", 22)}</span><span class="wscta__txt"><b>${a("In your workspace")}</b><small>${a("Compare it and find better choices with your other picks.")}</small></span><a class="btn btn--soft btn--sm" href="#/choices">${a("Open")}${y("right", 16)}</a></section>` : h `<section class="wscta" aria-label="${a("Choice workspace")}"><span class="wscta__ic" aria-hidden="true">${y("layers", 22)}</span><span class="wscta__txt"><b>${a("Choosing between foods?")}</b><small>${a("Keep it with your other picks.")}</small></span><button type="button" class="btn btn--primary btn--sm" data-act="r:save-cta">${y("plus", 16)}${a("Add")}</button></section>`;
function Pe(e) { if (Xt(e))
    return h `<section class="viral-cta viral-cta--share" aria-label="${a("Share your result")}"><span class="viral-cta__mark" aria-hidden="true">${y("share", 21)}</span><div class="viral-cta__copy"><b>${a("Your scan is ready. Share it back?")}</b><small>${a("One link: they see this grade, the reasons and the better choice.")}</small></div><button type="button" class="viral-cta__button" data-act="r:share-verdict">${a("Share this result")}${y("right", 18)}</button></section>`; let o = Yt(); return h `<section class="viral-cta" aria-label="${o ? a("Scan your own food") : a("Scan the next product")}"><span class="viral-cta__mark" aria-hidden="true">${y("scan", 21)}</span><div class="viral-cta__copy"><b>${o ? a("What’s in your basket?") : a("Next item in your basket?")}</b><small>${a("No account · camera or manual entry")}</small></div><button type="button" class="viral-cta__button" data-act="r:scan-own">${o ? a("Scan your own food — free") : a("Scan the next product")}${y("right", 18)}</button></section>`; }
var Oe = () => h `<article class="report" aria-busy="true"><div class="hero hero--skel"><div class="hero__prod"><span class="skel skel--hero-img"></span><div class="hero__name"><i class="skel skel--line"></i><i class="skel skel--line short"></i></div></div><div class="skel skel--gauge"></div></div><div class="card"><i class="skel skel--line"></i><i class="skel skel--line short"></i></div><p class="sr" role="status">${a("Loading product")}</p></article>`, Te = (e, o = "") => h `<section class="card"><header class="card__head"><h2>${y("sliders", 18)}${a("Have the pack in your hand? Get its grade & swaps now")}</h2><span class="card__note">${a("Per 100 g")}</span></header>
  <p class="muted small">${a("Enter the pack values per 100 g and select its food category. FoodScan shows a calculated estimate only when the available data supports one grade. Missing values are not treated as zero. This input stays private; unsupported categories do not receive an estimated grade.")}</p>
  <div id="instant-calc" class="tiles">
    <label class="tile tile--wide"><small>${a("Product name (optional)")}</small><input id="ic-name" type="text" value="${o}" placeholder="${a("e.g. Greek Yogurt 2%")}"></label>
    <label class="tile tile--wide"><small>${a("Food category (to find healthier swaps)")}</small>
      <select id="ic-cat">
        <option value="en:sweet-spreads">${a("Chocolate & sweet spreads")}</option>
        <option value="en:breakfast-cereals">${a("Breakfast cereals, oats & muesli")}</option>
        <option value="en:yogurts">${a("Yogurt & dairy desserts")}</option>
        <option value="en:cheeses">${a("Cheese")}</option>
        <option value="en:breads">${a("Bread, toast & bakery")}</option>
        <option value="en:pastas">${a("Pasta, rice & grains")}</option>
        <option value="en:colas">${a("Sodas & soft drinks")}</option>
        <option value="en:fruit-juices">${a("Fruit juices & smoothies")}</option>
        <option value="en:salty-snacks">${a("Crisps, crackers & savoury snacks")}</option>
        <option value="en:biscuits">${a("Biscuits, cookies & wafers")}</option>
        <option value="en:chocolates">${a("Chocolate bars & snacks")}</option>
        <option value="en:plant-based-milk-alternatives">${a("Plant-based drinks (oat, almond, soy)")}</option>
        <option value="en:legumes">${a("Beans, lentils & vegetables")}</option>
      </select>
    </label>
    <label class="tile"><small>${a("Energy (kcal)")}</small><input id="ic-kcal" type="number" inputmode="decimal" min="0" max="900" step="1" placeholder="250"></label>
    <label class="tile"><small>${a("Sugars (g)")}</small><input id="ic-sugars" type="number" inputmode="decimal" min="0" max="100" step="0.1" placeholder="12"></label>
    <label class="tile"><small>${a("Sat. fat (g)")}</small><input id="ic-sat" type="number" inputmode="decimal" min="0" max="100" step="0.1" placeholder="3.5"></label>
    <label class="tile"><small>${a("Salt (g)")}</small><input id="ic-salt" type="number" inputmode="decimal" min="0" max="100" step="0.01" placeholder="0.8"></label>
    <label class="tile"><small>${a("Fibre (g, optional)")}</small><input id="ic-fiber" type="number" inputmode="decimal" min="0" max="100" step="0.1" placeholder="3.0"></label>
    <label class="tile"><small>${a("Protein (g, optional)")}</small><input id="ic-protein" type="number" inputmode="decimal" min="0" max="100" step="0.1" placeholder="8.0"></label>
    <p class="tile--wide small" id="ic-msg" role="alert"></p>
    <div class="row-actions row-actions--wrap tile--wide"><button type="button" class="btn btn--primary" data-act="r:calc-pack" data-arg="${e}">${y("sparkle", 18)}${a("Calculate grade & find swaps now")}</button></div>
  </div></section>`;
function Ce(e, o) {
    let n = Ht(e), c = e.code === "not_found";
    let u = c ? h `<a class="btn btn--soft" href="https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&amp;code=${o}" target="_blank" rel="noopener noreferrer">${y("plus", 18)}${a("Help add it to Open Food Facts")} ${y("external", 15)}</a><button type="button" class="btn btn--ghost" data-act="r:copy-code" data-arg="${o}">${y("share", 16)}${a("Copy barcode")}</button>` : e.retryable ? h `${Vt(a("Try again"), "r:retry", { ic: "refresh" })}<a class="btn btn--ghost" href="#/choices">${a("Open your workspace")}</a>` : h `<a class="btn btn--ghost" href="#/">${a("Back to start")}</a>`;
    let searchBox = c ? h `<section class="card"><header class="card__head"><h2>${y("search", 18)}${a("Find this product by name")}</h2></header><form class="finder" id="missing-finder" novalidate><label class="sr" for="missing-q">${a("Search products")}</label><input id="missing-q" type="search" placeholder="${a("Search by product name or brand…")}"><button class="btn btn--primary btn--icon" aria-label="${a("Search")}">${y("search", 20)}</button></form></section>` : "";
    return h `<div class="page">${c ? Te(o) : ""}${searchBox}${Ut({ icon: c ? "search" : "alert", title: n.title, body: h `${n.body}${c ? h ` ${a("Barcode")} <span class="mono">${o}</span>. ${a("Check the pack values with the calculator, search by name, or help add the package to Open Food Facts. A grade cannot be guaranteed from incomplete information.")}` : ""}`, tone: c ? "neutral" : "bad", actions: u })}</div>`;
}
var Re = () => h `<p><b>${a("The grade")}</b> ${a("is a Nutri-Score letter from the source record, or a clearly labelled FoodScan calculation where supported. The method is stated when available. The separate balance view is not Nutri-Score.")}</p>
<p><b>${a("How we keep it honest.")}</b> ${a("We show the point-by-point calculation only when it adds up to the reported score. If a record contradicts itself, for example a juice listed with 8 g of salt, the grade is put on hold rather than repeated. If the source has no grade, we say so instead of guessing.")}</p>
<p><b>${a("Points.")}</b> ${a("The number next to the letter is the Nutri-Score points total, not a mark out of 100: lower is better, and it can be negative. The strip under it shows which points each grade covers.")}</p>
<p><b>${a("No grade at the source?")}</b> ${a("For supported ordinary solid foods, FoodScan can show a calculated estimate when every permitted missing-value scenario gives the same letter. Otherwise it shows no estimate. Special-category calculations require the appropriate method; no grade is invented.")}</p>
<p><b>NOVA</b> ${a("is a separate 1 to 4 scale for how processed a food is, reported the same way.")}</p>
<p><b>${a("The limits.")}</b> ${a("A grade describes the product per 100 g or 100 ml. It can’t know your portion, your health needs, or what is best for your day. Use it to compare similar foods.")}</p>
<p><a class="link" href="#/how">${a("Read the full method")}</a></p>`, xe = e => JSON.stringify([e.name, e.brand, e.nutriScore, e.nova, e.nutrition, e.nutriScoreData, e.nutriScoreMethod, e.nutriScoreConflict, e.partial, e.allergens, e.traces, e.ingredients, e.analysis, e.image, e.qualityWarnings]), Le = 7 * 864e5, kt = "fs13:aisle", _e = (e, o) => o ? `${location.origin}/demo/` : `${location.origin}/p/${e}`;
function Ae(e, o, n) { let c = n?.status === "better" ? n.biggest || n.better?.[0] : null, u = o.grade ? Z[o.grade].word : o.status === "withheld" ? a("Grade on hold") : a("No grade"), b = o.grade ? `Nutri-Score ${o.grade} (${u}${o.status === "estimated" ? `, ${a("calculated by FoodScan")}` : ""})` : u, p = c ? ` → ${a("Better choice")}: ${c.product.name} (${a("Grade {grade}", { grade: c.to })}${c.reasons?.[0]?.text ? `, ${c.reasons[0].text}` : ""}).` : o.grade === "A" ? ` — ${a("Already the top grade")}.` : "."; return `${e.name}${e.brand ? ` (${e.brand.split(",")[0]})` : ""}: ${b}${p}`; }
async function Me(e, { code: o, demo: n = null }, c = {}) {
    let u = new AbortController, activeAlternativeAbort = null;
    c.signal?.addEventListener("abort", () => u.abort(), { once: !0 });
    let b = () => !u.signal.aborted, p = () => { u.abort(), activeAlternativeAbort?.abort(), e.oninput = null; }, S = Pt(), w = n ? "" : Bt(S), t = 0;
    if (n) {
        let r = n.product(o);
        if (r)
            return H(r, {}), p;
    }
    let C = peekProduct(o) || bt(o), x = C && !C.partial && C.schemaVersion === 10 && Date.now() - (C.fetchedAt || 0) < Le && !It(C);
    x ? (H(C, { instant: !0 }), ft(C)) : (e.setAttribute("aria-busy", "true"), E(e, Oe()));
    let j = performance.now();
    try {
        let r = await Kt(o, { signal: u.signal });
        if (!b())
            return p;
        it("lookup", { outcome: "found", cache: String(r.cache || "none").toLowerCase(), via: r.via, kind: x ? "instant" : "fresh", durationMs: st(j) }), ft(r.product);
        let B = Qt(r.product);
        (!x || B || xe(r.product) !== xe(C)) && H(r.product, { via: r.via, cache: r.cache, previousGrade: x ? nt(C).grade : null });
    }
    catch (r) {
        if (!b())
            return p;
        let B = r.retryable ? C : null;
        if (it("lookup", { outcome: String(r?.code || "network").replace(/[^a-z_]/g, "") || "network", cache: x || B ? "saved_copy" : "none", kind: x ? "instant" : "fresh", durationMs: st(j) }), x)
            return p;
        if (B) {
            H(B, { fromSaved: !0 });
            return p;
        }
        if (b()) {e.setAttribute("aria-busy","false");E(e,Ce(r,o));X();v("r:retry",()=>Me(e,{code:o,demo:n},c));document.title="FoodScan";}
    }
    return p;
    function Y(r = null) {
        let mf = e.querySelector("#missing-finder");
        mf && (mf.onsubmit = ev => { ev.preventDefault(); let qv = e.querySelector("#missing-q")?.value?.trim() || ""; qv.length >= 2 && (location.hash = `#/s/${encodeURIComponent(qv)}`); });
        v("r:copy-code", async (B) => { try {
            await navigator.clipboard.writeText(B.dataset.arg || o), U(a("Barcode copied"));
        }
        catch { } });
        v("r:calc-pack", () => {
            let B = A => e.querySelector(A)?.value ?? "", _ = ["#ic-kcal", "#ic-sugars", "#ic-sat", "#ic-salt"].map(A => B(A).trim()), k = e.querySelector("#ic-msg");
            if (_.some(A => A === "" || !Number.isFinite(Number(A)) || Number(A) < 0)) {
                k && (k.textContent = a("Enter all four values from the nutrition table."));
                return;
            }
            let [F, d, f, D] = _.map(Number), fibRaw = B("#ic-fiber").trim(), protRaw = B("#ic-protein").trim(), catVal = B("#ic-cat").trim() || "en:sweet-spreads";
            let fib = fibRaw !== "" && Number.isFinite(Number(fibRaw)) && Number(fibRaw) >= 0 ? Number(fibRaw) : null;
            let prot = protRaw !== "" && Number.isFinite(Number(protRaw)) && Number(protRaw) >= 0 ? Number(protRaw) : null;
            let q = B("#ic-name").trim() || r?.name || `${a("Barcode")} ${o}`;
            let G = Et({ status: 1, fetchedAt: Date.now(), product: { code: o, product_name: q, brands: r?.brand || "", image_front_url: r?.image || "", categories_tags: r?.categories?.length ? r.categories : [catVal], quantity: r?.quantity || "100 g", product_quantity_unit: r?.basis || "g", nutrition_data_per: r?.basis === "ml" ? "100ml" : "100g", nutriments: { "energy-kcal_100g": F, "energy-kj_100g": Math.round(F * 4.184), sugars_100g: d, "saturated-fat_100g": f, salt_100g: D, ...fib !== null ? { fiber_100g: fib } : {}, ...prot !== null ? { proteins_100g: prot } : {} } } }, o);
            G && (G.provenance="local",H(G,{via:"label",typed:!0}));
        });
    }
    function X() { Y(); }
    function H(r, { via: B = "", cache: _ = "", fromSaved: k = !1, typed: F = !1, previousGrade = null } = {}) {
        let d = { amount: te(r).find(s => s.primary)?.amount || (r.basis === "ml" ? 250 : 100), logged: !1, alt: null, amountValid: !0, frame: 0 }, f = nt(r), D = !n && mt(r.barcode), q = f.status === "withheld", G = Nt(r, S), A = !n, K = s => s ? a("Remove from your workspace") : a("Save to your workspace"), W = !F && !f.grade && f.status === "missing" && !["declined", "drink", "special"].includes(f.estimate?.reason);
        jt(f.grade, G.status === "conflict"), document.title = `${r.name} · ${f.grade ? `${a("Grade {grade}", { grade: f.grade })} · ` : ""}FoodScan`, E(e, h `<article class="report g-${f.grade || "none"}" data-grade="${f.grade || "none"}">
      <div class="report__bar"><button type="button" class="icon-btn" data-act="r:back" aria-label="${a("Back")}">${y("back", 22)}</button><span class="report__bar-title">${n ? h `<span class="ribbon">${a("Demo data")}</span>` : ""}<span class="mini" aria-hidden="true">${gt(f.grade, { size: "sm", label: !1, estimated: f.status === "estimated" })}<b>${r.name}</b></span></span>
        <button type="button" class="btn btn--soft btn--xs" data-act="r:share-verdict">${y("share", 15)}${a("Share verdict")}</button>
        <button type="button" class="icon-btn" data-act="r:aisle-compare" aria-label="${a("Compare two products")}" title="${a("Compare two products")}">${y("columns", 20)}</button>
        <button type="button" class="icon-btn" data-act="r:share" aria-label="${a("Share this grade")}" title="${a("Grade card image")}">${y("photo", 20)}</button>
        ${A ? h `<button type="button" class="icon-btn" id="save-btn" data-act="r:save" aria-pressed="${String(D)}" aria-label="${K(D)}">${y("bookmark", 21)}</button>` : ""}</div>
      ${previousGrade && previousGrade!==f.grade?h`<p class="banner banner--warn" role="status">${a("The source record changed since your saved copy. The current grade is shown below.")}</p>`:""}
      ${F ? h `<p class="banner banner--warn banner--slim" role="status">${y("info", 18)}<span>${a("Calculated from the label values you entered. Nothing is saved, and the product page shows the database record once it exists.")}</span></p>` : ""}
      ${k ? h `<p class="banner banner--warn banner--slim" role="status">${y("info", 18)}<span>${a("Showing your saved copy. The food database couldn’t be reached.")}</span></p>` : ""}
      <div class="report__grid"><div class="report__main">${ce(r, f)}${A ? Pe(r) : ""}${W ? Te(r.barcode, r.name) : ""}${de(G)}${A ? h `<div id="ws-cta">${Fe(D)}</div>` : ""}<div id="alt" aria-live="polite"></div></div>
        <div class="report__side" id="report-side"></div></div>
      <button type="button" class="altpill" id="altpill" data-act="r:to-alt" hidden></button></article>`), e.setAttribute("aria-busy", "false");
        let l = ++t, P = I("#report-side", e), L = () => { l !== t || !b() || !P?.isConnected || E(P, h `${ne(r, f)}${me(r, f)}${be(r)}<div id="portion">${yt(r, d.amount, d.logged)}</div>${he(r)}${$e(r)}${ye(r, f, { via: B, cache: _, saved: k })}${se(r, ae(r))}`); };
        requestAnimationFrame(() => setTimeout(L, 0)), Jt(r, { demo: !!n, typed: F });
        let N = e.querySelector("h1");
        N && !e.contains(document.activeElement) && (N.setAttribute("tabindex", "-1"), N.focus({ preventScroll: !0 }));
        let pt = () => { let s = I("#portion", e); s && E(s, yt(r, d.amount, d.logged)); }, at = () => [...d.alt?.better || [], d.alt?.biggest, ...d.alt?.peers || []].filter(Boolean);
        v("r:back", () => history.length > 1 ? history.back() : location.hash = "#/"), v("how-grade", () => Q(a("How the grade works"), Re()));
        let Ft = s => { let i = I("#save-btn", e); i && (i.setAttribute("aria-pressed", String(s)), i.setAttribute("aria-label", K(s))); let m = I("#ws-cta", e); m && E(m, Fe(s)), U(s ? a("Saved to your workspace") : a("Removed from your workspace")); };
        v("r:save", () => Ft(ot(r))), v("r:save-cta", () => Ft(ot(r))), v("r:save-swap", s => { let i = at().find(g => g.product.barcode === s.dataset.arg); if (!i)
            return; let m = ot(i.product); for (let g of e.querySelectorAll(`[data-act="r:save-swap"][data-arg="${i.product.barcode}"]`))
            g.setAttribute("aria-pressed", String(m)); U(m ? a("{name} added to your workspace", { name: i.product.name }) : a("Removed from your workspace")); }), v("r:quick-swap", s => { let i = at().find(g => g.product.barcode === s.dataset.arg); if (!i)
            return; mt(r.barcode) && ot(r); !mt(i.product.barcode) && ot(i.product); for (let g of e.querySelectorAll(`[data-act="r:save-swap"][data-arg="${i.product.barcode}"]`))
            g.setAttribute("aria-pressed", "true"); let sb = I("#save-btn", e); sb && (sb.setAttribute("aria-pressed", "false"), sb.setAttribute("aria-label", K(!1))); let wc = I("#ws-cta", e); wc && E(wc, Fe(!1)); U(`✨ ${a("{name} added to your workspace", { name: i.product.name })}`); }), v("portion", s => { d.amount = Number(s.dataset.arg) || d.amount, d.amountValid = !0, d.logged = !1, pt(); }), e.oninput = s => { if (!["amount", "amount-range"].includes(s.target?.id))
            return; let i = Number(s.target.value), m = I("#amount", e), g = I("#amount-range", e), T = s.target.value !== "" && Number.isFinite(i) && i >= 1 && i <= 2e3, $ = T ? "" : a("Enter an amount from 1 to 2000."); d.amountValid = T, m?.setCustomValidity($), m?.setAttribute("aria-invalid", String(!T)); let z = I("#amount-error", e); z && (z.textContent = $); let rt = e.querySelector('[data-act="log"]'); if (rt && (rt.disabled = !T), !T)
            return; m && s.target.id === "amount-range" && (m.value = String(i)), g && (g.max = String(Math.min(2e3, Math.max(600, Math.ceil(i / 100) * 100))), g.value = String(i), g.setAttribute("aria-valuetext", `${i} ${r.basis}`)); let Ie = d.logged; d.amount = i, d.logged = !1; let At = () => { if (!b() || !e.isConnected)
            return; let M = I("#portion-out", e); M && E(M, ge(r, d.amount)); }; cancelAnimationFrame(d.frame), s.target.id === "amount-range" ? d.frame = requestAnimationFrame(At) : At(); for (let M of e.querySelectorAll('[data-act="portion"]')) {
            let Tt = Number(M.dataset.arg) === i;
            M.classList.toggle("is-on", Tt), M.setAttribute("aria-checked", String(Tt));
        } if (Ie) {
            let M = I("#log-slot", e);
            M && E(M, $t(!1));
        } }, v("log", () => { if (!d.amountValid) {
            U(a("Enter an amount from 1 to 2000."), { tone: "bad" });
            return;
        } if (!Mt({ barcode: r.barcode, name: r.name, brand: r.brand, grade: f.status === "reported" ? f.grade : null, amount: d.amount, unit: r.basis === "ml" ? "ml" : "g", nutrients: Zt(r, d.amount), day: Lt() })) {
            U(a("That amount could not be saved."), { tone: "bad" });
            return;
        } d.logged = !0; let i = I("#log-slot", e); i && E(i, $t(!0)), U(a("Added to today")); }), (W || F) && Y(r), v("r:scan-own", () => { zt("report"), location.hash = "#/scan"; }), v("r:share-verdict", async (s) => { if (!s.dataset.busy) {
            s.dataset.busy = "1";
            try {
                let i = ht({ path: `/p/${r.barcode}`, kind: "product", via: s.closest(".viral-cta") ? "reshare" : "verdict", demo: !!n });
                n && (i.url = _e(r.barcode, n)), await ie({ title: `${r.name} · FoodScan`, text: Ae(r, f, d.alt), url: i.url, share: i });
            }
            finally {
                delete s.dataset.busy;
            }
        } }), v("r:aisle-compare", () => {
            let s = new Set([r.barcode]), i = [...Rt(), ...Ot()].map(g => g.product).filter(g => g && !s.has(g.barcode) && s.add(g.barcode)).slice(0, 8), m = () => { try {
                sessionStorage.setItem(kt, r.barcode);
            }
            catch { } location.hash = "#/scan"; };
            if (!i.length) {
                U(a("Scan or open a second product to compare side by side")), m();
                return;
            }
            Q(a("Compare two products"), h `<div class="plist">${i.map(g => h `<button type="button" class="prow prow--pick" data-act="r:pick-cmp" data-arg="${g.barcode}"><span class="prow__link"><span class="prow__img">${qt(g, { size: "sm" })}</span><span class="prow__text"><b>${g.name}</b><small>${g.brand?.split(",")[0] || g.barcode}</small></span>${gt(nt(g).grade, { size: "md" })}</span></button>`)}</div>
        <div class="row-actions"><button type="button" class="btn btn--primary btn--sm" data-act="r:scan-second">${y("scan", 16)}${a("Scan second product")}</button></div>`), v("r:pick-cmp", g => { let T = i.find($ => $.barcode === g.dataset.arg); T && Q(a("Side by side"), lt(r, { product: T, to: nt(T).grade || "A", tradeoffs: [] })); }), v("r:scan-second", m);
        }), v("r:share", () => { let s = ht({ path: `/p/${r.barcode}`, kind: "product", via: "card", demo: !!n }); n && (s.url = _e(r.barcode, n)); let altRes = d.alt?.status === "better" || d.alt?.status === "top" ? d.alt : yeCat(r, d.alt || { status: "none", better: [], peers: [], biggest: null }, S, w), bestSwap = altRes?.status === "better" ? altRes.biggest || altRes.better?.[0] : null, i = f.anatomy ? f.anatomy.why.filter(m => m.tone !== "note") : ee(r).map(m => ({ tone: m.tone === "good" ? "up" : "down", text: `${m.text}: ${m.detail}` })); le({ heading: a("Share this grade"), title: `${r.name} · FoodScan`, text: Ae(r, f, altRes), hooks: buildHooks(r, f, altRes), share: s, filename: `FoodScan-${r.barcode}.png`, makeImage: ({ variant: fmt = "post" } = {}) => Se(r, f, { better: bestSwap, top: altRes?.status === "top" || f.grade === "A", reasons: i, link: ke(s.url), variant: fmt }) }); });
        let J = I("#altpill", e), Ee = s => { let i = s?.status === "better" ? s.biggest || s.better[0] : null; if (J) {
            if (!i) {
                J.hidden = !0;
                return;
            }
            E(J, h `<span class="altpill__move" aria-hidden="true">${Wt(i.from, i.to)}</span><span class="altpill__text"><small>${a("Better choice found")}</small><b>${i.product.name}</b><span class="sr">${a("from grade {from} to grade {to}", i)}</span></span>${y("down", 18)}`), J.hidden = !1;
        } };
        if (v("r:to-alt", () => { let s = I("#alt", e); if (!s)
            return; s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); let i = s.querySelector("h2"); i && (i.setAttribute("tabindex", "-1"), i.focus({ preventScroll: !0 })); }), J && "IntersectionObserver" in window) {
            let q = 0, z = !1, s = new IntersectionObserver(([m]) => { if (z) return; let on = !m.isIntersecting && m.boundingClientRect.top > 0; if (!on) { if (q) { z = !0; J.classList.remove("is-on"); } return; } J.classList.add("is-on"); q ||= setTimeout(() => { z = !0; J.classList.remove("is-on"); }, 6000); }, { threshold: 0, rootMargin: "0px 0px -90px 0px" }), i = I("#alt", e);
            i && s.observe(i), u.signal.addEventListener("abort", () => s.disconnect(), { once: !0 });
        }
        let alternativeRequest=0,alternativeAbort=null,alternativePage=1,alternativeFamily="",alternativeMarket=w||"any";
        let retryClock=null;
        const stopRetryClock=()=>{if(retryClock){clearInterval(retryClock);retryClock=null;}};
        u.signal.addEventListener('abort',stopRetryClock,{once:true});
        function startRetryClock(panel){
          stopRetryClock();
          const tick=()=>{let waiting=false;for(const button of panel.querySelectorAll('[data-retry-at]')){
            const seconds=Math.max(0,Math.ceil((Number(button.dataset.retryAt)-Date.now())/1000));
            button.disabled=seconds>0;button.setAttribute('aria-disabled',String(seconds>0));
            const label=button.querySelector('[data-retry-label]');if(label)label.textContent=seconds?a('Check again in {s}s',{s:seconds}):a('Check again');waiting ||= seconds>0;
          }if(!waiting)stopRetryClock();};
          tick();if(panel.querySelector('[data-retry-at][disabled]'))retryClock=setInterval(tick,1000);
        }
        function panelCategory(){return e.querySelector("#alt-family")?.value||"";}
        async function Ct(force=false) {
          const panel=I("#alt",e);if(!panel)return;
          activeAlternativeAbort?.abort();alternativeAbort=new AbortController();activeAlternativeAbort=alternativeAbort;const controller=alternativeAbort,request=++alternativeRequest;
          const cancel=()=>controller.abort();u.signal.addEventListener("abort",cancel,{once:true});
          const current=()=>b()&&l===t&&request===alternativeRequest&&panel.isConnected;
          if(!current())return;const retained=d.alt&&d.alt.country===(alternativeMarket==='any'?'':alternativeMarket)?d.alt:null;
          stopRetryClock();if(retained&&(retained.better?.length||retained.peers?.length||retained.nutritionBetter?.length||retained.comparisonFoods?.length))E(panel,fe({...retained,refreshing:true},r,{isSaved:n?()=>false:mt,held:q}));else{d.alt=null;Ee({status:"loading"});E(panel,ue());}
          const started=performance.now();
          try {
            const checked=await re(r,S,{signal:controller.signal,source:n?.source,country:alternativeMarket,page:alternativePage,refresh:force,family:alternativeFamily,onProgress:progress=>{if(current()){E(panel,fe(progress,r,{isSaved:n?()=>false:mt,held:q}));}}});
            if(!current())return;
            const safeRetained=retained&&(retained.better?.length||retained.peers?.length||retained.nutritionBetter?.length||retained.comparisonFoods?.length)&&[...(retained.better||[]),...(retained.peers||[])].every(item=>Date.now()-(item.product?.fetchedAt||0)<86400000&&!(checked.invalidatedBarcodes||[]).includes(String(item.product?.barcode||'').padStart(14,'0')));
            const visible=checked.status==='error'&&safeRetained?{...retained,partialSearch:true,error:checked.error}:checked;
            d.alt=visible;E(panel,fe(visible,r,{isSaved:n?()=>false:mt,held:q}));Ee(visible);startRetryClock(panel);
            if(!n)it("alternative",{outcome:checked.status||"none",via:"full_record",durationMs:st(started)});
          }catch(error){
            if(current()&&!controller.signal.aborted){E(panel,fe({status:"error",error,country:alternativeMarket==="any"?"":alternativeMarket,better:[],peers:[]},r));startRetryClock(panel);}
          }finally{u.signal.removeEventListener("abort",cancel);}
        }
        v("alt-category",()=>{const value=panelCategory();if(!value)return;alternativeFamily=value;alternativePage=1;Ct();}),v("alt-retry",()=>Ct(false)),v("alt-live",()=>{alternativePage=1;Ct(true);}),v("alt-more",()=>{alternativePage++;Ct();}),
        v("alt-worldwide",()=>{alternativePage=1;alternativeMarket="any";Ct();}),
        v("alt-local",()=>{alternativePage=1;alternativeMarket=w||"any";Ct();}),
        v("r:compare", s => { let i = at().find(m => m.product.barcode === s.dataset.arg); i && Q(a("Side by side"), lt(r, i)); });
        let xt = e.querySelector(".report__bar"), _t = e.querySelector(".hero");
        if (xt && _t && "IntersectionObserver" in window) {
            let s = new IntersectionObserver(([i]) => xt.classList.toggle("is-mini", !i.isIntersecting && i.boundingClientRect.top < 0), { threshold: 0 });
            s.observe(_t), u.signal.addEventListener("abort", () => s.disconnect(), { once: !0 });
        }
        if (!F)
            try {
                let s = sessionStorage.getItem(kt);
                if (s && s !== r.barcode) {
                    sessionStorage.removeItem(kt);
                    let i = bt(s);
                    i && setTimeout(() => { b() && Q(a("Side by side"), lt(i, { product: r, to: f.grade || "C", tradeoffs: [] })); }, 140);
                }
            }
            catch { }
        Ct();
    }
}
export { Me as renderReport, _e as shareUrl, Ae as verdictText };
