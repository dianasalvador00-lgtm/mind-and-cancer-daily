// Identity keys for deduplication: the same story or paper is recognised by URL, DOI, PMID,
// arXiv id, NCT number or normalised title, whichever link it arrives under.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const normUrl = (u) => {
  try {
    const x = new URL(u);
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|ref$|source$|fbclid|gclid|mc_)/.test(k)) x.searchParams.delete(k);
    x.hash = '';
    return x.toString().replace(/\/$/, '').replace(/^http:/, 'https:').replace('://www.', '://').toLowerCase();
  } catch {
    return String(u).toLowerCase();
  }
};

export const normTitle = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);

/** Keys for one link and optional title. */
export function keysOf(url, title, extra = {}) {
  const keys = new Set();
  if (url) {
    keys.add(`url:${normUrl(url)}`);
    const s = String(url);
    const doi = (extra.doi ?? s.match(/\b(10\.\d{4,9}\/[^\s?#]+)/i)?.[1] ?? '').toLowerCase().replace(/[.,;)]+$/, '');
    if (doi) keys.add(`doi:${doi}`);
    const pmid = s.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i)?.[1] ?? extra.pmid;
    if (pmid) keys.add(`pmid:${pmid}`);
    const arx = s.match(/arxiv\.org\/(?:abs|pdf)\/([\w.\-/]+?)(?:v\d+)?(?:\.pdf)?$/i)?.[1];
    if (arx) keys.add(`arxiv:${arx.toLowerCase()}`);
    const rx = s.match(/(?:biorxiv|medrxiv)\.org\/content\/(?:early\/\d{4}\/\d{2}\/\d{2}\/)?(10\.\d{4,9}\/[^\s?#]+?)(?:v\d+)?(?:\.full(?:\.pdf)?)?(?:[?#]|$)/i)?.[1];
    if (rx) keys.add(`doi:${rx.toLowerCase()}`);
    const nct = s.match(/\b(NCT\d{8})\b/i)?.[1];
    if (nct) keys.add(`nct:${nct.toUpperCase()}`);
  }
  if (extra.doi) keys.add(`doi:${String(extra.doi).toLowerCase()}`);
  if (extra.nct) keys.add(`nct:${String(extra.nct).toUpperCase()}`);
  const nt = normTitle(title);
  if (nt.length >= 25) keys.add(`title:${nt}`);
  return keys;
}

/**
 * Trial changes that are real news and may bring a trial back once each: results posted, completed,
 * terminated. A plain "updated" (any edit to the registry record) never does, and neither does "new".
 */
export const TRIAL_EVENTS = ['results-posted', 'completed', 'terminated'];

// Words that say nothing about which study a text is about.
const STOP = new Set(
  ('a an the of in on for and or to with by from at as is are was were be been being that this these those it its into than then ' +
    'after before over under about via per vs versus new news study studies shows show showed shown people patients patient mice mouse ' +
    'may might could can cannot not no more less most higher lower early late one two three first second said says report reports ' +
    'reported finds found find using use used uses linked link links risk researchers scientists paper trial trials data group groups ' +
    'how why what when where which who whose while also only some many much other their there they them our your his her has have had ' +
    'did does done get gets got make makes made like just still even well into onto out up down off again year years day days week weeks')
    .split(' '),
);

/** The distinctive words of a text, as a set: lower case, no stop words, numbers like 7.6 kept. */
export function fingerprint(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9.\- ]+/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/^[.\-]+|[.\-]+$/g, ''))
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** How much two fingerprints overlap: shared words over the smaller set, and the shared count. */
export function overlap(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return { score: a.size && b.size ? shared / Math.min(a.size, b.size) : 0, shared };
}

/** Same story: at least 5 distinctive words shared and most of the smaller text covered. */
export const likelySame = (a, b, min = 0.6) => {
  const o = overlap(a, b);
  return o.shared >= 5 && o.score >= min ? o : null;
};

/** A title fingerprint stored in data/seen.json, so a story is still recognised after pruning. */
export const fpKey = (title) => {
  const words = [...fingerprint(title)].sort();
  return words.length >= 4 ? `fp:${words.join(' ')}` : null;
};
export const fpFromKey = (k) => new Set(k.slice(3).split(' '));

/**
 * Every featured item of an issue as { id, kind, keys, repeatable, eventKey, text }.
 * keys: exact identities (url, DOI, PMID, arXiv, NCT, title, title fingerprint).
 * repeatable: a trial back for a real event (TRIAL_EVENTS); eventKey says which event, and the same
 * event may never be featured twice. text: title and summary, for the fuzzy same-story check.
 */
export function issueKeys(issue) {
  const out = [];
  const add = (id, kind, title, srcs, text, extra = {}, change) => {
    const keys = new Set(keysOf(null, title));
    for (const s of srcs ?? []) for (const k of keysOf(s.url, null, { doi: s.doi })) keys.add(k);
    for (const k of keysOf(null, null, extra)) keys.add(k);
    const fp = fpKey(title);
    if (fp) keys.add(fp);
    const repeatable = kind === 'trial' && TRIAL_EVENTS.includes(change);
    const eventKey = repeatable && extra.nct ? `event:${String(extra.nct).toUpperCase()}:${change}` : null;
    if (eventKey) keys.add(eventKey);
    out.push({ id, kind, title, keys, repeatable, eventKey, text: [title, text].filter(Boolean).join(' ') });
  };
  for (const s of issue.top ?? []) add(s.id, 'top', s.title, s.sources, s.gist);
  for (const b of issue.bench ?? []) add(b.id, 'bench', b.title, b.sources, `${b.headline ?? ''} ${b.result ?? ''}`);
  if (issue.method) add(issue.method.id, 'method', issue.method.title, [issue.method.source], issue.method.gist);
  if (issue.curiosity) add(issue.curiosity.id, 'curiosity', issue.curiosity.title, issue.curiosity.sources, issue.curiosity.gist);
  for (const t of issue.trials?.trials ?? []) add(t.id, 'trial', t.title, t.sources, t.what, { nct: t.nct }, t.change);
  for (const f of issue.trials?.funding ?? []) add(f.id, 'funding', f.title, f.sources, f.eligibility);
  for (const c of issue.chatter ?? []) add(c.id, 'chatter', c.title, c.sources, c.gist);
  return out;
}

export const seenPath = (root) => join(root, 'data', 'seen.json');

/** data/seen.json: { "<key>": "YYYY-MM-DD" } remembered for 90 days after an issue is pruned. */
export function readSeen(root) {
  const p = seenPath(root);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

export function writeSeen(root, seen) {
  writeFileSync(seenPath(root), JSON.stringify(seen, null, 1) + '\n');
}
