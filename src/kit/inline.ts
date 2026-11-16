// Renders the tiny inline markup issues are allowed to use: **bold**, `code` and
// [label](https://url). Everything is HTML-escaped first, so nothing else can ever render.
// Optional terms are underlined (first use only) with their plain-language definition.

export interface TermDef {
  term: string;
  def: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function inline(src: string, terms: TermDef[] = []): string {
  let out = escapeHtml(String(src ?? ''));
  out = out.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, (_m, label, url) => `<a href="${url}" rel="noopener noreferrer" target="_blank">${label}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  if (!terms.length) return out;

  const used = new Set<string>();
  let inAnchor = 0;
  return out
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<a[\s>]/i.test(part)) inAnchor++;
        if (/^<\/a>/i.test(part)) inAnchor--;
        return part;
      }
      if (inAnchor > 0) return part;
      let text = part;
      for (const t of terms) {
        const key = t.term.toLowerCase();
        if (used.has(key)) continue;
        const re = new RegExp(`(^|[^\\w-])(${escapeRe(escapeHtml(t.term))})(?![\\w-])`, 'i');
        if (re.test(text)) {
          used.add(key);
          const def = escapeHtml(t.def);
          text = text.replace(re, (_m, pre, word) => `${pre}<abbr class="term" tabindex="0" title="${def}" data-def="${def}">${word}</abbr>`);
        }
      }
      return text;
    })
    .join('');
}

export const plain = (src: string) => String(src ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '');
