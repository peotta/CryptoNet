// CIFRA DE HILL (1929): multiplicação de blocos de n letras por uma matriz n x n módulo 26. Cifra de ensino:
// NÃO oferece segurança, pois é linear e cai diante de um ataque de texto claro conhecido.
import { CryptoInputError, gcd, modInverse } from './bigmath';
import { ALPHABET, normalizeText } from './classical';

export type Matrix = number[][];
export const HILL_SIZES = [2, 3] as const;
export const FILLER = 'X';
/** Quantos blocos iniciais conhecidos o ataque examina ao procurar blocos independentes. */
export const MAX_ATTACK_BLOCKS = 10;

const mod26 = (n: number) => ((n % 26) + 26) % 26;
const code = (ch: string) => ch.charCodeAt(0) - 65;

export function determinant(m: Matrix): number {
  if (m.length === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  const [a, b, c] = m[0];
  return a * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - b * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + c * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

/** Matriz dos cofatores transposta (adjunta). */
function adjugate(m: Matrix): Matrix {
  if (m.length === 2) return [[m[1][1], -m[0][1]], [-m[1][0], m[0][0]]];
  const minor = (r: number, c: number) => {
    const rows = [0, 1, 2].filter((i) => i !== r);
    const cols = [0, 1, 2].filter((j) => j !== c);
    return m[rows[0]][cols[0]] * m[rows[1]][cols[1]] - m[rows[0]][cols[1]] * m[rows[1]][cols[0]];
  };
  // adj[i][j] = cofator(j, i)
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => ((i + j) % 2 === 0 ? 1 : -1) * minor(j, i)));
}

export function isInvertibleMod26(m: Matrix): boolean {
  return gcd(BigInt(mod26(determinant(m))), 26n) === 1n;
}

/** Inversa módulo 26: det^-1 · adjunta. Lança erro se mdc(det, 26) != 1. */
export function inverseMod26(m: Matrix): Matrix {
  const det = mod26(determinant(m));
  if (gcd(BigInt(det), 26n) !== 1n) {
    throw new CryptoInputError(`A matriz não é inversível módulo 26: det = ${det} e mdc(${det}, 26) = ${gcd(BigInt(det), 26n)}. O determinante precisa ser coprimo com 26.`);
  }
  const inv = Number(modInverse(BigInt(det), 26n));
  return adjugate(m).map((row) => row.map((v) => mod26(inv * v)));
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  return a.map((row) => b[0].map((_, j) => mod26(row.reduce((s, v, k) => s + v * b[k][j], 0))));
}

export function validateKey(m: Matrix): Matrix {
  const n = m.length;
  if (!HILL_SIZES.includes(n as 2 | 3) || m.some((r) => r.length !== n)) throw new CryptoInputError('A chave do Hill é uma matriz 2 × 2 ou 3 × 3.');
  if (m.some((r) => r.some((v) => !Number.isInteger(v) || v < 0 || v > 25))) throw new CryptoInputError('Cada elemento da matriz deve ser um inteiro entre 0 e 25.');
  inverseMod26(m); // valida a inversibilidade
  return m;
}

/** Letras do texto, completadas com X até um múltiplo de n. */
export function hillPrepare(text: string, n: number): string {
  const t = normalizeText(text);
  return t + FILLER.repeat((n - (t.length % n)) % n);
}

const blocks = (s: string, n: number) => Array.from({ length: s.length / n }, (_, i) => [...s.slice(i * n, i * n + n)].map(code));

export interface HillBlock {
  plain: number[];
  cipher: number[];
}

/** Cifra bloco a bloco: c = K · p (mod 26), com p e c como vetores coluna. */
export function hillEncryptBlocks(key: Matrix, text: string): HillBlock[] {
  const k = validateKey(key);
  const n = k.length;
  return blocks(hillPrepare(text, n), n).map((p) => ({ plain: p, cipher: k.map((row) => mod26(row.reduce((s, v, i) => s + v * p[i], 0))) }));
}

export const hillEncrypt = (key: Matrix, text: string): string => hillEncryptBlocks(key, text).map((b) => b.cipher.map((v) => ALPHABET[v]).join('')).join('');

export function hillDecrypt(key: Matrix, ciphertext: string): string {
  const k = validateKey(key);
  const n = k.length;
  const c = normalizeText(ciphertext);
  if (c.length % n !== 0) throw new CryptoInputError(`O comprimento da cifra deve ser múltiplo de ${n}.`);
  const inv = inverseMod26(k);
  return blocks(c, n)
    .map((v) => inv.map((row) => ALPHABET[mod26(row.reduce((s, x, i) => s + x * v[i], 0))]).join(''))
    .join('');
}

export interface HillAttack {
  key: Matrix;
  /** Índices (a partir de 1) dos blocos usados para montar o sistema. */
  usedBlocks: number[];
  /** Quantos blocos conhecidos a chave encontrada reproduz (todos, se a chave é correta). */
  consistentBlocks: number;
  totalBlocks: number;
}

function combinations(total: number, k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === k) return void out.push([...cur]);
    for (let i = start; i < total; i++) rec(i + 1, [...cur, i]);
  };
  rec(0, []);
  return out;
}

/**
 * Ataque de texto claro conhecido: com n blocos independentes de texto claro P e cifra C, vale C = K · P e,
 * portanto, K = C · P^-1 (mod 26). Procura n blocos cuja matriz P seja inversível módulo 26.
 */
export function knownPlaintextAttack(n: number, knownPlain: string, cipherPrefix: string): HillAttack | null {
  const p = normalizeText(knownPlain);
  const c = normalizeText(cipherPrefix);
  const usable = Math.floor(Math.min(p.length, c.length) / n);
  if (usable < n) return null;
  const pb = blocks(p.slice(0, usable * n), n);
  const cb = blocks(c.slice(0, usable * n), n);
  // matriz cujas colunas são os blocos escolhidos
  const cols = (set: number[][], idx: number[]): Matrix => Array.from({ length: n }, (_, r) => idx.map((i) => set[i][r]));
  for (const idx of combinations(Math.min(usable, MAX_ATTACK_BLOCKS), n)) {
    const P = cols(pb, idx);
    if (!isInvertibleMod26(P)) continue;
    const K = multiply(cols(cb, idx), inverseMod26(P));
    const consistent = pb.filter((blk, i) => K.every((row, r) => mod26(row.reduce((s, v, j) => s + v * blk[j], 0)) === cb[i][r])).length;
    return { key: K, usedBlocks: idx.map((i) => i + 1), consistentBlocks: consistent, totalBlocks: usable };
  }
  return null;
}

/** Chave como palavra (linhas em sequência), como em "GYBNQKURP". */
export const keyFromWord = (word: string): Matrix => {
  const w = normalizeText(word);
  const n = Math.round(Math.sqrt(w.length));
  if (n * n !== w.length || !HILL_SIZES.includes(n as 2 | 3)) throw new CryptoInputError('A palavra deve ter 4 letras (2 × 2) ou 9 letras (3 × 3).');
  return Array.from({ length: n }, (_, r) => [...w.slice(r * n, r * n + n)].map(code));
};
