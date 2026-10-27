import { ALPHABET, groupsOfFive } from '../crypto/classical';
import { letterColorVars } from './letterColor';

interface PairsProps {
  /** Texto claro e cifrado, sem espaços e com o mesmo comprimento. */
  plain: string;
  cipher: string;
  /** Posição da letra atual; `null` antes de começar. */
  index: number | null;
}

/** Cartão da letra atual: a letra clara e a cifrada lado a lado, na cor do par. */
export function LetterCard({ plain, cipher, index }: PairsProps) {
  if (index === null) return null;
  return (
    <div className="flex items-center gap-3 font-mono text-3xl font-bold" style={letterColorVars(ALPHABET.indexOf(plain[index]))}>
      <span className="lc-fill flex h-12 w-12 items-center justify-center rounded-lg border-2">{plain[index]}</span>
      <span aria-hidden="true">→</span>
      <span className="lc-fill flex h-12 w-12 items-center justify-center rounded-lg border-2">{cipher[index]}</span>
    </div>
  );
}

/** Mensagem de Alice (linha de cima) e saída (linha de baixo) em grupos de cinco; só as letras já processadas têm cor. */
export function LetterHistory({ plain, cipher, index }: PairsProps) {
  return (
    <>
      <p className="text-base text-muted">Linha de cima: mensagem de Alice. Linha de baixo: saída. Cada letra mantém a cor do par.</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-base" role="group" aria-label="Mensagem de Alice e saída, em grupos de cinco letras">
        {groupsOfFive(plain)
          .split(' ')
          .map((group, g) => (
            <div key={g} className="flex flex-col">
              {[0, 1].map((row) => (
                <div key={row} className="flex">
                  {[...group].map((ch, k) => {
                    const j = g * 5 + k;
                    const done = index !== null && j <= index;
                    return (
                      <span
                        key={k}
                        style={done ? letterColorVars(ALPHABET.indexOf(plain[j])) : undefined}
                        className={`w-5 rounded border border-transparent text-center ${done ? 'lc-text font-bold' : 'text-muted/60'} ${j === index ? 'lc-fill' : ''}`}
                      >
                        {row === 0 ? ch : done ? cipher[j] : '·'}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
      </div>
    </>
  );
}
