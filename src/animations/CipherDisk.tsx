import { motion, useReducedMotion } from 'motion/react';
import { ALPHABET, mapLetter, type ClassicalKey } from '../crypto/classical';
import { letterColorVars } from './letterColor';
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
      {/* ponteiro de relógio: liga a letra clara (fora) à sua cifrada (dentro), na mesma cor das duas */}
      {highlight !== null && (
        <g style={letterColorVars(highlight)}>
          <line className="lc-mark" x1={at(highlight, 108).x} y1={at(highlight, 108).y} x2={at(highlight, 118).x} y2={at(highlight, 118).y} strokeWidth="4" strokeLinecap="round" />
          <circle className="lc-mark" cx={at(highlight, 98).x} cy={at(highlight, 98).y} r="11" strokeWidth="2" />
        </g>
      )}
      {/* anel externo: alfabeto claro, fixo */}
      {[...ALPHABET].map((ch, i) => {
        const { x, y, deg } = at(i, 128);
        const on = highlight === i;
        return (
          <g key={`o${ch}`} style={on ? letterColorVars(i) : undefined}>
            {on && <circle className="lc-mark" cx={x} cy={y} r="11" strokeWidth="2" />}
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
  /** Pinta a coluna em destaque com a cor da letra (a mesma do par exibido na mensagem). */
  tinted?: boolean;
}

/** Tira de alfabeto: cada letra clara e a sua cifrada, lado a lado. Serve ao César, à cifra afim e à substituição simples. */
export function AlphabetStrip({ cipherKey, table, highlight = null, tinted = false }: StripProps) {
  const tint = (i: number) => (tinted && highlight === i ? letterColorVars(i) : undefined);
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
              <td
                key={ch}
                style={tint(i)}
                className={`min-w-7 rounded border px-1 text-center ${highlight === i ? (tinted ? 'lc-fill font-bold' : 'border-k-plain bg-k-plain/25 font-bold') : 'border-line'}`}
              >
                {ch}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="pr-3 text-left font-sans text-base font-semibold text-k-cipher">
              Cifrado
            </th>
            {[...ALPHABET].map((ch, i) => (
              <td
                key={ch}
                style={tint(i)}
                className={`min-w-7 rounded border px-1 text-center ${highlight === i ? (tinted ? 'lc-fill font-bold' : 'border-k-cipher bg-k-cipher/25 font-bold') : 'border-line'}`}
              >
                {table ? table[i] : ALPHABET[mapLetter(cipherKey ?? { a: 1, b: 0 }, i)]}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
