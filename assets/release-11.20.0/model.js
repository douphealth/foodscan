/** Preserve all trusted 11.18 parsing and 11.19 improvements; quarantine corrupted OFF records. */
export * from '/assets/release-11.19.0/model.js';
import {parseProduct as priorParse,validateStoredProduct as priorValidate} from '/assets/release-11.18.0/model.js';
import {enforceSourceIntegrity} from './source-trust.js';
export const VERSION='11.21.0';
export function parseProduct(payload,barcode,now){
 const product=priorParse(payload,barcode,now);
 return enforceSourceIntegrity(product,payload?.product||null);
}
export function validateStoredProduct(value){
 const product=priorValidate(value);
 return enforceSourceIntegrity(product);
}
