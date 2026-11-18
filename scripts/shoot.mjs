#!/usr/bin/env node
// Screenshots the built site (dist/) into .cache/shots/ so the daily run can look at it:
// desktop and phone, light and dark, sliced into screen-height pieces, plus a tune-mode shot.
//   node scripts/shoot.mjs [--page index.html] [--out .cache/shots]
// Needs a Chrome or Edge. Set CHROME_PATH to use a specific one; otherwise common install
// locations are tried, then Puppeteer's own download (npx puppeteer browsers install chrome).
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const base = '/mind-and-cancer-daily/';
const dist = join(root, 'dist');
const out = join(root, arg('out', '.cache/shots'));
const route = arg('page', '');
if (!existsSync(dist)) {
  console.error('dist/ not found: run npm run build first');
  process.exit(1);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(base)) { res.writeHead(404); return res.end('not found'); }
  p = normalize(p.slice(base.length));
  let file = join(dist, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(dist) || !existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = candidates.find((c) => existsSync(c));

const { default: puppeteer } = await import('puppeteer');
let browser;
try {
  browser = await puppeteer.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
} catch (e) {
  server.close();
  console.error(`Could not start a browser (${e.message.split('\n')[0]}). Set CHROME_PATH or run: npx puppeteer browsers install chrome`);
  process.exit(2);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const variants = [
  { name: 'desktop-light', width: 1280, height: 900, scheme: 'light' },
  { name: 'desktop-dark', width: 1280, height: 900, scheme: 'dark' },
  { name: 'phone-light', width: 390, height: 844, scheme: 'light', mobile: true },
  { name: 'phone-dark', width: 390, height: 844, scheme: 'dark', mobile: true },
];
const MAX_SLICES = Number(arg('slices', 4));
const written = [];
for (const v of variants) {
  const page = await browser.newPage();
  await page.setViewport({ width: v.width, height: v.height, deviceScaleFactor: 1, isMobile: !!v.mobile, hasTouch: !!v.mobile });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: v.scheme }]);
  await page.goto(`http://127.0.0.1:${port}${base}${route}${route.includes('?') ? '&' : '?'}tune=${v.name === 'desktop-light' ? '1' : '0'}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  // let the one-off entrance animations finish (never waits on an endless one)
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 3000))]));
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) console.warn(`warning: ${v.name} scrolls sideways by ${overflow}px`);
  const slices = Math.min(MAX_SLICES, Math.ceil(total / v.height));
  for (let i = 0; i < slices; i++) {
    const file = join(out, `${v.name}-${i + 1}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: i * v.height, width: v.width, height: Math.min(v.height, total - i * v.height) } });
    written.push(file);
  }
  await page.close();
}
await browser.close();
server.close();
console.log(`Wrote ${written.length} screenshots to ${out}`);
