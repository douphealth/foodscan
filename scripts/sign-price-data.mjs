#!/usr/bin/env node
/** Signs the daily price data so FoodScan 101 will use it.
 *
 *  FoodScan 101 uses a remote price file (anything newer than the files bundled with the site) ONLY when
 *    1. the deployment has FOODSCAN_PRICE_DATA_PUBKEY (base64 of the raw 32-byte Ed25519 public key), and
 *    2. <data branch>/integrity.json carries `signed` (JSON text {v:1, built, files:{"<path>":"<sha256 hex>"}}) and `sig` (base64 Ed25519 signature of the UTF-8 bytes
 *       of `signed`) that verify with that key, `built` is not in the future and at most 10 days old, and
 *    3. the SHA-256 of the downloaded file equals the hash listed for its path.
 *  Anyone who can push to the data branch can change files but cannot sign them, so they cannot change a price on the site.
 *
 *    node scripts/sign-price-data.mjs keygen --out <private.pem>            one-off: writes the private key (never printed), prints the PUBLIC key to put in FOODSCAN_PRICE_DATA_PUBKEY
 *    node scripts/sign-price-data.mjs sign <data dir> --key <private.pem>   writes <data dir>/integrity.json (every *.json file in the folder, except integrity.json)
 *    node scripts/sign-price-data.mjs verify <data dir> --pub <base64>      what the worker does: signature, age, every hash
 *
 *  The private key lives only in the repository secret PRICE_DATA_SIGNING_KEY (see .github/workflows/refresh-prices.yml). */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const NAME = /^[a-z0-9][a-z0-9\-_/.]*\.json$/i;
const MAX_AGE_DAYS = 10;

export const rawPublicKey = publicKey => Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
const publicFromRaw = b64 => crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(b64, 'base64').toString('base64url') }, format: 'jwk' });

export function listJson(dir) {
  const out = [];
  const walk = d => { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) { if (n !== '.git') walk(p); } else if (n.endsWith('.json')) out.push(path.relative(dir, p).split(path.sep).join('/')); } };
  walk(dir);
  return out.filter(f => f !== 'integrity.json');
}

export function signDir(dir, privatePem, built = new Date().toISOString()) {
  const files = {}, skipped = [];
  for (const rel of listJson(dir)) {
    if (!NAME.test(rel) || rel.includes('..')) { skipped.push(rel); continue; }
    files[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, rel))).digest('hex');
  }
  const signed = JSON.stringify({ v: 1, built, files });
  const sig = crypto.sign(null, Buffer.from(signed, 'utf8'), crypto.createPrivateKey(privatePem)).toString('base64');
  fs.writeFileSync(path.join(dir, 'integrity.json'), JSON.stringify({ signed, sig }));
  return { files: Object.keys(files).length, skipped, built };
}

/** Mirrors the worker (fsRemoteManifestLoad + fsRemoteJSON). Returns {ok, reason?, files?, built?, mismatches?}. */
export function verifyDir(dir, pubB64, now = Date.now()) {
  let m; try { m = JSON.parse(fs.readFileSync(path.join(dir, 'integrity.json'), 'utf8')); } catch { return { ok: false, reason: 'no_manifest' }; }
  if (typeof m?.signed !== 'string' || typeof m?.sig !== 'string') return { ok: false, reason: 'unsigned' };
  let good = false; try { good = crypto.verify(null, Buffer.from(m.signed, 'utf8'), publicFromRaw(pubB64), Buffer.from(m.sig, 'base64')); } catch { return { ok: false, reason: 'key_or_signature_format' }; }
  if (!good) return { ok: false, reason: 'bad_signature' };
  const body = JSON.parse(m.signed), built = Date.parse(body?.built || '');
  if (body?.v !== 1 || !body.files || !Number.isFinite(built)) return { ok: false, reason: 'fields' };
  if (built > now + 3600e3) return { ok: false, reason: 'built_in_future' };
  if (now - built > MAX_AGE_DAYS * 864e5) return { ok: false, reason: 'stale' };
  const mismatches = [];
  for (const [rel, want] of Object.entries(body.files)) {
    const f = path.join(dir, rel);
    if (!fs.existsSync(f) || crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') !== want) mismatches.push(rel);
  }
  return { ok: mismatches.length === 0, reason: mismatches.length ? 'hash_mismatch' : undefined, files: Object.keys(body.files).length, built: body.built, mismatches };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, a] = process.argv.slice(2), arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
  try {
    if (cmd === 'keygen') {
      const out = arg('--out'); if (!out) throw new Error('keygen needs --out <private.pem>');
      if (fs.existsSync(out)) throw new Error(`${out} exists: it is not overwritten`);
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      fs.writeFileSync(out, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
      console.log(`private key written to ${out} (keep it secret: store it as the repository secret PRICE_DATA_SIGNING_KEY, then delete the file)\nFOODSCAN_PRICE_DATA_PUBKEY=${rawPublicKey(publicKey)}`);
    } else if (cmd === 'sign') {
      const key = arg('--key'); if (!a || !key) throw new Error('usage: sign <data dir> --key <private.pem>');
      const r = signDir(path.resolve(a), fs.readFileSync(key, 'utf8'));
      console.log(`signed ${r.files} files (built ${r.built})` + (r.skipped.length ? `; skipped (name not allowed): ${r.skipped.join(', ')}` : ''));
    } else if (cmd === 'verify') {
      const pub = arg('--pub'); if (!a || !pub) throw new Error('usage: verify <data dir> --pub <base64 raw public key>');
      const r = verifyDir(path.resolve(a), pub); console.log(r.ok ? `OK: ${r.files} files verified (built ${r.built})` : `FAILED: ${r.reason}${r.mismatches?.length ? ' ' + r.mismatches.slice(0, 5).join(', ') : ''}`); process.exit(r.ok ? 0 : 1);
    } else throw new Error('commands: keygen | sign | verify');
  } catch (e) { console.error(e.message); process.exit(2); }
}
