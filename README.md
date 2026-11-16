# Mind and Cancer Daily

Working title. A daily briefing on medical science with a focus on cancer and the mind
(neuroscience and psychology), plus rare diseases and fun curiosities. Written for a smart researcher
who is not an expert in every neighbouring field.

Live: https://dianasalvador00-lgtm.github.io/mind-and-cancer-daily/

Each morning a new issue appears with: Top stories, The bench (papers in depth), Method of the day,
Learn one thing (with a diagram), Trials and funding, Chatter, Curiosity of the day and Jobs. On
Sundays there is also a weekly summary. Only the last 7 daily issues and 4 weekly summaries are kept.
Articles are in English; the interface switches to European Portuguese (PT-PT) with the EN/PT button.

## How a day is made

| Time (UTC, which is GMT) | Step | Runs on | Cost |
|---|---|---|---|
| 06:40 | **Sweep**: read about 100 free sources, keep what is recent, drop what was already featured, score and merge duplicates, write a shortlist | GitHub Actions, `scripts/sweep.mjs`, no AI | free |
| 07:00 | **Daily run**: read the sources behind the shortlist, write the issue, validate, build, look at screenshots, push to `main` | Claude Code scheduled task on a Pro subscription, `routine/PROMPT.md`. Sonnet writes; at most 3 Haiku helpers read | uses subscription allowance, no API money |
| on push | **Deploy**: validate, build, publish | GitHub Actions to GitHub Pages | free |
| 07:30 | Issue is live | | |

If validation or the build fails, nothing is pushed and yesterday's issue stays up.

## No API money

No Anthropic API, no `ANTHROPIC_API_KEY`, no paid service. The only things used are a public GitHub
repository, GitHub Actions, GitHub Pages, free public APIs and one Claude Code scheduled task. The
sweep ranks with fixed rules: source weight, recency, keyword match against `config/topics.json`,
free engagement signals (Reddit rank, Mastodon, YouTube views), plus a per-source cap and a
40 percent per-host cap so no single source dominates.

## Layout

```
data/issues/<date>.json     one issue per day (kept 7)
data/weeks/<id>.json        Sunday summary (kept 4)
data/seen.json              90 day memory of featured items, so nothing repeats
public/img/<date>/          open-licence figures, always credited
inbox/<date>.json           full sweep output (kept 7 days)
inbox/<date>.brief.json     the shortlist the daily run reads
editorial/taste.md          the reader profile: what earns a place
editorial/feedback.md       More/Less like this feedback, folded in each morning
editorial/notebook.md       the daily run's craft memory
config/sources.json         what the sweep reads
config/topics.json          areas, target shares, keywords, boosted niche
config/rules.json           banned words, privacy patterns, preprint hosts (the validator)
routine/PROMPT.md           the daily procedure
routine/WRITING.md          section formats and the science writing rules
src/kit/schema.mjs          the issue contract (enforced at validate and build)
src/kit/palette.mjs         the daily colour pairs, checked for contrast and colour blindness
scripts/                    sweep, validate, prune, shoot, read-paper, fetch-image
```

## Working on it

```bash
npm ci
npm run dev                 # http://localhost:4321/mind-and-cancer-daily/
npm run validate            # schema, writing rules, privacy, palettes, i18n
npm run build
npm run shoot               # screenshots into .cache/shots/ (needs Chrome or Edge)
npm run sweep               # a sweep, locally (takes minutes: Reddit is read slowly on purpose)
node scripts/validate.mjs --fixture   # also check the layout sample in scripts/fixtures/
```

To test the sources from a datacenter address (the only test that counts, many sites block those),
run the **Source test** workflow in the Actions tab.

## Safety

The daily run reads the open web, so what it writes is treated as untrusted: issue text is rendered
escaped (no HTML), links must be https, and `npm run validate` checks every issue before anything
deploys. Evidence labels, limitations, hype words, medical-advice phrasing and private details are
checked there too.

## Public and private

The site is public. Nothing about the owner's institution, lab, unpublished work or hypotheses
belongs in public text. The private angle lives in `forYou` lines, which are hidden on the page
(shown only with `?tune=1`) but are visible in the page source, so they are written generically.
For real privacy, host on Cloudflare Pages with Cloudflare Access (free for small teams) from a
private copy of this repository.

## Licence

Code: MIT. Issue text summarises and links to its sources, which keep their own rights. Figures are
used only when their open licence allows it and are always credited.

Architecture adapted from [toamig/radar](https://github.com/toamig/radar) (MIT). See
[ARCHITECTURE.md](ARCHITECTURE.md) for the full design and [TUNING.md](TUNING.md) for how to tune it.
