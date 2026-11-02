#!/usr/bin/env python3
"""Polite Lidl Hellas product-page crawler (FoodScan 74).
Source list: the product sitemap that robots.txt of lidl-hellas.gr advertises
(https://www.lidl.gr/p/export/GR/el/product_sitemap.xml.gz). Only /p/ product pages are fetched
(robots.txt disallows /1*../9*, /q/search, /cc.js; /p/ is allowed). One request at a time, >=1.5 s apart,
identifying User-Agent. Reads schema.org Product JSON-LD: gtin13 + offers.price. No login, no API.
Usage: lidl_crawl.py <workdir>   (workdir holds sitemap.xml.gz; writes cache/<sku>.html, lidl-items.json)"""
import gzip, json, os, re, sys, time, urllib.request, datetime
UA = 'Mozilla/5.0 (X11; Linux x86_64) FoodScan-research/74 (+https://food-scan.gearuptofit.com/how/)'
wd = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(os.path.join(wd, 'cache'), exist_ok=True)
raw = open(os.path.join(wd, 'sitemap.xml.gz'), 'rb').read()
try: raw = gzip.decompress(raw)
except OSError: pass
urls = re.findall(r'<loc>(https://www\.lidl\.gr/p/[^<]+)</loc>', raw.decode('utf-8', 'replace'))
def parse(html, url, fetched):
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try: d = json.loads(m.group(1))
        except ValueError: continue
        if not isinstance(d, dict) or d.get('@type') != 'Product': continue
        g = d.get('gtin13') or []
        g = g if isinstance(g, list) else [g]
        offers = d.get('offers') or []
        offers = offers if isinstance(offers, list) else [offers]
        prices = [o.get('price') for o in offers if isinstance(o, dict) and o.get('priceCurrency') == 'EUR']
        prices = [p for p in prices if isinstance(p, (int, float)) and p > 0]
        if not g or len(set(prices)) != 1: return None   # ambiguous -> skip, never guess
        return {'sku': d.get('sku'), 'gtins': [str(x) for x in g if re.fullmatch(r'\d{8,14}', str(x))],
                'name': d.get('name'), 'brand': (d.get('brand') or {}).get('name'), 'price': float(prices[0]),
                'availability': (offers[0] or {}).get('availability'), 'url': d.get('url') or url, 'fetched_at': fetched}
    return None
items, last = [], 0.0
for i, u in enumerate(urls):
    sku = re.search(r'/p(\d+)$', u)
    path = os.path.join(wd, 'cache', (sku.group(1) if sku else str(i)) + '.html')
    if not os.path.exists(path):
        wait = 1.5 - (time.time() - last)
        if wait > 0: time.sleep(wait)
        last = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA, 'Accept-Language': 'el-GR'}), timeout=30) as r:
                open(path, 'wb').write(r.read())
        except Exception as e:
            print('fail', u, e, flush=True); continue
    fetched = datetime.datetime.fromtimestamp(os.path.getmtime(path), datetime.timezone.utc).isoformat(timespec='seconds')
    it = parse(open(path, encoding='utf-8', errors='replace').read(), u, fetched)
    if it and it['gtins']: items.append(it)
    if i % 50 == 0: print(i, len(urls), len(items), flush=True)
json.dump(items, open(os.path.join(wd, 'lidl-items.json'), 'w'), ensure_ascii=False)
print('done', len(urls), len(items), flush=True)
