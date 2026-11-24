# FoodScan 100.1.0: a calmer Home hub on a desktop

Base: FoodScan 100.0.0 (live). One screenshot of the Home page on a wide desktop window showed two things wrong with the daily hub; this release fixes both and touches nothing else.

## What the screenshot showed
1. **The hub stretched across the whole window** (a 2,000 px screen gave 2,000 px of stat boxes, list rows and a "no amount" label pushed to the far edge). The hub had no width limit; only phones had been checked.
2. **"Last 7 days" was seven blank dashes.** The two check-ins on that device were written by 98.1.0 and carry no amount, so there was nothing to chart. 100.0.0 drew the card as soon as any day was logged, and added a long caveat sentence under it.

## What changed
- **The week card appears only from two days with an amount** (`weekReady`, `WEEK_MIN_DAYS = 2`). A day logged before amounts existed does not count towards the two, and one day is not a week. Until then the card is not drawn at all.
- **Its caveat is folded** into a closed "About these averages" note (the same pattern as "About these limits"), and the label now says what the bars are: "bars show sugars against the 50 g WHO limit".
- **The biggest swap win moved to the swap list**, the list it is about, instead of sitting inside the week card.
- **The hub sits in the same column as the page below it**: 1,264 px of content (the page is 1,328 px wide with 32 px padding), centred, from 600 px up. From 960 px its sections flow in two columns: today's limits beside today's entries, then the week beside the swap list. The header, the two counters, the quick-log row, "My Lens and backup" and the status line span the full width. A phone is unchanged: one column, edge to edge.
- Version 100.1.0 in the files that carry one; the service worker cache is renamed so installed copies pick up the new CSS and JS.

## Checked
Looked at in a browser at 1600 px, 1024 px and 375 px, in English and Greek, with the screenshot's data (two check-ins without an amount: no week card, no horizontal overflow), with real amounts over four days (week card, swap list, both columns), and with an empty profile (the compact welcome card, 1,264 px wide, 181 px tall). Not tried on a real phone.

## Not changed
Nothing about portions, limits, labels, prices or grades. The roadmap items that were not built in 99.0.0 and 100.0.0 are still not built (see their notes).

## Tests
`qa/daily1001.test.mjs` (5 tests): the gate (nothing, legacy-only, one day, two days, a legacy day not counting), the card's structure and folded caveat, the strings in both languages, the page-column and two-column CSS, and the version pins. One older test now expects the new string names.

**Full suite: 203 of 203 pass** (the 198 from 100.0.0 plus these 5).
