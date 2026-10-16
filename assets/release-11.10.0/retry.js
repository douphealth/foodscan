let timer=null;
function tick(){timer=null;let waiting=false;for(const button of document.querySelectorAll('button[data-search-retry-at]')){const label=button.querySelector('[data-retry-label]'),left=Math.max(0,Math.ceil((Number(button.dataset.searchRetryAt)-Date.now())/1000));button.disabled=left>0;const text=left?`Try again in ${left}s`:'Try again';if(label&&label.textContent!==text)label.textContent=text;if(left)waiting=true;}if(waiting)timer=setTimeout(tick,1000);}
new MutationObserver(()=>{if(!timer)tick();}).observe(document.body,{childList:true,subtree:true});tick();
