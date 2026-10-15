/** FoodScan 9.1 - one-glance, local-first daily dashboard.
 * All displayed items come from the profile-filtered projectState projection.
 * Package dates are reminders to check labels, never food-safety advice.
 */
import {escapeHTML as e} from './model.js';
import {icon as i} from './icons.js';
import {hasRestrictions} from './profile.js';
import {resolveProduct} from './policy.js';
import {amazonSearchLink,ASSOCIATE_DISCLOSURE} from './commerce.js';

function dayNumber(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
 const ts=Date.parse(`${value}T00:00:00Z`);
 return Number.isFinite(ts)?Math.floor(ts/86400000):null;
}
function relativeDate(days){
 if(days<0)return `Date passed ${Math.abs(days)} day${days===-1?'':'s'} ago`;
 if(days===0)return 'Package date today';
 if(days===1)return 'Package date tomorrow';
 return `Package date in ${days} days`;
}
export function todaySnapshot(s,now=Date.now()){
 const d=new Date(now),today=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
 const shopping=(s.store.shopping||[]).filter(x=>!x.checked&&x.intent==='buy-again');
 const pendingCodes=new Set(shopping.map(x=>x.barcode).filter(Boolean));
 const pendingNames=new Set(shopping.map(x=>x.name.toLocaleLowerCase()));
 const dated=(s.store.pantry||[]).map(x=>({item:x,days:dayNumber(x.expires)===null?null:dayNumber(x.expires)-today})).filter(x=>x.days!==null&&x.days<=3).sort((a,b)=>a.days-b.days);
 const low=(s.store.pantry||[]).filter(x=>x.runningLow&&!pendingCodes.has(x.barcode||'!')&&!pendingNames.has(x.name.toLocaleLowerCase()));
 const favorites=(s.store.saved||[]).filter(p=>!pendingCodes.has(p.barcode)).slice(0,2);
 return {shopping,dated,low,favorites,allLow:(s.store.pantry||[]).filter(x=>x.runningLow).length,allPantry:(s.store.pantry||[]).length,saved:(s.store.saved||[]).length,dayLabel:new Intl.DateTimeFormat(s.store.settings?.locale||'en-GB',{weekday:'long',month:'short',day:'numeric'}).format(d)};
}

function streakData(s){
 const days=[...new Set(s.store.habit?.activeDays||[])].sort(),set=new Set(days);let current=0;
 const d=new Date();d.setHours(0,0,0,0);
 for(let offset=0;offset<90;offset++){const x=new Date(d);x.setDate(d.getDate()-offset);const key=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;if(set.has(key))current++;else if(offset>0)break;}
 return {current,best:Math.max(current,s.store.habit?.bestStreak||0)};
}

export function todayView(s,primary=false){
 const heading=primary?'h1':'h2';
 const data=todaySnapshot(s),{shopping,dated,low,favorites}=data,streak=streakData(s);
 const strict=hasRestrictions(s.store.profile), hasList=shopping.length>0;
 const featuredOnline=shopping.map(x=>({item:x,product:x.barcode?resolveProduct(s,x.barcode):null})).map(x=>({...x,merchant:x.product?amazonSearchLink(x.product,s.store.settings.country):null})).find(x=>x.merchant);
 const attention=dated.slice(0,2).map(({item,days})=>`<a class="tdy-date-row" href="#pantry"><span class="tdy-dot" aria-hidden="true"></span><span><strong>${e(item.name)}</strong><small>${e(relativeDate(days))} · ${e(item.dateKind==='use-by'?'Use-by':item.dateKind==='best-before'?'Best-before':'Unspecified date')}</small></span>${i('chevron')}</a>`).join('');
 const replenish=low.slice(0,2).map(x=>`<div class="tdy-restock-row"><span>${i('package')} <strong>${e(x.name)}</strong></span><button class="tdy-small-action" data-action="pantry-buy" data-id="${e(x.id)}" aria-label="Add ${e(x.name)} to shopping list">${i('plus')} Add</button></div>`).join('');
 const favoritesHtml=favorites.map(p=>`<button class="tdy-fav" data-action="list-add" data-code="${e(p.barcode)}" aria-label="Add ${e(p.name)} to your list">${i('plus')} <span>${e(p.name)}</span></button>`).join('');
 return `<section class="tdy" aria-labelledby="tdy-title">
  <div class="tdy-top"><div><span class="tdy-eyebrow">YOUR EVERYDAY FOOD COMPANION <span aria-hidden="true">·</span> ${e(data.dayLabel)}</span><${heading} id="tdy-title">Everything for <em>today.</em></${heading}><p>Your list, your kitchen, and your next useful action — in one place.</p></div><div class="tdy-top-cta">${primary?`<button data-action="camera" class="tdy-scan-primary">${i('scan')} Scan a food</button>`:''}<a href="#shopping" class="tdy-open-list">Open full list ${i('arrow')}</a></div></div>
  <div class="d10-daily-line"><span>${i('spark')} <strong>${streak.current||1}-day food-smart rhythm</strong><small>Best ${streak.best||1} days · private on this device</small></span><a href="#insights">See my week ${i('arrow')}</a></div>
  <div class="tdy-totals" aria-label="Your local daily summary">
   <a href="#shopping" class="tdy-total"><span class="tdy-total-icon">${i('list')}</span><strong>${shopping.length}</strong><span>To buy</span></a>
   <a href="#pantry" class="tdy-total"><span class="tdy-total-icon">${i('package')}</span><strong>${data.allLow}</strong><span>Running low</span></a>
   <a href="#pantry" class="tdy-total"><span class="tdy-total-icon">${i('clock')}</span><strong>${dated.length}</strong><span>Dates to check</span></a>
   <a href="#saved" class="tdy-total"><span class="tdy-total-icon">${i('heart')}</span><strong>${data.saved}</strong><span>Saved foods</span></a>
  </div>
  ${s.withheld?.shopping?`<div class="tdy-withheld" role="note">${i('shield')} ${s.withheld.shopping} existing list item${s.withheld.shopping===1?' is':'s are'} hidden because their source data cannot confirm your current restrictions. <a href="#profile">Review your food profile</a></div>`:''}
  <div class="tdy-layout"><div class="tdy-list"><div class="tdy-pane-title"><span>${i('cart')} Grocery list</span>${hasList?`<button data-action="grocery-share" class="tdy-share">${i('share')} Share</button>`:''}</div>
   ${!strict?`<form id="today-add-form" class="tdy-add" aria-label="Quick add a grocery item"><label class="sr-only" for="today-item-name">Add grocery item</label><input name="name" id="today-item-name" placeholder="What do you need? Milk, tomatoes..." required minlength="2" maxlength="180" autocomplete="off"><button type="submit">${i('plus')} Add</button></form>`:`<div class="tdy-restricted">${i('shield')} Your food restrictions are active. Scan a packaged food to check it before adding it to this list. <button data-action="camera">Scan now ${i('arrow')}</button></div>`}
   ${hasList?`<div class="tdy-checklist">${shopping.slice(0,4).map(x=>`<label class="tdy-check-row"><input data-list-check="${e(x.id)}" type="checkbox" aria-label="Mark ${e(x.name)} bought and move to pantry"><span class="tdy-checkbox" aria-hidden="true">${i('check')}</span><span class="tdy-check-name">${e(x.name)}</span><small>${x.quantity>1?`${x.quantity} ×`:''}</small></label>`).join('')}</div>${shopping.length>4?`<a href="#shopping" class="tdy-more">+ ${shopping.length-4} more on your list ${i('arrow')}</a>`:''}<p class="tdy-micro">Tick when bought. FoodScan adds it to your pantry, with Undo.</p>`:`<div class="tdy-list-empty"><span class="tdy-empty-icon">${i('check')}</span><strong>${data.allPantry||data.saved?'Your list is clear.':'Start your first shopping list.'}</strong><p>${strict?'Use the scanner to add foods that match your restrictions.':'Add an item above. Your list is saved on this device and works offline.'}</p></div>`}
   <div class="tdy-list-footer"><a href="#shopping">Plan my shop ${i('chevron')}</a><button data-action="grocery-review">${i('spark')} Suggest from my foods</button>${hasList?`<button data-action="calendar-list">${i('clock')} Set reminder</button>`:''}</div>
   ${featuredOnline?`<div class="tdy-merchant"><span>${i('search')} Looking for <strong>${e(featuredOnline.item.name)}</strong> online?</span><a href="${e(featuredOnline.merchant.url)}" data-commercial-link="amazon" data-placement="today" rel="${featuredOnline.merchant.sponsored?'sponsored ':''}noopener noreferrer" target="_blank">Search Amazon${featuredOnline.merchant.sponsored?' · paid link':''} ${i('external')}</a><small>Merchant results may not match your package; verify product, price and availability. ${featuredOnline.merchant.sponsored?e(ASSOCIATE_DISCLOSURE):''}</small></div>`:''}
  </div>
  <div class="tdy-side">
   ${dated.length?`<section class="tdy-focus tdy-focus-amber" aria-label="Pantry dates needing attention"><div class="tdy-focus-label">${i('clock')} CHECK PACKAGE DATES</div>${attention}${dated.length>2?`<a class="tdy-text-link" href="#pantry">See all ${dated.length} dated items ${i('arrow')}</a>`:''}<p class="tdy-micro">Read the physical package, especially for use-by dates. Dates alone do not establish safety.</p></section>`:''}
   ${low.length?`<section class="tdy-focus tdy-focus-mint" aria-label="Items to restock"><div class="tdy-focus-label">${i('package')} RUNNING LOW</div>${replenish}${low.length>2?`<button class="tdy-text-link" data-action="grocery-review">Review ${low.length} restock suggestions ${i('arrow')}</button>`:''}</section>`:''}
   ${!hasList&&favorites.length?`<section class="tdy-focus tdy-focus-mint" aria-label="Reorder from saved foods"><div class="tdy-focus-label">${i('heart')} YOUR FAMILIAR FOODS</div><h3>Need one again?</h3>${favoritesHtml}</section>`:''}
   ${!dated.length&&!low.length&&(hasList||!favorites.length)?`<section class="tdy-focus tdy-focus-mint"><div class="tdy-focus-label">${i('spark')} NEXT EASY STEP</div><h3>${hasList?'Ready for the aisle?':'Know what’s in your kitchen.'}</h3><p>${hasList?'Check items off here while you shop, even offline.':'Keep a small pantry list so you remember what is running low.'}</p><a class="tdy-text-link" href="#${hasList?'shopping':'pantry'}">${hasList?'Open trip mode':'Open my pantry'} ${i('arrow')}</a></section>`:''}
   ${!s.installDismissed&&!s.standalone&&(hasList||data.saved||data.allPantry)?`<button class="tdy-install" data-action="install">${i('phone')} <span><strong>Add FoodScan to your home screen</strong><small>Open your list with one tap next time</small></span>${i('chevron')}</button>`:''}
  </div></div>
  <p class="tdy-privacy">${i('lock')} Your list, pantry and preferences stay on this device. No account required.</p>
 </section>`;
}
