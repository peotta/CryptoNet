import type { ReactNode } from 'react';
import { bitsToBin, bitsToHex, type Bits } from '../../crypto/des';
import { buttonClass } from '../../components/ui';

export const fromHexInput = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));

export function Stepper({ step, total, labelStart, labelNext, onStep }: { step: number; total: number; labelStart: string; labelNext: string; onStep: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" className={buttonClass} disabled={step === 0} onClick={() => onStep(step - 1)}>
        ← Voltar
      </button>
      <button type="button" className={buttonClass} disabled={step >= total} onClick={() => onStep(step + 1)}>
        {step === 0 ? labelStart : labelNext}
      </button>
      <button type="button" className={buttonClass} disabled={step === 0} onClick={() => onStep(0)}>
        Reiniciar
      </button>
    </div>
  );
}

export interface BitRow {
  label: string;
  bits: Bits;
  /** Tamanho dos grupos em binário (4, 6, 7 ou 8). */
  group?: number;
  hex?: boolean;
  active?: boolean;
  note?: ReactNode;
}

/** Quadro com vetores de bits (um por linha), em binário agrupado e, se pedido, em hexadecimal. */
export function BitTable({ caption, rows }: { caption: string; rows: BitRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-3">
      <table className="w-full text-left font-mono text-base">
        <caption className="mb-1 text-left font-sans text-base text-muted">{caption}</caption>
        <thead>
          <tr className="font-sans">
            <th scope="col" className="pr-4">Valor</th>
            <th scope="col" className="pr-4">Binário</th>
            <th scope="col">Hexadecimal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.active ? 'bg-accent/15 font-bold' : ''}>
              <th scope="row" className="pr-4 align-top font-sans">
                {r.label}
                {r.active && <span className="sr-only"> (em destaque)</span>}
                {r.note && <span className="block text-sm font-normal text-muted">{r.note}</span>}
              </th>
              <td className="whitespace-nowrap pr-4">{bitsToBin(r.bits, r.group ?? 4)}</td>
              <td>{r.hex !== false && r.bits.length % 8 === 0 ? bitsToHex(r.bits) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
