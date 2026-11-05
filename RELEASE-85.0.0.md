# FoodScan 85.0.0: a grade with no effort from the shopper (quick grade), and an optional label reader

Base: FoodScan 84.0.0 (branch `claude/confident-dirac-gzvl8m`; 84.0.0 is not merged to `main` yet). No server change, no new secret, no cost: everything runs in the shopper's browser.

## 1. Quick grade: the shopper does nothing, and sees everything
A shopper scanning a product wants the verdict at once, not a photo session. So the first thing a "No grade" product now shows, by itself, is a grade card: **"Most likely D"** with the A-E scale, the points gauge and every number behind it.

**What the real data showed** (the bundled Greek catalogue, 12,137 products; `node tools/quick-grade-validate.mjs`): 7,961 products have no grade. **3,069 of them already carry energy, sugars, saturated fat and salt**, yet FoodScan refuses to grade them because the record has no confirmed category, so it cannot tell which of the four Nutri-Score 2023 tables applies. 2,408 carry none of the four numbers.

**How it is worked out** (`prices/quick-grade-v85.mjs`):
1. **Which tables could apply:** from the category or PNNS group when the record has one; otherwise from the product name (English, Greek, French, German, Spanish, Italian, Bulgarian; Unicode-aware, because `\b` never matches Greek letters, which also means the Greek name rules inside the existing `ns23Kinds` never fire), the unit (ml or g) and the composition (a cheese found by its protein/fat/salt fingerprint when the name does not say cheese).
2. **The letters the official calculation gives** over every table that could apply and every value the unreported favourable nutrients (fibre, protein, fruit and vegetables) could take, bounded by physics (`ns23Tier`, the bounds that verify source grades).
3. **One letter** if they agree, **a band of two or three** if not, nothing if they span four or five grades.
4. **A "most likely" letter:** the score the reported values give, with every unreported favourable nutrient at zero (Open Food Facts' own convention), plus what would change it ("It would be C if more than 40 % of it is fruit, vegetables, legumes or nuts. The record does not say.").
5. **One missing number is bounded, never guessed:** sugars by the carbohydrate on record, saturated fat by the fat, salt by a cap of 3 g per 100 g (96 % of graded products are below it). With an unfavourable nutrient missing there is no "most likely" letter, only the band, and the tile says "assumed at most 3 g".

**What the card shows** (`prices/grade-ui-v85.mjs`, English and Greek): the letter in a seal marked ESTIMATE (dashed ring); the A-E scale with the likely letter raised, the possible ones outlined and the impossible ones dimmed; a points gauge with the score marker, the band and where each letter starts; the statement **"Calculated by FoodScan with the official Nutri-Score 2023 algorithm, from this product's nutritional facts as recorded in Open Food Facts"**; why it is an estimate (table chosen from the name; what is not reported; what was bounded; per-100 g assumed; sweeteners; drinks less certain); a tile for every number used with its value, its points out of the maximum and a bar (unreported ones hatched, with what was assumed); the other values on record; the sum (points against - points in favour = score); the table used and the letter ranges; the source (Open Food Facts, barcode, record date, saved copy); "how reliable is this kind of estimate" with the measured percentages; and "not a grade printed on the pack: if the pack shows a Nutri-Score, trust the pack". It sits inside the product's grade card in place of the "No grade" header (the price strip below is untouched), is never shown when the app has a grade or holds one for review, and is not produced for alcohol, products Open Food Facts marks "not applicable", or nutrition estimated from the ingredient list. It never feeds rankings or "better choice".

**Measured** on the 4,103 graded Greek products with all four numbers, **categories hidden** (the situation of a product without any), against the letters Open Food Facts published:

| shown | share | published letter inside the band | "most likely" letter equals it |
|---|---|---|---|
| one letter | 56 % | 93.5 % | 93.5 % |
| two letters | 27 % | 96.1 % | 85.8 % |
| three letters | 8 % | 96.6 % | 79.6 % |
| nothing (four or five grades) | 9 % | | |

By confidence: **high** (foods settled by category, name or default) 97 % inside and 94 % most-likely exact; **low** (drinks, cheeses found by composition) 77 % inside and 64 % exact, and the card says so. With one nutrient hidden: salt shown for 48 % of products (published letter inside the band 93.9 %), sugars 70 % (95.2 %), saturated fat 78 % (95.5 %).

**Reach:** of the 7,961 products with no grade, **3,547 get an estimate** (2,829 with all four numbers, 718 missing exactly one). Together with the 4,176 that already have a published grade, **7,723 of 12,137 (64 %)** now show a grade, up from 34 %.

The percentages printed on the card are floors of these measurements; `qa/quick-grade.test.mjs` runs the validation on the real catalogue and fails if a printed figure ever exceeds what is measured. Caveat: "truth" is Open Food Facts' own letter, which is not independent: without a category it falls back to the general table (a juice graded as a food) and it counts sweeteners inconsistently, so some misses are its errors.

**What it does not fix:** products with no nutrition numbers (2,408 in the catalogue) and products missing two or more of the four. For those the card says exactly what the record lacks and offers the label photo.

## 2. Read the label (optional): the exact grade
For products where the estimate is not enough, or the shopper wants certainty, a photo of the nutrition table gives the exact Nutri-Score. This is the part described below.

### Why it exists
Only about a third of the catalogue can be graded offline, and many Open Food Facts records lack the values a grade needs. FoodScan will not guess a grade, so those products show "No grade". Now that card has a way out.

### What the shopper sees
Under the "No grade" card (and on the "not in any database" page) a card **Read the label** offers: photograph the nutrition table, or type the numbers.
1. The photo is read on the phone (Tesseract.js, English + Greek, served by FoodScan; nothing is uploaded).
2. The numbers appear next to the photo in editable boxes. Any number that was repaired, inferred from its row, unusually high, or that does not fit the others is marked amber with a reason.
3. The shopper chooses what the product is (food, drink, plain water, cheese, oil/butter/nuts/seeds), the fruit/vegetable/legume/nut share band (or "I do not know"), sweeteners for drinks, and the serving size if the label is per serving only.
4. A live result shows the Nutri-Score 2023 letter with its points. "Calculate and save" stays disabled until the shopper ticks *I checked these numbers against the label*.
5. The saved result says "Nutri-Score E · from your label", names the table used, says it is saved on this device only and is **not the manufacturer's or the database's grade**. It can be edited or removed. It is never sent anywhere and never replaces a grade from a source.

### Why the numbers can be trusted (and what is not claimed)
- **Same calculator as the rest of the app.** `ns23Score` (now exported by `assets/domain-v8500.mjs`, a copy of `domain-v8400.mjs` that only adds the exports) with the table the shopper chose. Tested against the golden cases of `qa/score.test.mjs` and by a 1,600-case property test.
- **Nothing assumed.** Missing fibre, protein or fruit/vegetable share are evaluated over every possible value; if that can change the letter a range is shown ("Between C and D"), not a letter. A grade also needs energy, sugars, saturated fat and salt, and the card says which one is missing.
- **OCR repair by the physics of a label** (`prices/label-reader-v85.mjs`): energy must equal 37 x fat + 17 x (carbohydrate + protein) + 8 x fibre kJ (EU Reg. 1169/2011 factors, tolerance for polyols), kJ = 4.184 x kcal, saturates <= fat, sugars <= carbohydrate, the table <= 100 g, and a second value column (per serving) must scale with the energy ratio. The reading that needs the fewest repairs wins. Typical repairs: the unit "g" read as 9/6/0/8 ("13 g" -> "139"), a lost decimal point ("7.5" -> "75"), "2/69" -> 2.6.
- **Character alternatives.** Tesseract is run with `lstm_choice_mode`; when the second-best reading of a number's last character is "g", the number is cut there. This catches the g/9 confusion directly.
- **Rows rebuilt from word boxes** (a column of labels followed by a column of numbers becomes rows again), label words repaired against known wording (`azticares` -> `azucares`), a single destroyed row placed by the EU row order and marked *inferred*.
- **Up to five passes** (adaptive threshold at three scales, plain grey) that stop as soon as a reading is complete and consistent; otherwise the readings vote per number and disagreements are flagged.
- Languages recognised in label rows: English, Greek, French, German, Italian, Spanish, Portuguese, Dutch, Polish, Czech, Swedish.

### Measured, with the engine that ships (`node tools/label-accuracy.cjs 24 3`)
24 deliberately hard synthetic photos (6 languages, 1-3 value columns, 6 fonts, rotation, blur, noise, uneven light), drawn from random but physically consistent tables, read by the real browser pipeline. **These are synthetic, not real phone photos; real accuracy will differ.**
- Per number correct: energy 96 %, fat 92 %, saturates 79 %, carbohydrate 92 %, sugars 92 %, fibre 100 %, protein 96 %, salt 92 %.
- All four grade inputs (energy, sugars, saturates, salt) right: 16 of 24. Grade letter right with **no editing at all**: 19 of 24 (79 %).
- Of 15 wrong numbers, 11 were flagged for review. Two wrong letters came with no warning in that run; since then values that few foods have (salt over 4 g, protein over 35 g, ...) are flagged too. This is why the shopper must confirm every number, and why the card never calls the result verified.
- Mean 3 s for a clean label on a desktop CPU in the first pass; 7 s for the hard set (up to five passes). Phones will be slower.

## 3. Tests and checks
`qa/label-reader.test.mjs` (24 tests: six languages, repairs, column choice, per-serving, sodium, inference, nothing-invented, grade golden cases, property test). Full suite: 96 tests pass (10 of them for the quick grade, including the card text, the gauge and the real-catalogue validation). Browser run of the whole flow in Chromium against the emulator (photo -> numbers -> confirm -> saved -> reload -> remove): passes. axe-core on the card (idle, review, saved; light and dark): no violations.

## 4. Files
New: `prices/quick-grade-v85.mjs`, `prices/grade-ui-v85.mjs`, `tools/quick-grade-validate.mjs`, `qa/quick-grade.test.mjs`, `prices/reader-v85.js`, `prices/reader-v85.css`, `prices/label-reader-v85.mjs`, `prices/label-ocr-v85.mjs`, `assets/domain-v8500.mjs`, `qa/label-reader.test.mjs`, `tools/label-accuracy.cjs`. Changed: the three app shell pages (load the card), `sw.js` (cache name, precache), version strings (85.0.0), `src/worker/core.js` and the rebuilt `_worker.js`, `qa/core.test.mjs`.

## 5. Rollback
Remove the `reader-v85` link and script from `index.html`, `how/index.html` and `demo/index.html`: the card disappears and nothing else changes. Saved label grades live only in each phone's `localStorage` under `fs85:label:<barcode>`.

## 6. Not done (next)
- A family-aware table choice (the catalogue builder's product families are not in the repository), and the quick grade on the compare and alternatives pages (today only the product page shows it, and rankings never use it).
- Prices have the same gap and no equally strong free path: the shelf-tag reader of 80 (`prices/add-price-v80.mjs`) is still Greece/EUR only (Greek chain list, euro formatting). Generalising it to any currency, showing the shopper's own note on the product card (never ranked), and an optional share to Open Prices is the counterpart of this release.
- Accuracy on real photos is unmeasured: collect a few dozen real labels before claiming more.
