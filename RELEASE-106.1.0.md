# FoodScan 106.1.0

One fix: the "Later" button on the "A new version of FoodScan is ready" bar could not be read.

## What was wrong

Seen on the live 106.0.0: the bar showed "Refresh" and an empty pill. The bar inverts the page colours (its background is the page's ink
colour, its text the surface colour). The "Later" button is a ghost button, whose own colour is ink: the bar's background. So the label was
invisible in the light theme and in the dark one. It predates 106.

## The fix

`prices/native-v83.css`: on that bar, the ghost button takes the bar's text colour, with a matching border, hover and focus ring. Three rules.
The stylesheet is not one of the year-cached asset files, so no file is renamed and an open tab needs no special reload.

## Checks

- Browser, local copy, phone width: the bar with both buttons, dark theme (seen) and light theme (computed colours). Contrast of "Later"
  against the bar: 15.5 to 1 in the dark theme, 16.9 to 1 in the light one.
- Tests: `qa/audit1061.test.mjs` (2 new). Full suite: 282 of 282 pass (280 before, 2 new).
- Not checked: a real phone; the bar as the app raises it after a real update (it was built by hand in the page with the app's own markup).
