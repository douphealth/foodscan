/** Optional merchant search, separate from OFF nutrition data.
 * A search result is not a verified Amazon catalog match or stock confirmation.
 * Configured US tag only. Do NOT copy a .com tag to another marketplace.
 * Market tags must be established in Associates Central before extending.
 */
import {validBarcode} from './model.js';
export const ASSOCIATE_DISCLOSURE='As an Amazon Associate I earn from qualifying purchases.';
const STORES=Object.freeze({
 'united-kingdom':'co.uk',germany:'de',austria:'de',france:'fr',spain:'es',italy:'it',canada:'ca',australia:'com.au',
 GB:'co.uk',UK:'co.uk',DE:'de',AT:'de',FR:'fr',ES:'es',IT:'it',CA:'ca',AU:'com.au',
 'united-states':'com',US:'com',USA:'com'
});
// Per-market tracking IDs, verified from the user's linked Associates stores (2026-10-13).
// Primary ID per market is used; alternates (papalexios*) are kept as backup in Associates Central.
const TAGS=Object.freeze({com:'papalex-20','co.uk':'papalex-21',de:'papalex0d-21',fr:'papalex0e-21',es:'papalex09-21',it:'papalex0ee-21',ca:'papalex01-20'});
const clean=v=>typeof v==='string'?v.replace(/[\x00-\x1f\x7f<>]/g,' ').replace(/\s+/g,' ').trim():'';
export function amazonSearchLink(p,country=''){
 if(!p||typeof p!=='object'||p.provenance==='local'||p.partial===true||!validBarcode(p.barcode))return null;
 const name=clean(p.name),brand=clean(p.brand);
 if(!name||name.toLowerCase()===`product ${p.barcode}`)return null;
 const market=STORES[country]||'com';
 const term=[brand,name].filter(Boolean).join(' ').slice(0,125);
 if(term.length<3)return null;
 const url=new URL(`https://www.amazon.${market}/s`);
 url.searchParams.set('k',term);
 const tag=TAGS[market];if(tag)url.searchParams.set('tag',tag);
 return {url:url.href,market,sponsored:Boolean(tag),query:term,matchVerified:false};
}
