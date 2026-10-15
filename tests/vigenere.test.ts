import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import { normalizeText } from '../src/crypto/classical';
import { indexOfCoincidence, percentCorrect } from '../src/crypto/substitution';
import {
  chooseKeyLength,
  columns,
  crackVigenere,
  friedmanEstimate,
  icByKeyLength,
  kasiski,
  MAX_KEY_LENGTH,
  minimalPeriod,
  recoverKey,
  validateVigenereKey,
  vigenereDecrypt,
  vigenereEncrypt,
} from '../src/crypto/vigenere';

const T1 =
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens. Ninguém deve acender fogueiras durante a noite, porque a fumaça denunciaria a posição de todo o grupo ao inimigo que vigia a estrada principal. Se o plano der certo, ao meio dia a bandeira estará hasteada na torre mais alta.';
const T2 =
  'O diretor da escola reuniu os professores na sala principal para discutir o calendário das provas do próximo semestre. Alguns colegas pediram mais tempo para corrigir os trabalhos, outros sugeriram que as avaliações fossem distribuídas em semanas diferentes, de modo que os alunos pudessem estudar com mais calma. Depois de uma longa conversa, ficou decidido que haveria uma reunião extra na sexta feira para fechar as datas e avisar as famílias por meio de um comunicado enviado pelo correio e também pela internet.';

describe('cifra de Vigenère', () => {
  it('reproduz o exemplo clássico (ATTACKATDAWN com a chave LEMON)', () => {
    expect(vigenereEncrypt('LEMON', 'ATTACK AT DAWN')).toBe('LXFOPVEFRNHR');
    expect(vigenereDecrypt('LEMON', 'LXFOPVEFRNHR')).toBe('ATTACKATDAWN');
  });
  it('a chave A não altera o texto, e uma chave de uma letra é um César', () => {
    expect(vigenereEncrypt('A', 'ATAQUE')).toBe('ATAQUE');
    expect(vigenereEncrypt('D', 'ATAQUE')).toBe('DWDTXH'); // César com k = 3
  });
  it('a mesma letra clara vira letras diferentes (polialfabética)', () => {
    const c = vigenereEncrypt('CHAVE', 'AAAAAAAAAA');
    expect(c).toBe('CHAVECHAVE');
    expect(new Set(c).size).toBe(5);
  });
  it('decifrar inverte cifrar para chaves de tamanhos variados', () => {
    for (const key of ['B', 'ZZ', 'CHAVE', 'CRIPTOGRAFIA', 'ABCDEFGHIJKLMNOPQRST']) {
      expect(vigenereDecrypt(key, vigenereEncrypt(key, T1))).toBe(normalizeText(T1));
    }
  });
  it('normaliza a chave e o texto (acentos, espaços, minúsculas)', () => {
    expect(vigenereEncrypt('Chávé', 'Ação é bom')).toBe(vigenereEncrypt('CHAVE', 'ACAOEBOM'));
  });
  it('valida a chave: vazia, sem letras e longa demais', () => {
    expect(() => validateVigenereKey('')).toThrow(CryptoInputError);
    expect(() => validateVigenereKey('123 !')).toThrow(/ao menos uma letra/);
    expect(() => validateVigenereKey('A'.repeat(MAX_KEY_LENGTH + 1))).toThrow(/no máximo/);
    expect(validateVigenereKey('A'.repeat(MAX_KEY_LENGTH))).toHaveLength(MAX_KEY_LENGTH);
  });
  it('separa o texto em colunas pelas posições', () => {
    expect(columns('ABCDEFG', 3)).toEqual(['ADG', 'BE', 'CF']);
    expect(columns('', 3)).toEqual(['', '', '']);
  });
  it('calcula o período mínimo da chave', () => {
    expect(minimalPeriod('CHAVE')).toBe(5);
    expect(minimalPeriod('ABAB')).toBe(2);
    expect(minimalPeriod('AAAA')).toBe(1);
  });
});

describe('índice de coincidência e Vigenère', () => {
  it('o IC do texto cifrado cai para perto do aleatório quando a chave é longa', () => {
    const plain = normalizeText(T1);
    const ic1 = indexOfCoincidence(vigenereEncrypt('A', plain));
    const ic12 = indexOfCoincidence(vigenereEncrypt('CRIPTOGRAFIA', plain));
    expect(ic1).toBeGreaterThan(0.07);
    expect(ic12).toBeLessThan(0.055);
    expect(ic12).toBeGreaterThan(0.036);
  });
  it('o IC médio das colunas tem um pico no tamanho verdadeiro da chave (e em seus múltiplos)', () => {
    const ct = vigenereEncrypt('SEGREDO', T1);
    const ics = icByKeyLength(ct, 16);
    expect(ics).toHaveLength(16);
    expect(ics[6]).toBeGreaterThan(0.065); // m = 7
    expect(ics[13]).toBeGreaterThan(0.06); // m = 14
    for (const m of [2, 3, 4, 5, 6, 8, 9, 10]) expect(ics[m - 1]).toBeLessThan(0.056);
  });
  it('escolhe o menor tamanho cujo IC é compatível com o português', () => {
    const ct = vigenereEncrypt('SEGREDO', T1);
    expect(chooseKeyLength(icByKeyLength(ct, 20))).toBe(7); // 14 também é alto, mas 7 é o menor
    expect(chooseKeyLength([0.04, 0.045, 0.04])).toBe(2); // sem pico claro: o máximo
  });
  it('a estimativa de Friedman é positiva e finita para um texto longo', () => {
    const f = friedmanEstimate(vigenereEncrypt('CHAVE', T1));
    expect(Number.isFinite(f)).toBe(true);
    expect(f).toBeGreaterThan(0);
  });
});

describe('teste de Kasiski', () => {
  it('encontra repetições cuja distância é múltiplo do tamanho da chave', () => {
    // "ATAQUE" aparece nas posições 1 e 16 (distância 15 = 3 x 5): a cifra com chave de 5 letras repete
    const plain = 'ATAQUEXYZWVUTSRATAQUEBCDEFGHIJKLMNOPQRSTUVWXYZATAQUE';
    const k = kasiski(vigenereEncrypt('CHAVE', plain));
    const rep = k.repetitions.find((r) => r.positions.includes(1) && r.positions.includes(16));
    expect(rep).toBeDefined();
    expect(rep!.distances[0]).toBe(15);
    expect(k.factorCounts[5 - 2]).toBeGreaterThan(0); // 5 divide a distância
    expect(k.rankedFactors).toContain(5);
  });
  it('em texto sem repetições, não há distâncias', () => {
    const k = kasiski('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(k.repetitions).toHaveLength(0);
    expect(k.factorCounts.every((c) => c === 0)).toBe(true);
  });
  it('as distâncias de cada repetição são consecutivas', () => {
    const k = kasiski('ABCXXABCYYABC');
    const r = k.repetitions.find((x) => x.sequence === 'ABC')!;
    expect(r.positions).toEqual([1, 6, 11]);
    expect(r.distances).toEqual([5, 5]);
  });
  it('o Kasiski sozinho pode ser ambíguo: fatores como 2 e 3 também dividem as distâncias', () => {
    const k = kasiski(vigenereEncrypt('CRIPTOGRAFIA', T1));
    expect(k.rankedFactors.slice(0, 6)).toContain(2);
  });
});

describe('criptoanálise completa', () => {
  const equivalent = (found: string, key: string) => found === key || found === key.repeat(Math.ceil(found.length / key.length)).slice(0, found.length) || key === found.slice(0, minimalPeriod(found));
  it.each([
    ['T1', T1, 'CHAVE'],
    ['T1', T1, 'SEGREDO'],
    ['T1', T1, 'CRIPTOGRAFIA'],
    ['T1', T1, 'MATEMATICA'],
    ['T2', T2, 'LIVRO'],
    ['T2', T2, 'SEGREDO'],
    ['T2', T2, 'MATEMATICA'],
  ])('recupera a chave e o texto: %s com a chave %s', (_n, texto, key) => {
    const plain = normalizeText(texto);
    const r = crackVigenere(vigenereEncrypt(key, plain));
    expect(equivalent(r.key, key)).toBe(true);
    expect(percentCorrect(r.plaintext, plain)).toBeGreaterThan(98);
    expect(r.keyLength).toBe(minimalPeriod(key));
    expect(r.columns).toHaveLength(r.keyLength);
  });
  it('as letras da chave vêm da análise de cada coluna', () => {
    const ct = vigenereEncrypt('CHAVE', T1);
    expect(recoverKey(ct, 5).map((c) => c.letter).join('')).toBe('CHAVE');
    // com o tamanho errado, a chave deduzida é lixo
    expect(recoverKey(ct, 4).map((c) => c.letter).join('')).not.toBe('CHAVE');
  });
  it('com texto curto, a criptoanálise não quebra, mas erra', () => {
    const plain = normalizeText('Atacar ao amanhecer');
    const r = crackVigenere(vigenereEncrypt('SEGREDO', plain));
    expect(r.plaintext).toHaveLength(plain.length);
    expect(percentCorrect(r.plaintext, plain)).toBeLessThan(100);
  });
  it('trata texto vazio sem lançar erro', () => {
    expect(() => crackVigenere('')).not.toThrow();
  });
});
