# FoodScan 11.5.0

- Replacement homepage dashboard and product result summary, not a DOM-mutation restyle.
- Uses the selected lime-and-white reference composition with live diary figures and product packaging imagery.
- Three macro rings show reported grams; decorative outlines do not imply target percentages.
- Preserves existing eligibility gates, calculator, diary actions, search, and navigation through module adapters.
- Versioned 11.5 entry points and model VERSION; shared 11.3 engine retained.
- Stops loading prior redesign, reference and studio layers.
- CSP permits only the exact import-map hash, not arbitrary inline JavaScript.
- New offline cache includes the wrapper modules and query-specific dependencies.
- Syntax checks and isolated result rendering tests passed; rendered appearance, camera behavior, and full integration still need browser testing. Not a pixel-exact certification.
- No reference photograph or fabricated profile, calorie values, or meal photos added.
- Requires browser import-map support. Revert this commit to roll back.
