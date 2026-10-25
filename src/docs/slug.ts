/** Âncora de um título, no padrão do GitHub: minúsculas, sem pontuação, espaços viram hífens (igual ao gerador da documentação). */
export const slug = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');

export interface Heading {
  level: number;
  text: string;
  id: string;
}

/** Títulos de nível 2 a 4 do Markdown (ignora blocos de código), para o índice lateral. */
export function headingsOf(markdown: string): Heading[] {
  const out: Heading[] = [];
  let fence = false;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) fence = !fence;
    if (fence) continue;
    const m = /^(#{2,4}) (.+)$/.exec(line);
    if (!m) continue;
    const text = m[2].replace(/[*`_]/g, '').trim();
    out.push({ level: m[1].length, text, id: slug(text) });
  }
  return out;
}
