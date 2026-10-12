// Aleatoriedade criptograficamente segura via Web Crypto (crypto.getRandomValues).
// Math.random() não é usado em nenhuma parte deste projeto.
import { bitLength, CryptoInputError, isProbablePrime } from './bigmath';

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** Inteiro uniforme em [0, maxExclusive) por amostragem com rejeição (sem viés de módulo). */
export function randomBigIntBelow(maxExclusive: bigint): bigint {
  if (maxExclusive <= 0n) throw new CryptoInputError('O limite superior deve ser positivo.');
  const bits = bitLength(maxExclusive);
  const bytes = Math.ceil(bits / 8);
  const excess = BigInt(bytes * 8 - bits);
  for (;;) {
    const buf = randomBytes(bytes);
    let value = 0n;
    for (const b of buf) value = (value << 8n) | BigInt(b);
    value >>= excess;
    if (value < maxExclusive) return value;
  }
}

/** Inteiro uniforme em [min, max], inclusive. */
export function randomBigIntInRange(min: bigint, max: bigint): bigint {
  if (max < min) throw new CryptoInputError('Intervalo aleatório inválido.');
  return min + randomBigIntBelow(max - min + 1n);
}

/** Primo aleatório em [min, max], por sorteio e teste de Miller-Rabin. */
export function randomPrimeInRange(min: bigint, max: bigint, exclude?: bigint): bigint {
  for (let i = 0; i < 100000; i++) {
    const c = randomBigIntInRange(min, max) | 1n;
    if (c <= max && c >= min && c !== exclude && isProbablePrime(c)) return c;
  }
  throw new CryptoInputError('Não foi possível encontrar um primo no intervalo informado.');
}
