import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import { normalizeText } from '../src/crypto/classical';
import {
  determinant,
  hillDecrypt,
  hillEncrypt,
  hillEncryptBlocks,
  hillPrepare,
  inverseMod26,
  isInvertibleMod26,
  keyFromWord,
  knownPlaintextAttack,
  multiply,
  validateKey,
  type Matrix,
} from '../src/crypto/hill';
import { buildGrid, playfairDecrypt, playfairEncrypt, playfairEncryptSteps, toDigraphs, transformDigraph, validateGrid } from '../src/crypto/playfair';
import { randomBigIntBelow } from '../src/crypto/random';

describe('Playfair: grade e preparação do texto', () => {
  it('monta a grade com a chave "PLAYFAIR EXAMPLE" (exemplo clássico)', () => {
    expect(buildGrid('PLAYFAIR EXAMPLE')).toBe('PLAYFIREXMBCDGHKNOQSTUVWZ');
  });
  it('J vira I e a grade sempre tem 25 letras distintas', () => {
    const g = buildGrid('JUJUBA');
    expect(g).toHaveLength(25);
    expect(new Set(g).size).toBe(25);
    expect(g).not.toContain('J');
    expect(g.startsWith('IUBA')).toBe(true);
  });
  it('divide em digrafos: X entre letras iguais e X no fim se sobrar uma letra', () => {
    expect(toDigraphs('HIDE THE GOLD IN THE TREE STUMP')).toEqual(['HI', 'DE', 'TH', 'EG', 'OL', 'DI', 'NT', 'HE', 'TR', 'EX', 'ES', 'TU', 'MP']);
    expect(toDigraphs('ABCDE')).toEqual(['AB', 'CD', 'EX']);
    expect(toDigraphs('BALLOON')).toEqual(['BA', 'LX', 'LO', 'ON']);
    expect(toDigraphs('XX')).toEqual(['XZ', 'XZ']);
  });
  it('valida a grade', () => {
    expect(() => validateGrid('ABC')).toThrow(CryptoInputError);
    expect(() => validateGrid('A'.repeat(25))).toThrow(CryptoInputError);
    expect(validateGrid('PLAYFIREXMBCDGHKNOQSTUVWZ')).toHaveLength(25);
  });
});

describe('Playfair: cifragem e decifragem', () => {
  const grid = buildGrid('PLAYFAIR EXAMPLE');
  it('reproduz o exemplo clássico (HIDE THE GOLD IN THE TREE STUMP)', () => {
    expect(playfairEncrypt(grid, 'Hide the gold in the tree stump')).toBe('BMODZBXDNABEKUDMUIXMMOUVIF');
  });
  it('aplica as três regras: linha, coluna e retângulo (exemplo clássico)', () => {
    expect(playfairEncryptSteps(grid, 'HIDETHEGOLDINTHETREESTUMP').map((s) => s.rule)).toEqual([
      'retângulo', 'coluna', 'retângulo', 'retângulo', 'retângulo', 'retângulo', 'retângulo', 'retângulo', 'retângulo', 'linha', 'retângulo', 'linha', 'retângulo',
    ]);
    expect(transformDigraph(grid, 'DE', 1)).toMatchObject({ output: 'OD', rule: 'coluna' }); // D e E na mesma coluna: descem uma posição
    expect(transformDigraph(grid, 'EX', 1)).toMatchObject({ output: 'XM', rule: 'linha' }); // mesma linha: vão para a direita
    expect(transformDigraph(grid, 'HI', 1)).toMatchObject({ output: 'BM', rule: 'retângulo' }); // cantos do retângulo
  });
  it('decifrar inverte cifrar (o texto claro volta com os X inseridos)', () => {
    const c = playfairEncrypt(grid, 'Hide the gold in the tree stump');
    expect(playfairDecrypt(grid, c)).toBe('HIDETHEGOLDINTHETREXESTUMP');
  });
  it('é uma cifra de digrafos: AB e BA se cifram de forma simétrica', () => {
    const ab = transformDigraph(grid, 'HE', 1).output;
    const ba = transformDigraph(grid, 'EH', 1).output;
    expect(ba).toBe(ab[1] + ab[0]);
  });
  it('nenhuma letra é cifrada em si mesma, e a cifra tem sempre comprimento par', () => {
    const plain = normalizeText('Nós atacaremos a fortaleza ao amanhecer');
    const digs = toDigraphs(plain);
    const c = playfairEncrypt(grid, plain);
    expect(c.length % 2).toBe(0);
    for (let i = 0; i < c.length; i++) expect(c[i]).not.toBe(digs.join('')[i]);
  });
  it('a decifragem rejeita comprimento ímpar', () => {
    expect(() => playfairDecrypt(grid, 'ABC')).toThrow(/par/);
  });
  it('decifrar inverte cifrar para chaves variadas', () => {
    for (const key of ['MONARQUIA', 'CRIPTOGRAFIA', 'X', 'UNIVERSIDADE DE BRASILIA']) {
      const g = buildGrid(key);
      const plain = 'ATACAREMOSAFORTALEZAAOAMANHECER';
      const dec = playfairDecrypt(g, playfairEncrypt(g, plain));
      expect(dec.replace(/X/g, '')).toBe(plain.replace(/X/g, ''));
    }
  });
});

describe('Hill: aritmética de matrizes módulo 26', () => {
  it('calcula determinantes 2 x 2 e 3 x 3', () => {
    expect(determinant([[3, 3], [2, 5]])).toBe(9);
    expect(determinant([[6, 24, 1], [13, 16, 10], [20, 17, 15]])).toBe(441);
  });
  it('a inversa módulo 26 satisfaz K · K^-1 = I', () => {
    for (const k of [[[3, 3], [2, 5]], [[6, 24, 1], [13, 16, 10], [20, 17, 15]]] as Matrix[]) {
      const inv = inverseMod26(k);
      const prod = multiply(k, inv);
      expect(prod).toEqual(k.length === 2 ? [[1, 0], [0, 1]] : [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    }
  });
  it('rejeita matrizes sem inversa módulo 26 (det par ou múltiplo de 13)', () => {
    expect(isInvertibleMod26([[2, 0], [0, 1]])).toBe(false); // det = 2
    expect(isInvertibleMod26([[13, 0], [0, 1]])).toBe(false); // det = 13
    expect(() => inverseMod26([[2, 4], [1, 2]])).toThrow(/mdc\(0, 26\)|não é inversível/);
    expect(() => validateKey([[2, 0], [0, 1]])).toThrow(/não é inversível módulo 26/);
  });
  it('valida o formato e os elementos da chave', () => {
    expect(() => validateKey([[1]])).toThrow(/2 × 2 ou 3 × 3/);
    expect(() => validateKey([[1, 0], [0, 26]])).toThrow(/entre 0 e 25/);
    expect(() => validateKey([[1, 0], [0, 1.5]])).toThrow(/entre 0 e 25/);
  });
});

describe('Hill: cifragem e decifragem', () => {
  it('reproduz os exemplos clássicos: ACT com GYBNQKURP e HELP com a chave 3 3 2 5', () => {
    expect(hillEncrypt(keyFromWord('GYBNQKURP'), 'ACT')).toBe('POH');
    expect(hillDecrypt(keyFromWord('GYBNQKURP'), 'POH')).toBe('ACT');
    expect(hillEncrypt([[3, 3], [2, 5]], 'HELP')).toBe('HIAT');
    expect(hillDecrypt([[3, 3], [2, 5]], 'HIAT')).toBe('HELP');
  });
  it('completa o texto com X até um múltiplo do tamanho do bloco', () => {
    expect(hillPrepare('ABC', 2)).toBe('ABCX');
    expect(hillPrepare('ABCD', 2)).toBe('ABCD');
    expect(hillPrepare('AB', 3)).toBe('ABX');
  });
  it('mostra os blocos: plano e cifrado como vetores', () => {
    const b = hillEncryptBlocks([[3, 3], [2, 5]], 'HELP');
    expect(b[0]).toEqual({ plain: [7, 4], cipher: [7, 8] }); // HE -> HI
    expect(b[1]).toEqual({ plain: [11, 15], cipher: [0, 19] }); // LP -> AT
  });
  it('decifrar inverte cifrar para chaves aleatórias inversíveis', () => {
    const rnd = () => Number(randomBigIntBelow(26n));
    let tested = 0;
    for (let i = 0; i < 200 && tested < 20; i++) {
      const n = i % 2 === 0 ? 2 : 3;
      const k = Array.from({ length: n }, () => Array.from({ length: n }, rnd));
      if (!isInvertibleMod26(k)) continue;
      const plain = 'ATACAREMOSAFORTALEZAAOAMANHECERX';
      const prepared = hillPrepare(plain, n);
      expect(hillDecrypt(k, hillEncrypt(k, plain))).toBe(prepared);
      tested++;
    }
    expect(tested).toBe(20);
  });
  it('rejeita cifra de comprimento incompatível', () => {
    expect(() => hillDecrypt([[3, 3], [2, 5]], 'ABC')).toThrow(/múltiplo de 2/);
  });
  it('a chave pode vir de uma palavra de 4 ou 9 letras', () => {
    expect(keyFromWord('DDCF')).toEqual([[3, 3], [2, 5]]);
    expect(() => keyFromWord('ABCDE')).toThrow(CryptoInputError);
  });
});

describe('Hill: ataque de texto claro conhecido', () => {
  const texto = 'ATAQUE AO AMANHECER NA PONTE VELHA';
  it.each([
    ['2 x 2', [[3, 3], [2, 5]] as Matrix],
    ['3 x 3', keyFromWord('GYBNQKURP')],
  ])('recupera a chave %s exatamente a partir do início conhecido', (_n, key) => {
    const n = key.length;
    const cipher = hillEncrypt(key, texto);
    const known = normalizeText(texto).slice(0, 8 * n);
    const attack = knownPlaintextAttack(n, known, cipher);
    expect(attack).not.toBeNull();
    expect(attack!.key).toEqual(key);
    expect(attack!.consistentBlocks).toBe(attack!.totalBlocks); // reproduz todos os blocos conhecidos
    expect(hillDecrypt(attack!.key, cipher)).toBe(hillDecrypt(key, cipher));
  });
  it('funciona para chaves aleatórias inversíveis dos dois tamanhos', () => {
    const rnd = () => Number(randomBigIntBelow(26n));
    let tested = 0;
    for (let i = 0; i < 400 && tested < 20; i++) {
      const n = i % 2 === 0 ? 2 : 3;
      const k = Array.from({ length: n }, () => Array.from({ length: n }, rnd));
      if (!isInvertibleMod26(k)) continue;
      const cipher = hillEncrypt(k, texto);
      const attack = knownPlaintextAttack(n, normalizeText(texto).slice(0, 8 * n), cipher);
      if (attack) {
        expect(attack.key).toEqual(k);
        tested++;
      }
    }
    expect(tested).toBeGreaterThanOrEqual(15);
  });
  it('precisa de pelo menos n blocos (n² letras) de texto claro conhecido', () => {
    const key = [[3, 3], [2, 5]];
    const help = hillEncrypt(key, 'HELP');
    expect(knownPlaintextAttack(2, 'HE', help)).toBeNull(); // 1 bloco
    expect(knownPlaintextAttack(2, 'HEL', help)).toBeNull(); // 1 bloco completo
    expect(knownPlaintextAttack(2, 'HELP', help)?.key).toEqual(key); // 2 blocos independentes bastam
  });
  it('blocos dependentes (texto claro repetido) não bastam: o sistema não tem solução única', () => {
    const key = [[3, 3], [2, 5]];
    const cipher = hillEncrypt(key, 'ABABABABABAB');
    expect(knownPlaintextAttack(2, 'ABABABAB', cipher)).toBeNull();
  });
  it('escolhe outros blocos quando os primeiros são dependentes', () => {
    const key = [[3, 3], [2, 5]];
    const plain = 'ABABHELP';
    const attack = knownPlaintextAttack(2, plain, hillEncrypt(key, plain));
    expect(attack).not.toBeNull();
    expect(attack!.key).toEqual(key);
    expect(attack!.usedBlocks).not.toEqual([1, 2]);
  });
});
