/** Deterministic, versioned preference rules. These are shopping filters, NOT medical advice or health scores. */
import {formatNumber, formatValue} from './model.js';
export const RULE_VERSION = '8.1.0';
export const PRIORITIES = [
  {id:'sugars',name:'Less sugar',metric:'sugars',unit:'g',direction:'lower',default:5,description:'Below 5 g total sugars per 100 g / ml'},
  {id:'protein',name:'More protein',metric:'protein',unit:'g',direction:'higher',default:15,description:'At least 15 g protein per 100 g / ml'},
  {id:'fiber',name:'More fiber',metric:'fiber',unit:'g',direction:'higher',default:6,description:'At least 6 g fiber per 100 g / ml'},
  {id:'sodium',name:'Less sodium',metric:'sodium',unit:'mg',direction:'lower',default:120,description:'Below 120 mg sodium per 100 g / ml'},
  {id:'satfat',name:'Less saturated fat',metric:'saturatedFat',unit:'g',direction:'lower',default:1.5,description:'At most 1.5 g saturated fat per 100 g / ml'},
  {id:'additives',name:'Fewer additives',metric:'additivesCount',unit:'listed',direction:'lower',default:null,description:'Compare reported counts, not a measure of safety'}
];
/** A priority id is not always its nutrient key (satfat -> saturatedFat). */
export const metricOf=id=>PRIORITIES.find(r=>r.id===id)?.metric||id;
export const DIETS = [{id:'vegan',name:'Vegan'},{id:'vegetarian',name:'Vegetarian'},{id:'halal',name:'Halal label'},{id:'kosher',name:'Kosher label'}];
export const AVOIDS = [
 {id:'gluten',name:'Gluten',tags:['gluten','wheat','barley','rye'],free:['gluten-free']},
 {id:'lactose',name:'Lactose',tags:['lactose'],free:['lactose-free']},
 {id:'nuts',name:'Tree nuts',tags:['nuts','tree-nuts','almond','almonds','hazelnut','hazelnuts','walnut','walnuts','cashew','cashews','pecan','pecan-nuts','brazil-nuts','pistachio','pistachio-nuts','macadamia','macadamia-nuts'],free:['nut-free','nuts-free']},
 {id:'peanuts',name:'Peanuts',tags:['peanuts','peanut','groundnut','groundnuts'],free:['peanut-free','peanuts-free']},
 {id:'milk',name:'Milk',tags:['milk'],free:['milk-free','dairy-free']},
 {id:'soy',name:'Soy',tags:['soybeans','soya','soy'],free:['soy-free','soya-free']},
 {id:'eggs',name:'Eggs',tags:['eggs'],free:['egg-free','eggs-free']},
 {id:'fish',name:'Fish',tags:['fish'],free:['fish-free']},
 {id:'shellfish',name:'Shellfish',tags:['crustaceans','molluscs'],free:['shellfish-free']},
 {id:'sesame',name:'Sesame',tags:['sesame-seeds','sesame'],free:['sesame-free']},
 {id:'palmOil',name:'Palm oil',tags:['palm-oil'],free:['palm-oil-free']},
 {id:'sweeteners',name:'Artificial sweeteners',tags:['artificial-sweeteners'],free:['no-artificial-sweeteners']}
];
export const DEFAULT_PROFILE = () => ({priorities:[],avoids:[],diets:[],thresholds:{sugars:5,protein:15,fiber:6,sodium:120,satfat:1.5},complete:false,updatedAt:null});
const uniqueKnown=(a,known)=>Array.isArray(a)?[...new Set(a.filter(x=>known.includes(x)))]:[];
export function normalizeProfile(raw){
 const d=DEFAULT_PROFILE(); const t=raw?.thresholds||{};
 for(const k of Object.keys(d.thresholds)){const v=t[k],max=k==='sodium'?40000:100;if(typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=max)d.thresholds[k]=v;}
 return {...d,priorities:uniqueKnown(raw?.priorities,PRIORITIES.map(x=>x.id)),avoids:uniqueKnown(raw?.avoids,AVOIDS.map(x=>x.id)),diets:uniqueKnown(raw?.diets,DIETS.map(x=>x.id)),complete:raw?.complete===true,updatedAt:typeof raw?.updatedAt==='number'&&Number.isFinite(raw.updatedAt)?raw.updatedAt:null};
}
export const hasRestrictions=p=>{const n=normalizeProfile(p);return n.avoids.length+n.diets.length>0;};
export const hasProfile=p=>Boolean(p&&(p.priorities?.length||p.avoids?.length||p.diets?.length));
export const basisLabel=p=>p.basis==='g'?'per 100 g':p.basis==='ml'?'per 100 ml':'per 100 g / ml (basis unspecified)';
export function nutrientConflicts(p){
 const n=p.nutrition||{},bad=new Set();
 if(n.sugars!=null&&n.carbohydrates!=null&&n.sugars>n.carbohydrates+.5){bad.add('sugars');bad.add('carbohydrates');}
 if(n.saturatedFat!=null&&n.fat!=null&&n.saturatedFat>n.fat+.5){bad.add('saturatedFat');bad.add('fat');}
 if(p.basis==='g')for(const k of ['protein','fiber','carbohydrates','sugars','fat','saturatedFat','salt'])if(n[k]>100)bad.add(k);
 if(n.kcal>1000&&p.basis==='g')bad.add('kcal');
 if(p.basis&&p.servingUnit===p.basis&&p.servingAmount>0){for(const key of Object.keys(METRICS)){const given=p.servingNutrition?.[key],expected=n[key]*p.servingAmount/100;if(given!=null&&n[key]!=null&&Math.abs(given-expected)>Math.max(key==='kcal'?5:key==='sodium'?10:.5,expected*.1))bad.add(key);}}
 if(n.sodium!=null&&n.salt!=null&&Math.abs(n.sodium-n.salt*400)>Math.max(10,n.salt*400*.1)){bad.add('sodium');bad.add('salt');}
 return [...bad];
}
const stripped=t=>String(t).toLowerCase().replace(/^[a-z]{2}:/,'').replaceAll(' ','-');
const tagSet=a=>new Set((a||[]).map(stripped));
function restriction(p,r){
 const labels=tagSet(p.labels),all=tagSet(p.allergens),traces=tagSet(p.traces);
 const analysis=tagSet(p.analysis);
 const direct=r.tags.some(t=>all.has(t))||(r.id==='palmOil'&&analysis.has('palm-oil'))||(r.id==='sweeteners'&&labels.has('contains-artificial-sweeteners')),trace=r.tags.some(t=>traces.has(t)),claim=r.free.some(t=>labels.has(t));
 const words=(p.ingredients||'').toLowerCase().replace(/[_<>]/g,' ');
 const terms=r.tags.flatMap(t=>[t.replaceAll('-',' '),t.replaceAll('-',' ').replace(/s$/,'')]).filter(t=>t.length>2);
 const textConflict=terms.some(t=>new RegExp('(^|[^a-z])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z]|$)','i').test(words));
 const base={key:r.id,sourceField:'allergens_tags / traces_tags / labels_tags',sourceType:p.provenance==='local'?'Your entry':'Open Food Facts'};
 if(direct||trace)return {...base,status:'attention',title:claim?`Conflicting ${r.name.toLowerCase()} information`:`${trace&&!direct?'May contain':'Contains'} ${r.name.toLowerCase()} in the record`,why:claim?'A free-from label and an allergen/trace flag are both recorded. Do not rely on this record; check the current package and manufacturer.':`The source ${direct?'allergen':'trace'} list explicitly includes this restriction. This is a package-information flag, not a diagnosis. Check the current physical label.`};
 if(textConflict)return {...base,status:'attention',title:`Check ingredient text for ${r.name.toLowerCase()}`,why:claim?'Ingredient text mentions this restriction alongside a free-from claim. The record is withheld as conflicting or context-dependent; check the package.':'Ingredient text mentions a term associated with this restriction, even though the structured allergen tags do not confirm it. This is a reason to check the package, not a diagnosis or a complete ingredient analysis.'};
 if(claim)return {...base,status:'match',title:`${r.name}-free label reported`,why:'The source explicitly lists a free-from label. This is not an independent safety verification. Ingredient changes and cross-contact may not be captured; check the package.'};
 return {...base,status:'unknown',title:r.id==='lactose'&&all.has('milk')?'Milk listed; lactose amount unknown':`${r.name}-free status is not confirmed`,why:'Missing allergen tags are not proof of absence. There is no explicit matching free-from label in this record. Do not use this app alone to assess allergy safety.'};
}
export function assess(p,rawProfile){
 const profile=normalizeProfile(rawProfile),flags=[],bad=nutrientConflicts(p),labels=tagSet(p.labels),analysis=tagSet(p.analysis),all=tagSet(p.allergens);
 for(const key of profile.avoids)flags.push(restriction(p,AVOIDS.find(x=>x.id===key)));
 for(const key of profile.diets){
  const claim=labels.has(key),negative=(analysis.has(`non-${key}`)||labels.has(`non-${key}`))||(key==='vegan'&&['milk','eggs','fish','crustaceans','molluscs'].some(k=>all.has(k)));
  flags.push({key,status:negative?'attention':claim?'match':'unknown',title:negative?`Check ${key} suitability`:claim?`${key[0].toUpperCase()+key.slice(1)} label reported`:`${key[0].toUpperCase()+key.slice(1)} status not confirmed`,why:negative?'Source ingredient analysis or allergen information conflicts with this preference. A label alone does not override contradictory data.':claim?'An explicit label is recorded by the source. FoodScan has not checked certification.':analysis.has(key)?'Source ingredient analysis suggests a match, but this is automated analysis, not a verified dietary label.':'No explicit matching label was provided. Absence of an ingredient flag does not confirm suitability.',sourceField:'labels_tags / ingredients_analysis_tags / allergens_tags',sourceType:p.provenance==='local'?'Your entry':'Open Food Facts'});
 }
 for(const key of profile.priorities){
  const rule=PRIORITIES.find(x=>x.id===key),metric=rule.metric,n=key==='additives'?p.additivesCount:p.nutrition?.[metric],threshold=profile.thresholds[key],conflicted=bad.includes(metric);
  const base={key,sourceField:key==='additives'?'additives_n':`nutriments.${metric}`,sourceType:p.provenance==='local'?'Your entry':'Open Food Facts'};
  if(n==null||conflicted||(key!=='additives'&&!p.basis)){flags.push({...base,status:'unknown',title:`${rule.name}: ${conflicted?'conflicting values':n!=null&&!p.basis?'nutrition basis unspecified':'value unavailable'}`,why:conflicted?'The recorded nutrients are internally inconsistent. This value is not used for matching or ranking.':n!=null&&!p.basis?'A per-100 value is reported, but this record does not establish a mass or volume basis. The number is displayed for reference, not marked as a confirmed match.':'A usable source value is missing. It is not treated as zero or as meeting your preference.'});continue;}
  if(key==='additives'){flags.push({...base,status:'fact',title:`${n} additive${n===1?'':'s'} reported`,why:'This is the source-reported count, not a safety rating. Different additives serve different purposes, and the source may not have a complete ingredient analysis.'});continue;}
  const match=rule.direction==='lower'?n<threshold:n>=threshold;
  flags.push({...base,status:match?'match':'fact',title:`${formatValue(n,rule.unit)} ${{sodium:'sodium',satfat:'saturated fat',fiber:'fiber'}[key]||key} ${basisLabel(p)}`,why:`Your shopping filter is ${rule.direction==='lower'?'below':'at least'} ${formatValue(threshold,rule.unit)} ${basisLabel(p)}. ${match?'This reported value meets':'This reported value does not meet'} that filter. This is not a nutrition claim, daily target, or medical recommendation.${key==='sodium'&&p.sodiumDerived?' Sodium is calculated as salt (g) x 400 to get mg.':''}`});
 }
 if(labels.has('no-added-sugar'))flags.push({key:'addedSugar',status:p.addedSugars>0?'attention':'fact',title:p.addedSugars>0?'Added-sugar data conflict':'No-added-sugar label reported',why:p.addedSugars>0?'A no-added-sugar label conflicts with a positive added-sugars value. Check the physical label.':'The record lists this label; it is not inferred from total sugars. Naturally occurring sugars may still be present.',sourceField:'labels_tags / added-sugars_100g',sourceType:p.provenance==='local'?'Your entry':'Open Food Facts'});
 if(p.qualityWarnings?.length)flags.push({key:'sourceQuality',status:'unknown',title:'Source data-quality warnings',why:'The database flags this record for review: '+p.qualityWarnings.map(stripped).join(', ')+'. Check the current package.',sourceField:'data_quality_errors_tags',sourceType:'Open Food Facts'});
 const cautions=flags.filter(x=>x.status==='attention'),unknown=flags.filter(x=>x.status==='unknown'),matches=flags.filter(x=>x.status==='match');
 return {flags,ruleVersion:RULE_VERSION,cautions: cautions.length,unknown:unknown.length,matches:matches.length,title:!hasProfile(profile)?'Your facts, without a food score.':cautions.length?'Check these details first.':unknown.length?'Some details still need checking.':matches.length?'Matches your selected filters.':'Here is how it fits your priorities.',tone:cautions.length?'attention':unknown.length?'unknown':'neutral'};
}
export const METRICS={kcal:{name:'Energy',unit:'kcal'},protein:{name:'Protein',unit:'g'},sugars:{name:'Total sugars',unit:'g'},fiber:{name:'Fiber',unit:'g'},sodium:{name:'Sodium',unit:'mg'},carbohydrates:{name:'Carbohydrate',unit:'g'},fat:{name:'Fat',unit:'g'},saturatedFat:{name:'Saturated fat',unit:'g'},salt:{name:'Salt',unit:'g'}};
export function priorityMetrics(profile){const keys=[...new Set((profile?.priorities||[]).map(metricOf).filter(k=>Object.hasOwn(METRICS,k)))];return keys.length?keys:['kcal','protein','sugars','fiber'];}
/** Compatibility adapter: numeric controls are never eligibility filters. */
export function passesFilters(p,filters={}){
 const avoids=[];
 if(filters.nuts)avoids.push('nuts','peanuts');
 if(filters.sweeteners)avoids.push('sweeteners');
 return eligibility(p,{avoids}).allowed;
}
export function comparable(a,b){return Boolean(a.basis&&b.basis&&a.basis===b.basis&&a.provenance!=='local'&&b.provenance!=='local');}
export function rankAlternatives(base,products,rawProfile,category){
 const profile=normalizeProfile(rawProfile),ranked=[],metrics=profile.priorities.filter(k=>k!=='additives');
 // No unexplained default ranking: the person must choose at least one measurable priority.
 if(!metrics.length)return [];
 for(const p of products){
  if(p.barcode===base.barcode||!comparable(base,p)||!p.categories?.includes(category)||p.qualityWarnings?.length||base.qualityWarnings?.length)continue;
  const evaluation=assess(p,profile);
  if(!eligibility(p,profile).allowed||evaluation.cautions)continue;
  const deltas=[];let allKnown=true,worse=false;
  for(const key of metrics){
   const rule=PRIORITIES.find(x=>x.id===key),a=base.nutrition[rule.metric],b=p.nutrition[rule.metric];
   if(a==null||b==null||nutrientConflicts(base).includes(rule.metric)||nutrientConflicts(p).includes(rule.metric)){allKnown=false;break;}
   const improvement=rule.direction==='lower'?a-b:b-a;if(improvement<-.0001)worse=true;
   if(improvement>.0001)deltas.push({key,amount:improvement,unit:rule.unit,direction:rule.direction});
  }
  if(!allKnown||worse||!deltas.length)continue;
  ranked.push({product:p,deltas,why:deltas.map(d=>`${formatNumber(d.amount)} ${d.unit} ${d.direction==='lower'?'less':'more'} ${d.key} ${basisLabel(base)}`).join('; ')});
 }
 return ranked.sort((a,b)=>{
  for(const key of metrics){const dir=PRIORITIES.find(x=>x.id===key).direction;const m=PRIORITIES.find(x=>x.id===key).metric,d=a.product.nutrition[m]-b.product.nutrition[m];if(d)return dir==='lower'?d:-d;}
  return a.product.name.localeCompare(b.product.name);
 }).slice(0,8);
}
export function servingValue(p,key){
 if(nutrientConflicts(p).includes(key))return {value:null,estimated:false,label:'Conflicting recorded values; check the package'};
 const value=p.servingNutrition?.[key];if(p.serving&&value!=null)return {value,estimated:false,label:p.serving};
 if(p.basis&&p.servingAmount>0&&p.servingUnit===p.basis&&p.nutrition?.[key]!=null)return {value:p.nutrition[key]*p.servingAmount/100,estimated:true,label:p.serving||`${p.servingAmount} ${p.servingUnit}`};
 return {value:null,estimated:false,label:p.serving||'Serving not supplied'};
}


/** Hard constraints only. Unknown is withheld, never promoted to an absence claim.
 * This gate is shared by every renderer and every product-adding command.
 */
export function eligibility(product,rawProfile){
 const profile=normalizeProfile(rawProfile),keys=[...profile.avoids,...profile.diets];
 if(!keys.length)return {allowed:true,status:'eligible',reasons:[]};
 if(product&&product.partial===true)return {allowed:false,status:'unconfirmed',reasons:[{key:'partial',title:'Open this product to check it against your restrictions',why:'This is a search preview without ingredient text or may-contain warnings, so it cannot confirm your restrictions yet. Open it to load the full record.'}]};
 if(!product)return {allowed:false,status:'unconfirmed',reasons:[{key:'record',title:'Restriction information is unavailable',why:'This item has no linked source record. Scan its package before adding it with the active restrictions.'}]};
 const flags=assess(product,profile).flags.filter(f=>keys.includes(f.key));
 const conflicts=flags.filter(f=>f.status==='attention');
 if(conflicts.length)return {allowed:false,status:'excluded',reasons:conflicts};
 if(product.provenance==='local')return {allowed:false,status:'unconfirmed',reasons:[{key:'provenance',title:'A private entry cannot confirm your restrictions',why:'Your notes are preserved, but do not establish a source-backed free-from or dietary claim.'}]};
 const unknown=flags.filter(f=>f.status!=='match');
 if(product.qualityWarnings?.length)unknown.push({key:'quality',title:'Source record needs review',why:'Source data-quality warnings prevent confirming your hard restrictions.'});
 return {allowed:!unknown.length,status:unknown.length?'unconfirmed':'eligible',reasons:unknown};
}

/** Lexicographic preference ranking, no score and no filtering. Unknowns remain visible.
 * Values with missing/conflicting or incompatible units never earn an improvement.
 */
export function rankProducts(products,rawProfile){
 const profile=normalizeProfile(rawProfile);
 const facts=new Map(products.map(p=>[p,assess(p,profile)]));
 return products.map((p,index)=>({p,index})).sort((a,b)=>{
  for(const key of profile.priorities){
   const rule=PRIORITIES.find(r=>r.id===key);
   const af=facts.get(a.p).flags.find(f=>f.key===key),bf=facts.get(b.p).flags.find(f=>f.key===key);
   const ak=af&&af.status!=='unknown',bk=bf&&bf.status!=='unknown';
   if(ak!==bk)return ak?-1:1;
   if(!ak)continue;
   if(key!=='additives'&&a.p.basis!==b.p.basis)continue;
   const av=key==='additives'?a.p.additivesCount:a.p.nutrition[rule.metric];
   const bv=key==='additives'?b.p.additivesCount:b.p.nutrition[rule.metric];
   if(av!==bv)return rule.direction==='lower'?av-bv:bv-av;
  }
  return a.index-b.index;
 }).map(x=>x.p);
}

export function profileSummary(rawProfile){
 const p=normalizeProfile(rawProfile);
 const labels=[...p.avoids.map(k=>'Avoid '+AVOIDS.find(a=>a.id===k).name.toLowerCase()),...p.diets.map(k=>DIETS.find(d=>d.id===k).name),...p.priorities.map(k=>{const r=PRIORITIES.find(x=>x.id===k);return r.name+(r.default==null?'':` ${r.direction==='lower'?'<':'>='}${p.thresholds[k]} ${r.unit}/100 g or ml`);})];
 return labels.join(' | ')||'No restrictions or priorities selected';
}

export function profileSignature(raw){const p=normalizeProfile(raw);return JSON.stringify({priorities:p.priorities,avoids:p.avoids,diets:p.diets,thresholds:p.thresholds});}
