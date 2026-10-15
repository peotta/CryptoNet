// CIFRA DE VIGENÈRE (polialfabética) e criptoanálise: teste de Kasiski, índice de coincidência por tamanho
// de chave e análise de frequência por coluna. Cifra de ensino: NÃO oferece segurança.
import { CryptoInputError } from './bigmath';
import { ALPHABET, chiSquared, normalizeText } from './classical';
import { IC_PORTUGUESE, IC_RANDOM, indexOfCoincidence } from './substitution';

export const MAX_KEY_LENGTH = 20;
const code = (ch: string) => ch.charCodeAt(0) - 65;
const mod26 = (n: number) => ((n % 26) + 26) % 26;

/** Chave da Vigenère: palavra de 1 a 20 letras (A a Z), sem acentos. */
export function validateVigenereKey(key: string): string {
  const k = normalizeText(key);
  if (k.length === 0) throw new CryptoInputError('A chave deve ter ao menos uma letra (A a Z).');
  if (k.length > MAX_KEY_LENGTH) throw new CryptoInputError(`A chave deve ter no máximo ${MAX_KEY_LENGTH} letras.`);
  return k;
}

/** C_i = (P_i + K_(i mod m)) mod 26 */
export function vigenereEncrypt(key: string, plaintext: string): string {
  const k = validateVigenereKey(key);
  return [...normalizeText(plaintext)].map((ch, i) => ALPHABET[mod26(code(ch) + code(k[i % k.length]))]).join('');
}

/** P_i = (C_i - K_(i mod m)) mod 26 */
export function vigenereDecrypt(key: string, ciphertext: string): string {
  const k = validateVigenereKey(key);
  return [...normalizeText(ciphertext)].map((ch, i) => ALPHABET[mod26(code(ch) - code(k[i % k.length]))]).join('');
}

/** Separa o texto em m colunas: a coluna j reúne as letras nas posições j, j + m, j + 2m, ... */
export function columns(text: string, m: number): string[] {
  const cols = Array.from({ length: m }, () => '');
  [...text].forEach((ch, i) => (cols[i % m] += ch));
  return cols;
}

// ---------------- Teste de Kasiski ----------------
export interface Repetition {
  sequence: string;
  /** Posições (a partir de 1) das ocorrências. */
  positions: number[];
  /** Distâncias entre ocorrências consecutivas. */
  distances: number[];
}

export interface KasiskiResult {
  repetitions: Repetition[];
  /** Para cada fator de 2 a MAX_KEY_LENGTH, quantas distâncias ele divide. */
  factorCounts: number[];
  /** Fatores ordenados do mais para o menos frequente (empates: menor primeiro). */
  rankedFactors: number[];
}

/** Procura sequências repetidas de pelo menos `minLength` letras: se a distância entre elas é múltiplo do tamanho da chave, a repetição vem do mesmo trecho de texto claro. */
export function kasiski(ciphertext: string, minLength = 3): KasiskiResult {
  const t = normalizeText(ciphertext);
  const seen = new Map<string, number[]>();
  for (let i = 0; i + minLength <= t.length; i++) {
    const s = t.slice(i, i + minLength);
    seen.set(s, [...(seen.get(s) ?? []), i + 1]);
  }
  const repetitions: Repetition[] = [...seen.entries()]
    .filter(([, pos]) => pos.length > 1)
    .map(([sequence, positions]) => ({ sequence, positions, distances: positions.slice(1).map((p, i) => p - positions[i]) }))
    .sort((a, b) => b.positions.length - a.positions.length || a.positions[0] - b.positions[0]);
  const distances = repetitions.flatMap((r) => r.distances);
  const factorCounts = Array.from({ length: MAX_KEY_LENGTH - 1 }, (_, i) => distances.filter((d) => d % (i + 2) === 0).length);
  const rankedFactors = factorCounts
    .map((c, i) => ({ f: i + 2, c }))
    .sort((a, b) => b.c - a.c || a.f - b.f)
    .map((x) => x.f);
  return { repetitions, factorCounts, rankedFactors };
}

// ---------------- Índice de coincidência por tamanho de chave ----------------
/** IC médio das colunas para cada tamanho de chave m = 1 .. maxLength (índice 0 corresponde a m = 1). */
export function icByKeyLength(ciphertext: string, maxLength = MAX_KEY_LENGTH): number[] {
  const t = normalizeText(ciphertext);
  return Array.from({ length: maxLength }, (_, i) => {
    const cols = columns(t, i + 1).filter((c) => c.length > 1);
    return cols.length === 0 ? 0 : cols.reduce((s, c) => s + indexOfCoincidence(c), 0) / cols.length;
  });
}

/** Estimativa de Friedman do tamanho da chave a partir do IC do texto inteiro. */
export function friedmanEstimate(ciphertext: string): number {
  const n = normalizeText(ciphertext).length;
  const ic = indexOfCoincidence(ciphertext);
  const denom = (n - 1) * ic - IC_RANDOM * n + IC_PORTUGUESE;
  return denom <= 0 ? Infinity : ((IC_PORTUGUESE - IC_RANDOM) * n) / denom;
}

/**
 * Escolhe o tamanho de chave: o menor m cujo IC médio fica próximo do máximo e é compatível com português.
 * (Múltiplos do tamanho verdadeiro também têm IC alto; o menor deles é o tamanho da chave.)
 */
export function chooseKeyLength(ics: number[]): number {
  const max = Math.max(...ics);
  const threshold = Math.max(0.9 * max, 0.06);
  const idx = ics.findIndex((v) => v >= threshold);
  return (idx < 0 ? ics.indexOf(max) : idx) + 1;
}

// ---------------- Chave por análise de frequência de cada coluna ----------------
export interface ColumnResult {
  /** Letra da chave deduzida para a coluna. */
  letter: string;
  chi2: number;
  length: number;
}

/** Cada coluna foi cifrada por César com uma única letra da chave: o deslocamento de menor χ² é a letra da chave. */
export function recoverKey(ciphertext: string, m: number): ColumnResult[] {
  return columns(normalizeText(ciphertext), m).map((col) => {
    let best = { shift: 0, chi2: Infinity };
    for (let s = 0; s < 26; s++) {
      const plain = [...col].map((ch) => ALPHABET[mod26(code(ch) - s)]).join('');
      const c = chiSquared(plain);
      if (c < best.chi2) best = { shift: s, chi2: c };
    }
    return { letter: ALPHABET[best.shift], chi2: best.chi2, length: col.length };
  });
}

export interface VigenereCrack {
  kasiski: KasiskiResult;
  ics: number[];
  friedman: number;
  keyLength: number;
  columns: ColumnResult[];
  key: string;
  plaintext: string;
}

/** Criptoanálise completa: tamanho da chave (IC médio, conferido com Kasiski), chave (frequência por coluna) e texto claro. */
export function crackVigenere(ciphertext: string): VigenereCrack {
  const ct = normalizeText(ciphertext);
  const ics = icByKeyLength(ct, Math.min(MAX_KEY_LENGTH, Math.max(1, Math.floor(ct.length / 4))));
  const keyLength = chooseKeyLength(ics);
  const cols = recoverKey(ct, keyLength);
  const key = cols.map((c) => c.letter).join('');
  return { kasiski: kasiski(ct), ics, friedman: friedmanEstimate(ct), keyLength, columns: cols, key, plaintext: vigenereDecrypt(key, ct) };
}

/** O tamanho verdadeiro de uma chave é o seu período mínimo (ex.: "ABAB" tem período 2). */
export function minimalPeriod(key: string): number {
  const k = normalizeText(key);
  for (let p = 1; p <= k.length; p++) {
    if (k.length % p === 0 && k === k.slice(0, p).repeat(k.length / p)) return p;
  }
  return k.length;
}
