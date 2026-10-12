import { describe, expect, it } from 'vitest';
import {
  bitLength,
  CryptoInputError,
  egcdTrace,
  gcd,
  isPrimitiveRoot,
  isProbablePrime,
  modInverse,
  modPow,
  parseDecimal,
  primeFactors,
} from '../src/crypto/bigmath';
import { randomBigIntBelow, randomBigIntInRange, randomPrimeInRange } from '../src/crypto/random';

describe('exponenciação modular', () => {
  it('calcula valores conhecidos', () => {
    expect(modPow(4n, 13n, 497n)).toBe(445n); // exemplo clássico da literatura
    expect(modPow(5n, 6n, 23n)).toBe(8n);
    expect(modPow(65n, 17n, 3233n)).toBe(2790n);
  });
  it('trata casos de borda', () => {
    expect(modPow(7n, 0n, 13n)).toBe(1n);
    expect(modPow(7n, 5n, 1n)).toBe(0n);
    expect(modPow(-3n, 3n, 7n)).toBe(modPow(4n, 3n, 7n));
  });
  it('concorda com a definição por multiplicação direta', () => {
    for (let b = 0n; b < 12n; b++) for (let e = 0n; e < 12n; e++) expect(modPow(b, e, 17n)).toBe(b ** e % 17n);
  });
  it('é eficiente com expoentes grandes', () => {
    const p = 2n ** 127n - 1n; // primo de Mersenne
    expect(modPow(3n, p - 1n, p)).toBe(1n); // Pequeno Teorema de Fermat
  });
  it('rejeita entradas inválidas', () => {
    expect(() => modPow(2n, 3n, 0n)).toThrow(CryptoInputError);
    expect(() => modPow(2n, -1n, 5n)).toThrow(CryptoInputError);
  });
});

describe('mdc e inverso modular', () => {
  it('calcula o mdc', () => {
    expect(gcd(48n, 18n)).toBe(6n);
    expect(gcd(17n, 3120n)).toBe(1n);
  });
  it('calcula o inverso modular', () => {
    expect(modInverse(17n, 3120n)).toBe(2753n);
    expect(modInverse(3n, 11n)).toBe(4n);
    for (let a = 1n; a < 31n; a++) expect((a * modInverse(a, 31n)) % 31n).toBe(1n);
  });
  it('falha quando não há inverso', () => {
    expect(() => modInverse(6n, 9n)).toThrow(CryptoInputError);
    expect(() => modInverse(2n, 1n)).toThrow(CryptoInputError);
  });
  it('o rastro do Euclides estendido satisfaz r = s·a + t·b em todas as linhas', () => {
    const { rows } = egcdTrace(3120n, 17n);
    for (const r of rows) expect(r.s * 3120n + r.t * 17n).toBe(r.r);
  });
});

describe('primalidade e raízes primitivas', () => {
  it('reconhece primos e compostos', () => {
    expect([2n, 3n, 23n, 467n, 2027n, 1000003n].every(isProbablePrime)).toBe(true);
    expect([0n, 1n, 4n, 561n, 1105n, 3233n].some(isProbablePrime)).toBe(false); // 561 e 1105: números de Carmichael
  });
  it('fatora corretamente', () => {
    expect(primeFactors(466n)).toEqual([2n, 233n]);
    expect(primeFactors(3233n)).toEqual([53n, 61n]);
  });
  it('identifica raízes primitivas', () => {
    expect(isPrimitiveRoot(5n, 23n)).toBe(true);
    expect(isPrimitiveRoot(4n, 23n)).toBe(false); // 4 é resíduo quadrático
  });
  it('mede o tamanho em bits', () => {
    expect(bitLength(0n)).toBe(0);
    expect(bitLength(255n)).toBe(8);
    expect(bitLength(256n)).toBe(9);
  });
});

describe('análise de entradas decimais', () => {
  it('aceita inteiros e rejeita lixo', () => {
    expect(parseDecimal(' 42 ', 'x')).toBe(42n);
    expect(() => parseDecimal('', 'x')).toThrow(CryptoInputError);
    expect(() => parseDecimal('12a', 'x')).toThrow(CryptoInputError);
    expect(() => parseDecimal('-5', 'x')).toThrow(CryptoInputError);
    expect(() => parseDecimal('1.5', 'x')).toThrow(CryptoInputError);
    expect(() => parseDecimal('1'.repeat(30), 'x')).toThrow(CryptoInputError);
  });
});

describe('aleatoriedade (Web Crypto)', () => {
  it('respeita os limites', () => {
    for (let i = 0; i < 300; i++) {
      expect(randomBigIntBelow(10n)).toBeLessThan(10n);
      const r = randomBigIntInRange(2n, 21n);
      expect(r >= 2n && r <= 21n).toBe(true);
    }
  });
  it('cobre todo o intervalo (sem viés evidente)', () => {
    const seen = new Set<bigint>();
    for (let i = 0; i < 400; i++) seen.add(randomBigIntBelow(7n));
    expect(seen.size).toBe(7);
  });
  it('sorteia primos', () => {
    for (let i = 0; i < 20; i++) expect(isProbablePrime(randomPrimeInRange(101n, 997n))).toBe(true);
  });
  it('não usa Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random não deve ser usado');
    };
    try {
      expect(() => randomBigIntBelow(1000n)).not.toThrow();
      expect(() => randomPrimeInRange(101n, 997n)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
  it('rejeita intervalos inválidos', () => {
    expect(() => randomBigIntBelow(0n)).toThrow(CryptoInputError);
    expect(() => randomBigIntInRange(5n, 1n)).toThrow(CryptoInputError);
  });
});
