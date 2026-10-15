import { escapeHTML as e, VERSION } from './model.js';
import { icon as i } from './icons.js';
function attemptRow(a) {
  const success = a.outcome === 'success';
  return `<div class="list-row"><span class="tile-icon" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:${success?'var(--olive-soft)':'var(--paper-2)'};color:${success?'var(--olive)':'var(--bark)'}">${i(success ? 'check' : 'wifi')}</span><div class="lr-main"><div class="lr-name">${a.transport === 'direct' ? 'Browser to Open Food Facts' : 'Browser to FoodScan server'}</div><div class="lr-sub">${success ? 'Matching product received' : e(a.errorCode || 'Request did not complete')} · ${Number(a.elapsedMs || 0)} ms${a.httpStatus ? ` · HTTP ${Number(a.httpStatus)}` : ' · No HTTP response'}${a.cache ? ` · Cache ${e(a.cache)}` : ''}</div>${a.requestId ? `<div class="lr-sub">Request reference: ${e(a.requestId)}</div>` : ''}</div></div>`;
}
export function connectionView(s) {
  const d = s.connection || {}, report = d.report, healthy = report?.outcome === 'success';
  const code = d.barcode || s.requested || '3017624010701';
  return `<div class="container"><div class="section-head"><div><span class="eyebrow"><span class="dot"></span>Clear answers, even when something fails</span><h1>Check the <em style="font-style:italic;color:var(--terra)">connection.</em></h1><p class="lead">Test the actual barcode lookup. A working website alone does not prove the food database is reachable. <span class="unverified-tag">FoodScan ${VERSION}</span></p></div><a class="link-button" href="#home">${i('back')} Back to scan</a></div>
  <div class="grid-2"><div>
    <div class="form-card" style="margin-top:0"><span class="eyebrow">One real request. No demo data.</span><h3 class="mt-1">Try your package barcode.</h3>
    <form id="connection-form" novalidate class="mt-2"><label class="field-label" for="connection-barcode">Barcode number<input id="connection-barcode" name="barcode" inputmode="numeric" autocomplete="off" maxlength="30" value="${e(code)}"></label>
    <button class="button button-primary" type="submit"${d.busy ? ' disabled' : ''}>${i(d.busy ? 'clock' : 'wifi')} ${d.busy ? 'Checking...' : 'Run connection check'}</button></form>
    <p class="small muted mt-2">Uses Open Food Facts. Camera images are never sent.</p>
    <div role="status" aria-live="polite">${d.busy ? `<p><span class="spinner" style="width:30px;height:30px;margin:0;display:inline-block;vertical-align:middle"></span> ${e(d.progress || 'Checking the FoodScan backend...')}</p>` : ''}</div>
    ${d.error ? `<div class="notice warning">${i('info')}<div>${e(d.error)}${d.retryAfter ? `<p>Wait approximately ${Number(d.retryAfter)} seconds before retrying.</p>` : ''}</div></div>` : ''}</div>
    ${report ? `<div class="form-card"><div class="modal-head"><div><span class="eyebrow">${healthy ? 'Exact barcode match received' : report.outcome === 'not_found' ? 'Database reached. Record missing.' : 'No successful product response'}</span><h3>${healthy ? 'Matching barcode response received' : report.outcome === 'not_found' ? 'This barcode is not listed yet.' : 'Here is where the request stopped.'}</h3></div><span class="tile-icon" style="width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:${healthy?'var(--olive-soft)':'var(--gold-soft)'}">${i(healthy ? 'check' : 'info')}</span></div>
    <p class="small muted">${healthy ? 'This confirms a matching database record was returned, not that its label details are independently verified.' : 'A failed connection must not be confused with a product that does not exist.'}</p>
    <div class="list-panel mt-2">${(report.attempts || []).map(attemptRow).join('')}</div>
    <div class="button-row"><button class="button button-outline button-sm" data-action="copy-diagnostics">${i('share')} Copy diagnostic report</button></div></div>`
    : `<div class="form-card">${'<span class="empty-icon">' + i('list') + '</span>'}<h3>No test result yet.</h3><p class="muted">Run the check above. We will show the response status, timing and which connection was used.</p></div>`}
  </div><div>
    <div class="form-card" style="margin-top:0"><h3>Your app environment</h3>
    <div class="list-panel mt-2">${[['App version', VERSION], ['Secure context', globalThis.isSecureContext ? 'Yes' : 'No / unavailable'], ['Browser network signal', s.online ? 'Online signal' : 'Offline signal'], ['FoodScan backend', d.health ? d.health.outcome === 'ready' ? `Responded (${e(d.health.version)})` : 'Did not respond correctly' : 'Not checked']].map(([k, v]) => `<div class="list-row"><div class="lr-main"><div class="lr-sub">${k}</div><div class="lr-name">${v}</div></div></div>`).join('')}</div>
    <p class="small muted mt-2">An online signal is not proof of internet access. Backend health does not test Open Food Facts.</p></div>
    <div class="form-card"><span class="tile-icon" style="width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:var(--olive-soft);color:var(--olive)">${i('shield')}</span><h3 class="mt-1">Same database. A second route.</h3><p class="muted">If the server cannot connect, FoodScan can request the same public record directly from your browser. It never guesses another product. Rate limits, access denials and confirmed missing products do not trigger automatic retries.</p><a class="link-button" href="#privacy">How requests use your data ${i('arrow')}</a></div>
  </div></div></div>`;
}
