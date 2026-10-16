export * from '/assets/release-11.3.0/lib/store.js?engine=11.10.0';
import {deleteStore as previousDelete} from '/assets/release-11.3.0/lib/store.js?engine=11.10.0';
import {clearPublicQueryCache} from './api.js';
export function deleteStore(storage){const error=previousDelete(storage);if(error)return error;return clearPublicQueryCache(storage);}
