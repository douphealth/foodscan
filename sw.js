/* FoodScan 11.1.0 offline app shell: versioned cache and verified app assets.
 * No API or profile data is ever cached here. Public product images are bounded and optional. */
const CACHE='foodscan-shell-11.3.0';
const IMAGES='foodscan-images-v1', IMAGE_LIMIT=48, IMAGE_BYTES=2*1024*1024, IMAGE_AGE=7*86400000;
const PRECACHE=["/","/index.html","/manifest.webmanifest","/art/produce.webp","/icon.svg","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/assets/release-11.3.0/app.css","/assets/release-11.3.0/lib/ingredient-parser.js","/assets/release-11.3.0/lib/meal-diary.js","/assets/release-11.3.0/app.js","/assets/release-11.3.0/boot.js","/assets/release-11.3.0/lib/api.js","/assets/release-11.3.0/lib/art.js","/assets/release-11.3.0/lib/barcode.js","/assets/release-11.3.0/lib/commerce.js","/assets/release-11.3.0/lib/components.js","/assets/release-11.3.0/lib/connection-view.js","/assets/release-11.3.0/lib/decision-ui.js","/assets/release-11.3.0/lib/decision.js","/assets/release-11.3.0/lib/demo.js","/assets/release-11.3.0/lib/features.js","/assets/release-11.3.0/lib/grocery-ui.js","/assets/release-11.3.0/lib/grocery.js","/assets/release-11.3.0/lib/icons.js","/assets/release-11.3.0/lib/model.js","/assets/release-11.3.0/lib/nutrition.js","/assets/release-11.3.0/lib/photos.js","/assets/release-11.3.0/lib/policy.js","/assets/release-11.3.0/lib/profile.js","/assets/release-11.3.0/lib/scanner.js","/assets/release-11.3.0/lib/share.js","/assets/release-11.3.0/lib/store.js","/assets/release-11.3.0/lib/swaps.js","/assets/release-11.3.0/lib/today.js","/assets/release-11.3.0/lib/transactions.js","/assets/release-11.3.0/lib/views.js"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)));});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>(key.startsWith('foodscan-shell-')||key==='foodscan-v1')&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})());});
async function image(request){
 const cache=await caches.open(IMAGES),cached=await cache.match(request.url);
 if(cached&&Date.now()-Number(cached.headers.get('x-foodscan-cached-at'))<IMAGE_AGE)return cached;
 try{
  const response=await fetch(new Request(request.url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'}));
  if(!response.ok||!/^image\/(?:jpeg|png|webp|avif)/i.test(response.headers.get('content-type')||''))return response;
  const length=Number(response.headers.get('content-length'));if(length>IMAGE_BYTES)return response;
  const blob=await response.clone().blob();if(blob.size>IMAGE_BYTES)return response;
  const headers=new Headers(response.headers);headers.set('x-foodscan-cached-at',String(Date.now()));
  await cache.put(request.url,new Response(blob,{status:200,headers}));const keys=await cache.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-IMAGE_LIMIT)).map(key=>cache.delete(key)));return response;
 }catch{if(cached)return cached;return fetch(request);}
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET')return;
 if(url.protocol==='https:'&&['images.openfoodfacts.org','static.openfoodfacts.org'].includes(url.hostname)&&request.destination==='image'){
  event.respondWith(image(request).catch(()=>fetch(request)));return;
 }
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){event.respondWith((async()=>{try{return await fetch(request);}catch{return await (await caches.open(CACHE).then(c=>c.match('/index.html')))||new Response('You are offline. Reconnect and open FoodScan once to prepare offline access.',{status:503,headers:{'Content-Type':'text/plain'}});}})());return;}
 if(PRECACHE.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(cached=>cached||fetch(request)));
});
