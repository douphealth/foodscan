import {productUseMatch,nutritionDistance,isSupplement} from './match-policy.mjs';
/** Discovery classification only. Never supplies categories to the grade calculator. */
export const FAMILY_LABELS=Object.freeze({bread:'Bread & wraps',yogurt:'Yogurt & kefir',milk:'Milk',cheese:'Cheese',cereal:'Breakfast cereals',bar:'Cereal & snack bars',biscuit:'Biscuits',cake:'Cakes',chocolate:'Chocolate',spread:'Sweet spreads',juice:'Juice',soda:'Soft drinks',water:'Water','plant-drink':'Plant drinks',dessert:'Dairy desserts','ice-cream':'Ice cream',pasta:'Pasta','rice-grain':'Rice & grains',sauce:'Sauces',pizza:'Pizza',meat:'Meat',fish:'Fish',soup:'Soups',fat:'Oils & fats',meal:'Prepared meals','dried-fruit':'Dried fruit',nut:'Nuts','legume-veg':'Legumes & vegetables',sweets:'Sweets','coffee-tea':'Coffee & tea','savoury-snack':'Savoury snacks'});
export const FAMILY_TAGS=Object.freeze({bread:'en:breads',yogurt:'en:yogurts',milk:'en:milks',cheese:'en:cheeses',cereal:'en:breakfast-cereals',bar:'en:cereal-bars',biscuit:'en:biscuits',cake:'en:cakes',chocolate:'en:chocolates',spread:'en:sweet-spreads',juice:'en:fruit-juices',soda:'en:sodas',water:'en:waters','plant-drink':'en:plant-based-milk-alternatives',dessert:'en:dairy-desserts','ice-cream':'en:ice-creams',pasta:'en:pastas','rice-grain':'en:rices',sauce:'en:sauces',pizza:'en:pizzas',meat:'en:meats',fish:'en:fishes',soup:'en:soups',fat:'en:vegetable-oils',meal:'en:meals','dried-fruit':'en:dried-fruits',nut:'en:nuts','legume-veg':'en:legumes',sweets:'en:candies','coffee-tea':'en:teas','savoury-snack':'en:salty-snacks'});
export const folded=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
// Specific names precede broad ones. These rules broaden discovery, not health claims.
const NAMES=[
 ['plant-drink',/(?:almond|oat|soya?|coconut|ρυζ|βρωμ|αμυγδαλ|σογια|καρυδ).*(?:drink|milk|ροφημα|γαλα)|(?:ροφημα|γαλα).*(?:αμυγδαλ|σογια|βρωμ|καρυδ)/],
 ['yogurt',/yogh?urt|kefir|κεφιρ|γιαουρ|γιαουρτι|skyr/],
 ['bread',/\bbread\b|tortillas?|\bwraps?\b|ψωμι|ψωμακι|παξιμαδ|φρυγανι|κριτσιν|κουλουρ|πιτες.*(?:σιταρι|ολικ)/],
 ['cheese',/\bcheese\b|\bfeta\b|mozzarella|parmesan|gouda|edam|τυρι|φετα|γραβιερα|μυζηθρα|κεφαλοτυρ/],
 ['cereal',/muesli|musli|granola|corn ?flakes|oat ?flakes|δημητριακ|νιφαδες.*βρωμ/],
 ['bar',/(?:cereal|protein|oat|snack).*\bbar\b|μπαρα/],
 ['spread',/spread|peanut butter|nutella|φυστικοβουτυρ|ταχινι|μαρμελαδ|πραλινα|αλειμμα/],
 ['biscuit',/biscuit|cookie|μπισκοτ/],['cake',/\bcake\b|muffin|croissant|κεικ|κρουασαν|τσουρεκι/],
 ['chocolate',/chocolat|σοκολατα/],['juice',/\bjuice\b|χυμος/],['soda',/\bcola\b|lemonade|αναψυκτικ|πορτοκαλαδα|λεμοναδα/],
 ['water',/\bwater\b|\bνερο\b|νερο /],['milk',/\bmilk\b|γαλα(?:\s|$)/],
 ['pasta',/spaghetti|penne|fusilli|macaroni|μακαρον|ζυμαρικ|σπαγγετι|πεννες/],
 ['rice-grain',/\brice\b|ρυζι/],['sauce',/ketchup|mustard|mayonnaise|sauce|κετσαπ|μουσταρδ|μαγιονεζ|σαλτσα/],
 ['savoury-snack',/\bchips\b|crisps|πατατακια|γαριδακια/],['nut',/\balmonds\b|\bwalnuts\b|\bcashews\b|αμυγδαλα|καρυδια|φιστικια/],
 ['ice-cream',/ice ?cream|παγωτο/]
];
const EXCLUDED=/protein powder|whey powder|βρεφ|infant|baby food|supplement|συμπληρωμα|pet food|dog food|cat food|shampoo|perfume|απορρυπαν|σαμπουαν/;
const INGREDIENT=/\bflour\b|\bsemolina\b|αλευρι|σιμιγδαλι|σιμογδαλι/;
export function discoveryFamily(product,legacyFamily=()=>'',explicit=''){
 const text=folded(product?.name),tags=(product?.categories||[]).join(' ');
 if(isSupplement(product)||EXCLUDED.test(text)||/en:(?:baby-foods|infant-formula|dietary-supplements|pet-foods|non-food-products)(?: |$)/.test(tags))return '';
 if(INGREDIENT.test(text)&&!/(?:bread|cake|ψωμι|κεικ|wrap|tortilla)/.test(text))return '';
 if(explicit&&FAMILY_LABELS[explicit]&&!legacyFamily(product))return explicit;
 if(/(?:chicken|tuna|ham|beef|κοτοπουλ|τονο|ζαμπον).*(?:wrap|sandwich|τορτιγια)|(?:wrap|sandwich|τορτιγια).*(?:chicken|tuna|ham|beef|κοτοπουλ|τονο|ζαμπον)/.test(text))return 'meal';
 if(/\bpizza\b|πιτσα/.test(text))return 'pizza';
 if(/ice ?cream|παγωτο/.test(text))return 'ice-cream';
 if(/rice[- ]cakes?|corn[- ]cakes?|\bgrissini\b|\bpopcorn\b|\bnachos\b|ρυζογκοφρετ/.test(text))return 'savoury-snack';
 if(/caponata|\bcurry\b|\brisotto\b|(?:chicken|beef|pork|turkey|κοτοπουλ).{0,35}(?:with|&|με ).{0,25}(?:rice|pasta|potato|noodle|ρυζ|ζυμαρ)/.test(text))return 'meal';
 const known=legacyFamily(product);
 if(known&&FAMILY_LABELS[known])return known;
 const hit=NAMES.find(([,pattern])=>pattern.test(text));
 return hit?.[0]||'';
}
function form(product){
 const s=folded(product?.name)+' '+(product?.categories||[]).join(' ');
 if(/\btortilla|\bwraps?\b/.test(s))return 'wrap';
 if(/crispbread|\brusks?\b|φρυγανι|παξιμαδ|breadsticks|κριτσιν/.test(s))return 'dry-bread';
 if(/\bbread\b|ψωμι|ψωμακι/.test(s))return 'bread';
 if(/kefir|κεφιρ|drinking-yogurt/.test(s))return 'kefir';
 if(/yogh?urt|γιαουρ|skyr/.test(s))return 'yogurt';
 return '';
}
// Sweet bakery families: a savoury cracker filed under "biscuits" (chickpea flour, salt, 1 g sugars) is not a substitute for a 30 g-sugar cookie.
const SWEET_BAKERY=new Set(['biscuit','cake']);
function tasteMismatch(family,base,product){
 if(!SWEET_BAKERY.has(family))return false;
 const a=base?.nutrition?.sugars,b=product?.nutrition?.sugars;
 return typeof a==='number'&&Number.isFinite(a)&&typeof b==='number'&&Number.isFinite(b)&&a>=12&&b<=3;
}
export function compatibleFoods(base,product,legacyFamily,explicit=''){
 const a=discoveryFamily(base,legacyFamily,explicit),b=discoveryFamily(product,legacyFamily);
 if(!a||!b||a!==b)return false;
 if(base?.basis&&product?.basis&&base.basis!==product.basis)return false;
 if(tasteMismatch(a,base,product))return false;
 if(['bread','yogurt'].includes(a)){const x=form(base)||a,y=form(product)||b;if(x!==y)return false;}
 return productUseMatch(base,product,a).ok;
}
export function cataloguePlan(base,legacyPlan,legacyFamily,explicit=''){
 const original=legacyPlan(base),family=discoveryFamily(base,legacyFamily,explicit);
 const tag=FAMILY_TAGS[family];
 const candidates=tag?[...(original.candidates||[]).filter(x=>x.tag!==tag),{tag,label:FAMILY_LABELS[family],family:true}]:(original.candidates||[]);
 return {...original,candidates,family:family||null,categorySelected:!!explicit,
  discoveryBasis:explicit?'selected':family&&!legacyFamily(base)?'name':original.basis,
  needsCategory:!family};
}
// Recommendation-only review heuristic, not a new grade rule or a scientific
// minimum. Very low-energy bread/wrap records may have a serving/unit entry error.
// Withhold them from recommendations pending label review; never rescale values.
export function sourceEvidenceIssues(product){
 const n=product?.nutrition||{},s=folded(product?.name)+' '+(product?.categories||[]).join(' ');
 const bread=/\bbread\b|\btortilla|\bwraps?\b|\u03c8\u03c9\u03bc|en:(?:breads|wheat-breads|wholemeal-breads|toast-breads|tortillas)/.test(s);
 return bread&&product?.basis==='g'&&typeof n.kcal==='number'&&Number.isFinite(n.kcal)&&n.kcal>=0&&n.kcal<50?['bread-energy-needs-label-review']:[];
}
export function comparisonKey(product){return folded(`${product.brand||''}|${product.name||''}`).replace(/\b\d+[.,]?\d*\s*(?:g|kg|ml|l)\b/g,'').trim();}
export function comparisonFoods(base,candidates,profile,{sameFood,assess,profileCheck},limit=3){
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const keys=['sugars','saturatedFat','salt'];
 const restricted=!!(profile?.avoids?.length||profile?.diet&&profile.diet!=='none');
 if(assess(base).status==='withheld'||sourceEvidenceIssues(base).length)return [];
 const all=candidates.filter(p=>p&&!p.nameMissing&&sameFood(base,p)&&p.basis&&p.basis===base.basis&&p.basisSource!=='assumed'&&!p.partial&&assess(p).status!=='withheld'&&!sourceEvidenceIssues(p).length&&keys.filter(k=>finite(p.nutrition?.[k])).length>=2&&(!restricted||(p.ingredients?.trim()&&['clear','none'].includes(profileCheck(p,profile).status))));
 const seen=new Set([comparisonKey(base)]);
 return all.sort((a,b)=>{
  const overlap=p=>(p.categories||[]).filter(c=>(base.categories||[]).includes(c)).length;
  return overlap(b)-overlap(a)||nutritionDistance(base,a)-nutritionDistance(base,b)||String(a.barcode).localeCompare(String(b.barcode));
 }).filter(p=>{const key=comparisonKey(p);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit).map(product=>({product,basis:product.basis,kind:'comparison'}));
}
