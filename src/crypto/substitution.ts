// SUBSTITUIÇÃO SIMPLES (chave = permutação das 26 letras) e a sua criptoanálise em duas etapas:
// 1) análise de frequência das letras e 2) refinamento por busca local com modelo de bigramas.
// Cifra de ensino: NÃO oferece segurança.
import { ALPHABET, normalizeText, PT_FREQUENCY, MODULUS } from './classical';
import { CryptoInputError } from './bigmath';
import { randomBigIntBelow } from './random';
import { PT_CORPUS } from './ptCorpus';

/** Chave: 26 letras distintas; a letra na posição i é a cifrada da letra i do alfabeto. */
export type SubstitutionKey = string;

export function validateSubstitutionKey(key: string): SubstitutionKey {
  const k = key.toUpperCase();
  if (!/^[A-Z]{26}$/.test(k)) throw new CryptoInputError('A chave deve ter exatamente 26 letras de A a Z.');
  if (new Set(k).size !== 26) throw new CryptoInputError('A chave não pode repetir letras: cada letra do alfabeto aparece uma única vez.');
  return k;
}

const code = (ch: string) => ch.charCodeAt(0) - 65;

export function substitutionEncrypt(key: SubstitutionKey, plaintext: string): string {
  const k = validateSubstitutionKey(key);
  return [...normalizeText(plaintext)].map((ch) => k[code(ch)]).join('');
}

/** Chave inversa: a letra na posição i é a letra clara correspondente à cifrada i. */
export function invertKey(key: SubstitutionKey): string {
  const k = validateSubstitutionKey(key);
  const out = new Array<string>(26);
  [...k].forEach((c, plain) => (out[code(c)] = ALPHABET[plain]));
  return out.join('');
}

export function substitutionDecrypt(key: SubstitutionKey, ciphertext: string): string {
  const inv = invertKey(key);
  return [...normalizeText(ciphertext)].map((ch) => inv[code(ch)]).join('');
}

/** Embaralhamento de Fisher-Yates com aleatoriedade criptograficamente segura. */
export function randomSubstitutionKey(): SubstitutionKey {
  const a = [...ALPHABET];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Number(randomBigIntBelow(BigInt(i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join('');
}

/** 26! = número de chaves possíveis. */
export const SUBSTITUTION_KEY_SPACE: bigint = Array.from({ length: 26 }, (_, i) => BigInt(i + 1)).reduce((a, b) => a * b, 1n);

/** Índice de coincidência: probabilidade de duas letras sorteadas do texto serem iguais. */
export function indexOfCoincidence(text: string): number {
  const t = normalizeText(text);
  const n = t.length;
  if (n < 2) return 0;
  const counts = new Array<number>(26).fill(0);
  for (const ch of t) counts[code(ch)]++;
  return counts.reduce((s, c) => s + c * (c - 1), 0) / (n * (n - 1));
}
/** Valores de referência: português e texto uniformemente aleatório. */
export const IC_PORTUGUESE = 0.0745;
export const IC_RANDOM = 1 / 26;

// ---------------- Modelo de bigramas do português ----------------
const corpus = normalizeText(PT_CORPUS);
export const unigram = (() => {
  const c = new Array<number>(26).fill(1);
  for (const ch of corpus) c[code(ch)]++;
  const total = c.reduce((a, b) => a + b, 0);
  return c.map((v) => v / total);
})();

/** log P(b | a), com suavização por interpolação com o modelo de uma letra. */
export const LOG_BIGRAM: number[][] = (() => {
  const cnt = Array.from({ length: 26 }, () => new Array<number>(26).fill(0));
  for (let i = 0; i + 1 < corpus.length; i++) cnt[code(corpus[i])][code(corpus[i + 1])]++;
  return cnt.map((row) => {
    const total = row.reduce((a, b) => a + b, 0);
    return row.map((v, b) => Math.log(0.7 * (total > 0 ? v / total : 0) + 0.3 * unigram[b]));
  });
})();

/** Matriz 26 x 26 de contagem dos pares de letras consecutivas do texto cifrado. */
function bigramCounts(cipher: string): number[][] {
  const m = Array.from({ length: 26 }, () => new Array<number>(26).fill(0));
  for (let i = 0; i + 1 < cipher.length; i++) m[code(cipher[i])][code(cipher[i + 1])]++;
  return m;
}

/** Pontuação de uma chave inversa (cifrada → clara): soma de log P(bigrama) do texto decifrado. */
function score(inv: number[], counts: number[][]): number {
  let s = 0;
  for (let a = 0; a < 26; a++) {
    const row = counts[a];
    const lp = LOG_BIGRAM[inv[a]];
    for (let b = 0; b < 26; b++) if (row[b] !== 0) s += row[b] * lp[inv[b]];
  }
  return s;
}

/** Palpite apenas por frequência: a letra cifrada mais comum vira a letra mais comum do português, e assim por diante. */
export function frequencyGuess(ciphertext: string): string {
  const t = normalizeText(ciphertext);
  const counts = new Array<number>(26).fill(0);
  for (const ch of t) counts[code(ch)]++;
  const cipherRank = [...Array(26).keys()].sort((a, b) => counts[b] - counts[a] || a - b);
  const plainRank = [...Array(26).keys()].sort((a, b) => PT_FREQUENCY[b] - PT_FREQUENCY[a] || a - b);
  const inv = new Array<string>(26);
  cipherRank.forEach((c, i) => (inv[c] = ALPHABET[plainRank[i]]));
  return inv.join('');
}

/** Gerador pseudoaleatório determinístico (LCG), usado apenas para reinícios reprodutíveis da busca. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hillClimb(start: number[], counts: number[][]): { inv: number[]; score: number } {
  const inv = [...start];
  let best = score(inv, counts);
  for (let guard = 0; guard < 400; guard++) {
    let bi = -1;
    let bj = -1;
    let bs = best;
    for (let i = 0; i < 25; i++) {
      for (let j = i + 1; j < 26; j++) {
        [inv[i], inv[j]] = [inv[j], inv[i]];
        const s = score(inv, counts);
        [inv[i], inv[j]] = [inv[j], inv[i]];
        if (s > bs + 1e-9) {
          bs = s;
          bi = i;
          bj = j;
        }
      }
    }
    if (bi < 0) break;
    [inv[bi], inv[bj]] = [inv[bj], inv[bi]];
    best = bs;
  }
  return { inv, score: best };
}

export interface SubstitutionCrack {
  /** Chave inversa (cifrada → clara) obtida só por frequência. */
  frequencyInverse: string;
  frequencyPlain: string;
  /** Chave inversa após o refinamento com bigramas. */
  refinedInverse: string;
  refinedPlain: string;
  /** Reinícios da busca (o primeiro parte do palpite por frequência). */
  restarts: number;
}

/**
 * Criptoanálise: parte do palpite por frequência e melhora a chave trocando pares de letras enquanto o texto
 * decifrado ficar mais parecido com português (bigramas). Reinícios determinísticos evitam máximos locais.
 */
export function crackSubstitution(ciphertext: string, restarts = 80): SubstitutionCrack {
  const ct = normalizeText(ciphertext);
  const counts = bigramCounts(ct);
  const freq = frequencyGuess(ct);
  const apply = (inv: string | number[]) => [...ct].map((ch) => (typeof inv === 'string' ? inv[code(ch)] : ALPHABET[inv[code(ch)]])).join('');
  const toNums = (inv: string) => [...inv].map(code);

  let best = hillClimb(toNums(freq), counts);
  const rnd = lcg(2026);
  for (let r = 1; r < restarts; r++) {
    // perturbação: embaralha algumas letras do melhor resultado atual
    const start = [...best.inv];
    const swaps = 3 + (r % 8);
    for (let s = 0; s < swaps; s++) {
      const i = Math.floor(rnd() * 26);
      const j = Math.floor(rnd() * 26);
      [start[i], start[j]] = [start[j], start[i]];
    }
    const cand = hillClimb(start, counts);
    if (cand.score > best.score) best = cand;
  }
  const refinedInverse = best.inv.map((v) => ALPHABET[v]).join('');
  return { frequencyInverse: freq, frequencyPlain: apply(freq), refinedInverse, refinedPlain: apply(best.inv), restarts };
}

/** Percentual de letras iguais entre dois textos de mesmo tamanho. */
export function percentCorrect(guess: string, truth: string): number {
  const n = Math.min(guess.length, truth.length);
  if (n === 0) return 0;
  let ok = 0;
  for (let i = 0; i < n; i++) if (guess[i] === truth[i]) ok++;
  return (100 * ok) / n;
}

export { MODULUS };
