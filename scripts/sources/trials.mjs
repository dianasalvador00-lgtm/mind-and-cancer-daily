// ClinicalTrials.gov API v2: studies first posted or updated inside the window.
import { json, clip, strip, iso, daysAgo } from './util.mjs';

const PHASES = { PHASE1: '1', PHASE2: '2', PHASE3: '3', PHASE4: '4', EARLY_PHASE1: '0', NA: 'n/a' };

export async function clinicaltrials(src, { windowDays }) {
  const from = iso(daysAgo(src.days ?? windowDays));
  const fields = ['NCTId', 'BriefTitle', 'OverallStatus', 'Phase', 'LeadSponsorName', 'Condition', 'StudyFirstPostDate', 'LastUpdatePostDate', 'ResultsFirstPostDate', 'BriefSummary', 'EnrollmentCount'].join('|');
  const url =
    `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(src.cond)}` +
    `${src.term ? `&query.term=${encodeURIComponent(src.term)}` : ''}` +
    `&filter.advanced=${encodeURIComponent(`AREA[LastUpdatePostDate]RANGE[${from},MAX]`)}` +
    `&filter.overallStatus=${encodeURIComponent((src.status ?? ['NOT_YET_RECRUITING', 'RECRUITING', 'ENROLLING_BY_INVITATION', 'ACTIVE_NOT_RECRUITING', 'COMPLETED', 'TERMINATED']).join(','))}` +
    `&sort=${encodeURIComponent('LastUpdatePostDate:desc')}&pageSize=${src.max ?? 30}&fields=${encodeURIComponent(fields)}`;
  const data = await json(url, { timeout: 40_000 });
  return (data.studies ?? []).map((s) => {
    const p = s.protocolSection ?? {};
    const nct = p.identificationModule?.nctId;
    const first = p.statusModule?.studyFirstPostDateStruct?.date;
    const last = p.statusModule?.lastUpdatePostDateStruct?.date;
    const results = s.resultsSection ? s.protocolSection?.statusModule?.resultsFirstPostDateStruct?.date : null;
    const phases = (p.designModule?.phases ?? []).map((x) => PHASES[x] ?? x);
    const fresh = (d) => d && Date.parse(d) >= Date.parse(from);
    const status = p.statusModule?.overallStatus ?? '';
    const change = fresh(first) ? 'new' : fresh(results) ? 'results-posted' : status === 'COMPLETED' ? 'completed' : status === 'TERMINATED' ? 'terminated' : 'updated';
    return {
      title: strip(p.identificationModule?.briefTitle ?? ''),
      url: `https://clinicaltrials.gov/study/${nct}`,
      nct,
      published: last ?? first,
      summary: clip(strip(p.descriptionModule?.briefSummary ?? ''), 480),
      phase: phases.join('/') || 'n/a',
      status: status.toLowerCase().replace(/_/g, ' '),
      sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name,
      conditions: (p.conditionsModule?.conditions ?? []).slice(0, 4).join(', '),
      change,
      hostGroup: 'clinicaltrials.gov',
    };
  });
}
