/** Minimal deterministic ZIP writer (deflate, fixed timestamps, sorted entries, forward slashes): the same tree always gives the same bytes.
 * Also lists/reads a ZIP central directory so tests can verify a built package without unzip. */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync, inflateRawSync, crc32 } from 'node:zlib';

const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 30; // 2026-10-30, constant

export function listFiles(root) {
  const out = [];
  const walk = d => { for (const e of readdirSync(d).sort()) { const f = join(d, e); statSync(f).isDirectory() ? walk(f) : out.push(f); } };
  walk(root);
  return out.map(f => ({ abs: f, rel: relative(root, f).split(sep).join('/') })).sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

export function writeZip(root, target, { exclude = () => false } = {}) {
  const files = listFiles(root).filter(f => !exclude(f.rel));
  const parts = [], central = []; let offset = 0;
  for (const f of files) {
    const data = readFileSync(f.abs), name = Buffer.from(f.rel, 'utf8');
    const method = data.length > 64 ? 8 : 0, body = method ? deflateRawSync(data, { level: 9 }) : data, crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6); header.writeUInt16LE(method, 8);
    header.writeUInt16LE(DOS_TIME, 10); header.writeUInt16LE(DOS_DATE, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(body.length, 18); header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26); header.writeUInt16LE(0, 28);
    parts.push(header, name, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(method, 10);
    c.writeUInt16LE(DOS_TIME, 12); c.writeUInt16LE(DOS_DATE, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += header.length + name.length + body.length;
  }
  const centralBuf = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  writeFileSync(target, Buffer.concat([...parts, centralBuf, end]));
  return files.length;
}

/** Entries of a ZIP: [{ name, size, read() }]. */
export function readZip(file) {
  const buf = readFileSync(file);
  let eocd = buf.length - 22; while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16); const out = [];
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    out.push({ name, size: usize, read: () => { const lh = off, n = buf.readUInt16LE(lh + 26), e = buf.readUInt16LE(lh + 28), start = lh + 30 + n + e, raw = buf.subarray(start, start + csize); return method ? inflateRawSync(raw) : Buffer.from(raw); } });
    p += 46 + nlen + elen + clen;
  }
  return out;
}
