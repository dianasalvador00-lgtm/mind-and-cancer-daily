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
