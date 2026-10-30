// usage: node tools/grep-ctx.mjs <regex> <radius> <file...>  — prints each match with surrounding context (for reading minified chunks)
import { readFileSync } from 'node:fs';
const [pattern, radius, ...files] = process.argv.slice(2);
const re = new RegExp(pattern, 'g');
for (const f of files) {
  const text = readFileSync(f, 'utf8'); let m, n = 0;
  while ((m = re.exec(text)) && n < 6) { n++; console.log(`${f.split(/[\\/]/).pop()}@${m.index}: ${text.slice(Math.max(0, m.index - Number(radius)), m.index + m[0].length + Number(radius)).replace(/\s+/g, ' ')}\n`); }
}
