# FoodScan 11.16.0

- Restores legibility of source and reliability metadata in both dark and light themes; the four old white boxes are replaced with readable, accessible cards.
- Shows source record, fetch/update dates and core nutrition completeness with missing values explained; preserves source and report actions.
- Missing Nutri-Score and NOVA are explicit unknown states, not inferred grades; normalizes explicit source NOVA string numerals 1-4.
- Existing scoring, nutrition plausibility checks and allergy safeguards remain unchanged.
- Rollback by reverting this release commit and redeploying 11.15.0.
