import {validBarcode} from './domain-v8100.mjs';
import {snapshotUsable} from './market-catalogue-v8100.mjs';
import {nutritionChoices} from './nutrition-choices-v7540.mjs';
import {comparisonFoods,sourceEvidenceIssues} from './comparison-guards-v7540.mjs';
export const gtinKey=value=>String(value||'').padStart(14,'0');
export const countryListed=(p,country)=>!country||country==='any'||(p?.countries||[]).includes(`en:${country}`);
export function comparableMethods(a,b){const method=x=>(x?.method||x?.anatomy?.version||'').replace(/-calculated$/,'')||null;return !!method(a)&&method(a)===method(b);}
export function freshSourceRecord(p,now=Date.now()){
 return !!p&&p.provenance==='off'&&!p.partial&&(p.schemaVersion||0)>=10&&validBarcode(String(p.barcode||''))&&Number.isFinite(p.fetchedAt)&&p.fetchedAt>0&&p.fetchedAt<=now+300000&&now-p.fetchedAt<=86400000;
}
export function completeSourceBatch(pool){return pool?.partial===false&&(pool.recordMode==='complete-source-record-v1'&&pool.provider==='off-search'||pool.recordMode==='dated-catalogue-record-v1'&&pool.provider==='off-catalogue');}
const usable=p=>freshSourceRecord(p)||snapshotUsable(p);
function newer(a,b){if(!usable(a))return b;if(!usable(b))return a;if(!!a.catalogueSnapshot!==!!b.catalogueSnapshot)return a.catalogueSnapshot?b:a;return (a.sourceModified||a.fetchedAt||0)>(b.sourceModified||b.fetchedAt||0)?a:b;}
export async function verifiedAlternatives(base,profile,dependencies,options={}){
 const {planFor,sameFood:rawSameFood,assess:rawAssess,rank,source,isGrade,profileCheck:rawProfileCheck=()=>({status:'unconfirmed'})}=dependencies;
 const started=performance.now(),assessments=new WeakMap(),matches=new WeakMap(),profiles=new WeakMap();
 let gradeEvaluations=0;
 const assess=p=>{if(!p||typeof p!=='object')return rawAssess(p);if(!assessments.has(p)){assessments.set(p,rawAssess(p));gradeEvaluations++;}return assessments.get(p);};
 const sameFood=(a,b)=>{if(a!==base||!b)return rawSameFood(a,b);if(!matches.has(b))matches.set(b,rawSameFood(a,b));return matches.get(b);};
 const profileCheck=(p,rules)=>{if(!profiles.has(p))profiles.set(p,rawProfileCheck(p,rules));return profiles.get(p);};
 let revision=0,derivedAt=-1,derived=null;
 const country=options.country==='any'?'':options.country??profile?.country??'',page=Math.max(1,Math.min(50,Number(options.page)||1)),limit=Math.min(page*3,12);
 const plan=planFor(base),root=assess(base),aborter=new AbortController(),abort=()=>aborter.abort(),abortError=()=>new DOMException('Aborted','AbortError');
 if(options.signal?.aborted)throw abortError();options.signal?.addEventListener('abort',abort,{once:true});
 let timedOut=false,exactPaused=false,upstreamMore=false,batchChecks=0,savedChecks=0,catalogueChecks=0,exactReads=0,catalogueInfo=null;
 const timer=setTimeout(()=>{timedOut=true;abort();},Math.min(20000,Math.max(100,options.budgetMs||16000)));
 const candidates=new Map(),observed=new Map(),verified=new Map(),attempted=new Set(),invalidated=new Set(),errors=[];
 const hidden={unverified:0,otherFood:0,conflict:0,dataError:0,country:0};
 const maxReads=Math.max(1,Math.min(4,options.maxReads||4));
 function bounded(task){if(aborter.signal.aborted)return Promise.reject(abortError());return new Promise((resolve,reject)=>{const cancel=()=>reject(abortError());aborter.signal.addEventListener('abort',cancel,{once:true});Promise.resolve().then(task).then(resolve,reject).finally(()=>aborter.signal.removeEventListener('abort',cancel));});}
 function add(record,level,label,mode='preview'){
  revision++;
  if(!record||gtinKey(record.barcode)===gtinKey(base.barcode))return false;
  const key=gtinKey(record.barcode),old=candidates.get(key);record=newer(observed.get(key)||old?.product,record);
  if(source?.peek){const prior=source.peek(record.barcode);if(usable(prior))record=newer(record,prior);}
  // Keep newer negative evidence too: a removed market tag, changed category or
  // allergy conflict must not be overwritten by an older catalogue snapshot.
  if(usable(record))observed.set(key,record);
  const exclude=reason=>{hidden[reason]++;if(usable(record)){invalidated.add(key);candidates.delete(key);verified.delete(key);}return false;};
  if(!countryListed(record,country))return exclude('country');
  if(!sameFood(base,record))return exclude('otherFood');
  if(record.nameMissing)return exclude('unverified');
  if(mode==='preview'&&!usable(record)){if(!old)candidates.set(key,{product:record,level,label});return false;}
  if(!usable(record)){hidden.unverified++;return false;}
  const assessment=assess(record);
  const candidate={product:record,level:Math.min(old?.level??level,level),label,assessment,checkedAt:record.fetchedAt,viaRecord:record.catalogueSnapshot?'catalogue':mode};
  candidates.set(key,candidate);attempted.add(key);
  if(assessment.status==='withheld'||sourceEvidenceIssues(record).length){invalidated.add(key);verified.delete(key);hidden.dataError++;return false;}
  invalidated.delete(key);
  if(profile?.avoids?.length||profile?.diet&&profile.diet!=='none'){const check=profileCheck(record,profile);if(!record.ingredients?.trim()||!['clear','none'].includes(check.status)){hidden.conflict++;candidates.delete(key);verified.delete(key);return false;}}
  if(isGrade(assessment.grade)&&(!isGrade(root.grade)||comparableMethods(root,assessment))){verified.set(key,candidate);if(mode==='batch')batchChecks++;else if(mode==='saved')savedChecks++;else if(mode==='catalogue')catalogueChecks++;}
  else verified.delete(key);
  return true;
 }
 const addProducts=(products,level,label,mode)=>{for(const p of products||[])add(p,level,label,mode);};
 const eligible=()=>[...candidates.values()].filter(c=>!invalidated.has(gtinKey(c.product.barcode))&&usable(c.product)).map(c=>c.product);
 const pools=()=>[...verified.values()].map(c=>({level:c.level,label:c.label,products:[c.product]}));
 const gradeRank=()=>{
  const r=rank(base,pools(),profile,{country,limit:15,assess});
  const validBase=isGrade(root.grade)&&root.status!=='withheld'&&base.basisSource!=='assumed'&&!sourceEvidenceIssues(base).length;
  const higher=item=>validBase&&item?.product?.basisSource!=='assumed'&&isGrade(item?.to)&&'ABCDE'.indexOf(item.to)<'ABCDE'.indexOf(root.grade)&&comparableMethods(root,assess(item.product));
  const better=(r.better||[]).filter(higher),biggest=higher(r.biggest)?r.biggest:null;
  const peers=validBase?(r.peers||[]).filter(x=>x.to===root.grade&&comparableMethods(root,assess(x.product))):[];
  return {...r,better,biggest,peers,status:better.length?'better':validBase&&root.grade==='A'?'top':'none'};
 };
 const nutrientRank=()=>nutritionChoices(base,eligible(),profile,{sameFood,assess,profileCheck},15);
 const similarRank=()=>comparisonFoods(base,eligible(),profile,{sameFood,assess,profileCheck},15);
 const derivedResults=()=>{if(derivedAt!==revision){const r=gradeRank();const graded=new Set([...(r.better||[]),...(r.peers||[]),...(r.biggest?[r.biggest]:[])].map(x=>gtinKey(x.product.barcode)));derived={r,n:nutrientRank().filter(x=>!graded.has(gtinKey(x.product.barcode))),similar:similarRank()};derivedAt=revision;}return derived;};
 const enough=()=>{const {r,n}=derivedResults();return (r.better?.length||0)+(r.peers?.length||0)+n.length>0;};
 async function verifyPreviews(){
  if(!source?.product)return;
  for(const c of [...candidates.values()].sort((a,b)=>a.level-b.level)){
   const key=gtinKey(c.product.barcode);if(attempted.has(key)||usable(c.product))continue;
   if(exactReads>=maxReads||exactPaused||aborter.signal.aborted||enough())break;
   attempted.add(key);exactReads++;
   try{const value=await bounded(()=>source.product(c.product.barcode,{signal:aborter.signal})),p=value?.product||value;
    if(p&&gtinKey(p.barcode)===key){if(!add(p,c.level,c.label,'product'))hidden.unverified++;}else hidden.unverified++;
   }catch(e){if(options.signal?.aborted)throw e;errors.push(e);hidden.unverified++;if(['rate_limited','local_rate_limited','upstream_busy'].includes(e.code))exactPaused=true;}
  }
 }
 function buildResult(){
  const {r,n,similar}=derivedResults();
  const annotate=item=>{const c=verified.get(gtinKey(item.product.barcode));return {...item,verified:true,checkedAt:c.checkedAt,gradeStatus:c.assessment.status,gradeMethod:c.assessment.method||c.assessment.anatomy?.version||null,recordSource:c.viaRecord};};
  const better=(r.better||[]).slice(0,limit).map(annotate),peers=(r.peers||[]).slice(0,limit).map(annotate),nutritionBetter=n.slice(0,limit);
  let status=r.status;if(!better.length&&!peers.length&&nutritionBetter.length)status='nutrition';
  if(!better.length&&!peers.length&&!nutritionBetter.length&&similar.length)status='compare';
  const localReady=['ready','partial'].includes(catalogueInfo?.status);
  if(!candidates.size&&errors.length&&!localReady&&!plan.needsCategory)status='error';
  if(plan.needsCategory)status='category';
  const error=errors.find(e=>e?.retryAfter>0)||errors[0]||null;
  const available=status==='nutrition'?n.length:status==='compare'?similar.length:Math.max(r.better?.length||0,r.peers?.length||0);
  return {...r,status,better,peers,biggest:r.biggest?annotate(r.biggest):null,nutritionBetter,comparisonFoods:similar.slice(0,limit),
   country,page,plan,fullRecordsVerified:true,pools:pools(),checked:verified.size,verifiedCount:verified.size,candidateCount:eligible().length,
   verificationAttempts:exactReads,batchChecks,savedChecks,catalogueChecks,catalogue:catalogueInfo,hidden:{...r.hidden,...hidden},
   hasMore:page<4&&available>limit||!localReady&&upstreamMore&&page<50,partialSearch:errors.length>0||timedOut,error,
   invalidatedBarcodes:[...invalidated],unexamined:[...candidates.values()].filter(c=>!attempted.has(gtinKey(c.product.barcode))).length,
   metrics:{gradeEvaluations,scoredRecords:assessments?gradeEvaluations:0,elapsedMs:Math.round((performance.now()-started)*100)/100},reason:plan.needsCategory?'no-category':undefined};
 }
 try{
  if(source?.saved)try{addProducts(await bounded(()=>source.saved()),0,'recently checked foods','saved');}catch(e){if(options.signal?.aborted)throw e;}
  if(source?.catalogue&&!plan.needsCategory)try{
   const local=await bounded(()=>source.catalogue(plan,{country,signal:aborter.signal}));catalogueInfo=local.catalogue;addProducts(local.products,1,'Source catalogue','catalogue');
  }catch(e){if(options.signal?.aborted)throw e;catalogueInfo={status:e.code==='catalogue_expired'?'expired':'unavailable',market:'greece',error:e.code||'catalogue_asset_unavailable'};}
  const localReady=['ready','partial'].includes(catalogueInfo?.status);
  // A successful local catalogue lookup is a complete operation, even when it finds
  // no superior food. Do not turn that into a failed network search automatically.
  const needsLive=!plan.needsCategory&&(options.refresh||(!localReady&&!enough())||(catalogueInfo?.marketCoverage==='listed-subset'&&!eligible().length));
  if(needsLive){
   if(options.onProgress&&eligible().length)try{options.onProgress({...buildResult(),refreshing:true});}catch{}
   const all=plan.candidates||[],family=all.find(c=>c.family),chosen=[all[0],family||all[1]].filter(Boolean).filter((c,i,a)=>a.findIndex(x=>x.tag===c.tag)===i);
   for(let i=0;i<chosen.length&&!aborter.signal.aborted&&(i===0||!enough());i++){
    if(!source?.pool)break;
    try{const pool=await bounded(()=>source.pool(chosen[i].tag,{country,full:true,page,signal:aborter.signal,...(options.refresh?{fresh:0}:{})}));
     addProducts(pool.products,i,chosen[i].label,completeSourceBatch(pool)?'batch':'preview');upstreamMore||=pool.hasMore===true;if(!enough())await verifyPreviews();
    }catch(e){if(options.signal?.aborted)throw e;errors.push(e);if(['rate_limited','local_rate_limited','upstream_busy'].includes(e.code))break;}
   }
  }
  if(options.signal?.aborted)throw abortError();
  // Cache only displayed records. The same selected record must open in the detail view.
  let result=buildResult();
  if(source?.remember){
   const selected=[...result.better,...result.peers,...result.nutritionBetter,...(result.status==='compare'?result.comparisonFoods:[]),...(result.biggest?[result.biggest]:[])];
   for(const item of selected){const chosen=source.remember(item.product,item.product.catalogueSnapshot?'catalogue':'source');if(chosen&&chosen!==item.product&&gtinKey(chosen.barcode)===gtinKey(item.product.barcode))add(chosen,0,'checked source','saved');}
   result=buildResult();
  }
  return result;
 }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
