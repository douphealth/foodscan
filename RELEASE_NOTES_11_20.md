# FoodScan 11.20 — source-integrity quarantine

Confirmed barcode 80823131 (2026-10-17): missing product name, brand, quantity, and nutrition reference. Open Food Facts reports 10 kcal, 10 kJ, 10 g fat and 10 g saturated fat, plus explicit energy mismatch and repeated-values quality errors. These cannot be trusted as confirmed nutrients. Image is source-submitted, not independently identity-verified.

The scan parser now detects critical source flags and energy/macronutrient contradictions and quarantines unsafe numeric fields across storage and reopening. Existing complete product reports are untouched. For invalid source records, the same report visual system presents a concise integrity warning and functional manual package-label entry and private photo storage. Manual values have local provenance, no invented Nutri-Score/NOVA, and are not a substitute for allergy-label verification. Rollback: revert the release commit.
