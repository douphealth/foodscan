import {sourceEvidenceIssues} from './comparison-guards-v7540.mjs';
// Grade-independent comparisons are explicitly about label nutrients, not an
// inferred Nutri-Score. This lets a dated CSV snapshot help without inventing a method.
export function nutritionChoices(base,candidates,profile,{sameFood,assess,profileCheck},limit=3) {
  const thresholds={sugars:1,saturatedFat:0.5,salt:0.1};
  const keys=Object.keys(thresholds),bn=base?.nutrition||{};
  const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
  if(!base?.basis||base.basisSource==='assumed'||keys.some(k=>!finite(bn[k]))||assess(base).status==='withheld'||sourceEvidenceIssues(base).length)return [];
  const restricted=!!(profile?.avoids?.length||profile?.diet&&profile.diet!=='none');
  const all=[];
  for(const product of candidates) {
    if(product.nameMissing||String(product.barcode).padStart(14,'0')===String(base.barcode).padStart(14,'0')||!sameFood(base,product)||product.basis!==base.basis||product.basisSource==='assumed'||product.partial||assess(product).status==='withheld'||sourceEvidenceIssues(product).length)continue;
    if(restricted&&(!product.ingredients?.trim()||!['clear','none'].includes(profileCheck(product,profile).status)))continue;
    const ba=assess(base),pa=assess(product),method=a=>(a.method||'').replace(/-calculated$/,'');
    if(ba.grade&&pa.grade&&method(ba)&&method(ba)===method(pa)&&'ABCDE'.indexOf(pa.grade)>'ABCDE'.indexOf(ba.grade))continue;
    const pn=product.nutrition||{};
    if(keys.some(k=>!finite(pn[k])))continue;
    if(finite(bn.kcal)&&finite(pn.kcal)&&pn.kcal>bn.kcal*1.2+10)continue;
    // Do not swap one large sugar/salt/saturated-fat increase for another decrease.
    if(keys.some(k=>pn[k]>bn[k]*1.1+thresholds[k]/2))continue;
    if(finite(base.nova)&&finite(product.nova)&&product.nova>base.nova)continue;
    const improvements=keys.filter(k=>bn[k]>0&&bn[k]-pn[k]>=thresholds[k]&&pn[k]<=bn[k]*0.8)
      .map(key=>({key,from:bn[key],to:pn[key],percent:Math.min(pn[key]>0?99:100,Math.round((bn[key]-pn[key])/bn[key]*100))}));
    if(!improvements.length)continue;
    const overlap=(product.categories||[]).filter(c=>(base.categories||[]).includes(c)).length;
    all.push({product,improvements,score:overlap*5+improvements.reduce((n,x)=>n+x.percent/20,0),basis:base.basis});
  }
  const seen=new Set();
  return all.sort((a,b)=>b.score-a.score||a.product.barcode.localeCompare(b.product.barcode)).filter(x=>{
    const identity=`${x.product.brand}|${x.product.name}`.toLowerCase().replace(/\b\d+[.,]?\d*\s*(?:g|kg|ml|l)\b/g,'').trim();
    if(seen.has(identity))return false;seen.add(identity);return true;
  }).slice(0,limit);
}
