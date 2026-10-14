/** Private label evidence in IndexedDB. Never uploaded or used as machine-verified nutrition. */
const DB='foodscan-private-photos-v1';let connection;
function database(){if(connection)return connection;connection=new Promise((resolve,reject)=>{
 if(!globalThis.indexedDB){reject(Error('Private photo storage is unavailable in this browser.'));return;}
 let done=false;const timer=setTimeout(()=>{done=true;reject(Error('Private photo storage did not open. Close older FoodScan tabs and retry.'));},5000);
 const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('photos'))r.result.createObjectStore('photos',{keyPath:'barcode'});};
 r.onsuccess=()=>{clearTimeout(timer);if(done){r.result.close();return;}const db=r.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
 r.onerror=r.onblocked=()=>{clearTimeout(timer);done=true;reject(Error('Your browser blocked private photo storage. Close older tabs or check site storage permissions.'));};
 });connection.catch(()=>{connection=null;});return connection;}
export async function savePhoto(barcode,file){
 if(!file||!/^image\/(?:jpeg|png|webp)$/.test(file.type)||file.size>10_000_000)throw Error('Choose a JPG, PNG or WebP label photo smaller than 10 MB.');
 const db=await database();const count=await new Promise((resolve,reject)=>{const req=db.transaction('photos').objectStore('photos').count();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('Photo storage could not be read.'));});
 if(count>=30&&!await getPhoto(barcode))throw Error('You have 30 private label photos. Delete an old photo first.');
 // Keep a small on-device copy. No OCR or inferred nutrition is performed.
 const bitmap=await createImageBitmap(file),ratio=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));if(!blob)throw Error('The photo could not be saved.');
 await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put({barcode,blob,createdAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Private photo storage is full or blocked.'));tx.onabort=()=>reject(Error('The photo save was interrupted.'));});
}
export async function getPhoto(barcode){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('photos').objectStore('photos').get(barcode);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(Error('The photo could not be read.'));});}
export async function deletePhoto(barcode){const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(barcode);tx.oncomplete=resolve;tx.onerror=()=>reject(Error('The photo could not be deleted.'));});}
export async function clearPhotos(){const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Private photos could not be cleared.'));});}
