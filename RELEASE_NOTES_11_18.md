# FoodScan 11.18.0

Restores the exact 11.16 product report DOM, typography, sections, classifications, nutrients and circular macro cards. Retains the 11.17 same-barcode source recovery, cache hygiene, and previously-good-snapshot protection. Uses valid core nutrient values individually instead of requiring two available fields; still discloses unavailable values and unknown measurement basis. Withholds contradictory per-serving values without discarding valid per-100 source amounts. No claim of universal label accuracy. Roll back by reverting this commit.
