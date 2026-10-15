import { ALPHABET } from '../crypto/classical';

interface Props {
  /** Letra da chave (0 a 25) cuja linha fica em destaque. */
  keyIndex: number | null;
  /** Letra clara (0 a 25) cuja coluna fica em destaque. */
  plainIndex: number | null;
}

/** Tabela de Vigenère: na linha K e coluna P está a letra cifrada (P + K) mod 26. */
export function TabulaRecta({ keyIndex, plainIndex }: Props) {
  const hit = keyIndex !== null && plainIndex !== null ? ALPHABET[(keyIndex + plainIndex) % 26] : null;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-2">
      <table className="border-separate border-spacing-px font-mono text-sm" aria-label="Tabela de Vigenère">
        <caption className="sr-only">
          Tabela de Vigenère. Cada linha é um alfabeto deslocado pela letra da chave.{hit ? ` Na linha ${ALPHABET[keyIndex!]} e coluna ${ALPHABET[plainIndex!]} está a letra ${hit}.` : ''}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="min-w-6 text-k-plain">
              <span className="sr-only">Chave \ Claro</span>
            </th>
            {[...ALPHABET].map((ch, c) => (
              <th key={ch} scope="col" className={`min-w-6 rounded font-bold text-k-plain ${plainIndex === c ? 'bg-k-plain/25' : ''}`}>
                {ch}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...ALPHABET].map((rowCh, r) => (
            <tr key={rowCh}>
              <th scope="row" className={`rounded font-bold text-k-cipher ${keyIndex === r ? 'bg-k-cipher/25' : ''}`}>
                {rowCh}
              </th>
              {[...ALPHABET].map((_, c) => {
                const isHit = keyIndex === r && plainIndex === c;
                const inLine = keyIndex === r || plainIndex === c;
                return (
                  <td
                    key={c}
                    className={`rounded text-center ${isHit ? 'border-2 border-accent bg-accent text-accent-ink font-bold' : inLine ? 'bg-surface2 font-semibold' : 'text-muted'}`}
                  >
                    {ALPHABET[(r + c) % 26]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
