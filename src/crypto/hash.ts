// OPERAÇÕES REAIS via Web Crypto: SHA-1/2 (FIPS 180-4). O HMAC (RFC 2104, FIPS 198-1) é
// reconstruído passo a passo sobre a função hash para fins didáticos e conferido contra
// a implementação nativa do navegador (crypto.subtle).
import { randomBytes } from './random';

export type HashAlgo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export interface HashInfo {
  label: string;
  /** Tamanho da saída em bits. */
  bits: number;
  /** Tamanho do bloco interno em bytes (B no RFC 2104). */
  block: number;
  legacy: boolean;
}

export const HASH_INFO: Record<HashAlgo, HashInfo> = {
  'SHA-256': { label: 'SHA-256', bits: 256, block: 64, legacy: false },
  'SHA-384': { label: 'SHA-384', bits: 384, block: 128, legacy: false },
  'SHA-512': { label: 'SHA-512', bits: 512, block: 128, legacy: false },
  'SHA-1': { label: 'SHA-1 (legado)', bits: 160, block: 64, legacy: true },
};
export const HASH_ALGOS = Object.keys(HASH_INFO) as HashAlgo[];

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto indisponível: use HTTPS ou localhost em um navegador atual.');
  return s;
}

export async function digest(algo: HashAlgo, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest(algo, data as BufferSource));
}

const POPCOUNT = Array.from({ length: 256 }, (_, i) => i.toString(2).replace(/0/g, '').length);

export interface BitDifference {
  differing: number;
  total: number;
  /** Para cada bit (do mais significativo do primeiro byte ao menos significativo do último), se difere. */
  mask: boolean[];
}

export function bitDifference(a: Uint8Array, b: Uint8Array): BitDifference {
  const n = Math.max(a.length, b.length);
  const mask: boolean[] = [];
  let differing = 0;
  for (let i = 0; i < n; i++) {
    const x = (a[i] ?? 0) ^ (b[i] ?? 0);
    differing += POPCOUNT[x];
    for (let bit = 7; bit >= 0; bit--) mask.push(((x >> bit) & 1) === 1);
  }
  return { differing, total: n * 8, mask };
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

export interface HmacTrace {
  algo: HashAlgo;
  block: number;
  /** K': a chave ajustada ao tamanho do bloco (hash se maior; zeros à direita se menor). */
  keyPrime: Uint8Array;
  keyWasHashed: boolean;
  /** K' XOR ipad (0x36 repetido). */
  ipadKey: Uint8Array;
  /** K' XOR opad (0x5c repetido). */
  opadKey: Uint8Array;
  /** H((K' XOR ipad) || m) */
  inner: Uint8Array;
  /** H((K' XOR opad) || inner) */
  tag: Uint8Array;
}

/** HMAC(K, m) = H((K' XOR opad) || H((K' XOR ipad) || m)), com todos os valores intermediários. */
export async function hmacTrace(algo: HashAlgo, key: Uint8Array, message: Uint8Array): Promise<HmacTrace> {
  const block = HASH_INFO[algo].block;
  const keyWasHashed = key.length > block;
  const base = keyWasHashed ? await digest(algo, key) : key;
  const keyPrime = new Uint8Array(block);
  keyPrime.set(base);
  const ipadKey = keyPrime.map((b) => b ^ 0x36);
  const opadKey = keyPrime.map((b) => b ^ 0x5c);
  const inner = await digest(algo, concat(ipadKey, message));
  const tag = await digest(algo, concat(opadKey, inner));
  return { algo, block, keyPrime, keyWasHashed, ipadKey, opadKey, inner, tag };
}

/** HMAC pela implementação nativa do navegador (referência para conferência). */
export async function hmacWebCrypto(algo: HashAlgo, key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const k = await subtle().importKey('raw', key as BufferSource, { name: 'HMAC', hash: algo }, false, ['sign']);
  return new Uint8Array(await subtle().sign('HMAC', k, message as BufferSource));
}

export interface AvalancheStats {
  trials: number;
  /** Média da fração de bits do hash que mudam ao inverter 1 bit da entrada. */
  meanFraction: number;
  minFraction: number;
  maxFraction: number;
}

/** Inverte, em mensagens aleatórias, um bit sorteado da entrada e mede quantos bits do hash mudam. */
export async function avalancheStats(algo: HashAlgo, trials = 100, messageBytes = 32): Promise<AvalancheStats> {
  let sum = 0;
  let min = 1;
  let max = 0;
  for (let i = 0; i < trials; i++) {
    const m = randomBytes(messageBytes);
    const pos = randomBytes(2);
    const bitIndex = ((pos[0] << 8) | pos[1]) % (messageBytes * 8);
    const m2 = new Uint8Array(m);
    m2[bitIndex >> 3] ^= 1 << (bitIndex & 7);
    const d = bitDifference(await digest(algo, m), await digest(algo, m2));
    const f = d.differing / d.total;
    sum += f;
    min = Math.min(min, f);
    max = Math.max(max, f);
  }
  return { trials, meanFraction: sum / trials, minFraction: min, maxFraction: max };
}
