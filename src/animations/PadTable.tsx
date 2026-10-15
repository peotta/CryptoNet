import { ALPHABET } from '../crypto/classical';
import type { ItemKind } from '../simulation/types';

export interface PadRow {
  label: string;
  letters: string;
  kind: ItemKind;
}

interface Props {
  rows: PadRow[];
  /** Posição (a partir de 0) em destaque; nulo = nenhuma. */
  index: number | null;
  /** Quantas colunas mostrar em torno da posição em destaque. */
  window?: number;
  caption: string;
}

const COLOR: Partial<Record<ItemKind, string>> = {
  plain: 'text-k-plain',
  secret: 'text-k-secret',
  cipher: 'text-k-cipher',
  param: 'text-k-param',
  signature: 'text-k-signature',
};

/** Linhas de letras alinhadas por posição (por exemplo, texto claro, chave e cifra), com a coluna atual em destaque. */
export function PadTable({ rows, index, window = 20, caption }: Props) {
  const n = Math.max(...rows.map((r) => r.letters.length));
  const center = index ?? 0;
  const start = Math.max(0, Math.min(center - Math.floor(window / 2), n - window));
  const end = Math.min(n, start + window);
  const cols = Array.from({ length: end - start }, (_, i) => start + i);
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
      <table className="border-separate border-spacing-1 font-mono text-lg">
        <caption className="mb-1 text-left font-sans text-base text-muted">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left font-sans text-base font-semibold">
              Posição
            </th>
            {cols.map((c) => (
              <th key={c} scope="col" className={`min-w-8 rounded text-center text-base font-normal ${c === index ? 'bg-accent/20 font-bold' : 'text-muted'}`}>
                {c + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className={`pr-3 text-left font-sans text-base font-semibold ${COLOR[r.kind] ?? ''}`}>
                {r.label}
              </th>
              {cols.map((c) => {
                const ch = r.letters[c] ?? '';
                return (
                  <td key={c} className={`rounded border text-center ${c === index ? 'border-accent bg-accent/15 font-bold' : 'border-line'}`}>
                    {ch}
                    {ch && c === index && <span className="sr-only"> (posição atual; valor {ALPHABET.indexOf(ch)})</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-base text-muted">
        Mostrando as posições {start + 1} a {end} de {n}.
      </p>
    </div>
  );
}
