/** Compact, device-first Grocery Trip presentation. All user text is escaped. */
import {escapeHTML as e} from './model.js';
import {icon as i} from './icons.js';
import {AISLES,assignedAisle,suggestions,tripSummary,money} from './grocery.js';
import {resolveProduct} from './policy.js';
import {amazonSearchLink,ASSOCIATE_DISCLOSURE} from './commerce.js';
const labelAisle=k=>AISLES.find(([id])=>id===k)?.[1]||'Other';
const prettyQuantity=x=>`${x.quantity||1} ${x.unit==='item'?'item'+(x.quantity===1?'':'s'):e(x.unit||'items')}`;
const count=(value,one,many=one+'s')=>`${value} ${value===1?one:many}`;
const fieldsCurrency=(settings={})=>settings.grocery?.currency||'EUR';
const iconCircle=(name)=>`<span class="g8-icon-bubble" aria-hidden="true">${i(name)}</span>`;
export function tripWidget(s){
 const summary=tripSummary(s.store),available=suggestions(s.store),active=summary.pending>0;
 const restock=summary.low>0,usual=available.some(x=>x.source==='usual');
 const title=active?'Pick up where you left off':restock?'Ready for your next grocery trip?':usual?'Your usuals are ready':'A better grocery trip starts here';
 const text=active?`${count(summary.pending,'item')} still on your list. Continue at the next aisle.`:restock?`${count(summary.low,'pantry item')} marked running low. Review your restock list.`:usual?'Build a list from products you have purchased before.':'Scan a food or make a simple list. FoodScan remembers your choices only on this device.';
 const action=active?'grocery-open-list':available.length?'grocery-review':'grocery-open-list';
 const label=active?`Continue trip · ${summary.pending} left`:available.length?`Review ${available.length} suggested items`:'Start your list';
 return `<section class="g8-next" aria-label="Your next grocery action">
 <div class="g8-next-copy"><span class="g8-eyebrow">YOUR EVERYDAY FOOD COMPANION</span><h2>${e(title)}</h2><p>${e(text)}</p>
 <div class="g8-button-line"><button class="g8-primary" data-action="${action}">${i(active?'arrow':'list')} ${e(label)}</button><button class="g8-quiet" data-action="camera">${i('scan')} Scan a food</button></div>
 </div><div class="g8-next-art" aria-hidden="true"><span class="g8-art-orbit o1"></span><span class="g8-art-orbit o2"></span><span class="g8-art-basket">${i('cart')}</span><span class="g8-art-spark a">✦</span><span class="g8-art-spark b">✦</span></div></section>`;
}
function itemRow(s,x){
 const product=x.barcode?resolveProduct(s,x.barcode):null;
 const price=x.priceCents==null?'Price not entered':money(x.priceCents*x.quantity,s.store.grocery.currency,s.store.settings.locale);
 const amz=x.checked?null:product?amazonSearchLink(product,s.store.settings.country):null;
 return `<article class="g8-item ${x.checked?'g8-item-done':''}">
 <label class="g8-checkbox"><input data-list-check="${e(x.id)}" type="checkbox" ${x.checked?'checked':''} aria-label="Mark ${e(x.name)} ${x.checked?'not bought':'as bought and move to pantry'}"><span aria-hidden="true">${i('check')}</span></label>
 <div class="g8-item-info"><strong>${e(x.name)}</strong><div class="g8-item-meta">${e(prettyQuantity(x))} · ${x.aisle?e(labelAisle(x.aisle)):`<span title="Suggested aisle; edit to change">${e(labelAisle(assignedAisle(x)))} (suggested)</span>`}</div>${x.note?`<div class="g8-item-note">${e(x.note)}</div>`:''}</div>
 <div class="g8-item-end"><div class="g8-item-price">${e(price)}</div><div class="g8-item-actions">${x.barcode?`<a href="#food/${e(x.barcode)}" class="g8-mini" title="Open product record" aria-label="Open ${e(x.name)} product">${i('arrow')}</a>`:''}${!x.checked?`<button class="g8-mini" data-action="grocery-edit" data-id="${e(x.id)}" aria-label="Edit ${e(x.name)}">${i('settings')}</button>`:''}<button class="g8-mini" data-action="list-remove" data-id="${e(x.id)}" aria-label="Remove ${e(x.name)}">${i('trash')}</button></div></div>
 ${amz?`<div class="g8-commerce"><a data-commercial-link="amazon" data-placement="shopping" href="${e(amz.url)}" rel="${amz.sponsored?'sponsored ':''}noopener noreferrer" target="_blank" aria-label="Search Amazon for ${e(x.name)}, not a verified exact match">${i('search')} Search Amazon${amz.sponsored?' · paid link':''}</a></div>`:''}
 </article>`;
}
export function shoppingViewV8(s){
 const data=tripSummary(s.store),rows=s.store.shopping.filter(x=>!x.checked&&x.intent==='buy-again'),other=s.store.shopping.filter(x=>!x.checked&&x.intent!=='buy-again'),done=s.store.shopping.filter(x=>x.checked);
 const available=suggestions(s.store),currency=s.store.grocery.currency,locale=s.store.settings.locale;
 const groups=AISLES.map(([id,name])=>({id,name,items:rows.filter(x=>assignedAisle(x)===id)})).filter(x=>x.items.length);
 const totalLabel=money(data.plannedCents,currency,locale),pendingBudget=data.budgetCents==null?'Set a budget':money(data.budgetCents,currency,locale);
 const showPrice=data.priced>0,unpriced=data.unpriced;
 return `<div class="container g8 g8-shopping">
 <section class="g8-title-row"><div><span class="g8-eyebrow">GROCERY TRIP MODE</span><h1>Let's get <em>groceries.</em></h1><p class="g8-lead">A practical list, sorted by aisle. Purchases go straight into your pantry.</p></div><span class="g8-title-mark" aria-hidden="true">${i('cart')}</span></section>
 <section class="g8-trip-overview" aria-label="Trip summary"><div><span class="g8-overline">YOUR TRIP</span><strong>${count(rows.length,'item')} left</strong><small>${done.length} bought · ${data.low} low-stock pantry items</small></div><div class="g8-overview-actions"><button class="g8-primary" data-action="${data.startedAt?'grocery-finish':'grocery-start'}">${i(data.startedAt?'check':'arrow')} ${data.startedAt?'Finish trip':'Start trip'}</button><button class="g8-quiet light" data-action="grocery-review">${i('plus')} Suggested items${available.length?` (${available.length})`:''}</button></div></section>
 <div class="g8-utility-row"><button class="g8-utility-card" data-action="grocery-budget">${i('cart')}<span><strong>${showPrice?totalLabel:'No prices yet'}</strong><small>${showPrice?`${count(data.priced,'priced item')}${unpriced?` · ${unpriced} without price`:''} · partial estimate`: 'Enter your own prices and budget'}</small><small>Budget: ${e(pendingBudget)}</small></span>${i('chevron')}</button><a class="g8-utility-card" href="#pantry">${i('package')}<span><strong>My pantry</strong><small>${data.low} running-low item${data.low===1?'':'s'}</small></span>${i('chevron')}</a></div>
 <div class="g8-list-header"><div><span class="g8-eyebrow">SHOPPING LIST</span><h2>Buy what you need.</h2></div><div class="g8-header-tools"><button class="g8-text-button" data-action="grocery-share">${i('share')} Share list</button><button class="g8-text-button" data-action="grocery-review">${i('plus')} Build from my foods</button></div></div>
 <form id="shopping-form" class="g8-add-form" aria-label="Add a shopping item"><label class="sr-only" for="shopping-name">New shopping item</label><input name="name" id="shopping-name" placeholder="Add a grocery item..." required maxlength="180" autocomplete="off"><button type="submit" class="g8-primary">${i('plus')} Add</button></form>
 ${groups.length?groups.map(g=>`<section class="g8-aisle" aria-label="${e(g.name)}"><div class="g8-aisle-head"><span>${i('list')}</span><h3>${e(g.name)}</h3><small>${g.items.length}</small></div><div class="g8-items">${g.items.map(x=>itemRow(s,x)).join('')}</div></section>`).join(''):`<div class="g8-empty"><div class="g8-empty-icon">${i('list')}</div><h3>Your next trip starts here.</h3><p>Add a grocery item or review saved foods and pantry essentials. Nothing is added without your confirmation.</p><button class="g8-primary" data-action="grocery-review">${i('plus')} Review suggested items</button><button class="g8-quiet" data-action="camera">${i('scan')} Scan a package</button>${s.store.profile.avoids.length+s.store.profile.diets.length?'':`<div class="g8-staples"><span>Quick-add unverified list notes:</span>${['Milk','Eggs','Bananas','Bread'].map(name=>`<button type="button" data-action="grocery-staple" data-name="${name}">+ ${name}</button>`).join('')}</div>`}</div>`}
 ${other.length?`<section class="g8-aisle"><div class="g8-aisle-head"><span>${i('compare')}</span><h3>Compare or decide later</h3><small>${other.length}</small></div><div class="g8-items">${other.map(x=>itemRow(s,x)).join('')}</div></section>`:''}
 ${done.length?`<section class="g8-aisle"><div class="g8-aisle-head"><span>${i('check')}</span><h3>Already bought</h3><small>${done.length}</small><button data-action="clear-completed" class="g8-text-button">Clear</button></div><div class="g8-items">${done.map(x=>itemRow(s,x)).join('')}</div></section>`:''}
 <div class="g8-trip-foot"><span>${i('check')} Bought items create a separate pantry entry with Undo.</span><button class="g8-text-button" data-action="calendar-list">${i('clock')} Shopping reminder</button></div>
 <p class="g8-disclosure">${e(ASSOCIATE_DISCLOSURE)} Merchant search results do not verify a product match, stock or price. All grocery and profile information stays on your device.</p>
 </div>`;
}
export function reviewDialog(s){
 const candidates=suggestions(s.store),restricted=s.store.profile.avoids.length+s.store.profile.diets.length>0;
 const checks=candidates.map((x,n)=>`<label class="g8-suggest-row"><input type="checkbox" name="suggestion" value="${e(x.key)}" ${n<8?'checked':''}><span><strong>${e(x.name)}</strong><small>${e(x.sources.join(' · '))} · ${e(labelAisle(x.aisle))}</small></span></label>`).join('');
 return `<div class="modal-head"><h2>Build your next list</h2><button class="icon-button" data-action="close-dialog" aria-label="Close suggestion review">${i('close')}</button></div><p class="muted">Suggestions use only your local pantry, purchase history and saved foods. Review before adding; nothing is added automatically.</p><form id="g8-review-form"><div class="g8-suggest-list">${checks||`<div class="g8-empty-mini"><strong>No eligible suggestions yet.</strong><p>${restricted?'Your selected restrictions require an evidenced product match. Scan and save a matching item first.':'Save foods or mark pantry items running low to populate this list.'}</p><button type="button" class="button button-outline" data-action="camera">Scan a food</button></div>`}</div>${checks?`<button type="submit" class="g8-primary">${i('plus')} Add selected to my list</button>`:''}</form>`;
}
export function itemDialog(s,x){
 const currency=s.store.grocery.currency;
 return `<div class="modal-head"><h2>Edit grocery item</h2><button class="icon-button" data-action="close-dialog" aria-label="Close edit">${i('close')}</button></div><form id="g8-item-form" class="g8-dialog-form"><input type="hidden" name="id" value="${e(x.id)}"><label>Item name<input required name="name" maxlength="180" value="${e(x.name)}"></label><div class="g8-form-columns"><label>Quantity<input name="quantity" type="number" min="1" max="99" value="${x.quantity}" required></label><label>Unit<select name="unit">${['item','pack','bottle','bag','kg','g','L','ml'].map(v=>`<option value="${v}" ${x.unit===v?'selected':''}>${v}</option>`).join('')}</select></label></div><label>Store section<select name="aisle">${AISLES.map(([key,name])=>`<option value="${key}" ${assignedAisle(x)===key?'selected':''}>${e(name)}${!x.aisle&&assignedAisle(x)===key?' (suggested)':''}</option>`).join('')}</select></label><label>Your unit price (${e(currency)}, optional)<input name="price" type="number" step="0.01" min="0" max="9999.99" inputmode="decimal" placeholder="Not entered" value="${x.priceCents==null?'':(x.priceCents/100).toFixed(2)}"></label><label>Note<textarea name="note" maxlength="600" rows="3" placeholder="For example: unsweetened, 2-pack">${e(x.note||'')}</textarea></label><button class="g8-primary" type="submit">Save item</button></form><p class="small muted">Prices are entered by you and are not live store prices.</p>`;
}
export function budgetDialog(s){
 const grocery=s.store.grocery;
 return `<div class="modal-head"><h2>Your trip budget</h2><button class="icon-button" data-action="close-dialog" aria-label="Close budget">${i('close')}</button></div><p class="muted">Optional. Enter a budget and the currency you actually use. Prices are your own estimates, not merchant quotes.</p><form id="g8-budget-form" class="g8-dialog-form"><label>Budget amount (optional)<input type="number" name="budget" min="0" max="9999.99" step="0.01" inputmode="decimal" value="${grocery.budgetCents==null?'':(grocery.budgetCents/100).toFixed(2)}" placeholder="No budget"></label><label>Currency<select name="currency">${['EUR','USD','GBP','CAD','AUD'].map(x=>`<option value="${x}" ${grocery.currency===x?'selected':''}>${x}</option>`).join('')}</select></label><button type="submit" class="g8-primary">Save budget</button></form>`;
}
export function pantryBanner(s){
 const data=tripSummary(s.store),candidates=suggestions(s.store).filter(x=>x.source==='pantry');
 return `<section class="g8-pantry-next"><div><strong>${data.low?`${data.low} item${data.low===1?'':'s'} running low`:'Keep track of what needs restocking'}</strong><p>${data.low?'Review replenishment suggestions, then choose what to add to your next list.':'Mark items running low when you notice you need more.'}</p></div><button class="g8-primary" data-action="grocery-review">${i('list')} ${candidates.length?'Review restock':'Build a list'}</button></section>`;
}
