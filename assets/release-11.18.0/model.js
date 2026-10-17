/** FoodScan 11.18: keep the previous report exactly, strengthen source parsing. */
export * from '/assets/release-11.17.0/model.js';
import {parseProduct as sourceParse,validateStoredProduct as sourceStored} from './model-core.js';
import {reportedGrade,reportedNova} from '/assets/release-11.16.0/model.js';
import {reportAudit} from './report-audit.js';
export const VERSION='11.18.0';
const asUnit=value=>{
 const u=String(value??'').trim().toLowerCase();
 return ['g','kg','mg'].includes(u)?'g':['ml','cl','dl','l'].includes(u)?'ml':null;
};
const finish=p=>{
 if(!p)return null;
 p.reportCoverage=reportAudit(p).known;
 return p;
};
export function parseProduct(payload,barcode,now){
 const p=sourceParse(payload,barcode,now);
 if(!p)return null;
 const raw=payload?.product||{};
 p.nutriScore=reportedGrade(raw.nutriscore_grade,raw.nutrition_grades,p.nutriScore);
 p.nova=reportedNova(raw.nova_group,p.nova);
 if(!p.basis){
  const match=String(raw.quantity||'').trim().match(/(?:^|[\s(])\d+(?:[.,]\d+)?\s*(kg|mg|g|ml|cl|dl|l)(?:\s|$)/i);
  p.basis=asUnit(raw.product_quantity_unit)||(match?asUnit(match[1]):null);
 }
 return finish(p);
}
export function validateStoredProduct(value){
 const p=sourceStored(value);
 if(!p)return null;
 p.nutriScore=reportedGrade(value?.nutriScore,p.nutriScore);
 p.nova=reportedNova(value?.nova,p.nova);
 return finish(p);
}
