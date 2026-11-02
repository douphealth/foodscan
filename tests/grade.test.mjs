import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP } from './helpers.mjs';

// 81: a salt value typed in the wrong unit (1.33 g stored as 0.003 g) made a bread read A instead of C. Such grades are withheld.
const domain = await import(pathToFileURL(path.join(APP, 'assets/domain-v8100.mjs')).href);
const dir = path.join(APP, 'assets/greece-r20261030');
const raw = code => { for (const f of fs.readdirSync(dir).filter(f => f.startsWith('part-'))) { const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).products.find(x => x.code === code); if (p) return p; } throw new Error(code); };
const grade = p => domain.assessGrade(domain.parseProduct({ status: 1, product: p }, p.code));
const BREAD = raw('5201673101314');
const fake = over => ({ ...BREAD, ...over, nutriments: { ...BREAD.nutriments, ...(over.nutriments || {}) } });

test('Karamolegkos Πολύσπορο (salt 0.0033 g in the source, 1.33 g on the label) gets no grade, with the reason', () => {
  const g = grade(raw('5201673101314')); assert.equal(g.status, 'withheld'); assert.equal(g.grade ?? null, null); assert.match(g.reasons.join(' '), /Salt of 0\.0033 g per 100 g is not plausible for bread/);
});

test('salty foods with near-zero salt are withheld; unsalted, pasta and "0 %" products are not', () => {
  assert.equal(grade(fake({})).status, 'withheld');
  assert.equal(grade(fake({ categories_tags: ['en:cheeses'], pnns_groups_2: 'Cheese', product_name: 'Gouda' })).status, 'withheld');
  for (const over of [{ product_name: 'ΓΡΑΒΙΕΡΑ ΑΝΑΛΑΤΗ' }, { product_name: 'Σπαγγέτι Νο10' }, { product_name: 'Πατατάκια 0%' }, { product_name: 'Ψωμί χωρίς αλάτι' }, { product_name: 'Unsalted bread' }, { labels_tags: ['en:no-added-salt'] }, { categories_tags: ['en:breads', 'en:seeds'] }])
    assert.notEqual(grade(fake(over)).status, 'withheld', JSON.stringify(over));
  assert.ok(!(grade(fake({ nutriments: { salt_100g: 1.33, salt: 1.33, sodium_100g: 0.532, sodium: 0.532 } })).reasons || []).some(r => /Salt of .* is not plausible/.test(r)), 'a normal salt value is not flagged');
});
