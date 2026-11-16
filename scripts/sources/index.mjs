import { rss, reddit, mastodon, bluesky, youtube } from './feeds.mjs';
import { pubmed, europepmc, biorxiv, arxiv, openalex, crossref } from './papers.mjs';
import { clinicaltrials } from './trials.mjs';

export const READERS = { rss, reddit, mastodon, bluesky, youtube, pubmed, europepmc, biorxiv, arxiv, openalex, crossref, clinicaltrials };

/** Kinds that are allowed to return nothing without being a failure (weekends, quiet hashtags). */
export const MAY_BE_EMPTY = new Set(['arxiv', 'mastodon', 'bluesky', 'clinicaltrials', 'biorxiv', 'reddit']);

/** Kinds that must run one at a time, in their own lane. */
export const LANES = { reddit: 'reddit', arxiv: 'arxiv', pubmed: 'ncbi' };
