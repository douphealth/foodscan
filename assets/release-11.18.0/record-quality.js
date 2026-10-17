/** FoodScan 11.15: trustworthy normalization of source nutrition and packaging photos.
 * Only declared OFF fields, physically plausible bounds and verifiable unit conversions.
 * No food composition tables, learned guesses or user-specific fabricated data.
 */
export const NUTRIENT_FIELDS=Object.freeze([
 ['kcal','Energy','energy-kcal','kcal'],
 ['protein','Protein','proteins','g'],
 ['carbohydrates','Carbohydrate','carbohydrates','g'],
 ['sugars','Total sugars','sugars','g'],
 ['fat','Fat','fat','g'],
 ['saturatedFat','Saturated fat','saturated-fat','g'],
 ['fiber','Fiber','fiber','g'],
 ['salt','Salt','salt','g']
]);
const positive=value=>{
 if(typeof value==='string'&&/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim()))value=Number(value);
 return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
};
const validUnit=u=>u==='g'||u==='ml';
const plausible=(key,value,basis)=>{
 if(value==null||!Number.isFinite(value)||value<0)return false;
 if(key==='kcal')return value<=950;
 if(key==='salt'||key==='sugars'||key==='saturatedFat'||key==='fat'||key==='fiber'||key==='protein'||key==='carbohydrates'){
  return value<=(basis==='ml'?150:100);
 }
 return true;
};
const maxDiff=(x,y)=>Math.max(12,Math.min(x,y)*.09);
function usableEnergy(n){
 const kj=positive(n['energy-kj_100g']);
 return kj!=null&&kj<=4000?kj/4.184:null;
}
const describe=field=>NUTRIENT_FIELDS.find(x=>x[0]===field)?.[1]||field;

/** Audit and repair parsed OFF data only when a transparent source conversion is valid. */
export function improveRecord(product,source=null){
 if(!product||typeof product!=='object'||!product.nutrition)return product;
 const result={...product,nutrition:{...product.nutrition},servingNutrition:{...product.servingNutrition}};
 const raw=source&&typeof source==='object'&&!Array.isArray(source)?source:null;
 const n=raw?.nutriments&&typeof raw.nutriments==='object'?raw.nutriments:null;
 const original=result.nutrition,origins={},issues=[],derived=[];
 const unit=validUnit(product.basis)?product.basis:null;
 const serving=Number(product.servingAmount),servingKnown=unit&&product.servingUnit===unit&&Number.isFinite(serving)&&serving>=1&&serving<=2000;
 if(n){
  for(const [key,label,field] of NUTRIENT_FIELDS){
   const raw100=positive(n[field+'_100g']),rawServing=positive(n[field+'_serving']);
   let value=original[key],kind=raw100!=null?'reported':null;
   if(key==='kcal'){
    const fromKj=usableEnergy(n);
    const rawKcal=raw100;
    if(rawKcal!=null&&!plausible('kcal',rawKcal,unit)){
     if(fromKj!=null&&plausible('kcal',fromKj,unit)){
      value=fromKj;kind='kilojoules';
      issues.push('The supplied kcal value conflicts with a plausible kJ value; energy is calculated from the reported kJ.');
     }else {value=null;kind=null;issues.push('The energy values are implausible and have been withheld.');}
    }else if(rawKcal!=null&&fromKj!=null&&Math.abs(rawKcal-fromKj)>maxDiff(rawKcal,fromKj)){
     value=null;kind=null;issues.push('The reported kcal and kJ values disagree; energy has been withheld.');
    }else if(rawKcal==null&&fromKj!=null){
     value=fromKj;kind='kilojoules';
    }
   }
   if(value!=null&&!plausible(key,value,unit)){
    value=null;kind=null;issues.push(label+' exceeds a plausible amount per 100 '+(unit||'units')+' and has been withheld.');
   }
   if(value==null&&raw100==null&&key!=='kcal'&&servingKnown&&rawServing!=null){
    const calculated=rawServing*100/serving;
    if(plausible(key,calculated,unit)){
     value=calculated;kind='serving';derived.push(label);
    }
   }
   if(value==null&&raw100==null&&key==='kcal'&&servingKnown&&rawServing!=null){
    const calculated=rawServing*100/serving;
    if(plausible(key,calculated,unit)){value=calculated;kind='serving';derived.push(label);}
   }
   result.nutrition[key]=value;
   origins[key]=value==null?'missing':kind||'reported';
   // Never let a conflicting per-serving claim invalidate a separately supported kJ recovery.
   if(key==='kcal'&&kind==='kilojoules'&&servingKnown&&result.servingNutrition?.kcal!=null){
    const expected=value*serving/100;
    if(Math.abs(result.servingNutrition.kcal-expected)>Math.max(5,expected*.1)){
     result.servingNutrition.kcal=null;
     issues.push('The source serving energy conflicts with the converted kJ value and has been withheld.');
    }
   }
  }
  // Salt is 2.5 x sodium mass, with sodium normally reported in grams by OFF.
  const srcSalt=positive(n.salt_100g),srcNa=positive(n.sodium_100g);
  if(srcSalt==null&&srcNa!=null&&origins.salt==='missing'&&plausible('salt',srcNa*2.5,unit)){
   result.nutrition.salt=srcNa*2.5;
   origins.salt='sodium';derived.push('Salt');
  }
  if(srcSalt!=null&&srcNa!=null&&Math.abs(srcSalt-srcNa*2.5)>Math.max(.05,srcSalt*.12)){
   result.nutrition.salt=null;result.nutrition.sodium=null;
   origins.salt='missing';issues.push('Source sodium and salt disagree; salt was withheld.');
  }
 }else{
  for(const [key] of NUTRIENT_FIELDS){
   let val=result.nutrition[key];
   if(val!=null&&!plausible(key,val,unit)){result.nutrition[key]=null;issues.push(describe(key)+' from an older stored record is implausible and was withheld.');}
   origins[key]=result.nutrition[key]==null?'missing':'previously saved';
  }
 }
 if(result.nutrition.salt!=null&&result.nutrition.sodium==null)result.nutrition.sodium=result.nutrition.salt*400;
 if(result.nutrition.salt==null)result.nutrition.sodium=null;
 // Respect contradictions within the same serving basis; do not fill an impossible subtotal.
 const nval=result.nutrition;
 if(nval.sugars!=null&&nval.carbohydrates!=null&&nval.sugars>nval.carbohydrates+.5){
  result.nutrition.sugars=null;result.nutrition.carbohydrates=null;
  origins.sugars='missing';origins.carbohydrates='missing';
  issues.push('Total sugars exceed carbohydrates in the source; both values were withheld.');
 }
 if(nval.saturatedFat!=null&&nval.fat!=null&&nval.saturatedFat>nval.fat+.5){
  result.nutrition.saturatedFat=null;result.nutrition.fat=null;
  origins.saturatedFat='missing';origins.fat='missing';
  issues.push('Saturated fat exceeds total fat in the source; both values were withheld.');
 }

 // Compare a reported serving amount against a validated per-100 value.
 // OFF volunteers sometimes enter erroneous serving totals. Preserve a
 // supported per-100 value and withhold ONLY the inconsistent serving field:
 // hiding both values made otherwise valid nutrients appear unavailable.
 if(servingKnown){
  for(const [key,label] of NUTRIENT_FIELDS){
   const per100=result.nutrition[key],perServing=result.servingNutrition[key];
   if(per100==null||perServing==null||!Number.isFinite(perServing))continue;
   const expected=per100*serving/100;
   const absoluteAllowance=key==='kcal'?5:.5;
   if(Math.abs(perServing-expected)>Math.max(absoluteAllowance,expected*.1)){
    result.servingNutrition[key]=null;
    issues.push(label+': the source serving amount disagrees with its per-100 amount. Per-100 data is retained; the conflicting serving value is withheld.');
   }
  }
 }
 const available=NUTRIENT_FIELDS.filter(([key])=>result.nutrition[key]!=null).length;
 const missing=NUTRIENT_FIELDS.filter(([key])=>result.nutrition[key]==null).map(([,label])=>label);
 result.nutritionQuality={
  available,total:NUTRIENT_FIELDS.length,missing,
  origins,derived:[...new Set(derived)],issues:[...new Set(issues)].slice(0,9),
  sourceOnly:!raw,updatedAt:Number(product.sourceModified)||null
 };
 // If the source has no verifiable mass/volume basis, don't invent 'per 100 g'.
 return result;
}
const imageURL=value=>{
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
   ['images.openfoodfacts.org','static.openfoodfacts.org'].includes(u.hostname)&&
   /^\/images\/products\/\d/.test(u.pathname)?u.href:'';
 }catch{return '';}
};
/** Preserve OFF front-image provenance and prefer a display-size crop in the device's language. */
export function frontPhotos(source,barcode='',languages=['en']){
 if(!source||typeof source!=='object')return [];
 const front=source.selected_images?.front?.display;
 const chosen=[],add=url=>{const valid=imageURL(url);if(valid&&!chosen.includes(valid))chosen.push(valid);};
 const langs=[...(Array.isArray(languages)?languages:[]),source.lang,'en'].filter(x=>typeof x==='string')
   .map(x=>x.toLowerCase().split('-')[0]);
 if(front&&typeof front==='object'){
  for(const lang of langs)add(front[lang]);
 }
 add(source.image_front_url);
 if(front&&typeof front==='object'){
  for(const key of Object.keys(front).sort().slice(0,20))add(front[key]);
 }
 add(source.image_url);
 add(source.image_front_small_url);
 return chosen.slice(0,10);
}
export function qualitySummary(product){
 const q=product?.nutritionQuality;
 if(q&&Number.isFinite(q.available))return q;
 return improveRecord(product)?.nutritionQuality||null;
}
