#!/usr/bin/env node
// Retention: keep the newest 7 daily issues and 4 weekly summaries, 7 days of inbox files, and the
// images of kept issues. Featured keys of pruned issues move to data/seen.json for 90 days, so the
// same story or paper is not offered again under another link.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { issueKeys, readSeen, writeSeen } from './identity.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const KEEP_ISSUES = 7;
const KEEP_WEEKS = 4;
const KEEP_INBOX_DAYS = 7;
const SEEN_DAYS = 90;
const list = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);
const today = new Date().toISOString().slice(0, 10);
const seen = readSeen(root);

// expire old memory
const cutoff = new Date(Date.now() - SEEN_DAYS * 86400_000).toISOString().slice(0, 10);
for (const [k, d] of Object.entries(seen)) if (d < cutoff) delete seen[k];

const issueDir = join(root, 'data', 'issues');
const issues = list(issueDir, '.json');
for (const f of issues.slice(0, Math.max(0, issues.length - KEEP_ISSUES))) {
  const date = f.replace('.json', '');
  try {
    for (const { keys, repeatable } of issueKeys(JSON.parse(readFileSync(join(issueDir, f), 'utf8')))) {
      if (!repeatable) for (const k of keys) seen[k] = date;
    }
  } catch {}
  rmSync(join(issueDir, f));
  rmSync(join(root, 'public', 'img', date), { recursive: true, force: true });
  console.log(`pruned issue ${date}`);
}

const weekDir = join(root, 'data', 'weeks');
const weeks = list(weekDir, '.json');
for (const f of weeks.slice(0, Math.max(0, weeks.length - KEEP_WEEKS))) {
  rmSync(join(weekDir, f));
  console.log(`pruned week ${f}`);
}

const inboxDir = join(root, 'inbox');
const inboxCut = new Date(Date.now() - KEEP_INBOX_DAYS * 86400_000).toISOString().slice(0, 10);
for (const f of list(inboxDir, '.json')) {
  const d = f.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(d) && d < inboxCut) {
    rmSync(join(inboxDir, f));
    console.log(`pruned inbox ${f}`);
  }
}

// image folders without an issue
const imgDir = join(root, 'public', 'img');
const kept = new Set(list(issueDir, '.json').map((f) => f.replace('.json', '')));
if (existsSync(imgDir)) {
  for (const d of readdirSync(imgDir)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && !kept.has(d) && d <= today) {
      rmSync(join(imgDir, d), { recursive: true, force: true });
      console.log(`pruned images ${d}`);
    }
  }
}
writeSeen(root, seen);
console.log(`Kept ${list(issueDir, '.json').length} issue(s), ${list(weekDir, '.json').length} week(s); ${Object.keys(seen).length} keys remembered.`);
