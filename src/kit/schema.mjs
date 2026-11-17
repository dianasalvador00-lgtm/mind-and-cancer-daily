// The shape of an issue and a weekly summary. The daily routine writes JSON that must parse
// against these schemas; validate and build refuse anything else.
// Text fields are plain text with a tiny inline markup (**bold**, `code`, [label](https://url)),
// rendered escaped by src/kit/inline.ts.
import { z } from 'zod';

export const AREAS = ['cancer', 'mind', 'rare', 'curiosity', 'other'];

const text = (max) => z.string().trim().min(1).max(max);
const url = z.string().url().refine((u) => /^https:\/\//.test(u), 'links must be https');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, 'lowercase slug');
const doi = z.string().regex(/^10\.\d{4,9}\/\S+$/, 'bare DOI like 10.1000/xyz');
const imagePath = z.string().regex(/^img\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.webp$/, 'img/<date>/<slug>.webp');

export const Area = z.enum(AREAS);
// access: 'open' when the full text is free to read (open access), 'paywall' when it is not.
export const Source = z.object({ label: text(80), url, doi: doi.optional(), access: z.enum(['open', 'paywall']).optional() }).strict();
export const Term = z.object({ term: text(40), def: text(200) }).strict();

export const EVIDENCE_TYPES = [
  'preprint', 'peer-reviewed', 'review', 'meta-analysis', 'clinical-trial', 'in-vitro', 'organoid',
  'animal', 'human-observational', 'human-rct', 'computational', 'news', 'press-release', 'commentary',
];
export const NEEDS_LIMITATION = ['preprint', 'peer-reviewed', 'animal', 'in-vitro', 'organoid', 'human-observational', 'human-rct'];

export const Evidence = z
  .object({
    type: z.enum(EVIDENCE_TYPES),
    model: text(80).optional(),
    n: text(40).optional(),
    phase: z.enum(['0', '1', '1/2', '2', '2/3', '3', '4']).optional(),
    status: text(40).optional(),
    limitation: text(240).optional(),
    conflicts: text(200).optional(),
  })
  .strict()
  .refine((e) => !NEEDS_LIMITATION.includes(e.type) || !!e.limitation, {
    message: 'limitation is required for this evidence type',
    path: ['limitation'],
  });

export const Image = z
  .object({
    src: imagePath,
    alt: text(200),
    credit: text(160),
    creditUrl: url,
    // NC licences are allowed because this site is non-commercial (no ads, no sales). Never ND.
    licence: z.enum(['CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'CC-BY-NC-SA', 'CC0', 'public-domain', 'US-gov']),
    fit: z.enum(['contain', 'cover']).default('contain'),
  })
  .strict();

// flow: steps left to right; layers: a stack; hub: a centre (key) and its parts; cycle: a loop;
// timeline: dated steps (label = the date or phase); compare: 2 to 4 things side by side
// (label = the short value or name, note = what it is).
export const Diagram = z
  .object({
    layout: z.enum(['flow', 'layers', 'hub', 'cycle', 'timeline', 'compare']),
    nodes: z.array(z.object({ label: text(30), note: text(80).optional(), key: z.boolean().optional() }).strict()).min(2).max(8),
    links: z.array(text(30)).max(8).optional(),
    caption: text(200),
  })
  .strict()
  .refine((d) => d.layout !== 'compare' || d.nodes.length <= 4, { message: 'a compare diagram holds 2 to 4 nodes', path: ['nodes'] });

const forYou = text(240).optional();
const terms = z.array(Term).max(6).optional();
const sources = (max) => z.array(Source).min(1).max(max);
const paras = (n, max) => z.array(text(max)).min(1).max(n);

export const TopStory = z
  .object({
    id: slug,
    area: Area,
    title: text(120),
    gist: text(240),
    evidence: Evidence,
    why: text(280),
    details: z.array(text(600)).max(4).optional(),
    didNotShow: text(240).optional(),
    terms,
    image: Image.optional(),
    diagram: Diagram.optional(),
    sources: sources(4),
    forYou,
  })
  .strict();

export const BenchPaper = z
  .object({
    id: slug,
    area: Area,
    title: text(200),
    headline: text(200),
    authors: text(160),
    venue: text(120),
    published: date,
    evidence: Evidence,
    question: text(500),
    approach: text(500),
    model: text(500),
    result: text(500),
    limitations: text(500),
    meaning: text(500),
    terms,
    image: Image.optional(),
    diagram: Diagram.optional(),
    sources: sources(4),
    forYou,
  })
  .strict();

// Hosts a method may be taken from. A paper DOI link (doi.org) is also allowed for its methods section.
export const METHOD_HOSTS = ['protocols.io', 'nature.com', 'jove.com', 'bio-protocol.org', 'doi.org', 'pubmed.ncbi.nlm.nih.gov', 'europepmc.org', 'ncbi.nlm.nih.gov'];

export const Method = z
  .object({
    id: slug,
    title: text(90),
    gist: text(240),
    field: Area,
    useWhen: text(300),
    steps: z.array(z.object({ title: text(60), text: text(400) }).strict()).min(2).max(8),
    pitfalls: z.array(text(200)).max(4).optional(),
    safety: text(300),
    source: Source,
    terms,
    forYou,
  })
  .strict();

export const Learn = z
  .object({
    question: text(90),
    answer: text(300),
    analogy: text(240).optional(),
    body: paras(3, 600),
    diagram: Diagram.optional(),
    image: Image.optional(),
    terms,
    seenIn: z.array(slug).max(8).optional(),
    sources: sources(4),
  })
  .strict()
  .refine((l) => !!l.diagram || !!l.image, { message: 'learn needs a diagram or an image', path: ['diagram'] });

export const Trial = z
  .object({
    id: slug,
    area: Area,
    title: text(160),
    nct: z.string().regex(/^NCT\d{8}$/),
    phase: z.enum(['0', '1', '1/2', '2', '2/3', '3', '4', 'n/a']),
    status: text(40),
    change: z.enum(['new', 'updated', 'results-posted', 'completed', 'terminated']),
    what: text(300),
    who: text(200),
    sponsor: text(120),
    sources: sources(2),
  })
  .strict();

export const Call = z
  .object({
    id: slug,
    area: Area,
    title: text(160),
    funder: text(120),
    deadline: date.optional(),
    amount: text(80).optional(),
    eligibility: text(240),
    sources: sources(2),
  })
  .strict();

export const Chatter = z
  .object({
    id: slug,
    area: Area,
    kind: z.enum(['conference', 'tool', 'dataset', 'preprint-buzz', 'retraction', 'correction', 'debate']),
    title: text(120),
    where: text(80),
    signal: text(160),
    gist: text(240),
    sources: sources(3),
  })
  .strict();

export const Curiosity = z
  .object({
    id: slug,
    area: Area,
    title: text(120),
    gist: text(240),
    body: paras(2, 500),
    evidence: Evidence,
    terms,
    image: Image.optional(),
    diagram: Diagram.optional(),
    sources: sources(3),
  })
  .strict();

export const Job = z
  .object({
    id: slug,
    title: text(140),
    employer: text(120),
    location: text(80),
    level: z.enum(['phd', 'postdoc', 'fellow', 'staff-scientist', 'faculty', 'industry']),
    salary: text(80).optional(),
    deadline: date.optional(),
    fit: text(200),
    sources: sources(1),
  })
  .strict();

export const Issue = z
  .object({
    date,
    number: z.number().int().min(1),
    title: text(90),
    dek: text(260),
    palette: z.string().regex(/^[a-z0-9-]+$/),
    tldr: z.array(z.object({ text: text(160), area: Area }).strict()).min(3).max(5),
    top: z.array(TopStory).min(6).max(10),
    bench: z.array(BenchPaper).min(2).max(4),
    method: Method,
    learn: Learn,
    trials: z
      .object({ trials: z.array(Trial).max(6), funding: z.array(Call).max(5) })
      .strict()
      .refine((t) => t.trials.length + t.funding.length >= 1, 'trials and funding needs at least one entry'),
    chatter: z.array(Chatter).min(3).max(6),
    curiosity: Curiosity,
    jobs: z.array(Job).max(8),
    note: text(240).optional(),
  })
  .strict();

export const Week = z
  .object({
    id: z.string().regex(/^\d{4}-W\d{2}$/),
    from: date,
    to: date,
    title: text(90),
    dek: text(260),
    palette: z.string().regex(/^[a-z0-9-]+$/),
    threads: z
      .array(z.object({ title: text(90), text: text(600), area: Area, refs: z.array(slug).max(8).optional() }).strict())
      .min(3)
      .max(6),
    numbers: z.array(z.object({ value: text(12), label: text(120), source: Source }).strict()).max(6),
    deepRead: z
      .object({
        title: text(200),
        authors: text(160),
        venue: text(120),
        evidence: Evidence,
        body: paras(5, 700),
        terms,
        sources: sources(3),
      })
      .strict(),
    watch: z.array(text(200)).min(2).max(5),
  })
  .strict();

/** Every text string inside a value, for global checks (dashes, hype words, privacy). */
export function* strings(v, path = '') {
  if (typeof v === 'string') yield [path, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${path}[${i}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* strings(x, path ? `${path}.${k}` : k);
}
