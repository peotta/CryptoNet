// DES (FIPS 46-3, retirada em 2005) e Triple DES (TDEA, SP 800-67 Rev. 2, retirada em 2024).
// Implementação didática sobre vetores de bits, com rastro de cada etapa. Os bits são numerados de 1 a 64
// da esquerda para a direita, como nas tabelas da norma. Não use para proteger dados reais.
import { CryptoInputError } from './bigmath';

export type Bits = Uint8Array;

export const DES_KEY_BYTES = 8;
export const DES_BLOCK_BYTES = 8;
export const DES_ROUNDS = 16;

// Tabelas da FIPS 46-3 (posições de 1 a n, contadas da esquerda).
export const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37,
  29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
];
export const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10,
  50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
];
export const E_TABLE = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
];
export const P_TABLE = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
export const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5,
  28, 20, 12, 4,
];
export const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
];
export const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
export const SBOXES: number[][] = [
  [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
];

// ---------------------------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------------------------
export function bytesToBits(b: Uint8Array): Bits {
  const out = new Uint8Array(b.length * 8);
  for (let i = 0; i < b.length; i++) for (let j = 0; j < 8; j++) out[8 * i + j] = (b[i] >> (7 - j)) & 1;
  return out;
}

export function bitsToBytes(bits: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(bits.length >> 3);
  for (let i = 0; i < bits.length; i++) out[i >> 3] |= bits[i] << (7 - (i & 7));
  return out;
}

export const bitsToHex = (bits: ArrayLike<number>): string => [...bitsToBytes(bits)].map((x) => x.toString(16).padStart(2, '0')).join('');
/** Bits em texto, em grupos de `group` (6 para as caixas S, 4 para as saídas, 8 para os bytes). */
export const bitsToBin = (bits: ArrayLike<number>, group = 4): string => {
  const s = Array.from(bits, (b) => String(b)).join('');
  return s.replace(new RegExp(`(.{${group}})(?=.)`, 'g'), '$1 ');
};

const permute = (bits: ArrayLike<number>, table: number[]): Bits => {
  const out = new Uint8Array(table.length);
  for (let i = 0; i < table.length; i++) out[i] = bits[table[i] - 1];
  return out;
};
const xor = (a: ArrayLike<number>, b: ArrayLike<number>): Bits => {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
};
const rotateLeft = (bits: Bits, n: number): Bits => {
  const out = new Uint8Array(bits.length);
  for (let i = 0; i < bits.length; i++) out[i] = bits[(i + n) % bits.length];
  return out;
};
const concat = (a: Bits, b: Bits): Bits => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

/** Número de bits diferentes entre dois vetores de bits do mesmo tamanho. */
export const hammingBits = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  let n = 0;
  for (let i = 0; i < a.length; i++) n += a[i] ^ b[i];
  return n;
};

// ---------------------------------------------------------------------------------------------
// Chave
// ---------------------------------------------------------------------------------------------
export function validateDesKey(key: Uint8Array): void {
  if (key.length !== DES_KEY_BYTES) throw new CryptoInputError(`A chave do DES deve ter ${DES_KEY_BYTES} bytes (64 bits, dos quais 56 são úteis); recebida com ${key.length}.`);
}
export function validateDesBlock(block: Uint8Array): void {
  if (block.length !== DES_BLOCK_BYTES) throw new CryptoInputError(`O bloco do DES deve ter ${DES_BLOCK_BYTES} bytes (64 bits); recebido com ${block.length}.`);
}

/** Ajusta o último bit de cada byte para que o byte tenha número ímpar de bits 1 (bits de paridade da chave). */
export function setOddParity(key: Uint8Array): Uint8Array {
  return key.map((b) => {
    let ones = 0;
    for (let i = 1; i < 8; i++) ones += (b >> i) & 1;
    return (b & 0xfe) | (ones % 2 === 0 ? 1 : 0);
  });
}
export const hasOddParity = (key: Uint8Array): boolean => key.every((b) => [...Array(8).keys()].reduce((n, i) => n + ((b >> i) & 1), 0) % 2 === 1);

export interface KeyRound {
  round: number;
  shift: number;
  c: Bits;
  d: Bits;
  /** Subchave de 48 bits. */
  key: Bits;
}
export interface KeySchedule {
  key: Bits;
  /** Chave de 56 bits depois da PC-1. */
  pc1: Bits;
  c0: Bits;
  d0: Bits;
  rounds: KeyRound[];
}

export function keySchedule(key: Uint8Array): KeySchedule {
  validateDesKey(key);
  const kb = bytesToBits(key);
  const pc1 = permute(kb, PC1);
  const c0 = pc1.slice(0, 28);
  const d0 = pc1.slice(28);
  let c: Bits = c0;
  let d: Bits = d0;
  const rounds: KeyRound[] = [];
  for (let i = 0; i < DES_ROUNDS; i++) {
    c = rotateLeft(c, SHIFTS[i]);
    d = rotateLeft(d, SHIFTS[i]);
    rounds.push({ round: i + 1, shift: SHIFTS[i], c, d, key: permute(concat(c, d), PC2) });
  }
  return { key: kb, pc1, c0, d0, rounds };
}

// ---------------------------------------------------------------------------------------------
// Bloco
// ---------------------------------------------------------------------------------------------
export interface SBoxStep {
  box: number;
  /** Seis bits de entrada. */
  input: Bits;
  /** Linha (bits 1 e 6), coluna (bits 2 a 5) e valor na caixa. */
  row: number;
  col: number;
  value: number;
  /** Quatro bits de saída. */
  output: Bits;
}
export interface RoundDetail {
  round: number;
  /** L e R no início da rodada (L(i-1) e R(i-1)). */
  l: Bits;
  r: Bits;
  expanded: Bits;
  subkey: Bits;
  /** E(R) ⊕ K. */
  mixed: Bits;
  sboxes: SBoxStep[];
  /** Concatenação das oito saídas das caixas S (32 bits). */
  sOut: Bits;
  /** f(R, K) = P(saída das caixas S). */
  f: Bits;
  /** L(i) = R(i-1) e R(i) = L(i-1) ⊕ f. */
  newL: Bits;
  newR: Bits;
}
export interface DesTrace {
  decrypt: boolean;
  input: Bits;
  afterIp: Bits;
  rounds: RoundDetail[];
  /** Depois da rodada 16 e da troca das metades: R16 ‖ L16. */
  preOutput: Bits;
  output: Bits;
  schedule: KeySchedule;
}

function sbox(box: number, six: Bits): SBoxStep {
  const row = (six[0] << 1) | six[5];
  const col = (six[1] << 3) | (six[2] << 2) | (six[3] << 1) | six[4];
  const value = SBOXES[box][16 * row + col];
  return { box: box + 1, input: six, row, col, value, output: Uint8Array.of((value >> 3) & 1, (value >> 2) & 1, (value >> 1) & 1, value & 1) };
}

export function desTrace(key: Uint8Array, block: Uint8Array, decrypt = false): DesTrace {
  validateDesBlock(block);
  const schedule = keySchedule(key);
  const input = bytesToBits(block);
  const afterIp = permute(input, IP);
  let l: Bits = afterIp.slice(0, 32);
  let r: Bits = afterIp.slice(32);
  const rounds: RoundDetail[] = [];
  for (let i = 0; i < DES_ROUNDS; i++) {
    const subkey = schedule.rounds[decrypt ? DES_ROUNDS - 1 - i : i].key;
    const expanded = permute(r, E_TABLE);
    const mixed = xor(expanded, subkey);
    const sboxes: SBoxStep[] = [];
    for (let b = 0; b < 8; b++) sboxes.push(sbox(b, mixed.slice(6 * b, 6 * b + 6)));
    const sOut = new Uint8Array(32);
    sboxes.forEach((s, b) => sOut.set(s.output, 4 * b));
    const f = permute(sOut, P_TABLE);
    const newR = xor(l, f);
    rounds.push({ round: i + 1, l, r, expanded, subkey, mixed, sboxes, sOut, f, newL: r, newR });
    l = r;
    r = newR;
  }
  const preOutput = concat(r, l);
  return { decrypt, input, afterIp, rounds, preOutput, output: permute(preOutput, FP), schedule };
}

// Caminho rápido (sem rastro), usado na busca exaustiva e nos modos de operação. Trabalha com palavras de 32 bits:
// as oito caixas S já trazem a permutação P embutida (tabelas SP), e as subchaves são oito grupos de 6 bits.
const SP: Uint32Array[] = SBOXES.map((box, b) => {
  const t = new Uint32Array(64);
  for (let six = 0; six < 64; six++) {
    const v = box[16 * (((six >> 5) << 1) | (six & 1)) + ((six >> 1) & 0xf)];
    let word = 0;
    for (let i = 0; i < 4; i++) word |= ((v >> (3 - i)) & 1) << (31 - (4 * b + i)); // bit 4b+i+1 da saída das caixas S
    let out = 0;
    for (let i = 0; i < 32; i++) out |= ((word >>> (31 - (P_TABLE[i] - 1))) & 1) << (31 - i); // aplica a permutação P
    t[six] = out >>> 0;
  }
  return t;
});
const PC2_FROM_CD = PC2.map((p) => p - 1);

function fastRoundKeys(key: Uint8Array, out: Uint8Array): void {
  const kb = bytesToBits(key);
  const cd = new Uint8Array(56);
  for (let i = 0; i < 56; i++) cd[i] = kb[PC1[i] - 1];
  for (let r = 0; r < DES_ROUNDS; r++) {
    const n = SHIFTS[r];
    for (const half of [0, 28]) {
      const t0 = cd[half];
      const t1 = cd[half + 1];
      for (let i = 0; i < 28 - n; i++) cd[half + i] = cd[half + i + n];
      if (n === 1) cd[half + 27] = t0;
      else {
        cd[half + 26] = t0;
        cd[half + 27] = t1;
      }
    }
    for (let g = 0; g < 8; g++) {
      let v = 0;
      for (let j = 0; j < 6; j++) v = (v << 1) | cd[PC2_FROM_CD[6 * g + j]];
      out[8 * r + g] = v;
    }
  }
}
const word = (bits: Bits, o: number): number => {
  let v = 0;
  for (let i = 0; i < 32; i++) v = (v << 1) | bits[o + i];
  return v >>> 0;
};
/** Rodadas da rede de Feistel sobre (L0, R0); devolve R16 e L16 (a entrada da permutação final). */
function feistel(l: number, r: number, rk: Uint8Array, decrypt: boolean, out: Uint32Array): void {
  for (let i = 0; i < DES_ROUNDS; i++) {
    const o = 8 * (decrypt ? DES_ROUNDS - 1 - i : i);
    const f =
      SP[0][(((r & 1) << 5) | (r >>> 27)) ^ rk[o]] |
      SP[1][((r >>> 23) & 0x3f) ^ rk[o + 1]] |
      SP[2][((r >>> 19) & 0x3f) ^ rk[o + 2]] |
      SP[3][((r >>> 15) & 0x3f) ^ rk[o + 3]] |
      SP[4][((r >>> 11) & 0x3f) ^ rk[o + 4]] |
      SP[5][((r >>> 7) & 0x3f) ^ rk[o + 5]] |
      SP[6][((r >>> 3) & 0x3f) ^ rk[o + 6]] |
      SP[7][(((r & 0x1f) << 1) | (r >>> 31)) ^ rk[o + 7]];
    const nr = (l ^ f) >>> 0;
    l = r;
    r = nr;
  }
  out[0] = r;
  out[1] = l;
}
const scratch = new Uint32Array(2);
const rkScratch = new Uint8Array(128);

function cryptBits(key: Uint8Array, block: Uint8Array, decrypt: boolean): Uint8Array {
  const ip = permute(bytesToBits(block), IP);
  fastRoundKeys(key, rkScratch);
  feistel(word(ip, 0), word(ip, 32), rkScratch, decrypt, scratch);
  const pre = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    pre[i] = (scratch[0] >>> (31 - i)) & 1;
    pre[32 + i] = (scratch[1] >>> (31 - i)) & 1;
  }
  return bitsToBytes(permute(pre, FP));
}

/** Cifra ou decifra um bloco de 8 bytes com o DES. */
export function desBlock(key: Uint8Array, block: Uint8Array, decrypt = false): Uint8Array {
  validateDesKey(key);
  validateDesBlock(block);
  return cryptBits(key, block, decrypt);
}

/** Triple DES no modo EDE: C = E(K3, D(K2, E(K1, P))). Com K1 = K2 = K3 equivale ao DES simples. */
export function tdesBlock(k1: Uint8Array, k2: Uint8Array, k3: Uint8Array, block: Uint8Array, decrypt = false): Uint8Array {
  validateDesBlock(block);
  if (!decrypt) return desBlock(k3, desBlock(k2, desBlock(k1, block, false), true), false);
  return desBlock(k1, desBlock(k2, desBlock(k3, block, true), false), true);
}

export interface TdesStages {
  /** E(K1, P), D(K2, ·) e E(K3, ·), na ordem de cifragem. */
  afterE1: Uint8Array;
  afterD2: Uint8Array;
  afterE3: Uint8Array;
}
export function tdesStages(k1: Uint8Array, k2: Uint8Array, k3: Uint8Array, block: Uint8Array): TdesStages {
  const afterE1 = desBlock(k1, block, false);
  const afterD2 = desBlock(k2, afterE1, true);
  return { afterE1, afterD2, afterE3: desBlock(k3, afterD2, false) };
}

// ---------------------------------------------------------------------------------------------
// Modo CBC com preenchimento PKCS#7 (1 chave: DES; 3 chaves: Triple DES EDE)
// ---------------------------------------------------------------------------------------------
export function validateCipherKeys(keys: Uint8Array[]): void {
  if (keys.length !== 1 && keys.length !== 3) throw new CryptoInputError('Informe 1 chave (DES) ou 3 chaves (Triple DES).');
  keys.forEach(validateDesKey);
}
const blockFn = (keys: Uint8Array[], block: Uint8Array, decrypt: boolean) => (keys.length === 1 ? desBlock(keys[0], block, decrypt) : tdesBlock(keys[0], keys[1], keys[2], block, decrypt));

export function pkcs7Pad(data: Uint8Array): Uint8Array {
  const n = DES_BLOCK_BYTES - (data.length % DES_BLOCK_BYTES);
  const out = new Uint8Array(data.length + n);
  out.set(data);
  out.fill(n, data.length);
  return out;
}
/** Remove o preenchimento; devolve null se ele for inválido. */
export function pkcs7Unpad(data: Uint8Array): Uint8Array | null {
  if (data.length === 0 || data.length % DES_BLOCK_BYTES !== 0) return null;
  const n = data[data.length - 1];
  if (n < 1 || n > DES_BLOCK_BYTES) return null;
  for (let i = data.length - n; i < data.length; i++) if (data[i] !== n) return null;
  return data.slice(0, data.length - n);
}

export interface CbcBlock {
  index: number;
  /** Bloco do texto claro, antes do XOR com o vetor anterior. */
  plain: Uint8Array;
  /** Bloco depois do XOR com o IV ou com o bloco cifrado anterior. */
  mixed: Uint8Array;
  cipher: Uint8Array;
}

export function cbcEncryptBlocks(keys: Uint8Array[], iv: Uint8Array, data: Uint8Array): CbcBlock[] {
  validateCipherKeys(keys);
  validateDesBlock(iv);
  const padded = pkcs7Pad(data);
  const out: CbcBlock[] = [];
  let prev = iv;
  for (let i = 0; i < padded.length; i += DES_BLOCK_BYTES) {
    const plain = padded.slice(i, i + DES_BLOCK_BYTES);
    const mixed = plain.map((b, j) => b ^ prev[j]);
    const cipher = blockFn(keys, mixed, false);
    out.push({ index: i / DES_BLOCK_BYTES + 1, plain, mixed, cipher });
    prev = cipher;
  }
  return out;
}
export const cbcEncrypt = (keys: Uint8Array[], iv: Uint8Array, data: Uint8Array): Uint8Array => {
  const blocks = cbcEncryptBlocks(keys, iv, data);
  const out = new Uint8Array(blocks.length * DES_BLOCK_BYTES);
  blocks.forEach((b, i) => out.set(b.cipher, i * DES_BLOCK_BYTES));
  return out;
};

/** Decifra sem tirar o preenchimento (raw) e informa o texto sem ele (null se inválido). */
export function cbcDecrypt(keys: Uint8Array[], iv: Uint8Array, data: Uint8Array): { raw: Uint8Array; plain: Uint8Array | null } {
  validateCipherKeys(keys);
  validateDesBlock(iv);
  if (data.length === 0 || data.length % DES_BLOCK_BYTES !== 0) throw new CryptoInputError('O texto cifrado deve ter um número inteiro de blocos de 8 bytes.');
  const raw = new Uint8Array(data.length);
  let prev = iv;
  for (let i = 0; i < data.length; i += DES_BLOCK_BYTES) {
    const c = data.slice(i, i + DES_BLOCK_BYTES);
    raw.set(blockFn(keys, c, true).map((b, j) => b ^ prev[j]), i);
    prev = c;
  }
  return { raw, plain: pkcs7Unpad(raw) };
}

// ---------------------------------------------------------------------------------------------
// Busca exaustiva em escala didática
// ---------------------------------------------------------------------------------------------
/** Os 56 bits úteis da chave (sem os bits de paridade). */
export function effectiveBits(key: Uint8Array): Bits {
  const out = new Uint8Array(56);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) out[7 * i + j] = (key[i] >> (7 - j)) & 1;
  return out;
}
/** Monta a chave de 64 bits (com paridade ímpar) a partir dos 56 bits úteis. */
export function keyFromEffective(bits: Bits): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) out[i] |= bits[7 * i + j] << (7 - j);
  return setOddParity(out);
}
/** Chave candidata: os (56 - n) primeiros bits úteis de `base` e, nos n últimos, o contador. */
export function candidateKey(base: Bits, unknownBits: number, counter: number): Uint8Array {
  const bits = base.slice();
  for (let i = 0; i < unknownBits; i++) bits[55 - i] = (counter >>> i) & 1;
  return keyFromEffective(bits);
}

export const MAX_SEARCH_BITS = 20;

export interface DesSearch {
  /** Chave encontrada (null se nenhuma candidata cifra o bloco conhecido para a cifra observada). */
  key: Uint8Array | null;
  tries: number;
  space: number;
  ms: number;
  /** Chaves testadas por segundo, medidas nesta execução. */
  rate: number;
}

/**
 * Ataque de texto claro conhecido: Eva conhece os primeiros (56 - n) bits úteis da chave e testa os 2^n valores dos demais.
 * `plainBlock` é a entrada da cifra (no CBC, o texto claro já combinado com o IV).
 */
export async function searchKey(plainBlock: Uint8Array, cipherBlock: Uint8Array, base: Bits, unknownBits: number, now: () => number = () => performance.now()): Promise<DesSearch> {
  if (!Number.isInteger(unknownBits) || unknownBits < 1 || unknownBits > MAX_SEARCH_BITS) throw new CryptoInputError(`Use de 1 a ${MAX_SEARCH_BITS} bits desconhecidos.`);
  validateDesBlock(plainBlock);
  validateDesBlock(cipherBlock);
  const space = 2 ** unknownBits;
  const t0 = now();
  let found: Uint8Array | null = null;
  let tries = 0;
  const chunk = 4096;
  // Compara direto a saída das rodadas com IP(cifra): evita a permutação final em cada candidata.
  const ipIn = permute(bytesToBits(plainBlock), IP);
  const ipC = permute(bytesToBits(cipherBlock), IP);
  const l0 = word(ipIn, 0);
  const r0 = word(ipIn, 32);
  const t0w = word(ipC, 0);
  const t1w = word(ipC, 32);
  for (let start = 0; start < space && !found; start += chunk) {
    const end = Math.min(space, start + chunk);
    for (let c = start; c < end; c++) {
      tries++;
      const k = candidateKey(base, unknownBits, c);
      fastRoundKeys(k, rkScratch);
      feistel(l0, r0, rkScratch, false, scratch);
      if (scratch[0] === t0w && scratch[1] === t1w) {
        found = k;
        break;
      }
    }
    if (!found && end < space) await new Promise((r) => setTimeout(r, 0)); // devolve o controle à interface
  }
  const ms = Math.max(now() - t0, 0.001);
  return { key: found, tries, space, ms, rate: (tries / ms) * 1000 };
}

// ---------------------------------------------------------------------------------------------
// Chaves fracas e semifracas
// ---------------------------------------------------------------------------------------------
const h = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (x) => parseInt(x, 16));
export const WEAK_KEYS: { name: string; key: Uint8Array }[] = ['0101010101010101', 'fefefefefefefefe', 'e0e0e0e0f1f1f1f1', '1f1f1f1f0e0e0e0e'].map((s) => ({ name: s, key: h(s) }));
export const SEMI_WEAK_PAIRS: [Uint8Array, Uint8Array][] = [
  ['011f011f010e010e', '1f011f010e010e01'],
  ['01e001e001f101f1', 'e001e001f101f101'],
  ['01fe01fe01fe01fe', 'fe01fe01fe01fe01'],
  ['1fe01fe00ef10ef1', 'e01fe01ff10ef10e'],
  ['1ffe1ffe0efe0efe', 'fe1ffe1ffe0efe0e'],
  ['e0fee0fef1fef1fe', 'fee0fee0fef1fef1'],
].map(([a, b]) => [h(a), h(b)]);

/** Propriedade do complemento: E(~K, ~P) = ~E(K, P). */
export const complementBytes = (b: Uint8Array): Uint8Array => b.map((x) => x ^ 0xff);
