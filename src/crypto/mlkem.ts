// ML-KEM (FIPS 203, antigo CRYSTALS-Kyber): mecanismo de encapsulamento de chave pós-quântico.
// Implementação didática e legível, sem proteção contra ataques de canal lateral (tempo constante,
// zeroização de memória). Os vetores de teste estão em tests/mlkem.test.ts (comparação com o OpenSSL do Node).
import { sha3_256, sha3_512, shake128, shake256 } from './keccak';

export const Q = 3329;
export const N = 256;

export interface MlKemParams {
  name: 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024';
  k: number;
  eta1: number;
  eta2: number;
  du: number;
  dv: number;
}

export const ML_KEM_512: MlKemParams = { name: 'ML-KEM-512', k: 2, eta1: 3, eta2: 2, du: 10, dv: 4 };
export const ML_KEM_768: MlKemParams = { name: 'ML-KEM-768', k: 3, eta1: 2, eta2: 2, du: 10, dv: 4 };
export const ML_KEM_1024: MlKemParams = { name: 'ML-KEM-1024', k: 4, eta1: 2, eta2: 2, du: 11, dv: 5 };

/** Tamanhos em bytes de cada artefato do conjunto de parâmetros. */
export const sizes = (p: MlKemParams) => ({
  ek: 384 * p.k + 32,
  dk: 768 * p.k + 96,
  ciphertext: 32 * (p.du * p.k + p.dv),
  sharedSecret: 32,
});

/** Polinômio de 256 coeficientes em Z_q (cada um entre 0 e 3328). */
export type Poly = number[];

const mod = (x: number) => ((x % Q) + Q) % Q;
const zero = (): Poly => new Array<number>(N).fill(0);

const bitRev7 = (i: number) => {
  let r = 0;
  for (let b = 0; b < 7; b++) r |= ((i >> b) & 1) << (6 - b);
  return r;
};
const powMod = (base: number, e: number) => {
  let r = 1;
  let b = base % Q;
  for (let x = e; x > 0; x >>= 1) {
    if (x & 1) r = (r * b) % Q;
    b = (b * b) % Q;
  }
  return r;
};

/** Raiz primitiva 256-ésima da unidade em Z_q. */
export const ZETA = 17;
const ZETAS = Array.from({ length: 128 }, (_, i) => powMod(ZETA, bitRev7(i)));
const GAMMAS = Array.from({ length: 128 }, (_, i) => powMod(ZETA, 2 * bitRev7(i) + 1));

/** Transformada teórica dos números (NTT): leva o polinômio ao domínio em que a multiplicação é por coeficiente. */
export function ntt(f: Poly): Poly {
  const a = f.slice();
  let i = 1;
  for (let len = 128; len >= 2; len >>= 1) {
    for (let start = 0; start < N; start += 2 * len) {
      const z = ZETAS[i++];
      for (let j = start; j < start + len; j++) {
        const t = (z * a[j + len]) % Q;
        a[j + len] = mod(a[j] - t);
        a[j] = (a[j] + t) % Q;
      }
    }
  }
  return a;
}

/** Inversa da NTT. */
export function invNtt(f: Poly): Poly {
  const a = f.slice();
  let i = 127;
  for (let len = 2; len <= 128; len <<= 1) {
    for (let start = 0; start < N; start += 2 * len) {
      const z = ZETAS[i--];
      for (let j = start; j < start + len; j++) {
        const t = a[j];
        a[j] = (t + a[j + len]) % Q;
        a[j + len] = (z * mod(a[j + len] - t)) % Q;
      }
    }
  }
  return a.map((x) => (x * 3303) % Q); // 3303 = 128^-1 mod q
}

/** Produto no domínio da NTT: 128 multiplicações de polinômios de grau 1 módulo (X^2 - gamma). */
export function multiplyNtts(f: Poly, g: Poly): Poly {
  const h = zero();
  for (let i = 0; i < 128; i++) {
    const [a0, a1, b0, b1] = [f[2 * i], f[2 * i + 1], g[2 * i], g[2 * i + 1]];
    h[2 * i] = (a0 * b0 + ((a1 * b1) % Q) * GAMMAS[i]) % Q;
    h[2 * i + 1] = (a0 * b1 + a1 * b0) % Q;
  }
  return h;
}

export const polyAdd = (a: Poly, b: Poly): Poly => a.map((x, i) => (x + b[i]) % Q);
export const polySub = (a: Poly, b: Poly): Poly => a.map((x, i) => mod(x - b[i]));

/** Multiplicação de polinômios no anel Z_q[X]/(X^256 + 1), sem NTT (usada para conferir a NTT). */
export function polyMulSchoolbook(a: Poly, b: Poly): Poly {
  const r = zero();
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const k = i + j;
      const v = a[i] * b[j];
      if (k < N) r[k] = (r[k] + v) % Q;
      else r[k - N] = mod(r[k - N] - v);
    }
  return r;
}

// --- Amostragem ---------------------------------------------------------------------------------

/** Amostra um polinômio uniforme no domínio da NTT por rejeição, a partir de SHAKE128(rho || j || i). */
export function sampleNtt(seed: Uint8Array): Poly {
  const xof = shake128(seed);
  const a = zero();
  let j = 0;
  while (j < N) {
    const [c0, c1, c2] = xof.squeeze(3);
    const d1 = c0 + 256 * (c1 & 15);
    const d2 = (c1 >> 4) + 16 * c2;
    if (d1 < Q) a[j++] = d1;
    if (d2 < Q && j < N) a[j++] = d2;
  }
  return a;
}

/** Ruído: cada coeficiente é a diferença de duas somas de eta bits aleatórios (binomial centrada), no intervalo [-eta, eta]. */
export function samplePolyCbd(bytes: Uint8Array, eta: number): Poly {
  const bit = (i: number) => (bytes[i >> 3] >> (i & 7)) & 1;
  const f = zero();
  for (let i = 0; i < N; i++) {
    let x = 0;
    let y = 0;
    for (let j = 0; j < eta; j++) {
      x += bit(2 * i * eta + j);
      y += bit(2 * i * eta + eta + j);
    }
    f[i] = mod(x - y);
  }
  return f;
}

const prf = (eta: number, s: Uint8Array, b: number) => shake256(Uint8Array.from([...s, b]), 64 * eta);

/** Valor do coeficiente de ruído como inteiro com sinal (-eta a eta), para exibição. */
export const centered = (x: number) => (x > Q / 2 ? x - Q : x);

// --- Codificação e compressão ---------------------------------------------------------------------

export function byteEncode(f: Poly, d: number): Uint8Array {
  const out = new Uint8Array(32 * d);
  for (let i = 0; i < N; i++)
    for (let b = 0; b < d; b++) {
      const pos = i * d + b;
      out[pos >> 3] |= ((f[i] >> b) & 1) << (pos & 7);
    }
  return out;
}

export function byteDecode(bytes: Uint8Array, d: number): Poly {
  const f = zero();
  for (let i = 0; i < N; i++) {
    let v = 0;
    for (let b = 0; b < d; b++) {
      const pos = i * d + b;
      v |= ((bytes[pos >> 3] >> (pos & 7)) & 1) << b;
    }
    f[i] = d === 12 ? v % Q : v;
  }
  return f;
}

/** Compress_d: descarta os bits menos significativos, arredondando para um dos 2^d valores. */
export const compress = (x: number, d: number) => Math.floor(((x << d) + (Q - 1) / 2) / Q) % (1 << d);
/** Decompress_d: aproxima o valor original (perde-se a precisão descartada). */
export const decompress = (y: number, d: number) => Math.floor((y * Q + (1 << (d - 1))) / (1 << d));

const compressPoly = (f: Poly, d: number): Poly => f.map((x) => compress(x, d));
const decompressPoly = (f: Poly, d: number): Poly => f.map((y) => decompress(y, d));

const cat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

// --- K-PKE (cifra de chave pública interna) --------------------------------------------------------

/** Matriz A (k x k) no domínio da NTT, expandida da semente rho. A[i][j] = SampleNTT(rho || j || i). */
export function expandMatrix(rho: Uint8Array, k: number): Poly[][] {
  return Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => sampleNtt(Uint8Array.from([...rho, j, i]))));
}

/** Combinação linear no domínio da NTT: soma dos produtos coeficiente a coeficiente. */
function dot(row: Poly[], v: Poly[]): Poly {
  return row.reduce((acc, r, j) => polyAdd(acc, multiplyNtts(r, v[j])), zero());
}

export interface KeyGenDetail {
  d: Uint8Array;
  z: Uint8Array;
  rho: Uint8Array;
  sigma: Uint8Array;
  A: Poly[][];
  s: Poly[];
  e: Poly[];
  sHat: Poly[];
  eHat: Poly[];
  tHat: Poly[];
  ek: Uint8Array;
  dk: Uint8Array;
}

/** Geração de chaves com as sementes d e z (32 bytes cada), mostrando todos os valores intermediários. */
export function keyGenDetailed(d: Uint8Array, z: Uint8Array, p: MlKemParams): KeyGenDetail {
  const g = sha3_512(d, Uint8Array.of(p.k));
  const rho = g.slice(0, 32);
  const sigma = g.slice(32);
  const A = expandMatrix(rho, p.k);
  let n = 0;
  const s = Array.from({ length: p.k }, () => samplePolyCbd(prf(p.eta1, sigma, n++), p.eta1));
  const e = Array.from({ length: p.k }, () => samplePolyCbd(prf(p.eta1, sigma, n++), p.eta1));
  const sHat = s.map(ntt);
  const eHat = e.map(ntt);
  const tHat = A.map((row, i) => polyAdd(dot(row, sHat), eHat[i]));
  const ek = cat([...tHat.map((t) => byteEncode(t, 12)), rho]);
  const dkPke = cat(sHat.map((x) => byteEncode(x, 12)));
  const dk = cat([dkPke, ek, sha3_256(ek), z]);
  return { d, z, rho, sigma, A, s, e, sHat, eHat, tHat, ek, dk };
}

export interface EncryptDetail {
  y: Poly[];
  e1: Poly[];
  e2: Poly;
  u: Poly[];
  mu: Poly;
  v: Poly;
  c1: Uint8Array;
  c2: Uint8Array;
  c: Uint8Array;
}

/** K-PKE.Encrypt determinístico: cifra a mensagem m (32 bytes) com a chave pública ek e a aleatoriedade r. */
export function kpkeEncrypt(ek: Uint8Array, m: Uint8Array, r: Uint8Array, p: MlKemParams): EncryptDetail {
  const tHat = Array.from({ length: p.k }, (_, i) => byteDecode(ek.subarray(384 * i, 384 * (i + 1)), 12));
  const rho = ek.subarray(384 * p.k);
  const A = expandMatrix(rho, p.k);
  let n = 0;
  const y = Array.from({ length: p.k }, () => samplePolyCbd(prf(p.eta1, r, n++), p.eta1));
  const e1 = Array.from({ length: p.k }, () => samplePolyCbd(prf(p.eta2, r, n++), p.eta2));
  const e2 = samplePolyCbd(prf(p.eta2, r, n++), p.eta2);
  const yHat = y.map(ntt);
  // u = A^T y + e1 (A transposta: troca-se linha e coluna)
  const u = Array.from({ length: p.k }, (_, i) =>
    polyAdd(
      invNtt(dot(A.map((row) => row[i]), yHat)),
      e1[i],
    ),
  );
  const mu = decompressPoly(byteDecode(m, 1), 1);
  const v = polyAdd(polyAdd(invNtt(dot(tHat, yHat)), e2), mu);
  const c1 = cat(u.map((x) => byteEncode(compressPoly(x, p.du), p.du)));
  const c2 = byteEncode(compressPoly(v, p.dv), p.dv);
  return { y, e1, e2, u, mu, v, c1, c2, c: cat([c1, c2]) };
}

export interface DecryptDetail {
  uPrime: Poly[];
  vPrime: Poly;
  /** s^T u' recuperado: v' - s^T u' deve ficar perto de 0 ou de q/2 em cada coeficiente. */
  w: Poly;
  m: Uint8Array;
}

/** K-PKE.Decrypt: recupera a mensagem arredondando cada coeficiente para 0 ou para q/2. */
export function kpkeDecrypt(dkPke: Uint8Array, c: Uint8Array, p: MlKemParams): DecryptDetail {
  const c1 = c.subarray(0, 32 * p.du * p.k);
  const c2 = c.subarray(32 * p.du * p.k);
  const uPrime = Array.from({ length: p.k }, (_, i) => decompressPoly(byteDecode(c1.subarray(32 * p.du * i, 32 * p.du * (i + 1)), p.du), p.du));
  const vPrime = decompressPoly(byteDecode(c2, p.dv), p.dv);
  const sHat = Array.from({ length: p.k }, (_, i) => byteDecode(dkPke.subarray(384 * i, 384 * (i + 1)), 12));
  const w = polySub(vPrime, invNtt(dot([sHat[0], ...sHat.slice(1)], uPrime.map(ntt))));
  const m = byteEncode(compressPoly(w, 1), 1);
  return { uPrime, vPrime, w, m };
}

// --- ML-KEM (transformação de Fujisaki-Okamoto sobre o K-PKE) -----------------------------------------

export const keyGen = (d: Uint8Array, z: Uint8Array, p: MlKemParams) => {
  const { ek, dk } = keyGenDetailed(d, z, p);
  return { ek, dk };
};

export interface EncapsDetail extends EncryptDetail {
  m: Uint8Array;
  h: Uint8Array;
  K: Uint8Array;
  r: Uint8Array;
}

/** Encapsulamento determinístico (a aleatoriedade m é um parâmetro, para permitir testes e demonstrações). */
export function encapsDetailed(ek: Uint8Array, m: Uint8Array, p: MlKemParams): EncapsDetail {
  if (ek.length !== sizes(p).ek) throw new Error('Chave de encapsulamento com tamanho incorreto.');
  // Verificação de modulus (FIPS 203, 7.2): cada coeficiente decodificado deve ser menor que q.
  for (let i = 0; i < p.k; i++) {
    const part = ek.subarray(384 * i, 384 * (i + 1));
    if (!eq(byteEncode(byteDecode(part, 12), 12), part)) throw new Error('Chave de encapsulamento inválida: coeficiente fora de [0, q).');
  }
  const h = sha3_256(ek);
  const g = sha3_512(m, h);
  const K = g.slice(0, 32);
  const r = g.slice(32);
  return { ...kpkeEncrypt(ek, m, r, p), m, h, K, r };
}

export const encaps = (ek: Uint8Array, m: Uint8Array, p: MlKemParams) => {
  const { K, c } = encapsDetailed(ek, m, p);
  return { K, c };
};

export interface DecapsDetail {
  mPrime: Uint8Array;
  KPrime: Uint8Array;
  rPrime: Uint8Array;
  /** Chave pseudoaleatória derivada de z e do texto cifrado, usada quando o texto cifrado é rejeitado. */
  KBar: Uint8Array;
  cPrime: Uint8Array;
  valid: boolean;
  K: Uint8Array;
  decrypt: DecryptDetail;
}

/** Desencapsulamento com rejeição implícita: texto cifrado adulterado gera uma chave diferente, sem erro. */
export function decapsDetailed(dk: Uint8Array, c: Uint8Array, p: MlKemParams): DecapsDetail {
  const sz = sizes(p);
  if (dk.length !== sz.dk) throw new Error('Chave de desencapsulamento com tamanho incorreto.');
  if (c.length !== sz.ciphertext) throw new Error('Texto cifrado com tamanho incorreto.');
  const dkPke = dk.subarray(0, 384 * p.k);
  const ek = dk.subarray(384 * p.k, 768 * p.k + 32);
  const h = dk.subarray(768 * p.k + 32, 768 * p.k + 64);
  const z = dk.subarray(768 * p.k + 64);
  const decrypt = kpkeDecrypt(dkPke, c, p);
  const g = sha3_512(decrypt.m, h);
  const KPrime = g.slice(0, 32);
  const rPrime = g.slice(32);
  const KBar = shake256(cat([z, c]), 32);
  const cPrime = kpkeEncrypt(ek, decrypt.m, rPrime, p).c;
  const valid = eq(c, cPrime);
  return { mPrime: decrypt.m, KPrime, rPrime, KBar, cPrime, valid, K: valid ? KPrime : KBar, decrypt };
}

export const decaps = (dk: Uint8Array, c: Uint8Array, p: MlKemParams) => decapsDetailed(dk, c, p).K;
