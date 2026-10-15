import { ALPHABET } from '../crypto/classical';

interface Props {
  /** Percentual de cada letra do texto observado (26 valores). */
  observed: number[];
  /** Percentual esperado de cada letra (26 valores), por exemplo, o do português. */
  expected: number[];
  observedLabel: string;
  expectedLabel: string;
}

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

/**
 * Histograma de frequências: barra cheia = texto observado; barra vazada = frequência esperada.
 * A tabela equivalente, abaixo, atende a quem não enxerga o gráfico.
 */
export function FrequencyChart({ observed, expected, observedLabel, expectedLabel }: Props) {
  const max = Math.max(...observed, ...expected, 1);
  return (
    <figure className="space-y-2">
      <div
        role="img"
        aria-label={`Histograma de frequências das 26 letras. Barras cheias: ${observedLabel}. Barras vazadas: ${expectedLabel}. Os valores estão na tabela logo abaixo.`}
        className="flex h-48 items-end gap-1 rounded-xl border border-line bg-surface p-3"
      >
        {[...ALPHABET].map((ch, i) => (
          <div key={ch} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-px">
              <div className="w-1/2 rounded-t-sm bg-k-cipher" style={{ height: `${(observed[i] / max) * 100}%` }} />
              <div className="w-1/2 rounded-t-sm border-2 border-b-0 border-k-public" style={{ height: `${(expected[i] / max) * 100}%` }} />
            </div>
            <span aria-hidden="true" className="font-mono text-base leading-none">
              {ch}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-x-6 gap-y-1 text-base">
        <span>
          <span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rounded-sm bg-k-cipher align-middle" />
          Barra cheia: {observedLabel}
        </span>
        <span>
          <span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rounded-sm border-2 border-k-public align-middle" />
          Barra vazada: {expectedLabel}
        </span>
      </figcaption>
      <details>
        <summary className="cursor-pointer text-base font-semibold text-accent">Ver os valores em tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left font-mono text-base">
            <caption className="sr-only">Frequência de cada letra, em porcentagem</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-1 pr-2 font-sans">Letra</th>
                {[...ALPHABET].map((ch) => (
                  <th key={ch} scope="col" className="px-1 text-center">{ch}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <th scope="row" className="py-1 pr-2 font-sans">Observado (%)</th>
                {observed.map((v, i) => (
                  <td key={i} className="px-1 text-center">{fmt(v)}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-1 pr-2 font-sans">Esperado (%)</th>
                {expected.map((v, i) => (
                  <td key={i} className="px-1 text-center">{fmt(v)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
