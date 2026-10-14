/* FoodScan boot guard (classic script, runs before the module app).
 * Detects the two most common "it doesn't work" situations and says so plainly. */
(function () {
  'use strict';
  function show(title, body) {
    var n = document.createElement('div');
    n.id = 'boot-notice';
    n.innerHTML = '<div class="boot-card" role="alert"><h2>' + title + '</h2><p>' + body + '</p></div>';
    (document.body || document.documentElement).appendChild(n);
  }
  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  if (location.protocol === 'file:') {
    onReady(function () {
      // Hide the dead static shell; explain the fix.
      var main = document.getElementById('main');
      if (main) main.style.display = 'none';
      var head = document.getElementById('header');
      if (head) head.style.display = 'none';
      show('This file can\u2019t run the app on its own.',
        'You opened index.html straight from the folder, so FoodScan\u2019s scripts are blocked and nothing will work. ' +
        'Upload the ZIP to Cloudflare Pages (Pages dashboard \u2192 Create \u2192 Direct Upload), or serve the folder over HTTP ' +
        '— for example <code>python3 -m http.server</code> — then open the http:// address it prints.');
    });
    return;
  }
  window.setTimeout(function () {
    if (!window.__foodscan_booted) {
      show('FoodScan couldn\u2019t start.',
        'Its scripts were blocked or failed to load. Make sure you\u2019re opening the deployed https:// address ' +
        '(not a file preview), check your connection, then reload. If it persists, the deployment may be missing the /assets/release-9.1.0/ folder.');
    }
  }, 7000);
})();
