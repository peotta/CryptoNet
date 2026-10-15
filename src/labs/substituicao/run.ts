import { ALPHABET, groupsOfFive, normalizeText } from '../../crypto/classical';
import type { ClassicalEngine } from '../../crypto/engines';
import { indexOfCoincidence, invertKey, percentCorrect, validateSubstitutionKey } from '../../crypto/substitution';
import type { SubstitutionFlowData } from './flows';

export const MAX_LETTERS = 1500;

export interface SubstitutionRun {
  flow: SubstitutionFlowData;
  key: string;
  plainLetters: string;
  cipherLetters: string;
  /** Resultados completos da criptoanálise de Eva. */
  freqInverse: string;
  refinedInverse: string;
  freqPlain: string;
  refinedPlain: string;
}

export async function runSubstitution(engine: ClassicalEngine, input: { key: string; text: string; tamper: boolean }): Promise<SubstitutionRun> {
  const key = validateSubstitutionKey(input.key);
  const plain = normalizeText(input.text);
  if (plain.length === 0) throw new Error('Digite ao menos uma letra (A a Z).');
  if (plain.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras.`);

  const cipherLetters = await engine.encryptSubstitution(key, plain);
  const pos = Math.floor(cipherLetters.length / 2);
  const received = input.tamper ? cipherLetters.slice(0, pos) + ALPHABET[(ALPHABET.indexOf(cipherLetters[pos]) + 1) % 26] + cipherLetters.slice(pos + 1) : cipherLetters;
  const recovered = await engine.decryptSubstitution(key, received);

  // Eva só conhece a cifra que capturou (a original, antes de alterá-la).
  const crack = await engine.crackSubstitution(cipherLetters);
  const freqPct = percentCorrect(crack.frequencyPlain, plain);
  const finalPct = percentCorrect(crack.refinedPlain, plain);
  const level = finalPct >= 90 ? 'total' : finalPct >= 60 ? 'parcial' : 'falha';
  const n = plain.length;
  const pctText = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

  let verdictText: string;
  if (level === 'total') {
    verdictText = `Eva recuperou ${pctText(finalPct)} das letras sem conhecer a chave, apesar das 26! ≈ 4,0 × 10²⁶ chaves possíveis. A frequência isolada acertou só ${pctText(freqPct)}; o refinamento com bigramas fez o resto.`;
  } else if (level === 'parcial') {
    verdictText = `Eva recuperou ${pctText(finalPct)} das letras (frequência isolada: ${pctText(freqPct)}). O texto ainda é legível para quem conhece o idioma, e com mais texto cifrado ela chegaria quase a 100%.`;
  } else {
    verdictText = `Com apenas ${n} letras, Eva recuperou só ${pctText(finalPct)}: há pouco texto para as estatísticas. Isso é limitação dela nesta mensagem, e não segurança da cifra: bastam algumas centenas de letras.`;
  }
  if (input.tamper) verdictText += ' Além disso, Bob decifrou a mensagem alterada sem perceber: não há verificação de integridade.';

  return {
    key,
    plainLetters: plain,
    cipherLetters,
    freqInverse: crack.frequencyInverse,
    refinedInverse: crack.refinedInverse,
    freqPlain: crack.frequencyPlain,
    refinedPlain: crack.refinedPlain,
    flow: {
      keyText: key,
      plain: groupsOfFive(plain),
      cipherText: groupsOfFive(cipherLetters),
      receivedText: groupsOfFive(received),
      recovered: groupsOfFive(recovered),
      tampered: input.tamper,
      tamperPosition: pos + 1,
      nLetters: n,
      ic: indexOfCoincidence(cipherLetters),
      freqPlain: groupsOfFive(crack.frequencyPlain),
      freqPct,
      finalPlain: groupsOfFive(crack.refinedPlain),
      finalPct,
      evaKey: invertKey(crack.refinedInverse),
      level,
      verdictText,
      ok: level === 'falha',
    },
  };
}
