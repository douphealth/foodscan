/** One non-destructive projection for all visible surfaces; the archive is never filtered in place. */
import {eligibility, rankProducts,normalizeProfile} from './profile.js';
const canonical=code=>String(code||'').padStart(14,'0');
export function rawProducts(state){
 const store=state.store||state;
 const records=[state.active,...(state.extraProducts||[]),...(state.alternatives?.items||[]),...(store.recent||[]),...(store.saved||[]),...(store.library||[])].filter(Boolean);
 const map=new Map();
 for(const p of records){const key=canonical(p.barcode),old=map.get(key);if(old&&Boolean(old.partial)!==Boolean(p.partial)){if(!p.partial)map.set(key,p);continue;}if(!old||(p.fetchedAt||0)>(old.fetchedAt||0)||((p.fetchedAt||0)===(old.fetchedAt||0)&&!eligibility(p,store.profile).allowed&&eligibility(old,store.profile).allowed))map.set(key,p);}
 return [...map.values()];
}
export function resolveProduct(state,code){return code?rawProducts(state).find(p=>canonical(p.barcode)===canonical(code))||null:null;}
export function requireEligible(product,profile){
 const decision=eligibility(product,profile);
 if(!decision.allowed){const error=new Error(decision.status==='excluded'?'Not added: this record conflicts with your active restrictions.':'Not added: your active restrictions cannot be confirmed for this item.');error.code='profile_restriction';error.decision=decision;throw error;}
 return product;
}
export function rowEligibility(row,state){return eligibility(resolveProduct(state,row?.barcode),(state.store||state).profile);}
export function visibleProducts(state){return rankProducts(rawProducts(state).filter(p=>eligibility(p,(state.store||state).profile).allowed),(state.store||state).profile);}
export function projectState(state){
 if(state.policyProjection)return state;
 const store=state.store,profile=normalizeProfile(store.profile),all=rawProducts(state),byCode=new Map(all.map(p=>[canonical(p.barcode),p]));
 const resolve=code=>byCode.get(canonical(code))||null;
 const filterProducts=items=>rankProducts((items||[]).map(p=>resolve(p.barcode)||p).filter(p=>eligibility(p,profile).allowed),profile);
 const ranked=rankProducts(all.filter(p=>eligibility(p,profile).allowed),profile);
 const positions=new Map(ranked.map((p,index)=>[canonical(p.barcode),index]));
 const filterRows=items=>{
  const rows=(items||[]).filter(x=>eligibility(resolve(x.barcode),profile).allowed).map(x=>({...x,name:resolve(x.barcode)?.name||x.name}));
  return profile.priorities.length?rows.sort((a,b)=>(positions.get(canonical(a.barcode))??Infinity)-(positions.get(canonical(b.barcode))??Infinity)):rows;
 };
 const saved=filterProducts(store.saved),recent=filterProducts(store.recent),library=filterProducts(store.library),shopping=filterRows(store.shopping),pantry=filterRows(store.pantry);
 const active=state.active?(resolve(state.active.barcode)||state.active):null,gate=active?eligibility(active,profile):null;
 const excludedResult=active&&!gate.allowed?{barcode:active.barcode,sourceModified:active.sourceModified,fetchedAt:active.fetchedAt,provenance:active.provenance,sourceUrl:active.sourceUrl,...gate}:null;
 const safeCodes=new Set(all.filter(p=>eligibility(p,profile).allowed).map(p=>canonical(p.barcode)));
 return {...state,policyProjection:true,excludedResult,active:excludedResult?null:active,
  extraProducts:filterProducts(state.extraProducts),compare:(state.compare||[]).map(c=>safeCodes.has(canonical(c))?c:''),
  alternatives:state.alternatives?{...state.alternatives,items:filterProducts(state.alternatives.items)}:state.alternatives,
  store:{...store,profile,saved,recent,library,shopping,pantry,purchases:filterRows(store.purchases)},
  withheld:{saved:store.saved.length-saved.length,recent:store.recent.length-recent.length,shopping:store.shopping.length-shopping.length,pantry:store.pantry.length-pantry.length}};
}
