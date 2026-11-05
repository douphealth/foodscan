// src/domain/seo.js
var MIN_FIELDS = 6;
var MIN_INGREDIENTS = 20;
function indexWorthy(p, a = p ? assessGrade(p, { estimate: false }) : null) {
  const reasons = [];
  if (!p) return { index: false, reasons: ["missing"] };
  if (p.nameMissing) reasons.push("no-name");
  if (a?.status !== "reported") reasons.push(`grade-${a?.status || "missing"}`);
  if (p.partial) reasons.push("preview");
  if (String(p.ingredients || "").trim().length < MIN_INGREDIENTS) reasons.push("no-ingredients");
  if (fieldCount(p) < MIN_FIELDS) reasons.push("few-values");
  if (!["g", "ml"].includes(p.basis) || p.basisSource === "assumed") reasons.push("unit-unclear");
  return { index: reasons.length === 0, reasons };
}
var gtinKey = (code) => ({ 8: "gtin8", 12: "gtin12", 13: "gtin13", 14: "gtin14" })[String(code).length] || "gtin";
function canonicalCode(code) {
  const c = String(code || "");
  if (/^\d{12}$/.test(c)) return `0${c}`;
  if (/^0\d{13}$/.test(c)) return c.slice(1);
  return "";
}
function excerpt(text2, limit = 2e3) {
  const s = String(text2 || "").replace(/\s+/g, " ").trim();
  if (s.length <= limit) return { text: s, cut: false };
  const at = s.lastIndexOf(" ", limit - 1);
  return { text: `${s.slice(0, at > limit * 0.6 ? at : limit).replace(/[,;:\s]+$/, "")}…`, cut: true };
}

