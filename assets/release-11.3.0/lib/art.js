/** Illustration layer: everything here is drawn in code (no image files, no downloads, dark-mode safe).
 *  - packArt: a pleasant stand-in for products without a photo, shaped by what the product is
 *  - sugarCubes: sugar made tangible (one cube is one 4 g teaspoon)
 *  - barcodeBars: a real, valid EAN drawn as SVG
 *  - ART: illustrated empty states
 */
import {encodeEAN} from './barcode.js';

const PALETTES=[['#c98a4b','#f3d9b3'],['#d9674a','#f8cfc0'],['#4f9a69','#cfe9d5'],['#4c86b8','#cfe3f5'],['#8c6bd1','#e2d8f7'],['#d8a53a','#f7e5b5'],['#c4607f','#f6d3df'],['#3f9a97','#c9eae7']];
const hash=text=>{let h=7;for(const ch of String(text||''))h=(h*31+ch.charCodeAt(0))>>>0;return h;};
const has=(p,...words)=>(p.categories||[]).some(c=>words.some(w=>c.includes(w)));

export function packKind(p){
 if(has(p,'yogurt','yoghurt','dairies','cream-cheese','desserts','fermented-milk'))return 'tub';
 if(has(p,'sodas','colas','energy-drinks','canned','beers')||/can\b/i.test(p.serving||''))return 'can';
 if(p.basis==='ml'||has(p,'beverages','waters','juices','milks','drinks','plant-based-milk'))return 'bottle';
 if(has(p,'spreads','jams','honeys','sauces','pickles','condiments','peanut-butters'))return 'jar';
 if(has(p,'chips','crisps','snacks','cereals','breads','frozen'))return has(p,'chips','crisps')?'bag':'box';
 return 'box';
}
const SHAPES={
 jar:(a,b)=>`<rect x="38" y="14" width="44" height="18" rx="6" fill="#3b2c22"/><rect x="26" y="28" width="68" height="100" rx="20" fill="${a}"/><rect x="26" y="28" width="68" height="22" rx="14" fill="#fff" opacity=".16"/><rect x="34" y="62" width="52" height="46" rx="10" fill="${b}"/><circle cx="60" cy="82" r="11" fill="#fff" opacity=".8"/><rect x="42" y="98" width="36" height="4" rx="2" fill="${a}" opacity=".55"/><rect x="33" y="36" width="7" height="82" rx="3.5" fill="#fff" opacity=".22"/>`,
 bottle:(a,b)=>`<rect x="49" y="6" width="22" height="14" rx="4" fill="#3b2c22"/><path d="M51 20h18v14c0 8 14 14 14 28v62c0 6-5 10-11 10H48c-6 0-11-4-11-10V62c0-14 14-20 14-28Z" fill="${a}"/><rect x="38" y="66" width="44" height="44" rx="8" fill="${b}"/><circle cx="60" cy="88" r="10" fill="#fff" opacity=".8"/><path d="M44 50c3-8 8-9 8-16" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".3" fill="none"/>`,
 can:(a,b)=>`<ellipse cx="60" cy="26" rx="32" ry="9" fill="#d9dde0"/><rect x="28" y="26" width="64" height="94" fill="${a}"/><ellipse cx="60" cy="120" rx="32" ry="9" fill="${a}"/><rect x="28" y="52" width="64" height="40" fill="${b}"/><circle cx="60" cy="72" r="9" fill="#fff" opacity=".85"/><rect x="34" y="30" width="6" height="86" rx="3" fill="#fff" opacity=".25"/><ellipse cx="60" cy="26" rx="22" ry="5" fill="#b9c0c4"/>`,
 box:(a,b)=>`<rect x="28" y="12" width="64" height="116" rx="9" fill="${a}"/><rect x="28" y="12" width="64" height="20" rx="9" fill="#000" opacity=".12"/><rect x="36" y="44" width="48" height="60" rx="9" fill="${b}"/><path d="M42 90c8-18 14 6 20-10s14 4 18-8" stroke="${a}" stroke-width="4.5" stroke-linecap="round" fill="none"/><circle cx="52" cy="62" r="6" fill="#fff" opacity=".8"/><rect x="36" y="112" width="48" height="5" rx="2.5" fill="#fff" opacity=".4"/>`,
 tub:(a,b)=>`<rect x="30" y="22" width="60" height="14" rx="6" fill="#fff"/><path d="M34 36h52l-6 86c-.4 6-4 9-9 9H49c-5 0-8.600-3-9-9Z" fill="${a}"/><path d="M38 64h44l-1.600 28H39.600Z" fill="${b}"/><circle cx="60" cy="78" r="9" fill="#fff" opacity=".85"/><rect x="45" y="40" width="7" height="76" rx="3.500" fill="#fff" opacity=".18"/>`,
 bag:(a,b)=>`<path d="M30 14l6 5 6-5 6 5 6-5 6 5 6-5 6 5 6-5v8H30Z" fill="${a}"/><path d="M30 22h60l-5 104c-.2 5-4 8-8 8H43c-4 0-7.800-3-8-8Z" fill="${a}"/><rect x="38" y="50" width="44" height="56" rx="10" fill="${b}"/><circle cx="60" cy="78" r="12" fill="#fff" opacity=".8"/><path d="M52 78h16M60 70v16" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`
};
/** Inline SVG for a product with no photo. Colour comes from the brand so a shelf of products looks varied. */
export function packArt(p,{className=''}={}){
 const [a,b]=PALETTES[hash(p.brand||p.name)%PALETTES.length];
 return `<svg class="pack ${className}" viewBox="0 0 120 140" aria-hidden="true" focusable="false">${SHAPES[packKind(p)](a,b)}</svg>`;
}

/** One cube is one teaspoon (4 g) of sugar. Cubes arrive with a small stagger; capped so the picture stays calm. */
export function sugarCubes(grams,{max=24}={}){
 if(grams==null||!Number.isFinite(grams)||grams<=0)return '';
 const exact=grams/4,n=Math.max(1,Math.round(exact)),shown=Math.min(n,max),extra=n-shown;
 const label=n===1?'about 1 sugar cube':`about ${n} sugar cubes`;
 return `<div class="cubes" role="img" aria-label="${label}">${Array.from({length:shown},(_,i)=>`<i style="--i:${i}"></i>`).join('')}${extra>0?`<b class="cubes-more">+${extra}</b>`:''}</div>`;
}

/** A real, valid barcode as SVG in the current text colour. */
export function barcodeBars(code='5012345678900',{height=64}={}){
 let bits;try{bits=encodeEAN(code);}catch{bits=encodeEAN('5012345678900');}
 const pad=6,rects=[];
 for(let i=0;i<bits.length;i++)if(bits[i]==='1'){let j=i;while(bits[j+1]==='1')j++;rects.push(`<rect x="${i+pad}" y="0" width="${j-i+1}" height="${height}"/>`);i=j;}
 return `<svg class="barcode-art" viewBox="0 0 ${bits.length+pad*2} ${height}" preserveAspectRatio="none" fill="currentColor" aria-hidden="true" focusable="false">${rects.join('')}</svg>`;
}

/* ---------- illustrated empty states (colours come from theme variables, so dark mode just works) ---------- */
const svg=(body)=>`<svg class="empty-art" viewBox="0 0 160 120" aria-hidden="true" focusable="false">${body}</svg>`;
export const ART={
 basket:svg(`<ellipse cx="80" cy="108" rx="52" ry="7" fill="var(--line)"/><path d="M34 54h92l-9 46c-1 5-5 8-10 8H53c-5 0-9-3-10-8Z" fill="var(--butter)" stroke="var(--butter-ink)" stroke-width="3" stroke-linejoin="round"/><path d="M52 54l16-30M108 54L92 24" stroke="var(--butter-ink)" stroke-width="3.500" stroke-linecap="round"/><circle cx="62" cy="46" r="13" fill="#e8743b"/><circle cx="84" cy="40" r="12" fill="var(--olive-bright)"/><path d="M80 29c3-5 8-6 10-6-1 5-5 8-10 6Z" fill="var(--olive)"/><rect x="96" y="30" width="16" height="26" rx="6" fill="var(--lilac)" stroke="var(--lilac-ink)" stroke-width="2.500"/><path d="M52 70v22M68 70v22M84 70v22M100 70v22M116 70v22" stroke="var(--butter-ink)" stroke-width="2.500" stroke-linecap="round" opacity=".5"/>`),
 pantry:svg(`<ellipse cx="80" cy="108" rx="58" ry="7" fill="var(--line)"/><rect x="20" y="22" width="120" height="6" rx="3" fill="var(--bark)" opacity=".5"/><rect x="20" y="64" width="120" height="6" rx="3" fill="var(--bark)" opacity=".5"/><rect x="28" y="30" width="26" height="34" rx="9" fill="var(--peach)" stroke="var(--peach-ink)" stroke-width="2.500"/><rect x="31" y="22" width="20" height="9" rx="3" fill="var(--peach-ink)"/><rect x="66" y="36" width="28" height="28" rx="8" fill="var(--sage)" stroke="var(--sage-ink)" stroke-width="2.500"/><rect x="104" y="28" width="26" height="36" rx="9" fill="var(--butter)" stroke="var(--butter-ink)" stroke-width="2.500"/><rect x="30" y="72" width="40" height="30" rx="9" fill="var(--lilac)" stroke="var(--lilac-ink)" stroke-width="2.500"/><rect x="82" y="78" width="22" height="24" rx="7" fill="var(--peach)" stroke="var(--peach-ink)" stroke-width="2.500"/><rect x="112" y="72" width="22" height="30" rx="8" fill="var(--sage)" stroke="var(--sage-ink)" stroke-width="2.500"/>`),
 heart:svg(`<ellipse cx="80" cy="108" rx="44" ry="6" fill="var(--line)"/><path d="M80 98C40 72 32 52 44 38c9-10 24-8 36 6 12-14 27-16 36-6 12 14 4 34-36 60Z" fill="var(--peach)" stroke="var(--peach-ink)" stroke-width="3.500" stroke-linejoin="round"/><path d="M118 20l2.500 6 6 2.500-6 2.500-2.500 6-2.500-6-6-2.500 6-2.500ZM32 26l1.800 4 4 1.800-4 1.800-1.800 4-1.800-4-4-1.800 4-1.800Z" fill="var(--butter-ink)" opacity=".7"/>`),
 chart:svg(`<ellipse cx="80" cy="108" rx="54" ry="6" fill="var(--line)"/><rect x="30" y="62" width="22" height="40" rx="7" fill="var(--sage)" stroke="var(--sage-ink)" stroke-width="2.500"/><rect x="62" y="38" width="22" height="64" rx="7" fill="var(--butter)" stroke="var(--butter-ink)" stroke-width="2.500"/><rect x="94" y="52" width="22" height="50" rx="7" fill="var(--lilac)" stroke="var(--lilac-ink)" stroke-width="2.500"/><path d="M34 40l26-14 26 8 34-20" stroke="var(--terra)" stroke-width="3.500" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="120" cy="14" r="5" fill="var(--terra)"/>`),
 search:svg(`<ellipse cx="80" cy="108" rx="48" ry="6" fill="var(--line)"/><circle cx="72" cy="52" r="30" fill="var(--sage)" stroke="var(--sage-ink)" stroke-width="4"/><path d="M95 75l24 26" stroke="var(--sage-ink)" stroke-width="9" stroke-linecap="round"/><path d="M58 52h28M58 62h18" stroke="var(--terra)" stroke-width="4" stroke-linecap="round" opacity=".6"/><circle cx="62" cy="42" r="3.500" fill="var(--terra)"/>`)
};
