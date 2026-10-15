// ONE-TIME PAD (Vernam, 1917; sigilo perfeito demonstrado por Shannon, 1949), com letras e soma módulo 26.
// O sigilo perfeito só vale se a chave for (1) verdadeiramente aleatória, (2) tão longa quanto a mensagem,
// (3) usada uma única vez e (4) mantida em segredo. Reutilizar a chave a destrói (two-time pad).
import { CryptoInputError } from './bigmath';
import { ALPHABET, normalizeText } from './classical';
import { LOG_BIGRAM } from './substitution';
import { randomBigIntBelow } from './random';

const code = (ch: string) => ch.charCodeAt(0) - 65;
const mod26 = (n: number) => ((n % 26) + 26) % 26;

/** Chave sorteada com aleatoriedade criptograficamente segura, uniforme sobre as 26 letras. */
export function randomPad(length: number): string {
  if (!Number.isInteger(length) || length < 1) throw new CryptoInputError('O tamanho da chave deve ser um inteiro positivo.');
  return Array.from({ length }, () => ALPHABET[Number(randomBigIntBelow(26n))]).join('');
}

/** Valida a chave: somente letras A a Z e, no mínimo, `minLength` letras. */
export function validatePad(key: string, minLength: number): string {
  const k = key.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z]+$/.test(k)) throw new CryptoInputError('A chave deve conter somente letras de A a Z.');
  if (k.length < minLength) {
    throw new CryptoInputError(
      `A chave tem ${k.length} ${k.length === 1 ? 'letra' : 'letras'}, mas a mensagem tem ${minLength}. No one-time pad a chave deve ser tão longa quanto a mensagem; repeti-la a transformaria em Vigenère.`,
    );
  }
  return k;
}

/** C_i = (P_i + K_i) mod 26 */
export function otpEncrypt(key: string, plaintext: string): string {
  const p = normalizeText(plaintext);
  const k = validatePad(key, p.length);
  return [...p].map((ch, i) => ALPHABET[mod26(code(ch) + code(k[i]))]).join('');
}

/** P_i = (C_i - K_i) mod 26 */
export function otpDecrypt(key: string, ciphertext: string): string {
  const c = normalizeText(ciphertext);
  const k = validatePad(key, c.length);
  return [...c].map((ch, i) => ALPHABET[mod26(code(ch) - code(k[i]))]).join('');
}

/**
 * Sigilo perfeito: para QUALQUER texto de mesmo tamanho existe uma chave que leva a cifra a ele (K' = C - T).
 * Sem conhecer a chave, Eva não tem como preferir um texto a outro.
 */
export function keyForTarget(ciphertext: string, target: string): string {
  const c = normalizeText(ciphertext);
  const t = normalizeText(target);
  if (c.length !== t.length) throw new CryptoInputError(`O texto candidato deve ter exatamente ${c.length} letras (o mesmo tamanho da cifra), mas tem ${t.length}.`);
  return [...c].map((ch, i) => ALPHABET[mod26(code(ch) - code(t[i]))]).join('');
}

/** Quantidade de textos possíveis de n letras: 26^n. */
export const possibleTexts = (n: number): bigint => 26n ** BigInt(n);
/** Bits de incerteza sobre a mensagem: n · log2(26). */
export const entropyBits = (n: number): number => n * Math.log2(26);

// ---------------- Reutilização da chave (two-time pad) ----------------
/** D_i = (C2_i - C1_i) mod 26. Como a mesma chave soma em ambos, D = P2 - P1: a chave desaparece. */
export function letterDifference(c1: string, c2: string): string {
  const a = normalizeText(c1);
  const b = normalizeText(c2);
  const n = Math.min(a.length, b.length);
  return Array.from({ length: n }, (_, i) => ALPHABET[mod26(code(b[i]) - code(a[i]))]).join('');
}

export interface DragResult {
  /** Posição inicial (a partir de 0) do texto provável. */
  offset: number;
  /** Fragmento da OUTRA mensagem que resulta nessa posição (legível se o alinhamento estiver certo). */
  fragment: string;
  /** Fragmento da chave que resulta nessa posição. */
  keyFragment: string;
  /** Média do log de probabilidade dos pares de letras do fragmento (maior = mais parecido com português). */
  score: number;
}

/**
 * Arrasto de texto provável (crib dragging): Eva supõe que `crib` aparece em uma das mensagens e o desliza ao
 * longo da posição. Em cada posição, calcula o fragmento correspondente da outra mensagem e a chave. Se o
 * alinhamento estiver certo, o fragmento é texto legível.
 */
export function cribDrag(c1: string, c2: string, crib: string, inFirst: boolean): DragResult[] {
  const a = normalizeText(c1);
  const b = normalizeText(c2);
  const p = normalizeText(crib);
  const n = Math.min(a.length, b.length);
  if (p.length < 2 || p.length > n) return [];
  const known = inFirst ? a : b;
  const other = inFirst ? b : a;
  const out: DragResult[] = [];
  for (let o = 0; o + p.length <= n; o++) {
    const keyFragment = [...p].map((ch, j) => ALPHABET[mod26(code(known[o + j]) - code(ch))]).join('');
    const fragment = [...p].map((_, j) => ALPHABET[mod26(code(other[o + j]) - code(keyFragment[j]))]).join('');
    let s = 0;
    for (let j = 1; j < fragment.length; j++) s += LOG_BIGRAM[code(fragment[j - 1])][code(fragment[j])];
    out.push({ offset: o, fragment, keyFragment, score: s / (fragment.length - 1) });
  }
  return out.sort((x, y) => y.score - x.score || x.offset - y.offset);
}
