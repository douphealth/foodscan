/* FoodScan 74 · helpers shared by the retailer web-shop sources. */
export const gtinOK = e => {
  if (!/^(\d{8}|\d{12,14})$/.test(e)) return false;
  const d = [...e.padStart(14, '0')].map(Number); let s = 0;
  for (let i = 0; i < 13; i++) s += d[i] * (i % 2 === 0 ? 3 : 1);
  return (10 - s % 10) % 10 === d[13];
};
/** GS1 restricted-circulation numbers (in-store codes) are only unique inside one retailer: never stored. */
export const restricted = c => { const e = String(c).replace(/^0+/, '') || '0'; return (e.length <= 8 && '02'.includes(e.padStart(8, '0')[0])) || (e.length === 13 && e[0] === '2') || (e.length === 12 && '24'.includes(e[0])); };
/** "1.234,56" / "2,39" / 2.39 -> number or null */
export const money = v => { if (v == null) return null; if (typeof v === 'number') return Number.isFinite(v) ? v : null; const n = Number(String(v).trim().replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
export const key14 = c => String(c).padStart(14, '0');
export const unescapeHTML = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).trim();
