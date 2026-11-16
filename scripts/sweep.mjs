#!/usr/bin/env node
// The free first pass. No AI, no API key: read every source in config/sources.json, keep what was
// published inside its window, drop what was already featured, score each item with fixed rules,
// merge duplicates, and write
//   inbox/<date>.json        everything kept (the full net)
//   inbox/<date>.brief.json  a trimmed shortlist, which is all the daily run reads
//
// SCORING (deterministic, all numbers explained here and in config/topics.json):
//   score = 2 * sourceWeight                     config/sources.json, 1 to 3
//         + recency                              up to 1.5, falling to 0 at the end of the window
//         + topicMatch                           keyword hits for the five areas, up to 3
//         + nicheBoost                           1.5 for one hit of the boosted niche, 2.25 for two or more
//         + engagement                           up to 2: Reddit rank, Mastodon, Bluesky, YouTube views
//         + 0.5 per extra source carrying it     the same item found in several places
//         + salary                               1.2 for a job posting that states its salary
//         - 3 if a negative keyword is present
// FAIR SHARE: each source gives at most N items to a section, and no single host (publisher or site)
// may take more than 40 percent of a section. Sections are filled round-robin across sources, so
// the loudest source cannot crowd out the rest.
//
//   node scripts/sweep.mjs [--date YYYY-MM-DD]
//   node scripts/sweep.mjs --test     read every source once (also the disabled ones), print a table
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { keysOf, issueKeys, readSeen } from './identity.mjs';
import { READERS, MAY_BE_EMPTY, LANES } from './sources/index.mjs';
import { sleep, hostOf, salaryIn, clip } from './sources/util.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const TEST = process.argv.includes('--test');
const only = arg('only', null);
const config = JSON.parse(readFileSync(join(root, 'config', 'sources.json'), 'utf8'));
const topics = JSON.parse(readFileSync(join(root, 'config', 'topics.json'), 'utf8'));
const date = arg('date', new Date().toISOString().slice(0, 10));
const now = Date.now();

const INBOX_CAP = { research: 150, news: 120, trials: 40, funding: 30, methods: 30, chatter: 40, jobs: 40, curiosity: 30 };
const BRIEF_CAP = { research: 25, news: 20, trials: 10, funding: 8, methods: 8, chatter: 10, jobs: 12, curiosity: 8 };
const BRIEF_PER_SOURCE = { research: 4, news: 3, trials: 3, funding: 3, methods: 3, chatter: 3, jobs: 4, curiosity: 3 };
const INBOX_PER_SOURCE = 20;
const HOST_SHARE = 0.4;
const PREFIX = { research: 'r', news: 'n', trials: 't', funding: 'f', methods: 'm', chatter: 'c', jobs: 'j', curiosity: 'u' };

// ------------------------------------------------------------ topic matching
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compile = (list) => list.map((k) => ({ k, re: new RegExp(`(^|[^a-z0-9])${esc(k)}`, 'i') }));
const AREAS = Object.fromEntries(Object.entries(topics.areas).map(([id, a]) => [id, { ...a, kw: compile(a.keywords) }]));
const NICHE = compile(topics.niche.keywords);
const NEG = compile(topics.negative.keywords);
const SECTION_KW = Object.fromEntries(Object.entries(topics.sections).map(([s, l]) => [s, compile(l)]));
const hits = (kws, s) => new Set(kws.filter(({ re }) => re.test(s)).map(({ k }) => k));

function topicInfo(title, summary, src) {
  const areaScores = {};
  for (const [id, a] of Object.entries(AREAS)) {
    const t = hits(a.kw, title);
    const s = [...hits(a.kw, summary)].filter((k) => !t.has(k));
    areaScores[id] = (t.size * 0.8 + s.length * 0.4) * a.weight;
  }
  const ranked = Object.entries(areaScores).sort((x, y) => y[1] - x[1]);
  let topic = Math.min(3, ranked.reduce((sum, [, v]) => sum + v, 0));
  let area = ranked[0][1] > 0 ? ranked[0][0] : (src.area ?? null);
  if (src.area) topic = Math.max(topic, 1);
  const extra = SECTION_KW[src.section];
  if (extra) topic = Math.min(3, topic + Math.min(2, 0.6 * hits(extra, `${title} ${summary}`).size));
  const areaTopic = Math.min(3, ranked.reduce((sum, [, v]) => sum + v, 0)) || (src.area ? 1 : 0);
  const n = hits(NICHE, `${title} ${summary}`).size;
  const niche = n === 0 ? 0 : n === 1 ? topics.niche.weight : topics.niche.weight * 1.5;
  const negative = hits(NEG, `${title} ${summary}`).size > 0;
  if (n > 0 && !src.area) area = area ?? 'cancer';
  return { topic, areaTopic, area, niche, negative, nicheHits: n };
}

// ------------------------------------------------------------ already featured
const featured = new Set(Object.keys(readSeen(root)));
const issueDir = join(root, 'data', 'issues');
if (existsSync(issueDir)) {
  for (const f of readdirSync(issueDir).filter((f) => f.endsWith('.json'))) {
    try {
      for (const { keys, repeatable } of issueKeys(JSON.parse(readFileSync(join(issueDir, f), 'utf8')))) if (!repeatable) for (const k of keys) featured.add(k);
    } catch {}
  }
}

// ------------------------------------------------------------ read the sources
const windowHours = (src) => src.windowHours ?? topics.windows[src.section] ?? 48;
const sources = config.sources.filter((s) => (only ? s.name.toLowerCase().includes(only.toLowerCase()) : true) && (TEST || !s.disabled));
const report = [];
const raw = [];

async function readOne(src) {
  const t0 = Date.now();
  const hours = windowHours(src);
  try {
    const items = await READERS[src.kind](src, { windowDays: hours / 24 });
    let kept = 0;
    for (const it of items) {
      const ts = Date.parse(it.published);
      if (!it.title || !it.url || Number.isNaN(ts)) continue;
      if (ts < now - hours * 3600_000 || ts > now + 36 * 3600_000) continue;
      if (src.match && !new RegExp(src.match, 'i').test(`${it.title} ${it.summary ?? ''}`)) continue;
      kept++;
      raw.push({ it, src, ts });
    }
    const empty = items.length === 0 && !MAY_BE_EMPTY.has(src.kind);
    report.push({ source: src.name, kind: src.kind, section: src.section, ok: !empty, items: items.length, inWindow: kept, ms: Date.now() - t0, ...(empty && { error: 'returned no items' }) });
  } catch (e) {
    report.push({ source: src.name, kind: src.kind, section: src.section, ok: false, items: 0, inWindow: 0, ms: Date.now() - t0, error: String(e.message ?? e).slice(0, 140) });
  }
}

const lanes = new Map();
for (const s of sources) {
  if (!READERS[s.kind]) {
    report.push({ source: s.name, kind: s.kind, section: s.section, ok: false, items: 0, inWindow: 0, ms: 0, error: `unknown kind ${s.kind}` });
    continue;
  }
  const lane = LANES[s.kind] ?? 'main';
  lanes.set(lane, [...(lanes.get(lane) ?? []), s]);
}
async function runLane(list, pause = 0) {
  while (list.length) {
    const src = list.shift();
    if (pause) await sleep(pause);
    await readOne(src);
  }
}
const main = lanes.get('main') ?? [];
await Promise.all([
  ...Array.from({ length: 8 }, () => runLane(main)),
  runLane(lanes.get('reddit') ?? []),
  runLane(lanes.get('arxiv') ?? [], 3500),
  runLane(lanes.get('ncbi') ?? []),
]);

const printTable = () => {
  const rows = [...report].sort((a, b) => a.section?.localeCompare(b.section ?? '') || a.source.localeCompare(b.source));
  console.log(`\n${'status'.padEnd(7)}${'section'.padEnd(10)}${'kind'.padEnd(15)}${'items'.padStart(6)}${'window'.padStart(8)}${'ms'.padStart(7)}  source`);
  for (const r of rows) console.log(`${(r.ok ? 'ok' : 'FAIL').padEnd(7)}${String(r.section).padEnd(10)}${r.kind.padEnd(15)}${String(r.items).padStart(6)}${String(r.inWindow).padStart(8)}${String(r.ms).padStart(7)}  ${r.source}${r.error ? `  <- ${r.error}` : ''}`);
  const bad = report.filter((r) => !r.ok).length;
  console.log(`\n${report.length - bad} ok, ${bad} failed or empty, of ${report.length}`);
};

if (TEST) {
  mkdirSync(join(root, 'inbox'), { recursive: true });
  writeFileSync(join(root, 'inbox', 'source-test.json'), JSON.stringify({ date, generatedAt: new Date().toISOString(), sources: report }, null, 1) + '\n');
  printTable();
  process.exit(0);
}

// ------------------------------------------------------------ normalise, score, merge
const groups = [];
const index = new Map();
for (const { it, src, ts } of raw) {
  const url = it.url;
  const keys = keysOf(url, it.title, { doi: it.doi, pmid: it.pmid, nct: it.nct });
  const exempt = it.nct && it.change && it.change !== 'new';
  if (!exempt && [...keys].some((k) => featured.has(k))) continue;
  const summary = clip(it.summary ?? '', 700);
  const info = topicInfo(it.title, summary, src);
  if (topics.requireTopic.includes(src.section) && info.topic === 0 && info.niche === 0) continue;
  // Jobs must match a real topic (cancer, brain, rare disease, nanomedicine...), not just the words
  // "postdoc" or "PhD", or every hiring post from any field gets through.
  if (src.section === 'jobs' && info.areaTopic === 0 && info.niche === 0) continue;
  if (src.section === 'curiosity' && !info.area) info.area = 'curiosity';
  const ageH = (now - ts) / 3600_000;
  const recency = 1.5 * Math.max(0, 1 - ageH / windowHours(src));
  const salary = src.section === 'jobs' ? salaryIn(`${it.title} ${summary}`) : undefined;
  const base = 2 * (src.weight ?? 1) + recency + info.topic + info.niche + Math.min(2, it.engagement ?? 0) + (salary ? topics.jobs.salaryBoost : 0) - (info.negative ? topics.negative.penalty : 0);

  const hit = [...keys].map((k) => index.get(k)).find((i) => i != null);
  const rec = {
    section: src.section,
    area: info.area ?? 'other',
    title: clip(it.title, 200),
    url,
    doi: it.doi,
    pmid: it.pmid,
    nct: it.nct,
    source: it.sourceLabel || it.venue || src.name,
    srcName: src.name,
    host: it.hostGroup ?? hostOf(url),
    published: new Date(ts).toISOString(),
    summary,
    ...(it.signal && { signal: it.signal }),
    ...(it.venue && { venue: it.venue }),
    ...(it.authors && { authors: it.authors }),
    ...((it.preprint || /rxiv|arxiv|preprint/i.test(`${it.venue ?? ''} ${url}`)) && { preprint: true }),
    ...(it.reviewType && { review: true }),
    ...(it.phase && { phase: it.phase, status: it.status, sponsor: it.sponsor, change: it.change, conditions: it.conditions }),
    ...(salary && { salary }),
    ...(info.nicheHits > 0 && { niche: true }),
    base,
    extra: 0,
  };
  if (hit != null) {
    const g = groups[hit];
    g.extra += 1;
    g.also = [...new Set([...(g.also ?? []), rec.source])].filter((s) => s !== g.source);
    if (rec.summary.length > g.summary.length) g.summary = rec.summary;
    if (rec.base > g.base) g.base = rec.base;
    for (const f of ['doi', 'pmid', 'nct', 'signal', 'venue', 'authors', 'salary']) if (!g[f] && rec[f]) g[f] = rec[f];
    if (/^https:\/\/doi\.org\//.test(rec.url) && !/^https:\/\/doi\.org\//.test(g.url)) g.url = rec.url;
    if (rec.preprint && !g.preprint) g.preprint = true;
    for (const k of keys) index.set(k, hit);
  } else {
    groups.push(rec);
    for (const k of keys) index.set(k, groups.length - 1);
  }
}
for (const g of groups) g.score = Math.round((g.base + 0.5 * g.extra) * 100) / 100;

// ------------------------------------------------------------ fair share selection
function fairPick(items, n, perSource) {
  const bySrc = new Map();
  for (const it of [...items].sort((a, b) => b.score - a.score)) {
    const l = bySrc.get(it.srcName) ?? [];
    if (l.length < perSource) l.push(it);
    bySrc.set(it.srcName, l);
  }
  const lanes2 = [...bySrc.values()].sort((a, b) => b[0].score - a[0].score).map((list) => ({ list, at: 0 }));
  const hostMax = Math.max(1, Math.ceil(n * HOST_SHARE));
  const hostCount = {};
  const picked = [];
  let progress = true;
  while (picked.length < n && progress) {
    progress = false;
    for (const lane of lanes2) {
      if (picked.length >= n) break;
      while (lane.at < lane.list.length) {
        const it = lane.list[lane.at++];
        if ((hostCount[it.host] ?? 0) >= hostMax) continue;
        hostCount[it.host] = (hostCount[it.host] ?? 0) + 1;
        picked.push(it);
        progress = true;
        break;
      }
    }
  }
  return picked.sort((a, b) => b.score - a.score);
}

const inbox = [];
const brief = [];
for (const section of Object.keys(INBOX_CAP)) {
  const all = groups.filter((g) => g.section === section);
  const picked = fairPick(all, INBOX_CAP[section], INBOX_PER_SOURCE);
  picked.forEach((it, i) => inbox.push({ id: `${PREFIX[section]}${String(i + 1).padStart(3, '0')}`, ...it }));
  const mine = inbox.filter((i) => i.section === section);
  for (const it of fairPick(mine, BRIEF_CAP[section], BRIEF_PER_SOURCE[section])) brief.push(it);
}

const strip = ({ base, extra, srcName, ...rest }) => ({ ...rest, ...(extra > 0 && { foundInSources: extra + 1 }) });
const briefItem = (it) => {
  const { id, section, area, title, url, doi, source, published, score, signal, phase, status, sponsor, change, conditions, nct, salary, preprint, review, niche, also, venue, authors, summary } = it;
  return { id, section, area, title, url, ...(doi && { doi }), ...(nct && { nct }), source, ...(venue && venue !== source && { venue }), ...(authors && { authors }), published: published.slice(0, 10), score, ...(signal && { signal }), ...(phase && { phase, status, sponsor, change, conditions }), ...(salary && { salary }), ...(preprint && { preprint: true }), ...(review && { review: true }), ...(niche && { niche: true }), ...(also?.length && { alsoIn: also }), summary: clip(summary, 300) };
};

const mix = {};
for (const b of brief.filter((b) => b.section === 'research' || b.section === 'news')) mix[b.area] = (mix[b.area] ?? 0) + 1;
const failed = report.filter((r) => !r.ok).map((r) => ({ source: r.source, error: r.error }));

mkdirSync(join(root, 'inbox'), { recursive: true });
const generatedAt = new Date().toISOString();
writeFileSync(join(root, 'inbox', `${date}.json`), JSON.stringify({ date, generatedAt, sources: report, items: inbox.map(strip) }, null, 1) + '\n');
writeFileSync(
  join(root, 'inbox', `${date}.brief.json`),
  JSON.stringify({ date, generatedAt, note: 'Shortlist for the daily run. Scores are deterministic (see scripts/sweep.mjs). area is a keyword guess.', areaMix: mix, failedSources: failed, items: brief.map((b) => briefItem(b)) }, null, 1) + '\n',
);

const counts = Object.keys(INBOX_CAP).map((s) => `${inbox.filter((i) => i.section === s).length} ${s}`).join(', ');
console.log(`Swept ${sources.length} sources: ${counts}. Brief: ${brief.length} items. Written to inbox/${date}.json and inbox/${date}.brief.json`);
printTable();
