/* FoodScan 74 · minimal robots.txt reader (RFC 9309): the group for our product token or "*", longest match wins,
 * Allow beats Disallow on equal length, "*" wildcard and "$" end anchor. Used before every crawl cycle; a path that
 * robots.txt does not allow is never fetched. */
export function parseRobots(text, agent = 'foodscan') {
  const groups = []; let cur = null, lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (!cur) continue;
    if (k === 'allow' || k === 'disallow') cur.rules.push({ allow: k === 'allow', path: v });
  }
  const sitemaps = [...String(text || '').matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map(m => m[1]);
  const mine = groups.filter(g => g.agents.some(a => a !== '*' && agent.toLowerCase().includes(a)));
  const rules = (mine.length ? mine : groups.filter(g => g.agents.includes('*'))).flatMap(g => g.rules);
  return { rules, sitemaps };
}
const toRe = p => new RegExp('^' + p.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$|\$$/, '$'));
export function allowed(robots, pathAndQuery) {
  let best = null;
  for (const r of robots.rules) {
    if (!r.path) continue;               // "Disallow:" (empty) allows everything
    if (!toRe(r.path).test(pathAndQuery)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
  }
  return best ? best.allow : true;
}
export async function sha1(text) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
