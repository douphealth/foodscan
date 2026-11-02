#!/usr/bin/env python3
"""FoodScan 73: Bazaar web-shop prices -> assets/gr-prices-v72/bazaar-eshop-latest.json

Input: bazaar-items.json written by bazaar_crawl.py, which reads only public category listing pages that robots.txt
allows (https://www.bazaar-online.gr/robots.txt, saved next to the crawl), one request at a time, >=1.2 s apart, with a
named User-Agent, every page cached so a page is never fetched twice. No login, no cart, no search, no captcha, no API.
Each listing card prints the shop's own barcode ("knns-model-value") next to the price, so a price is tied to a barcode
by the shop itself: no name matching is involved.

Output (schema 1): products keyed by 14-digit GTIN -> {n name, u product path, p price, o previous price or null, d date}.
Usage: python3 ingest/scripts/bazaar.py (ITEMS.json | CACHE_DIR) OUT.json [--robots robots.txt]
  Given the crawl's cache directory, every cached listing page is parsed again (sale cards included).
"""
import json, sys, re, hashlib, datetime, glob, gzip, html, os

def gtin_ok(e):
    if not re.fullmatch(r'\d{8}|\d{12,14}', e): return False
    d = [int(c) for c in e.zfill(14)]
    s = sum(x * (3 if i % 2 == 0 else 1) for i, x in enumerate(d[:13]))
    return (10 - s % 10) % 10 == d[13]

def money(v):
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    v = str(v).strip().replace('.', '').replace(',', '.')
    try: return float(v)
    except ValueError: return None

def parse_listing(b, fetched):
    """Product cards of one cached category page. A sale card shows <span class="price-new"> and <span class="price-old">."""
    out = []
    for blk in re.split(r'<div class="image">', b)[1:]:
        m = re.search(r'knns-model-value">\s*(\d{8,14})\s*<', blk)
        if not m: continue
        n = re.search(r'<h4><a href="([^"]+)">([^<]+)</a>', blk)
        w = re.search(r'price_wrapper">(.*?)</div>', blk, re.S); w = w.group(1) if w else ''
        new = re.search(r'price-new">\s*([\d.,]+)\s*€', w); old = re.search(r'price-old">\s*([\d.,]+)\s*€', w)
        plain = re.search(r'^\s*([\d.,]+)\s*€', re.sub(r'<[^>]+>', ' ', w))
        br = re.search(r'manufacturer_link">\s*<a [^>]*>([^<]*)<', blk)
        out.append(dict(ean=m.group(1), name=html.unescape(n.group(2)).strip() if n else None, url=n.group(1) if n else None,
                        price=(new or plain).group(1) if (new or plain) else None, old=old.group(1) if old else None,
                        brand=html.unescape(br.group(1)).strip() if br else None, fetched=fetched))
    return out

def from_cache(cache_dir):
    items, last = {}, 0
    for f in sorted(glob.glob(os.path.join(cache_dir, '*.html.gz')), key=os.path.getmtime):
        last = max(last, os.path.getmtime(f))
        fetched = datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d')
        for it in parse_listing(gzip.open(f, 'rt', encoding='utf-8', errors='replace').read(), fetched): items[it['ean']] = it
    return {'fetched_at': datetime.datetime.fromtimestamp(last).astimezone().isoformat(timespec='seconds') if last else None, 'items': list(items.values())}

def restricted(e):
    # GS1 restricted-circulation numbers (in-store codes: EAN-8 starting 0 or 2, GTIN-13 starting 2, UPC-A starting 2 or 4)
    # are only unique inside one retailer, so the same digits on another shop's product would get this shop's price.
    e = e.lstrip('0') or '0'
    return (len(e) <= 8 and e.zfill(8)[0] in '02') or (len(e) == 13 and e[0] == '2') or (len(e) == 12 and e[0] in '24')

def main(argv):
    items_path, out_path = argv[1], argv[2]
    robots = argv[argv.index('--robots') + 1] if '--robots' in argv else None
    doc = from_cache(items_path) if os.path.isdir(items_path) else json.load(open(items_path, encoding='utf-8'))
    items = doc['items'] if isinstance(doc, dict) else doc
    products, skipped = {}, {'bad_barcode': 0, 'no_price': 0, 'bad_url': 0, 'duplicate': 0, 'restricted_code': 0}
    dates = set()
    for it in items:
        e = str(it.get('ean') or '')
        if not gtin_ok(e): skipped['bad_barcode'] += 1; continue
        if restricted(e): skipped['restricted_code'] += 1; continue
        p = money(it.get('price'))
        if not p or p < 0.01 or p > 10000: skipped['no_price'] += 1; continue
        m = re.fullmatch(r'https://www\.bazaar-online\.gr(/[a-z0-9\-/,.]+)', it.get('url') or '')
        if not m: skipped['bad_url'] += 1; continue
        k = e.zfill(14)
        if k in products: skipped['duplicate'] += 1; continue
        o = money(it.get('old'))
        d = it.get('fetched'); dates.add(d)
        products[k] = {'n': (it.get('name') or '')[:120], 'u': m.group(1), 'p': round(p, 2), 'o': round(o, 2) if o and o > p else None, 'd': d}
    snap = max(dates) if dates else None
    out = {'schema': 1, 'source': {
        'id': 'bazaar', 'name': 'bazaar-online.gr web shop', 'url': 'https://www.bazaar-online.gr/', 'snapshot': snap, 'fetched_at': doc.get('fetched_at') if isinstance(doc, dict) else None,
        'scope': 'online price of the chain web shop (Attica delivery); shelf prices in stores may differ',
        'method': 'public category listing pages allowed by robots.txt, 1 request at a time >=1.2 s apart, cached; barcode printed by the shop next to each price',
        'robots_sha1': hashlib.sha1(open(robots, 'rb').read()).hexdigest() if robots else None,
        'terms': 'https://www.bazaar-online.gr/index.php?route=information/information&information_id=5 (read 31 Oct 2026: privacy and cookies text; no clause on automated reading or quoting of prices)',
        'counts': {'items': len(items), 'products': len(products), **skipped}},
        'products': dict(sorted(products.items()))}
    json.dump(out, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    if '--items-out' in argv:  # parsed cards with numeric prices, the input of ingest/scripts/match.mjs --bazaar
        rows = [dict(it, price=money(it.get('price')), old=money(it.get('old'))) for it in items]
        json.dump({'fetched_at': out['source']['fetched_at'], 'items': rows}, open(argv[argv.index('--items-out') + 1], 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps(out['source'], ensure_ascii=False, indent=1))

if __name__ == '__main__': main(sys.argv)
