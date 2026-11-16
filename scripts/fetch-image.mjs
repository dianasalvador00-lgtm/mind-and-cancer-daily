#!/usr/bin/env node
// Downloads one figure, re-encodes it to webp (max 1600 px wide) under public/img/<date>/<slug>.webp
// and writes a preview PNG to .cache/preview/<slug>.png so it can be looked at before use.
//
//   node scripts/fetch-image.mjs <image-url> <YYYY-MM-DD> <slug>
//
// This script does NOT check licences. The daily run may only use a figure whose open licence
// (CC BY, CC BY-SA, CC0, public domain, US government work) it has read on the source page,
// and must record that licence, the credit and the credit URL in the issue's image object.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const [url, date, slug] = process.argv.slice(2);
if (!url || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^[a-z0-9-]{2,60}$/.test(slug ?? '')) {
  console.error('usage: node scripts/fetch-image.mjs <https-image-url> <YYYY-MM-DD> <slug>');
  process.exit(2);
}
if (!/^https:\/\//.test(url)) {
  console.error('only https image URLs are allowed');
  process.exit(2);
}
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MindCancerDailyBot/1.0)' }, signal: AbortSignal.timeout(30_000), redirect: 'follow' });
if (!res.ok) {
  console.error(`download failed: HTTP ${res.status}`);
  process.exit(1);
}
const type = res.headers.get('content-type') ?? '';
if (!/^image\//.test(type)) {
  console.error(`not an image (${type})`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const img = sharp(buf, { limitInputPixels: 80_000_000 }).rotate();
const meta = await img.metadata();
if ((meta.width ?? 0) < 400) {
  console.error(`too small (${meta.width}px wide); a figure must stay legible`);
  process.exit(1);
}
const outDir = join(root, 'public', 'img', date);
const prevDir = join(root, '.cache', 'preview');
mkdirSync(outDir, { recursive: true });
mkdirSync(prevDir, { recursive: true });
const webp = await img.clone().resize({ width: 1600, withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 82 }).toBuffer();
writeFileSync(join(outDir, `${slug}.webp`), webp);
await img.clone().resize({ width: 900, withoutEnlargement: true }).flatten({ background: '#ffffff' }).png().toFile(join(prevDir, `${slug}.png`));
console.log(`public/img/${date}/${slug}.webp  (${meta.width}x${meta.height}, ${Math.round(webp.length / 1024)} KB)`);
console.log(`preview: .cache/preview/${slug}.png (open it and look before using)`);
console.log(`image.src to use: img/${date}/${slug}.webp`);
