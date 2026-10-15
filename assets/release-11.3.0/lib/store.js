import {validateStoredProduct,validBarcode} from './model.js';
import {normalizeProfile,DEFAULT_PROFILE} from './profile.js';
import {requireEligible,resolveProduct} from './policy.js';
import {COUNTRIES} from './nutrition.js';
const COUNTRY_CODES=new Set(COUNTRIES.map(c=>c.code));
const KEY='foodscan:v3';
export const AISLES=Object.freeze([['produce','Produce'],['dairy','Dairy & eggs'],['bakery','Bakery'],['meat','Meat & fish'],['pantry','Pantry staples'],['frozen','Frozen'],['household','Household'],['other','Other']]);
const AISLE_SET=new Set(AISLES.map(([k])=>k));
const CURRENCIES=new Set(['EUR','USD','GBP','CAD','AUD']);
export function currencyForLocale(locale){const region=String(locale||'').split('-').at(-1)?.toUpperCase();return ({US:'USD',GB:'GBP',CA:'CAD',AU:'AUD'})[region]||'EUR';}
const moneyCents=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=999999?v:null;

export const EMPTY=()=>({saved:[],recent:[],library:[],theme:'system',focus:'balanced',profile:DEFAULT_PROFILE(),shopping:[],pantry:[],purchases:[],events:[],grocery:{budgetCents:null,currency:'EUR',startedAt:null,completedTrips:0,lastCompletedAt:null},settings:{textSize:'standard',locale:'en-GB',home:'home',reminders:false,recap:true,country:'',telemetry:false},habit:{activeDays:[],bestStreak:0,lastVisitDay:''},createdAt:Date.now()});
const safeText=(v,max=180)=>typeof v==='string'?v.trim().slice(0,max):'';
const integer=(v,min,max,fallback)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,Math.floor(v))):fallback;
const date=v=>{try{return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v?v:'';}catch{return '';}};
export function uid(){return globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;}
function products(items,max){const map=new Map();if(Array.isArray(items))for(const v of items.slice(0,max*2)){const p=validateStoredProduct(v);if(p&&!map.has(p.barcode))map.set(p.barcode,p);}return [...map.values()].slice(0,max);}
function row(v){if(!v||typeof v!=='object'||!safeText(v.name))return null;return {id:/^[a-zA-Z0-9_-]{1,80}$/.test(v.id||'')?v.id:uid(),name:safeText(v.name),barcode:validBarcode(v.barcode)?v.barcode:'',quantity:integer(v.quantity,1,99,1),note:safeText(v.note,600),addedAt:typeof v.addedAt==='number'&&Number.isFinite(v.addedAt)?v.addedAt:Date.now()};}
function rows(items,convert){const map=new Map();if(Array.isArray(items))for(const v of items.slice(0,400)){const basic=row(v);if(basic&&!map.has(basic.id))map.set(basic.id,convert(v,basic));}return [...map.values()].slice(0,200);}

const timestamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
export function shoppingRow(v){const b=row(v);return b?{...b,checked:v.checked===true,intent:['buy-again','compare-later','skip'].includes(v.intent)?v.intent:'buy-again',purchaseId:safeText(v.purchaseId,80),aisle:AISLE_SET.has(v.aisle)?v.aisle:'',unit:['item','pack','bottle','bag','kg','g','L','ml'].includes(v.unit)?v.unit:'item',priceCents:moneyCents(v.priceCents)}:null;}
export function pantryRow(v){const b=row(v);return b?{...b,expires:date(v.expires),dateKind:['use-by','best-before','unspecified'].includes(v.dateKind)?v.dateKind:'unspecified',remind:v.remind===true,purchaseId:safeText(v.purchaseId,80),purchasedAt:timestamp(v.purchasedAt),opened:date(v.opened),runningLow:v.runningLow===true}:null;}
function purchaseRecords(items){
 const map=new Map();
 if(Array.isArray(items))for(const v of items.slice(-500)){
  if(!v||!safeText(v.id,80)||timestamp(v.at)===null)continue;
  const before=shoppingRow(v.beforeShopping),after=shoppingRow(v.afterShopping),pantry=pantryRow(v.afterPantry);
  if(!before||!after||!pantry||after.id!==before.id||after.purchaseId!==v.id||pantry.purchaseId!==v.id)continue;
  map.set(v.id,{id:safeText(v.id,80),at:v.at,undoneAt:timestamp(v.undoneAt),name:after.name,barcode:after.barcode,quantity:after.quantity,shoppingId:after.id,pantryId:pantry.id,beforeShopping:before,afterShopping:after,afterPantry:pantry});
 }
 return [...map.values()];
}

const EVENTS=['session_start','scan_start','scan_success','scan_failed','food_saved','list_added','alternative_shown','alternative_opened','swap_saved','amazon_search_opened','correction_draft','reminder_shown'];
export function normalizeStore(raw){
 const settings=raw?.settings||{},locale=safeText(settings.locale,35);
 let validLocale='en-GB';try{validLocale=Intl.getCanonicalLocales(locale||'en-GB')[0];}catch{}
 return {saved:products(raw?.saved,200),recent:products(raw?.recent,60),library:products(raw?.library,400),theme:['light','dark','system'].includes(raw?.theme)?raw.theme:'system',focus:['balanced','protein','sugars','fiber'].includes(raw?.focus)?raw.focus:'balanced',profile:normalizeProfile(raw?.profile),
  shopping:rows(raw?.shopping,v=>shoppingRow(v)),
  pantry:rows(raw?.pantry,v=>pantryRow(v)),
  purchases:purchaseRecords(raw?.purchases),
  grocery:{budgetCents:moneyCents(raw?.grocery?.budgetCents),currency:CURRENCIES.has(raw?.grocery?.currency)?raw.grocery.currency:currencyForLocale(validLocale),startedAt:timestamp(raw?.grocery?.startedAt),completedTrips:integer(raw?.grocery?.completedTrips,0,10000,0),lastCompletedAt:timestamp(raw?.grocery?.lastCompletedAt)},
  settings:{textSize:['standard','large','extra'].includes(settings.textSize)?settings.textSize:'standard',locale:validLocale,home:['home','shopping','insights'].includes(settings.home)?settings.home:'home',reminders:settings.reminders===true,recap:settings.recap===undefined?true:settings.recap===true,country:COUNTRY_CODES.has(settings.country)?settings.country:'',telemetry:settings.telemetry===true},
  habit:{activeDays:Array.isArray(raw?.habit?.activeDays)?[...new Set(raw.habit.activeDays.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))].slice(-90):[],bestStreak:Number.isInteger(raw?.habit?.bestStreak)?Math.max(0,raw.habit.bestStreak):0,lastVisitDay:/^\d{4}-\d{2}-\d{2}$/.test(raw?.habit?.lastVisitDay||'')?raw.habit.lastVisitDay:''},
  events:Array.isArray(raw?.events)?raw.events.filter(x=>x&&EVENTS.includes(x.type)&&Number.isFinite(x.at)&&x.at>Date.now()-35*86400000&&x.at<=Date.now()+60000).slice(-1500).map(x=>({type:x.type,at:x.at,id:safeText(x.id,80),method:['camera','photo','manual','link'].includes(x.method)?x.method:'manual',cached:x.cached===true,repeat:x.repeat===true,durationMs:integer(x.durationMs,0,120000,0),firstValueMs:integer(x.firstValueMs,0,3600000,0),kind:safeText(x.kind,60),placement:['product','swap','shopping','today'].includes(x.placement)?x.placement:'',matches:integer(x.matches,0,30,0),known:integer(x.known,0,30,0),grade:/^[A-E]$/.test(x.grade)?x.grade:'',nova:[1,2,3,4].includes(x.nova)?x.nova:0,reds:integer(x.reds,0,4,0),ruleVersion:safeText(x.ruleVersion,30),profileSignature:safeText(x.profileSignature,400),profiled:x.profiled===true,checks:Array.isArray(x.checks)?x.checks.filter(c=>c&&['sugars','protein','fiber','sodium'].includes(c.key)&&['match','fact','unknown'].includes(c.status)).map(c=>({key:c.key,status:c.status})):[]})):[],
  createdAt:typeof raw?.createdAt==='number'&&Number.isFinite(raw.createdAt)?raw.createdAt:Date.now()};
}
export function loadStore(storage){
 try{storage??=globalThis.localStorage;const existing=storage.getItem(KEY)||storage.getItem('foodscan:v2')||storage.getItem('foodscan:v1');return {store:normalizeStore(existing?JSON.parse(existing):{}),error:'',hadData:Boolean(existing)};}
 catch{return {store:EMPTY(),error:'This browser could not read local FoodScan data. This session still works; keep your existing backup.'};}
}
export function saveStore(store,storage){try{storage??=globalThis.localStorage;storage.setItem(KEY,JSON.stringify(normalizeStore(store)));return '';}catch{return 'Saving is blocked or browser storage is full. Export a backup; current changes may only last this session.';}}
export function deleteStore(storage){try{storage??=globalThis.localStorage;for(const k of [KEY,'foodscan:v2','foodscan:v1'])storage.removeItem(k);return '';}catch{return 'Your browser blocked clearing local storage.';}}
export function parseBackup(text){
 if(typeof text!=='string'||text.length>3_000_000)throw new Error('Choose a FoodScan JSON backup smaller than 3 MB.');
 let raw;try{raw=JSON.parse(text);}catch{throw new Error('This is not a valid JSON backup.');}
 if(raw?.app!=='FoodScan'||![2,3,4].includes(raw?.version)||!Array.isArray(raw.saved))throw new Error('Choose a FoodScan v2, v3 or v4 backup exported from this app.');
 const normalized=normalizeStore(raw);if(raw.saved.length&&!normalized.saved.length)throw new Error('The backup does not contain valid product records.');return {store:normalized,version:raw.version};
}
export const parseImport=text=>parseBackup(text).store.saved;
export const exportStore=store=>JSON.stringify({...normalizeStore(store),app:'FoodScan',version:4,attribution:'Open Food Facts and contributors; local entries are unverified personal notes',dataLicense:'https://opendatacommons.org/licenses/odbl/1-0/',photoLicense:'https://creativecommons.org/licenses/by-sa/3.0/',exportedAt:new Date().toISOString(),photoNotice:'Private label photos stay on this device and are not included. Save them separately.'},null,2);
export function mergeProducts(a,b,max=200){return [...new Map([...a,...b].map(p=>[p.barcode,p])).values()].slice(0,max);}
export function addActivity(store,type,details={}){if(!store.settings.recap)return;store.events.push({type,at:Date.now(),id:uid(),...details});store.events=store.events.slice(-1500);}
export function addShopping(store,{name,barcode='',intent='buy-again',quantity=1,product=null,aisle='',unit='item',note='',priceCents=null}){
 requireEligible(resolveProduct({store,active:product},barcode||product?.barcode),store.profile);
 if(store.shopping.length>=200)throw new Error('Your shopping list has 200 entries. Remove completed items first.');
 const existing=store.shopping.find(x=>!x.checked&&x.intent===intent&&(barcode?x.barcode===barcode:x.name.toLowerCase()===name.toLowerCase()));if(existing)return {item:existing,created:false};
 const item=shoppingRow({id:uid(),name:safeText(name),barcode,quantity:integer(quantity,1,99,1),checked:false,intent,note:safeText(note,600),aisle,unit,priceCents,addedAt:Date.now()});if(!item.name)throw new Error('Enter a shopping item.');store.shopping.push(item);return {item,created:true};
}
export function localRecap(store,now=Date.now()){
 const since=now-7*86400000,events=store.events.filter(x=>x.at>=since),success=events.filter(x=>x.type==='scan_success'),starts=events.filter(x=>x.type==='scan_start'),failed=events.filter(x=>x.type==='scan_failed');
 const median=arr=>{const sorted=arr.sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:null;};
 const grades={A:0,B:0,C:0,D:0,E:0};for(const x of success)if(grades[x.grade]!=null)grades[x.grade]++;
 return {grades,success:success.length,starts:starts.length,repeat:success.filter(x=>x.repeat).length,cached:success.filter(x=>x.cached).length,saves:events.filter(x=>x.type==='food_saved').length,listed:events.filter(x=>x.type==='list_added').length,swaps:events.filter(x=>x.type==='swap_saved').length,merchantSearches:events.filter(x=>x.type==='amazon_search_opened').length,missing:failed.filter(x=>x.kind==='not_found').length,failed:failed.length,cacheMedianMs:median(success.filter(x=>x.cached).map(x=>x.durationMs)),firstValueMs:store.events.find(x=>x.type==='scan_success'&&x.firstValueMs>0)?.firstValueMs??null};
}
export function calendarReminder(name,day){
 if(!date(day))throw new Error('Choose a valid date first.');
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const escape=v=>String(v).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FoodScan//Local reminder//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${uid()}@foodscan.local`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${day.replaceAll('-','')}`,`SUMMARY:${escape(name.slice(0,400))}`,'DESCRIPTION:Check your FoodScan list and the current package instructions. No food safety assessment.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
