# FoodScan 104.0.0

A third audit of the live app (103.0.0), done two ways: by looking at the running app on a phone-sized and a desktop-sized screen, and by comparing the
app's grade with the published one on the most-scanned products of several countries. Plus a redesign of the Home hub and of the order of Home for a
shopper who has scanned before.

Nothing here invents a score, a grade or a price. Every number below was measured on this tree.

## Grades

| What was wrong | Where it showed | Fix |
| --- | --- | --- |
| **One screen, two letters for the same drink.** The 103 drink corrections (wrong table, sweeteners left out) ran only when the caller allowed estimates. A caller asking for *published grades only* still got the published letter back as "reported". | "Your week" on Home counted two drinks as A that the cards beside it showed as C. The same call is used by the public product pages (`/products/<code>`, their structured data), by the server's swap candidates and by the foods page. | The two checks always run. With estimates off, the letter is withheld and `correctedGrade` carries the single letter the drinks table gives (if any). "Your week" and the foods page count that letter; the public pages and the swap candidates no longer publish or use the wrong one. Both engine copies (`src/domain/grade.js`, `assets/domain-v104.mjs`). |
| **A published grade held back for label rounding.** Open Food Facts flags a record when kcal and kJ disagree. On a zero-sugar cola that is "1 kcal / 1.3 kJ". | Coca-Cola sans sucres (5449000214799), one of the most-scanned drinks, showed "needs checking" and no grade. | A kcal/kJ difference of at most 17 kJ (4 kcal, the level at which the EU rules let a label say energy-free) is not a contradiction. A real mismatch (for example 100 kcal against 100 kJ) still holds the grade. |

### Measured: the app against the published grade on most-scanned products

`v79-work/scratch/intl-sweep.mjs` asked Open Food Facts for the most-scanned products of France, Germany, Spain, the United Kingdom, the United States,
Belgium and the Netherlands (Italy's list did not load), read each record live and ran it through the browser engine.

| | Before the fixes | After |
| --- | --- | --- |
| Distinct products (the countries' lists overlap heavily) | 97 | 97 |
| Same letter as published | 89 | 90 |
| App shows a different letter | 1 | 1 |
| App withholds a published letter | 1 | 0 |
| No grade at the source, none shown | 4 | 4 |
| Record not usable (one barcode with a wrong check digit, one that did not load) | 2 | 2 |

The one different letter is Cappy Pulpy (5449000147417): published C, shown D. Its ingredient list names cyclamates, steviol glycosides and
acesulfame K, and the published points count no sweeteners, so the 2023 rules give D. The app says so on the card.

This is a sample of 97 popular products, not a statement about every product.

## Home

- **The hub is the day at a glance.** One dial per limit (sugars 50 g, salt 5 g, saturated fat 22 g, energy 2,000 kcal), always on screen and empty
  until an amount is logged. The dial is the progress bar for assistive technology, with the value in words. A total that is a lower bound is marked
  "≥" and explained in a sentence under the dials, as before.
- **The date in words** ("Thursday 26 November") replaces `2026-11-26`. The two boxes of counts (often "0" and "0") became one line. A streak is shown
  once there is one; "Streak: 0 days" is gone.
- **Recent foods are one row to swipe** on a phone, with larger tap targets.
- **The country row is a setting**, under the lists. It stays on top only while it asks something: no country known, or the phone's clock and the
  connection disagree.
- **A shopper who has scanned before opens Home on their own foods.** The search box and the scan button stay first; "Recently scanned" and
  "Your week" follow at once. On a 375 px phone "Recently scanned" moved from about 2,800 px down the page to about 1,150 px. The introduction
  comes after; on a phone its picture, sample products and lead sentence are left out for them. A first visit is unchanged.
- **Flags.** Windows has no flag emoji and printed the two letters ("GR Greece"). One flag is drawn once on a canvas; with no coloured pixel the
  flag is left out everywhere and the country name stands alone.
- **Week card wording.** Ten French, German, Spanish and Italian strings of the week card had the count in the wrong place or a stray word
  ("Produits medal {n} contrôlés"); they now read "{n} produits vérifiés" and the like.
- **Price card.** "Prices in Greece · EUR from your phone's clock" now reads "… · EUR · from your phone's clock".

## Indexes and files

- The swap, peer and estimate indexes were rebuilt with the changed engine (swaps: 4,789 to 4,793 rows).
- The 49 versioned files under `/assets/` are renamed from `-v103` to `-v104`, because that folder is served "immutable" for a year and three of them
  changed (the engine and two chunks). A tab left open on 103.0.0 needs one reload.

## Checked

- `node --test qa/*.test.mjs`: 263 pass, 0 fail (255 before, 8 new in `qa/audit104.test.mjs`). `node build.mjs --check` rebuilds `_worker.js` exactly.
- Looked at in a browser on a local copy: Home at 375 px and 1,200 px, dark and light, English and Greek; logging two foods (150 g Nutella, a 330 ml
  cola: sugars 120.4 g, 241 %); the new order of Home; "Your week" now reading C: 2, E: 2 for the same history that read A: 2 before.
- `FoodScan-104.0.0-Cloudflare-Pages.zip` (286 files, the same list as 103.0.0 with the new generation names), extracted into a clean folder and served by
  `wrangler pages dev` (workerd): `verify-deploy.mjs` passes for 104.0.0; `assets/domain-v104.mjs` answers 200 and the old name 404; the product page of
  Coca-Cola sans sucres shows its published C.

## Not done, and limits

- Not tried on a real phone or on real Cloudflare before release.
- The four other interface languages (de, es, fr, it) come from the app bundle and contain other machine-quality phrases (for example "Cioccolato
  nocciola diffusione"). Only the week card was corrected here: the rest needs a native reader per language.
- The hub itself has English and Greek only, as before.
- A wrong number in Open Food Facts that still looks plausible cannot be detected. 7,961 catalogue products have no published grade; 2,408 of those
  have no nutrition numbers at all.
- Prices were not re-measured in this round beyond the price card's wording. The government observatory's newest file is still 18 November.
- The new order of Home changes what is seen first, not the order a keyboard or a screen reader walks the page: that stays the order of the document.
