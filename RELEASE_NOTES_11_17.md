# FoodScan 11.17.0 — sparse-record integrity and mobile reports

- Product names and barcodes alone no longer imply a complete nutrition report. Missing core nutrition values or uncertain mass/volume units show an actionable limited report, without invented values.
- The backend attempts one same-barcode v2 retrieval for incomplete v3 records within existing budgets, never a substitute barcode. Incomplete responses are not placed into the long-lived edge or client public cache.
- Stored products that already have a sound reference and at least two core facts are not overwritten during a background refresh by weaker data.
- Report retains recorded nutrients, source provenance, original barcode, label-photo action and user-triggered refresh; skips an enormous field of empty metrics, artificial grades and macro rings.
- Explicit product quantity/units only; no guessed solid vs liquid type. Nutri-Score and NOVA remain source-reported only.
- Browser and source regression checks included. Roll back by reverting this commit and redeploying 11.16.0.
