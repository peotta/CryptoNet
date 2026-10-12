// AES (FIPS 197) DIDÁTICO: núcleo do cifrador de bloco, com rastro das rodadas, e os modos ECB, CBC e CTR
// sem preenchimento. Existe para visualização e para experimentos de adulteração (a Web Crypto não
// oferece ECB nem permite decifrar sem validar o preenchimento). NÃO use em produção: não é
// resistente a ataques de canal lateral. Os resultados são conferidos nos testes contra a
// Web Crypto e o node:crypto. O AES-GCM usa diretamente a Web Crypto (operação real).
import { randomBytes } from './random';

export const BLOCK = 16;
export type AesMode = 'ECB' | 'CBC' | 'CTR' | 'GCM';

// ---------- Aritmética em GF(2^8), polinômio x^8 + x^4 + x^3 + x + 1 ----------
const xtime = (a: number) => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff;

function gmul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    a = xtime(a);
    b >>= 1;
  }
  return p;
}

const gfInverse = (x: number): number => {
  if (x === 0) return 0;
  let r = 1;
  let b = x;
  for (let e = 254; e > 0; e >>= 1) {
    if (e & 1) r = gmul(r, b);
    b = gmul(b, b);
  }
  return r;
};

const rotl8 = (x: number, n: number) => ((x << n) | (x >> (8 - n))) & 0xff;

/** S-box gerada a partir da definição: inverso multiplicativo seguido da transformação afim. */
export const SBOX: Uint8Array = Uint8Array.from({ length: 256 }, (_, x) => {
  const i = gfInverse(x);
  return i ^ rotl8(i, 1) ^ rotl8(i, 2) ^ rotl8(i, 3) ^ rotl8(i, 4) ^ 0x63;
});
export const INV_SBOX: Uint8Array = (() => {
  const inv = new Uint8Array(256);
  SBOX.forEach((v, i) => (inv[v] = i));
  return inv;
})();

// ---------- Transformações do estado (vetor de 16 bytes, ordem por colunas: índice = linha + 4*coluna) ----------
export const subBytes = (s: Uint8Array) => s.map((b) => SBOX[b]);
export const invSubBytes = (s: Uint8Array) => s.map((b) => INV_SBOX[b]);

export function shiftRows(s: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[r + 4 * c] = s[r + 4 * ((c + r) % 4)];
  return out;
}
export function invShiftRows(s: Uint8Array): Uint8Array {
  const out = new Uint8Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[r + 4 * ((c + r) % 4)] = s[r + 4 * c];
  return out;
}

function mixWith(s: Uint8Array, m: number[][]): Uint8Array {
  const out = new Uint8Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v ^= gmul(m[r][k], s[k + 4 * c]);
      out[r + 4 * c] = v;
    }
  }
  return out;
}
const MIX = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]];
const INV_MIX = [[14, 11, 13, 9], [9, 14, 11, 13], [13, 9, 14, 11], [11, 13, 9, 14]];
export const mixColumns = (s: Uint8Array) => mixWith(s, MIX);
export const invMixColumns = (s: Uint8Array) => mixWith(s, INV_MIX);

export const xorBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => a.map((v, i) => v ^ b[i]);
export const addRoundKey = xorBytes;

// ---------- Expansão de chave ----------
export const KEY_SIZES = [16, 24, 32] as const;

export function expandKey(key: Uint8Array): Uint8Array[] {
  if (!KEY_SIZES.includes(key.length as 16 | 24 | 32)) throw new Error('A chave AES deve ter 16, 24 ou 32 bytes.');
  const nk = key.length / 4;
  const nr = nk + 6;
  const w: Uint8Array[] = [];
  for (let i = 0; i < nk; i++) w.push(key.slice(4 * i, 4 * i + 4));
  let rcon = 1;
  for (let i = nk; i < 4 * (nr + 1); i++) {
    let t = Uint8Array.from(w[i - 1]);
    if (i % nk === 0) {
      t = Uint8Array.from([t[1], t[2], t[3], t[0]]).map((b) => SBOX[b]);
      t[0] ^= rcon;
      rcon = xtime(rcon);
    } else if (nk > 6 && i % nk === 4) {
      t = t.map((b) => SBOX[b]);
    }
    w.push(xorBytes(w[i - nk], t));
  }
  return Array.from({ length: nr + 1 }, (_, r) => Uint8Array.from([...w[4 * r], ...w[4 * r + 1], ...w[4 * r + 2], ...w[4 * r + 3]]));
}

// ---------- Cifrador de bloco ----------
function checkBlock(b: Uint8Array) {
  if (b.length !== BLOCK) throw new Error('O bloco AES deve ter 16 bytes.');
}

export function encryptBlock(roundKeys: Uint8Array[], block: Uint8Array): Uint8Array {
  checkBlock(block);
  const nr = roundKeys.length - 1;
  let s = addRoundKey(block, roundKeys[0]);
  for (let r = 1; r < nr; r++) s = addRoundKey(mixColumns(shiftRows(subBytes(s))), roundKeys[r]);
  return addRoundKey(shiftRows(subBytes(s)), roundKeys[nr]);
}

export function decryptBlock(roundKeys: Uint8Array[], block: Uint8Array): Uint8Array {
  checkBlock(block);
  const nr = roundKeys.length - 1;
  let s = addRoundKey(block, roundKeys[nr]);
  for (let r = nr - 1; r >= 1; r--) s = invMixColumns(addRoundKey(invSubBytes(invShiftRows(s)), roundKeys[r]));
  return addRoundKey(invSubBytes(invShiftRows(s)), roundKeys[0]);
}

export type RoundOp = 'Entrada' | 'AddRoundKey' | 'SubBytes' | 'ShiftRows' | 'MixColumns';

export interface RoundStep {
  /** 0 = rodada inicial; 1..Nr = rodadas. */
  round: number;
  op: RoundOp;
  /** Estado depois da operação. */
  state: Uint8Array;
  /** Chave de rodada usada (apenas em AddRoundKey). */
  roundKey?: Uint8Array;
}

/** Rastro completo da cifragem de um bloco: o estado depois de cada operação de cada rodada. */
export function traceEncrypt(roundKeys: Uint8Array[], block: Uint8Array): RoundStep[] {
  checkBlock(block);
  const nr = roundKeys.length - 1;
  const steps: RoundStep[] = [{ round: 0, op: 'Entrada', state: Uint8Array.from(block) }];
  let s = addRoundKey(block, roundKeys[0]);
  steps.push({ round: 0, op: 'AddRoundKey', state: s, roundKey: roundKeys[0] });
  for (let r = 1; r <= nr; r++) {
    s = subBytes(s);
    steps.push({ round: r, op: 'SubBytes', state: s });
    s = shiftRows(s);
    steps.push({ round: r, op: 'ShiftRows', state: s });
    if (r < nr) {
      s = mixColumns(s);
      steps.push({ round: r, op: 'MixColumns', state: s });
    }
    s = addRoundKey(s, roundKeys[r]);
    steps.push({ round: r, op: 'AddRoundKey', state: s, roundKey: roundKeys[r] });
  }
  return steps;
}

// ---------- Modos de operação, sem preenchimento (comprimento múltiplo de 16) ----------
function checkMultiple(data: Uint8Array) {
  if (data.length === 0 || data.length % BLOCK !== 0) throw new Error('O comprimento deve ser um múltiplo de 16 bytes.');
}

export const splitBlocks = (data: Uint8Array): Uint8Array[] => Array.from({ length: Math.ceil(data.length / BLOCK) }, (_, i) => data.slice(i * BLOCK, (i + 1) * BLOCK));
const join = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

export function ecbEncrypt(key: Uint8Array, pt: Uint8Array): Uint8Array {
  checkMultiple(pt);
  const rk = expandKey(key);
  return join(splitBlocks(pt).map((b) => encryptBlock(rk, b)));
}
export function ecbDecrypt(key: Uint8Array, ct: Uint8Array): Uint8Array {
  checkMultiple(ct);
  const rk = expandKey(key);
  return join(splitBlocks(ct).map((b) => decryptBlock(rk, b)));
}

export function cbcEncrypt(key: Uint8Array, iv: Uint8Array, pt: Uint8Array): Uint8Array {
  checkMultiple(pt);
  const rk = expandKey(key);
  let prev = iv;
  return join(
    splitBlocks(pt).map((b) => {
      prev = encryptBlock(rk, xorBytes(b, prev));
      return prev;
    }),
  );
}
export function cbcDecrypt(key: Uint8Array, iv: Uint8Array, ct: Uint8Array): Uint8Array {
  checkMultiple(ct);
  const rk = expandKey(key);
  let prev = iv;
  return join(
    splitBlocks(ct).map((b) => {
      const p = xorBytes(decryptBlock(rk, b), prev);
      prev = b;
      return p;
    }),
  );
}

/** CTR com bloco de contador = nonce (12 bytes) || contador de 32 bits big-endian iniciado em 0. */
export function ctrXor(key: Uint8Array, nonce: Uint8Array, data: Uint8Array): Uint8Array {
  if (nonce.length !== 12) throw new Error('O nonce do CTR deve ter 12 bytes.');
  const rk = expandKey(key);
  const out = new Uint8Array(data.length);
  for (let i = 0; i * BLOCK < data.length; i++) {
    const counter = new Uint8Array(16);
    counter.set(nonce);
    new DataView(counter.buffer).setUint32(12, i);
    const ks = encryptBlock(rk, counter);
    for (let j = 0; j < BLOCK && i * BLOCK + j < data.length; j++) out[i * BLOCK + j] = data[i * BLOCK + j] ^ ks[j];
  }
  return out;
}

// ---------- AES-GCM e conferência (Web Crypto: operações reais) ----------
function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto indisponível: use HTTPS ou localhost em um navegador atual.');
  return s;
}

/** Retorna texto cifrado com a etiqueta de 16 bytes ao final. */
export async function gcmEncrypt(key: Uint8Array, iv: Uint8Array, pt: Uint8Array): Promise<Uint8Array> {
  const k = await subtle().importKey('raw', key as BufferSource, 'AES-GCM', false, ['encrypt']);
  return new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k, pt as BufferSource));
}
/** Lança erro se a etiqueta de autenticação não conferir. */
export async function gcmDecrypt(key: Uint8Array, iv: Uint8Array, ctAndTag: Uint8Array): Promise<Uint8Array> {
  const k = await subtle().importKey('raw', key as BufferSource, 'AES-GCM', false, ['decrypt']);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k, ctAndTag as BufferSource));
}

/** AES de um único bloco pela Web Crypto (AES-CBC com IV zero; o primeiro bloco de saída é E_K(P)). */
export async function aesBlockWebCrypto(key: Uint8Array, block: Uint8Array): Promise<Uint8Array> {
  const k = await subtle().importKey('raw', key as BufferSource, 'AES-CBC', false, ['encrypt']);
  const out = new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, k, block as BufferSource));
  return out.slice(0, BLOCK);
}

/** Texto em UTF-8 completado com espaços até um múltiplo de 16 bytes (preenchimento didático). */
export function padWithSpaces(bytes: Uint8Array): Uint8Array {
  const n = Math.max(1, Math.ceil(bytes.length / BLOCK)) * BLOCK;
  const out = new Uint8Array(n).fill(0x20);
  out.set(bytes);
  return out;
}

export const randomIv = (length = 16) => randomBytes(length);
