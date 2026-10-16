export * from '/assets/release-11.9.0/result.js';
import {resultSummary as previous} from '/assets/release-11.9.0/result.js';
import {escapeHTML as e} from './model.js';
export function resultSummary(p,s){const html=previous(p,s);if(!p.connection?.stale)return html;const at=Number.isFinite(p.fetchedAt)?new Date(p.fetchedAt).toLocaleString():'date unavailable';return `<p class="v20-snapshot" role="note">Saved product snapshot · ${e(at)}. Live refresh is unavailable. Verify the current package before relying on these facts.</p>`+html;}
