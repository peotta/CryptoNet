import { ALPHABET, groupsOfFive, normalizeText } from '../../crypto/classical';
import type { ClassicalEngine } from '../../crypto/engines';
import { indexOfCoincidence, percentCorrect } from '../../crypto/substitution';
import { MAX_KEY_LENGTH, minimalPeriod, validateVigenereKey, type VigenereCrack } from '../../crypto/vigenere';
import type { VigenereFlowData } from './flows';

export const MAX_LETTERS = 1500;

export interface VigenereRun {
  flow: VigenereFlowData;
  key: string;
  plainLetters: string;
  cipherLetters: string;
  crack: VigenereCrack;
}

const pctText = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

export async function runVigenere(engine: ClassicalEngine, input: { key: string; text: string; tamper: boolean }): Promise<VigenereRun> {
  const key = validateVigenereKey(input.key);
  const plain = normalizeText(input.text);
  if (plain.length === 0) throw new Error('Digite ao menos uma letra (A a Z).');
  if (plain.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras.`);

  const cipherLetters = await engine.encryptVigenere(key, plain);
  const pos = Math.floor(cipherLetters.length / 2);
  const received = input.tamper ? cipherLetters.slice(0, pos) + ALPHABET[(ALPHABET.indexOf(cipherLetters[pos]) + 1) % 26] + cipherLetters.slice(pos + 1) : cipherLetters;
  const recovered = await engine.decryptVigenere(key, received);

  // Eva só conhece a cifra que capturou (a original, antes de alterá-la).
  const crack = await engine.crackVigenere(cipherLetters);
  const finalPct = percentCorrect(crack.plaintext, plain);
  const level = finalPct >= 95 ? 'total' : finalPct >= 60 ? 'parcial' : 'falha';
  const period = minimalPeriod(key);
  const n = plain.length;

  let verdictText: string;
  if (level === 'total') {
    verdictText = `Eva descobriu o tamanho da chave (m = ${crack.keyLength}) e a própria chave (${crack.key}) e leu ${pctText(finalPct)} da mensagem, sem conhecê-la. A Vigenère esconde a frequência das letras, mas não a periodicidade da chave.`;
    if (crack.keyLength !== key.length) verdictText += ` (Sua chave ${key} se repete a cada ${period} ${period === 1 ? 'letra' : 'letras'}, e é equivalente a ${crack.key}.)`;
  } else if (level === 'parcial') {
    verdictText = `Eva acertou ${pctText(finalPct)} das letras: descobriu parte da chave. Com mais texto cifrado ela chegaria à chave completa.`;
  } else {
    verdictText = `Com ${n} letras e uma chave de ${key.length}, restam poucas letras por coluna (cerca de ${Math.round(n / key.length)}) para a análise de frequência: Eva errou a chave (${crack.key}) e recuperou só ${pctText(finalPct)}. Isso é limitação dela nesta mensagem, e não segurança: com mais texto a cifra cai.`;
  }
  if (input.tamper) verdictText += ' Além disso, Bob decifrou a mensagem alterada sem perceber: não há verificação de integridade.';

  const top = crack.kasiski.rankedFactors.slice(0, 3);
  return {
    key,
    plainLetters: plain,
    cipherLetters,
    crack,
    flow: {
      key,
      plain: groupsOfFive(plain),
      cipherText: groupsOfFive(cipherLetters),
      receivedText: groupsOfFive(received),
      recovered: groupsOfFive(recovered),
      tampered: input.tamper,
      tamperPosition: pos + 1,
      nLetters: n,
      icPlain: indexOfCoincidence(plain),
      icCipher: indexOfCoincidence(cipherLetters),
      evaLength: crack.keyLength,
      evaKey: crack.key,
      evaPlain: groupsOfFive(crack.plaintext),
      kasiskiTop: top.length ? top : [0],
      icAtLength: crack.ics[crack.keyLength - 1] ?? 0,
      finalPct,
      level,
      verdictText,
      ok: level === 'falha',
    },
  };
}

export { MAX_KEY_LENGTH };
