import { motion, useReducedMotion } from 'motion/react';
import { ALPHABET, mapLetter, type ClassicalKey } from '../crypto/classical';
import { motionDuration } from './motion';

const STEP = 360 / 26;

interface DiskProps {
  /** Chave do César (deslocamento k): o anel interno gira k posições. */
  shift: number;
  /** Letra do texto claro (0 a 25) em destaque. */
  highlight?: number | null;
  speed?: number;
}

/**
 * Disco de cifra do César: o anel externo (fixo) é o alfabeto claro e o anel interno gira k posições.
 * Cada letra clara fica alinhada com a sua cifrada. A tira de alfabeto abaixo traz a mesma informação em texto.
 */
export function CipherDisk({ shift, highlight = null, speed = 1 }: DiskProps) {
  const reduced = useReducedMotion() ?? false;
  const at = (i: number, r: number) => {
    const a = ((i * STEP - 90) * Math.PI) / 180;
    return { x: 150 + r * Math.cos(a), y: 150 + r * Math.sin(a), deg: i * STEP };
  };
  return (
    <svg
      viewBox="0 0 300 300"
      role="img"
      aria-label={`Disco de cifra com deslocamento ${shift}: a letra A do texto claro corresponde a ${ALPHABET[shift % 26]} no texto cifrado.`}
      className="mx-auto h-auto w-full max-w-[22rem]"
    >
      <circle cx="150" cy="150" r="142" fill="none" stroke="var(--line)" strokeWidth="2" />
      <circle cx="150" cy="150" r="113" fill="none" stroke="var(--line)" strokeWidth="2" />
      <circle cx="150" cy="150" r="82" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="2" />
      {/* anel externo: alfabeto claro, fixo */}
      {[...ALPHABET].map((ch, i) => {
        const { x, y, deg } = at(i, 128);
        const on = highlight === i;
        return (
          <g key={`o${ch}`}>
            {on && <circle cx={x} cy={y} r="11" fill="var(--k-plain)" opacity="0.25" stroke="var(--k-plain)" strokeWidth="2" />}
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" transform={`rotate(${deg} ${x} ${y})`} fontSize="14" fontWeight={on ? 800 : 600} fill="var(--text)" fontFamily="var(--font-mono)">
              {ch}
            </text>
          </g>
        );
      })}
      {/* anel interno: alfabeto cifrado, gira k posições */}
      <motion.g
        initial={false}
        animate={{ rotate: -shift * STEP }}
        transition={{ duration: motionDuration(0.9, speed, reduced), ease: 'easeInOut' }}
        style={{ transformOrigin: '150px 150px', transformBox: 'view-box' }}
      >
        {[...ALPHABET].map((ch, i) => {
          const { x, y, deg } = at(i, 98);
          return (
            <text key={`i${ch}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" transform={`rotate(${deg} ${x} ${y})`} fontSize="14" fontWeight="600" fill="var(--k-cipher)" fontFamily="var(--font-mono)">
              {ch}
            </text>
          );
        })}
      </motion.g>
      <text x="150" y="144" textAnchor="middle" fontSize="13" fill="var(--muted)">
        k = {shift}
      </text>
      <text x="150" y="162" textAnchor="middle" fontSize="12" fill="var(--muted)">
        fora: claro
      </text>
      <text x="150" y="178" textAnchor="middle" fontSize="12" fill="var(--muted)">
        dentro: cifrado
      </text>
    </svg>
  );
}

interface StripProps {
  /** Chave do César ou afim. Ignorada se `table` for informada. */
  cipherKey?: ClassicalKey;
  /** Tabela de substituição: a letra na posição i é a cifrada da letra i (26 letras). */
  table?: string;
  highlight?: number | null;
}

/** Tira de alfabeto: cada letra clara e a sua cifrada, lado a lado. Serve ao César, à cifra afim e à substituição simples. */
export function AlphabetStrip({ cipherKey, table, highlight = null }: StripProps) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 font-mono text-base">
        <caption className="sr-only">Correspondência entre as letras do texto claro e do texto cifrado</caption>
        <tbody>
          <tr>
            <th scope="row" className="pr-3 text-left font-sans text-base font-semibold text-k-plain">
              Claro
            </th>
            {[...ALPHABET].map((ch, i) => (
              <td key={ch} className={`min-w-7 rounded border px-1 text-center ${highlight === i ? 'border-k-plain bg-k-plain/25 font-bold' : 'border-line'}`}>
                {ch}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="pr-3 text-left font-sans text-base font-semibold text-k-cipher">
              Cifrado
            </th>
            {[...ALPHABET].map((ch, i) => (
              <td key={ch} className={`min-w-7 rounded border px-1 text-center ${highlight === i ? 'border-k-cipher bg-k-cipher/25 font-bold' : 'border-line'}`}>
                {table ? table[i] : ALPHABET[mapLetter(cipherKey ?? { a: 1, b: 0 }, i)]}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
