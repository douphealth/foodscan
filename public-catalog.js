/* FoodScan 55 public facts UX: private-by-default, no accounts and no user scan payloads. */
(()=>{
  'use strict';
  const node=document.getElementById('fsc-metadata');if(!node)return;
  const code=node.dataset.barcode,href=node.dataset.url,name=node.dataset.name;
  const status=document.getElementById('fsc-status');
  const privacy=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
  const tokenPattern=/^f[a-z0-9]{11}$/;
  const ref=new URLSearchParams(location.search).get('ref');
  const referral=tokenPattern.test(ref||'')?ref:'';
  const random=(length)=>{const b=crypto.getRandomValues(new Uint8Array(length));return 'f'+Array.from(b,v=>(v%36).toString(36)).join('');};
  const report=(event,method,token='',parent='')=>{
    if(privacy())return;
    const viral=['public_shared_open','public_shared_scan_cta','product_share_started','product_share_handoff','product_link_copied'].includes(event);
    if(viral&&!tokenPattern.test(token))return;
    const properties={source:'catalog',route:'product',method:method||'view',...(viral?{referral:token,...(tokenPattern.test(parent)?{parent}:{})}:{})};
    const data={name:event,properties,version:'55.0.0',path:'/products',...(viral?{eventId:random(15)}:{})};
    const body=JSON.stringify(data);
    if(navigator.sendBeacon)navigator.sendBeacon('/api/events',new Blob([body],{type:'application/json'}));
    else fetch('/api/events',{method:'POST',body,headers:{'Content-Type':'application/json'},keepalive:true,credentials:'same-origin'}).catch(()=>{});
  };
  const notify=(message)=>{if(status)status.textContent=message;};
  report('public_product_view','view');
  if(referral){const once='fsc-open-'+code+'-'+referral;if(!sessionStorage.getItem(once)){sessionStorage.setItem(once,'1');report('public_shared_open','visit',referral);}}
  function shareLink(){const u=new URL(href,location.origin);const t=random(11);u.searchParams.set('ref',t);return {url:u.href,token:t};}
  document.getElementById('fsc-share')?.addEventListener('click',async()=>{
    const share=shareLink();report('product_share_started','public',share.token,referral);
    try{
      if(navigator.share){await navigator.share({title:`${name} · FoodScan`,text:'Source-reported food facts. Check your own food free.',url:share.url});notify('Share sheet completed.');report('product_share_handoff','native',share.token,referral);report('public_product_share','native');return;}
      if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(share.url);notify('Product link copied.');report('product_link_copied','copy',share.token,referral);report('public_product_share','copy');return;}
      notify(`Copy this product link: ${share.url}`);
    }catch(error){if(error?.name!=='AbortError')notify(`Copy this product link: ${share.url}`);}
  });
  async function renderStory(){
    const response=await fetch(`/scorecards/${encodeURIComponent(code)}.svg`,{credentials:'same-origin'});
    if(!response.ok)throw Error('story_unavailable');
    const obj=URL.createObjectURL(await response.blob());
    try{
      const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=obj;});
      const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('canvas_unavailable');ctx.drawImage(image,0,0,1080,1920);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw Error('png_unavailable');return blob;
    }finally{URL.revokeObjectURL(obj);}
  }
  const download=document.getElementById('fsc-story');
  download?.addEventListener('click',async()=>{
    if(download.disabled)return;download.disabled=true;notify('Preparing a source-backed story card...');
    try{
      const png=await renderStory(),url=URL.createObjectURL(png);const a=document.createElement('a');a.href=url;a.download=`foodscan-${code}-story.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      notify('Story card prepared as PNG.');report('public_scorecard_download','png');
    }catch{
      notify('PNG export is not supported here. Open the SVG version instead.');
      const a=document.createElement('a');a.href=`/scorecards/${code}.svg`;a.textContent='Open story card';a.target='_blank';a.rel='noopener';status?.append(' ',a);
    }finally{download.disabled=false;}
  });
  // Native file handoff, with PNG fallback via the existing Download action.
  const shareImage=document.getElementById('fsc-share-image');
  shareImage?.addEventListener('click',async()=>{
    if(shareImage.disabled)return;shareImage.disabled=true;notify('Preparing a shareable image...');
    try{
      const png=await renderStory(),file=new File([png],`foodscan-${code}.png`,{type:'image/png'});
      if(!navigator.canShare?.({files:[file]})||!navigator.share){notify('Image sharing is unavailable in this browser. Use Download story card.');return;}
      await navigator.share({files:[file],title:`${name} · FoodScan`,text:'Check the source-reported facts on FoodScan.'});
      notify('Image share sheet completed.');report('public_product_share','image');
    }catch(error){if(error?.name!=='AbortError')notify('Could not share this image. Try downloading it instead.');}
    finally{shareImage.disabled=false;}
  });
  document.querySelectorAll('[data-fsc-event="public_scan_cta"]').forEach(a=>a.addEventListener('click',()=>{
    report('public_scan_cta','click');
    if(referral){report('public_shared_scan_cta','click',referral);a.href=`/?ref=${encodeURIComponent(referral)}#/scan`;}
  }));
})();
