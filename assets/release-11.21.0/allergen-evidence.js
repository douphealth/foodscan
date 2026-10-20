/**
 * FoodScan 11.21 | Source-aware allergen disclosure, not medical advice.
 * An absence of a database tag is never evidence that an allergen is absent.
 */
import {allergenGaps} from '/assets/release-11.3.0/lib/nutrition.js';
const clean=s=>String(s||'').trim().toLowerCase();
const unique=a=>[...new Set((Array.isArray(a)?a:[]).map(clean).filter(Boolean))];
export function allergenEvidence(product){
 const p=product||{};
 const declared=unique(p.allergens);
 const mayContain=unique(p.traces).filter(a=>!declared.includes(a));
 const textMentions=unique(allergenGaps(p));
 const unresolved=textMentions.filter(a=>!declared.includes(a));
 const unverified=p.provenance==='local'||p.partial===true||!String(p.ingredients||'').trim();
 return {
  declared,mayContain,unresolved,
  status:unresolved.length?'source-conflict':unverified?'incomplete':'source-reported',
  disclosure:unresolved.length
   ?'Ingredient-text terms conflict with or are missing from the source allergen tags. Treat this community entry as incomplete; check the package.'
   :unverified
    ?'The food record is incomplete. Missing allergen declarations do not mean the product is allergen-free.'
    :'These are community-reported allergen fields, not an independent safety check.',
  needsPackageCheck:true
 };
}
