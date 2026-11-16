// Shared helpers for the source readers: polite fetching, feed parsing, text cleanup.
import { XMLParser } from 'fast-xml-parser';

export const UA = 'Mozilla/5.0 (compatible; MindCancerDailyBot/1.0; +https://github.com/dianasalvador00-lgtm/mind-and-cancer-daily)';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', processEntities: true, htmlEntities: true });

export async function get(url, { accept = 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*', headers = {}, timeout = 25_000 } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept, ...headers }, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
export const json = async (url, opts = {}) => JSON.parse(await get(url, { accept: 'application/json', ...opts }));

export const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  return text(v['#text'] ?? v['@href'] ?? '');
};
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decode = (s) =>
  String(s ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return entities[e.toLowerCase()] ?? m;
  });
export const strip = (html) =>
  decode(
    text(html)
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
export const postText = (html) => decode(String(html ?? '').replace(/<br\s*\/?>|<\/p>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
export const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s);
export const linkOf = (l) => {
  if (!l) return '';
  if (Array.isArray(l)) return linkOf(l.find((x) => !x['@rel'] || x['@rel'] === 'alternate') ?? l[0]);
  if (typeof l === 'string') return l;
  return l['@href'] ?? l['#text'] ?? '';
};
export const iso = (d) => new Date(d).toISOString().slice(0, 10);
export const daysAgo = (n) => new Date(Date.now() - n * 86400_000);
export const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

/** RSS 2.0, RSS 1.0 (RDF) or Atom. An empty feed is not an error. */
export function parseFeed(body) {
  const doc = xml.parse(body);
  const rssItems = doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item;
  if (!rssItems && (doc?.rss?.channel || doc?.['rdf:RDF'])) return [];
  if (rssItems) {
    return [].concat(rssItems).map((it) => ({
      title: strip(it.title),
      url: linkOf(it.link) || text(it.guid),
      published: text(it.pubDate ?? it['dc:date'] ?? it.published),
      summary: strip(it.description ?? it['content:encoded'] ?? ''),
      doi: strip(it['dc:identifier'] ?? '').match(/10\.\d{4,9}\/\S+/)?.[0],
    }));
  }
  if (doc?.feed && !doc.feed.entry) return [];
  const entries = doc?.feed?.entry;
  if (entries) {
    return [].concat(entries).map((it) => ({
      title: strip(it.title),
      url: linkOf(it.link),
      published: text(it.published ?? it.updated),
      summary: strip(it.summary ?? it.content ?? ''),
    }));
  }
  throw new Error('not an RSS or Atom feed');
}

/** Reconstruct an abstract from OpenAlex's inverted index. */
export function abstractFrom(inv) {
  if (!inv) return '';
  return Object.entries(inv)
    .flatMap(([word, pos]) => pos.map((p) => [p, word]))
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1])
    .join(' ');
}

/** Pick a salary phrase out of free text, only when one is written there. Never estimates. */
export function salaryIn(s) {
  const m = String(s ?? '').match(/(?:[€£$]|USD|EUR|GBP|CHF|SEK|NOK|DKK|AUD|CAD)\s?\d[\d.,]*\s?(?:k|K)?(?:\s?(?:-|to)\s?(?:[€£$]|USD|EUR|GBP|CHF)?\s?\d[\d.,]*\s?(?:k|K)?)?(?:\s?(?:per|a|\/)\s?(?:year|annum|month|hour|yr))?|\d[\d.,]*\s?(?:EUR|GBP|CHF|USD|euros)\b(?:\s?(?:per|a|\/)\s?(?:year|annum|month))?|(?:grade|scale|band|salary scale|E1[0-5]|TV-L|TVoD)\s?[A-Za-z]?\d{1,2}[A-Za-z]?/i);
  return m ? m[0].trim() : undefined;
}
