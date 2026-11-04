/* BEGIN catalog-extension.js */
// FoodScan v54: isolated public discovery catalog, additive to the original v52 worker.
// Binding: FOODSCAN_PUBLIC_DB (dedicated D1). Two explicit feature flags are required for writes.
const FSC_VERSION = '55.0.0';
const FSC_SCHEMA_VERSION = 3;
const FSC_ORIGIN = 'https://food-scan.gearuptofit.com';
const FSC_SITEMAP_SIZE = 2000;
const FSC_FILE_LIMIT = 20000;
const FSC_IMAGE_LIMIT = 180000;
const FSC_ENABLED = env => env?.FOODSCAN_PUBLIC_PAGES_ENABLED === '1' && !!env?.FOODSCAN_PUBLIC_DB;
const FSC_AUTO_ENABLED = env => FSC_ENABLED(env) && env?.FOODSCAN_AUTO_INGEST === '1' && typeof env?.FOODSCAN_INGEST_QUEUE?.send === 'function';
const FSC_FRESH_MS = 120 * 86400000; // keep source verification current
const FSC_INGEST_DEDUP_MS = 6 * 3600000; // one queue attempt per barcode per six-hour window
const FSC_SOURCE_MAX_AGE_S = 3 * 366 * 86400;
const fscEsc = val => String(val ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fscPlain = (value, max = 200) => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const fscNum = val => typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : null;
function fscCanon(value){
  let code = String(value ?? '');
  if(!validBarcode2(code))return '';
  if(code.length === 14 && code[0] === '0' && validBarcode2(code.slice(1)))code=code.slice(1);
  if(code.length === 13 && code[0] === '0' && validBarcode2(code.slice(1)))code=code.slice(1);
  return code;
}
function fscQuality(raw){
  const reasons=[];
  if(!raw || typeof raw !== 'object')return {eligible:false,reasons:['no_source_record'],parsed:null};
  const code=fscCanon(raw.code);
  if(!code)reasons.push('invalid_gtin');
  if(['petfood','beauty','product'].includes(raw.product_type) || raw.obsolete === 1 || raw.obsolete === 'on')reasons.push('not_current_food');
  const p=code ? parsed(raw,code) : null;
  if(!p){reasons.push('unreadable');return {eligible:false,reasons,parsed:null};}
  const existing = indexWorthy(p);
  if(!existing.index)reasons.push(...existing.reasons);
  if(dataQuality(p).state !== 'usable')reasons.push('source_conflict_or_incomplete');
  if(!fscPlain(raw.product_name || raw.product_name_en || '',180))reasons.push('missing_product_name');
  if(!fscPlain(raw.brands,180))reasons.push('missing_brand');
  if(!safeImage(raw.image_front_small_url || raw.image_front_url || ''))reasons.push('missing_safe_product_photo');
  if(!String(p.ingredients || '').trim() || String(p.ingredients).trim().length < 20)reasons.push('missing_ingredients');
  if(!['100g','100ml'].includes(String(raw.nutrition_data_per || '').toLowerCase()))reasons.push('ambiguous_per100_basis');
  if(!['g','ml'].includes(p.basis) || p.basisSource==='assumed')reasons.push('ambiguous_unit');
  if(!Array.isArray(raw.data_quality_errors_tags) || raw.data_quality_errors_tags.length>0)reasons.push('source_error_flags');
  if(p.nutriScoreConflict || p.nutritionInvalid || contradictions(p).length)reasons.push('contradictory_nutrition');
  const modified=Number(raw.last_modified_t);
  const now=Date.now()/1000;
  if(!Number.isFinite(modified) || modified < 1e9 || modified > now+86400 || modified < now-3*366*86400)reasons.push('source_age_unclear');
  if(!!p.partial || p.provenance === 'local')reasons.push('private_or_preview_record');
  const n=p.nutrition || {};
  if(['kcal','sugars','salt','fat','saturatedFat','carbohydrates','protein'].some(k => !Number.isFinite(n[k])))reasons.push('missing_key_nutrients');
  if(fscPlain(raw.product_name || '',180).length < 3)reasons.push('name_too_short');
  return {eligible:reasons.length===0,reasons:[...new Set(reasons)],parsed:p,code};
}
function fscReducedRecord(raw){
  // Only public, source-provided fields; never copy request data, PII, diary values or handwritten label entries.
  const out={};
  const allowed=['code','product_name','product_name_en','brands','quantity','nutrition_data_per','nutriments','nutriscore_grade','nutrition_grades','nutriscore_score','nutriscore','nova_group','ingredients_text','ingredients_text_en','lang','allergens_tags','traces_tags','data_quality_errors_tags','categories_tags','last_modified_t','image_front_small_url','image_front_url','product_type','obsolete'];
  for(const key of allowed)if(Object.hasOwn(raw,key))out[key]=raw[key];
  // Nutrition arrays from upstream can be large; limit stored fields to the ones used by the parser and SSR.
  if(out.nutriments && typeof out.nutriments==='object')out.nutriments=Object.fromEntries(Object.entries(out.nutriments).filter(([k,v]) => /^[a-z0-9-]+_(?:100g|serving)$/.test(k) && (typeof v==='number'||typeof v==='string')).slice(0,100));
  for(const k of ['product_name','product_name_en','brands','quantity','ingredients_text','ingredients_text_en'])if(typeof out[k]==='string')out[k]=out[k].slice(0,k.startsWith('ingredients')?6000:220);
  for(const k of ['allergens_tags','traces_tags','data_quality_errors_tags','categories_tags'])if(Array.isArray(out[k]))out[k]=out[k].filter(x=>typeof x==='string').slice(0,60);
  return out;
}
function fscMaterialSnapshot(raw){
  // Source timestamps and incidental metadata must not revoke editorial approval.
  // All facts shown to visitors or used for classification remain review-sensitive.
  const r=fscReducedRecord(raw);
  delete r.last_modified_t;
  return JSON.stringify(r);
}
function fscSame(a,b){const x=fscCanon(a),y=fscCanon(b);return !!(x&&y&&x.padStart(14,'0')===y.padStart(14,'0'));}
function fscResponseError(message,status=503,retry=0){
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Product not available · FoodScan</title></head><body style="font:16px/1.6 system-ui;max-width:680px;margin:4rem auto;padding:1rem;color:#17392f"><h1>Product not available</h1><p>${fscEsc(message)}</p><p><a href="/">Scan another food</a> · <a href="/how/">Data limitations</a></p></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, follow','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(retry?{'Retry-After':String(retry)}:{})}});
}
async function fscGetRow(env,code){
  return env.FOODSCAN_PUBLIC_DB.prepare('SELECT barcode,source_modified_at,verified_at,source_json,grade,family,updated_at FROM foodscan_public_products WHERE gtin14=? AND status=\'eligible\' AND publication_state=\'approved\' AND verified_at>=? AND source_modified_at>=? LIMIT 1').bind(code.padStart(14,'0'),Date.now()-FSC_FRESH_MS,Math.floor(Date.now()/1000-FSC_SOURCE_MAX_AGE_S)).first();
}
async function fscUpsert(env,raw, {allowQuarantine=false}={}){
  const q=fscQuality(raw);
  if(!q.code)return {status:'rejected',reason:q.reasons.slice(0,4).join(',')};
  if(!q.eligible && !allowQuarantine)return {status:'rejected',code:q.code,reason:q.reasons.slice(0,4).join(',')};
  const clean=fscReducedRecord(raw);
  clean.code=q.code;
  let serialized=JSON.stringify(clean);
  if(serialized.length > FSC_FILE_LIMIT)return {status:'rejected',reason:'payload_too_large'};
  const p=q.parsed || {name:String(raw.product_name||raw.product_name_en||''),brand:String(raw.brands||''),nutrition:{}};
  const status=q.eligible?'eligible':'quarantined',code=q.code;
  const grade=q.eligible ? assessGrade(p,{estimate:false}).grade : null;
  const family=q.eligible ? (productFamily(p)||'') : '';
  const old=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT status,source_modified_at,verified_at,source_json,publication_state,reviewed_at FROM foodscan_public_products WHERE gtin14=?').bind(code.padStart(14,'0')).first();
  const modified=Number(raw.last_modified_t)||0;
  let materiallyChanged=!old;
  if(old){
    try{materiallyChanged=fscMaterialSnapshot(JSON.parse(old.source_json))!==fscMaterialSnapshot(clean);}
    catch{materiallyChanged=true;}
  }
  if(old && old.status===status && !materiallyChanged && old.source_json===serialized && Number(old.source_modified_at)>=modified && Date.now()-Number(old.verified_at)<86400000)return {status:'unchanged',code,publication_state:old.publication_state};
  // A source edit to ingredients, nutrients, grade, photo, allergens or category requires reapproval.
  const publicationState=q.eligible && !materiallyChanged && old?.publication_state==='approved' ? 'approved' : (q.eligible?'candidate':'rejected');
  const reviewedAt=publicationState==='approved' ? Number(old?.reviewed_at)||0 : 0;
  await env.FOODSCAN_PUBLIC_DB.prepare(`INSERT INTO foodscan_public_products (gtin14,barcode,product_name,brand,family,grade,source_url,source_modified_at,verified_at,source_json,status,quality_reason,updated_at,publication_state,reviewed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(gtin14) DO UPDATE SET barcode=excluded.barcode,product_name=excluded.product_name,brand=excluded.brand,family=excluded.family,grade=excluded.grade,source_url=excluded.source_url,source_modified_at=excluded.source_modified_at,verified_at=excluded.verified_at,source_json=excluded.source_json,status=excluded.status,quality_reason=excluded.quality_reason,updated_at=excluded.updated_at,publication_state=excluded.publication_state,reviewed_at=excluded.reviewed_at`).bind(
    code.padStart(14,'0'),code,fscPlain(p.name,180),fscPlain(p.brand,120),fscPlain(family,40),grade,`https://world.openfoodfacts.org/product/${code}`,modified,Date.now(),serialized,status,q.reasons.join(',').slice(0,200),Date.now(),publicationState,reviewedAt).run();
  return {status,code,publication_state:publicationState,reason:q.reasons.length?q.reasons.slice(0,4).join(','):undefined};
}
async function fscIngestFromScan(response,env){
  // Queue producer only: never publish directly from a visitor scan.
  if(!FSC_AUTO_ENABLED(env)||!response||response.status!==200||response.headers.get('X-FoodScan-Cache')==='STALE')return;
  let data;try{data=await response.json();}catch{return;}
  if(!data?.product || data.product.provenance==='local')return;
  const code=fscCanon(data.product.code);if(!code)return;
  const id=code.padStart(14,'0'),now=Date.now();
  try{
    const current=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT verified_at FROM foodscan_public_products WHERE gtin14=?').bind(id).first();
    if(current && now-Number(current.verified_at)<86400000)return; // no repeated jobs on verified records
    // A single atomic D1 statement prevents multiple edge instances from enqueueing the
    // same previously unknown barcode on every popular scan.
    const claimed=await env.FOODSCAN_PUBLIC_DB.prepare(`INSERT INTO fsc_ingest_queue_lease (gtin14,last_queued_at) VALUES (?,?)
      ON CONFLICT(gtin14) DO UPDATE SET last_queued_at=excluded.last_queued_at
      WHERE fsc_ingest_queue_lease.last_queued_at<? RETURNING gtin14`).bind(id,now,now-FSC_INGEST_DEDUP_MS).first();
    if(!claimed)return;
    try{await env.FOODSCAN_INGEST_QUEUE.send({barcode:code});}
    catch(e){
      // Release only this claim so that later scans can retry a failed enqueue.
      await env.FOODSCAN_PUBLIC_DB.prepare('DELETE FROM fsc_ingest_queue_lease WHERE gtin14=? AND last_queued_at=?').bind(id,now).run().catch(()=>{});
      throw e;
    }
  }catch(e){console.warn('catalog queue failure',String(e?.message||'unknown').slice(0,100));}
}
function fscAdminAuthorized(request,env){
  const expected=String(env.FOODSCAN_INGEST_TOKEN||'');
  if(expected.length<32)return false;
  const candidate=String(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
  let mismatch=0;for(let i=0;i<Math.max(candidate.length,expected.length);i++)mismatch|=(candidate.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);
  return candidate.length===expected.length&&mismatch===0;
}
async function fscProviderBudget(env){
  // Atomic D1 lease: at most ~7.5 catalog reads/min across consumers+admin.
  // This is supplemental to the original scanner's separate provider budget.
  const db=env.FOODSCAN_PUBLIC_DB,now=Date.now();
  await db.prepare('INSERT OR IGNORE INTO fsc_catalog_budget(name,next_allowed_ms) VALUES(?,0)').bind('off_product').run();
  const claim=await db.prepare('UPDATE fsc_catalog_budget SET next_allowed_ms=? WHERE name=? AND next_allowed_ms<=? RETURNING next_allowed_ms').bind(now+8000,'off_product',now).first();
  if(claim)return {ok:true};
  const latest=await db.prepare('SELECT next_allowed_ms FROM fsc_catalog_budget WHERE name=?').bind('off_product').first();
  return {ok:false,seconds:Math.max(2,Math.ceil((Number(latest?.next_allowed_ms||now+8000)-now)/1000))};
}
async function fscReadVerifiedSource(env,code){
  // Only source data. No user names, manually entered labels or uploaded images.
  const contact=String(env.CONTACT_EMAIL||'').trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact))return {error:'contact_identity_required',status:503};
  const budget=await fscProviderBudget(env);
  if(!budget.ok)return {error:'catalog_rate_limited',status:429,retry:budget.seconds};
  const fields=['code','product_name','product_name_en','brands','quantity','nutrition_data_per','nutriments','nutriscore_grade','nutrition_grades','nutriscore_score','nutriscore','nova_group','ingredients_text','ingredients_text_en','lang','allergens_tags','traces_tags','data_quality_errors_tags','categories_tags','last_modified_t','image_front_small_url','image_front_url','product_type','obsolete'];
  let response;
  try{response=await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields.join(',')}`,{headers:{'User-Agent':`FoodScanCatalog/54.0.0 (${contact}; https://food-scan.gearuptofit.com/)`,'Accept':'application/json'},signal:AbortSignal.timeout(7000),cache:'no-store'});}
  catch{return {error:'upstream_connection_failed',status:503,retry:60};}
  if(response.status===429){
    const retry=Number(response.headers.get('retry-after'));
    return {error:'upstream_rate_limited',status:429,retry:Number.isFinite(retry)&&retry>0?Math.min(3600,retry):90};
  }
  if(response.status===404)return {missing:true};
  if(!response.ok){
    const rawRetry=Number(response.headers.get('retry-after'));
    return {error:'upstream_unavailable',status:503,retry:Number.isFinite(rawRetry)&&rawRetry>0?Math.min(3600,Math.ceil(rawRetry)):120};
  }
  let data;try{data=await response.json();}catch{return {error:'source_json_invalid',status:503,retry:60};}
  if(!data?.product || Number(data.status)===0)return {missing:true};
  if(!fscSame(data.product.code,code))return {error:'source_mismatch',status:422};
  return {product:data.product};
}
async function fscAdminIngest(request,env){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405,{'Allow':'POST'});
  if(!FSC_ENABLED(env))return json({error:'catalog_disabled'},503);
  if(String(env.FOODSCAN_INGEST_TOKEN||'').length<32)return json({error:'admin_ingest_not_configured'},503);
  if(!fscAdminAuthorized(request,env))return json({error:'unauthorized'},401);
  if(!/^application\/json\b/i.test(request.headers.get('Content-Type')||''))return json({error:'json_required'},415);
  let body;try{body=JSON.parse(await boundedRequest(request,512));}catch{return json({error:'invalid_body'},400);}
  const code=fscCanon(body?.barcode);if(!code)return json({error:'invalid_gtin'},422);
  let source;try{source=await fscReadVerifiedSource(env,code);}catch(e){console.warn('catalog source check:',String(e?.message).slice(0,100));return json({error:'catalog_source_failed'},503);}
  if(source.error)return json({error:source.error},source.status,source.retry?{'Retry-After':String(source.retry)}:{});
  if(source.missing){
    // Confirmed OFF not-found status revokes any previously approved snapshot.
    await env.FOODSCAN_PUBLIC_DB.prepare("UPDATE foodscan_public_products SET status='quarantined',publication_state='rejected',quality_reason='source_not_found',reviewed_at=0,updated_at=?,verified_at=? WHERE gtin14=?").bind(Date.now(),Date.now(),code.padStart(14,'0')).run();
    return json({status:'not_found',barcode:code},404);
  }
  try{
    const result=await fscUpsert(env,source.product,{allowQuarantine:true});
    return json(result,result.status==='eligible'||result.status==='unchanged'?200:422);
  }catch(e){console.warn('catalog write:',String(e?.message).slice(0,100));return json({error:'catalog_write_failed'},503);}
}
async function fscAdminReview(request,env){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405,{'Allow':'POST'});
  if(!FSC_ENABLED(env))return json({error:'catalog_disabled'},503);
  if(String(env.FOODSCAN_INGEST_TOKEN||'').length<32)return json({error:'admin_secret_not_configured'},503);
  if(!fscAdminAuthorized(request,env))return json({error:'unauthorized'},401);
  if(!/^application\/json\b/i.test(request.headers.get('Content-Type')||''))return json({error:'json_required'},415);
  let body;try{body=JSON.parse(await boundedRequest(request,512));}catch{return json({error:'invalid_body'},400);}
  const code=fscCanon(body?.barcode),action=body?.action;
  if(!code || !['approve','revoke'].includes(action))return json({error:'invalid_request'},422);
  const row=await env.FOODSCAN_PUBLIC_DB.prepare('SELECT status,source_json,verified_at FROM foodscan_public_products WHERE gtin14=?').bind(code.padStart(14,'0')).first();
  if(!row)return json({error:'not_found'},404);
  if(action==='approve'){
    let raw;try{raw=JSON.parse(row.source_json);}catch{return json({error:'invalid_record'},422);}
    if(row.status!=='eligible'||!fscQuality(raw).eligible||Number(row.verified_at)<Date.now()-FSC_FRESH_MS)return json({error:'quality_review_failed'},422);
  }
  const state=action==='approve'?'approved':'rejected';
  await env.FOODSCAN_PUBLIC_DB.prepare('UPDATE foodscan_public_products SET publication_state=?,reviewed_at=?,updated_at=? WHERE gtin14=?').bind(state,action==='approve'?Date.now():0,Date.now(),code.padStart(14,'0')).run();
  return json({barcode:code,publication_state:state});
}
function fscMarkupResult(p,q){
  const a=assessGrade(p,{estimate:false});
  const result=a.status==='reported'?a.grade:'—';
  const tone={A:'#1b9369',B:'#7cbb62',C:'#efc64d',D:'#e58b37',E:'#c64c51'}[result]||'#547e70';
  return {grade:result,color:tone,method:a.method==='2023'?'2023 points reconciled from source':result!=='—'?'Source method not established':'Grade not reported',summary:gradeSentence(p,a)};
}
function fscStructured(p,q,origin,code){
  const a=assessGrade(p,{estimate:false});const url=`${origin}/products/${code}`;
  const ld={"@context":"https://schema.org","@type":"Product",name:p.name,description:describe(p,a),url,image:p.image,[gtinKey(code)]:code,brand:{"@type":"Brand",name:p.brand.split(',')[0].trim()},additionalProperty:[]};
  if(a.status==='reported')ld.additionalProperty.push({"@type":"PropertyValue",name:a.method==='2023'?'Source-reported Nutri-Score (2023)':'Source-reported Nutri-Score (method unspecified)',value:a.grade});
  if(p.nova)ld.additionalProperty.push({"@type":"PropertyValue",name:'NOVA group (source-reported)',value:String(p.nova)});
  return JSON.stringify(ld).replace(/</g,'\\u003c').replace(/\u2028|\u2029/g,' ');
}
function fscInfoPill(label,value){return `<span class="fsc-stat"><small>${fscEsc(label)}</small><strong>${fscEsc(value)}</strong></span>`;}
function fscFacts(p){
  const list=[['Energy','kcal','kcal'],['Sugars','sugars','g'],['Saturated fat','saturatedFat','g'],['Salt','salt','g'],['Fat','fat','g'],['Carbohydrate','carbohydrates','g'],['Protein','protein','g'],['Fibre','fiber','g']];
  const rows=list.filter(([,key])=>Number.isFinite(p.nutrition[key])).map(([label,key,unit])=>`<tr><th scope="row">${label}</th><td>${fscEsc(new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(p.nutrition[key]))} ${unit}</td></tr>`).join('');
  return `<table class="fsc-table"><caption>Source-reported nutrition per ${p.basis==='ml'?'100 ml':'100 g'}</caption><tbody>${rows}</tbody></table>`;
}
function fscRelated(rows,origin,code,subject){
  if(!rows.length)return '';
  const gradeRank={A:0,B:1,C:2,D:3,E:4},baseGrade=assessGrade(subject,{estimate:false}).grade;
  const rendered=[];
  for(const r of rows){
    let other;try{const quality=fscQuality(JSON.parse(r.source_json));if(!quality.eligible)continue;other=quality.parsed;}catch{continue;}
    if(other.basis!==subject.basis)continue;
    const grade=assessGrade(other,{estimate:false}).grade;
    const score=grade&&baseGrade&&gradeRank[grade]!==undefined&&gradeRank[baseGrade]!==undefined
      ? gradeRank[grade]<gradeRank[baseGrade]?'Higher Nutri-Score grade':gradeRank[grade]===gradeRank[baseGrade]?'Same Nutri-Score grade':'Lower Nutri-Score grade'
      : 'Grade not comparable';
    const diff=(key,label)=>{
      const x=subject.nutrition?.[key],y=other.nutrition?.[key];
      if(!Number.isFinite(x)||!Number.isFinite(y))return '';
      const change=Number((y-x).toFixed(1));
      return `${label}: ${change===0?'same':Math.abs(change)+' g '+(change<0?'less':'more')}`;
    };
    const changes=[diff('sugars','Sugar'),diff('saturatedFat','Sat. fat')].filter(Boolean).join(' · ');
    rendered.push(`<li><a href="/products/${fscEsc(r.barcode)}"><span>${fscEsc(other.name)}</span><span class="fsc-grade-small fsc-grade-${fscEsc(grade||'unknown')}">${fscEsc(grade||'—')}</span></a><span class="fsc-mini">${fscEsc(score)}${changes?' · '+fscEsc(changes):''} per ${subject.basis==='ml'?'100 ml':'100 g'}</span><br><a class="fsc-mini" href="/battles/${fscEsc(code)}/${fscEsc(r.barcode)}">Compare facts / challenge a friend</a></li>`);
  }
  if(!rendered.length)return '';
  return `<section class="fsc-panel fsc-related"><h2>Explore product differences</h2><p>Approved source records in the same broad food family, with nutrient differences per equal 100 g/ml basis. Higher grade does not mean allergy-safe or suitable as a direct substitute.</p><ul>${rendered.join('')}</ul></section>`;
}
async function fscRenderProduct(request,env,code,row,relatedRows){
  const url=new URL(request.url),origin=siteOrigin(url,env);
  let raw;try{raw=JSON.parse(row.source_json);}catch{return fscResponseError('This source record is being checked.',503,60);}
  const q=fscQuality(raw);
  if(!q.eligible)return fscResponseError('This record no longer meets our publication checks.',404);
  const p=q.parsed,a=fscMarkupResult(p,q),canonical=`${origin}/products/${code}`;
  const description=describe(p,assessGrade(p,{estimate:false})),brand=fscPlain(p.brand,120);
  const rawImage=safeImage(raw.image_front_small_url)||safeImage(raw.image_front_url);
  const src=`https://world.openfoodfacts.org/product/${code}`;
  const facts=[['Sugar','sugars'],['Saturated fat','saturatedFat'],['Salt','salt']].filter(([,k])=>Number.isFinite(p.nutrition[k]));
  const fileName=fscPlain(p.name,55);
  const ogImage=`${origin}/scorecards/${code}/og.png?v=${row.updated_at||0}`;
  const why=(assessGrade(p,{estimate:false}).anatomy?.why||[]).filter(x=>x.tone!=='note').slice(0,3).map(x=>`<li>${fscEsc(x.text)}</li>`).join('');
  const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${fscEsc(fileName)} nutrition facts & Nutri-Score | FoodScan</title><meta name="description" content="${fscEsc(description)}"><meta name="robots" content="${preview(url,env)?'noindex,follow':'index,follow,max-image-preview:large'}"><link rel="canonical" href="${fscEsc(canonical)}"><link rel="icon" type="image/svg+xml" href="/icon.svg">
  <meta property="og:type" content="product"><meta property="og:site_name" content="FoodScan"><meta property="og:title" content="${fscEsc(p.name)} · Nutri-Score ${fscEsc(a.grade)} | FoodScan"><meta property="og:description" content="${fscEsc(description)}"><meta property="og:url" content="${fscEsc(canonical)}"><meta property="og:image" content="${fscEsc(ogImage)}"><meta property="og:image:alt" content="${fscEsc('FoodScan nutrition scorecard for '+p.name+' using Open Food Facts data')}">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${fscEsc(p.name)} · FoodScan"><meta name="twitter:description" content="${fscEsc(description)}"><meta name="twitter:image" content="${fscEsc(ogImage)}">
  <link rel="stylesheet" href="/public-catalog.css"><link rel="preconnect" href="https://images.openfoodfacts.org" crossorigin>
  <script type="application/ld+json">${fscStructured(p,q,origin,code)}</script><script src="/public-catalog.js" defer></script></head>
  <body><a class="fsc-skip" href="#main">Skip to product</a><div class="fsc-topbar"><div class="fsc-width fsc-toprow"><a class="fsc-brand" href="/" aria-label="FoodScan home"><span class="fsc-brandmark">F</span> FoodScan<span class="fsc-dot">.</span></a><nav aria-label="Primary"><a href="/#/scan">Scan food</a><a href="/how/">How it works</a></nav></div></div>
  <main id="main" class="fsc-width"><div class="fsc-breadcrumb"><a href="/">FoodScan</a><span>›</span><span>Food discovery</span></div>
  <section class="fsc-hero"><div class="fsc-photo"><img src="${fscEsc(rawImage)}" alt="Package photo of ${fscEsc(p.name)} from Open Food Facts" width="400" height="400" fetchpriority="high"><small>Community-submitted package photo</small></div>
  <div class="fsc-intro"><span class="fsc-eyebrow">THE FOODSCAN LABEL CHECK</span><p class="fsc-brandname">${fscEsc(brand)}${p.quantity?' · '+fscEsc(p.quantity):''}</p><h1>${fscEsc(p.name)}</h1><p class="fsc-summary">${fscEsc(a.summary)}</p><div class="fsc-grade-row"><div class="fsc-grade fsc-grade-${fscEsc(a.grade)}" aria-label="Nutri-Score ${fscEsc(a.grade)}">${fscEsc(a.grade)}</div><div><span class="fsc-label">Nutri-Score</span><strong>${fscEsc(a.method)}</strong><small>As reported by Open Food Facts. No independent lab testing.</small></div></div>
  <div class="fsc-values">${facts.map(([name,k])=>fscInfoPill(`${name} / ${p.basis==='ml'?'100 ml':'100 g'}`,`${num(p.nutrition[k])} g`)).join('')}</div>
  <p><a href="/challenge/">Try the 7-discovery Fridge Challenge</a></p><div class="fsc-actions"><button id="fsc-share" class="fsc-button fsc-button-primary" type="button">Share these facts <span aria-hidden="true">↗</span></button><button id="fsc-share-image" class="fsc-button fsc-button-ghost" type="button">Share image</button><button id="fsc-story" class="fsc-button fsc-button-ghost" type="button">Download story card</button></div><p id="fsc-status" role="status" aria-live="polite" class="fsc-status"></p>
  <a class="fsc-subtle" href="/p/${fscEsc(code)}">Open interactive scan report ↗</a></div></section>
  <div class="fsc-columns"><div class="fsc-primary"><section class="fsc-panel"><div class="fsc-sectionhead"><span class="fsc-eyebrow">THE LABEL, EXPLAINED</span><h2>Nutrition facts</h2><p>All figures use a consistent ${p.basis==='ml'?'100 ml':'100 g'} basis. Source values may change when packaging changes.</p></div>${fscFacts(p)}</section>
  ${why?`<section class="fsc-panel"><span class="fsc-eyebrow">WHY THIS GRADE?</span><h2>Nutrition-score factors</h2><ul class="fsc-why">${why}</ul><p class="fsc-mini">The point breakdown is shown only when FoodScan can reconcile the reported 2023 calculation.</p></section>`:''}
  <section class="fsc-panel"><span class="fsc-eyebrow">INGREDIENTS & SAFETY</span><h2>What is in this product?</h2><p class="fsc-ingredients">${fscEsc(p.ingredients)}</p>${allergenLines(p)}<p class="fsc-warning">Allergen information may be incomplete. Always check the actual packaging before consuming a food, especially with allergies.</p></section>
  ${p.nova?`<section class="fsc-panel"><h2>Processing information</h2><p>The source reports <strong>NOVA group ${fscEsc(p.nova)} of 4</strong>. NOVA is a processing classification, not a safety rating.</p></section>`:''}</div>
  <aside class="fsc-secondary">${fscRelated(relatedRows,origin,code,p)}<section class="fsc-panel fsc-sharebox"><span class="fsc-eyebrow">TAKE IT FURTHER</span><h2>What's really in your food?</h2><p>Scan a barcode for its reported grade, nutrition and alternatives.</p><a class="fsc-button fsc-button-primary" href="/#/scan" data-fsc-event="public_scan_cta">Scan yours for free →</a><p class="fsc-mini">No account required.</p></section><section class="fsc-panel fsc-source"><h2>Source & transparency</h2><p>Public record last edited <strong>${new Date(p.sourceModified || Date.now()).toISOString().slice(0,10)}</strong>. ${fieldCount(p)} of 8 core nutrient values reported.</p><p><a href="${src}" target="_blank" rel="nofollow noopener noreferrer">View source record ↗</a></p><p>Open Food Facts contributors · database <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>, product images have separate licensing and third-party rights; verify the original image terms. Reuse may require attribution and share-alike.</p><p>FoodScan reports community-maintained data and is not medical or allergy advice.</p></section></aside></div>
  <section class="fsc-bottom-cta"><h2>Discover what's really in your food.</h2><p>Make sense of labels, compare products, and share what you learn.</p><a class="fsc-button fsc-button-light" href="/#/scan" data-fsc-event="public_scan_cta">Scan your first product →</a></section></main>
  <footer class="fsc-footer"><div class="fsc-width"><span>FoodScan · Evidence before excitement.</span><span><a href="/how/">Methodology</a> · <a href="/">Scanner</a> · <a href="${src}" rel="nofollow noopener noreferrer">Source</a></span></div></footer>
  <div id="fsc-metadata" hidden data-barcode="${fscEsc(code)}" data-url="${fscEsc(canonical)}" data-name="${fscEsc(p.name)}"></div></body></html>`;
  const output=await secureHtml(page,url,env,200,{'Cache-Control':'public, max-age=30, s-maxage=30','X-Content-Type-Options':'nosniff'},'');
  return request.method==='HEAD'?new Response(null,{status:output.status,headers:output.headers}):output;
}
async function fscCatalogPage(request,env,ctx){
  const url=new URL(request.url),input=url.pathname.match(/^\/products\/([0-9]{8,14})\/?$/)?.[1];
  const code=fscCanon(input);
  if(!code)return fscResponseError('No source-verified record is available for that barcode.',404);
  if(url.pathname!==`/products/${code}`)return Response.redirect(`${url.origin}/products/${code}`,301);
  if(!FSC_ENABLED(env))return fscResponseError('The public food catalog is not configured.',503,120);
  const edge = null; // D1 is checked on every request, so revoked or outdated records disappear promptly.
  const cacheKey = new Request(`${url.origin}${url.pathname}`);
  if(edge){try{const hit=await edge.match(cacheKey);if(hit)return request.method==='HEAD'?new Response(null,{status:hit.status,headers:hit.headers}):hit;}catch{}}
  let row,related=[];
  try{
    row=await fscGetRow(env,code);
    if(row?.family)related=(await env.FOODSCAN_PUBLIC_DB.prepare('SELECT barcode,product_name,grade,source_json FROM foodscan_public_products WHERE family=? AND status=\'eligible\' AND publication_state=\'approved\' AND verified_at>=? AND source_modified_at>=? AND gtin14<>? ORDER BY updated_at DESC LIMIT 6').bind(row.family,Date.now()-FSC_FRESH_MS,Math.floor(Date.now()/1000-FSC_SOURCE_MAX_AGE_S),code.padStart(14,'0')).all()).results||[];
  }catch(e){console.warn('catalog read',String(e?.message).slice(0,100));return fscResponseError('The public food catalog is temporarily unavailable.',503,60);}
  if(!row)return fscResponseError('This barcode has not yet passed our public-page evidence checks. You can still scan it in FoodScan.',404);
  const output=await fscRenderProduct(request,env,code,row,related);
  if(edge && output.status===200 && request.method==='GET' && typeof ctx?.waitUntil==='function')
    ctx.waitUntil(edge.put(cacheKey,output.clone()).catch(()=>{}));
  return output;
}
async function fscImageData(url){
  const address=safeImage(url);
  if(!address)return '';
  try{
    const r=await fetch(address,{headers:{'Accept':'image/jpeg,image/png,image/webp'},signal:AbortSignal.timeout(4500)});
    if(!r.ok)return '';
    const mime=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!['image/jpeg','image/png','image/webp'].includes(mime))return '';
    if(Number(r.headers.get('content-length')||0)>FSC_IMAGE_LIMIT)return '';
    const buf=await r.arrayBuffer();if(buf.byteLength>FSC_IMAGE_LIMIT)return '';
    const bytes=new Uint8Array(buf);let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return `data:${mime};base64,${btoa(bin)}`;
  }catch{return '';}
}
function fscWrap(str,maximum=27,maxLines=3){
  const words=fscPlain(str,145).split(' '),lines=[];let line='';
  for(const w of words){if((line+' '+w).trim().length>maximum && line){lines.push(line);line=w;}else line=(line+' '+w).trim();}
  if(line)lines.push(line);
  const out=lines.slice(0,maxLines);
  if(lines.length>maxLines)out[maxLines-1]=out[maxLines-1].slice(0,maximum-2)+'…';
  return out;
}
async function fscScorecard(request,env,code,ctx){
  const c=fscCanon(code);
  if(!c || !FSC_ENABLED(env))return fscResponseError('Scorecard unavailable',404);
  const url=new URL(request.url),edge=null; // do not retain revoked scorecards in an edge cache
  const cacheKey=new Request(`${url.origin}/scorecards/${c}.svg`);
  if(edge){try{const hit=await edge.match(cacheKey);if(hit)return request.method==='HEAD'?new Response(null,{status:hit.status,headers:hit.headers}):hit;}catch{}}
  let row;try{row=await fscGetRow(env,c);}catch{return fscResponseError('Scorecard temporarily unavailable',503,60);}
  if(!row)return fscResponseError('Scorecard unavailable',404);
  let raw;try{raw=JSON.parse(row.source_json);}catch{return fscResponseError('Scorecard unavailable',404);}
  const q=fscQuality(raw);if(!q.eligible)return fscResponseError('Scorecard unavailable',404);
  const p=q.parsed,a=fscMarkupResult(p,q), origin=siteOrigin(new URL(request.url),env), per100=p.basis==='ml'?'100 ml':'100 g';
  const image=await fscImageData(raw.image_front_small_url||raw.image_front_url);
  const names=fscWrap(p.name,28,3),values=[['SUGAR','sugars'],['SAT. FAT','saturatedFat'],['SALT','salt']].filter(([,key])=>Number.isFinite(p.nutrition[key]));
  const lines=names.map((line,i)=>`<text x="85" y="${240+i*78}" font-size="70" font-weight="800" fill="#17362c">${fscEsc(line)}</text>`).join('');
  const lastName=240+(names.length-1)*78;
  const picture=image?`<rect x="205" y="620" width="670" height="660" rx="62" fill="#fff"/><image href="${image}" x="250" y="655" width="580" height="580" preserveAspectRatio="xMidYMid meet"/>`:`<rect x="205" y="620" width="670" height="660" rx="62" fill="#fff"/><text x="540" y="930" text-anchor="middle" font-weight="800" font-size="94" fill="#2a8068">FoodScan</text>`;
  const highlights=values.map(([label,key],i)=>{const x=85+(i%3)*320;return `<rect x="${x}" y="1450" width="292" height="190" rx="26" fill="#fff"/><text x="${x+22}" y="1510" font-size="26" letter-spacing="2" font-weight="700" fill="#61756d">${label}</text><text x="${x+22}" y="1598" font-size="56" font-weight="800" fill="#17362c">${fscEsc(num(p.nutrition[key]))} g</text>`;}).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><title>${fscEsc(p.name)} food facts by FoodScan</title><desc>Source-reported Nutri-Score and nutrition facts per ${per100}. Always verify the package.</desc><rect width="1080" height="1920" fill="#f5f1e7"/><path d="M0 0H1080V45H0Z" fill="#1e765d"/><text x="85" y="135" font-family="Arial,system-ui,sans-serif" font-size="50" font-weight="800" fill="#1c5d49">FoodScan ●</text><text x="85" y="180" font-size="24" font-family="Arial,system-ui,sans-serif" fill="#678275">KNOW YOUR FOOD. SHARE THE FACTS.</text><g font-family="Arial,system-ui,sans-serif">${lines}<text x="85" y="${Math.max(lastName+65,525)}" font-size="31" font-weight="600" fill="#72817a">${fscEsc(fscPlain(p.brand,44))}</text>${picture}<rect x="730" y="1140" width="240" height="240" rx="70" fill="${a.color}" stroke="#f5f1e7" stroke-width="14"/><text x="850" y="1290" text-anchor="middle" font-size="126" font-weight="900" fill="#fff">${a.grade==='—'?'?':a.grade}</text><text x="85" y="1398" font-size="32" font-weight="600" fill="#1c5946">NUTRI-SCORE · ${a.grade==='—'?'NOT REPORTED':'SOURCE-REPORTED'}</text>${highlights}<rect x="0" y="1740" width="1080" height="180" fill="#1c5946"/><text x="85" y="1805" font-size="38" font-weight="800" fill="#fff">Scan your food for free →</text><text x="85" y="1858" font-size="28" fill="#e0f5eb">food-scan.gearuptofit.com</text></g><text x="85" y="1693" font-family="Arial,system-ui,sans-serif" font-size="24" fill="#52695e">Per ${per100} · Open Food Facts data ODbL / image CC BY-SA · Check pack and allergens</text></svg>`;
  const output=new Response(request.method==='HEAD'?null:svg,{status:200,headers:{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public, max-age=86400, s-maxage=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",'Access-Control-Allow-Origin':'*'}});
  if(edge && request.method==='GET' && typeof ctx?.waitUntil==='function')ctx.waitUntil(edge.put(cacheKey,output.clone()).catch(()=>{}));
  return output;
}
async function fscSitemap(request,env){
  if(!FSC_ENABLED(env))return new Response('Catalog not enabled',{status:404,headers:{'X-Robots-Tag':'noindex'}});
  const url=new URL(request.url), origin=siteOrigin(url,env);
  let xml;
  try{
    if(url.pathname==='/sitemap-catalog.xml'){
      const total=(await env.FOODSCAN_PUBLIC_DB.prepare("SELECT COUNT(*) AS total FROM foodscan_public_products WHERE status='eligible' AND publication_state='approved' AND verified_at>=? AND source_modified_at>=?").bind(Date.now()-FSC_FRESH_MS,Math.floor(Date.now()/1000-FSC_SOURCE_MAX_AGE_S)).first())?.total||0;
      const pages=Math.ceil(total/FSC_SITEMAP_SIZE);
      xml=`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({length:Math.min(pages,1000)},(_,i)=>`<sitemap><loc>${origin}/sitemap-catalog-${i}.xml</loc></sitemap>`).join('')}</sitemapindex>`;
    }else{
      const number=Number(url.pathname.match(/^\/sitemap-catalog-(\d{1,4})\.xml$/)?.[1]);
      if(!Number.isSafeInteger(number)||number<0||number>=1000)return new Response('Not found',{status:404});
      const rows=(await env.FOODSCAN_PUBLIC_DB.prepare("SELECT barcode,updated_at FROM foodscan_public_products WHERE status='eligible' AND publication_state='approved' AND verified_at>=? AND source_modified_at>=? ORDER BY gtin14 ASC LIMIT ? OFFSET ?").bind(Date.now()-FSC_FRESH_MS,Math.floor(Date.now()/1000-FSC_SOURCE_MAX_AGE_S),FSC_SITEMAP_SIZE,FSC_SITEMAP_SIZE*number).all()).results||[];
      xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.filter(r=>!!fscCanon(r.barcode)).map(r=>`<url><loc>${origin}/products/${r.barcode}</loc><lastmod>${new Date(r.updated_at).toISOString().slice(0,10)}</lastmod></url>`).join('')}</urlset>`;
    }
  }catch(e){console.warn('catalog sitemap',String(e?.message).slice(0,100));return new Response('Catalog temporarily unavailable',{status:503,headers:{'Retry-After':'60','X-Robots-Tag':'noindex'}});}
  return new Response(request.method==='HEAD'?null:xml,{status:200,headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=30, s-maxage=30','X-Content-Type-Options':'nosniff',...(preview(url,env)?{'X-Robots-Tag':'noindex,follow'}:{})}});
}
async function fscPublicRoute(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/public-products/ingest')return fscAdminIngest(request,env,ctx);
  if(path==='/api/public-products/review')return fscAdminReview(request,env);
  if(path.startsWith('/products/')){
    if(!['GET','HEAD'].includes(request.method))return fscResponseError('Method not allowed',405);
    return fscCatalogPage(request,env,ctx);
  }
  if(/^\/scorecards\/[0-9]{8,14}\.svg$/.test(path)){
    if(!['GET','HEAD'].includes(request.method))return fscResponseError('Method not allowed',405);
    return fscScorecard(request,env,path.match(/^\/scorecards\/([0-9]+)\.svg$/)[1],ctx);
  }
  if(path==='/sitemap-catalog.xml'||/^\/sitemap-catalog-\d{1,4}\.xml$/.test(path)){
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
    return fscSitemap(request,env);
  }
  return null;
}

export {
  worker_default as default
};

/* END catalog-extension.js */

