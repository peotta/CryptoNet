import { hex32 } from '../crypto/chacha20';

interface GridProps {
  state: number[];
  /** Posições (0 a 15) em destaque, por exemplo as quatro palavras do quarter round atual. */
  highlight?: number[];
  caption: string;
}

const ROLE = (i: number) => (i < 4 ? 'constante' : i < 12 ? 'chave' : i === 12 ? 'contador' : 'nonce');
const ROLE_CLASS: Record<string, string> = {
  constante: 'text-k-param',
  chave: 'text-k-secret',
  contador: 'text-k-public',
  nonce: 'text-k-public',
};

/** Estado de 16 palavras de 32 bits como matriz 4 × 4 (as colunas são as palavras 0,4,8,12 etc.). */
export function StateGrid({ state, highlight = [], caption }: GridProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
      <table className="border-separate border-spacing-1 font-mono text-base">
        <caption className="mb-1 text-left font-sans text-base text-muted">{caption}</caption>
        <tbody>
          {[0, 1, 2, 3].map((r) => (
            <tr key={r}>
              {[0, 1, 2, 3].map((c) => {
                const i = 4 * r + c;
                const on = highlight.includes(i);
                return (
                  <td key={c} title={`palavra ${i}: ${ROLE(i)}`} className={`rounded border px-2 py-1 text-center ${on ? 'border-accent bg-accent/20 font-bold' : 'border-line'} ${ROLE_CLASS[ROLE(i)]}`}>
                    {hex32(state[i])}
                    {on && <span className="sr-only"> (em destaque)</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-base text-muted">Cada célula é uma palavra de 32 bits em hexadecimal. Cores: constantes, chave, contador e nonce.</p>
    </div>
  );
}

const bin32 = (v: number) => (v >>> 0).toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1 ');

interface WordsProps {
  words: { name: string; value: number; active?: boolean }[];
  caption: string;
}

/** As quatro palavras a, b, c, d do quarter round, em hexadecimal e em binário. */
export function QuarterWords({ words, caption }: WordsProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
      <table className="w-full text-left font-mono text-base">
        <caption className="mb-1 text-left font-sans text-base text-muted">{caption}</caption>
        <thead>
          <tr className="font-sans">
            <th scope="col" className="pr-4">Palavra</th>
            <th scope="col" className="pr-4">Hexadecimal</th>
            <th scope="col">Binário (32 bits)</th>
          </tr>
        </thead>
        <tbody>
          {words.map((w) => (
            <tr key={w.name} className={w.active ? 'bg-accent/15 font-bold' : ''}>
              <th scope="row" className="pr-4 font-sans">
                {w.name}
                {w.active && <span className="sr-only"> (alterada neste passo)</span>}
              </th>
              <td className="pr-4">{hex32(w.value)}</td>
              <td className="whitespace-nowrap">{bin32(w.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
