import { useState } from 'react';
import { SBOXES, sbox, type Bits, type SBoxStep } from '../../crypto/des';

const bin = (bits: ArrayLike<number>) => Array.from(bits).join('');

/** Faixa de 48 bits em oito blocos de 6; o bloco da caixa atual e os bits de linha e coluna ficam em destaque. */
function Strip48({ mixed, active }: { mixed: Bits; active: number }) {
  return (
    <div className="overflow-x-auto" role="group" aria-label="Os 48 bits de E(R) ⊕ K em oito blocos de 6 bits">
      <div className="flex gap-1.5 font-mono text-base">
        {Array.from({ length: 8 }, (_, b) => {
          const bits = mixed.slice(6 * b, 6 * b + 6);
          const on = b === active;
          return (
            <div key={b} className={`rounded-lg border-2 px-2 py-1 text-center ${on ? 'border-accent bg-accent/15 font-bold' : 'border-line opacity-60'}`}>
              <div className="font-sans text-xs">S{b + 1}</div>
              {on ? (
                <span>
                  <span className="rounded bg-accent/40 px-0.5 underline">{bits[0]}</span>
                  <span>{bin(bits.slice(1, 5))}</span>
                  <span className="rounded bg-accent/40 px-0.5 underline">{bits[5]}</span>
                </span>
              ) : (
                <span>{bin(bits)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Faixa de 32 bits de saída: as caixas já consultadas mostram seus 4 bits; as demais, pontos. */
function Strip32({ outputs, active }: { outputs: (Bits | null)[]; active: number }) {
  return (
    <div className="overflow-x-auto" role="group" aria-label="A saída de 32 bits das caixas S, em oito blocos de 4 bits">
      <div className="flex gap-1.5 font-mono text-base">
        {outputs.map((o, b) => (
          <div key={b} className={`rounded-lg border-2 px-2 py-1 text-center ${b === active ? 'border-accent bg-accent/15 font-bold' : 'border-line'} ${o ? '' : 'opacity-50'}`}>
            <div className="font-sans text-xs">S{b + 1}</div>
            <span>{o ? bin(o) : '····'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matriz 4 × 16 da caixa, com a linha, a coluna e a célula consultada em destaque. */
export function SBoxMatrix({ box, row, col }: { box: number; row: number; col: number }) {
  const t = SBOXES[box - 1];
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
      <table className="w-full border-collapse text-center font-mono text-base" aria-label={`Tabela da caixa S${box}, 4 linhas por 16 colunas`}>
        <caption className="mb-1 text-left font-sans text-base text-muted">
          Caixa S{box}: linha {row} (bits externos) e coluna {col} (bits do meio) apontam o valor {t[16 * row + col]}
        </caption>
        <thead>
          <tr className="font-sans">
            <th scope="col" className="px-1 text-left text-sm">linha / coluna</th>
            {Array.from({ length: 16 }, (_, c) => (
              <th key={c} scope="col" className={`px-1 ${c === col ? 'bg-accent/30' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }, (_, r) => (
            <tr key={r} className={r === row ? 'bg-accent/15' : ''}>
              <th scope="row" className={`px-1 text-left font-sans ${r === row ? 'bg-accent/30' : ''}`}>
                {r}
              </th>
              {Array.from({ length: 16 }, (_, c) => {
                const hit = r === row && c === col;
                return (
                  <td key={c} className={`px-1 py-0.5 ${c === col ? 'bg-accent/15' : ''} ${hit ? 'rounded border-2 border-accent bg-accent/50 font-bold ring-2 ring-accent motion-safe:animate-pulse' : ''}`}>
                    {t[16 * r + c]}
                    {hit && <span className="sr-only"> (célula consultada)</span>}
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

function Lookup({ s }: { s: SBoxStep }) {
  return (
    <p className="text-lg" aria-live="polite">
      Entrada <span className="font-mono">{bin(s.input)}</span>: os bits externos <span className="font-mono">{s.input[0]}{s.input[5]}</span> dão a linha <strong>{s.row}</strong>; os bits do meio{' '}
      <span className="font-mono">{bin(s.input.slice(1, 5))}</span> dão a coluna <strong>{s.col}</strong>. A célula vale <strong>{s.value}</strong>, que em 4 bits é{' '}
      <span className="font-mono font-bold">{bin(s.output)}</span>.
    </p>
  );
}

/** Passo de uma caixa S dentro da rodada: os 48 bits, a consulta na matriz e a saída acumulada. */
export function SBoxStepView({ mixed, sboxes, upto }: { mixed: Bits; sboxes: SBoxStep[]; upto: number }) {
  const s = sboxes[upto - 1];
  const outputs = sboxes.map((x, b) => (b < upto ? x.output : null));
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-base font-semibold">1. Os 48 bits em oito blocos de 6; a caixa S{s.box} recebe o bloco em destaque</p>
        <Strip48 mixed={mixed} active={upto - 1} />
      </div>
      <div>
        <p className="mb-1 text-base font-semibold">2. Consulta na tabela 4 × 16: o primeiro e o último bit escolhem a linha, os quatro do meio escolhem a coluna</p>
        <SBoxMatrix box={s.box} row={s.row} col={s.col} />
      </div>
      <Lookup s={s} />
      <div>
        <p className="mb-1 text-base font-semibold">3. Saída: os 4 bits da célula ocupam o seu lugar nos 32 bits</p>
        <Strip32 outputs={outputs} active={upto - 1} />
      </div>
    </div>
  );
}

/** A.4: o aluno escolhe a caixa e os 6 bits e vê a consulta, com o efeito de inverter um único bit. */
export function SBoxPlayground() {
  const [box, setBox] = useState(1);
  const [bits, setBits] = useState<number[]>([0, 1, 1, 0, 1, 1]);
  const s = sbox(box - 1, Uint8Array.from(bits));
  const toggle = (i: number) => setBits((b) => b.map((x, j) => (j === i ? 1 - x : x)));
  const flips = bits.map((_, i) => {
    const f = sbox(box - 1, Uint8Array.from(bits.map((x, j) => (j === i ? 1 - x : x))));
    const changed = f.output.reduce((n, x, k) => n + (x !== s.output[k] ? 1 : 0), 0);
    return { i, f, changed };
  });
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">A.4 Caixas S em detalhe: consulte você mesmo</h3>
      <p className="text-lg">
        Escolha uma caixa e alterne os 6 bits de entrada. A matriz mostra de onde vem o valor, e a tabela abaixo mostra o efeito de inverter um único bit: nas caixas S, uma pequena mudança na entrada altera, em geral, vários bits da saída (difusão e não linearidade).
      </p>
      <div>
        <label htmlFor="sbox-sel" className="mb-1 block text-base font-semibold">
          Caixa S
        </label>
        <select id="sbox-sel" value={box} onChange={(e) => setBox(Number(e.target.value))} className="min-h-11 rounded-lg border border-line bg-surface px-3 text-lg">
          {Array.from({ length: 8 }, (_, i) => (
            <option key={i} value={i + 1}>
              S{i + 1}
            </option>
          ))}
        </select>
      </div>
      <div role="group" aria-label="Seis bits de entrada" className="flex flex-wrap gap-2">
        {bits.map((b, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={b === 1}
            aria-label={`Bit ${i + 1} (${i === 0 || i === 5 ? 'linha' : 'coluna'}) vale ${b}; alternar`}
            onClick={() => toggle(i)}
            className={`min-h-11 min-w-11 rounded-lg border-2 px-3 font-mono text-xl ${i === 0 || i === 5 ? 'border-accent' : 'border-line'} ${b ? 'bg-accent/30 font-bold' : 'bg-surface'}`}
          >
            {b}
          </button>
        ))}
      </div>
      <p className="text-base text-muted">Os bits 1 e 6 (com borda de destaque) escolhem a linha; os bits 2 a 5 escolhem a coluna.</p>
      <SBoxMatrix box={box} row={s.row} col={s.col} />
      <Lookup s={s} />
      <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
        <table className="w-full text-left font-mono text-base">
          <caption className="mb-1 text-left font-sans text-base text-muted">Efeito de inverter um bit da entrada (saída atual {bin(s.output)})</caption>
          <thead className="font-sans">
            <tr>
              <th scope="col" className="pr-4">Bit invertido</th>
              <th scope="col" className="pr-4">Nova entrada</th>
              <th scope="col" className="pr-4">Linha, coluna</th>
              <th scope="col" className="pr-4">Nova saída</th>
              <th scope="col">Bits de saída que mudaram</th>
            </tr>
          </thead>
          <tbody>
            {flips.map(({ i, f, changed }) => (
              <tr key={i}>
                <th scope="row" className="pr-4 font-sans">{i + 1}</th>
                <td className="pr-4">{bin(f.input)}</td>
                <td className="pr-4">{f.row}, {f.col}</td>
                <td className="pr-4">{bin(f.output)}</td>
                <td>{changed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
