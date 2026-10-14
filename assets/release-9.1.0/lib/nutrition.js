/** Plain-English nutrition insight engine. Pure functions, no DOM, no network.
 *
 * Nothing here invents a score. Every statement is computed from a published standard and carries
 * its own explanation:
 *   - UK FSA front-of-pack color thresholds (per 100 g / 100 ml)
 *   - EU Regulation 1169/2011 reference intakes (adult, 2,000 kcal)
 *   - EU Regulation 1924/2006 nutrition-claim criteria (fiber, protein)
 *   - Nutri-Score and NOVA exactly as supplied by the source record
 * Missing or conflicting values are never treated as zero.
 */
import {formatNumber} from './model.js';
import {nutrientConflicts,normalizeProfile,eligibility,assess,PRIORITIES} from './profile.js';

/* ---------- reference tables ---------- */
export const LIGHT_RULES=[
 {key:'fat',label:'Fat',noun:'fat',food:[3,17.5],drink:[1.5,8.75]},
 {key:'saturatedFat',label:'Saturated fat',noun:'saturated fat',food:[1.5,5],drink:[.75,2.5]},
 {key:'sugars',label:'Sugars',noun:'sugar',food:[5,22.5],drink:[2.5,11.25]},
 {key:'salt',label:'Salt',noun:'salt',food:[.3,1.5],drink:[.3,.75]}
];
/** Adult reference intakes, EU 1169/2011 Annex XIII. A general label guide, not personal advice. */
export const REFERENCE_INTAKE={kcal:2000,fat:70,saturatedFat:20,carbohydrates:260,sugars:90,protein:50,salt:6};
export const GRADE_STYLE={
 A:{bg:'#038141',fg:'#ffffff',word:'Excellent'},B:{bg:'#85bb2f',fg:'#13280f',word:'Good'},
 C:{bg:'#fecb02',fg:'#2d2400',word:'Average'},D:{bg:'#ee8100',fg:'#2b1500',word:'Poor'},E:{bg:'#d6370c',fg:'#ffffff',word:'Poor'}
};
export const NOVA_INFO={
 1:{short:'Unprocessed',title:'Unprocessed or minimally processed',tone:'green'},
 2:{short:'Culinary ingredient',title:'Processed culinary ingredient',tone:'info'},
 3:{short:'Processed',title:'Processed food',tone:'info'},
 4:{short:'Ultra-processed',title:'Ultra-processed food',tone:'amber'}
};
const SUGAR_PER_TSP=4;

/* ---------- value helpers ---------- */
/** Salt in g per 100. Falls back to sodium (mg) / 400 when only sodium was reported. */
export function saltPer100(p){
 const n=p.nutrition||{};
 if(n.salt!=null)return n.salt;
 return n.sodium!=null?n.sodium/400:null;
}
export function valuePer100(p,key){
 const n=p.nutrition||{};
 if(key==='salt')return saltPer100(p);
 return n[key]??null;
}
export const unitWord=p=>p.basis==='ml'?'ml':'g';
export function teaspoons(sugarGrams){
 if(sugarGrams==null||!Number.isFinite(sugarGrams))return null;
 return sugarGrams/SUGAR_PER_TSP;
}
export function formatTsp(grams){
 const t=teaspoons(grams);
 if(t==null)return '';
 if(t<.25)return 'under ¼ tsp';
 const r=t<10?Math.round(t*2)/2:Math.round(t);
 return `${Number.isInteger(r)?r:r.toFixed(1)} tsp`;
}
export const percentRI=(key,amount)=>amount==null||!REFERENCE_INTAKE[key]?null:amount/REFERENCE_INTAKE[key]*100;
export const formatPercent=v=>v==null?'—':v<1&&v>0?'<1%':`${Math.round(v)}%`;

/* ---------- traffic lights ---------- */
/** FSA color band for one nutrient. low: <= low threshold, high: > high threshold. */
export function lightLevel(value,[low,high]){
 if(value==null)return null;
 if(value<=low)return 'low';
 return value>high?'high':'medium';
}
export function trafficLights(p){
 const bad=new Set(nutrientConflicts(p)),drink=p.basis==='ml';
 const items=LIGHT_RULES.map(rule=>{
  const value=valuePer100(p,rule.key),conflict=bad.has(rule.key)||(rule.key==='salt'&&bad.has('sodium'));
  const thresholds=drink?rule.drink:rule.food;
  const level=!p.basis||conflict?null:lightLevel(value,thresholds);
  return {key:rule.key,label:rule.label,noun:rule.noun,value:conflict?null:value,level,conflict,thresholds,unit:'g',
   reason:!p.basis?'basis':conflict?'conflict':value==null?'missing':''};
 });
 return {basis:p.basis||null,items,known:items.filter(x=>x.level).length};
}
export const lightWord={low:'Low',medium:'Medium',high:'High'};

/* ---------- nutrition-claim thresholds (EU 1924/2006) ---------- */
export function proteinEnergyShare(p){
 const protein=p.nutrition?.protein,kcal=p.nutrition?.kcal;
 if(protein==null||kcal==null||kcal<5)return null;
 return protein*4/kcal;
}
export function claims(p){
 const out=[],bad=new Set(nutrientConflicts(p)),fiber=p.nutrition?.fiber;
 if(p.basis==='g'&&fiber!=null&&!bad.has('fiber')){
  if(fiber>=6)out.push({key:'fiber',level:'high',text:'High in fiber',detail:`${formatNumber(fiber)} g per 100 g`,why:'EU rules allow a "high fiber" claim at 6 g or more per 100 g.'});
  else if(fiber>=3)out.push({key:'fiber',level:'source',text:'Source of fiber',detail:`${formatNumber(fiber)} g per 100 g`,why:'EU rules allow a "source of fiber" claim at 3 g or more per 100 g.'});
 }
 const share=bad.has('protein')||bad.has('kcal')?null:proteinEnergyShare(p);
 if(share!=null){
  const pct=Math.round(share*100);
  if(share>=.2)out.push({key:'protein',level:'high',text:'High in protein',detail:`${pct}% of its energy`,why:'EU rules allow a "high protein" claim when protein provides at least 20% of the energy.'});
  else if(share>=.12)out.push({key:'protein',level:'source',text:'Source of protein',detail:`${pct}% of its energy`,why:'EU rules allow a "source of protein" claim when protein provides at least 12% of the energy.'});
 }
 return out;
}

/* ---------- composition: what is in 100 g? ---------- */
export function composition(p){
 const n=p.nutrition||{},bad=new Set(nutrientConflicts(p));
 const get=k=>n[k]==null||bad.has(k)?null:n[k];
 const sugars=get('sugars'),carbs=get('carbohydrates'),fat=get('fat'),protein=get('protein'),fiber=get('fiber');
 const parts=[];
 if(sugars!=null)parts.push({key:'sugars',label:'Sugars',value:sugars});
 if(carbs!=null&&sugars!=null&&carbs-sugars>=.5)parts.push({key:'starch',label:'Other carbs',value:carbs-sugars});
 else if(carbs!=null&&sugars==null)parts.push({key:'carbs',label:'Carbohydrate',value:carbs});
 if(fat!=null)parts.push({key:'fat',label:'Fat',value:fat});
 if(protein!=null)parts.push({key:'protein',label:'Protein',value:protein});
 let sum=parts.reduce((a,x)=>a+x.value,0);
 if(fiber!=null&&sum+fiber<=100)parts.push({key:'fiber',label:'Fiber',value:fiber}),sum+=fiber;
 if(!parts.length||sum>100.5||!p.basis)return null;
 const rest=Math.max(0,100-sum);
 if(rest>=.5)parts.push({key:'rest',label:'Water & other',value:rest});
 const missing=['sugars','carbohydrates','fat','protein'].filter(k=>get(k)==null);
 return {parts:parts.filter(x=>x.value>0),missing,basisUnit:unitWord(p),complete:!missing.length};
}


/* ---------- allergen cross-check ---------- */
/** Words that signal an allergen in ingredient text, keyed by the source's allergen tag (tags are stored without "en:" and with spaces). */
const ALLERGEN_TERMS=[
 ['milk',/\b(milk|whey|casein|caseinate|lactose)\b/],
 ['eggs',/\b(eggs?|albumen)\b/],
 ['gluten',/\b(wheat|rye|barley|oats?|spelt|kamut|semolina|malt)\b/],
 ['nuts',/\b(almonds?|hazelnuts?|walnuts?|cashews?|pecans?|pistachios?|macadamia|brazil nuts?)\b/],
 ['peanuts',/\b(peanuts?|groundnuts?|arachis)\b/],
 ['soybeans',/\b(soy|soya|soja|soybeans?)\b/],
 ['fish',/\b(fish|anchov(?:y|ies)|salmon|tuna)\b/],
 ['crustaceans',/\b(shrimps?|prawns?|crab|lobster|crayfish)\b/],
 ['sesame seeds',/\b(sesame|tahini)\b/],
 ['celery',/\b(celery|celeriac)\b/],
 ['mustard',/\bmustard\b/],
 ['lupin',/\blupin\b/]
];
const PLANT_MILK=/\b(coconut|almond|oat|soy|soya|soja|rice|cashew|hazelnut|pea|plant|nut)\s+(milk|drink)\b/g;
/** Allergens the ingredient text mentions that the record's allergen tags do not declare. Community data can lag the pack. */
export function allergenGaps(p){
 const text=String(p.ingredients||'').toLowerCase().replace(/[_<>()]/g,' ').replace(PLANT_MILK,' ');
 if(!text.trim())return [];
 const declared=new Set((p.allergens||[]).map(x=>String(x).toLowerCase()));
 return ALLERGEN_TERMS.filter(([tag,re])=>re.test(text)&&!declared.has(tag)&&!(tag==='nuts'&&declared.has('tree nuts'))).map(([tag])=>tag==='soybeans'?'soy':tag);
}

/* ---------- quick read ---------- */
const joinList=a=>a.length<2?a.join(''):`${a.slice(0,-1).join(', ')} and ${a.at(-1)}`;
function lightChip(item,p){
 const unit=unitWord(p),[,high]=item.thresholds,value=item.value,name=item.noun;
 let detail=`${formatNumber(value)} g per 100 ${unit}`;
 if(item.key==='sugars')detail+=` · about ${formatTsp(value)}`;
 if(item.key==='salt')detail+=` · ${formatPercent(percentRI('salt',value))} of the 6 g daily guide`;
 const extra=item.key==='sugars'?' Total sugars include naturally occurring sugars such as those in fruit or milk.':item.key==='salt'?' Salt is sodium x 2.5.':'';
 return {id:item.key,tone:'red',icon:'alert',title:`High in ${name}`,detail,
  why:`More than ${formatNumber(high)} g per 100 ${unit} counts as "high" in the UK front-of-pack color standard. This product has ${formatNumber(value)} g.${extra} A per-portion view is further down this page.`};
}
/** Ordered, de-duplicated plain-English observations. At most 7. */
export function quickRead(p){
 const out=[],lights=trafficLights(p);
 if(p.allergens?.length)out.push({id:'allergens',tone:'amber',icon:'alert',title:`Contains ${joinList(p.allergens.slice(0,6))}`,detail:'Declared allergens in the record',
  why:'These allergens are declared in the source record. Always check the current package: formulas change and records can lag behind.'});
 const gaps=allergenGaps(p);
 if(gaps.length)out.push({id:'allergen-gap',tone:'amber',icon:'alert',title:`Ingredients also mention ${joinList(gaps)}`,detail:'Not in the declared allergen tags',
  why:'The ingredient text includes words linked to these allergens, but the record\'s allergen tags do not list them. Community data can lag behind the pack, so check the physical label.'});
 if(p.traces?.length)out.push({id:'traces',tone:'info',icon:'info',title:`May contain ${joinList(p.traces.slice(0,5))}`,detail:'Possible traces',
  why:'Precautionary "may contain" warnings are voluntary in many countries, so their absence is not proof of safety.'});
 for(const item of lights.items)if(item.level==='high')out.push(lightChip(item,p));
 const nova=NOVA_INFO[p.nova];
 if(nova&&p.nova===4)out.push({id:'nova',tone:'amber',icon:'info',title:'Ultra-processed (NOVA 4)',detail:'Industrial formulation',
  why:'NOVA groups foods by how industrially they are made. Group 4 usually includes ingredients rarely used in home cooking, such as emulsifiers, flavorings or sweeteners. It describes processing, not the amount of any nutrient, and is not a safety rating.'});
 else if(nova&&p.nova===1)out.push({id:'nova',tone:'green',icon:'leaf',title:'Minimally processed (NOVA 1)',detail:'Close to how it grows',
  why:'NOVA group 1 covers unprocessed or minimally processed foods such as plain grains, pasta, milk, eggs, fruit and vegetables.'});
 const lows=lights.items.filter(x=>x.level==='low'&&x.value!=null);
 if(lows.length>=2)out.push({id:'lows',tone:'green',icon:'check',title:`Low in ${joinList(lows.map(x=>x.noun))}`,detail:`Per 100 ${unitWord(p)}`,
  why:`"Low" means at or under the UK front-of-pack thresholds (fat ${lights.basis==='ml'?'1.5':'3'} g, saturated fat ${lights.basis==='ml'?'0.75':'1.5'} g, sugars ${lights.basis==='ml'?'2.5':'5'} g, salt 0.3 g per 100 ${unitWord(p)}).`});
 else for(const x of lows)out.push({id:`low-${x.key}`,tone:'green',icon:'check',title:`Low in ${x.noun}`,detail:`${formatNumber(x.value)} g per 100 ${unitWord(p)}`,
  why:`At or under ${formatNumber(x.thresholds[0])} g per 100 ${unitWord(p)}, the UK front-of-pack "low" band.`});
 for(const c of claims(p))out.push({id:`claim-${c.key}`,tone:'green',icon:'leaf',title:c.text,detail:c.detail,why:c.why});
 if(p.additivesCount>0)out.push({id:'additives',tone:'info',icon:'info',title:`${p.additivesCount} additive${p.additivesCount===1?'':'s'} listed`,detail:'Source-reported count',
  why:'A count only. Additives do very different jobs (preservation, color, texture) and the number is not a safety rating.'});
 if(lights.basis&&lights.known<4){
  const gaps=lights.items.filter(x=>!x.level).map(x=>x.noun);
  out.push({id:'gaps',tone:'info',icon:'info',title:'Some facts are missing',detail:`No usable ${joinList(gaps)}`,
   why:'The source record lacks some values or they contradict each other. Missing numbers are never treated as zero or as a pass.'});
 }else if(!lights.basis)out.push({id:'basis',tone:'info',icon:'info',title:'Per-100 basis not reported',detail:'Color bands paused',
  why:'The record does not say whether values are per 100 g or per 100 ml, so color bands are withheld rather than guessed.'});
 return out.slice(0,7);
}

/* ---------- portions ---------- */
const TO_BASE={g:1,kg:1000,ml:1,cl:10,dl:100,l:1000};
/** Parse "400 g", "1 l", "6 x 330 ml" into a pack total in the product's basis unit. */
export function packSize(p){
 const text=String(p.quantity||'').toLowerCase().replace(',','.');
 const multi=text.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|dl|l)\b/);
 const single=text.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|dl|l)\b/);
 const m=multi||single;
 if(!m)return null;
 const [count,amount,unit]=multi?[Number(m[1]),Number(m[2]),m[3]]:[1,Number(m[1]),m[2]];
 const baseUnit=['ml','cl','dl','l'].includes(unit)?'ml':'g';
 const total=count*amount*TO_BASE[unit];
 if(!Number.isFinite(total)||total<=0||total>5000||(p.basis&&p.basis!==baseUnit))return null;
 return {amount:total,unit:baseUnit,text:p.quantity,unitAmount:multi?amount*TO_BASE[unit]:null,count};
}
export function portionPlan(p){
 const unit=p.basis||p.servingUnit||packSize(p)?.unit||'g';
 const serving=p.servingAmount>0&&(!p.basis||p.servingUnit===p.basis)&&p.servingAmount<=2000?{amount:p.servingAmount,label:p.serving||`${formatNumber(p.servingAmount)} ${unit}`}:null;
 const pack=packSize(p);
 const choices=[];
 if(serving)choices.push({id:'serving',amount:serving.amount,label:'1 serving',hint:serving.label});
 choices.push({id:'100',amount:100,label:`100 ${unit}`,hint:'Label basis'});
 if(pack&&pack.unit===unit){
  if(pack.count>1&&pack.unitAmount)choices.push({id:'unit',amount:pack.unitAmount,label:'1 unit',hint:`${formatNumber(pack.unitAmount)} ${unit}`});
  choices.push({id:'pack',amount:pack.amount,label:'Whole pack',hint:`${formatNumber(pack.amount)} ${unit}`});
 }
 const max=Math.min(2000,Math.max(500,Math.ceil((pack?.amount||0)/50)*50));
 return {unit,choices,start:serving?.amount||100,min:5,max};
}
/** Per-portion values scaled from the per-100 record. Conflicting values stay null. */
export function portionFacts(p,amount){
 const bad=new Set(nutrientConflicts(p));
 const scale=v=>v==null||!Number.isFinite(amount)?null:v*amount/100;
 const get=key=>bad.has(key)||(key==='salt'&&bad.has('sodium'))?null:scale(valuePer100(p,key));
 return Object.fromEntries(['kcal','protein','carbohydrates','sugars','fat','saturatedFat','fiber','salt'].map(k=>[k,get(k)]));
}

/* ---------- basket ---------- */
export function basketSummary(products){
 const list=products.filter(Boolean),grades={A:0,B:0,C:0,D:0,E:0,none:0};
 const high={sugars:0,saturatedFat:0,salt:0,fat:0};
 let ultra=0,scored=0;
 for(const p of list){
  if(p.nutriScore&&grades[p.nutriScore]!=null){grades[p.nutriScore]++;scored++;}else grades.none++;
  if(p.nova===4)ultra++;
  for(const item of trafficLights(p).items)if(item.level==='high')high[item.key]++;
 }
 const goodShare=scored?(grades.A+grades.B)/scored:null;
 return {count:list.length,scored,grades,ultra,high,goodShare};
}

/* ---------- better choices ---------- */
const METRIC={
 sugars:{label:'sugars',dir:'lower',unit:'g',min:1},
 saturatedFat:{label:'saturated fat',dir:'lower',unit:'g',min:.5},
 salt:{label:'salt',dir:'lower',unit:'g',min:.1},
 fat:{label:'fat',dir:'lower',unit:'g',min:1},
 protein:{label:'protein',dir:'higher',unit:'g',min:1},
 fiber:{label:'fiber',dir:'higher',unit:'g',min:.5}
};
const PRIORITY_METRIC={sugars:'sugars',protein:'protein',fiber:'fiber',sodium:'salt',satfat:'saturatedFat'};
const GRADES='ABCDE';
/** Valid, canonical English category tags, most specific last. Skips user-typed junk like "de:Other". */
export function usableCategories(p){
 return (p.categories||[]).filter(c=>/^en:[a-z0-9][a-z0-9-]{1,100}$/.test(c));
}
/** Which nutrients to compare, and why. Profile priorities win; otherwise the product's own weak spots. */
export function swapMetrics(base,profileInput){
 const profile=normalizeProfile(profileInput);
 const chosen=[...new Set(profile.priorities.map(k=>PRIORITY_METRIC[k]).filter(Boolean))];
 if(chosen.length)return {keys:chosen,source:'profile',reason:`your priorities (${joinList(chosen.map(k=>METRIC[k].label))})`};
 const order=['sugars','saturatedFat','salt'];
 const keys=trafficLights(base).items.filter(x=>x.level==='high'||x.level==='medium').filter(x=>order.includes(x.key))
  .sort((a,b)=>(b.level==='high')-(a.level==='high')||order.indexOf(a.key)-order.indexOf(b.key)).map(x=>x.key);
 if(keys.length)return {keys,source:'product',reason:`what is highest in this product (${joinList(keys.map(k=>METRIC[k].label))})`};
 return {keys:[],source:'none',reason:''};
}
/** Is a swap search worth offering for this product? */
export function swapsWorthOffering(base,profile){
 if(!base||base.provenance==='local'||!base.basis||!usableCategories(base).length)return false;
 const metrics=swapMetrics(base,profile);
 if(!metrics.keys.length)return false;
 if(metrics.source==='profile')return true;
 const grade=GRADES.indexOf(base.nutriScore||'');
 return grade>=2||trafficLights(base).items.some(x=>x.level==='high');
}
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const sameThing=(a,b)=>{
 const na=norm(a.name),nb=norm(b.name);
 if(!na||na!==nb)return false;
 const ba=norm(a.brand).split(' ')[0],bb=norm(b.brand).split(' ')[0];
 return !ba||!bb||ba===bb;
};
export function betterChoices(base,candidates,profileInput,category){
 const profile=normalizeProfile(profileInput),plan=swapMetrics(base,profile);
 if(!plan.keys.length||!base.basis)return {items:[],plan};
 const baseBad=new Set(nutrientConflicts(base));
 if(plan.keys.some(k=>baseBad.has(k)||(k==='salt'&&baseBad.has('sodium'))||valuePer100(base,k)==null))return {items:[],plan};
 const seen=[],items=[];
 for(const [index,p] of candidates.entries()){
  if(!p||p.barcode===base.barcode||p.basis!==base.basis||p.provenance==='local'||p.qualityWarnings?.length||base.qualityWarnings?.length)continue;
  if(category&&!p.categories?.includes(category))continue;
  if(sameThing(base,p)||seen.some(s=>sameThing(s,p)))continue;
  if(!eligibility(p,profile).allowed||assess(p,profile).cautions)continue;
  if(base.nutriScore&&p.nutriScore&&GRADES.indexOf(p.nutriScore)>GRADES.indexOf(base.nutriScore))continue;
  if(base.nova&&p.nova&&p.nova>base.nova)continue;
  const bad=new Set(nutrientConflicts(p)),deltas=[];
  let usable=true,worse=false;
  for(const key of plan.keys){
   const rule=METRIC[key],a=valuePer100(base,key),b=valuePer100(p,key);
   if(b==null||bad.has(key)||(key==='salt'&&bad.has('sodium'))){usable=false;break;}
   const gain=rule.dir==='lower'?a-b:b-a;
   if(gain<-.0001){worse=true;break;}
   if(gain>=Math.max(rule.min,a*.1))deltas.push({key,label:rule.label,from:a,to:b,gain,pct:a>0?gain/a:null,unit:rule.unit,dir:rule.dir});
  }
  if(!usable||worse||!deltas.length)continue;
  seen.push(p);
  items.push({product:p,deltas,index,gradeFrom:base.nutriScore||null,gradeTo:p.nutriScore||null,
   why:deltas.map(d=>`${d.dir==='lower'?'−':'+'}${formatNumber(d.gain)} g ${d.label} per 100 ${unitWord(base)}${d.pct!=null?` (${d.dir==='lower'?'−':'+'}${Math.round(d.pct*100)}%)`:''}`)});
 }
 items.sort((a,b)=>{
  const ga=a.gradeTo?GRADES.indexOf(a.gradeTo):9,gb=b.gradeTo?GRADES.indexOf(b.gradeTo):9;
  return ga-gb||b.deltas.length-a.deltas.length||(b.deltas.reduce((s,d)=>s+(d.pct||0),0)-a.deltas.reduce((s,d)=>s+(d.pct||0),0))||a.index-b.index;
 });
 return {items:items.slice(0,6),plan};
}

/* ---------- region ---------- */
const REGION={GB:'united-kingdom',UK:'united-kingdom',US:'united-states',FR:'france',DE:'germany',ES:'spain',IT:'italy',GR:'greece',PT:'portugal',NL:'netherlands',BE:'belgium',CH:'switzerland',AT:'austria',IE:'ireland',CA:'canada',AU:'australia',NZ:'new-zealand',SE:'sweden',NO:'norway',DK:'denmark',FI:'finland',PL:'poland',CZ:'czech-republic',SK:'slovakia',SI:'slovenia',HR:'croatia',RO:'romania',BG:'bulgaria',HU:'hungary',CY:'cyprus',MT:'malta',LU:'luxembourg',EE:'estonia',LV:'latvia',LT:'lithuania',TR:'turkey',IN:'india',BR:'brazil',MX:'mexico',AR:'argentina',ZA:'south-africa',JP:'japan',SG:'singapore',AE:'united-arab-emirates',SA:'saudi-arabia',IL:'israel'};
export const COUNTRIES=Object.entries(REGION).filter(([k])=>k!=='UK').map(([code,slug])=>({code,slug,name:slug.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ')})).sort((a,b)=>a.name.localeCompare(b.name));
export const countrySlug=code=>REGION[String(code||'').toUpperCase()]||'';
export function localeRegion(locale){
 try{return new Intl.Locale(locale).maximize().region||'';}catch{return '';}
}
/** The OFF country slug to filter swaps by: the shopper's own, if a choice is stored or detectable. */
export function swapCountry(settings,base){
 const code=settings?.country||localeRegion(settings?.locale||'');
 const slug=countrySlug(code);
 if(!slug)return '';
 // Only filter by a country the record is actually sold in; otherwise searching there would find nothing relevant.
 return !base?.countries?.length||base.countries.includes(`en:${slug}`)?slug:'';
}

/* ---------- daily wisdom ---------- */
export const TIPS=[
 ['Ingredients are listed by weight','The first ingredient is the biggest by weight. If sugar or oil leads the list, that is the main thing in the pack.'],
 ['Compare per 100 g, not per serving','Serving sizes are chosen by the maker. Per 100 g (or 100 ml) is the fair way to compare two products.'],
 ['4 g of sugar is about 1 teaspoon','A 330 ml can of regular cola holds roughly 35 g of sugar, close to 9 teaspoons.'],
 ['Salt is sodium times 2.5','US labels often list sodium, EU labels list salt. 400 mg of sodium is 1 g of salt.'],
 ['Sugar has many names','Glucose syrup, dextrose, maltose, fructose and concentrated fruit juice all count towards sugars.'],
 ['"Best before" is about quality','"Use by" is the safety date. Food past "best before" is usually safe but may have lost quality.'],
 ['Fiber claims have rules','In the EU, "source of fiber" needs 3 g per 100 g and "high fiber" needs 6 g.'],
 ['Protein claims have rules','"High protein" means at least 20% of the energy comes from protein. "Source of protein" is 12%.'],
 ['Free sugars and the WHO','The WHO suggests keeping free sugars under 10% of energy, about 50 g on a 2,000 kcal diet, and ideally under 5%.'],
 ['Honey and juice count as free sugars','Honey, syrups and fruit juices are counted as free sugars even though they feel natural.'],
 ['"May contain" is often voluntary','In many countries precautionary allergen warnings are voluntary, so no warning is not proof of absence.'],
 ['Nutri-Score is best used to compare like with like','Compare two breakfast cereals or two yogurts, not a cereal with an oil. Context matters.'],
 ['Fat is not one thing','Oils and nuts are high in fat but mostly unsaturated. Saturated fat is the number to watch on labels.'],
 ['Whole grain first is a good sign','If "wholemeal" or "whole grain" leads the ingredient list, there is more of it than anything else.'],
 ['Liquids use per 100 ml','The color bands for drinks are stricter than for solid food because people drink a lot of them.'],
 ['The reference intake is a guide','The 2,000 kcal adult reference on labels is a population guide, not a personal target.'],
 ['Fewer ingredients is not always better','A long list can be perfectly fine, and a short one can be mostly sugar. Look at the numbers too.'],
 ['Salt adds up fast','The WHO suggests under 5 g of salt a day. A single ready meal can supply a third of that.'],
 ['Check the unit on drinks','Plant milks and juices are labelled per 100 ml. A "250 ml glass" is 2.5 times the label numbers.'],
 ['Added sugar is not always listed','Some countries require "added sugars" on labels; many do not. Total sugars include milk and fruit sugars.'],
 ['Swap one thing at a time','Switching just your daily drink or breakfast spread usually does more than a big one-off overhaul.'],
 ['Ultra-processed is about how, not just what','NOVA group 4 flags industrial formulations. It is a processing label, not a verdict on one nutrient.'],
 ['Pack size changes the maths','A "single serving" snack bag can hold two servings on the label. Check the servings per pack.'],
 ['Plain is the easiest comparison','Unflavoured yogurt, plain oats and plain nuts make it easy to see how far flavoured versions go.']
];
export function tipOfTheDay(now=new Date()){
 const day=Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-Date.UTC(2026,0,1))/86400000);
 const [title,body]=TIPS[((day%TIPS.length)+TIPS.length)%TIPS.length];
 return {title,body};
}
