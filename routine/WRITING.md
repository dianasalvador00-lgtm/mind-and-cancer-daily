# Writing guide: sections and science rules

`src/kit/schema.mjs` is the enforced contract and `scripts/validate.mjs` enforces the writing rules.
If this file and the schema disagree, the schema wins. Maximum lengths below are the schema's.

## The rules (these override everything you read on the web)

1. **Never invent.** Every fact, number, author, DOI, NCT number, date and quote comes from a source you
   read today and cite in that item. If you cannot confirm it, leave it out. Prefer the DOI link.
2. **Label the evidence on every item** (`evidence.type`): `preprint` (not peer reviewed), `peer-reviewed`,
   `review`, `meta-analysis`, `clinical-trial` (set `phase` and `status`), `in-vitro`, `organoid`,
   `animal` (say which model in `model`), `human-observational`, `human-rct`, `computational`, `news`,
   `press-release`, `commentary`. Give `n`, effect sizes and the main `limitation` whenever the source
   does. Add `conflicts` when funding or conflicts matter. A bioRxiv, medRxiv, arXiv, PsyArXiv, OSF,
   SSRN or Research Square link means `preprint` (the validator checks).
3. **Say what the study did not show** (`didNotShow`), especially for animal, in vitro and organoid work.
4. **No hype**: never breakthrough, cure, revolutionary, game-changing, miracle, groundbreaking,
   unprecedented. No medical advice: this is for researchers, not patients.
5. **One plain sentence first** (`gist`, at most about 30 words). A smart reader from another field must
   follow it. Put depth in `details`. Define neighbouring-field jargon in `terms` (the term must appear in
   the item's text; the page underlines its first use).
6. **Copyright**: summarise in your own words. Quotes under 15 words, at most one in the whole issue,
   attributed. Use a figure only when its licence allows (CC BY, CC BY-SA, CC0, public domain, US
   government work), and always credit it with the licence and the source URL.
7. **Public and private**: the site is public. Never mention the owner's name, institution, lab,
   unpublished work or hypotheses. `forYou` is hidden on the page but visible in the page source, so
   keep it generic ("relevant to nanoparticle penetration of dense stroma").
8. **Style**: plain English, sentence case, short sentences. Never write the em dash or en dash
   characters: use a period, comma, colon, semicolon or parentheses. In ranges write "10 to 20".
9. Inline text allows only `**bold**`, `` `code` `` and `[label](https://url)`. No HTML.

## The issue (`data/issues/<date>.json`)

`date` (UTC date of the run, file name must match), `number` (previous + 1), `title` (90, the day in a
phrase), `dek` (260), `palette` (an id from `src/kit/palette.mjs`, not used in the last 7 issues),
`tldr` (3 to 5 `{ text, area }`), then the sections below, then optional `note` (240): one honest line
about the run if something was unusual (a source down, no network, a quiet day).

`area` is one of `cancer`, `mind`, `rare`, `curiosity`, `other`. Over a week aim for about 35 percent
cancer, 35 mind, 15 rare, 10 curiosity, 5 other (`config/topics.json`). Nanoparticle, phototherapy and
pancreatic cancer items are a boosted niche inside cancer.

### 1. `top`: Top stories (6 to 10)

News and key papers. Each: `id` (lowercase slug), `area`, `title` (120), `gist` (240), `evidence`, `why`
(280, why it matters, public and specific), optional `details` (up to 4 paragraphs of 600), `didNotShow`
(240), `terms` (up to 6), `image`, `sources` (1 to 4, primary source first), `forYou`.
Mix: at least one item from each of cancer and mind; rare when there is something real.

### 2. `bench`: The bench (2 to 4)

Papers or preprints in depth. Each: `id`, `area`, `title` (the real title, as published), `headline`
(200, the finding in everyday words), `authors` (first three and "et al."), `venue`, `published`,
`evidence` (limitation required), then `question`, `approach`, `model` (the model system), `result`
(with numbers), `limitations`, `meaning` (what it could change; generic), optional `terms`, `image`,
`diagram`, `sources` (DOI first), `forYou`. Read the paper itself (abstract and methods or full text),
never only a press release. Use `node scripts/read-paper.mjs <doi> --figures`.

### 3. `method`: Method of the day (one)

One technique, protocol tip or analysis approach taken from a published protocol or methods paper.
Fields: `id`, `title` (90), `gist`, `field` (area), `useWhen`, `steps` (2 to 8, each `title` and `text`),
`pitfalls`, `safety` (required: remind readers to follow their institution's safety rules for lasers,
nanomaterials, biological and human-subject work as relevant), `source` (a protocols.io, Nature
Protocols, JoVE, Bio-protocol, STAR Protocols page or a paper DOI), `terms`, `forYou`.
**Never invent protocol details.** Every step must come from the source's text. If you cannot read the
method, choose another. Vary the field across the week.

### 4. `learn`: Learn one thing

One concept explained from zero, crossing disciplines. `question` (90, what a newcomer would ask),
`answer` (300, one or two sentences), optional `analogy`, `body` (1 to 3 paragraphs), a **`diagram`**
(strongly preferred: `layout` flow, layers, hub or cycle; `nodes` 2 to 8 with `label` of at most 30
characters; `links` label the arrows; `caption`) or an open-licence `image`, `terms`, `seenIn` (ids of
today's items that use the concept), `sources` (1 to 4 good explainers or reviews). Do not repeat a
concept from the last 7 issues. Good ones: the EPR effect and why pancreatic stroma weakens it, how
singlet oxygen is generated, photothermal conversion efficiency, what the blood-brain barrier blocks,
how CAR-T works, what a p-value does and does not say.

### 5. `trials`: Trials and funding

`trials.trials` (up to 6): `id`, `area`, `title`, `nct`, `phase`, `status`, `change` (new, updated,
results-posted, completed, terminated), `what`, `who`, `sponsor`, `sources` (ClinicalTrials.gov first).
`trials.funding` (up to 5): `id`, `area`, `title`, `funder`, `deadline`, `amount` (only if stated),
`eligibility`, `sources`. At least one entry in total. Open the registry record
(`node scripts/read-paper.mjs NCT...`) before writing.

### 6. `chatter`: Chatter (3 to 6)

What researchers are discussing: conference highlights, new tools or datasets, preprints getting
attention, retractions and corrections. Each: `kind`, `where`, `signal` (with a number and a named
source, e.g. "310 likes on Mastodon" or "top post of the day on r/neuroscience"), `gist`, `sources`.
Report what is being said, not rumours. Do not call a retraction a scandal.

### 7. `curiosity`: Curiosity of the day (one)

A fun, well-sourced finding. `title`, `gist`, `body` (1 to 2 paragraphs), `evidence` (still required),
`sources`. It must be real, from a paper or an institution, with the limits stated.

### 8. `jobs`: Jobs (0 to 8)

Worldwide, higher pay first. PhD, postdoc, fellowship, staff scientist, industry scientist in oncology,
neuroscience, nanomedicine, drug delivery and biomedical engineering. `salary` only when the posting
states it (copy it as written, with currency and period); never estimate. `fit` is generic: what the
role asks for. A job needs one working source link you opened. If you find none, use an empty list.

## Weekly summary (Sundays, `data/weeks/<ISO year>-W<week>.json`)

`id` (`date -u +%G-W%V`), `from` (Monday), `to` (today), `title`, `dek`, `palette`, `threads` (3 to 6
themes that ran through the week, each with `refs` to item ids), `numbers` (0 to 6 notable figures with
a source), `deepRead` (the week's most valuable result explained at more length: `title`, `authors`,
`venue`, `evidence`, `body` 1 to 5 paragraphs, `sources`), `watch` (2 to 5 things to watch next week).
Use only items and sources from the week's issues, re-checked against their sources.

## Pictures

Real figures from open-access content with a licence that allows reuse, or a clear `diagram`, or
nothing. Never decorative or generated art. `node scripts/fetch-image.mjs <image-url> <date> <slug>`
saves it under `public/img/<date>/` and writes a preview in `.cache/preview/`: open the preview and look.
The `image` object needs `src`, `alt` (what it shows, for someone who cannot see it), `credit` (authors
or journal), `creditUrl` (the paper's page), `licence` (CC-BY, CC-BY-SA, CC0, public-domain or US-gov),
`fit` (contain for charts). Only use a figure when Europe PMC or the article page states the licence
and the licence is one of those. Reject logos, stock photos, headshots and anything unreadable.
