/** FoodScan 11.17: explicit mass/volume evidence only; no beverage-to-mass guesses. */
export * from '/assets/release-11.16.0/model.js';
import {parseProduct as priorParse,validateStoredProduct as priorStored} from '/assets/release-11.16.0/model.js';
import {reportAudit} from './report-audit.js';
export const VERSION='11.17.0';
const supported=value=>/^(g|kg|mg|ml|cl|dl|l)$/i.test(String(value||'').trim());
function directUnit(raw){
 const v=String(raw||'').trim().toLowerCase();
 return ['g','kg','mg'].includes(v)?'g':['ml','cl','dl','l'].includes(v)?'ml':null;
}
export function parseProduct(payload,barcode,now){
 const parsed=priorParse(payload,barcode,now);if(!parsed)return null;
 const raw=payload?.product||{};
 // The original parser reads product_quantity_unit and "225 g" packaging text.
 // Occasionally OFF also sends only a standalone gram/ml serving.
 // A serving size is NOT a unit for the full product, so don't infer it.
 if(!parsed.basis){
  const fromQuantity=String(raw.quantity||'').trim().match(/(?:^|[\s(])\d+(?:[.,]\d+)?\s*(kg|mg|g|ml|cl|dl|l)(?:\s|$)/i);
  const unit=directUnit(raw.product_quantity_unit)||(fromQuantity?directUnit(fromQuantity[1]):null);
  if(unit)parsed.basis=unit;
 }
 parsed.reportCoverage=reportAudit(parsed).known;
 return parsed;
}
export function validateStoredProduct(value){
 const parsed=priorStored(value);if(!parsed)return null;
 parsed.reportCoverage=reportAudit(parsed).known;
 return parsed;
}
