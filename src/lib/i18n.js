// src/lib/i18n.js
var dict = null;
var domainTranslator = null;
function setDomainTranslator(fn) { domainTranslator = typeof fn === "function" ? fn : null; }
var LANGUAGES = Object.freeze([["", "Automatic"], ["en", "English"], ["el", "Ελληνικά"]]);
var fill = (s, vars) => vars ? s.replace(/\{(\w+)\}/g, (m, k) => k in vars ? String(vars[k]) : m) : s;
var missing = /* @__PURE__ */ new Set();
if (typeof globalThis !== "undefined") globalThis.__fsMissing = missing;
function t(text2, vars) {
  if (domainTranslator) return domainTranslator(text2, vars);
  const hit2 = dict?.[text2];
  if (dict && hit2 === void 0 && typeof text2 === "string" && /[a-z]/i.test(text2)) missing.add(text2);
  return fill(hit2 ?? text2, vars);
}
var tn = (n, one, many, vars = {}) => t(n === 1 ? one : many, { n, ...vars });

