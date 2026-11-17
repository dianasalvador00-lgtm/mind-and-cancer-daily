#!/usr/bin/env node
// Finds real images the daily run may use, with their licence, so a picture always comes from a
// source and is never invented.
//
//   node scripts/find-images.mjs page <article-url>     images on a source page, plus any licence the page states
//   node scripts/find-images.mjs commons "<query>"      Wikimedia Commons files with licence and author
//   node scripts/find-images.mjs paper <doi>            open-access figures of a paper (Europe PMC)
//
// Use an image only when its licence maps to one the schema allows (CC-BY, CC-BY-SA, CC-BY-NC,
// CC-BY-NC-SA, CC0, public-domain, US-gov). Then download it with scripts/fetch-image.mjs, look at
// the preview, and fill the image object (src, alt, credit, creditUrl, licence, fit).
import { execFileSync } from 'node:child_process';
import { get, json, decode } from './sources/util.mjs';

const [mode, arg] = process.argv.slice(2);
const UA_COMMONS = 'MindCancerDailyBot/1.0 (https://github.com/dianasalvador00-lgtm/mind-and-cancer-daily)';

/** Map a licence name to the schema's enum, or null when it may not be used (ND, all rights reserved, unknown). */
export function mapLicence(name) {
  const s = String(name ?? '').toLowerCase();
  if (!s) return null;
  if (/\bnd\b|no.?deriv|by-nc-nd|by-nd/.test(s)) return null;
  if (/cc0|cc-zero|creative commons zero/.test(s)) return 'CC0';
  if (/public domain|^pd\b|pd-/.test(s)) return 'public-domain';
  if (/by-nc-sa/.test(s)) return 'CC-BY-NC-SA';
  if (/by-nc/.test(s)) return 'CC-BY-NC';
  if (/by-sa/.test(s)) return 'CC-BY-SA';
  if (/cc[ -]?by\b|attribution/.test(s)) return 'CC-BY';
  return null;
}

async function page(url) {
  const html = await get(url, { accept: 'text/html,*/*' });
  const abs = (u) => {
    try { return new URL(decode(u), url).toString(); } catch { return null; }
  };
  const found = new Map();
  const add = (u, why, alt = '') => {
    const a = abs(u);
    if (a && /^https:/.test(a) && !/\.(svg|gif)(\?|$)/i.test(a) && !/logo|icon|avatar|sprite|pixel|badge/i.test(a)) found.set(a, found.get(a) ?? { why, alt });
  };
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*>/gi)) {
    const c = m[0].match(/content=["']([^"']+)["']/i)?.[1];
    if (c) add(c, 'share image');
  }
  for (const m of html.matchAll(/<figure[\s\S]*?<\/figure>/gi)) {
    const src = m[0].match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i)?.[1];
    const cap = decode(m[0].match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (src) add(src, 'figure', cap.slice(0, 160));
  }
  const licences = new Set();
  for (const m of html.matchAll(/creativecommons\.org\/(licenses|publicdomain)\/[a-z\-\/0-9.]+/gi)) licences.add(m[0]);
  for (const m of html.matchAll(/rel=["']license["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["']license["']/gi)) licences.add(m[1] ?? m[2]);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  for (const m of text.matchAll(/\b(CC[ -]BY(?:[ -](?:NC|SA|ND)){0,2}(?: \d\.\d)?|CC0|public domain)\b/gi)) licences.add(m[1]);
  console.log(`PAGE: ${url}`);
  console.log(`LICENCE HINTS: ${licences.size ? [...licences].slice(0, 6).join(' | ') : 'none found (treat the images as all rights reserved: do not use them)'}`);
  const mapped = [...licences].map(mapLicence).filter(Boolean);
  console.log(`USABLE LICENCE: ${mapped[0] ?? 'none'}  (check that the licence covers the image itself, not only the text)`);
  console.log('IMAGES:');
  for (const [u, { why, alt }] of [...found].slice(0, 12)) console.log(` [${why}] ${u}${alt ? `  | ${alt}` : ''}`);
}

async function commons(query) {
  const q = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '10', gsrsearch: `${query} filetype:bitmap`,
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1600', origin: '*',
  });
  const data = await json(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: { 'User-Agent': UA_COMMONS } });
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (!pages.length) return console.log('No files found. Try simpler words (an organ, a cell type, an instrument).');
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const md = ii.extmetadata ?? {};
    const lic = md.LicenseShortName?.value ?? '';
    const strip = (s) => decode(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const mapped = mapLicence(lic) ?? (/^public domain/i.test(lic) ? 'public-domain' : null);
    console.log(`- ${p.title.replace(/^File:/, '')}`);
    console.log(`  image: ${ii.thumburl ?? ii.url}  (${ii.width}x${ii.height})`);
    console.log(`  licence: ${lic || 'unknown'} -> ${mapped ?? 'NOT USABLE'} | author: ${strip(md.Artist?.value).slice(0, 80) || 'unknown'}`);
    console.log(`  creditUrl: ${ii.descriptionurl}`);
    console.log(`  description: ${strip(md.ImageDescription?.value).slice(0, 160)}`);
  }
}

if (mode === 'page' && arg) await page(arg);
else if (mode === 'commons' && arg) await commons(arg);
else if (mode === 'paper' && arg) {
  const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  process.stdout.write(execFileSync(process.execPath, [`${root}/scripts/read-paper.mjs`, arg, '--figures'], { encoding: 'utf8' }));
} else {
  console.error('usage: node scripts/find-images.mjs page <url> | commons "<query>" | paper <doi>');
  process.exit(2);
}
