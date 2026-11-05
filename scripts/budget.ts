/**
 * Bundle budget: the gzipped JavaScript must stay under 400 KB (audio
 * excluded; there is none, it is synthesised). Run after `vite build`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT = 400 * 1024;
const dir = join(process.cwd(), 'dist', 'assets');
let js = 0;
let css = 0;
let fonts = 0;
const rows: string[] = [];
for (const f of readdirSync(dir)) {
  const p = join(dir, f);
  if (!statSync(p).isFile()) continue;
  const raw = readFileSync(p);
  const gz = gzipSync(raw).length;
  if (f.endsWith('.js')) js += gz;
  else if (f.endsWith('.css')) css += gz;
  else if (f.endsWith('.woff2')) fonts += raw.length;
  rows.push(`${f.padEnd(40)} ${(raw.length / 1024).toFixed(1).padStart(8)} KB  gz ${(gz / 1024).toFixed(1).padStart(7)} KB`);
}
console.log(rows.join('\n'));
console.log(`\nJS gzipped: ${(js / 1024).toFixed(1)} KB (budget ${(LIMIT / 1024).toFixed(0)} KB); CSS gzipped: ${(css / 1024).toFixed(1)} KB; fonts: ${(fonts / 1024).toFixed(1)} KB`);
if (js > LIMIT) {
  console.error('Bundle budget exceeded.');
  process.exit(1);
}
console.log('Bundle budget: ok');
