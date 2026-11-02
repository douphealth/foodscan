# Polite Bazaar (bazaar-online.gr) category crawler: robots-allowed category listing pages only, 1 request at a time, >=1.2 s apart (no Crawl-delay in robots.txt), cached.
import re,os,time,gzip,hashlib,json,urllib.request,html,sys
UA='Mozilla/5.0 (X11; Linux x86_64) FoodScan-research/72 (+https://food-scan.gearuptofit.com/how/; price research, 1 req at a time, >=1.2s apart)'
BAD=('account','checkout','cart','wishlist','login','search','compare','index.php','information','blog','image','catalog')
t=open('seed.html',encoding='utf-8',errors='replace').read()
links=sorted(set(l for l in re.findall(r'href="(https://www\.bazaar-online\.gr/[a-z0-9\-]+(?:/[a-z0-9\-]+)+)"',t) if not any(b in l for b in BAD)))
leaf=[l for l in links if not any(o!=l and o.startswith(l+'/') for o in links)]
print('categories',len(links),'leaf',len(leaf),flush=True)
def get(u):
    f='cache/'+hashlib.sha1(u.encode()).hexdigest()+'.html.gz'
    if os.path.exists(f): return gzip.open(f,'rt',encoding='utf-8').read(),True
    for a in range(3):
        try:
            r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA,'Accept-Language':'el-GR'}),timeout=60)
            b=r.read().decode('utf-8','replace'); gzip.open(f,'wt',encoding='utf-8').write(b); return b,False
        except Exception as e: print('err',u,e,flush=True); time.sleep(10)
    return '',False
items={}; log=[]
for i,c in enumerate(leaf):
    seen=set()
    for page in range(1,60):
        u=c if page==1 else f'{c}?page={page}'
        b,cached=get(u)
        if not cached: time.sleep(1.2)
        eans=re.findall(r'knns-model-value">\s*(\d{8,14})\s*<',b)
        new=[e for e in eans if e not in seen]
        if not new: break
        seen.update(new)
        mp=re.search(r'\((\d+) Σελ\.\)',b); last_page=int(mp.group(1)) if mp else 1
        for blk in re.split(r'<div class="image">',b)[1:]:
            m=re.search(r'knns-model-value">\s*(\d{8,14})\s*<',blk)
            if not m: continue
            n=re.search(r'<h4><a href="([^"]+)">([^<]+)</a>',blk); p=re.search(r'price_wrapper">\s*([\d.,]+)\s*€',blk)
            br=re.search(r'manufacturer_link">\s*<a [^>]*>([^<]*)<',blk); pk=re.search(r'class="packaging">([^<]*)<',blk); ppk=re.search(r'priceperkg">\s*([^<]+?)\s*<',blk)
            old=re.search(r'price-old[^>]*>\s*([\d.,]+)\s*€',blk)
            items[m.group(1)]=dict(ean=m.group(1),name=html.unescape(n.group(2)).strip() if n else None,url=n.group(1) if n else None,
              price=float(p.group(1).replace('.','').replace(',','.')) if p else None,brand=html.unescape(br.group(1)).strip() if br else None,
              packaging=pk.group(1).strip() if pk else None,per=ppk.group(1).strip() if ppk else None,old=old.group(1) if old else None,category=c,page_url=u,fetched=time.strftime('%Y-%m-%d'))
        if page>=last_page: break
    if i%10==0:
        json.dump({'fetched_at':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'items':list(items.values())},open('bazaar-items.json','w'),ensure_ascii=False); print(i,len(leaf),len(items),flush=True)
json.dump({'fetched_at':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'items':list(items.values())},open('bazaar-items.json','w'),ensure_ascii=False); print('done',len(items),flush=True)
