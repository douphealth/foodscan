# Greek supermarket web shops: checked 31 Oct 2026 (Europe/Athens)

Rule used for every chain: add it only if **all** of these hold.
1. robots.txt allows the pages needed.
2. The pages show the **barcode (EAN/GTIN)** and the **price** together, so prices are matched by barcode, never by name.
3. No login, no captcha, no bot wall. Nothing is bypassed.
4. The site's terms do not forbid reuse of the content (or no such clause could be found).
5. There is no private or undocumented API, only public HTML or JSON-LD.

Copies of every robots.txt are in `chains-evidence/`. The sha1 values are of the files as fetched. Requests were made one at a time with an identifying User-Agent.

## Added
| chain | site | how | evidence |
|---|---|---|---|
| **Bazaar** | bazaar-online.gr | Category listing pages print each product's EAN next to its price. 6,124 products (fetched 31 Oct 2026, 11:31 EET). | robots allows listings (`data/bazaar-robots-2026-10-31.txt`). The terms page (information_id=5) has only privacy/cookie text. Labelled as an online price for Attica delivery. |
| **Lidl Hellas** | lidl.gr | Product pages `/p/<slug>/p<id>` from the product sitemap. Each page has schema.org JSON-LD with `gtin13` and a single EUR `offers.price`. | robots (`robots-www.lidl.gr.txt`, sha1 bf3095dc…) disallows only search, `/1*`…`/9*`, `cc.js` and cwv assets, so `/p/` is allowed. The imprint (https://www.lidl-hellas.gr/c/imprint-lidl-website/s10100556, saved as terms-lidl-imprint.html, sha1 b6ed8d19…) and the legal-compliance page (terms-lidl.html, sha1 8440e13c…) have no terms of use and no clause on automated reading or quoting of prices. lidlhouse.gr is a separate Lidl site whose terms forbid commercial use without written consent. Those terms do not cover lidl.gr, and lidlhouse.gr is not used. **Caveats:** the price is what the site shows for its default region/store and may differ in your store. About 40% of sitemap pages give a barcode and a price; many are non-food or have no JSON-LD price. |

## Rejected
| chain | site | reason (what was observed) |
|---|---|---|
| Sklavenitis | sklavenitis.gr | Product pages and the sitemap (`sk-p1.xml`) show only the chain's internal SKU, not an EAN. Matching would need names, which we never do. |
| AB Vassilopoulos | ab.gr | Product pages are behind a captcha/bot check, and no EAN appears in the page HTML. robots also disallows `*/search/*`. |
| My Market | mymarket.gr | Imperva/Incapsula bot wall in front of product pages. Not bypassed. |
| Masoutis | masoutis.gr | Prices load only from a private JSON API called by the app bundle (`ms-main.js`). That is an undocumented internal API, so it was not used. |
| Kritikos | kritikos-easy.gr | The site is an Angular shell with no product data in the HTML. robots.txt is empty and the sitemap returns 404. The data comes only from a private API. |
| Galaxias | galaxias.shop | Prices come from `/api/…`, and robots.txt **disallows `/api/`**. |
| Market In | marketin.gr | This domain is not the supermarket chain. |
| Market In | market-in.gr | Category and product pages show prices but no EAN. |
| Chalkiadakis | chalkiadakis.gr | No online shop. robots.txt returns 404 and the site is corporate pages only. |
| Synka | synka.gr | Corporate WordPress site with no shop. |
| e-Fresh | e-fresh.gr | Terms (`terms-efresh.html`, sha1 14ef0552…) say: "Η αναπαραγωγή, επανέκδοση, … ή οποιαδήποτε άλλη χρήση του περιεχομένου … για εμπορικούς ή άλλους σκοπούς επιτρέπεται μόνο κατόπιν προηγούμενης έγγραφης συναίνεσης" (reuse only with prior written consent). |
| Thanopoulos | thanopoulos.gr | General terms (`terms-thanopoulos-general.html`, sha1 e2df8018…) say: "Απαγορεύεται οποιαδήποτε αντιγραφή, … μηχανική αναπαραγωγή, διανομή, μεταφορά, downloading … για κανέναν σκοπό, πλην της αυστηρά προσωπικής χρήσης, εκτός και αν χορηγηθεί εγγράφως η συναίνεσή μας." |

## What would add more chains
- Written permission from e-Fresh or Thanopoulos. Both sites print EANs. Each would be a new adapter in `src/sources/` with the same crawl rules.
- An official ministry feed with EANs (posokanei/e-katanalotis) would cover all the large chains at once. That is the only route to Sklavenitis, AB, My Market, Masoutis and Kritikos without breaking the rules above.
