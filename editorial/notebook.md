# Notebook

The daily run's craft memory. Add one or two lines per run: what worked, what to avoid. Keep this
file under 60 lines by removing the oldest lines.

- 2026-11-16 (issue 1): Endpoints and STAT answer 403 to WebFetch, so company news items rest on the feed
  summaries in the brief: label them `news`, attribute the result to the company and say what was not
  read. NICE and CRUK pages, EMA pages and ClinicalTrials.gov read fine. Job pages found by search were
  mostly stale or unreadable: list a job only after opening the posting and seeing deadline and salary.
- 2026-11-16: project started. The sweep brief is a shortlist, not the research: open the primary
  source of every item before writing about it. Europe PMC's REST API (core record by DOI) returns
  the abstract and the licence in one call and is a fast way to read a paper.
- 2026-11-17 (issue 2): Run needed `npm ci` first (read-paper failed without node_modules). Most journal and
  news pages are paywalled or blocked, so bench items rest on Europe PMC abstracts: keep claims to those numbers.
  Reddit JSON and Medical Xpress block bots; use the brief's `signal` field for chatter. No job could be verified.
- 2026-11-18 (issue 3): PubMed E-utilities (esearch by [doi], efetch xml) gave full abstracts for Lancet, Lancet Oncology and JCO papers that Europe PMC lacked; read-paper says NOT FOUND for brand-new journal items. Hub diagram notes render faint, so leave them off. Endpoints, STAT, Medical Xpress and PsyPost block bots again.
- 2026-11-19 (issue 4): The sweep brief was missing, so the run swept first (about 2 minutes). Europe PMC timed out on some DOIs; PubMed efetch by [doi] gave full BMJ and BJOG abstracts. Trials in the brief were mostly plain updates; only a terminated one (LEAP-009) qualified. Tapenade (Bio-protocol, CC BY) worked as a method from its abstract steps only.
- 2026-11-20 (issue 5): Sweep brief was missing again, so the run swept first. A term's definition must not contain another term of the same card (the page underlined "SSRI" inside the clomipramine tooltip and broke the tldr). PubMed efetch by [doi] worked for every paper; STAT, Endpoints, PsyPost, Medical Xpress block bots.
- 2026-11-21 (issue 6): Sweep brief was missing, so the run swept first. Europe PMC returned 503 for every DOI, so read-paper failed; PubMed esearch by [doi] plus efetch gave abstracts for all papers. Science News and Medical Xpress fetch fine for some pages, STAT and Endpoints stay feed-summary only. Do not call transcranial temporal interference stimulation deep brain stimulation: it is noninvasive.
- 2026-11-22 (issue 7): Sweep brief was missing, so the run swept first. Europe PMC 503 again; PubMed esearch with curl -g (brackets) plus efetch worked. Helpers' retraction and Princeton chatter claims could not be verified, so they were dropped. Check seen.json AND the previous issue's trials before using a trial event: validate caught a repeated completion.
- 2026-11-23 (issue 8): Sweep brief was missing, so the run swept first (npm ci needed). PubMed esearch by [doi] plus efetch worked; Europe PMC search worked for newest items but full text 500ed and Bio-protocol and PMC pages gave nothing, so the method card uses abstract steps only and says so. Trials in the brief were plain updates, so two results-posted trials came from the ClinicalTrials.gov API (ResultsFirstPostDate filter). Medical Xpress and PsyPost block bots; find the journal paper by PubMed text search instead.
- 2026-11-24 (issue 9): Sweep brief was missing, so the run swept first. PubMed esearch by [doi] plus efetch worked for all papers; a Conversation article linked the primary DOI for a news item. Quanta and The Conversation fetch fine; Knowable, BridgeBio, Roche, Medical Xpress, Endpoints block bots, so those items stay feed-summary news with limits stated. Chatter kinds are limited, so Mastodon posts were filed as debate.
