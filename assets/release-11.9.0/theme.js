const KEY='foodscan-display-mode',media=matchMedia('(prefers-color-scheme: dark)');
let selected='system';try{selected=localStorage.getItem(KEY)||selected;}catch{}
export function mode(){return ['light','dark'].includes(selected)?selected:media.matches?'dark':'light';}
function sync(){const value=mode();document.documentElement.dataset.uiTheme=value;document.querySelectorAll('[data-ui-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.uiMode===value)));const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=value==='dark'?'#101811':'#f5f7f2';}
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const native=button.closest('dialog')&&button.hasAttribute('data-action')?/^(light|dark|system)(?: mode| theme)?$/i.exec(button.textContent.trim()):null;const value=button.dataset.uiMode||native?.[1]?.toLowerCase();if(!['light','dark','system'].includes(value))return;if(button.dataset.uiMode)event.preventDefault();selected=value;try{localStorage.setItem(KEY,selected);}catch{}sync();});
media.addEventListener('change',sync);window.addEventListener('storage',event=>{if(event.key===KEY){selected=event.newValue||'system';sync();}});
new MutationObserver(sync).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-theme']});sync();
