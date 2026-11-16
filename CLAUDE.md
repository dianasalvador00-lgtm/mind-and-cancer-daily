# Mind and Cancer Daily

A daily medical science briefing (cancer and mind focus) on GitHub Pages. Working title.
Astro static site. A free GitHub Actions sweep writes `inbox/`; a Claude Code scheduled task
(Sonnet, at most 3 Haiku helpers) writes one issue a day to `data/issues/`.

- The full design is in `ARCHITECTURE.md`. Keep it, `routine/PROMPT.md`, `routine/WRITING.md`
  and `src/kit/schema.mjs` in sync. If they disagree, the schema wins.
- No Anthropic API, no API keys, no paid services. Ever.
- Issue text is plain text with `**bold**`, `` `code` `` and `[label](https://url)` only, rendered
  escaped by `src/kit/inline.ts`. Never add a path that renders issue content as HTML.
- The daily run may write only `data/`, `public/img/<today>/`, `inbox/` and `editorial/`.
  Never `src/`, `scripts/`, `config/`, `routine/` or `.github/`.
- The site is public. Nothing about the owner's institution, lab, unpublished work or hypotheses
  in any public text. `forYou` lines are generic.
- Retention: 7 daily issues, 4 weekly summaries (`scripts/prune.mjs`).
- Never write the em dash or en dash characters anywhere (copy, comments, commits).
- After changing the kit: `npm run validate && npm run build && npm run shoot`, then look at the
  screenshots in `.cache/shots/`.
- If git, node or gh are not found in a shell, reload PATH:
  `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`
