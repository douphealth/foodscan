/* FoodScan 55 food battles: anonymous, explicit voting and privacy-respecting sharing. */
(()=>{
  'use strict';const node=document.getElementById('fsc-battle-data');if(!node)return;
  const a=node.dataset.a,b=node.dataset.b,url=node.dataset.link;
  const key=`fsc-voted-${a}-${b}`;
  const status=document.getElementById('fsc-battle-status'),tally=document.getElementById('fsc-tally');
  const privacy=()=>navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  const code=length=>'f'+Array.from(crypto.getRandomValues(new Uint8Array(length)),n=>(n%36).toString(36)).join('');
  const referral=new URLSearchParams(location.search).get('ref');
  const ref=/^f[a-z0-9]{11}$/.test(referral||'')?referral:'';
  function event(name,method,token=''){
    if(privacy())return;
    const viral=['public_shared_open','public_shared_scan_cta'].includes(name);
    if(viral&&!/^f[a-z0-9]{11}$/.test(token))return;
    const body=JSON.stringify({name,version:'55.0.0',path:'/battles',properties:{source:'catalog',route:'battle',method,...(viral?{referral:token}:{})},...(viral?{eventId:code(15)}:{})});
    if(navigator.sendBeacon)navigator.sendBeacon('/api/events',new Blob([body],{type:'application/json'}));
    else fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
  }
  event('public_battle_view','visit');
  if(ref){let k='fsc-battle-open-'+a+b+ref;if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');event('public_shared_open','visit',ref);}}
  document.getElementById('fsc-share-battle')?.addEventListener('click',async()=>{
    const u=new URL(url);u.searchParams.set('ref',code(11));
    try{
      if(navigator.share){await navigator.share({title:'Food Battle · FoodScan',text:'Which would you put in your basket? Compare source-reported facts and choose.',url:u.href});status.textContent='Share sheet completed.';event('public_battle_share','native');return;}
      await navigator.clipboard.writeText(u.href);status.textContent='Challenge link copied.';event('public_battle_share','copy');
    }catch(e){if(e?.name!=='AbortError')status.textContent=`Copy this challenge: ${u.href}`;}
  });
  const buttons=[...document.querySelectorAll('[data-choice]')];
  if(sessionStorage.getItem(key))buttons.forEach(b=>b.disabled=true);
  buttons.forEach(button=>button.addEventListener('click',async()=>{
    if(sessionStorage.getItem(key))return;
    const token=document.querySelector('[name="cf-turnstile-response"]')?.value||'';
    if(!token){status.textContent='Please finish the verification before voting.';return;}
    buttons.forEach(b=>b.disabled=true);status.textContent='Recording your choice...';
    try{
      const response=await fetch('/api/battles/vote',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({a,b,choice:button.dataset.choice,turnstile:token})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'vote_failed');
      sessionStorage.setItem(key,button.dataset.choice);
      tally.textContent=`${data.votes_a} chose the first product · ${data.votes_b} chose the second.`;
      status.textContent='Choice recorded. This vote reflects preference, not healthiness.';event('public_battle_vote','vote');
    }catch{status.textContent='Your choice was not recorded. Please retry after verifying.';buttons.forEach(b=>b.disabled=false);window.turnstile?.reset?.();}
  }));
})();
