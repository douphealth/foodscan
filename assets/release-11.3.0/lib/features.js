/** Local-first feature controller. No auth, remote profile, analytics transport or paid service. */
import {escapeHTML as e,validBarcode,cleanBarcode,barcodeError,validateStoredProduct,FIELDS,formatValue} from './model.js';
import {normalizeProfile,assess,PRIORITIES,hasRestrictions} from './profile.js';
import {betterChoices,swapCountry,usableCategories} from './nutrition.js';
import {addShopping,addActivity,uid,calendarReminder,parseBackup,mergeProducts,normalizeStore} from './store.js';
import {searchCategory,searchProducts} from './api.js';
import {savePhoto,getPhoto,deletePhoto} from './photos.js';
import {icon as i} from './icons.js';
import {requireEligible,resolveProduct,rowEligibility,projectState} from './policy.js';
import {commitChange,purchaseItem,undoPurchase,changeProfile} from './transactions.js';
import {suggestions,addReviewed,editTripItem,editBudget,changeLowStock,startTrip,finishTrip} from './grocery.js';
import {reviewDialog,itemDialog,budgetDialog} from './grocery-ui.js';
import {swapOntoList,undoListSwap} from './swaps.js';
import {rawProducts} from './policy.js';
export function installDailyFeatures(c){
 const {state,view,render,go,toast,persist,openDialog,closeDialog,findProduct}=c;
 let photoCode='',pendingBackup=null,searchController=null,photoURL='';
 const download=(text,name,type='text/plain')=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 function updateProfile(change,control=null){
  const result=commitChange(state.store,s=>changeProfile(s,change));
  if(!result.ok){toast(result.error);render();return false;}
  state.store=result.store;c.clearToast?.();render({preserve:control});if(control)document.getElementById('gate-title')?.focus({preventScroll:false});return true;
 }
 function recordPurchase(itemId,bought){
  const item=state.store.shopping.find(x=>x.id===itemId);if(!item)return;
  const prepare=bought?s=>purchaseItem(s,itemId):item.purchaseId?s=>undoPurchase(s,item.purchaseId):s=>({store:{...s,shopping:s.shopping.map(x=>x.id===itemId?{...x,checked:false}:x)},changed:true});
  const result=commitChange(state.store,prepare);
  if(!result.ok){toast(result.error);render();return;}
  state.store=result.store;render();
  if(bought&&result.changed)toast('Bought: list, new pantry lot and purchase history updated.','Undo',()=>{try{const undo=commitChange(state.store,s=>undoPurchase(s,result.purchaseId));if(!undo.ok){toast(undo.error);return;}state.store=undo.store;render();toast('Purchase undone. Later unrelated changes were kept.');}catch(err){toast(err.message);}},10000);
  else if(!bought)toast(item.purchaseId?'Purchase undone; pantry lot removed.':'Legacy checkmark cleared; no pantry history existed.');
 }
 const saveSnapshot=p=>{if(p)state.store.library=[p,...state.store.library.filter(x=>x.barcode!==p.barcode)].slice(0,400);};
 function addList(product,name='',barcode=''){
  try{
   const result=commitChange(state.store,previous=>{
    const draft=normalizeStore(previous),action=addShopping(draft,{name:product?.name||name,barcode:product?.barcode||barcode,product});
    if(action.created&&product)draft.library=[product,...draft.library.filter(x=>x.barcode!==product.barcode)].slice(0,400);
    return {store:draft,changed:action.created,item:action.item};
   });
   if(!result.ok){toast(result.error);return false;}
   if(!result.changed){toast('Already on your shopping list. Edit it in Grocery Trip Mode.');return false;}
   state.store=result.store;render();addActivity(state.store,'list_added');persist();
   toast('Added to your shopping list.','Undo',()=>{
    const item=state.store.shopping.find(x=>x.id===result.item.id);
    if(!item||item.checked){toast('This item changed since it was added. Your later edits were kept.');return;}
    const revert=commitChange(state.store,old=>({store:{...old,shopping:old.shopping.filter(x=>x.id!==item.id)},changed:true}));
    if(!revert.ok){toast(revert.error);return;}state.store=revert.store;render();toast('List addition undone.');
   });return true;
  }catch(err){toast(err.message);return false;}
 }
 function focusOnboarding(){document.getElementById('onboard-title')?.focus({preventScroll:true});}
 function editPantry(item={}){requireEligible(resolveProduct(state,item.barcode),state.store.profile);openDialog(view.pantryDialog(state,item),'general');}
 function captureLabel(code){if(!validBarcode(code)){toast('Enter a valid barcode before saving its private label photo.');return;}photoCode=code;closeDialog();document.getElementById('label-photo-input').click();}
 async function showPhoto(code){
  try{const record=await getPhoto(code);if(!record){toast('No private label photo is stored for this barcode.');return;}
   if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(record.blob);
   openDialog(`<div class="modal-head"><h2>Your private label photo</h2><button class="icon-button" data-action="close-dialog" aria-label="Close label photo">${i('close')}</button></div><p>Saved on this device. No nutrition has been extracted or verified.</p><img src="${photoURL}" alt="Your saved package label for barcode ${code}" class="label-preview"><div class="button-row"><a class="button button-outline" href="${photoURL}" download="foodscan-label-${code}.jpg">Save photo copy</a><button class="button button-outline" data-action="delete-label" data-code="${code}">Delete private photo</button></div>`,'general');
  }catch(err){toast(err.message);}
 }
 function reminderDialog(){openDialog(`<div class="modal-head"><h2>A reminder, on your terms.</h2><button class="icon-button" data-action="close-dialog" aria-label="Close reminder">${i('close')}</button></div><form id="reminder-form"><label class="field-label">Shopping day<input type="date" name="day" required></label><p>Creates a calendar file on this device. Import it into your calendar to schedule a reminder. No account is connected and no notification is scheduled until you import it.</p><button class="button button-primary" type="submit">${i('download')} Create calendar file</button></form>`,'general');}
 function stopVoice(){try{recognition?.abort();}catch{}recognition=null;document.querySelectorAll('.voice-btn.listening').forEach(b=>b.classList.remove('listening'));}
 function offerVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('Voice search needs a browser with speech recognition. Type your search instead.');return;}
  openDialog(`<div class="dialog-pad"><div class="modal-head"><div><span class="eyebrow">Voice search</span><h2>Speak your search.</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close">${i('close')}</button></div><p>Your voice is processed by <strong>your browser\u2019s speech service</strong> — not by FoodScan. Nothing is stored by us either way, and you can always type instead.</p><div class="button-row"><button class="button button-primary" data-action="voice-confirm">${i('mic')} Start listening</button><button class="button button-outline" data-action="close-dialog">Type instead</button></div></div>`,'general');
 }
 let recognition=null;
 function startVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){offerVoice();return;}
  stopVoice();closeDialog();
  const btn=document.querySelector('[data-action="voice-search"]');btn?.classList.add('listening');
  recognition=new SR();recognition.lang=navigator.language||'en-US';recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onresult=event=>{const text=event.results?.[0]?.[0]?.transcript||'';stopVoice();const input=document.getElementById('quick-find-input')||document.getElementById('name-search-input');if(input&&text.trim()){input.value=text.trim();state.nameQuery=text.trim();void runNameSearch(text.trim());}};
  recognition.onerror=()=>{stopVoice();toast('Voice search didn\u2019t catch that. Try typing instead.');};
  recognition.onend=()=>stopVoice();
  try{recognition.start();toast('Listening… speak the food name.');}catch{stopVoice();toast('Voice search could not start. Type your search instead.');}
 }
 let nameSearchController=null;
 async function runNameSearch(q){
  const box=document.getElementById('quick-find-results')||document.getElementById('name-search-results');
  nameSearchController?.abort();const controller=nameSearchController=new AbortController();
  state.nameQuery=q;
  if(q.trim().length<2){state.nameResults={query:q,items:[],error:'Type at least 2 characters to search.'};if(box)box.innerHTML=`<div class="notice error" role="alert">${i('info')}<div>Type at least 2 characters to search.</div></div>`;return;}
  state.nameResults={query:q,loading:true,items:[]};
  if(box)box.innerHTML=`<div class="lookup-card" style="padding:1.4rem"><span class="spinner" style="width:36px;height:36px"></span><p class="muted">Searching Open Food Facts…</p></div>`;
  try{
   if(!state.online)throw new Error('You are offline. Reconnect to search by name, or scan a barcode.');
   const items=await searchProducts(q,{signal:controller.signal,full:hasRestrictions(state.store.profile)});
   if(controller.signal.aborted)return;
   state.nameResults={query:q,loading:false,items};
   state.extraProducts=mergeProducts(items,state.extraProducts,64);
   if(box)box.innerHTML=items.length?`<p class="small muted">${items.length} result${items.length===1?'':'s'} for \u201c${e(q)}\u201d · source: Open Food Facts</p><div class="food-grid mt-1">${items.map(p=>view.productCard(p,state)).join('')}</div>`:`<p class="muted">No packaged foods found for \u201c${e(q)}\u201d. Try the barcode instead.</p>`;
  }catch(err){if(err?.name==='AbortError')return;state.nameResults={query:q,loading:false,items:[],error:err.message||'Search failed.'};if(box)box.innerHTML=`<div class="notice error" role="alert">${i('info')}<div>${e(state.nameResults.error)}</div></div>`;}
 }
 document.addEventListener('close',event=>{if(event.target.querySelector('#voice-status'))stopVoice();const src=event.target.querySelector('.label-preview')?.getAttribute('src');if(src){URL.revokeObjectURL(src);if(src===photoURL)photoURL='';}},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopVoice();});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&state.onboarding===true&&document.querySelector('.onboard-overlay')&&!document.querySelector('dialog[open]')){
   state.onboarding=false;render();toast('No problem. Set your priorities anytime in Profile.');
  }
 });
 window.addEventListener('hashchange',()=>{stopVoice();if(searchController){searchController.abort();searchController=null;state.alternatives.loading=false;}});
 document.addEventListener('input',event=>{
  const t=event.target;
  if(t.dataset.threshold&&t.value!==''&&t.checkValidity())updateProfile(p=>({...p,thresholds:{...p.thresholds,[t.dataset.threshold]:Number(t.value)}}),t);
 });
 document.addEventListener('change',async event=>{
  const t=event.target;
  if(t.dataset.profile){
   if(t.closest('[data-quick-profile]'))state.quickSetupOpen=true;
   if(t.dataset.profile==='nut-bundle')updateProfile(p=>({...p,avoids:t.checked?[...new Set([...p.avoids,'nuts','peanuts'])]:p.avoids.filter(k=>!['nuts','peanuts'].includes(k))}),t);
   else {const group={priority:'priorities',avoid:'avoids',diet:'diets'}[t.dataset.profile];if(group)updateProfile(p=>({...p,[group]:t.checked?[...new Set([...p[group],t.value])]:p[group].filter(x=>x!==t.value)}),t);}
  }

  if(t.dataset.listCheck){try{recordPurchase(t.dataset.listCheck,t.checked);}catch(err){toast(err.message);render();}document.querySelector(`[data-list-check="${t.dataset.listCheck}"]`)?.focus({preventScroll:true});}
  if(t.dataset.listIntent){const item=state.store.shopping.find(x=>x.id===t.dataset.listIntent);if(item&&!item.checked&&rowEligibility(item,state).allowed&&['buy-again','compare-later','skip'].includes(t.value)){item.intent=t.value;persist();render();}}
  if(t.id==='trip-scan')state.tripScan=t.checked;
  if(t.id==='swap-category'){searchController?.abort();state.alternatives={...state.alternatives,category:t.value,items:[],checked:null,loading:false,error:'',fetchedAt:null};render();}
  if(t.id==='text-size'){state.store.settings.textSize=t.value;persist();document.documentElement.dataset.textSize=t.value;}
  if(t.id==='start-screen'){state.store.settings.home=t.value;persist();}
  if(t.id==='locale-setting'){try{state.store.settings.locale=Intl.getCanonicalLocales(t.value)[0]||'en-GB';persist();render();}catch{toast('Use a valid language-region tag such as en-GB or el-GR.');}}
  if(t.id==='country-setting'){state.store.settings.country=t.value;persist();state.swaps={code:'',status:'idle'};toast(t.value?'Swaps will favor products sold in your country.':'Country is now detected from your language.');}
  if(t.id==='reminders-setting'){state.store.settings.reminders=t.checked;persist();}
  if(t.id==='recap-setting'){state.store.settings.recap=t.checked;if(!t.checked)state.store.events=[];persist();render();toast(t.checked?'Local recap starts now. Nothing is sent to an analytics service.':'Local recap is off and its activity log has been deleted.');}
  if(t.id==='telemetry-setting'){state.store.settings.telemetry=t.checked;persist();render();toast(t.checked?'Anonymous usage counts are on. No food names, barcodes or profile choices are sent.':'Anonymous usage counts are off.');}
  if(t.id==='label-photo-input'&&t.files?.[0]){const file=t.files[0];t.value='';try{await savePhoto(photoCode,file);toast('Label photo saved privately on this device. No facts were extracted.');}catch(err){toast(err.message);}}
  if(t.id==='import-input'&&t.files?.[0]){const file=t.files[0];t.value='';if(file.size>3_000_000){toast('Choose a FoodScan backup smaller than 3 MB.');return;}
   try{pendingBackup=parseBackup(await file.text());const b=pendingBackup.store;openDialog(`<div class="modal-head"><h2>Restore a private backup.</h2><button class="icon-button" data-action="close-dialog" aria-label="Cancel import">${i('close')}</button></div><p>${b.saved.length} favorites, ${b.shopping.length} list items and ${b.pantry.length} pantry entries can be merged with this device. Matching IDs are updated. Private label photos are not part of JSON backups.</p><label class="check-label"><input id="restore-profile" type="checkbox">Also replace my Food Profile and display preferences</label><button class="button button-primary" data-action="confirm-import">Import this backup</button>`,'general');}catch(err){toast(err.message);}
  }
 });
 document.addEventListener('submit',event=>{
  if(event.target.id==='name-search-form'){event.preventDefault();void runNameSearch(String(new FormData(event.target).get('q')||''));}
  if(event.target.id==='quick-find-form'){event.preventDefault();const q=String(new FormData(event.target).get('query')||'').trim();if(/^[\d\s-]+$/.test(q))void lookup(q,{method:'manual'});else void runNameSearch(q);}
 });
 document.addEventListener('submit',async event=>{
  const form=event.target,id=form.getAttribute('id');if(!['profile-form','shopping-form','today-add-form','pantry-form','reminder-form','manual-food-form','report-form','g8-review-form','g8-item-form','g8-budget-form'].includes(id))return;event.preventDefault();const f=new FormData(form);
  try{
   if(id==='g8-review-form'){
    const keys=f.getAll('suggestion');if(!keys.length)throw Error('Choose at least one item.');
    const result=commitChange(state.store,old=>addReviewed(old,keys));
    if(!result.ok)throw Error(result.error);
    if(result.changed){state.store=result.store;closeDialog();go('shopping');toast(`${result.added} grocery item${result.added===1?'':'s'} added after your review.`);}
    else toast('Those items are already on your current list.');
   }
   if(id==='g8-item-form'){
    const result=commitChange(state.store,old=>editTripItem(old,String(f.get('id')||''),Object.fromEntries(f.entries())));
    if(!result.ok)throw Error(result.error);
    state.store=result.store;closeDialog();render();toast('Grocery details updated.');
   }
   if(id==='g8-budget-form'){
    const result=commitChange(state.store,old=>editBudget(old,Object.fromEntries(f.entries())));
    if(!result.ok)throw Error(result.error);
    state.store=result.store;closeDialog();render();toast('Your optional budget is saved on this device.');
   }
   if(id==='profile-form'){if(form.reportValidity())go('home');}
   if(id==='shopping-form'||id==='today-add-form'){if(addList(null,String(f.get('name')||''))){document.getElementById(id==='today-add-form'?'today-item-name':'shopping-name')?.focus({preventScroll:true});}}
   if(id==='pantry-form'){
    const existing=state.store.pantry.find(x=>x.id===f.get('id'));if(!existing&&state.store.pantry.length>=200)throw Error('Your pantry has 200 items. Remove an old entry first.');
    const item={...existing,id:existing?.id||uid(),name:String(f.get('name')||'').trim(),barcode:String(f.get('barcode')||''),quantity:Number(f.get('quantity')),dateKind:String(f.get('dateKind')),expires:String(f.get('expires')||''),remind:f.get('remind')==='on',addedAt:existing?.addedAt||Date.now()};
    if(!item.name)throw Error('Enter an item name.');requireEligible(resolveProduct(state,item.barcode),state.store.profile);state.store.pantry=existing?state.store.pantry.map(x=>x.id===item.id?item:x):[...state.store.pantry,item];saveSnapshot(findProduct(item.barcode));if(persist()){closeDialog();go('pantry');toast('Pantry item saved. The package date is your entry.');}
   }
   if(id==='reminder-form'){download(calendarReminder('Check my FoodScan shopping list',String(f.get('day'))),'foodscan-shopping-reminder.ics','text/calendar');closeDialog();toast('Calendar file created. Import it into your calendar to schedule the reminder.');}
   if(id==='manual-food-form'){
    const code=cleanBarcode(f.get('barcode')),invalid=barcodeError(code);if(invalid)throw Error(invalid);if(findProduct(code)?.provenance==='off')throw Error('A source record for this barcode is already stored. Use Report an issue rather than silently replacing it.');
    const nutrition=Object.fromEntries(FIELDS.map(([k])=>[k,f.get(k)===''?null:Number(f.get(k))]));const p=validateStoredProduct({barcode:code,name:String(f.get('name')),brand:String(f.get('brand')),nutrition,servingNutrition:{},ingredients:String(f.get('ingredients')),basis:String(f.get('basis')),provenance:'local',fetchedAt:Date.now(),sourceModified:Date.now()});
    if(!p)throw Error('Enter a valid product name and barcode.');saveSnapshot(p);state.store.recent=[p,...state.store.recent.filter(x=>x.barcode!==p.barcode)].slice(0,60);state.active=p;state.requested=code;if(persist()){closeDialog();go(`food/${code}`);toast('Your unverified entry is saved. It was not submitted to the public database.');}
   }
   if(id==='report-form'){
    const note=String(f.get('note')||'').trim(),code=String(f.get('barcode'));if(!note||!validBarcode(code))throw Error('Add the barcode and a description of the issue.');
    download(`FoodScan correction draft (NOT SUBMITTED)\nBarcode: ${code}\nCreated: ${new Date().toISOString()}\nSource: https://world.openfoodfacts.org/product/${code}\n\nUser observation (unverified):\n${note.slice(0,1500)}\n\nNo Food Profile data is included. Submit corrections separately on the source website.\n`,`foodscan-correction-${code}.txt`);addActivity(state.store,'correction_draft');persist();closeDialog();toast('Correction draft downloaded. No report has been submitted to Open Food Facts.');
   }
  }catch(err){toast(err.message||'That change could not be saved.');}
 });
 document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action,code=b.dataset.code;const product=findProduct(code);
  try{
   if(['list-add','pantry-add','alternatives','swap-save','swap-open'].includes(action))requireEligible(product,state.store.profile);
   if(['list-pantry','pantry-edit','pantry-buy','pantry-calendar','quantity-plus','quantity-minus'].includes(action)){
    const row=(action.startsWith('pantry')?state.store.pantry:state.store.shopping).find(x=>x.id===b.dataset.id);
    requireEligible(resolveProduct(state,row?.barcode),state.store.profile);
   }
   switch(action){
   case 'decision-profile-open':state.quickSetupOpen=true;render();break;
   case 'decision-profile-done':{state.quickSetupOpen=false;updateProfile(p=>p);break;}
   case 'decision-swap':{
    const request={baseCode:b.dataset.base,targetCode:code,category:b.dataset.category,records:rawProducts(state)};
    const result=commitChange(state.store,old=>swapOntoList(old,request));
    if(!result.ok)throw Error(result.error);
    if(!result.changed){toast(result.reason);break;}
    state.store=result.store;render();
    toast(result.mode==='replaced'?"Swapped on today's list. Quantity kept; old price cleared.":"Alternative added to today's list.",'Undo',()=>{
      try{const inverse=commitChange(state.store,old=>undoListSwap(old,result.undo));if(!inverse.ok)throw Error(inverse.error);state.store=inverse.store;render();toast('List swap undone. Other changes were kept.');}catch(err){toast(err.message);}
    },12000);break;
   }
   case 'grocery-open-list':go('shopping');break;
   case 'grocery-staple':if(['Milk','Eggs','Bananas','Bread'].includes(b.dataset.name)){addList(null,b.dataset.name);}break;
   case 'grocery-share':{
    const lines=state.store.shopping.filter(x=>!x.checked&&x.intent==='buy-again'&&rowEligibility(x,state).allowed).map(x=>`${x.quantity} ${x.unit==='item'?'×':x.unit} ${x.name}${x.note?` — ${x.note}`:''}`);
    if(!lines.length){toast('Add an eligible shopping item before sharing your list.');break;}
    const message=`My FoodScan grocery list\n\n${lines.join('\n')}\n\nShared manually by me. Product details should be checked on the package.\n\nMake your own private list with FoodScan: ${location.origin}/`; 
    try{if(navigator.share)await navigator.share({title:'My FoodScan grocery list',text:message});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(message);toast('Your grocery list was copied. Nothing was uploaded by FoodScan.');}else{download(message,'foodscan-shopping-list.txt');toast('List downloaded as a text file.');}}
    catch(err){if(err?.name!=='AbortError'){download(message,'foodscan-shopping-list.txt');toast('Your list was downloaded. FoodScan has not sent it anywhere.');}}
    break;
   }
   case 'grocery-review':openDialog(reviewDialog(projectState(state)),'general');break;
   case 'grocery-edit':{const item=state.store.shopping.find(x=>x.id===b.dataset.id);if(item){requireEligible(resolveProduct(state,item.barcode),state.store.profile);openDialog(itemDialog(projectState(state),item),'general');}break;}
   case 'grocery-budget':openDialog(budgetDialog(projectState(state)),'general');break;
   case 'grocery-start':{
    const result=commitChange(state.store,old=>startTrip(old));if(!result.ok)throw Error(result.error);
    state.store=result.store;render();toast('Trip started. Your list works offline.');break;
   }
   case 'grocery-finish':{
    const result=commitChange(state.store,old=>finishTrip(old));if(!result.ok)throw Error(result.error);
    state.store=result.store;render();toast('Grocery trip recorded locally. Keep your pantry up to date.');break;
   }
   case 'pantry-low':{
    const item=state.store.pantry.find(x=>x.id===b.dataset.id);if(!item)break;
    const previous=item.runningLow===true;
    const result=commitChange(state.store,old=>changeLowStock(old,item.id,!previous));if(!result.ok)throw Error(result.error);
    state.store=result.store;render();toast(previous?'Removed from running-low suggestions.':'Marked running low. Review suggestions before adding to your list.','Undo',()=>{
      try{const current=state.store.pantry.find(x=>x.id===item.id);if(!current||current.runningLow===previous){toast('Nothing to undo.');return;}
       const undo=commitChange(state.store,old=>changeLowStock(old,item.id,previous));if(!undo.ok){toast(undo.error);return;}state.store=undo.store;render();toast('Restock status restored.');}catch(err){toast(err.message);}
    },10000);break;
   }
   case 'quick-profile':{const key=b.dataset.key,group=PRIORITIES.some(r=>r.id===key)?'priorities':'avoids';if(PRIORITIES.some(r=>r.id===key)||['palmOil','gluten','lactose'].includes(key))updateProfile(p=>({...p,[group]:p[group].includes(key)?p[group].filter(x=>x!==key):[...p[group],key]}));break;}
   case 'rank-up':case 'rank-down':{updateProfile(p=>{const list=p.priorities,index=list.indexOf(b.dataset.key),target=index+(action==='rank-up'?-1:1);if(index>=0&&target>=0&&target<list.length)[list[index],list[target]]=[list[target],list[index]];return p;},b);break;}
   case 'list-add':if(product)addList(product);break;
   case 'quantity-plus':case 'quantity-minus':{const item=state.store.shopping.find(x=>x.id===b.dataset.id);if(item&&!item.checked){item.quantity=Math.max(1,Math.min(99,item.quantity+(action==='quantity-plus'?1:-1)));persist();render();document.querySelector(`[data-action="${action}"][data-id="${item.id}"]`)?.focus({preventScroll:true});}break;}
   case 'list-remove':{const item=state.store.shopping.find(x=>x.id===b.dataset.id);state.store.shopping=state.store.shopping.filter(x=>x.id!==b.dataset.id);if(persist()){render();toast('Removed from the list.','Undo',()=>{if(item)state.store.shopping.push(item);persist();render();});}break;}
   case 'clear-completed':{const old=state.store.shopping.filter(x=>x.checked);state.store.shopping=state.store.shopping.filter(x=>!x.checked);if(persist()){render();toast('Completed items removed.','Undo',()=>{state.store.shopping.push(...old);state.store=normalizeStore(state.store);persist();render();});}break;}
   case 'list-pantry':{const item=state.store.shopping.find(x=>x.id===b.dataset.id);if(item&&!item.checked)editPantry({...item,id:''});break;}
   case 'pantry-add':editPantry(product?{name:product.name,barcode:product.barcode}:{});break;
   case 'pantry-edit':editPantry(state.store.pantry.find(x=>x.id===b.dataset.id));break;
   case 'pantry-used':{const item=state.store.pantry.find(x=>x.id===b.dataset.id);state.store.pantry=state.store.pantry.filter(x=>x.id!==b.dataset.id);if(persist()){render();toast('Removed from your pantry.','Undo',()=>{if(item)state.store.pantry.push(item);persist();render();});}break;}
   case 'pantry-buy':{const item=state.store.pantry.find(x=>x.id===b.dataset.id);if(item)addList(findProduct(item.barcode),item.name,item.barcode);break;}
   case 'calendar-list':reminderDialog();break;
   case 'pantry-calendar':{const item=state.store.pantry.find(x=>x.id===b.dataset.id);if(item?.expires){download(calendarReminder('Check package date: '+item.name,item.expires),'foodscan-pantry-reminder.ics','text/calendar');toast('Calendar file created. Import it into your calendar to schedule it.');}break;}
   case 'enable-recap':state.store.settings.recap=true;addActivity(state.store,'session_start');if(persist()){render();toast('Your local recap starts now. No data is uploaded.');}break;
   case 'persist-storage':{if(!navigator.storage?.persist){toast('This browser does not offer persistent storage requests. Keep a private backup.');break;}const granted=await navigator.storage.persist();toast(granted?'Browser persistence granted. Keep a backup; clearing site data still deletes local records.':'Persistence was not granted. Data may be evicted; export a private backup.');break;}
   case 'voice-search':offerVoice();break;
   case 'voice-start':startVoice();break;
   case 'voice-confirm':startVoice();break;
   case 'onboard-open':state.onboarding=true;state.onboardingStep=1;render();focusOnboarding();break;
   case 'onboard-next':state.onboardingStep=Math.min(2,(state.onboardingStep||1)+1);render();focusOnboarding();break;
   case 'onboard-back':state.onboardingStep=Math.max(1,(state.onboardingStep||1)-1);render();focusOnboarding();break;
   case 'onboard-skip':state.onboarding=false;render();toast('No problem. Set your priorities anytime in Profile.');break;
   case 'onboard-finish':state.onboarding=false;state.onboardingStep=1;state.swaps={code:'',status:'idle'};render();toast(normalizeProfile(state.store.profile).priorities.length||normalizeProfile(state.store.profile).avoids.length||normalizeProfile(state.store.profile).diets.length?'Your food profile is set. Every scan is now personal.':'Skipped. Set your priorities anytime in Profile.');break;
   case 'spotlight':state.spotlight=state.spotlight===b.dataset.filter?'':b.dataset.filter;render();break;
   case 'manual-food':state.requested=code||state.requested;openDialog(view.manualFoodDialog(state),'general');break;
   case 'capture-label':captureLabel(code);break;
   case 'view-label':await showPhoto(code);break;
   case 'delete-label':await deletePhoto(code);closeDialog();toast('Private label photo deleted.');break;
   case 'report':if(validBarcode(code))openDialog(view.reportDialog(state,code),'general');break;
   case 'confirm-import':{
    if(!pendingBackup)break;const imported=pendingBackup.store,restore=document.getElementById('restore-profile')?.checked;
    for(const key of ['saved','recent','library'])state.store[key]=mergeProducts(state.store[key],imported[key],key==='saved'?200:key==='recent'?60:400);
    for(const key of ['shopping','pantry'])state.store[key]=[...new Map([...state.store[key],...imported[key]].map(x=>[x.id,x])).values()].slice(0,200);
    state.store.purchases=[...new Map([...state.store.purchases,...imported.purchases].map(x=>[x.id,x])).values()].slice(-500);
    if(restore){state.store.profile=imported.profile;state.store.settings={...imported.settings,recap:state.store.settings.recap};state.store.theme=imported.theme;state.store.grocery=imported.grocery;}
    if(persist()){pendingBackup=null;closeDialog();go('saved');toast('Backup merged. Private label photos and historic recap events were not imported.');}break;
   }
   case 'alternatives':if(product){saveSnapshot(product);state.alternatives={baseCode:code,category:usableCategories(product).at(-1)||'',items:[],loading:false,checked:null,error:''};go(`alternatives/${code}`);}break;
   case 'find-swaps':{
    const d=state.alternatives;if(d.loading||!d.category)break;searchController?.abort();const controller=searchController=new AbortController();d.loading=true;d.error='';render();
    try{if(!state.online)throw Error('Offline: showing eligible foods already stored on this device. Reconnect for a wider category search.');const baseProduct=findProduct(d.baseCode),response=await searchCategory(d.category,{signal:controller.signal,country:swapCountry(state.store.settings,baseProduct),full:true});if(controller.signal.aborted||state.alternatives!==d)break;d.items=response.products;d.checked=response.checked;d.fetchedAt=response.fetchedAt;state.extraProducts=mergeProducts(response.products,state.extraProducts,64);const base=baseProduct,ranked=base?betterChoices(base,response.products,state.store.profile,d.category).items:[];if(ranked.length){addActivity(state.store,'alternative_shown',{known:ranked.length});persist();}}
    catch(err){if(err.name!=='AbortError')d.error=err.message;}finally{d.loading=false;if(state.route==='alternatives'&&state.alternatives===d)render();}break;
   }
   case 'swap-open':if(product){saveSnapshot(product);persist();addActivity(state.store,'alternative_opened');persist();go(`food/${code}`);}break;
   case 'swap-save':if(product&&addList(product)){addActivity(state.store,'swap_saved');persist();}break;
  }}catch(err){toast(err.message||'That action could not be completed.');}
 });
}
