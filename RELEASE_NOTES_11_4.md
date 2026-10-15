# FoodScan 11.4.0

- Lime-and-white reference direction replaces peach studio styling.
- Added /assets/release-11.4.0/reference.css; existing 11.3 engine paths are intentionally retained for compatibility.
- boot.js no longer imports the earlier studio DOM rearrangement or peach stylesheet.
- Application VERSION and offline cache are now 11.4.0.
- Offline shell includes the new stylesheet. Product images are network-loaded, not service-worker cached.
- Calculator and barcode logic preserved. No invented nutrition values or progress percentages.
- Not pixel-verified against the reference; no browser rendering tests run in this environment.
- Rollback: revert this commit. Every subsequent shipped revision must increment version and shell-cache ID.
