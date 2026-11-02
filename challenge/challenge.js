/** FoodScan Fridge Challenge v58: opt-in discovery, local-only state, never an inferred health score. */
import {STORAGE_KEY,TARGET,CHALLENGE_LIMIT,isValidGTIN,canonicalGTIN,addEntry,removeEntry,readEntries,writeEntries,updateEntryNote,challengeMetrics,importCandidates} from '../fridge-core.mjs?v=75';

const $=selector=>document.querySelector(selector);
const prompts=[
  {icon:'☀',title:'The breakfast shelf',tip:'Cereal, bread, yogurt or a familiar morning staple.'},
  {icon:'◉',title:'Your everyday drink',tip:'Check the serving size and nutrition of a packaged drink.'},
  {icon:'✦',title:'A favorite snack',tip:'Look closer at something you often pick up.'},
  {icon:'❋',title:'The spread shelf',tip:'Explore a topping, sauce or familiar spread.'},
  {icon:'◒',title:'A sauce or dressing',tip:'Check the reported salt and ingredients.'},
  {icon:'▤',title:'The pantry staple',tip:'Explore a packaged favorite from your cupboard.'},
  {icon:'◇',title:'The wild card',tip:'Any product you find interesting. Your choice.'}
];
const text=(tag,className,content)=>{const el=document.createElement(tag);if(className)el.className=className;el.textContent=content;return el;};
const notice=message=>{$('#feedback').textContent=message;};
const number=n=>Number(n).toLocaleString('en',{maximumFractionDigits:1});
const href=barcode=>'/p/'+encodeURIComponent(barcode);
const storage=(()=>{try{return window.localStorage;}catch{return {getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}};}})();
const publicURL=()=>new URL('/challenge/',location.origin);
const referralPattern=/^f[a-z0-9]{11}$/;
function newReferral(){const values=crypto.getRandomValues(new Uint8Array(11));return 'f'+Array.from(values,number=>(number%36).toString(36)).join('');}
function inviteURL(){const url=publicURL();url.searchParams.set('ref',newReferral());return url;}
function event(name,method,referral=''){
  if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
  const value={name,version:'58.0.0',path:'/challenge',properties:{source:'challenge',route:'challenge',method}};
  if(referralPattern.test(referral))value.properties.referral=referral;
  value.eventId='f'+Array.from(crypto.getRandomValues(new Uint8Array(15)),n=>(n%36).toString(36)).join('');
  const data=JSON.stringify(value);
  try{if(navigator.sendBeacon){navigator.sendBeacon('/api/events',new Blob([data],{type:'application/json'}));}else fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:data,keepalive:true}).catch(()=>{});}catch{}
}
function updateScanLinks(){
  const incoming=new URLSearchParams(location.search).get('ref');
  const url=new URL('/',location.origin);
  if(referralPattern.test(incoming||''))url.searchParams.set('ref',incoming);
  url.hash='/scan';
  for(const node of document.querySelectorAll('#scan-next,#next-action'))node.href=url.href;
}
function renderCard(entry,index){
  const slot=text('article','discovery-card'+(entry?' filled':''),'');
  const top=text('div','card-top',''),num=text('span','card-number',`DISCOVERY ${String(index+1).padStart(2,'0')}`),symbol=text('span','card-symbol',entry?'✓':prompts[index].icon);
  top.append(num,symbol);slot.append(top);
  if(!entry){
    slot.append(text('h3','',prompts[index].title),text('p','',prompts[index].tip));
    const actions=text('div','card-actions',''),a=document.createElement('a');a.href=$('#scan-next').href;a.textContent='Scan a food →';actions.append(a);slot.append(actions);
    return slot;
  }
  const report=entry.report, title=report?.name||`Barcode ending ${entry.barcode.slice(-4)}`;
  slot.append(text('span','report-chip'+(report?'':' report-chip--code'),report?'Saved report snapshot':'Barcode recorded'));
  slot.append(text('h3','',title));
  const fact=text('div','card-fact','');
  if(report?.grade){const grade=text('span',`grade grade-${report.grade}`,report.grade);grade.title='Grade from a locally saved FoodScan report; verify current source and package';fact.append(grade);}
  const details=report?.brand?`${report.brand} · On-device report snapshot`:report?'On-device FoodScan report snapshot':'GTIN format only · product not checked';
  slot.append(text('p','',details));
  if(report?.basis){
    const key=['sugars','salt','saturatedFat'].find(k=>report.nutrients?.[k]!==null && report.nutrients?.[k]!==undefined);
    if(key){const names={sugars:'Total sugars',salt:'Salt',saturatedFat:'Saturated fat'},unit=report.basis==='ml'?'100 ml':'100 g';
      fact.append(text('span','',`Reported ${names[key].toLowerCase()} ${number(report.nutrients[key])} g / ${unit}`));}
  }
  if(fact.childNodes.length)slot.append(fact);
  if(entry.note){const personal=text('div','personal-note','');personal.append(text('small','','MY PRIVATE FIELD NOTE'),text('p','',entry.note));slot.append(personal);}
  const actions=text('div','card-actions',''),view=document.createElement('a');view.href=href(entry.barcode);view.textContent='Full report ↗';
  const noteButton=text('button','note-trigger',entry.note?'Edit my note':'Add a private note');noteButton.type='button';
  noteButton.addEventListener('click',()=>{
    if(slot.querySelector('.note-form'))return;
    const form=text('form','note-form',''),label=text('label','',`What did you notice about discovery ${index+1}?`),field=document.createElement('textarea'),buttons=text('div','note-actions',''),save=text('button','btn-note-save','Save note'),cancel=text('button','btn-note-cancel','Cancel');
    const id=`note-for-${index}`;field.id=id;label.htmlFor=id;field.value=entry.note||'';field.maxLength=160;field.rows=3;field.placeholder='A label detail I want to remember…';
    save.type='submit';cancel.type='button';cancel.addEventListener('click',()=>{form.remove();noteButton.focus();});
    buttons.append(save,cancel);form.append(label,field,buttons);
    form.addEventListener('submit',event=>{event.preventDefault();if(updateEntryNote(storage,entry.barcode,field.value.trim())){render();notice('Saved to this device only. Your note is never shared.');}else notice('Note could not be saved. Browser storage may be blocked.');});
    slot.append(form);field.focus();
  });
  const remove=text('button','remove-trigger','Remove');remove.type='button';remove.setAttribute('aria-label',`Remove discovery ${index+1}: ${title}`);
  remove.addEventListener('click',()=>{if(removeEntry(storage,entry.barcode)){render();notice('Discovery removed from this device.');}else notice('Could not update progress; browser storage may be unavailable.');});
  actions.append(view,noteButton,remove);slot.append(actions);return slot;
}
function render(){
  const model=challengeMetrics(storage),{count,entries}=model;
  $('#count').textContent=String(count);
  $('#progress').setAttribute('aria-valuenow',String(count));
  $('#ring').style.setProperty('--pct',`${count/TARGET*100}%`);
  $('#fill').style.width=`${count/TARGET*100}%`;
  document.querySelectorAll('#mini-shelf .mini-slot').forEach((slot,i)=>{slot.classList.toggle('filled',i<count);slot.textContent=i<count?'✓':String(i+1).padStart(2,'0');});
  $('#visual-headline').textContent=count>=7?'Seven finds. A fresh perspective.':count>=5?'Just a few discoveries to go.':count>=3?'Your collection is taking shape.':count>=1?'One discovery can lead to another.':'A little curiosity goes a long way.';
  $('#progress-label').textContent=`${count} / ${TARGET} EXPLORED`;
  $('#reports-count').textContent=String(model.savedReports);
  $('#codes-count').textContent=String(model.unchecked);
  $('#phase-label').textContent=count===TARGET?'COLLECTION COMPLETE':count>=4?'HALFWAY AND BEYOND':count>0?'YOUR JOURNEY HAS BEGUN':"LET'S BEGIN";
  $('#milestone').textContent=count===TARGET?'You explored seven labels. Share the milestone—not your personal food list.':count===0?'Begin with something familiar on your kitchen shelf.':`${count} recorded. ${TARGET-count} more little stories to uncover.`;
  const next=prompts[Math.min(count,TARGET-1)];
  $('#next-step-title').textContent=count===TARGET?'You finished! Keep discovering':next.title;
  $('#next-tip').textContent=count===TARGET?'Explore more foods, or revisit your reports to compare reliable nutrition facts.':next.tip+' Any packaged food counts; this is just an idea.';
  const shelf=$('#discoveries');shelf.replaceChildren();
  for(let i=0;i<TARGET;i++)shelf.append(renderCard(entries[i]||null,i));
  const extras=$('#extra-panel');extras.hidden=entries.length<=TARGET;
  const extraList=$('#extra-entries');extraList.replaceChildren();
  for(const entry of entries.slice(TARGET)){
    const row=text('div','extra-row',''),title=text('strong','',entry.report?.name||`Barcode ${entry.barcode}`),actions=text('div','',''),link=document.createElement('a');link.href=href(entry.barcode);link.textContent='Report ↗';
    const remove=text('button','','Remove');remove.addEventListener('click',()=>{if(removeEntry(storage,entry.barcode))render();});actions.append(link,remove);row.append(title,actions);extraList.append(row);
  }
  $('#extra-count').textContent=`${Math.max(0,entries.length-TARGET)} additional`;
  $('#completion').hidden=!model.ready;
  let insight='Your on-device saved FoodScan reports can show product names and source-reported facts here. A barcode alone is not a verified product.';
  const available=entries.find(e=>e.report?.basis && ['sugars','salt','saturatedFat'].some(k=>e.report.nutrients[k]!==null));
  if(available){const item=available.report,key=['sugars','salt','saturatedFat'].find(k=>item.nutrients[k]!==null),label={sugars:'total sugars',salt:'salt',saturatedFat:'saturated fat'}[key];
    insight=`Your saved report for ${item.name||'one product'} lists ${number(item.nutrients[key])} g ${label} per 100 ${item.basis}. This is a local snapshot, not a fresh verification or an overall health verdict. Open the report and check the current package.`;}
  else if(model.savedReports)insight=`${model.savedReports} ${model.savedReports===1?'entry has':'entries have'} an on-device FoodScan report snapshot. Open its full report to check grade confidence, ingredients, and the original source. Missing values are not zero.`;
  $('#insight-text').textContent=insight;
  const availableImports=importCandidates(storage);
  $('#open-import').textContent=availableImports.length?`Use my saved FoodScan reports (${availableImports.length})`:'Find saved FoodScan reports';
  updateScanLinks();
}
function focusNewDiscovery(){
  const cards=document.querySelectorAll('#discoveries .discovery-card.filled');
  const latest=cards[cards.length-1];
  if(!latest)return;
  latest.classList.add('just-added');
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)latest.scrollIntoView({behavior:'smooth',block:'center'});
  else latest.scrollIntoView({block:'center'});
}
function importUI(){
  const panel=$('#import-panel'),candidates=importCandidates(storage);
  panel.hidden=false;const list=$('#import-options');list.replaceChildren();
  if(!candidates.length){list.append(text('p','','No other saved FoodScan reports were found in this browser. Scan a product and save it inside FoodScan, or record a barcode below.'));}
  for(const candidate of candidates){
    const item=text('label','import-option',''),check=document.createElement('input');check.type='checkbox';check.value=candidate.barcode;
    const words=text('span','',''),name=text('strong','',candidate.name||`Barcode ${candidate.barcode}`),detail=text('small','',`${candidate.brand?candidate.brand+' · ':''}${candidate.grade?`Saved grade ${candidate.grade} · `:''}On-device report`);
    words.append(name,detail);item.append(check,words);list.append(item);
  }
  const update=()=>{const n=list.querySelectorAll('input:checked').length,space=CHALLENGE_LIMIT-readEntries(storage).length;$('#import-count').textContent=`${n} selected · ${space} spaces available`;$('#confirm-import').disabled=!n||n>space;};
  list.onchange=update;update();panel.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  $('#close-import').focus({preventScroll:true});
}
$('#open-import').addEventListener('click',importUI);
$('#close-import').addEventListener('click',()=>{$('#import-panel').hidden=true;$('#open-import').focus({preventScroll:true});});
$('#confirm-import').addEventListener('click',()=>{
  const selected=[...$('#import-options').querySelectorAll('input:checked')].map(c=>c.value);
  let added=0;
  for(const code of selected){const res=addEntry(storage,code,'import');if(res.ok)added++;else if(res.reason==='storage'){notice('Browser storage is unavailable; no further changes were saved.');break;}}
  $('#import-panel').hidden=true;render();notice(`${added} ${added===1?'saved report':'saved reports'} added to your private challenge.`);if(added){event('public_challenge_saved','saved-report-import');focusNewDiscovery();}
});
$('#barcode-form').addEventListener('submit',submitEvent=>{
  submitEvent.preventDefault();const value=$('#barcode').value.replace(/[\s-]/g,'');
  const result=addEntry(storage,value,'manual');
  if(!result.ok){notice(({invalid:'Please check the digits and final GTIN check digit.',duplicate:'Already in your discovery shelf.',full:'You have 30 entries. Remove one before adding another.',storage:'Browser storage is unavailable. Check private mode or storage settings.'})[result.reason]||'Could not save this discovery.');return;}
  $('#barcode-form').reset();render();notice(`Recorded privately. ${Math.min(result.entries.length,TARGET)} of ${TARGET} discoveries unlocked.`);event('public_challenge_saved','manual-barcode');focusNewDiscovery();
});
$('#restart').addEventListener('click',()=>{
  if(!confirm('Clear every discovery in this browser? This cannot be undone.'))return;
  if(writeEntries(storage,[])){render();notice('Your private challenge has been restarted.');}else notice('Browser storage is not available.');
});
function createCard(){
  const count=challengeMetrics(storage).count,canvas=document.createElement('canvas');
  canvas.width=1080;canvas.height=1920;
  const c=canvas.getContext('2d');if(!c)throw Error('canvas_unavailable');
  const fill=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const box=(x,y,w,h,r,color)=>{c.fillStyle=color;c.beginPath();if(typeof c.roundRect==='function')c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);c.fill();};
  const txt=(message,x,y,font,color,align='left')=>{c.font=font;c.textAlign=align;c.fillStyle=color;c.fillText(message,x,y);c.textAlign='left';};
  const bg=c.createLinearGradient(0,0,1080,1920);bg.addColorStop(0,'#092d29');bg.addColorStop(.6,'#12523e');bg.addColorStop(1,'#082f29');fill(0,0,1080,1920,bg);
  // Decorative circles, not representations of any of the viewer's foods.
  c.strokeStyle='#ffffff13';c.lineWidth=4;for(const [x,y,r] of [[940,130,420],[1080,820,560],[80,1750,400]]){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();}
  box(65,84,86,86,22,'#d5fa87');txt('✓',107,143,'bold 60px system-ui','#0d4232','center');
  txt('FoodScan',178,149,'900 54px system-ui','#f6fff4');
  box(65,246,435,72,32,'#ffffff1a');txt('THE 7-DISCOVERY QUEST',90,291,'900 27px system-ui','#d9f6a9');
  txt('Everyday foods.',65,474,'900 82px system-ui','#ffffff');
  txt('Little discoveries.',65,590,'italic 93px Georgia,serif','#d6f98f');
  txt('A curiosity collection, not a health score.',65,682,'35px system-ui','#cbe6d6');
  box(65,774,950,670,44,'#f2f9ec');
  txt('MY DISCOVERY SHELF',115,849,'900 27px system-ui','#29684b');
  txt(String(count),105,1157,'900 285px system-ui','#134e3d');txt('/ 7',465,1150,'900 90px system-ui','#519877');
  txt(count===7?'All seven finds collected.':count===0?'The first discovery is waiting.':`${7-count} more discoveries to explore.`,115,1240,'750 35px system-ui','#4c765a');
  for(let i=0;i<TARGET;i++){
    const x=114+i*122,y=1310;
    box(x,y,100,91,16,i<count?'#1d7655':'#e0e9de');
    txt(i<count?'✓':String(i+1),x+50,y+62,'900 46px system-ui',i<count?'#e2ffa8':'#8aa58d','center');
  }
  txt('Your personal product list stays private.',65,1557,'33px system-ui','#e0eee3');
  txt('Only the discovery count is shared.',65,1615,'33px system-ui','#e0eee3');
  box(65,1683,950,157,29,'#d6fa8e');
  txt('TRY YOUR OWN SEVEN DISCOVERIES',103,1752,'900 39px system-ui','#103f31');
  txt('food-scan.gearuptofit.com/challenge/',103,1807,'32px system-ui','#235d47');
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('png_failed')),'image/png'));
}
function downloadBlob(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='foodscan-7-discoveries.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('#download-card').addEventListener('click',async()=>{try{downloadBlob(await createCard());notice('Story image downloaded. No product details were included.');}catch{notice('Story card export is not supported on this device.');}});
$('#copy-invite').addEventListener('click',async()=>{
  const url=inviteURL().href;
  try{if(navigator.clipboard?.writeText && isSecureContext){await navigator.clipboard.writeText(url);notice('Invitation link copied. Your private list is not included.');event('public_challenge_share','copy');return;}}catch{}
  notice('Copy and share this public invitation: '+url);
});
$('#share-card').addEventListener('click',async eventClick=>{
  const button=eventClick.currentTarget;button.disabled=true;const url=inviteURL().href;
  try{
    const blob=await createCard(),file=typeof File==='function'?new File([blob],'foodscan-fridge-progress.png',{type:'image/png'}):null;
    if(file && navigator.share && navigator.canShare?.({files:[file]})){
      await navigator.share({title:'My FoodScan Fridge Challenge',text:'Seven discoveries, your own pace. Try it: '+url,files:[file]});
      notice('The progress image was handed to your share sheet.');event('public_challenge_share','image');return;
    }
    if(navigator.share){await navigator.share({title:'FoodScan 7-Discovery Challenge',text:'Explore seven labels. Your list stays private.',url});notice('The invitation was handed to your share sheet.');event('public_challenge_share','native');return;}
    if(navigator.clipboard?.writeText && isSecureContext){await navigator.clipboard.writeText(url);downloadBlob(blob);notice('Invite link copied and privacy-safe progress image downloaded.');event('public_challenge_share','copy-image');return;}
    downloadBlob(blob);notice('Progress image downloaded. Invite a friend with: '+url);
  }catch(error){if(error?.name!=='AbortError')notice('The share was not completed. Try Copy invite link or Download story card.');}
  finally{button.disabled=false;}
});
for(const link of document.querySelectorAll('#scan-next,#next-action'))link.addEventListener('click',()=>event(referralPattern.test(new URLSearchParams(location.search).get('ref')||'')?'public_challenge_referral_scan_cta':'public_challenge_scan_cta','click',new URLSearchParams(location.search).get('ref')||''));
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY || ['fs13:saved','fs13:history'].includes(event.key))render();});
const incoming=new URLSearchParams(location.search).get('ref');
if(referralPattern.test(incoming||'')){
  let seen=false;try{seen=sessionStorage.getItem('foodscan.challenge.seen.'+incoming)==='1';sessionStorage.setItem('foodscan.challenge.seen.'+incoming,'1');}catch{}
  if(!seen)event('public_challenge_open','referral',incoming);
}
render();
