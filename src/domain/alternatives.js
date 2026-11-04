// src/domain/alternatives.js
var YEAR = 365.25 * 864e5;
var DELTAS = [
  { key: "sugars", label: "sugars", want: "lower", min: 2, rel: 0.25 },
  { key: "saturatedFat", label: "saturated fat", want: "lower", min: 1, rel: 0.25 },
  { key: "salt", label: "salt", want: "lower", min: 0.2, rel: 0.25 },
  { key: "fiber", label: "fibre", want: "higher", min: 1.5, rel: 0.25 },
  { key: "protein", label: "protein", want: "higher", min: 2, rel: 0.25 }
];
var fmt = (v) => new Intl.NumberFormat(void 0, { maximumFractionDigits: v < 20 ? 1 : 0 }).format(v);
function differences(current, cand) {
  if (!current || !cand || current.basis !== cand.basis || !["g", "ml"].includes(cand.basis)) return [];
  const unit = cand.basis === "ml" ? "100 ml" : "100 g", out = [];
  for (const d of DELTAS) {
    const a = current.nutrition?.[d.key], b = cand.nutrition?.[d.key];
    if (!known(a) || !known(b)) continue;
    const diff = b - a, size = Math.abs(diff);
    if (size < d.min || size < Math.max(a, b) * d.rel) continue;
    const good = d.want === "lower" ? diff < 0 : diff > 0;
    out.push({ key: d.key, good, size: size / Math.max(d.min, 1e-9), text: `${diff < 0 ? "−" : "+"}${fmt(size)} g ${t(d.label)}`, detail: t("{b} g vs {a} g per {unit}", { b: fmt(b), a: fmt(a), unit }) });
  }
  return out.sort((x, y) => Number(y.good) - Number(x.good) || y.size - x.size);
}

