/** Do not cache or calculate from rejected community records. */
export * from '/assets/release-11.18.0/report-audit.js';
import {reportAudit as previous} from '/assets/release-11.18.0/report-audit.js';
import {sourceIntegrity} from './source-trust.js';
export function reportAudit(product){
 const result=previous(product),trust=sourceIntegrity(product);
 return {...result,trust:trust.status,safeToCalculate:result.safeToCalculate&&trust.canCalculate!==false&&trust.status!=='rejected',
  limited:result.limited||trust.status==='rejected'};
}
