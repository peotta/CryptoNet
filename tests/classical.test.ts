import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import {
  chiSquared,
  crack,
  decrypt,
  encrypt,
  groupsOfFive,
  inverseOfA,
  keySpaceSize,
  knownPlaintextAttack,
  letterCounts,
  letterPercentages,
  normalizeText,
  PT_FREQUENCY,
  VALID_A,
} from '../src/crypto/classical';

const TEXTO = 'NOS ATACAREMOS A FORTALEZA AO AMANHECER SEM AVISAR NINGUEM POIS A SURPRESA E A NOSSA MELHOR ARMA';

describe('normalização do texto', () => {
  it('remove acentos, espaços e pontuação e passa para maiúsculas', () => {
    expect(normalizeText('Ação é São João!')).toBe('ACAOESAOJOAO');
    expect(normalizeText('  1 2 3 ')).toBe('');
    expect(normalizeText('ç Ü ñ')).toBe('CUN');
  });
  it('agrupa em blocos de cinco letras', () => {
    expect(groupsOfFive('ABCDEFGHIJKL')).toBe('ABCDE FGHIJ KL');
    expect(groupsOfFive('')).toBe('');
  });
});

describe('cifra de César', () => {
  it('cifra e decifra o exemplo clássico', () => {
    expect(encrypt('cesar', { a: 1, b: 3 }, 'ATAQUE')).toBe('DWDTXH');
    expect(decrypt('cesar', { a: 1, b: 3 }, 'DWDTXH')).toBe('ATAQUE');
  });
  it('trata o fim do alfabeto (XYZ com k = 3)', () => {
    expect(encrypt('cesar', { a: 1, b: 3 }, 'XYZ')).toBe('ABC');
  });
  it('k = 13 (ROT13) é sua própria inversa e k = 0 não altera', () => {
    const t = normalizeText(TEXTO);
    expect(encrypt('cesar', { a: 1, b: 13 }, encrypt('cesar', { a: 1, b: 13 }, t))).toBe(t);
    expect(encrypt('cesar', { a: 1, b: 0 }, t)).toBe(t);
  });
  it('decifrar inverte cifrar para todas as chaves', () => {
    for (let k = 0; k < 26; k++) expect(decrypt('cesar', { a: 1, b: k }, encrypt('cesar', { a: 1, b: k }, TEXTO))).toBe(normalizeText(TEXTO));
  });
  it('rejeita chaves inválidas', () => {
    expect(() => encrypt('cesar', { a: 1, b: 26 }, 'A')).toThrow(CryptoInputError);
    expect(() => encrypt('cesar', { a: 1, b: -1 }, 'A')).toThrow(CryptoInputError);
    expect(() => encrypt('cesar', { a: 1, b: 1.5 }, 'A')).toThrow(CryptoInputError);
    expect(() => encrypt('cesar', { a: 3, b: 1 }, 'A')).toThrow(/a = 1/);
  });
});

describe('cifra afim', () => {
  it('reproduz o exemplo clássico (a = 5, b = 8)', () => {
    expect(encrypt('afim', { a: 5, b: 8 }, 'AFFINE CIPHER')).toBe('IHHWVCSWFRCP');
    expect(decrypt('afim', { a: 5, b: 8 }, 'IHHWVCSWFRCP')).toBe('AFFINECIPHER');
  });
  it('tem 12 valores válidos de a e 312 chaves', () => {
    expect(VALID_A).toEqual([1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25]);
    expect(keySpaceSize('afim')).toBe(312);
    expect(keySpaceSize('cesar')).toBe(26);
  });
  it('calcula o inverso de a módulo 26', () => {
    expect(inverseOfA(5)).toBe(21);
    expect(inverseOfA(7)).toBe(15);
    for (const a of VALID_A) expect((a * inverseOfA(a)) % 26).toBe(1);
  });
  it('rejeita valores de a sem inverso', () => {
    for (const a of [0, 2, 4, 13, 26]) expect(() => encrypt('afim', { a, b: 1 }, 'A')).toThrow(CryptoInputError);
    expect(() => encrypt('afim', { a: 2, b: 1 }, 'A')).toThrow(/mdc\(a, 26\)/);
  });
  it('decifrar inverte cifrar para todas as 312 chaves', () => {
    for (const a of VALID_A) for (let b = 0; b < 26; b++) expect(decrypt('afim', { a, b }, encrypt('afim', { a, b }, TEXTO))).toBe(normalizeText(TEXTO));
  });
  it('a cifra afim é uma bijeção no alfabeto', () => {
    const all = encrypt('afim', { a: 7, b: 3 }, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(new Set(all).size).toBe(26);
  });
});

describe('frequência e criptoanálise', () => {
  it('as frequências do português somam cerca de 100%', () => {
    expect(PT_FREQUENCY.reduce((a, b) => a + b, 0)).toBeGreaterThan(99.9);
    expect(PT_FREQUENCY.reduce((a, b) => a + b, 0)).toBeLessThan(100.1);
  });
  it('conta letras e calcula percentuais', () => {
    expect(letterCounts('Abba!')[0]).toBe(2);
    expect(letterCounts('Abba!')[1]).toBe(2);
    expect(letterPercentages('AAB')[0]).toBeCloseTo(66.67, 1);
    expect(letterPercentages('').every((x) => x === 0)).toBe(true);
  });
  it('o χ² é menor para português do que para o texto cifrado', () => {
    const claro = chiSquared(TEXTO);
    const cifrado = chiSquared(encrypt('cesar', { a: 1, b: 7 }, TEXTO));
    expect(claro).toBeLessThan(cifrado);
    expect(chiSquared('')).toBe(Infinity);
  });
  it('a força bruta recupera qualquer chave de César em texto de tamanho razoável', () => {
    for (let k = 0; k < 26; k++) {
      const ct = encrypt('cesar', { a: 1, b: k }, TEXTO);
      const best = crack('cesar', ct)[0];
      expect(best.key).toEqual({ a: 1, b: k });
      expect(best.plaintext).toBe(normalizeText(TEXTO));
    }
  });
  it('a força bruta testa 26 chaves no César e 312 na cifra afim', () => {
    expect(crack('cesar', 'ABC')).toHaveLength(26);
    expect(crack('afim', 'ABC')).toHaveLength(312);
  });
  it('a força bruta recupera chaves afins', () => {
    for (const key of [{ a: 5, b: 8 }, { a: 11, b: 2 }, { a: 25, b: 25 }, { a: 3, b: 0 }]) {
      const best = crack('afim', encrypt('afim', key, TEXTO))[0];
      expect(best.key).toEqual(key);
    }
  });
  it('o ataque de texto claro conhecido identifica a chave com poucas letras', () => {
    const ct = encrypt('afim', { a: 5, b: 8 }, TEXTO);
    expect(knownPlaintextAttack('afim', 'NOSATA', ct.slice(0, 6))).toEqual([{ a: 5, b: 8 }]);
    expect(knownPlaintextAttack('cesar', 'N', encrypt('cesar', { a: 1, b: 9 }, 'N'))).toEqual([{ a: 1, b: 9 }]);
    expect(knownPlaintextAttack('afim', '', 'X')).toEqual([]);
  });
  it('com uma só letra conhecida a cifra afim ainda deixa várias chaves possíveis', () => {
    const ct = encrypt('afim', { a: 5, b: 8 }, 'N');
    expect(knownPlaintextAttack('afim', 'N', ct).length).toBe(12); // 12 valores de a, cada um com um b
  });
});
