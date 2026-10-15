/** Validated one-tap list substitution. Pure preparation; commitChange persists once. */
import {normalizeStore,shoppingRow,uid} from './store.js';
import {resolveProduct,requireEligible} from './policy.js';
import {betterChoices,usableCategories} from './nutrition.js';
import {validBarcode,validateStoredProduct} from './model.js';
import {canonicalCode} from './decision.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function swapOntoList(original,{baseCode,targetCode,category,records=[]},now=Date.now()){
 const store=normalizeStore(original),state={store,extraProducts:records.map(validateStoredProduct).filter(Boolean)};
 if(!validBarcode(baseCode)||!validBarcode(targetCode)||canonicalCode(baseCode)===canonicalCode(targetCode))throw Error('Choose two different product barcodes.');
 const base=resolveProduct(state,baseCode),target=resolveProduct(state,targetCode);
 if(!base||!target||base.partial||target.partial)throw Error('Open both complete product records before swapping.');
 requireEligible(base,store.profile);requireEligible(target,store.profile);
 if(!usableCategories(base).includes(category)||!target.categories?.includes(category))throw Error('The products do not share this recorded category.');
 const evidence=betterChoices(base,[target],store.profile,category).items[0];
 if(!evidence)throw Error('This swap no longer has a supported improvement for the current priorities. Refresh the comparison.');
 const pending=store.shopping.filter(r=>!r.checked&&r.intent==='buy-again');
 if(pending.some(r=>r.barcode&&canonicalCode(r.barcode)===canonicalCode(targetCode)))return {store,changed:false,reason:'The alternative is already on your list. The original was not changed.'};
 const originals=pending.filter(r=>r.barcode&&canonicalCode(r.barcode)===canonicalCode(baseCode));
 if(originals.length>1)throw Error('There is more than one original list entry. Choose the entry in your shopping list first.');
 const before=originals[0]||null;
 if(!before&&store.shopping.length>=200)throw Error('The shopping list is full. Remove a completed item first.');
 const after=shoppingRow({id:uid(),name:target.name,barcode:target.barcode,quantity:before?.quantity||1,unit:before?.unit||'item',aisle:before?.aisle||'',note:before?.note||'',priceCents:null,checked:false,intent:'buy-again',addedAt:now});
 const position=before?store.shopping.findIndex(r=>r.id===before.id):store.shopping.length;
 if(before)store.shopping.splice(position,1,after);else store.shopping.push(after);
 for(const p of [base,target])store.library=[p,...store.library.filter(x=>canonicalCode(x.barcode)!==canonicalCode(p.barcode))].slice(0,400);
 return {store,changed:true,mode:before?'replaced':'added',targetName:target.name,evidence,undo:{before:before?structuredClone(before):null,after:structuredClone(after),position}};
}
/** Never rewinds the whole store or overwrites a later price, note, purchase or pantry edit. */
export function undoListSwap(original,token){
 const store=normalizeStore(original);if(!token?.after?.id)throw Error('No reversible list swap was found.');
 const current=store.shopping.find(x=>x.id===token.after.id);
 if(!current||!same(current,token.after))throw Error('This list entry changed after the swap. Later edits were kept.');
 if(token.before&&store.shopping.some(x=>x.id===token.before.id))throw Error('The original entry was restored elsewhere; no entries were overwritten.');
 if(token.before&&store.shopping.some(x=>!x.checked&&x.intent==='buy-again'&&x.barcode&&canonicalCode(x.barcode)===canonicalCode(token.before.barcode)))throw Error('The original product was added again. Review the list rather than creating a duplicate.');
 const index=store.shopping.findIndex(x=>x.id===current.id);
 if(token.before)store.shopping.splice(index,1,structuredClone(token.before));else store.shopping.splice(index,1);
 return {store,changed:true};
}
