// Paper sources: PubMed, Europe PMC (incl. preprints), bioRxiv and medRxiv, arXiv, and journal
// tables of contents via OpenAlex and Crossref. All free, none needs a key (PubMed is faster with
// the optional NCBI_API_KEY secret).
import { get, json, xml, text, strip, clip, sleep, iso, daysAgo, abstractFrom, hostOf, parseFeed } from './util.mjs';

const NCBI_KEY = process.env.NCBI_API_KEY;
const NCBI_GAP = NCBI_KEY ? 130 : 400;
let lastNcbi = 0;
async function ncbiGate() {
  const wait = lastNcbi + NCBI_GAP - Date.now();
  if (wait > 0) await sleep(wait);
  lastNcbi = Date.now();
}
const asArray = (v) => (v == null ? [] : [].concat(v));

export async function pubmed(src, { windowDays }) {
  const days = src.days ?? Math.max(2, Math.ceil(windowDays));
  const key = NCBI_KEY ? `&api_key=${NCBI_KEY}` : '';
  await ncbiGate();
  const search = await json(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(src.term)}&datetype=edat&reldate=${days}&retmax=${src.max ?? 60}&sort=date&retmode=json${key}`,
  );
  const ids = search.esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  await ncbiGate();
  const body = await get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml${key}`, { timeout: 40_000 });
  const doc = xml.parse(body);
  const out = [];
  for (const a of asArray(doc?.PubmedArticleSet?.PubmedArticle)) {
    const cit = a.MedlineCitation;
    const art = cit?.Article;
    if (!art) continue;
    const pmid = text(cit.PMID);
    const abs = asArray(art.Abstract?.AbstractText).map((t) => strip(t)).join(' ');
    const ids2 = asArray(a.PubmedData?.ArticleIdList?.ArticleId);
    const doi = ids2.find((x) => x['@IdType'] === 'doi');
    const entrez = asArray(a.PubmedData?.History?.PubMedPubDate).find((d) => d['@PubStatus'] === 'entrez' || d['@PubStatus'] === 'pubmed');
    const published = entrez ? `${entrez.Year}-${String(entrez.Month).padStart(2, '0')}-${String(entrez.Day).padStart(2, '0')}` : null;
    const types = asArray(art.PublicationTypeList?.PublicationType).map(text);
    out.push({
      title: strip(art.ArticleTitle),
      url: doi ? `https://doi.org/${text(doi)}` : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      doi: doi ? text(doi) : undefined,
      pmid,
      published,
      summary: abs,
      venue: strip(art.Journal?.Title),
      pubTypes: types,
      hostGroup: 'pubmed',
    });
  }
  return out;
}

export async function europepmc(src, { windowDays }) {
  const from = iso(daysAgo(src.days ?? windowDays));
  const to = iso(new Date());
  const q = `(${src.query}) AND (FIRST_PDATE:[${from} TO ${to}])${src.preprints ? ' AND SRC:PPR' : ''}`;
  const data = await json(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&pageSize=${src.max ?? 50}&resultType=core&sort=${encodeURIComponent('P_PDATE_D desc')}`,
    { timeout: 40_000 },
  );
  return (data.resultList?.result ?? []).map((r) => ({
    title: strip(r.title),
    url: r.doi ? `https://doi.org/${r.doi}` : r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : `https://europepmc.org/article/${r.source}/${r.id}`,
    doi: r.doi,
    pmid: r.pmid,
    published: r.firstPublicationDate,
    summary: strip(r.abstractText ?? ''),
    venue: r.journalTitle ?? (r.source === 'PPR' ? 'Preprint' : ''),
    preprint: r.source === 'PPR',
    hostGroup: r.source === 'PPR' ? 'europepmc-preprints' : 'europepmc',
  }));
}

export async function biorxiv(src, { windowDays }) {
  const from = iso(daysAgo(src.days ?? windowDays));
  const to = iso(new Date());
  const out = [];
  for (const cat of src.categories) {
    for (let cursor = 0; cursor < (src.maxPages ?? 3) * 100; cursor += 100) {
      const data = await json(`https://api.biorxiv.org/details/${src.server}/${from}/${to}/${cursor}?category=${encodeURIComponent(cat.replace(/ /g, '_'))}`, { timeout: 40_000 });
      const rows = data.collection ?? [];
      for (const r of rows) {
        out.push({
          title: strip(r.title),
          url: `https://www.${src.server}.org/content/${r.doi}v${r.version}`,
          doi: r.doi,
          published: r.date,
          summary: strip(r.abstract ?? ''),
          venue: `${src.server} (${r.category})`,
          preprint: true,
          hostGroup: src.server,
        });
      }
      if (rows.length < 100) break;
      await sleep(300);
    }
    await sleep(300);
  }
  return out;
}

export async function arxiv(src) {
  // The API answers every day; the RSS feeds are empty at weekends. An empty answer is not an error.
  const q = src.query ?? `cat:${src.cat}`;
  const body = await get(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=${src.max ?? 60}`);
  return parseFeed(body).map((it) => {
    const url = it.url.replace(/^http:/, 'https:').replace(/v\d+$/, '');
    return { ...it, url, preprint: true, venue: 'arXiv', hostGroup: 'arxiv' };
  });
}

export async function openalex(src, { windowDays }) {
  const from = iso(daysAgo(src.days ?? windowDays));
  const issn = [].concat(src.issn).join('|');
  const data = await json(
    `https://api.openalex.org/works?filter=primary_location.source.issn:${issn},from_publication_date:${from},type:article|review&per-page=${src.max ?? 40}&sort=publication_date:desc&select=id,doi,title,display_name,publication_date,abstract_inverted_index,primary_location,type,authorships`,
    { timeout: 40_000 },
  );
  return (data.results ?? []).map((w) => {
    const landing = w.primary_location?.landing_page_url;
    const doi = w.doi?.replace('https://doi.org/', '');
    return {
      title: strip(w.display_name ?? w.title),
      url: doi ? `https://doi.org/${doi}` : landing ?? w.id,
      doi,
      published: w.publication_date,
      summary: strip(abstractFrom(w.abstract_inverted_index)),
      venue: src.name,
      hostGroup: hostOf(landing ?? '') || 'doi.org',
      reviewType: w.type === 'review',
      authors: (w.authorships ?? []).slice(0, 3).map((a) => a.author?.display_name).filter(Boolean).join(', '),
    };
  });
}

export async function crossref(src, { windowDays }) {
  const from = iso(daysAgo(src.days ?? windowDays));
  const issn = [].concat(src.issn)[0];
  const data = await json(
    `https://api.crossref.org/journals/${issn}/works?filter=from-pub-date:${from}&rows=${src.max ?? 40}&sort=published&order=desc&select=DOI,title,abstract,container-title,published,URL,type`,
    { timeout: 40_000 },
  );
  return (data.message?.items ?? []).map((w) => {
    const p = w.published?.['date-parts']?.[0] ?? [];
    const published = p.length ? `${p[0]}-${String(p[1] ?? 1).padStart(2, '0')}-${String(p[2] ?? 1).padStart(2, '0')}` : null;
    return {
      title: strip(w.title?.[0] ?? ''),
      url: `https://doi.org/${w.DOI}`,
      doi: w.DOI,
      published,
      summary: strip(w.abstract ?? ''),
      venue: src.name,
      hostGroup: hostOf(w.URL ?? '') || 'doi.org',
    };
  });
}
