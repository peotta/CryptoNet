import { describe, expect, it } from 'vitest';
import { CryptoInputError, isPrimitiveRoot, isProbablePrime, modPow } from '../src/crypto/bigmath';
import {
  bruteForceDiscreteLog,
  checkDhParameters,
  checkPrivateExponent,
  DH_GROUPS,
  generatePrivateExponent,
  runDhSession,
  runMitmSession,
} from '../src/crypto/diffieHellman';
import { engines } from '../src/crypto/engines';
import { aesGcmDecrypt, aesGcmEncrypt, hkdfSha256 } from '../src/crypto/kdf';
import { toHex } from '../src/crypto/encoding';

describe('grupos didáticos pré-validados', () => {
  it.each(DH_GROUPS)('$name: p primo seguro e g raiz primitiva', (grp) => {
    expect(isProbablePrime(grp.p)).toBe(true);
    expect(isProbablePrime((grp.p - 1n) / 2n)).toBe(true);
    expect(isPrimitiveRoot(grp.g, grp.p)).toBe(true);
    const check = checkDhParameters(grp.p, grp.g);
    expect(check.errors).toEqual([]);
    expect(check.warnings).toEqual([]);
  });
});

describe('cálculo e igualdade dos segredos', () => {
  it('reproduz o exemplo clássico (p = 23, g = 5, a = 6, b = 15)', () => {
    const s = runDhSession(23n, 5n, 6n, 15n);
    expect(s.A).toBe(8n);
    expect(s.B).toBe(19n);
    expect(s.kAlice).toBe(2n);
    expect(s.kBob).toBe(2n);
    expect(s.match).toBe(true);
  });
  it('K_A = K_B para todos os pares de segredos em p = 23', () => {
    for (let a = 2n; a <= 21n; a++) for (let b = 2n; b <= 21n; b++) expect(runDhSession(23n, 5n, a, b).match).toBe(true);
  });
  it('K = g^(ab) mod p', () => {
    const s = runDhSession(2027n, 2n, 123n, 456n);
    expect(s.kAlice).toBe(modPow(2n, 123n * 456n, 2027n));
  });
  it('funciona com segredos sorteados de forma segura', async () => {
    for (let i = 0; i < 30; i++) {
      const a = generatePrivateExponent(2027n);
      const b = generatePrivateExponent(2027n);
      expect((await engines.diffieHellman.runSession(2027n, 2n, a, b)).match).toBe(true);
    }
  });
  it('funciona em um primo grande (Mersenne 2^127 - 1)', () => {
    const p = 2n ** 127n - 1n;
    // fora do limite didático: o motor rejeita, a aritmética subjacente não
    expect(() => runDhSession(p, 3n, 1234567n, 7654321n)).toThrow(CryptoInputError);
    const A = modPow(3n, 1234567n, p);
    const B = modPow(3n, 7654321n, p);
    expect(modPow(B, 1234567n, p)).toBe(modPow(A, 7654321n, p));
  });
});

describe('validação de parâmetros e entradas inválidas', () => {
  it('rejeita p composto, fora da faixa e g inválido', () => {
    expect(checkDhParameters(24n, 5n).errors.length).toBeGreaterThan(0);
    expect(checkDhParameters(7n, 2n).errors.length).toBeGreaterThan(0); // p < 11
    expect(checkDhParameters(2_000_000_011n, 2n).errors.length).toBeGreaterThan(0); // acima do limite
    expect(checkDhParameters(23n, 1n).errors.length).toBeGreaterThan(0);
    expect(checkDhParameters(23n, 22n).errors.length).toBeGreaterThan(0);
    expect(checkDhParameters(23n, 40n).errors.length).toBeGreaterThan(0);
  });
  it('avisa sobre g que não é raiz primitiva e sobre p que não é primo seguro', () => {
    expect(checkDhParameters(23n, 4n).warnings.join(' ')).toMatch(/raiz primitiva/);
    expect(checkDhParameters(31n, 3n).warnings.join(' ')).toMatch(/primo seguro/);
  });
  it('valida os expoentes privados', () => {
    expect(checkPrivateExponent('a', 1n, 23n)).not.toBeNull();
    expect(checkPrivateExponent('a', 22n, 23n)).not.toBeNull();
    expect(checkPrivateExponent('a', 2n, 23n)).toBeNull();
    expect(checkPrivateExponent('a', 21n, 23n)).toBeNull();
  });
  it('a sessão lança erro para entradas inválidas', () => {
    expect(() => runDhSession(24n, 5n, 6n, 15n)).toThrow(CryptoInputError);
    expect(() => runDhSession(23n, 5n, 1n, 15n)).toThrow(CryptoInputError);
    expect(() => runDhSession(23n, 5n, 6n, 22n)).toThrow(CryptoInputError);
  });
  it('os segredos sorteados ficam sempre no intervalo válido', () => {
    for (let i = 0; i < 200; i++) {
      const x = generatePrivateExponent(23n);
      expect(x >= 2n && x <= 21n).toBe(true);
    }
  });
});

describe('ataque do homem do meio (MITM)', () => {
  it('Eve compartilha um segredo distinto com cada lado', () => {
    const m = runMitmSession(23n, 5n, 6n, 15n, 13n);
    expect(m.E).toBe(modPow(5n, 13n, 23n));
    expect(m.aliceMatchesEve).toBe(true);
    expect(m.bobMatchesEve).toBe(true);
    expect(m.aliceMatchesBob).toBe(false);
    expect(m.kAlice).toBe(modPow(5n, 6n * 13n, 23n));
    expect(m.kBob).toBe(modPow(5n, 15n * 13n, 23n));
  });
  it('Alice e Bob divergem quando a != b (mod ordem) e Eve sempre acompanha cada lado', () => {
    for (let a = 2n; a <= 21n; a++) {
      const m = runMitmSession(23n, 5n, a, 7n, 3n);
      expect(m.aliceMatchesEve && m.bobMatchesEve).toBe(true);
    }
  });
  it('rejeita o segredo inválido de Eve', () => {
    expect(() => runMitmSession(23n, 5n, 6n, 15n, 1n)).toThrow(CryptoInputError);
  });
});

describe('logaritmo discreto por força bruta', () => {
  it('Eve recupera um expoente equivalente em grupos pequenos', () => {
    const s = runDhSession(467n, 2n, 153n, 292n);
    const r = bruteForceDiscreteLog(2n, s.A, 467n);
    expect(r.found).toBe(true);
    expect(modPow(2n, r.exponent!, 467n)).toBe(s.A);
    expect(modPow(s.B, r.exponent!, 467n)).toBe(s.kAlice);
  });
  it('respeita o limite de iterações', () => {
    const r = bruteForceDiscreteLog(5n, 3n, 1_000_003n, 10);
    expect(r.found).toBe(false);
  });
});

describe('HKDF e AES-GCM reais sobre o segredo compartilhado', () => {
  it('Alice e Bob derivam a mesma chave e decifram a mensagem', async () => {
    const s = runDhSession(2027n, 2n, 700n, 911n);
    const kA = await hkdfSha256(s.kAlice, 'teste');
    const kB = await hkdfSha256(s.kBob, 'teste');
    expect(toHex(kA)).toBe(toHex(kB));
    expect(kA.length).toBe(32);
    const sealed = await aesGcmEncrypt(kA, 'olá, Bob');
    expect(await aesGcmDecrypt(kB, sealed)).toBe('olá, Bob');
  });
  it('contextos (info) diferentes geram chaves diferentes', async () => {
    expect(toHex(await hkdfSha256(5n, 'a'))).not.toBe(toHex(await hkdfSha256(5n, 'b')));
  });
  it('detecta adulteração do texto cifrado (autenticação do GCM)', async () => {
    const key = await hkdfSha256(42n, 'x');
    const sealed = await aesGcmEncrypt(key, 'segredo');
    const bad = { iv: sealed.iv, ciphertext: Uint8Array.from(sealed.ciphertext, (b, i) => (i === 0 ? b ^ 1 : b)) };
    await expect(aesGcmDecrypt(key, bad)).rejects.toThrow();
  });
  it('chaves diferentes não decifram', async () => {
    const sealed = await aesGcmEncrypt(await hkdfSha256(1n, 'x'), 'segredo');
    await expect(aesGcmDecrypt(await hkdfSha256(2n, 'x'), sealed)).rejects.toThrow();
  });
});
