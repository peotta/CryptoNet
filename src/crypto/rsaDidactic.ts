// RSA DIDÁTICO SEM PADDING. Inseguro para aplicações reais: determinístico, maleável e sem
// proteção de integridade. Existe apenas para visualizar a matemática (Rivest, Shamir, Adleman, 1978).
import { CryptoInputError, egcdTrace, gcd, isProbablePrime, modInverse, modPow, type EgcdRow } from './bigmath';
import { randomPrimeInRange } from './random';

export const RSA_LIMITS = {
  minPrime: 3n,
  maxPrime: 1_000_003n,
  maxDigits: 7,
} as const;

export interface RsaPublicKey {
  n: bigint;
  e: bigint;
}
export interface RsaPrivateKey {
  n: bigint;
  d: bigint;
}
export interface RsaDidacticKeys {
  p: bigint;
  q: bigint;
  n: bigint;
  phi: bigint;
  e: bigint;
  d: bigint;
  publicKey: RsaPublicKey;
  privateKey: RsaPrivateKey;
  euclid: EgcdRow[];
  warnings: string[];
}

export function validatePrime(label: string, value: bigint): void {
  if (value < RSA_LIMITS.minPrime || value > RSA_LIMITS.maxPrime) {
    throw new CryptoInputError(`${label} deve estar entre ${RSA_LIMITS.minPrime} e ${RSA_LIMITS.maxPrime} (limite didático).`);
  }
  if (!isProbablePrime(value)) throw new CryptoInputError(`${label} = ${value} não é primo.`);
}

/** Menor expoente público usual coprimo com φ(n); recorre a uma busca ímpar se necessário. */
export function suggestPublicExponent(phi: bigint): bigint {
  for (const c of [65537n, 257n, 17n, 5n, 3n]) {
    if (c < phi && gcd(c, phi) === 1n) return c;
  }
  for (let c = 3n; c < phi; c += 2n) if (gcd(c, phi) === 1n) return c;
  throw new CryptoInputError('Não existe expoente público válido para este φ(n).');
}

export function generateDidacticKeys(p: bigint, q: bigint, e: bigint): RsaDidacticKeys {
  validatePrime('p', p);
  validatePrime('q', q);
  if (p === q) throw new CryptoInputError('p e q devem ser primos distintos.');
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  if (e <= 1n || e >= phi) throw new CryptoInputError(`e deve satisfazer 1 < e < φ(n) = ${phi}.`);
  const g = gcd(e, phi);
  if (g !== 1n) throw new CryptoInputError(`e = ${e} não é coprimo com φ(n) = ${phi} (mdc = ${g}).`);
  const d = modInverse(e, phi);
  const warnings: string[] = [];
  if (n < 256n) warnings.push('n < 256: não comporta sequer um byte de mensagem; use valores maiores para textos.');
  if (d === e) warnings.push('d = e: as chaves pública e privada coincidem neste exemplo degenerado.');
  return {
    p,
    q,
    n,
    phi,
    e,
    d,
    publicKey: { n, e },
    privateKey: { n, d },
    euclid: egcdTrace(phi, e).rows,
    warnings,
  };
}

function checkMessage(m: bigint, n: bigint, label = 'm'): void {
  if (m < 0n || m >= n) throw new CryptoInputError(`${label} deve satisfazer 0 ≤ ${label} < n = ${n}.`);
}

export function encryptDidactic(m: bigint, key: RsaPublicKey): bigint {
  checkMessage(m, key.n);
  return modPow(m, key.e, key.n);
}

export function decryptDidactic(c: bigint, key: RsaPrivateKey): bigint {
  checkMessage(c, key.n, 'c');
  return modPow(c, key.d, key.n);
}

/** Assinatura "de livro-texto" s = m^d mod n, sem hash e sem padding (inseguro). */
export function signDidactic(m: bigint, key: RsaPrivateKey): bigint {
  checkMessage(m, key.n);
  return modPow(m, key.d, key.n);
}

export function verifyDidactic(m: bigint, s: bigint, key: RsaPublicKey): boolean {
  checkMessage(m, key.n);
  checkMessage(s, key.n, 's');
  return modPow(s, key.e, key.n) === m;
}

/** Sorteia um par de primos distintos de tamanho didático (ordem de centenas a milhares). */
export function randomDidacticPrimes(): { p: bigint; q: bigint } {
  const p = randomPrimeInRange(101n, 997n);
  const q = randomPrimeInRange(101n, 997n, p);
  return { p, q };
}
