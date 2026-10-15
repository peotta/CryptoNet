import { railPattern, toGrid } from '../crypto/transposition';

interface RailProps {
  text: string;
  rails: number;
  /** Posição (a partir de 0) em destaque; nulo = nenhuma. */
  index: number | null;
  window?: number;
}

/** Zigue-zague da cerca de trilhos: cada letra fica no trilho em que a escrita passa por ela. */
export function RailGrid({ text, rails, index, window = 30 }: RailProps) {
  const pat = railPattern(text.length, rails);
  const center = index ?? 0;
  const start = Math.max(0, Math.min(center - Math.floor(window / 2), text.length - window));
  const end = Math.min(text.length, start + window);
  const cols = Array.from({ length: end - start }, (_, i) => start + i);
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
      <table className="border-separate border-spacing-1 font-mono text-lg">
        <caption className="mb-1 text-left font-sans text-base text-muted">Texto escrito em zigue-zague sobre {rails} trilhos (a cifra é a leitura trilho por trilho)</caption>
        <tbody>
          {Array.from({ length: rails }, (_, r) => (
            <tr key={r}>
              <th scope="row" className="pr-2 text-left font-sans text-base font-semibold text-k-public">
                Trilho {r + 1}
              </th>
              {cols.map((c) => {
                const here = pat[c] === r;
                const on = c === index && here;
                return (
                  <td key={c} className={`h-8 w-8 rounded border text-center ${on ? 'border-accent bg-accent/20 font-bold' : here ? 'border-line' : 'border-transparent'}`}>
                    {here ? text[c] : ''}
                    {on && <span className="sr-only"> (letra atual)</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-base text-muted">
        Mostrando as posições {start + 1} a {end} de {text.length}.
      </p>
    </div>
  );
}

interface ColProps {
  text: string;
  keyword: string;
  /** Colunas já lidas (na ordem de leitura): destacadas. */
  readColumns: number[];
  caption: string;
  maxRows?: number;
}

/** Grade da transposição colunar: letras escritas em linhas sob a palavra-chave, com a ordem de leitura numerada. */
export function ColumnGrid({ text, keyword, readColumns, caption, maxRows = 14 }: ColProps) {
  const k = [...keyword];
  const c = k.length;
  const grid = toGrid(text, c);
  const order = [...k].map((ch, i) => ({ ch, i })).sort((a, b) => a.ch.localeCompare(b.ch) || a.i - b.i).map((x) => x.i);
  const rankOf = new Array<number>(c);
  order.forEach((col, rank) => (rankOf[col] = rank + 1));
  const shown = grid.slice(0, maxRows);
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
      <table className="border-separate border-spacing-1 font-mono text-lg">
        <caption className="mb-1 text-left font-sans text-base text-muted">{caption}</caption>
        <thead>
          <tr>
            {k.map((ch, j) => (
              <th key={j} scope="col" className={`h-9 w-9 rounded border-2 text-center ${readColumns.includes(j) ? 'border-k-cipher bg-k-cipher/20' : 'border-k-secret'}`}>
                {ch}
              </th>
            ))}
          </tr>
          <tr>
            {k.map((_, j) => (
              <th key={j} scope="col" className="text-center font-sans text-base font-normal text-muted">
                <span className="sr-only">ordem de leitura </span>
                {rankOf[j]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, r) => (
            <tr key={r}>
              {k.map((_, j) => (
                <td key={j} className={`h-8 w-9 rounded border text-center ${readColumns.includes(j) ? 'border-k-cipher bg-k-cipher/10' : 'border-line'}`}>
                  {row[j] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-base text-muted">
        A linha de cima é a palavra-chave; a de baixo, a ordem alfabética das letras (ordem de leitura das colunas).
        {grid.length > maxRows ? ` Mostrando ${maxRows} de ${grid.length} linhas.` : ''}
      </p>
    </div>
  );
}
