/** FoodScan 8 - local-only Grocery Trip selectors and transactions.
 * Never updates the active Food Profile. Does not create unverifiable product matches.
 */
import {AISLES,addShopping,normalizeStore,shoppingRow} from './store.js';
import {eligibility} from './profile.js';
import {resolveProduct,requireEligible} from './policy.js';
import {validBarcode} from './model.js';
export {AISLES};
const normalizeName=v=>String(v||'').trim().toLocaleLowerCase('en').replace(/\s+/g,' ');
const escapeRegExp=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const WORDS={produce:['banana','apple','orange','berries','grape','tomato','carrot','cucumber','lettuce','onion','potato','avocado','vegetable','fruit'],dairy:['milk','yogurt','yoghurt','cheese','butter','egg','kefir'],bakery:['bread','bagel','bun','croissant','tortilla','pita'],meat:['salmon','chicken','beef','turkey','fish','pork','shrimp'],frozen:['frozen','ice cream','icecream'],household:['soap','detergent','cleaner','tissue','toilet paper','dishwash','laundry']};
export function suggestAisle(name=''){
 const text=normalizeName(name);
 for(const [aisle,words] of Object.entries(WORDS))if(words.some(word=>new RegExp(`(^|[^a-z])${escapeRegExp(word)}(?:es|s)?([^a-z]|$)`,'i').test(text)))return aisle;
 return 'pantry';
}
export function assignedAisle(item){return AISLES.some(([k])=>k===item?.aisle)?item.aisle:suggestAisle(item?.name||'');}
/** Identity is exact barcode including package variant; manual entries never merge merely by aisle. */
export function itemKey(item){return validBarcode(item?.barcode)?`code:${String(item.barcode).padStart(14,'0')}`:`manual:${normalizeName(item?.name)}|${item?.unit||'item'}|${item?.quantity||1}`;}
const known=(store,item)=>item?.barcode?resolveProduct({store},item.barcode):null;
export function canOffer(store,item){return Boolean(item?.name)&&eligibility(known(store,item),store.profile).allowed;}
export function suggestions(store,{max=30}={}){
 const pending=new Set((store.shopping||[]).filter(x=>!x.checked&&x.intent==='buy-again').map(itemKey));
 const proposed=new Map();
 function offer(item,source,label,weight){
  if(!item?.name||!canOffer(store,item))return;
  const key=itemKey(item);if(pending.has(key))return;
  if(proposed.has(key)){
   const candidate=proposed.get(key);candidate.sources.add(label);candidate.weight=Math.max(candidate.weight,weight);return;
  }
  proposed.set(key,{key,name:item.name,barcode:item.barcode||'',quantity:item.quantity||1,unit:item.unit||'item',aisle:assignedAisle(item),source,sources:new Set([label]),weight});
 }
 for(const row of store.pantry||[])if(row.runningLow)offer(row,'pantry','Running low',100);
 const grouped=new Map();
 for(const record of store.purchases||[]){
  if(record.undoneAt!==null)continue;
  const item=record.afterShopping;if(!item)continue;
  const key=itemKey(item),previous=grouped.get(key);
  grouped.set(key,{item,count:(previous?.count||0)+1,when:Math.max(record.at,previous?.when||0)});
 }
 for(const {item,count} of grouped.values())if(count>=2)offer(item,'usual',`Bought ${count} times`,30+Math.min(count,10));
 for(const record of store.saved||[])offer({name:record.name,barcode:record.barcode,quantity:1,unit:'item'},'favorite','Saved food',10);
 return [...proposed.values()].sort((a,b)=>b.weight-a.weight||a.name.localeCompare(b.name)).slice(0,Math.max(0,Math.min(50,max))).map(x=>({...x,sources:[...x.sources]}));
}
export function tripSummary(store){
 const pending=(store.shopping||[]).filter(x=>!x.checked&&x.intent==='buy-again');
 const done=(store.shopping||[]).filter(x=>x.checked);
 const low=(store.pantry||[]).filter(x=>x.runningLow&&canOffer(store,x));
 const eligiblePending=pending.filter(x=>canOffer(store,x));
 const priced=eligiblePending.filter(x=>Number.isSafeInteger(x.priceCents));
 const estimatedCents=priced.reduce((sum,x)=>sum+x.priceCents*x.quantity,0);
 return {pending:eligiblePending.length,done:done.length,low:low.length,plannedCents:estimatedCents,priced:priced.length,unpriced:eligiblePending.length-priced.length,budgetCents:store.grocery?.budgetCents??null,startedAt:store.grocery?.startedAt||null};
}
export function money(cents,currency='EUR',locale='en-GB'){
 try{return new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:2}).format(cents/100);}catch{return `${(cents/100).toFixed(2)} ${currency}`;}
}
export function addReviewed(original,keys){
 if(!Array.isArray(keys))throw Error('Select grocery suggestions to add.');
 const store=normalizeStore(original),available=new Map(suggestions(store,{max:50}).map(x=>[x.key,x]));
 let added=0;const seen=new Set();
 for(const key of keys){
  if(typeof key!=='string'||seen.has(key))continue;seen.add(key);
  const candidate=available.get(key);if(!candidate)continue;
  requireEligible(known(store,candidate),store.profile);
  const result=addShopping(store,{name:candidate.name,barcode:candidate.barcode,quantity:candidate.quantity,unit:candidate.unit,aisle:candidate.aisle,intent:'buy-again',product:known(store,candidate)});
  if(result.created)added++;
 }
 return {store,changed:added>0,added};
}
export function editTripItem(original,itemId,fields){
 const store=normalizeStore(original),item=store.shopping.find(x=>x.id===itemId);
 if(!item)throw Error('This list entry does not exist.');
 if(item.checked)throw Error('Undo the purchase before editing this bought entry.');
 requireEligible(known(store,item),store.profile);
 const name=String(fields.name||'').trim();if(!name||name.length>180)throw Error('Enter a valid product name.');
 const quantity=Number(fields.quantity);if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw Error('Quantity must be 1 to 99.');
 const price=fields.price===''||fields.price==null?null:Number(fields.price);
 if(price!==null&&(!Number.isFinite(price)||price<0||price>9999.99||Math.round(price*100)!==price*100&&Math.abs(Math.round(price*100)-price*100)>1e-7))throw Error('Price must be an amount with up to two decimal places.');
 const edited=shoppingRow({...item,name,quantity,unit:fields.unit,aisle:fields.aisle,note:String(fields.note||'').slice(0,600),priceCents:price===null?null:Math.round(price*100)});
 store.shopping=store.shopping.map(x=>x.id===itemId?edited:x);
 return {store,changed:true};
}
export function editBudget(original,{budget,currency}){
 const store=normalizeStore(original),amount=budget===''||budget==null?null:Number(budget);
 if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>9999.99||Math.abs(Math.round(amount*100)-amount*100)>1e-7))throw Error('Budget must be 0–9,999.99 with up to two decimal places.');
 if(!['EUR','USD','GBP','CAD','AUD'].includes(currency))throw Error('Choose a supported currency.');
 store.grocery.budgetCents=amount===null?null:Math.round(amount*100);store.grocery.currency=currency;
 return {store,changed:true};
}
export function changeLowStock(original,itemId,value){
 const store=normalizeStore(original),row=store.pantry.find(x=>x.id===itemId);
 if(!row)throw Error('This pantry item no longer exists.');
 requireEligible(known(store,row),store.profile);
 store.pantry=store.pantry.map(x=>x.id===itemId?{...x,runningLow:value===true}:x);
 return {store,changed:true};
}
export function startTrip(original,now=Date.now()){
 const store=normalizeStore(original);if(store.grocery.startedAt)return {store,changed:false};
 store.grocery.startedAt=now;return {store,changed:true};
}
export function finishTrip(original,now=Date.now()){
 const store=normalizeStore(original);
 if(!store.grocery.startedAt)throw Error('Start your trip first.');
 if(!(store.shopping||[]).some(x=>x.checked))throw Error('Mark a purchase as bought before completing your trip.');
 store.grocery.startedAt=null;store.grocery.completedTrips=Math.min(10000,store.grocery.completedTrips+1);store.grocery.lastCompletedAt=now;
 return {store,changed:true};
}
