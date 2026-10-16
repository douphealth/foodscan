import '/assets/release-11.14.1/app.js';
/** Product-photo fallback: only already-validated Open Food Facts front images. */
document.addEventListener('error',event=>{
 const img=event.target;
 if(!(img instanceof HTMLImageElement)||!img.matches('.fs16-product-photo'))return;
 let urls;try{urls=JSON.parse(img.dataset.fsImageUrls||'[]');}catch{urls=[];}
 const next=Number(img.dataset.fsImageIndex||0)+1;
 if(Array.isArray(urls)&&next<urls.length){
  img.dataset.fsImageIndex=String(next);
  img.src=urls[next];
  return;
 }
 img.hidden=true;
 const frame=img.closest('.fs16-photo-frame');
 if(frame&&!frame.querySelector('.fs16-photo-failed')){
  const note=document.createElement('span');note.className='fs16-photo-failed';
  note.textContent='Photo unavailable. Product facts remain available; check the package.';
  frame.prepend(note);
 }
},true);
