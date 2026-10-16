import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const html=await fs.readFile('index.html','utf8');
const map=html.split('<script type="importmap">')[1]?.split('</script>')[0];
assert(map,'Missing importmap');
const hash='sha256-'+crypto.createHash('sha256').update(map).digest('base64');
assert((await fs.readFile('_headers','utf8')).includes(hash),'CSP hash mismatch');
for(const file of Object.values(JSON.parse(map).imports)){await fs.stat('.'+file)}
for(const file of ['app','result','views','meal-diary','model'])await fs.stat('assets/release-11.14.0/'+file+'.js');
assert(html.includes('"softwareVersion":"11.15.0"'));
const css=await fs.readFile('assets/release-11.14.0/app.css','utf8');
assert(css.includes('.fs15-portion-results'));
console.log('FoodScan 11.14 integrity PASS');
