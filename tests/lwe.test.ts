import { describe, expect, it } from 'vitest';
import { DEFAULT_LWE, attackBruteForce, attackGauss, centeredMod, gaussSolve, lweDecrypt, lweEncrypt, lweKeyGen, prng, type LweParams } from '../src/crypto/lwe';

const clean: LweParams = { ...DEFAULT_LWE, noise: 0 };

describe('LWE didático', () => {
  it('o gerador pseudoaleatório repete com a mesma semente', () => {
    const a = prng(7);
    const b = prng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('b = A s + e (mod q) e o erro fica em [-B, B]', () => {
    const k = lweKeyGen(DEFAULT_LWE, 11);
    k.A.forEach((row, i) => {
      const lhs = (((row.reduce((acc, a, j) => acc + a * k.s[j], 0) + k.e[i]) % 97) + 97) % 97;
      expect(k.b[i]).toBe(lhs);
      expect(Math.abs(k.e[i])).toBeLessThanOrEqual(1);
    });
  });

  it('sem ruído, e = 0', () => {
    expect(lweKeyGen(clean, 5).e.every((x) => x === 0)).toBe(true);
  });

  it('decifra os dois bits corretamente, com folga positiva', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const k = lweKeyGen(DEFAULT_LWE, seed);
      for (const bit of [0, 1] as const) {
        const c = lweEncrypt(k, bit, seed + 1000);
        const d = lweDecrypt(k.params, k.s, c.u, c.v);
        expect(d.bit).toBe(bit);
        expect(d.margin).toBeGreaterThan(0);
      }
    }
  });

  it('com o segredo errado a decifragem não é confiável', () => {
    const k = lweKeyGen(DEFAULT_LWE, 3);
    let wrong = 0;
    for (let i = 0; i < 40; i++) {
      const c = lweEncrypt(k, 1, i);
      if (lweDecrypt(k.params, k.s.map((x) => (x + 1) % 97), c.u, c.v).bit !== 1) wrong++;
    }
    expect(wrong).toBeGreaterThan(5);
  });

  it('Gauss recupera o segredo quando não há ruído e falha quando há', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const a = attackGauss(lweKeyGen(clean, seed));
      expect(a.correct).toBe(true);
      expect(a.residual).toBe(0);
    }
    const noisy = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => attackGauss(lweKeyGen(DEFAULT_LWE, seed)));
    expect(noisy.filter((a) => a.correct).length).toBeLessThanOrEqual(2);
    expect(noisy.some((a) => a.residual > 1)).toBe(true);
  });

  it('a força bruta acha o segredo mesmo com ruído, porque n é minúsculo', () => {
    for (const seed of [1, 2, 3]) {
      const k = lweKeyGen(DEFAULT_LWE, seed);
      const a = attackBruteForce(k);
      expect(a.correct).toBe(true);
      expect(a.residual).toBeLessThanOrEqual(1);
      expect(a.tries).toBeLessThanOrEqual(97 ** 3);
    }
  });

  it('gaussSolve devolve null se o sistema é degenerado', () => {
    expect(gaussSolve({ ...clean, n: 2, m: 2 }, [[1, 2], [2, 4]], [1, 2])).toBeNull();
  });

  it('centeredMod', () => {
    expect(centeredMod(96, 97)).toBe(-1);
    expect(centeredMod(3, 97)).toBe(3);
  });
});
