/** One local decision model for the scan and the pre-shop review. No health score. */
import {normalizeProfile,eligibility,assess,PRIORITIES,AVOIDS,DIETS,hasProfile,basisLabel,nutrientConflicts} from './profile.js';
import {resolveProduct} from './policy.js';
import {formatNumber} from './model.js';
export const canonicalCode=code=>String(code||'').padStart(14,'0');
export function decisionFor(product,rawProfile){
 const profile=normalizeProfile(rawProfile),gate=eligibility(product,profile);
 if(!gate.allowed)return {kind:gate.status==='excluded'?'excluded':'unconfirmed',title:gate.status==='excluded'?'Does not fit your avoid rules.':'Your restrictions are not confirmed.',summary:gate.reasons[0]?.title||'Check the current package.',flags:gate.reasons,misses:[],unknown:[],gate};
 if(!product)return {kind:'unconfirmed',title:'Product information unavailable.',summary:'Scan the current package to check its record.',flags:[],misses:[],unknown:[],gate};
 const assessment=assess(product,profile),wanted=[...profile.avoids,...profile.diets,...profile.priorities];
 const flags=wanted.map(k=>assessment.flags.find(f=>f.key===k)).filter(Boolean);
 const numeric=profile.priorities.filter(k=>PRIORITIES.find(r=>r.id===k)?.default!==null);
 const misses=flags.filter(f=>numeric.includes(f.key)&&f.status==='fact');
 const unknown=flags.filter(f=>f.status==='unknown');
 // Source quality and conflicting added-sugar claims must not become a green summary.
 const concerns=assessment.flags.filter(f=>!wanted.includes(f.key)&&['unknown','attention'].includes(f.status));
 if(!hasProfile(profile))return {kind:'neutral',title:'Your priorities come first.',summary:'Choose an avoid rule or one goal below. No personal fit is assumed.',flags:[],misses,unknown,gate};
 if(product.provenance==='local')return {kind:'unconfirmed',title:'Check your unverified entry.',summary:'These are your notes, not a source-verified product match.',flags,misses,unknown,gate};
 if(unknown.length||concerns.length||product.partial||product.qualityWarnings?.length)return {kind:'unconfirmed',title:'Some details need checking.',summary:unknown[0]?.title||concerns[0]?.title||'A complete product record is needed.',flags:[...flags,...concerns],misses,unknown,gate};
 if(misses.length){const key=misses[0].key,rule=PRIORITIES.find(r=>r.id===key),n=product.nutrition?.[rule.metric],target=profile.thresholds[key],label=rule.metric==='saturatedFat'?'saturated fat':rule.metric;
  let multiple='';
  if(n!=null&&target>0){
   if(rule.direction==='lower'){const m=n/target;multiple=m>=2?`${Math.round(m)}\u00d7 your ${formatNumber(target)} ${rule.unit} limit`:m>1?`over your ${formatNumber(target)} ${rule.unit} limit`:`close to your ${formatNumber(target)} ${rule.unit} limit`;}
   else{const pct=Math.round(n/target*100);multiple=pct>=100?`meets your ${formatNumber(target)} ${rule.unit} target`:`only ${pct}% of your ${formatNumber(target)} ${rule.unit} target`;}
  }
  return {kind:'check',title:'Leave it.',summary:`${formatNumber(n)} ${rule.unit} ${label} per 100 ${product.basis||'g'}${multiple?` \u2014 ${multiple}`:''}.`,flags,misses,unknown,gate};
 }
 const confirmed=flags.filter(f=>f.status==='match');
 return {kind:confirmed.length?'match':'neutral',title:confirmed.length?'Fine for you.':'Here are your selected facts.',summary:confirmed.length?'The reported values or labels match your choices. This is not an allergy-safety guarantee.':'Reported additive counts are information, not a risk rating.',flags,misses,unknown,gate};
}
/** Deduplicate packages, not pantry lots. Never include hidden names in a hard-rule review. */
export function pantryReview(state){
 const store=state.store||state,profile=normalizeProfile(store.profile),seen=new Set(),items=[];
 for(const row of store.pantry||[]){
  const key=row.barcode?canonicalCode(row.barcode):`manual:${row.id}`;if(seen.has(key))continue;seen.add(key);
  const product=resolveProduct(state,row.barcode),d=decisionFor(product,profile);
  const relevant=d.kind==='excluded'||d.kind==='unconfirmed'||d.misses.length>0;
  if(!relevant)continue;
  const hidden=!d.gate.allowed||!product;
  items.push({id:row.id,barcode:row.barcode||'',product:hidden?null:product,source:product?{barcode:product.barcode,provenance:product.provenance,sourceModified:product.sourceModified,fetchedAt:product.fetchedAt}:null,decision:d,hidden});
 }
 const soft=items.filter(x=>x.decision.misses.length&&x.decision.gate.allowed),hard=items.filter(x=>!x.decision.gate.allowed),uncertain=items.filter(x=>x.decision.kind==='unconfirmed');
 return {items,soft,hard,uncertain,total:items.length,checked:seen.size,profiled:hasProfile(profile)};
}
/** Contextual portion only when the source states a compatible amount. No category-size guesses. */
export function decisionPortion(product){
 if(product?.basis&&product.servingUnit===product.basis&&product.servingAmount>0&&product.servingAmount<=2000&&!nutrientConflicts(product).length)return {amount:product.servingAmount,unit:product.basis,source:'reported serving'};
 return null;
}
