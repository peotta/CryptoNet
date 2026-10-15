// CIFRAS CLÁSSICAS (César e afim) e criptoanálise (força bruta e análise de frequência).
// Alfabeto de 26 letras, sem acentos. Estas cifras NÃO oferecem segurança: existem para ensino.
import { CryptoInputError, gcd, modInverse } from './bigmath';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const MODULUS = 26;

export type ClassicalCipher = 'cesar' | 'afim';

/** Chave afim C = (a·P + b) mod 26. A cifra de César é o caso a = 1 e b = k. */
export interface ClassicalKey {
  a: number;
  b: number;
}

/** Valores de a coprimos com 26: 12 opções, portanto 12 × 26 = 312 chaves afins. */
export const VALID_A: number[] = Array.from({ length: MODULUS }, (_, a) => a).filter((a) => gcd(BigInt(a), BigInt(MODULUS)) === 1n);

/** Frequência (em %) das letras na língua portuguesa, em ordem alfabética. */
export const PT_FREQUENCY: number[] = [
  14.63, 1.04, 3.88, 4.99, 12.57, 1.02, 1.3, 1.28, 6.18, 0.4, 0.02, 2.78, 4.74, 5.05, 10.73, 2.52, 1.2, 6.53, 7.81, 4.34, 4.63, 1.67, 0.01, 0.21, 0.01, 0.47,
];

/** Maiúsculas, sem acentos e somente A-Z (espaços, números e pontuação são descartados). */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

/** Agrupa em blocos de 5 letras, como nas mensagens clássicas. */
export const groupsOfFive = (text: string): string => (text.match(/.{1,5}/g) ?? []).join(' ');

const mod = (n: number) => ((n % MODULUS) + MODULUS) % MODULUS;
const code = (ch: string) => ch.charCodeAt(0) - 65;
const letter = (n: number) => ALPHABET[mod(n)];

export function checkKey(cipher: ClassicalCipher, key: ClassicalKey): void {
  if (!Number.isInteger(key.a) || !Number.isInteger(key.b)) throw new CryptoInputError('A chave deve ser formada por inteiros.');
  if (key.b < 0 || key.b >= MODULUS) throw new CryptoInputError(`A chave b (ou k) deve estar entre 0 e ${MODULUS - 1}.`);
  if (cipher === 'cesar' && key.a !== 1) throw new CryptoInputError('Na cifra de César, a = 1.');
  if (cipher === 'afim' && !VALID_A.includes(key.a)) {
    throw new CryptoInputError(`a = ${key.a} não é válido: mdc(a, 26) deve ser 1. Valores possíveis: ${VALID_A.join(', ')}.`);
  }
}

/** Inverso multiplicativo de a módulo 26 (existe apenas se mdc(a, 26) = 1). */
export const inverseOfA = (a: number): number => Number(modInverse(BigInt(a), BigInt(MODULUS)));

/** Letra cifrada correspondente à letra P (0 a 25). */
export const mapLetter = (key: ClassicalKey, p: number): number => mod(key.a * p + key.b);

export function encrypt(cipher: ClassicalCipher, key: ClassicalKey, plaintext: string): string {
  checkKey(cipher, key);
  return [...normalizeText(plaintext)].map((ch) => letter(key.a * code(ch) + key.b)).join('');
}

export function decrypt(cipher: ClassicalCipher, key: ClassicalKey, ciphertext: string): string {
  checkKey(cipher, key);
  const inv = inverseOfA(key.a);
  return [...normalizeText(ciphertext)].map((ch) => letter(inv * (code(ch) - key.b))).join('');
}

/** Contagem de cada letra do texto (A a Z). */
export function letterCounts(text: string): number[] {
  const counts = new Array<number>(MODULUS).fill(0);
  for (const ch of normalizeText(text)) counts[code(ch)]++;
  return counts;
}

/** Percentual de cada letra do texto; vetor de zeros para texto vazio. */
export function letterPercentages(text: string): number[] {
  const counts = letterCounts(text);
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((c) => (total === 0 ? 0 : (100 * c) / total));
}

/** Estatística χ² do texto contra a frequência do português: quanto menor, mais parecido com português. */
export function chiSquared(text: string): number {
  const counts = letterCounts(text);
  const n = counts.reduce((a, b) => a + b, 0);
  if (n === 0) return Infinity;
  return counts.reduce((sum, c, i) => {
    const expected = (n * PT_FREQUENCY[i]) / 100;
    return sum + (c - expected) ** 2 / Math.max(expected, 0.05);
  }, 0);
}

export interface CrackCandidate {
  key: ClassicalKey;
  plaintext: string;
  chi2: number;
}

/** Força bruta: tenta todas as chaves (26 no César, 312 na afim) e ordena pelo χ² crescente. */
export function crack(cipher: ClassicalCipher, ciphertext: string): CrackCandidate[] {
  const keys: ClassicalKey[] =
    cipher === 'cesar' ? Array.from({ length: MODULUS }, (_, k) => ({ a: 1, b: k })) : VALID_A.flatMap((a) => Array.from({ length: MODULUS }, (_, b) => ({ a, b })));
  return keys
    .map((key) => {
      const plaintext = decrypt(cipher, key, ciphertext);
      return { key, plaintext, chi2: chiSquared(plaintext) };
    })
    .sort((x, y) => x.chi2 - y.chi2);
}

/** Tamanho do espaço de chaves de cada cifra. */
export const keySpaceSize = (cipher: ClassicalCipher): number => (cipher === 'cesar' ? MODULUS : VALID_A.length * MODULUS);

/** Ataque de texto claro conhecido: chaves afins que levam o prefixo conhecido ao prefixo cifrado. */
export function knownPlaintextAttack(cipher: ClassicalCipher, knownPlain: string, cipherPrefix: string): ClassicalKey[] {
  const p = normalizeText(knownPlain);
  const c = normalizeText(cipherPrefix).slice(0, p.length);
  if (p.length === 0 || c.length < p.length) return [];
  return crack(cipher, 'A')
    .map((x) => x.key)
    .filter((key) => encrypt(cipher, key, p) === c);
}
