/** FoodScan 11.15: versioned source parser with explicit data-quality protections. */
export * from '/assets/release-11.14.1/model.js';
import {parseProduct as sourceParse,validateStoredProduct as sourceValidate} from '/assets/release-11.3.0/lib/model.js?engine=11.12.0';
import {improveRecord,frontPhotos} from './record-quality.js';
export const VERSION='11.18.0';
function preferredLanguages(){
 try{return Array.isArray(navigator.languages)?navigator.languages:[navigator.language||'en'];}catch{return ['en'];}
}
export function parseProduct(payload,barcode,now){
 const parsed=sourceParse(payload,barcode,now);
 if(!parsed)return null;
 const raw=payload?.product;
 const enhanced=improveRecord(parsed,raw);
 const urls=frontPhotos(raw,parsed.barcode,preferredLanguages());
 enhanced.image=urls[0]||parsed.image||'';
 enhanced.imageCandidates=urls.slice(0,7);
 return enhanced;
}
export function validateStoredProduct(value){
 const parsed=sourceValidate(value);
 if(!parsed)return null;
 const checked=improveRecord(parsed);
 const allowed=frontPhotos({
  image_front_url:value?.image,image_url:value?.image,
  selected_images:{front:{display:Object.fromEntries((Array.isArray(value?.imageCandidates)?value.imageCandidates:[]).slice(0,8).map((x,j)=>['f'+j,x]))}}
 },parsed.barcode,preferredLanguages());
 checked.image=allowed.includes(parsed.image)?parsed.image:allowed[0]||parsed.image;
 checked.imageCandidates=[checked.image,...allowed].filter((v,j,all)=>v&&all.indexOf(v)===j).slice(0,7);
 // Metadata is revalidated and is never interpreted as a guarantee of laboratory accuracy.
 return checked;
}
