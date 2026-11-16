#!/usr/bin/env node
// Checks everything the daily run writes before it is committed or deployed:
//  - every issue and week parses against src/kit/schema.mjs, file names match, numbering continues
//  - no em dash or en dash anywhere in site text or source files
//  - no hype words, no medical advice, nothing private in public text
//  - evidence labels agree with sources (preprint hosts), method sources are protocol hosts
//  - images exist, are credited and licensed; the Learn section has a diagram or an image
//  - nothing is featured twice (kept issues and data/seen.json); palettes are not repeated
//  - the palette catalogue passes its contrast and colour-blind checks; UI strings are complete
// Exit code 1 on any error; warnings print and pass.
//
//   node scripts/validate.mjs            validates data/
//   node scripts/validate.mjs --fixture  also validates scripts/fixtures/*.json (layout samples)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { Issue, Week, strings, METHOD_HOSTS } from '../src/kit/schema.mjs';
import { PALETTES, checkPalettes, getPalette } from '../src/kit/palette.mjs';
import { UI } from '../src/kit/i18n.mjs';
import { issueKeys, readSeen } from './identity.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const fixtureMode = process.argv.includes('--fixture');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const rules = JSON.parse(readFileSync(join(root, 'config', 'rules.json'), 'utf8'));
const topics = existsSync(join(root, 'config', 'topics.json')) ? JSON.parse(readFileSync(join(root, 'config', 'topics.json'), 'utf8')) : null;
const re = (list) => list.map((p) => new RegExp(p, 'i'));
const BANNED = new RegExp(`\\b(${rules.bannedWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
const ADVICE = re(rules.medicalAdvicePatterns);
const PRIVATE = re(rules.privatePatterns);
const READER = re(rules.publicReaderPatterns);
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`); // en and em dash, built from code points so this file stays clean

const list = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    err(`${relative(root, p)}: not valid JSON (${e.message})`);
    return null;
  }
};
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};
const hostIn = (h, hosts) => hosts.some((x) => h === x || h.endsWith(`.${x}`));
const isForYou = (path) => /(^|\.)forYou$/.test(path);
const isRealTitle = (path) => /(^|\.)bench\[\d+\]\.title$/.test(path) || /\.sources(\[\d+\])?\.label$/.test(path) || /(^|\.)source\.label$/.test(path) || /deepRead\.title$/.test(path);

// ------------------------------------------------------------ source files and catalogues
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', '.astro', '.cache', 'inbox', 'package-lock.json'].includes(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (['.md', '.json', '.mjs', '.ts', '.astro', '.css', '.yml', '.yaml', '.html', '.txt', '.svg'].includes(extname(name))) yield p;
  }
}
for (const p of walk(root)) {
  if (relative(root, p).replace(/\\/g, '/') === 'data/seen.json') continue;
  const lines = readFileSync(p, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (DASH.test(l)) err(`${relative(root, p)}:${i + 1}: contains an em or en dash`);
  });
}
for (const p of checkPalettes()) err(p);
for (const lang of Object.keys(UI)) {
  for (const k of Object.keys(UI.en)) if (!(k in UI[lang]) || !String(UI[lang][k]).trim()) err(`i18n: ${lang} is missing "${k}"`);
}

// ------------------------------------------------------------ one document's text rules
function checkText(label, doc, { isIssue }) {
  for (const [path, s] of strings(doc)) {
    if (path.endsWith('.url') || path.endsWith('.creditUrl') || path.endsWith('.doi') || path.endsWith('.src') || path.endsWith('.nct')) continue;
    if (!isRealTitle(path) && BANNED.test(s)) err(`${label} ${path}: hype word "${s.match(BANNED)[0]}"`);
    for (const r of ADVICE) if (r.test(s)) err(`${label} ${path}: reads like medical advice (${r})`);
    for (const r of PRIVATE) if (r.test(s)) err(`${label} ${path}: private detail matches ${r}`);
    if (!isForYou(path)) for (const r of READER) if (r.test(s)) err(`${label} ${path}: public text addresses a single reader (${r}); move it to forYou`);
    if ((s.match(/\*\*/g) ?? []).length % 2) err(`${label} ${path}: unbalanced ** bold markers`);
    if (/<\/?[a-z][^>]*>/i.test(s)) err(`${label} ${path}: contains HTML, which is never rendered`);
    for (const m of s.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) if (!/^https:\/\//.test(m[1])) err(`${label} ${path}: inline link is not https (${m[1]})`);
  }
  if (!isIssue) return;
  // evidence agrees with sources
  const items = [...doc.top.map((x, i) => [`top[${i}]`, x]), ...doc.bench.map((x, i) => [`bench[${i}]`, x]), ['curiosity', doc.curiosity]];
  for (const [p, it] of items) {
    const pre = it.sources.some((s) => hostIn(host(s.url), rules.preprintHosts));
    if (pre && !['preprint', 'news', 'press-release', 'commentary'].includes(it.evidence.type)) err(`${label} ${p}: cites a preprint server but evidence is "${it.evidence.type}"`);
    if (!pre && it.evidence.type === 'preprint' && it.sources.length === 1 && !/rxiv|arxiv|preprint/i.test(it.sources[0].url)) warn(`${label} ${p}: labelled preprint but the source is not a preprint server`);
  }
  doc.top.forEach((s, i) => {
    if (['animal', 'in-vitro', 'organoid'].includes(s.evidence.type) && !s.didNotShow) warn(`${label} top[${i}] ${s.id}: preclinical item without didNotShow`);
  });
  // method must come from a protocol or methods source
  const mh = host(doc.method.source.url);
  if (!hostIn(mh, METHOD_HOSTS)) err(`${label} method.source: ${mh} is not an allowed protocol host (${METHOD_HOSTS.join(', ')})`);
  if (mh === 'nature.com' && !/\/(nprot|articles\/nprot)/.test(doc.method.source.url) && !doc.method.source.doi) warn(`${label} method.source: nature.com link should be Nature Protocols or carry the paper DOI`);
  if (!/institution|safety|rules|supervisor|guidelines/i.test(doc.method.safety)) warn(`${label} method.safety should remind readers to follow institutional safety rules`);
  // unique ids
  const ids = new Set();
  const all = [...doc.top, ...doc.bench, doc.method, doc.curiosity, ...doc.trials.trials, ...doc.trials.funding, ...doc.chatter, ...doc.jobs];
  for (const x of all) {
    if (ids.has(x.id)) err(`${label}: duplicate id ${x.id}`);
    ids.add(x.id);
  }
  for (const id of doc.learn.seenIn ?? []) if (!ids.has(id)) err(`${label} learn.seenIn: unknown id ${id}`);
  // palette
  if (!getPalette(doc.palette)) err(`${label}: unknown palette "${doc.palette}"`);
  // readability warnings
  const defined = (item) => new Set((item.terms ?? []).map((t) => t.term.toLowerCase()));
  for (const s of doc.top) {
    if (s.gist.split(/\s+/).length > 32) warn(`${label} ${s.id}: gist over 32 words`);
    const d = defined(s);
    for (const m of new Set(s.gist.match(/\b[A-Z]{2,6}[a-z]?\b/g) ?? [])) {
      if (!rules.acronymAllowlist.includes(m) && !d.has(m.toLowerCase())) warn(`${label} ${s.id}: acronym ${m} in the gist is not defined in terms`);
    }
  }
}

function checkImages(label, doc, date) {
  const seen = new Set();
  const collect = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(collect);
    if (o.src && o.credit) {
      if (!o.src.startsWith(`img/${date}/`)) err(`${label}: image ${o.src} must live under img/${date}/`);
      if (!fixtureMode && !existsSync(join(root, 'public', o.src))) err(`${label}: image file public/${o.src} is missing`);
      seen.add(o.src);
    }
    Object.values(o).forEach(collect);
  };
  collect(doc);
}

// ------------------------------------------------------------ issues
const issues = [];
const loadIssues = (dir, label) => {
  for (const f of list(dir, '.json')) {
    const raw = readJson(join(dir, f));
    if (!raw) continue;
    const r = Issue.safeParse(raw);
    if (!r.success) {
      for (const i of r.error.issues) err(`${label}/${f}: ${i.path.join('.') || '(root)'}: ${i.message}`);
      continue;
    }
    if (f !== `${r.data.date}.json`) err(`${label}/${f}: file name must be ${r.data.date}.json`);
    issues.push({ f, label, ...r.data });
  }
};
loadIssues(join(root, 'data', 'issues'), 'data/issues');
if (fixtureMode) loadIssues(join(root, 'scripts', 'fixtures'), 'fixtures');

const real = issues.filter((i) => i.label === 'data/issues').sort((a, b) => a.date.localeCompare(b.date));
for (const i of issues) {
  checkText(`${i.label}/${i.f}`, i, { isIssue: true });
  checkImages(`${i.label}/${i.f}`, i, i.date);
}

// numbering, palettes, dedupe: only for real issues
if (real.length > 7) err(`data/issues has ${real.length} issues; the kept maximum is 7 (run npm run prune)`);
real.forEach((i, idx) => {
  if (idx > 0 && i.number !== real[idx - 1].number + 1) err(`${i.f}: number ${i.number} should be ${real[idx - 1].number + 1}`);
  const before = real.slice(Math.max(0, idx - 7), idx).map((x) => x.palette);
  if (before.includes(i.palette)) err(`${i.f}: palette ${i.palette} was used within the previous 7 issues`);
});

const seenMemory = readSeen(root);
const first = new Map();
for (const i of real) {
  for (const { id, kind, keys, repeatable } of issueKeys(i)) {
    for (const k of keys) {
      if (first.has(k) && first.get(k).date !== i.date && !repeatable) err(`${i.f}: ${kind} "${id}" repeats ${k} from ${first.get(k).date}`);
      if (seenMemory[k] && !repeatable) err(`${i.f}: ${kind} "${id}" was already featured on ${seenMemory[k]} (data/seen.json, ${k})`);
      if (!first.has(k)) first.set(k, { date: i.date, id });
    }
  }
}

// area mix over the kept issues (warning only)
if (topics?.areas && real.length) {
  const counts = {};
  let total = 0;
  for (const i of real) for (const x of [...i.top, ...i.bench, ...i.chatter, i.curiosity]) {
    counts[x.area] = (counts[x.area] ?? 0) + 1;
    total++;
  }
  for (const [area, cfg] of Object.entries(topics.areas)) {
    const pct = ((counts[area] ?? 0) / total) * 100;
    if (Math.abs(pct - cfg.share) > 15) warn(`area mix: ${area} is ${pct.toFixed(0)}% of items over the kept issues, target ${cfg.share}%`);
  }
}

// ------------------------------------------------------------ weeks
const weekDir = join(root, 'data', 'weeks');
const weeks = [];
for (const f of list(weekDir, '.json')) {
  const raw = readJson(join(weekDir, f));
  if (!raw) continue;
  const r = Week.safeParse(raw);
  if (!r.success) {
    for (const i of r.error.issues) err(`data/weeks/${f}: ${i.path.join('.') || '(root)'}: ${i.message}`);
    continue;
  }
  if (f !== `${r.data.id}.json`) err(`data/weeks/${f}: file name must be ${r.data.id}.json`);
  if (!getPalette(r.data.palette)) err(`data/weeks/${f}: unknown palette "${r.data.palette}"`);
  checkText(`data/weeks/${f}`, r.data, { isIssue: false });
  weeks.push(r.data);
}
if (weeks.length > 4) err(`data/weeks has ${weeks.length} weeks; the kept maximum is 4 (run npm run prune)`);

// ------------------------------------------------------------ orphan images
const imgRoot = join(root, 'public', 'img');
if (existsSync(imgRoot)) {
  for (const d of readdirSync(imgRoot)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (!real.some((i) => i.date === d)) warn(`public/img/${d} has no issue (run npm run prune)`);
  }
}

// ------------------------------------------------------------ report
for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
const n = real.length + (fixtureMode ? issues.length - real.length : 0);
console.log(`Checked ${n} issue(s), ${weeks.length} week(s), ${PALETTES.length} palettes: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
