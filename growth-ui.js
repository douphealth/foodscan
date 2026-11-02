/* FoodScan v58 (75: Greek copy): progressive result-to-discovery integration. Legacy SPA source remains untouched. */
import {STORAGE_KEY,TARGET,canonicalGTIN,readEntries,addEntry,challengeMetrics,readSavedReports} from './fridge-core.mjs?v=75';
const routePattern=/^#\/p\/([0-9]{8}|[0-9]{12,14})(?:[?]|$)/;
let timer=0,active='',generation=0;
const storage=(()=>{try{return window.localStorage;}catch{return {getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}};}})();
const barcodeFromRoute=()=>location.hash.match(routePattern)?.[1]||'';
const canTrack=()=>!navigator.globalPrivacyControl&&navigator.doNotTrack!=='1';
const notify=message=>{const el=document.getElementById('fsc-growth-status');if(el)el.textContent=message;};
const validReferral=s=>/^f[a-z0-9]{11}$/.test(s||'');
const createReferral=()=>{const bytes=crypto.getRandomValues(new Uint8Array(11));return 'f'+Array.from(bytes,n=>(n%36).toString(36)).join('');};
const createEventId=()=>{const bytes=crypto.getRandomValues(new Uint8Array(15));return 'f'+Array.from(bytes,n=>(n%36).toString(36)).join('');};
function track(name,method,referral='',path='/p'){
  if(!canTrack())return;
  const props={source:'challenge',route:'product',method};
  if(validReferral(referral))props.referral=referral;
  const body=JSON.stringify({name,eventId:createEventId(),version:'58.0.0',path,properties:props});
  try{if(navigator.sendBeacon)navigator.sendBeacon('/api/events',new Blob([body],{type:'application/json'}));else fetch('/api/events',{method:'POST',body,headers:{'Content-Type':'application/json'},keepalive:true}).catch(()=>{});}catch{}
}
/* 75: Greek copy. The page language follows the app (html lang). */
const isEl=()=>(document.documentElement.lang||navigator.language||'en').toLowerCase().startsWith('el');
const TX={
  en:{demoK:'EXPERIENCE THE CHALLENGE',savedK:'DISCOVERY SAVED',newK:'MAKE THIS ONE COUNT',demoT:'Seven foods. A new perspective.',savedT:'Nice find. <em>Keep exploring.</em>',newT:'This food has a story. <em>Explore the next.</em>',
    demoD:'Try the challenge with foods from your own kitchen. No account and no health rankings.',savedD:'This product is in your private collection. Revisit its facts, explore more foods or share a report with a friend.',doneD:'Your first seven discoveries are complete. Keep exploring, or save this as an additional find.',newD:'Save this product to your private seven-discovery collection, then uncover something interesting from your kitchen.',
    found:(c,t)=>`${c} OF ${t} FOUND`,hasR:'◈ Saved FoodScan report available',priv:'◈ Private discovery, no account needed',prog:(c,t)=>`${c} of ${t} challenge discoveries recorded`,real:'Real products. Real curiosity.',
    tryQ:'Try the 7-discovery quest',explore:'Explore my collection',another:'Save another discovery',save:'Save this discovery',coll:'My collection',share:'Share food report',approved:'Approved public product page available',device:'◈ Private on this device',allergens:'◈ Check the pack for allergens',
    added:n=>`Added privately: ${n} of 7 discoveries. Open My progress to explore your shelf.`,dup:'Already recorded in your private challenge.',storage:'Local storage is unavailable. Check privacy mode or browser storage settings.',full:'Your 30-entry shelf is full. Remove an entry to make space.',invalid:'This barcode did not pass its check-digit test.',cant:'Could not save this barcode.',
    shareTitle:'FoodScan report',shareText:'Explore source-reported nutrition and ingredients. Always check the package.',handed:'The report link was handed to your share sheet.',copied:'Report link copied.',copyThis:'Copy this report link: ',noShare:'Could not open sharing. Copy this link: '},
  el:{demoK:'ΖΗΣΤΕ ΤΗΝ ΠΡΟΚΛΗΣΗ',savedK:'Η ΑΝΑΚΑΛΥΨΗ ΑΠΟΘΗΚΕΥΤΗΚΕ',newK:'ΚΑΝΤΕ ΤΟ ΝΑ ΜΕΤΡΑΕΙ',demoT:'Επτά τρόφιμα. Μια νέα ματιά.',savedT:'Ωραίο εύρημα. <em>Συνεχίστε.</em>',newT:'Κάθε τρόφιμο έχει μια ιστορία. <em>Ανακαλύψτε το επόμενο.</em>',
    demoD:'Δοκιμάστε την πρόκληση με τρόφιμα από την κουζίνα σας. Χωρίς λογαριασμό και χωρίς κατατάξεις υγείας.',savedD:'Το προϊόν είναι στην ιδιωτική σας συλλογή. Δείτε ξανά τα στοιχεία του, εξερευνήστε κι άλλα ή μοιραστείτε μια αναφορά.',doneD:'Ολοκληρώσατε τις πρώτες επτά ανακαλύψεις. Συνεχίστε ή αποθηκεύστε κι αυτό ως επιπλέον εύρημα.',newD:'Αποθηκεύστε το προϊόν στην ιδιωτική συλλογή επτά ανακαλύψεων και βρείτε κάτι ενδιαφέρον στην κουζίνα σας.',
    found:(c,t)=>`${c} ΑΠΟ ${t}`,hasR:'◈ Υπάρχει αποθηκευμένη αναφορά FoodScan',priv:'◈ Ιδιωτικά, χωρίς λογαριασμό',prog:(c,t)=>`${c} από ${t} ανακαλύψεις`,real:'Πραγματικά προϊόντα. Πραγματική περιέργεια.',
    tryQ:'Δοκιμάστε την πρόκληση των 7',explore:'Η συλλογή μου',another:'Αποθήκευση ακόμη μίας',save:'Αποθήκευση ανακάλυψης',coll:'Η συλλογή μου',share:'Κοινοποίηση αναφοράς',approved:'Υπάρχει εγκεκριμένη δημόσια σελίδα προϊόντος',device:'◈ Ιδιωτικά σε αυτή τη συσκευή',allergens:'◈ Ελέγξτε τα αλλεργιογόνα στη συσκευασία',
    added:n=>`Αποθηκεύτηκε ιδιωτικά: ${n} από 7 ανακαλύψεις.`,dup:'Έχει ήδη καταγραφεί στην πρόκλησή σας.',storage:'Ο τοπικός χώρος αποθήκευσης δεν είναι διαθέσιμος. Ελέγξτε τη λειτουργία ιδιωτικής περιήγησης.',full:'Η λίστα των 30 είναι γεμάτη. Αφαιρέστε μία καταχώριση.',invalid:'Το barcode δεν πέρασε τον έλεγχο ψηφίου.',cant:'Δεν ήταν δυνατή η αποθήκευση.',
    shareTitle:'Αναφορά FoodScan',shareText:'Δείτε διατροφικά στοιχεία και συστατικά από την πηγή. Ελέγχετε πάντα τη συσκευασία.',handed:'Ο σύνδεσμος στάλθηκε στο μενού κοινοποίησης.',copied:'Ο σύνδεσμος αντιγράφηκε.',copyThis:'Αντιγράψτε τον σύνδεσμο: ',noShare:'Η κοινοποίηση δεν άνοιξε. Αντιγράψτε τον σύνδεσμο: '}};
const g=(k,...a)=>{const v=TX[isEl()?'el':'en'][k];return typeof v==='function'?v(...a):v;};
function content(code,saved,count,report,demo){
  const section=document.createElement('section');section.id='fsc-growth-cta';section.className='fsc-growth-cta';section.dataset.code=code;section.dataset.saved=String(saved);section.dataset.lang=isEl()?'el':'en';
  section.lang=section.dataset.lang;
  const hasReport=Boolean(report?.name),complete=count>=TARGET;
  const label=demo?g('demoK'):saved?g('savedK'):g('newK');
  const title=demo?g('demoT'):saved?g('savedT'):g('newT');
  const description=demo?g('demoD'):saved?g('savedD'):complete?g('doneD'):g('newD');
  const segments=Array.from({length:TARGET},(_,i)=>`<span class="fsc-stage${i<count?' is-done':''}" aria-hidden="true">${i<count?'✓':i+1}</span>`).join('');
  section.innerHTML=`<div class="fsc-growth-top"><span class="fsc-growth-kicker"><span class="fsc-growth-star" aria-hidden="true">✦</span> ${label}</span><span class="fsc-growth-pill">${g('found',count,TARGET)}</span></div>
    <div class="fsc-growth-body"><div class="fsc-growth-copy"><h2>${title}</h2><p>${description}</p><span class="fsc-growth-data-status">${hasReport?g('hasR'):g('priv')}</span></div>
    <div class="fsc-growth-progress" aria-label="${g('prog',count,TARGET)}"><div class="fsc-progress-number">${count}<span>/${TARGET}</span></div><div class="fsc-growth-stages">${segments}</div><small>${g('real')}</small></div></div>
    <div class="fsc-growth-actions"><button id="fsc-add-challenge" type="button" class="fsc-primary">${demo?g('tryQ'):saved?g('explore'):complete?g('another'):g('save')} <span aria-hidden="true">↗</span></button><a href="/challenge/" id="fsc-journey-link" class="fsc-secondary">${g('coll')} <strong>${count}/${TARGET}</strong></a><button id="fsc-share-report" type="button" class="fsc-share-action">${g('share')} <span aria-hidden="true">↗</span></button></div>
    <div id="fsc-approved-note" class="fsc-pubnote" hidden><span aria-hidden="true">✓</span> <a id="fsc-approved-link">${g('approved')}</a></div>
    <div class="fsc-growth-bottom"><span>${g('device')}</span><span>${g('allergens')}</span></div><p id="fsc-growth-status" role="status" aria-live="polite"></p>`;
  return section;
}
async function update(force=false){
  const code=barcodeFromRoute(),identity=canonicalGTIN(code),current=document.getElementById('fsc-growth-cta');
  if(!identity){current?.remove();active='';return;}
  if(!force&&current?.dataset.code===code&&current.dataset.lang===(isEl()?'el':'en'))return;
  const run=++generation;current?.remove();active=code;
  const entries=readEntries(storage),saved=entries.some(e=>canonicalGTIN(e.barcode)===identity),count=Math.min(entries.length,TARGET);
  const report=readSavedReports(storage).find(e=>canonicalGTIN(e.barcode)===identity);
  const demo=location.hash.includes('demo=1');
  const section=content(code,saved,count,report,demo);
  const main=document.querySelector('#app main')||document.getElementById('app')||document.body;
  main.append(section);
  section.querySelector('#fsc-add-challenge').addEventListener('click',()=>{
    if(demo||saved){location.assign('/challenge/');return;}
    const result=addEntry(storage,code,'scan');
    if(result.ok){track('public_challenge_saved','scan-result');update(true);notify(g('added',Math.min(result.entries.length,TARGET)));}
    else if(result.reason==='duplicate'){update(true);notify(g('dup'));}
    else notify(({storage:g('storage'),full:g('full'),invalid:g('invalid')})[result.reason]||g('cant'));
  });
  section.querySelector('#fsc-share-report').addEventListener('click',async()=>{
    const publicLink=section.querySelector('#fsc-approved-link');
    const target=publicLink&&!publicLink.closest('[hidden]')?publicLink.href:`${location.origin}/p/${code}`;
    const u=new URL(target,location.origin),ref=createReferral();u.searchParams.set('ref',ref);
    track('product_share_started','scan-report',ref);
    try{
      if(navigator.share){await navigator.share({title:g('shareTitle'),text:g('shareText'),url:u.href});notify(g('handed'));track('product_share_handoff','native',ref);}
      else if(navigator.clipboard?.writeText&&isSecureContext){await navigator.clipboard.writeText(u.href);notify(g('copied'));track('product_link_copied','copy',ref);}
      else notify(g('copyThis')+u.href);
    }catch(error){if(error?.name!=='AbortError')notify(g('noShare')+u.href);}
  });
  if(demo)return;
  try{
    const response=await fetch(`/api/public-products/lookup?barcode=${encodeURIComponent(code)}`,{credentials:'same-origin',signal:AbortSignal.timeout(4000)});
    if(!response.ok)return;
    const data=await response.json();
    if(run!==generation||barcodeFromRoute()!==code||!data.public||typeof data.url!=='string'||!/^\/products\/\d{8,14}$/.test(data.url))return;
    const note=section.querySelector('#fsc-approved-note'),link=section.querySelector('#fsc-approved-link');
    note.hidden=false;link.href=data.url;
  }catch{}
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>update(),180);}
function start(){
  addEventListener('hashchange',schedule);addEventListener('popstate',schedule);
  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key==='fs13:saved'||e.key==='fs13:history')update(true);});
  const node=document.getElementById('app');
  if(node)new MutationObserver(()=>{const c=document.getElementById('fsc-growth-cta');if(barcodeFromRoute()&&(!c||c.dataset.lang!==(isEl()?'el':'en')))schedule();}).observe(node,{childList:true,subtree:true});
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
// A shared deep-link open is not counted as a new product scan.
const incoming=new URLSearchParams(location.search).get('ref');
if(validReferral(incoming)){
  let sent=false;
  const recordOpen=()=>{
    const code=barcodeFromRoute();
    if(!sent&&canonicalGTIN(code)&&!location.hash.includes('demo=1')){sent=true;track('public_shared_report_open','report-open',incoming,'/products');}
  };
  addEventListener('hashchange',recordOpen);recordOpen();
}
