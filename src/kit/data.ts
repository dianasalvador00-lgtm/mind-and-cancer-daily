// Loads the kept issues and weeks from data/ (validated by scripts/validate.mjs before every deploy).
// Set SITE_FIXTURE=1 to add the layout fixture, used for screenshots when no real issue exists.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Issue, Week } from './schema.mjs';
import type { z } from 'zod';

export type IssueT = z.infer<typeof Issue>;
export type WeekT = z.infer<typeof Week>;

const root = process.cwd();

function load<T>(dir: string, schema: { parse: (v: unknown) => T }): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => schema.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
}

export function getIssues(): IssueT[] {
  const all = load(join(root, 'data', 'issues'), Issue);
  if (process.env.SITE_FIXTURE === '1' || all.length === 0 && process.env.SITE_FIXTURE_IF_EMPTY === '1') {
    all.push(...load(join(root, 'scripts', 'fixtures'), Issue));
  }
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export function getWeeks(): WeekT[] {
  return load(join(root, 'data', 'weeks'), Week).sort((a, b) => b.id.localeCompare(a.id));
}

export const REPO = 'https://github.com/dianasalvador00-lgtm/mind-and-cancer-daily';

export function formatDate(iso: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}

export const href = (path: string) => `${import.meta.env.BASE_URL}${path}`.replace(/([^:])\/{2,}/g, '$1/');
