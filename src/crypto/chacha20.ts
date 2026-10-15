// ChaCha20 (RFC 8439): cifra de fluxo baseada em operações ARX (soma módulo 2^32, rotação e XOR).
// Implementação didática com rastro das operações; para uso real, prefira a Web Crypto ou uma biblioteca auditada.
import { CryptoInputError } from './bigmath';

export const CHACHA_KEY_BYTES = 32;
export const CHACHA_NONCE_BYTES = 12;
export const CHACHA_BLOCK_BYTES = 64;
/** "expand 32-byte k" em ASCII, em quatro palavras little-endian. */
export const CHACHA_CONSTANTS = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574] as const;

const rotl = (v: number, n: number) => ((v << n) | (v >>> (32 - n))) >>> 0;
const add = (a: number, b: number) => (a + b) >>> 0;

/** Palavra de 32 bits em hexadecimal com 8 dígitos. */
export const hex32 = (v: number) => (v >>> 0).toString(16).padStart(8, '0');

export function validateChaChaInputs(key: Uint8Array, nonce: Uint8Array, counter: number): void {
  if (key.length !== CHACHA_KEY_BYTES) throw new CryptoInputError(`A chave do ChaCha20 deve ter ${CHACHA_KEY_BYTES} bytes (256 bits); recebida com ${key.length}.`);
  if (nonce.length !== CHACHA_NONCE_BYTES) throw new CryptoInputError(`O nonce do ChaCha20 deve ter ${CHACHA_NONCE_BYTES} bytes (96 bits); recebido com ${nonce.length}.`);
  if (!Number.isInteger(counter) || counter < 0 || counter > 0xffffffff) throw new CryptoInputError('O contador deve ser um inteiro de 0 a 4.294.967.295.');
}

const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Estado inicial de 16 palavras: constantes, chave (8), contador (1) e nonce (3). */
export function initialState(key: Uint8Array, nonce: Uint8Array, counter: number): number[] {
  validateChaChaInputs(key, nonce, counter);
  const s = [...CHACHA_CONSTANTS] as number[];
  for (let i = 0; i < 8; i++) s.push(le32(key, 4 * i));
  s.push(counter >>> 0);
  for (let i = 0; i < 3; i++) s.push(le32(nonce, 4 * i));
  return s;
}

export type ArxOp = 'add' | 'xor' | 'rotl';
export interface QuarterStep {
  op: ArxOp;
  /** Palavra que recebe o resultado e palavra usada como segundo operando (a, b, c ou d). */
  target: 'a' | 'b' | 'c' | 'd';
  source: 'a' | 'b' | 'c' | 'd';
  rotate?: number;
  /** Valores depois da operação. */
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Os doze passos do quarter round: a+=b; d^=a; d<<<=16; c+=d; b^=c; b<<<=12; a+=b; d^=a; d<<<=8; c+=d; b^=c; b<<<=7. */
export function quarterRoundTrace(a0: number, b0: number, c0: number, d0: number): QuarterStep[] {
  let [a, b, c, d] = [a0 >>> 0, b0 >>> 0, c0 >>> 0, d0 >>> 0];
  const steps: QuarterStep[] = [];
  const push = (op: ArxOp, target: QuarterStep['target'], source: QuarterStep['source'], rotate?: number) =>
    steps.push({ op, target, source, ...(rotate === undefined ? {} : { rotate }), a, b, c, d });
  a = add(a, b); push('add', 'a', 'b');
  d = (d ^ a) >>> 0; push('xor', 'd', 'a');
  d = rotl(d, 16); push('rotl', 'd', 'd', 16);
  c = add(c, d); push('add', 'c', 'd');
  b = (b ^ c) >>> 0; push('xor', 'b', 'c');
  b = rotl(b, 12); push('rotl', 'b', 'b', 12);
  a = add(a, b); push('add', 'a', 'b');
  d = (d ^ a) >>> 0; push('xor', 'd', 'a');
  d = rotl(d, 8); push('rotl', 'd', 'd', 8);
  c = add(c, d); push('add', 'c', 'd');
  b = (b ^ c) >>> 0; push('xor', 'b', 'c');
  b = rotl(b, 7); push('rotl', 'b', 'b', 7);
  return steps;
}

export function quarterRound(a: number, b: number, c: number, d: number): [number, number, number, number] {
  const last = quarterRoundTrace(a, b, c, d)[11];
  return [last.a, last.b, last.c, last.d];
}

/** Índices das quatro palavras de cada quarter round: 4 de coluna e 4 de diagonal. */
export const COLUMN_ROUNDS: number[][] = [[0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]];
export const DIAGONAL_ROUNDS: number[][] = [[0, 5, 10, 15], [1, 6, 11, 12], [2, 7, 8, 13], [3, 4, 9, 14]];

export interface RoundSnapshot {
  /** 1 a 20; ímpares são rodadas de coluna e pares, de diagonal. */
  round: number;
  kind: 'coluna' | 'diagonal';
  state: number[];
}

export interface ChaChaBlock {
  initial: number[];
  rounds: RoundSnapshot[];
  /** Estado depois das 20 rodadas, antes da soma com o estado inicial. */
  mixed: number[];
  /** Soma palavra a palavra do estado misturado com o inicial. */
  final: number[];
  /** Fluxo de chaves: as 16 palavras finais em little-endian (64 bytes). */
  keystream: Uint8Array;
}

/** Função de bloco do ChaCha20: 20 rodadas (10 pares coluna/diagonal) e soma final com o estado inicial. */
export function chachaBlock(key: Uint8Array, nonce: Uint8Array, counter: number): ChaChaBlock {
  const initial = initialState(key, nonce, counter);
  const s = [...initial];
  const rounds: RoundSnapshot[] = [];
  const qr = (idx: number[]) => {
    const [a, b, c, d] = quarterRound(s[idx[0]], s[idx[1]], s[idx[2]], s[idx[3]]);
    s[idx[0]] = a; s[idx[1]] = b; s[idx[2]] = c; s[idx[3]] = d;
  };
  for (let i = 0; i < 10; i++) {
    COLUMN_ROUNDS.forEach(qr);
    rounds.push({ round: 2 * i + 1, kind: 'coluna', state: [...s] });
    DIAGONAL_ROUNDS.forEach(qr);
    rounds.push({ round: 2 * i + 2, kind: 'diagonal', state: [...s] });
  }
  const mixed = [...s];
  const final = mixed.map((w, i) => add(w, initial[i]));
  const keystream = new Uint8Array(64);
  final.forEach((w, i) => {
    keystream[4 * i] = w & 0xff;
    keystream[4 * i + 1] = (w >>> 8) & 0xff;
    keystream[4 * i + 2] = (w >>> 16) & 0xff;
    keystream[4 * i + 3] = (w >>> 24) & 0xff;
  });
  return { initial, rounds, mixed, final, keystream };
}

/** Fluxo de chaves de `length` bytes, a partir do contador inicial (um bloco de 64 bytes por contador). */
export function chachaKeystream(key: Uint8Array, nonce: Uint8Array, counter: number, length: number): Uint8Array {
  validateChaChaInputs(key, nonce, counter);
  const blocks = Math.ceil(length / CHACHA_BLOCK_BYTES);
  if (counter + blocks - 1 > 0xffffffff) throw new CryptoInputError('O contador de 32 bits estouraria: a mensagem é longa demais para este nonce.');
  const out = new Uint8Array(blocks * CHACHA_BLOCK_BYTES);
  for (let i = 0; i < blocks; i++) out.set(chachaBlock(key, nonce, counter + i).keystream, i * CHACHA_BLOCK_BYTES);
  return out.slice(0, length);
}

export const xorBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  if (a.length !== b.length) throw new CryptoInputError('Os dois vetores devem ter o mesmo tamanho.');
  return a.map((v, i) => v ^ b[i]);
};

/** Cifra (ou decifra: a operação é a mesma) por XOR com o fluxo de chaves. */
export function chachaCrypt(key: Uint8Array, nonce: Uint8Array, counter: number, data: Uint8Array): Uint8Array {
  return xorBytes(data, chachaKeystream(key, nonce, counter, data.length));
}
