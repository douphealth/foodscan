#!/usr/bin/env node
/** Derives category-tag -> family from a catalogue that is already partitioned (tags where >= 90% of >= 5 records agree), so a refreshed
 * catalogue is partitioned the way the shipped one is. Writes src/family-tags.json. */
import { writeFileSync } from 'node:fs';
import { catalogue } from '../tests/helpers.mjs';
const { records } = catalogue(), stat = new Map();
for (const { raw, family } of records) for (const tag of new Set(raw.categories_tags || [])) { const m = stat.get(tag) || stat.set(tag, new Map()).get(tag); m.set(family, (m.get(family) || 0) + 1); }
const map = {};
for (const [tag, m] of stat) { const total = [...m.values()].reduce((a, b) => a + b, 0), [family, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; if (family !== 'other' && total >= 5 && n / total >= 0.9) map[tag] = family; }
// PNNS group 2 (assigned by Open Food Facts) covers the records that carry no category tags at all
const pn = new Map();
for (const { raw, family } of records) { if ((raw.categories_tags || []).length || !raw.pnns_groups_2 || /^unknown$/i.test(raw.pnns_groups_2)) continue; const m = pn.get(raw.pnns_groups_2) || pn.set(raw.pnns_groups_2, new Map()).get(raw.pnns_groups_2); m.set(family, (m.get(family) || 0) + 1); }
const pnns = {};
for (const [g, m] of pn) { const total = [...m.values()].reduce((a, b) => a + b, 0), [family, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; if (family !== 'other' && total >= 5 && n / total >= 0.6) pnns[g] = family; }
writeFileSync(new URL('../src/family-tags.json', import.meta.url), JSON.stringify({ tags: Object.fromEntries(Object.entries(map).sort()), pnns }));
console.log(Object.keys(map).length, 'tags', Object.keys(pnns).length, 'pnns groups');
