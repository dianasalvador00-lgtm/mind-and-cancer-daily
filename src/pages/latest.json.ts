import { getIssues, href } from '../kit/data';

export function GET() {
  const issue = getIssues()[0];
  const body = issue
    ? { date: issue.date, number: issue.number, title: issue.title, dek: issue.dek, url: href(`${issue.date}/`) }
    : { date: null };
  return new Response(JSON.stringify(body, null, 1), { headers: { 'Content-Type': 'application/json' } });
}
