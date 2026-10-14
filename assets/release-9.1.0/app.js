import {escapeHTML as e,cleanBarcode,barcodeError,validBarcode,VERSION,setLocale} from './lib/model.js';
import {loadStore,saveStore,deleteStore,EMPTY,parseImport,exportStore,mergeProducts,addActivity,uid,currencyForLocale} from './lib/store.js';
import {lookupProduct,LookupError,probeBackend,getLastLookup,searchCategory} from './lib/api.js';
import {icon as i} from './lib/icons.js';
import * as view from './lib/views.js';
import {connectionView} from './lib/connection-view.js';
import {assess,eligibility,profileSignature,hasRestrictions} from './lib/profile.js';
import {projectState,rawProducts,resolveProduct,requireEligible} from './lib/policy.js';
import {installDailyFeatures} from './lib/features.js';
import {clearPhotos} from './lib/photos.js';
import {usableCategories,betterChoices,swapCountry,swapsWorthOffering,COUNTRIES,trafficLights} from './lib/nutrition.js';
import {portionBody} from './lib/components.js';
import {shareCardBlob} from './lib/share.js';
import {demoProduct,DEMO_CODES} from './lib/demo.js';
const initial=loadStore();
const state={quickSetupOpen:false,demo:{code:DEMO_CODES.spread,phase:'done'},swaps:{code:'',status:'idle'},portionAmount:null,portionFor:'',onboarding:false,onboardingStep:1,extraProducts:[],tripScan:false,alternatives:{baseCode:'',category:'',items:[],loading:false,checked:null,error:''},store:initial.store,route:'home',active:null,requested:'',input:'',busy:false,error:null,tab:'nutrition',portion:'100',snapshotNotice:'',online:navigator.onLine,filter:'',sort:'recent',compare:['','','',''],intentCompareSlot:null,installPrompt:null,lookupProgress:null,connection:{barcode:'',busy:false,health:null,report:null,error:''}};
if(!initial.hadData){try{state.store.settings.locale=Intl.getCanonicalLocales(navigator.language||'en-GB')[0];state.store.grocery.currency=currencyForLocale(state.store.settings.locale);}catch{}}
const header=document.getElementById('header'),main=document.getElementById('main'),footer=document.getElementById('footer');
let diagnosticController=null;
let requestController=null,requestSequence=0,toastTimer=0,toastAction=null,dialog=null,dialogKind='',returnFocus=null,cameraController=null,torchControl=null,torchOn=false,confirmAction=null,scannerModule=null;
let activeAttempt=null,firstResultAt=0;const sessionStarted=performance.now();
function beginAttempt(method='manual'){if(activeAttempt)finishAttempt('cancelled');activeAttempt={id:uid(),method,start:performance.now()};addActivity(state.store,'scan_start',{id:activeAttempt.id,method});persist();}
function finishAttempt(kind,product=null,{cached=false}={}){
 if(!activeAttempt)return;const a=activeAttempt;activeAttempt=null;const durationMs=Math.round(performance.now()-a.start);
 if(product){const assessment=assess(product,state.store.profile);if(!firstResultAt)firstResultAt=performance.now();addActivity(state.store,'scan_success',{id:a.id,method:a.method,durationMs,cached,repeat:state.store.recent.some(p=>p.barcode===product.barcode),firstValueMs:Math.round(firstResultAt-sessionStarted),profileSignature:profileSignature(state.store.profile),ruleVersion:assessment.ruleVersion,matches:assessment.matches,known:assessment.flags.filter(x=>x.status!=='unknown').length,checks:assessment.flags.filter(x=>['sugars','protein','fiber','sodium'].includes(x.key)).map(x=>({key:x.key,status:x.status})),profiled:state.store.profile.complete,grade:product.nutriScore||'',nova:product.nova||0,reds:trafficLights(product).items.filter(x=>x.level==='high').length});}
 else addActivity(state.store,'scan_failed',{id:a.id,method:a.method,durationMs,kind});persist();
}
addActivity(state.store,'session_start');
const getScanner=()=>scannerModule||(scannerModule=import('./lib/scanner.js'));
const themeMedia=matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){setLocale(state.store.settings.locale);document.documentElement.dataset.textSize=state.store.settings.textSize;document.documentElement.dataset.theme=state.store.theme==='system'?(themeMedia.matches?'dark':'light'):state.store.theme;document.querySelector('meta[name="theme-color"]').content=document.documentElement.dataset.theme==='dark'?'#14221e':'#f6f7f2';}
function persist(){const error=saveStore(state.store);if(error){toast(error,'',null,9000);return false;}return true;}
function toast(message,actionLabel='',action=null,duration=5500){
  clearTimeout(toastTimer);toastAction=action;
  const target=document.getElementById('toast');target.innerHTML=`${i('info')}<span>${e(message)}</span>${action?`<button data-action="toast-action">${e(actionLabel)}</button>`:''}`;target.hidden=false;
  toastTimer=setTimeout(()=>{target.hidden=true;toastAction=null;},duration);
}
function clearToast(){clearTimeout(toastTimer);toastAction=null;document.getElementById('toast').hidden=true;}
const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
let renderedDay=localDay();
let lastScreen='';
function render({focus=false,preserve=null}={}){
  if(state.route==='food'&&state.active&&state.portionFor!==state.active.barcode){state.portionFor=state.active.barcode;state.portionAmount=null;}
  state.standalone=!!(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true);
  const viewKey=state.route+':'+(state.active?.barcode||'');
  const keepPanels=main.dataset.viewKey===viewKey?[...main.querySelectorAll('details[data-panel][open]')].map(x=>x.dataset.panel):[];
  main.dataset.viewKey=viewKey;
  renderedDay=localDay();applyTheme();document.body.dataset.route=state.route;header.innerHTML=view.header(state);
  const pages={home:()=>view.home(state),food:()=>view.productView(state),saved:()=>view.savedView(state),compare:()=>view.compareView(state),about:()=>view.aboutView(),privacy:()=>view.aboutView(true),connection:()=>connectionView(state),profile:()=>view.profileView(state),shopping:()=>view.shoppingView(state),pantry:()=>view.pantryView(state),insights:()=>view.insightsView(state),alternatives:()=>view.alternativesView(state),review:()=>view.pantryReviewView(state),demo:()=>view.demoView(state)};
  main.innerHTML=(pages[state.route]||pages.home)()+view.onboardingOverlay(state);footer.innerHTML=view.footer();
  for(const key of keepPanels){const panel=main.querySelector(`details[data-panel="${key}"]`);if(panel)panel.open=true;}
  if(preserve){
    const d=preserve.dataset||{};
    const selector=d.threshold?`[data-threshold="${d.threshold}"]`:d.profile?`[data-profile="${d.profile}"][value="${preserve.value}"]`:d.action&&d.key?`[data-action="${d.action}"][data-key="${d.key}"]`:'';
    const fresh=selector?main.querySelector(selector):null;
    if(fresh){if(d.threshold){fresh.replaceWith(preserve);preserve.focus({preventScroll:true});}else fresh.focus({preventScroll:true});}
  }
  const shown=projectState(state);
  const titles={home:'FoodScan | Free Food Barcode Scanner & Grocery List',food:shown.active?`${shown.active.name} - FoodScan`:shown.excludedResult?'Restriction check - FoodScan':'Food lookup - FoodScan',saved:'My foods - FoodScan',compare:'Compare foods - FoodScan',about:'Facts first - FoodScan',privacy:'Privacy and data - FoodScan',review:'Before your next shop - FoodScan',connection:'Connection check - FoodScan',profile:'Private food profile - FoodScan',shopping:'Shopping list - FoodScan',pantry:'My pantry - FoodScan',insights:'Private weekly recap - FoodScan',alternatives:'Explainable alternatives - FoodScan',demo:'How FoodScan works - FoodScan'};
  document.title=titles[state.route]||titles.home;
  const screen=`${state.route}:${shown.active?.barcode||''}`;
  if(screen!==lastScreen){lastScreen=screen;main.classList.remove('enter');}
  if(focus){main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  postRenderDelights();
  if(state.route==='food'&&shown.active){
    if(state.portionFor!==shown.active.barcode){state.portionFor=shown.active.barcode;state.portionAmount=null;}
    // Category searches are explicit, never a background cost on every result.
  }
}

/* ---------- better choices, requested explicitly after the decision ---------- */
let swapController=null;
function refreshSwapsSlot(){
  const slot=document.getElementById('swaps-slot');
  if(slot&&state.active?.barcode===state.swaps.code)slot.innerHTML=view.swapsSection(projectState(state));
}
async function ensureSwaps(product,{force=false}={}){
  if(!product||state.route!=='food'||!swapsWorthOffering(product,state.store.profile))return;
  const current=state.swaps;
  if(!force&&current.code===product.barcode&&['loading','done'].includes(current.status))return;
  const categories=usableCategories(product).slice().reverse().slice(0,2),country=swapCountry(state.store.settings,product);
  const countryName=COUNTRIES.find(c=>c.slug===country)?.name||'';
  if(!state.online){
    swapController?.abort();
    const category=categories[0],items=rawProducts(state).filter(p=>p.barcode!==product.barcode&&!p.partial&&p.categories?.includes(category));
    state.swaps={code:product.barcode,status:'done',category,country:'',countryName:'',mode:'local',items,checked:items.length,error:''};
    refreshSwapsSlot();return;
  }
  swapController?.abort();const controller=swapController=new AbortController();
  const mine=state.swaps={code:product.barcode,status:'loading',category:categories[0],country,countryName,items:[],checked:0,error:''};
  refreshSwapsSlot();
  try{
    let result=null,category=categories[0];
    for(const [index,candidate] of categories.entries()){
      result=await searchCategory(candidate,{signal:controller.signal,country,full:true});category=candidate;
      // A narrow aisle can be too small to hold a better option; widen once to the parent aisle.
      const found=betterChoices(product,result.products,state.store.profile,category).items.length;
      if(found||result.products.length>=12||index===categories.length-1)break;
    }
    if(state.swaps!==mine)return;
    state.extraProducts=mergeProducts(result.products,state.extraProducts,64);
    Object.assign(mine,{status:'done',category,items:result.products,checked:result.checked});
    if(betterChoices(product,result.products,state.store.profile,category).items.length){addActivity(state.store,'alternative_shown',{known:1});persist();}
  }catch(error){
    if(error?.name==='AbortError'||state.swaps!==mine)return;
    Object.assign(mine,{status:'error',error:error.message||'Better choices are unavailable right now.'});
  }
  refreshSwapsSlot();
}
function postRenderDelights(){
  // Content is always visible: no intersection observers or repeated count animations.
  document.querySelectorAll('.reveal,[data-reveal]').forEach(el=>el.classList.add('in'));
  if(!main.querySelector('h1')){
    const first=main.querySelector('.section-head h2');
    if(first){const heading=document.createElement('h1');heading.className='page-title';heading.innerHTML=first.innerHTML;first.replaceWith(heading);}
  }
}
function stopRequest(){requestSequence++;requestController?.abort();requestController=null;state.busy=false;}
function hashRoute(){
  const raw=location.hash.slice(1).replace(/^\//,'')||'home';
  if(raw.startsWith('food/'))return {route:'food',code:raw.slice(5)};
  if(raw.startsWith('alternatives/'))return {route:'alternatives',code:raw.slice(13)};
  return {route:['home','saved','compare','about','privacy','connection','profile','shopping','pantry','insights','scan','demo','review'].includes(raw)?raw:'home',code:''};
}
function handleRoute(){
  if(activeAttempt)finishAttempt('cancelled');stopRequest();diagnosticController?.abort();diagnosticController=null;state.connection.busy=false;closeDialog();state.error=null;state.snapshotNotice='';
  const {route,code}=hashRoute();state.route=route;
  if(route==='scan'){state.route='home';render({focus:true});void openCamera();return;}
  if(route==='alternatives'&&code&&state.alternatives.baseCode!==code){const p=findProduct(code);state.alternatives={baseCode:code,category:p?usableCategories(p).at(-1)||'':'',items:[],loading:false,checked:null,error:''};}
if(route==='connection'){state.connection.report=getLastLookup();if(state.requested)state.connection.barcode=state.requested;}if(!['home','food'].includes(route))state.intentCompareSlot=null;
  if(route==='food'){
    if(!validBarcode(code)){state.active=null;state.requested='';state.error=new LookupError('That link does not contain a valid barcode. Return to the scanner and check the digits.','invalid');render({focus:true});return;}
    const known=resolveProduct(state,code),cached=known&&!known.partial?known:null;
    state.tab='nutrition';state.portion='100';state.requested=code;
    if(cached){state.active=cached;state.snapshotNotice='You are viewing a record stored on this device. Use Reload to request the latest available database snapshot.';render({focus:true});void refreshCached(code);}
    else{state.active=null;void lookup(code,{changeHistory:false});}
  }else render({focus:true});
}
function go(route){if(location.hash===`#${route}`){handleRoute();}else location.hash=route;}
// Stale-while-revalidate: a stored snapshot renders instantly, then quietly refreshes
// in the background so a partial or outdated record self-heals within seconds.
async function refreshCached(code){
  if(!state.online)return;
  requestController?.abort();const seq=++requestSequence;requestController=new AbortController();
  try{
    const product=await lookupProduct(code,{signal:requestController.signal});
    if(seq!==requestSequence||state.requested!==code||state.route!=='food')return;
    state.active=product;state.snapshotNotice='';
    state.store.recent=[product,...state.store.recent.filter(p=>p.barcode!==product.barcode)].slice(0,60);
    state.store.saved=state.store.saved.map(p=>p.barcode===product.barcode?product:p);persist();render();
  }catch{/* The stored snapshot stays; the user can still Reload manually. */}
}
async function lookup(raw,{changeHistory=true,force=false,method='manual'}={}){
  const code=cleanBarcode(raw),invalid=barcodeError(raw);state.input=code;
  if(invalid){state.error=new LookupError(invalid,'invalid');state.route='home';history.replaceState(null,'','#home');render();document.getElementById('barcode-input')?.focus();return;}
  if(!activeAttempt)beginAttempt(method);closeDialog();requestController?.abort();const seq=++requestSequence;requestController=new AbortController();
  const known=resolveProduct(state,code),cached=known&&!known.partial?known:null;
  if(state.active?.barcode!==code)state.active=null;
  state.requested=code;state.route='food';state.error=null;state.busy=true;state.snapshotNotice='';state.lookupProgress=null;
  if(changeHistory&&location.hash!==`#food/${code}`)history.pushState(null,'',`#food/${code}`);
  if(cached&&!force){
    state.active=cached;state.busy=false;state.tab='nutrition';state.portion='100';state.snapshotNotice='Stored on this device. Source snapshot date is shown below; use Reload for a newer available record.';finishAttempt('success',cached,{cached:true});
    state.store.recent=[cached,...state.store.recent.filter(p=>p.barcode!==cached.barcode)].slice(0,60);persist();
    if(!eligibility(state.active,state.store.profile).allowed){state.intentCompareSlot=null;render({focus:true});return;}
    if(state.intentCompareSlot!==null){const slot=state.intentCompareSlot;state.compare=state.compare.map((c,j)=>j!==slot&&c===cached.barcode?'':c);state.compare[slot]=cached.barcode;state.intentCompareSlot=null;go('compare');}else{if(state.tripScan&&!state.compare.includes(cached.barcode)){const slot=state.compare.findIndex(x=>!x);if(slot>=0)state.compare[slot]=cached.barcode;}render({focus:true});}return;
  }
  if(!state.online){state.busy=false;if(cached){state.active=cached;state.snapshotNotice='You are offline. Showing your previously stored snapshot, not fresh data.';finishAttempt('offline_refresh');render({focus:true});return;}state.error=new LookupError('This product is not stored on this device. Reconnect to look up a new barcode, or enter the package details.','network_error');finishAttempt('network_error');render({focus:true});return;}
  render({focus:true});
  try{
    const product=await lookupProduct(code,{signal:requestController.signal,onProgress:progress=>{if(seq!==requestSequence)return;state.lookupProgress=progress;const node=document.getElementById('lookup-progress-message');if(node)node.textContent=progress.message;}});
    if(seq!==requestSequence)return;
    finishAttempt('success',product);state.active=product;state.tab='nutrition';state.portion='100';state.busy=false;
    state.store.recent=[product,...state.store.recent.filter(p=>p.barcode!==product.barcode)].slice(0,60);
    state.store.saved=state.store.saved.map(p=>p.barcode===product.barcode?product:p);persist();
    if(!eligibility(state.active,state.store.profile).allowed){state.intentCompareSlot=null;render({focus:true});return;}
    if(state.intentCompareSlot!==null){const slot=state.intentCompareSlot;state.compare[slot]=product.barcode;state.compare=state.compare.map((c,j)=>j!==slot&&c===product.barcode?'':c);state.intentCompareSlot=null;go('compare');}
    else {if(state.tripScan&&!state.compare.includes(product.barcode)){const slot=state.compare.findIndex(x=>!x);if(slot>=0)state.compare[slot]=product.barcode;}render({focus:true});}
  }catch(error){
    if(seq!==requestSequence||error?.name==='AbortError')return;
    finishAttempt(error.code||'unavailable');state.error=error instanceof Error?error:new LookupError('Something interrupted the lookup. Please try again.');state.busy=false;
    if(cached){state.active=cached;state.snapshotNotice=`Could not refresh this record: ${state.error.message} Showing your previously stored snapshot, not fresh data.`;}else state.active=null;
    render({focus:true});
  }
}
async function runConnection(raw){
 const code=cleanBarcode(raw),invalid=barcodeError(raw);const d=state.connection;d.barcode=code;d.error='';d.retryAfter=0;
 if(invalid){d.error=invalid;render();return;}
 diagnosticController?.abort();diagnosticController=new AbortController();const controller=diagnosticController;
 d.busy=true;d.progress='Checking the FoodScan backend...';d.health=null;d.report=null;render();
 try{
  d.health=await probeBackend({signal:controller.signal});if(controller.signal.aborted)return;render();
  await lookupProduct(code,{signal:controller.signal,onProgress:p=>{d.progress=p.message;if(state.route==='connection')render();}});
  d.report=getLastLookup();
 }catch(error){if(error?.name==='AbortError')return;d.error=error.message;d.retryAfter=error.retryAfter||0;d.report=error.diagnostics||getLastLookup();}
 finally{if(!controller.signal.aborted){d.busy=false;if(state.route==='connection')render();}}
}
async function copyDiagnostics(){
 const report={app:'FoodScan',version:VERSION,origin:location.origin,secureContext:globalThis.isSecureContext===true,browserOnlineSignal:state.online,backend:state.connection.health,lookup:state.connection.report||getLastLookup()};
 const text=JSON.stringify(report,null,2);
 try{await navigator.clipboard.writeText(text);toast('Diagnostic report copied. It contains the tested barcode, not your food collection.');}
 catch{openDialog(`<div class="modal-head"><h2>Connection report</h2><button class="icon-button" data-action="close-dialog" aria-label="Close">${i('close')}</button></div><p>Copy this report to help diagnose the failed request. It contains the tested barcode.</p><textarea class="diagnostic-copy" aria-label="Diagnostic report" readonly>${e(text)}</textarea>`,'general');dialog.querySelector('textarea').select();}
}
function findProduct(code){return resolveProduct(state,code);}
function canUse(product){try{requireEligible(resolveProduct(state,product?.barcode)||product,state.store.profile);return true;}catch(error){toast(error.message);return false;}}
function saveFood(code){
  const product=findProduct(code);if(!product)return;
  const existing=state.store.saved.some(p=>p.barcode===code);if(!existing&&!canUse(product))return;
  if(!existing&&state.store.saved.length>=200){toast('Your collection has 200 foods. Export a backup and remove a few before saving more.');return;}
  state.store.saved=existing?state.store.saved.filter(p=>p.barcode!==code):[product,...state.store.saved];const persisted=persist();render();if(!persisted)return;
  if(existing)toast('Removed from your saved foods.','Undo',()=>{if(!canUse(product))return;state.store.saved=mergeProducts([product],state.store.saved);const ok=persist();render();if(ok)toast('Food restored.');});
  else {addActivity(state.store,'food_saved');persist();toast('Saved on this device.');}
}
function addCompare(code){if(!findProduct(code)||!canUse(findProduct(code)))return;if(state.compare.includes(code)){go('compare');return;}const index=state.compare.findIndex(x=>!x);if(index===-1){toast('Four foods are already selected. Choose which one to replace in Compare.');go('compare');return;}state.compare[index]=code;go('compare');}
function openDialog(html,kind='general'){
  closeDialog();returnFocus=document.activeElement;dialogKind=kind;
  dialog=document.createElement('dialog');dialog.className='app-dialog';dialog.dataset.kind=kind;dialog.setAttribute('aria-label',{camera:'Barcode scanner',settings:'FoodScan settings',install:'Install FoodScan',confirm:'Confirm action',share:'Share food'}[kind]||'FoodScan');dialog.innerHTML=html;document.body.append(dialog);
  const current=dialog,previousFocus=returnFocus;
  current.addEventListener('close',()=>{if(kind==='share')dropSharePreview();if(kind==='camera'&&current.dataset.accepted!=='true'&&activeAttempt?.method==='camera')finishAttempt('cancelled');current.remove();if(dialog===current){cameraController?.abort();cameraController=null;torchControl=null;dialog=null;dialogKind='';if(previousFocus?.isConnected&&document.activeElement===document.body)previousFocus.focus({preventScroll:true});}});
  current.addEventListener('click',event=>{if(event.target===current){const r=current.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
  current.showModal();
}
function closeDialog(){cameraController?.abort();cameraController=null;torchControl=null;const current=dialog;if(current?.open)current.close();current?.remove();dialog=null;dialogKind='';}
function confirm(title,description,action,label='Confirm'){
  confirmAction=action;openDialog(`<div class="modal-head"><div><span class="eyebrow">YOU ARE IN CONTROL</span><h2>${e(title)}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Cancel">${i('close')}</button></div><p class="confirm-dialog-description">${e(description)}</p><div class="button-row"><button class="button button-danger" data-action="confirm">${e(label)}</button><button class="button button-outline" data-action="close-dialog">Keep my data</button></div>`,'confirm');
}
async function openCamera(){
  beginAttempt('camera');openDialog(view.scannerDialog().replace('id="trip-scan" type="checkbox"',`id="trip-scan" type="checkbox"${state.tripScan?' checked':''}`),'camera');torchOn=false;
  const current=dialog;cameraController=new AbortController();const controller=cameraController;
  // Still nothing after a few seconds: say what usually fixes it, before the person gives up.
  const hint=setTimeout(()=>{if(controller.signal.aborted||current.dataset.accepted==='true')return;const status=current.querySelector('#camera-status');if(status&&!status.classList.contains('error-text'))status.innerHTML=`${i('info')} Taking a while? Move a little closer, hold steady, or switch on the flashlight. You can also type the digits.`;},7000);
  controller.signal.addEventListener('abort',()=>clearTimeout(hint),{once:true});
  try{
    const module=await getScanner();if(controller.signal.aborted)return;
    await module.startCamera(current.querySelector('video'),{
      signal:controller.signal,
      onCode:code=>{if(controller.signal.aborted)return;current.dataset.accepted='true';try{navigator.vibrate?.(35);}catch{}closeDialog();void lookup(code,{method:'camera'});},
      onReady:info=>{if(controller.signal.aborted)return;const status=current.querySelector('#camera-status');status.innerHTML=`${i('scan')} Camera ready. Hold still for a moment.`;if(info.torch){current.querySelector('#torch-button').hidden=false;torchControl=info.toggleTorch;}},
      onError:message=>{if(controller.signal.aborted)return;finishAttempt('camera_error');const status=current.querySelector('#camera-status');status.classList.add('error-text');status.innerHTML=`${i('alert')} ${e(message)}`;}
    });
  }catch{if(!controller.signal.aborted){const status=current.querySelector('#camera-status');status.classList.add('error-text');status.textContent='The scanner could not load. Reload the app or enter the digits instead.';}}
}
function exportFoods(){
  const blob=new Blob([exportStore(state.store)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`foodscan-foods-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Your backup download has started. Keep it somewhere private.');
}
let shareBlob=null,sharePreview='';
function dropSharePreview(){if(sharePreview){URL.revokeObjectURL(sharePreview);sharePreview='';}shareBlob=null;}
async function shareFood(code){
  if(!canUse(findProduct(code)))return;
  const product=findProduct(code);if(!product)return;if(product.provenance==='local'){toast('This is a private manual entry. It is not published; use a private backup to transfer it.');return;}
  dropSharePreview();
  let blob=null;try{blob=await shareCardBlob(product);}catch{/* the link still works without an image */}
  shareBlob=blob;if(blob)sharePreview=URL.createObjectURL(blob);
  const url=`${location.origin}${location.pathname}#food/${code}`;
  openDialog(`<div class="modal-head"><div><span class="eyebrow">Share</span><h2>Share this read.</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close share dialog">${i('close')}</button></div>
  ${sharePreview?`<img class="share-preview" src="${sharePreview}" alt="Preview of the share card for ${e(product.name)}">`:''}
  <div class="button-row">${sharePreview?`<button class="button button-primary" data-action="share-image" data-code="${e(code)}">${i('share')} Share image</button><button class="button button-outline" data-action="share-save" data-code="${e(code)}">${i('download')} Save image</button>`:''}<button class="button button-outline" data-action="share-link" data-code="${e(code)}">${i('link')} Copy link</button></div>
  <p class="small muted mt-1">The card is drawn on this device. It holds the product facts only: nothing from your profile or lists.</p>
  <label class="sr-only" for="share-url">Product URL</label><input id="share-url" class="share-input" value="${e(url)}" readonly>`,'share');
}
async function shareImage(code,save=false){
  const product=findProduct(code);if(!product||!shareBlob)return;
  const file=new File([shareBlob],`foodscan-${code}.png`,{type:'image/png'});
  const url=`${location.origin}${location.pathname}#food/${code}`;
  if(!save&&navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file],title:`${product.name} - FoodScan`,text:`${product.name}: the real story, from FoodScan.`,url});return;}catch(error){if(error?.name==='AbortError')return;}
  }
  const a=document.createElement('a');a.href=sharePreview;a.download=file.name;document.body.append(a);a.click();a.remove();
  toast(save?'Image saved to your downloads.':'Sharing images is not supported here, so the image was saved instead.');
}
async function shareLink(code){
  const url=`${location.origin}${location.pathname}#food/${code}`,product=findProduct(code);
  try{if(navigator.share&&!navigator.canShare?.({files:[new File([''],'x.png',{type:'image/png'})]})){await navigator.share({title:`${product?.name||'Food'} - FoodScan`,url});return;}}catch(error){if(error?.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(url);toast('Product link copied.');}catch{document.getElementById('share-url')?.select();toast('Select the link and copy it.');}
}
function setPortion(amount,{fromSlider=false}={}){
  const p=state.route==='demo'?demoProduct(state.demo?.code):projectState(state).active;if(!p||!Number.isFinite(amount))return;
  state.portionAmount=amount;
  const range=document.getElementById('portion-range'),out=document.getElementById('portion-out'),body=document.getElementById('portion-body');
  const unit=p.basis==='ml'?'ml':'g',label=`${Number.isInteger(amount)?amount:Math.round(amount*10)/10} ${unit}`;
  if(range&&!fromSlider)range.value=String(amount);
  if(range)range.setAttribute('aria-valuetext',label);
  if(out)out.textContent=label;
  if(body)body.innerHTML=portionBody(p,amount);
  document.querySelectorAll('[data-action="portion-set"]').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(Number(b.dataset.amount)-amount)<.5)));
}
/* The demo page's "scan": a short, honest simulation using built-in sample data. Only the stage is redrawn. */
let demoTimer=0;
function demoScan(code){
  if(!Object.values(DEMO_CODES).includes(code)||state.route!=='demo')return;
  clearTimeout(demoTimer);state.demo={code,phase:'scanning'};state.portionAmount=null;
  const draw=()=>{const stage=document.querySelector('.live-stage');if(stage)stage.innerHTML=view.demoStage(state);document.querySelectorAll('.demo-pick').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.code===state.demo.code)));};
  draw();try{navigator.vibrate?.(18);}catch{}
  demoTimer=setTimeout(()=>{if(state.route!=='demo'||state.demo.code!==code)return;state.demo.phase='done';draw();document.querySelector('.live-stage')?.classList.remove('pop');void document.querySelector('.live-stage')?.offsetWidth;document.querySelector('.live-stage')?.classList.add('pop');},1100);
}
function focusSearch(){
 const focus=()=>{const panel=document.querySelector('details[data-panel="home-manual"]');if(panel)panel.open=true;document.getElementById('barcode-input')?.focus({preventScroll:true});document.getElementById('scan-box')?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
 if(state.route!=='home'){go('home');setTimeout(focus,80);}else focus();
}
function focusNameSearch(){
 const focus=()=>{const panel=document.querySelector('details[data-panel="home-manual"]');if(panel)panel.open=true;const search=document.querySelector('details.name-disclosure');if(search)search.open=true;document.getElementById('name-search-input')?.focus({preventScroll:false});};
 if(state.route!=='home'){go('home');setTimeout(focus,80);}else focus();
}
document.addEventListener('submit',event=>{if(event.target.id==='connection-form'){event.preventDefault();if(!state.connection.busy)void runConnection(new FormData(event.target).get('barcode'));}});
document.addEventListener('submit',event=>{if(event.target.id==='lookup-form'){event.preventDefault();void lookup(new FormData(event.target).get('barcode'));}});
document.getElementById('toast')?.addEventListener('click',event=>{if(!event.target.closest('[data-action="toast-action"]'))clearToast();});
document.addEventListener('input',event=>{
  if(event.target.id==='barcode-input')state.input=event.target.value;
  if(event.target.id==='portion-range')setPortion(Number(event.target.value),{fromSlider:true});
  if(event.target.id==='saved-filter'){state.filter=event.target.value;document.getElementById('food-grid').innerHTML=view.savedGrid(state);const recent=document.getElementById('recent-grid');if(recent)recent.innerHTML=projectState(state).store.recent.filter(p=>(p.name+' '+p.brand+' '+p.barcode).toLowerCase().includes(state.filter.toLowerCase())).slice(0,12).map(p=>view.productCard(p,state)).join('');}
});
document.addEventListener('change',async event=>{
  const target=event.target;
  if(target.id==='saved-sort'){state.sort=target.value;document.getElementById('food-grid').innerHTML=view.savedGrid(state);}
  if(target.matches('[data-slot]')&&target.tagName==='SELECT'){const slot=Number(target.dataset.slot),code=target.value;if(code&&!canUse(findProduct(code))){render();return;}if(code&&state.compare.some((c,j)=>j!==slot&&c===code))return;state.compare[slot]=code;render();document.getElementById(`compare-${slot}`)?.focus();}
  if(target.id==='photo-input'&&target.files?.[0]){
    const file=target.files[0];target.value='';closeDialog();beginAttempt('photo');toast('Reading your barcode photo on this device...');
    try{const module=await getScanner();const code=await module.scanPhoto(file);toast('Barcode read successfully.');void lookup(code,{method:'photo'});}catch(error){finishAttempt('photo_decode');toast(error.message||'Could not read the barcode photo. Try typing its number.', '',null,8000);}
  }

});
document.addEventListener('click',async event=>{
  if(event.target.closest('.skip-link')){event.preventDefault();main.focus();return;}
  const control=event.target.closest('[data-action]');if(!control||control.disabled)return;
  const action=control.dataset.action;if(control.tagName!=='A')event.preventDefault();
  switch(action){
    case 'connection':closeDialog();go('connection');break;
    case 'copy-diagnostics':void copyDiagnostics();break;
    case 'settings':openDialog(view.settingsDialog(state),'settings');break;
    case 'install':openDialog(view.installDialog(state),'install');break;
    case 'close-dialog':closeDialog();break;
    case 'confirm':{const fn=confirmAction;confirmAction=null;closeDialog();fn?.();break;}
    case 'camera':void openCamera();break;
    case 'photo':closeDialog();document.getElementById('photo-input').click();break;
    case 'manual':closeDialog();focusSearch();break;
    case 'focus-search':focusSearch();break;
    case 'search-name':focusNameSearch();break;
    case 'sample':void lookup(control.dataset.code||'3017624010701',{method:'sample'});break;
    case 'portion-set':setPortion(Number(control.dataset.amount));break;
    case 'scroll-to':document.getElementById(control.dataset.target)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});break;
    case 'demo-scan':demoScan(control.dataset.code);break;
    case 'load-swaps':{const p=projectState(state).active;if(p)void ensureSwaps(p,{force:true});break;}
    case 'share-image':void shareImage(control.dataset.code);break;
    case 'share-save':void shareImage(control.dataset.code,true);break;
    case 'share-link':void shareLink(control.dataset.code);break;
    case 'save':saveFood(control.dataset.code);break;
    case 'compare-add':addCompare(control.dataset.code);break;
    case 'compare-scan':state.intentCompareSlot=Number(control.dataset.slot);go('home');toast(`Look up the ${String(state.intentCompareSlot+1)} food for your comparison.`);setTimeout(focusSearch,60);break;
    case 'share':void shareFood(control.dataset.code);break;
    case 'select-link':document.getElementById('share-url')?.select();break;
    case 'reload':void lookup(control.dataset.code,{changeHistory:false,force:true});break;
    case 'retry':if(state.requested)void lookup(state.requested,{changeHistory:false,force:true});break;
    case 'cancel-lookup':finishAttempt('cancelled');stopRequest();go('home');break;
    case 'priority':if(['balanced','protein','sugars','fiber'].includes(control.dataset.value)){state.store.focus=control.dataset.value;persist();render();document.querySelector(`[data-action="priority"][data-value="${state.store.focus}"]`)?.focus({preventScroll:true});}break;
    case 'tab':if(['nutrition','ingredients','source'].includes(control.dataset.tab)){state.tab=control.dataset.tab;render();document.getElementById(`tab-${state.tab}`)?.focus({preventScroll:true});}break;
    case 'portion':state.portion=control.dataset.value==='serving'?'serving':'100';render();document.querySelector(`[data-action="portion"][data-value="${state.portion}"]`)?.focus({preventScroll:true});break;
    case 'clear-filter':state.filter='';render();document.getElementById('saved-filter')?.focus();break;
    case 'clear-history':confirm('Clear recent discoveries?','This removes your recent lookup history on this device. Your saved foods are not affected.',()=>{state.store.recent=[];const ok=persist();render();if(ok)toast('Recent history cleared.');},'Clear history');break;
    case 'clear-all':confirm('Delete your local food data?','This deletes your profile, lists, pantry, saved foods, recent history, activity and private label photos from this browser. Export a backup first. This cannot be undone.',()=>{stopRequest();const error=deleteStore();if(error){toast(error);return;}void clearPhotos().catch(()=>toast('Text data cleared, but this browser could not clear private photos. Clear this site storage in browser settings.'));if('caches' in window)void caches.delete('foodscan-images-v1');state.store=EMPTY();state.extraProducts=[];state.active=null;state.compare=['','','',''];state.input='';state.intentCompareSlot=null;go('home');applyTheme();toast('FoodScan saved foods and preferences have been deleted.');},'Delete local data');break;
    case 'export':exportFoods();break;
    case 'import':document.getElementById('import-input').click();break;
    case 'theme':if(['light','dark','system'].includes(control.dataset.value)){state.store.theme=control.dataset.value;persist();applyTheme();dialog.querySelectorAll('[data-action="theme"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===state.store.theme)));}break;
    case 'print':window.print();break;
    case 'torch':if(torchControl){const desired=!torchOn;if(await torchControl(desired)){torchOn=desired;control.setAttribute('aria-pressed',String(torchOn));control.innerHTML=`${i('bolt')} ${torchOn?'Light on':'Flashlight'}`;}else toast('The flashlight could not be switched on.');}break;
    case 'dismiss-install':state.installDismissed=true;render();break;
    case 'native-install':if(state.installPrompt){const prompt=state.installPrompt;state.installPrompt=null;try{await prompt.prompt();const result=await prompt.userChoice;closeDialog();toast(result.outcome==='accepted'?'Installation requested. Your browser will finish setting it up.':'No problem. FoodScan still works in your browser.');}catch{toast('Use your browser menu to add FoodScan to the home screen.');}}break;
    case 'toast-action':{const fn=toastAction;document.getElementById('toast').hidden=true;toastAction=null;clearTimeout(toastTimer);fn?.();break;}
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='/'&&!dialog?.open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){event.preventDefault();focusSearch();}
  if(event.target.getAttribute('role')==='tab'&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();const tabs=['nutrition','ingredients','source'],index=tabs.indexOf(state.tab);state.tab=event.key==='Home'?tabs[0]:event.key==='End'?tabs[2]:tabs[(index+(event.key==='ArrowRight'?1:2))%3];render();document.getElementById(`tab-${state.tab}`)?.focus({preventScroll:true});
  }
});
document.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.closest('.product-image')?.classList.add('image-failed');},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialogKind==='camera'){closeDialog();}else if(!document.hidden&&state.route==='home'&&renderedDay!==localDay()){render();}});
document.addEventListener('click',event=>{
 const link=event.target?.closest?.('a[data-commercial-link="amazon"]');if(!link||!link.href)return;
 // Local-only opt-in recap event. No barcode, profile, device identifier or query is recorded.
 addActivity(state.store,'amazon_search_opened',{placement:link.dataset.placement||''});persist();
},true);
window.addEventListener('hashchange',handleRoute);
window.addEventListener('storage',event=>{if(event.key==='foodscan:v3'||event.key===null){const fresh=loadStore();if(fresh.error){toast(fresh.error);return;}state.store=fresh.store;closeDialog();render();}});
window.addEventListener('online',()=>{state.online=true;render();toast('You are back online.');});
window.addEventListener('offline',()=>{state.online=false;render();});
themeMedia.addEventListener('change',()=>{if(state.store.theme==='system')applyTheme();});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();state.installPrompt=event;if(state.route==='home')render();});
window.addEventListener('appinstalled',()=>{state.installPrompt=null;toast('FoodScan was added to this device.');});
// Preserve v1 shared links without keeping an unrelated query string in new links.
const legacy=new URLSearchParams(location.search).get('barcode');
if(legacy&&validBarcode(legacy))history.replaceState(null,'',`${location.pathname}#food/${legacy}`);
if(location.pathname.replace(/\/+$/,'')==='/demo')history.replaceState(null,'','/#demo');
if(!location.hash&&state.store.settings.home!=='home')history.replaceState(null,'',`#${state.store.settings.home}`);
handleRoute();
installDailyFeatures({state,view,render,go,toast,clearToast,persist,openDialog,closeDialog,findProduct,lookup,beginAttempt,finishAttempt});
window.__foodscan_booted = true;
if(initial.error)toast(initial.error,'',null,8000);
if('serviceWorker' in navigator&&globalThis.isSecureContext){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});let updateRequested=false;
      const offerUpdate=()=>{if(reg.waiting)toast('A new FoodScan version is ready.','Update',()=>{updateRequested=true;reg.waiting.postMessage({type:'SKIP_WAITING'});},12000);};
      if(reg.waiting)offerUpdate();
      reg.addEventListener('updatefound',()=>{const installing=reg.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)offerUpdate();});});
      let refreshed=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested&&!refreshed){refreshed=true;location.reload();}});
      navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='UPDATE_ACTIVATED')location.reload();});
    }catch{toast('Offline installation is unavailable in this browser. Online lookup still works.');}
  },{once:true});
}
