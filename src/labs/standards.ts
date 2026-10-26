// Endereços das normas citadas nos laboratórios. Fonte única da tela e do gerador de documentação.

const csrc = (path: string) => `https://csrc.nist.gov/pubs/${path}/final`;

/** Nome da norma, como aparece nos textos, e a página oficial no NIST (csrc.nist.gov). */
export const NIST_URLS: Record<string, string> = {
  'FIPS 180-4': csrc('fips/180-4'),
  'FIPS 186-5': csrc('fips/186-5'),
  'FIPS 197': csrc('fips/197'),
  'FIPS 198-1': csrc('fips/198-1'),
  'FIPS 202': csrc('fips/202'),
  'FIPS 203': csrc('fips/203'),
  'FIPS 204': csrc('fips/204'),
  'FIPS 205': csrc('fips/205'),
  'SP 800-38A': csrc('sp/800/38/a'),
  'SP 800-38D': csrc('sp/800/38/d'),
  'SP 800-52 Rev. 2': csrc('sp/800/52/r2'),
  'SP 800-56A Rev. 3': csrc('sp/800/56/a/r3'),
  'SP 800-56B Rev. 2': csrc('sp/800/56/b/r2'),
  'SP 800-56C Rev. 2': csrc('sp/800/56/c/r2'),
  'SP 800-57 Parte 1 Rev. 5': csrc('sp/800/57/pt1/r5'),
  'SP 800-186': csrc('sp/800/186'),
};

export const rfcUrl = (n: number | string) => `https://www.rfc-editor.org/rfc/rfc${n}`;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const names = Object.keys(NIST_URLS).sort((a, b) => b.length - a.length);
/** Reconhece uma norma do NIST (a mais longa primeiro) ou uma RFC. */
const PATTERN = new RegExp(`(${names.map(escape).join('|')}|RFC \\d{3,5})`, 'g');

export interface Segment {
  text: string;
  href?: string;
}

/** Divide um texto em trechos, marcando com o endereço as normas do NIST e as RFCs. */
export function splitStandards(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    const name = m[0];
    out.push({ text: name, href: name.startsWith('RFC ') ? rfcUrl(name.slice(4)) : NIST_URLS[name] });
    last = i + name.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** O mesmo, em Markdown: [FIPS 203](url). Não altera o que já é link. */
export function linkStandardsMarkdown(text: string): string {
  return text
    .replace(/\[RFC (\d+)\]\([^)]*\)/g, (_, n: string) => `[RFC ${n}](${rfcUrl(n)})`)
    .replace(new RegExp(`(?<!\\[)${PATTERN.source}(?!\\]\\()`, 'g'), (name: string) => `[${name}](${name.startsWith('RFC ') ? rfcUrl(name.slice(4)) : NIST_URLS[name]})`);
}
