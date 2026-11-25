/* FoodScan 71 market hint (ported from 59.3; widened in 102). The edge adds <meta name="fs-country"> from the visitor's network country.
 * When it is absent (local preview, privacy relay, cached shell offline), the device time zone is the next, private signal:
 * an en-US phone set to Europe/Athens shops in Greece. Only fills the gap; never overrides the edge or a saved choice.
 * 102: the 24 European zones below answer at once; every other zone in the world is looked up in prices/tz-country-v102.mjs (the IANA table). */
(function () {
  try {
    if (document.querySelector('meta[name="fs-country"]')) return;
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    function add(code) {
      if (!code || document.querySelector('meta[name="fs-country"]')) return;
      var m = document.createElement('meta');
      m.name = 'fs-country'; m.content = code; m.setAttribute('data-source', 'time-zone');
      document.head.appendChild(m);
    }
    var map = {'Europe/Athens':'GR','Asia/Nicosia':'CY','Asia/Famagusta':'CY','Europe/Berlin':'DE','Europe/Rome':'IT','Europe/Madrid':'ES','Europe/Paris':'FR','Europe/Lisbon':'PT','Europe/Amsterdam':'NL','Europe/Brussels':'BE','Europe/Vienna':'AT','Europe/Zurich':'CH','Europe/London':'GB','Europe/Dublin':'IE','Europe/Warsaw':'PL','Europe/Prague':'CZ','Europe/Bucharest':'RO','Europe/Sofia':'BG','Europe/Stockholm':'SE','Europe/Copenhagen':'DK','Europe/Oslo':'NO','Europe/Helsinki':'FI','Europe/Istanbul':'TR'};
    if (map[tz]) { add(map[tz]); return; }
    if (tz && !/^(UTC|Etc\/|GMT)/.test(tz)) import('/prices/tz-country-v102.mjs').then(function (m) { add(m.countryOfZone(tz)); }).catch(function () {});
  } catch (e) {}
})();
