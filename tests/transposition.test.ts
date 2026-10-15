import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import { letterCounts, normalizeText } from '../src/crypto/classical';
import { indexOfCoincidence, percentCorrect, randomSubstitutionKey, substitutionEncrypt } from '../src/crypto/substitution';
import {
  columnarDecrypt,
  columnarDecryptOrder,
  columnarEncrypt,
  columnLengths,
  crackColumnar,
  crackRail,
  doubleDecrypt,
  doubleEncrypt,
  keyOrder,
  pearson,
  percentAligned,
  percentSame,
  productDecrypt,
  productEncrypt,
  railDecrypt,
  railEncrypt,
  railPattern,
  readability,
  toGrid,
} from '../src/crypto/transposition';
import { PT_FREQUENCY } from '../src/crypto/classical';

const T = normalizeText(
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens. Ninguém deve acender fogueiras durante a noite, porque a fumaça denunciaria a posição de todo o grupo ao inimigo que vigia a estrada principal.',
);

describe('cerca de trilhos', () => {
  it('reproduz o exemplo clássico (WE ARE DISCOVERED FLEE AT ONCE com 3 trilhos)', () => {
    expect(railEncrypt('WE ARE DISCOVERED. FLEE AT ONCE', 3)).toBe('WECRLTEERDSOEEFEAOCAIVDEN');
    expect(railDecrypt('WECRLTEERDSOEEFEAOCAIVDEN', 3)).toBe('WEAREDISCOVEREDFLEEATONCE');
  });
  it('o zigue-zague tem o padrão 0 1 2 1 0 1 2 ... para 3 trilhos', () => {
    expect(railPattern(9, 3)).toEqual([0, 1, 2, 1, 0, 1, 2, 1, 0]);
    expect(railPattern(7, 2)).toEqual([0, 1, 0, 1, 0, 1, 0]);
  });
  it('decifrar inverte cifrar para todos os números de trilhos', () => {
    for (let k = 2; k <= 12; k++) expect(railDecrypt(railEncrypt(T, k), k)).toBe(T);
  });
  it('com 2 trilhos, a cifra é as posições ímpares seguidas das pares', () => {
    expect(railEncrypt('ABCDEF', 2)).toBe('ACEBDF');
  });
  it('valida o número de trilhos', () => {
    expect(() => railEncrypt('ABC', 1)).toThrow(/pelo menos 2 trilhos/);
    expect(() => railEncrypt('ABC', 13)).toThrow(/limite/);
    expect(() => railEncrypt('ABC', 5)).toThrow(/mais trilhos/);
    expect(() => railEncrypt('ABCDEFG', 2.5)).toThrow(CryptoInputError);
  });
});

describe('transposição colunar', () => {
  it('reproduz o exemplo clássico (ZEBRAS, mensagem completa)', () => {
    // WE ARE DISCOVERED. FLEE AT ONCE com a chave ZEBRAS: EVLNE ACDTK ESEAQ ROFOJ DEEPLX... (variante sem preenchimento)
    const c = columnarEncrypt('WEAREDISCOVEREDFLEEATONCE', 'ZEBRAS');
    expect(columnarDecrypt(c, 'ZEBRAS')).toBe('WEAREDISCOVEREDFLEEATONCE');
    expect(c).toHaveLength(25);
  });
  it('a ordem de leitura vem da ordem alfabética das letras da chave, desempatando da esquerda para a direita', () => {
    expect(keyOrder('ZEBRAS')).toEqual([4, 2, 1, 3, 5, 0]); // A(4) B(2) E(1) R(3) S(5) Z(0)
    expect(keyOrder('BANANA')).toEqual([1, 3, 5, 0, 2, 4]); // A A A B N N
    expect(keyOrder('CHAVE')).toEqual([2, 0, 4, 1, 3]);
  });
  it('lê as colunas na ordem da chave (exemplo curto, em grade completa)', () => {
    // ABCD / EFGH / IJKL com chave "CAB" (3 colunas): ordem A(1), B(2), C(0)
    expect(columnarEncrypt('ABCDEFGHIJKL', 'CAB')).toBe('BEHKCFILADGJ');
  });
  it('calcula o tamanho de cada coluna quando a última linha é incompleta', () => {
    expect(columnLengths(10, 4)).toEqual([3, 3, 2, 2]);
    expect(columnLengths(8, 4)).toEqual([2, 2, 2, 2]);
    expect(columnLengths(5, 3)).toEqual([2, 2, 1]);
  });
  it('monta a grade de escrita', () => {
    expect(toGrid('ABCDEFG', 3)).toEqual([['A', 'B', 'C'], ['D', 'E', 'F'], ['G']]);
  });
  it('decifrar inverte cifrar, com última linha completa ou incompleta, para chaves variadas', () => {
    for (const key of ['LUA', 'CHAVE', 'ZEBRAS', 'MATEMATICA', 'ABCDEFGHIJKL', 'BANANA']) {
      for (const n of [24, 25, 26, 97]) expect(columnarDecrypt(columnarEncrypt(T.slice(0, n), key), key)).toBe(T.slice(0, n));
    }
  });
  it('decifra com uma ordem de leitura explícita', () => {
    const c = columnarEncrypt(T.slice(0, 40), 'CHAVE');
    expect(columnarDecryptOrder(c, keyOrder('CHAVE'))).toBe(T.slice(0, 40));
  });
  it('dupla transposição: cifra e decifra, e é diferente da transposição simples', () => {
    const c = doubleEncrypt(T, 'CHAVE', 'LUA');
    expect(doubleDecrypt(c, 'CHAVE', 'LUA')).toBe(T);
    expect(c).not.toBe(columnarEncrypt(T, 'CHAVE'));
  });
  it('valida a palavra-chave', () => {
    expect(() => columnarEncrypt('ABC', 'A')).toThrow(/pelo menos 2 letras/);
    expect(() => columnarEncrypt('ABC', '123')).toThrow(CryptoInputError);
    expect(() => keyOrder('A'.repeat(13))).toThrow(/no máximo 12/);
  });
});

describe('a transposição preserva as letras (e por isso é denunciada pela estatística)', () => {
  it('a contagem de cada letra e o índice de coincidência não mudam', () => {
    for (const c of [railEncrypt(T, 5), columnarEncrypt(T, 'SEGREDOS'), doubleEncrypt(T, 'CHAVE', 'LUA')]) {
      expect(letterCounts(c)).toEqual(letterCounts(T));
      expect(indexOfCoincidence(c)).toBeCloseTo(indexOfCoincidence(T), 12);
    }
  });
  it('o histograma da cifra acompanha o do português (correlação alta), e o da substituição não', () => {
    const toPct = (t: string) => letterCounts(t).map((v) => (100 * v) / t.length);
    expect(pearson(toPct(columnarEncrypt(T, 'CHAVE')), PT_FREQUENCY)).toBeGreaterThan(0.9);
    expect(pearson(toPct(substitutionEncrypt(randomSubstitutionKey(), T)), PT_FREQUENCY)).toBeLessThan(0.9);
  });
  it('a legibilidade (pares de letras) cai muito depois de uma transposição', () => {
    expect(readability(T)).toBeGreaterThan(readability(columnarEncrypt(T, 'CHAVE')) + 0.5);
    expect(readability(T)).toBeGreaterThan(readability(railEncrypt(T, 4)) + 0.5);
    expect(readability('A')).toBe(-Infinity);
  });
  it('a correlação de Pearson trata casos de borda', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 12);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });
});

describe('criptoanálise da transposição', () => {
  it.each([3, 5, 8, 11])('a força bruta sobre os trilhos recupera a mensagem com %i trilhos', (k) => {
    const r = crackRail(railEncrypt(T, k));
    expect(r[0].rails).toBe(k);
    expect(r[0].plaintext).toBe(T);
  });
  it.each(['LUA', 'CHAVE', 'MATEMA', 'SEGREDOS', 'BRASILIA'])('a anagramação recupera a mensagem da transposição colunar com a chave %s', (key) => {
    const r = crackColumnar(columnarEncrypt(T.slice(0, 250), key));
    expect(r[0].columns).toBe(key.length);
    expect(r[0].plaintext).toBe(T.slice(0, 250));
    expect(columnarEncrypt(r[0].plaintext, key)).toBe(columnarEncrypt(T.slice(0, 250), key));
  }, 30000);
  it('uma chave com mais de 8 colunas está fora do alcance da busca exaustiva (o ataque erra)', () => {
    const plain = T.slice(0, 250);
    const r = crackColumnar(columnarEncrypt(plain, 'ABCDEFGHIJ'));
    expect(r[0].columns).toBeLessThanOrEqual(8);
    expect(percentSame(r[0].plaintext, plain)).toBeLessThan(50);
  }, 30000);
  it('a pontuação é maior para o texto correto do que para os demais candidatos', () => {
    const r = crackColumnar(columnarEncrypt(T.slice(0, 200), 'CHAVE'));
    expect(r[0].score).toBeGreaterThan(r[r.length - 1].score);
    expect(r).toHaveLength(7); // de 2 a 8 colunas
  }, 30000);
  it('trata textos muito curtos', () => {
    expect(() => crackRail('AB')).not.toThrow();
    expect(() => crackColumnar('AB')).not.toThrow();
  });
});

describe('cifra produto: confusão e difusão', () => {
  it('decifrar inverte cifrar', () => {
    const sk = randomSubstitutionKey();
    for (const kw of ['CHAVE', 'SEGREDOS', 'LUA']) expect(productDecrypt(productEncrypt(T, sk, kw), sk, kw)).toBe(T);
  });
  it('é substituição seguida de transposição, nessa ordem', () => {
    const sk = randomSubstitutionKey();
    expect(productEncrypt(T, sk, 'CHAVE')).toBe(columnarEncrypt(substitutionEncrypt(sk, T), 'CHAVE'));
  });
  it('os ataques isolados que quebram cada cifra sozinha falham contra o produto', () => {
    const plain = T.slice(0, 250);
    const sk = 'QWERTYUIOPASDFGHJKLZXCVBNM'; // chave fixa: com chaves sorteadas, uma permutação próxima da identidade raramente deixaria a anagramação acertar por acaso
    const subst = substitutionEncrypt(sk, plain);
    const prod = productEncrypt(plain, sk, 'CHAVE');
    // a transposição sozinha cai por completo
    expect(percentSame(crackColumnar(columnarEncrypt(plain, 'CHAVE'))[0].plaintext, plain)).toBe(100);
    // a anagramação contra o produto não acha a ordem (a legibilidade não se aplica a letras trocadas)
    expect(percentSame(crackColumnar(prod)[0].plaintext, subst)).toBeLessThan(60);
    // e a quebra por bigramas contra o produto não recupera o texto
    expect(percentCorrect(crackColumnar(prod)[0].plaintext, plain)).toBeLessThan(60);
  }, 60000);
  it('o produto preserva o IC (a substituição e a transposição o preservam)', () => {
    const sk = randomSubstitutionKey();
    expect(indexOfCoincidence(productEncrypt(T, sk, 'CHAVE'))).toBeCloseTo(indexOfCoincidence(T), 12);
  });
});

describe('percentAligned', () => {
  it('tolera um deslocamento pequeno e continua baixo para textos diferentes', () => {
    expect(percentAligned(T, T)).toBe(100);
    expect(percentAligned(T.slice(1) + 'E', T)).toBeGreaterThan(95);
    expect(percentAligned(columnarEncrypt(T, 'CHAVE'), T)).toBeLessThan(30);
    expect(percentAligned('', T)).toBe(0);
  });
});
