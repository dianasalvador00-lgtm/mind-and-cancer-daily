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
 * Every featured item of an issue as { id, kind, keys, repeatable }.
 * Trials that are updates, results or completions may legitimately reappear; new ones may not.
 */
export function issueKeys(issue) {
  const out = [];
  const add = (id, kind, title, srcs, extra = {}, repeatable = false) => {
    const keys = new Set(keysOf(null, title));
    for (const s of srcs ?? []) for (const k of keysOf(s.url, null, { doi: s.doi })) keys.add(k);
    for (const k of keysOf(null, null, extra)) keys.add(k);
    out.push({ id, kind, keys, repeatable });
  };
  for (const s of issue.top ?? []) add(s.id, 'top', s.title, s.sources);
  for (const b of issue.bench ?? []) add(b.id, 'bench', b.title, b.sources);
  if (issue.method) add(issue.method.id, 'method', issue.method.title, [issue.method.source]);
  if (issue.curiosity) add(issue.curiosity.id, 'curiosity', issue.curiosity.title, issue.curiosity.sources);
  for (const t of issue.trials?.trials ?? []) add(t.id, 'trial', t.title, t.sources, { nct: t.nct }, t.change !== 'new');
  for (const f of issue.trials?.funding ?? []) add(f.id, 'funding', f.title, f.sources);
  for (const c of issue.chatter ?? []) add(c.id, 'chatter', c.title, c.sources);
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
