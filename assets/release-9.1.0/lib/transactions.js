/** Prepare changes without mutation, then persist one complete localStorage value.
 * Each purchase gets its own pantry lot: new packages never inherit old expiry dates.
 */
import {normalizeStore,saveStore,uid,shoppingRow,pantryRow} from './store.js';
import {requireEligible,resolveProduct} from './policy.js';
import {normalizeProfile} from './profile.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function purchaseItem(original,itemId,now=Date.now()){
 const store=normalizeStore(original),item=store.shopping.find(x=>x.id===itemId);
 if(!item)throw Error('This shopping item no longer exists.');
 requireEligible(resolveProduct(store,item.barcode),store.profile);
 if(item.checked)return {store,changed:false,purchaseId:item.purchaseId};
 if(item.intent!=='buy-again')throw Error('Set this item to To buy before recording a purchase.');
 if(store.pantry.length>=200)throw Error('Pantry is full. Remove an old entry before marking this item bought.');
 if(store.purchases.length>=500){
  const active=new Set(store.shopping.filter(x=>x.checked).map(x=>x.purchaseId));
  const removable=store.purchases.findIndex(x=>!active.has(x.id));
  if(removable<0)throw Error('Purchase history is full. Keep a backup and remove completed list entries first.');
  store.purchases.splice(removable,1); // bounded ledger; never discard an active list item's undo record
 }
 const id=uid(),beforeShopping=structuredClone(item);
 const afterShopping=shoppingRow({...item,checked:true,purchaseId:id});
 const afterPantry=pantryRow({id:uid(),barcode:item.barcode,name:item.name,quantity:item.quantity,note:item.note,addedAt:now,purchasedAt:now,purchaseId:id});
 store.shopping=store.shopping.map(x=>x.id===itemId?afterShopping:x);
 store.pantry.push(afterPantry);
 store.purchases.push({id,at:now,undoneAt:null,name:item.name,barcode:item.barcode,quantity:item.quantity,shoppingId:itemId,pantryId:afterPantry.id,beforeShopping,afterShopping:structuredClone(afterShopping),afterPantry:structuredClone(afterPantry)});
 return {store,changed:true,purchaseId:id};
}
export function undoPurchase(original,purchaseId,now=Date.now()){
 const store=normalizeStore(original),entry=store.purchases.find(p=>p.id===purchaseId);
 if(!entry)throw Error('No reversible purchase was found.');
 if(entry.undoneAt!==null)return {store,changed:false,purchaseId};
 const shopping=store.shopping.find(x=>x.id===entry.shoppingId),pantry=store.pantry.find(x=>x.id===entry.pantryId);
 if(!same(shopping,entry.afterShopping)||!same(pantry,entry.afterPantry))throw Error('Cannot undo automatically: this list item or pantry lot changed after purchase. Your later edits were kept.');
 store.shopping=store.shopping.map(x=>x.id===entry.shoppingId?structuredClone(entry.beforeShopping):x);
 store.pantry=store.pantry.filter(x=>x.id!==entry.pantryId);
 entry.undoneAt=now;
 return {store,changed:true,purchaseId};
}
export function changeProfile(original,change){
 const store=normalizeStore(original);
 store.profile=normalizeProfile({...change(structuredClone(store.profile)),complete:true,updatedAt:Date.now()});
 return {store,changed:true};
}
export function commitChange(original,prepare,storage){
 const result=prepare(original);
 if(result.changed===false)return {...result,ok:true};
 const error=saveStore(result.store,storage);
 return error?{ok:false,error,store:original,changed:false}:{...result,ok:true};
}
