# FoodScan 11.11.0 — unified rollout and live comparison verification

- Aligns displayed app version, module entry points, API diagnostics and offline shell with the already-committed 11.11.0 backend patch.
- Previous model-module paths are aliased to the current model to avoid mixed version constants. Existing nutrition and UI logic remain shared.
- Adds a visible app/API release check. It identifies old API deployments, malformed health responses, network failures and offline mode without claiming upstream search is healthy.
- Adds a live backend smoke test: wait for the expected API version/schema, fetch the exact test barcode, derive its category/country from the live record, and call both full and fast comparison endpoints. Real HTTP status, provider codes and request IDs are recorded in ui-audit/backend-smoke.json.
- The workflow runs the smoke test and existing mobile/desktop light/dark audit; artifacts retained seven days. It may consume GitHub Actions minutes. Repository permissions remain read-only.
- The backend Worker is not modified by this commit; the existing schema patch remains in the tree.
- Seven local release-check browser cases passed: version match/mismatch, HTML/invalid JSON, network error, offline guard and request coalescing. The live smoke test has not run in this environment.
- This rollout fixes app-version labeling and creates verifiable deployment/provider diagnostics. It does not guarantee third-party availability or claim the live comparison failure has already been resolved.
- Rollback by reverting this commit. No user diary/profile deletion or cache wiping is performed.
