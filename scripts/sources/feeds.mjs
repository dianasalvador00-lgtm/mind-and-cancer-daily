// News feeds and community signals: RSS/Atom, grouped Reddit feeds, Mastodon hashtags,
// Bluesky searches and YouTube channel feeds (view counts). Every reader returns plain items;
// sweep.mjs does the scoring.
import { get, json, xml, text, strip, postText, clip, sleep, linkOf, parseFeed, UA } from './util.mjs';

export async function rss(src) {
  return parseFeed(await get(src.url));
}

// Reddit allows about one unauthenticated request per minute per IP, and a shared runner address has
// usually spent it already. So subreddits are read as a few grouped feeds (r/a+b+c), 65 seconds apart,
// waiting out a 429. No proxies, no tricks.
let lastReddit = 0;
async function redditGet(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastReddit + 65_000 - Date.now();
    if (wait > 0) await sleep(wait);
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/atom+xml, */*' }, signal: AbortSignal.timeout(25_000) });
    lastReddit = Date.now();
    if (res.ok) return res.text();
    if (res.status !== 429) throw new Error(`HTTP ${res.status}`);
    await sleep((Number(res.headers.get('x-ratelimit-reset')) || 60) * 1000 + 3000);
    lastReddit = 0;
  }
  throw new Error('HTTP 429 after waiting twice');
}

export async function reddit(src) {
  const doc = xml.parse(await redditGet(`https://www.reddit.com/r/${src.subs.join('+')}/top/.rss?t=${src.t ?? 'day'}&limit=100`));
  if (!doc?.feed) throw new Error('not an Atom feed');
  const seen = {};
  const out = [];
  for (const it of [].concat(doc.feed.entry ?? [])) {
    const sub = it.category?.['@label'] ?? `r/${it.category?.['@term'] ?? 'reddit'}`;
    const rank = (seen[sub] = (seen[sub] ?? 0) + 1);
    if (rank > (src.perSub ?? 6)) continue;
    out.push({
      title: strip(it.title),
      url: linkOf(it.link),
      published: text(it.published ?? it.updated),
      summary: strip(it.content ?? it.summary ?? '').slice(0, 480),
      signal: `#${rank} of the ${src.t === 'week' ? 'week' : 'day'}'s top posts on ${sub}`,
      engagement: Math.max(0, 2 - rank * 0.25),
      hostGroup: 'reddit',
      sourceLabel: sub,
    });
  }
  return out;
}

export async function mastodon(src) {
  const out = [];
  for (const tag of src.tags) {
    try {
      for (const p of await json(`https://${src.instance}/api/v1/timelines/tag/${tag}?limit=40`)) {
        const score = p.favourites_count + 2 * p.reblogs_count;
        const body = postText(p.content);
        if (score < (src.minScore ?? 6) || body.length < 30) continue;
        out.push({
          title: clip(body, 160),
          url: p.url,
          published: p.created_at,
          summary: clip(`${body}${p.card?.title ? ` Link: ${p.card.title} (${p.card.url})` : ''}`, 480),
          signal: `${p.favourites_count} favourites and ${p.reblogs_count} boosts on Mastodon (#${tag})`,
          engagement: Math.min(2, Math.log10(score + 1)),
          hostGroup: `mastodon-${src.instance}`,
          sourceLabel: `Mastodon #${tag}`,
        });
      }
    } catch (e) {
      if (out.length === 0 && src.tags.indexOf(tag) === src.tags.length - 1) throw e;
    }
    await sleep(400);
  }
  return out;
}

export async function bluesky(src) {
  // Public search; Bluesky may require sign-in for this endpoint from some networks. If it does, the
  // source test reports it and the source is dropped.
  const out = [];
  let lastErr;
  for (const q of src.queries) {
    try {
      const data = await json(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=top&limit=40&lang=en`);
      for (const post of data.posts ?? []) {
        const likes = post.likeCount ?? 0;
        const reposts = post.repostCount ?? 0;
        const score = likes + 2 * reposts;
        const body = String(post.record?.text ?? '').trim();
        if (score < (src.minScore ?? 25) || body.length < 30) continue;
        const ext = post.embed?.external ?? post.embed?.media?.external;
        out.push({
          title: clip(body.replace(/\s+/g, ' '), 160),
          url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
          published: post.record?.createdAt ?? post.indexedAt,
          summary: clip(`${body}${ext ? ` Link: ${ext.title ?? ''} (${ext.uri})` : ''}`, 480),
          signal: `${likes} likes and ${reposts} reposts on Bluesky`,
          engagement: Math.min(2, Math.log10(score + 1) * 0.8),
          hostGroup: 'bluesky',
          sourceLabel: 'Bluesky',
        });
      }
    } catch (e) {
      lastErr = e;
    }
    await sleep(400);
  }
  if (!out.length && lastErr) throw lastErr;
  return out;
}

export async function youtube(src) {
  const out = [];
  let lastErr;
  for (const ch of src.channels) {
    try {
      const doc = xml.parse(await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`));
      for (const e of [].concat(doc?.feed?.entry ?? [])) {
        const group = e['media:group'] ?? {};
        const views = Number(group['media:community']?.['media:statistics']?.['@views'] ?? 0);
        out.push({
          title: strip(e.title),
          url: linkOf(e.link),
          published: text(e.published),
          summary: clip(strip(group['media:description'] ?? ''), 400),
          signal: `${views.toLocaleString('en-US')} views on ${ch.name}`,
          engagement: Math.min(2, Math.log10(views + 1) / 3),
          hostGroup: 'youtube',
          sourceLabel: `YouTube: ${ch.name}`,
        });
      }
    } catch (e) {
      lastErr = e;
    }
    await sleep(150);
  }
  if (!out.length && lastErr) throw lastErr;
  return out;
}
