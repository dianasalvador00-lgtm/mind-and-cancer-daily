#!/usr/bin/env node
// Reads one paper (or trial) from free APIs so the daily run does not have to scrape a publisher page.
//   node scripts/read-paper.mjs 10.1038/s41591-024-00000-0     by DOI
//   node scripts/read-paper.mjs PMID:12345678                  by PubMed id
//   node scripts/read-paper.mjs NCT01234567                    a ClinicalTrials.gov record
//   node scripts/read-paper.mjs <id> --figures                 also list open-access figure URLs
//
// Prints title, authors, journal, date, abstract, open-access licence, and for open-access papers
// the figures with captions. The licence line is what decides whether a figure may be used.
import { get, json, strip } from './sources/util.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const wantFigures = args.includes('--figures');
if (!id) {
  console.error('usage: node scripts/read-paper.mjs <DOI | PMID:n | NCTxxxxxxxx> [--figures]');
  process.exit(2);
}

if (/^NCT\d{8}$/i.test(id)) {
  const s = await json(`https://clinicaltrials.gov/api/v2/studies/${id.toUpperCase()}`);
  const p = s.protocolSection ?? {};
  const r = s.resultsSection;
  console.log(`TRIAL ${p.identificationModule?.nctId}: ${p.identificationModule?.briefTitle}`);
  console.log(`official: ${p.identificationModule?.officialTitle ?? ''}`);
  console.log(`status: ${p.statusModule?.overallStatus} | first posted ${p.statusModule?.studyFirstPostDateStruct?.date} | last update ${p.statusModule?.lastUpdatePostDateStruct?.date}`);
  console.log(`phase: ${(p.designModule?.phases ?? []).join('/')} | enrollment: ${p.designModule?.enrollmentInfo?.count ?? '?'} (${p.designModule?.enrollmentInfo?.type ?? ''})`);
  console.log(`sponsor: ${p.sponsorCollaboratorsModule?.leadSponsor?.name}`);
  console.log(`conditions: ${(p.conditionsModule?.conditions ?? []).join('; ')}`);
  console.log(`arms: ${(p.armsInterventionsModule?.armGroups ?? []).map((a) => a.label).join(' | ')}`);
  console.log(`primary outcomes: ${(p.outcomesModule?.primaryOutcomes ?? []).map((o) => o.measure).join(' | ')}`);
  console.log(`summary: ${strip(p.descriptionModule?.briefSummary ?? '')}`);
  console.log(`results posted: ${r ? 'yes' : 'no'}`);
  process.exit(0);
}

const query = /^PMID:/i.test(id) ? `EXT_ID:${id.replace(/^PMID:/i, '')} AND SRC:MED` : `DOI:"${id.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}"`;
const data = await json(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core&pageSize=1`);
const r = data.resultList?.result?.[0];
if (!r) {
  console.log('NOT FOUND in Europe PMC. Try the publisher page or PubMed instead.');
  process.exit(1);
}
console.log(`TITLE: ${strip(r.title)}`);
console.log(`AUTHORS: ${r.authorString ?? ''}`);
console.log(`JOURNAL: ${r.journalInfo?.journal?.title ?? r.journalTitle ?? r.bookOrReportDetails?.publisher ?? r.source} | date ${r.firstPublicationDate} | type ${(r.pubTypeList?.pubType ?? []).join(', ')}`);
console.log(`DOI: ${r.doi ?? ''} | PMID: ${r.pmid ?? ''} | PMCID: ${r.pmcid ?? ''} | source: ${r.source} ${r.source === 'PPR' ? '(PREPRINT, not peer reviewed)' : ''}`);
console.log(`OPEN ACCESS: ${r.isOpenAccess} | LICENCE: ${r.license ?? 'none stated (do not use figures)'}`);
console.log(`FUNDING/GRANTS: ${(r.grantsList?.grant ?? []).slice(0, 4).map((g) => `${g.agency ?? ''} ${g.grantId ?? ''}`.trim()).join('; ') || 'not listed'}`);
console.log(`ABSTRACT: ${strip(r.abstractText ?? '(no abstract in Europe PMC)')}`);

if (wantFigures) {
  if (!r.pmcid || r.isOpenAccess !== 'Y') {
    console.log('FIGURES: none (not in the open-access full-text set)');
  } else {
    const xml = await get(`https://www.ebi.ac.uk/europepmc/webservices/rest/${r.pmcid}/fullTextXML`, { timeout: 40_000 });
    const figs = [...xml.matchAll(/<fig\b[\s\S]*?<\/fig>/g)].slice(0, 8);
    console.log(`FIGURES (licence of the paper: ${r.license ?? 'unknown'}):`);
    for (const f of figs) {
      const label = strip(f[0].match(/<label>([\s\S]*?)<\/label>/)?.[1] ?? '');
      const cap = strip(f[0].match(/<caption>([\s\S]*?)<\/caption>/)?.[1] ?? '').slice(0, 220);
      const href = f[0].match(/xlink:href="([^"]+)"/)?.[1];
      if (href) console.log(` ${label}: https://europepmc.org/articles/${r.pmcid}/bin/${href}.jpg  | ${cap}`);
    }
  }
}
