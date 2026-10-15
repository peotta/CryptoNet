import { groupsOfFive, inverseOfA, keySpaceSize, normalizeText, ALPHABET, type ClassicalCipher, type ClassicalKey, type CrackCandidate } from '../../crypto/classical';
import type { ClassicalEngine } from '../../crypto/engines';
import type { ClassicalFlowData } from './flows';

export const MAX_LETTERS = 400;

export interface ClassicalRun {
  flow: ClassicalFlowData;
  key: ClassicalKey;
  /** Texto claro e cifrado, sem espaços (para exibir letra a letra). */
  plainLetters: string;
  cipherLetters: string;
  candidates: CrackCandidate[];
}

export const keyLabel = (cipher: ClassicalCipher, key: ClassicalKey) => (cipher === 'cesar' ? `k = ${key.b}` : `a = ${key.a}, b = ${key.b}`);

export async function runClassical(
  engine: ClassicalEngine,
  input: { cipher: ClassicalCipher; key: ClassicalKey; text: string; tamper: boolean },
): Promise<ClassicalRun> {
  const { cipher, key, tamper } = input;
  const plain = normalizeText(input.text);
  if (plain.length === 0) throw new Error('Digite ao menos uma letra (A a Z).');
  if (plain.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras.`);

  const cipherLetters = await engine.encrypt(cipher, key, plain);

  // Eva altera a letra do meio da cifra, trocando-a pela seguinte do alfabeto.
  const pos = Math.floor(cipherLetters.length / 2);
  const received = tamper ? cipherLetters.slice(0, pos) + ALPHABET[(ALPHABET.indexOf(cipherLetters[pos]) + 1) % 26] + cipherLetters.slice(pos + 1) : cipherLetters;
  const recovered = await engine.decrypt(cipher, key, received);

  // Eva só conhece o texto cifrado que capturou (o original, antes de alterá-lo).
  const candidates = await engine.crack(cipher, cipherLetters);
  const best = candidates[0];
  const evaSuccess = best.key.a === key.a && best.key.b === key.b;
  const n = plain.length;

  let verdictText: string;
  if (evaSuccess) {
    verdictText = `Eva deduziu a chave (${keyLabel(cipher, best.key)}) apenas com o texto cifrado e a frequência das letras, e leu a mensagem. ${
      tamper ? 'Além disso, Bob decifrou a mensagem alterada sem perceber: a cifra não tem integridade. ' : ''
    }A cifra não oferece segurança.`;
  } else {
    verdictText =
      'Neste caso o texto é curto demais para a análise de frequência apontar a chave certa. Isso é sorte, e não segurança: Eva ainda testa todas as chaves e reconhece o português entre os candidatos.' +
      (tamper ? ' Bob decifrou a mensagem alterada sem perceber.' : '');
  }

  return {
    key,
    plainLetters: plain,
    cipherLetters,
    candidates,
    flow: {
      cipher,
      keyText: keyLabel(cipher, key),
      inverseA: inverseOfA(key.a),
      plain: groupsOfFive(plain),
      cipherText: groupsOfFive(cipherLetters),
      receivedText: groupsOfFive(received),
      recovered: groupsOfFive(recovered),
      tampered: tamper,
      tamperPosition: pos + 1,
      evaKeyText: keyLabel(cipher, best.key),
      evaPlain: groupsOfFive(best.plaintext),
      evaChi2: best.chi2,
      evaSuccess,
      keyCount: keySpaceSize(cipher),
      nLetters: n,
      verdictText,
      ok: !evaSuccess,
    },
  };
}
