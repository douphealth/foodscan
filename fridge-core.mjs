/** FoodScan Fridge Core v58. Local-only; never sends product lists to a server. */
import { assessGrade } from './assets/domain-v7540.mjs';
export const STORAGE_KEY = 'foodscan.fridge.v1';
export const CHALLENGE_LIMIT = 30;
export const TARGET = 7;
const scannerSources = ['fs13:saved', 'fs13:history'];
const reportMemo = new WeakMap(); // Avoid reparsing the same saved report data during each render.
const safeText = (value, max = 90) => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max) : '';
const safeNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export function isValidGTIN(input) {
  const v = String(input || '').trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(v) || /^0+$/.test(v)) return false;
  let sum = 0;
  for (let i = v.length - 2, weight = 3; i >= 0; --i, weight = 4 - weight) sum += Number(v[i]) * weight;
  return ((10 - (sum % 10)) % 10) === Number(v.at(-1));
}
export function canonicalGTIN(barcode) { return isValidGTIN(barcode) ? String(barcode).padStart(14, '0') : null; }
function sanitizedEntry(item) {
  const barcode = safeText(item?.barcode, 14);
  if (!isValidGTIN(barcode)) return null;
  const addedAt = Number(item?.addedAt);
  return {barcode, addedAt: Number.isSafeInteger(addedAt) && addedAt > 0 && addedAt < Date.now() + 86400000 ? addedAt : Date.now(), origin: ['scan','manual','import'].includes(item?.origin) ? item.origin : 'legacy', note: safeText(item?.note,160)};
}
export function readEntries(storage=globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 35000) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = new Set(), result=[];
    for (const value of parsed.slice(-100)) {
      const entry = sanitizedEntry(value), identity = entry && canonicalGTIN(entry.barcode);
      if (identity && !unique.has(identity)) {unique.add(identity);result.push(entry);}
    }
    return result.slice(-CHALLENGE_LIMIT);
  } catch {return [];}
}
export function writeEntries(storage, entries) {
  const ids=new Set(), cleaned=[];
  for (const raw of entries) {
    const item=sanitizedEntry(raw), id=item && canonicalGTIN(item.barcode);
    if (id && !ids.has(id)) {ids.add(id);cleaned.push(item);}
  }
  try {storage.setItem(STORAGE_KEY,JSON.stringify(cleaned.slice(-CHALLENGE_LIMIT)));return true;}catch{return false;}
}
export function addEntry(storage, barcode, origin='manual') {
  const input=String(barcode || '').replace(/[\s-]/g,'');
  const identity=canonicalGTIN(input);
  if (!identity) return {ok:false,reason:'invalid',entries:readEntries(storage)};
  const entries=readEntries(storage);
  if (entries.some(item=>canonicalGTIN(item.barcode)===identity)) return {ok:false,reason:'duplicate',entries};
  if (entries.length >= CHALLENGE_LIMIT) return {ok:false,reason:'full',entries};
  entries.push({barcode:input,addedAt:Date.now(),origin});
  if (!writeEntries(storage,entries)) return {ok:false,reason:'storage',entries};
  return {ok:true,reason:'added',entries:readEntries(storage)};
}
export function updateEntryNote(storage, barcode, note) {
  const id=canonicalGTIN(barcode);
  if(!id || typeof note!=='string' || note.length>160)return false;
  const entries=readEntries(storage), entry=entries.find(e=>canonicalGTIN(e.barcode)===id);
  if(!entry)return false;
  entry.note=safeText(note,160);
  return writeEntries(storage,entries);
}
export function removeEntry(storage,barcode) {
  const id=canonicalGTIN(barcode);
  if (!id) return false;
  return writeEntries(storage,readEntries(storage).filter(e=>canonicalGTIN(e.barcode)!==id));
}
/** Report snapshots come only from FoodScan's pre-existing on-device saved/history records. */
export function localReportSnapshot(raw) {
  const product=raw?.product;
  const barcode=String(product?.barcode || raw?.barcode || '');
  if (!isValidGTIN(barcode)) return null;
  // A malformed or partial source record must not acquire a confident grade in the challenge.
  const invalid = product?.nutritionInvalid === true || product?.nutriScoreConflict === true || product?.partial === true;
  const name=safeText(product?.name,90);
  const verdict=assessGrade(product), grade=!invalid && !product?.nutriScoreExcluded && ['reported','estimated'].includes(verdict.status) && /^[A-E]$/.test(String(verdict.grade||'')) ? verdict.grade : null;
  const safeBasis=['g','ml'].includes(product?.basis) && product?.basisSource!=='assumed' && ['100g','100ml'].includes(product?.nutritionPer) ? product.basis : null;
  const nutrients={};
  for(const key of ['sugars','saturatedFat','salt']) {
    const n=safeNumber(product?.nutrition?.[key]);
    nutrients[key]=!invalid && safeBasis && n!==null && n<=100 ? n : null;
  }
  return {barcode,name: name && !/^product\s+\d+$/i.test(name) ? name : '',brand:safeText(product?.brand,70),grade,basis:safeBasis,nutrients,hasWarning:invalid || verdict?.status==='withheld' || (Array.isArray(product?.qualityWarnings) && product.qualityWarnings.length>0),source: 'Local FoodScan report snapshot'};
}
export function readSavedReports(storage=globalThis.localStorage,limit=60) {
  const raws=scannerSources.map(key=>{try{return storage.getItem(key);}catch{return null;}});
  const previous=reportMemo.get(storage);
  if(previous && previous.raws.every((raw,i)=>raw===raws[i]))return previous.reports.slice(0,limit);
  const seen=new Set(), reports=[];
  for(const raw of raws) {
    if(!raw || raw.length>2500000)continue;
    let rows=[];
    try {const parsed=JSON.parse(raw);if(Array.isArray(parsed))rows=parsed;}catch{continue;}
    for(const row of rows.slice(0,120)) {
      const snapshot=localReportSnapshot(row),id=snapshot && canonicalGTIN(snapshot.barcode);
      if(!id || seen.has(id))continue;
      seen.add(id);reports.push(snapshot);
      if(reports.length>=60)break;
    }
    if(reports.length>=60)break;
  }
  reportMemo.set(storage,{raws,reports});
  return reports.slice(0,limit);
}
export function importCandidates(storage=globalThis.localStorage){
  const already=new Set(readEntries(storage).map(e=>canonicalGTIN(e.barcode)));
  return readSavedReports(storage).filter(e=>!already.has(canonicalGTIN(e.barcode)));
}
export function challengeMetrics(storage=globalThis.localStorage) {
  const entries=readEntries(storage), reports=readSavedReports(storage);
  const map=new Map(reports.map(p=>[canonicalGTIN(p.barcode),p]));
  const enriched=entries.map(entry=>({...entry,report:map.get(canonicalGTIN(entry.barcode))||null}));
  return {entries:enriched, count:Math.min(entries.length,TARGET), savedReports:enriched.filter(e=>e.report).length, unchecked:enriched.filter(e=>!e.report).length, withGrade:enriched.filter(e=>e.report?.grade).length, ready:entries.length>=TARGET};
}
