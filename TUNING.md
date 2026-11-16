# How to tune it

Three levers, from quickest to deepest.

## 1. More like this / Less like this (no editing)

Open the site once with `?tune=1` on the end of the address, for example
`https://dianasalvador00-lgtm.github.io/mind-and-cancer-daily/?tune=1`. The browser remembers it.
Every item now shows two links and, where there is one, a private "For you" line.

- **More like this** or **Less like this** opens a pre-filled GitHub issue. Press Submit.
- The Feedback workflow records it in `editorial/feedback.md` (only issues from the repository owner
  count) and closes the issue.
- Next morning the daily run folds each entry into `editorial/taste.md` and applies it.

Use `?tune=0` to switch the extras off again.

## 2. Edit `editorial/taste.md` (what earns a place)

This is the reader profile the daily run reads every morning. Change the target shares of cancer,
mind, rare diseases, curiosity and other medicine, the boosted niche, what to skip, the tone and the
jobs you want. Keep it free of personal details: the repository is public.

## 3. Edit `config/topics.json` (what the sweep looks for)

- `areas`: the five areas, each with a target `share`, a `weight` and keywords. Keywords match from the
  start of a word, so `pancrea` matches pancreas and pancreatic.
- `niche`: the boosted topics inside cancer (nanoparticles, phototherapy, pancreatic cancer and so on).
  A hit adds a fixed boost to the score; add or remove words to move the boost.
- `negative`: words that subtract points (wellness, supplements, advertorials).
- `sections`: extra words for methods, funding and jobs.
- `jobs`: add skill words from your CV here. Use generic words only (for example "cell culture",
  "flow cytometry", "organoids"), because this file is public.
- `windows`: how many hours back each section looks.

## Sources: `config/sources.json`

Add, remove or reweight a source (`weight` 1 to 3). Then run the **Source test** workflow in the
GitHub Actions tab: a source that works on your laptop can still fail from GitHub's datacenter
addresses. A source that fails gets `"disabled": true` and a note instead of being deleted.

## What the daily run may and may not change

It writes only `data/`, `public/img/<date>/`, `inbox/` and `editorial/`. Everything else (code,
config, procedure) changes only when you change it.

## Checking after a change

```bash
npm run validate
npm run build
```

and read `routine/PROMPT.md` and `routine/WRITING.md` if you want to change how issues are written.
