import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import { ALPHABET, normalizeText } from '../src/crypto/classical';
import {
  crackSubstitution,
  frequencyGuess,
  IC_PORTUGUESE,
  IC_RANDOM,
  indexOfCoincidence,
  invertKey,
  percentCorrect,
  randomSubstitutionKey,
  substitutionDecrypt,
  substitutionEncrypt,
  SUBSTITUTION_KEY_SPACE,
  validateSubstitutionKey,
} from '../src/crypto/substitution';
import { randomBytes } from '../src/crypto/random';

const TEXTO_1 =
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens. Ninguém deve acender fogueiras durante a noite, porque a fumaça denunciaria a posição de todo o grupo ao inimigo que vigia a estrada principal. Se o plano der certo, ao meio dia a bandeira estará hasteada na torre mais alta.';
const TEXTO_2 =
  'O diretor da escola reuniu os professores na sala principal para discutir o calendário das provas do próximo semestre. Alguns colegas pediram mais tempo para corrigir os trabalhos, outros sugeriram que as avaliações fossem distribuídas em semanas diferentes, de modo que os alunos pudessem estudar com mais calma. Depois de uma longa conversa, ficou decidido que haveria uma reunião extra na sexta feira para fechar as datas e avisar as famílias por meio de um comunicado enviado pelo correio e também pela internet.';
const KEY_QWERTY = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const KEY_REVERSA = 'ZYXWVUTSRQPONMLKJIHGFEDCBA';

describe('chave da substituição simples', () => {
  it('aceita permutações de 26 letras (ignorando maiúsculas e minúsculas)', () => {
    expect(validateSubstitutionKey(KEY_QWERTY)).toBe(KEY_QWERTY);
    expect(validateSubstitutionKey(KEY_QWERTY.toLowerCase())).toBe(KEY_QWERTY);
  });
  it('rejeita tamanho errado, caracteres inválidos e letras repetidas', () => {
    expect(() => validateSubstitutionKey('ABC')).toThrow(/26 letras/);
    expect(() => validateSubstitutionKey(KEY_QWERTY + 'A')).toThrow(CryptoInputError);
    expect(() => validateSubstitutionKey('1'.repeat(26))).toThrow(/26 letras/);
    expect(() => validateSubstitutionKey('A'.repeat(26))).toThrow(/repetir/);
    expect(() => validateSubstitutionKey(KEY_QWERTY.replace('Q', 'W'))).toThrow(/repetir/);
  });
  it('o espaço de chaves é 26! = 403291461126605635584000000', () => {
    expect(SUBSTITUTION_KEY_SPACE).toBe(403291461126605635584000000n);
  });
  it('a chave sorteada é sempre uma permutação válida e varia entre sorteios', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const k = randomSubstitutionKey();
      expect(() => validateSubstitutionKey(k)).not.toThrow();
      keys.add(k);
    }
    expect(keys.size).toBeGreaterThan(45);
  });
  it('não usa Math.random para sortear a chave', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random não deve ser usado');
    };
    try {
      expect(() => randomSubstitutionKey()).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
  it('o embaralhamento cobre todas as posições (sem viés evidente na primeira letra)', () => {
    const first = new Set<string>();
    for (let i = 0; i < 600; i++) first.add(randomSubstitutionKey()[0]);
    expect(first.size).toBeGreaterThanOrEqual(24);
  });
});

describe('cifragem e decifragem', () => {
  it('cifra pela chave (A vira a primeira letra da chave)', () => {
    expect(substitutionEncrypt(KEY_QWERTY, 'ABC')).toBe('QWE');
    expect(substitutionEncrypt(KEY_REVERSA, 'ATAQUE')).toBe('ZGZJFV');
  });
  it('decifrar inverte cifrar para chaves sorteadas', () => {
    for (let i = 0; i < 20; i++) {
      const key = randomSubstitutionKey();
      expect(substitutionDecrypt(key, substitutionEncrypt(key, TEXTO_1))).toBe(normalizeText(TEXTO_1));
    }
  });
  it('a chave inversa desfaz a chave', () => {
    const key = randomSubstitutionKey();
    const inv = invertKey(key);
    expect(invertKey(inv)).toBe(key);
    for (let i = 0; i < 26; i++) expect(inv[ALPHABET.indexOf(key[i])]).toBe(ALPHABET[i]);
  });
  it('preserva o tamanho do texto e normaliza a entrada', () => {
    expect(substitutionEncrypt(KEY_QWERTY, 'Ação é São!')).toHaveLength(8);
  });
});

describe('índice de coincidência', () => {
  it('português fica perto de 0,074 e texto aleatório perto de 0,038', () => {
    expect(indexOfCoincidence(TEXTO_1)).toBeGreaterThan(0.065);
    expect(indexOfCoincidence(TEXTO_1)).toBeLessThan(0.09);
    const random = Array.from(randomBytes(3000), (b) => ALPHABET[b % 26]).join('');
    expect(Math.abs(indexOfCoincidence(random) - IC_RANDOM)).toBeLessThan(0.006);
    expect(IC_PORTUGUESE).toBeGreaterThan(IC_RANDOM);
  });
  it('a substituição NÃO altera o índice de coincidência', () => {
    const key = randomSubstitutionKey();
    expect(indexOfCoincidence(substitutionEncrypt(key, TEXTO_2))).toBeCloseTo(indexOfCoincidence(TEXTO_2), 12);
  });
  it('trata textos muito curtos', () => {
    expect(indexOfCoincidence('')).toBe(0);
    expect(indexOfCoincidence('A')).toBe(0);
    expect(indexOfCoincidence('AA')).toBe(1);
  });
});

describe('criptoanálise por frequência e bigramas', () => {
  it('o palpite só por frequência acerta cerca de metade das letras, e não todas', () => {
    const ct = substitutionEncrypt(KEY_QWERTY, TEXTO_1);
    const guess = frequencyGuess(ct);
    expect(new Set(guess).size).toBe(26); // é uma permutação
    const plain = [...ct].map((ch) => guess[ALPHABET.indexOf(ch)]).join('');
    const pct = percentCorrect(plain, normalizeText(TEXTO_1));
    expect(pct).toBeGreaterThan(25);
    expect(pct).toBeLessThan(75);
  });
  it.each([
    ['texto 1, chave QWERTY', TEXTO_1, KEY_QWERTY],
    ['texto 1, chave reversa', TEXTO_1, KEY_REVERSA],
    ['texto 2, chave QWERTY', TEXTO_2, KEY_QWERTY],
    ['texto 2, chave sorteada', TEXTO_2, randomSubstitutionKey()],
  ])('o refinamento recupera mais de 90%% das letras: %s', (_nome, texto, key) => {
    const plain = normalizeText(texto);
    const r = crackSubstitution(substitutionEncrypt(key, plain));
    const freq = percentCorrect(r.frequencyPlain, plain);
    const final = percentCorrect(r.refinedPlain, plain);
    expect(final).toBeGreaterThan(90);
    expect(final).toBeGreaterThan(freq + 30); // o refinamento supera muito a frequência isolada
    expect(r.refinedPlain).toHaveLength(plain.length);
    expect(new Set(r.refinedInverse).size).toBe(26);
  }, 30000);
  it('com poucas letras a criptoanálise falha, mas não quebra', () => {
    const plain = normalizeText('Atacar ao amanhecer');
    const r = crackSubstitution(substitutionEncrypt(KEY_QWERTY, plain));
    expect(r.refinedPlain).toHaveLength(plain.length);
    expect(percentCorrect(r.refinedPlain, plain)).toBeLessThan(100);
  });
  it('é determinística: o mesmo texto cifrado dá sempre o mesmo resultado', () => {
    const ct = substitutionEncrypt(KEY_QWERTY, TEXTO_2);
    expect(crackSubstitution(ct, 10).refinedInverse).toBe(crackSubstitution(ct, 10).refinedInverse);
  });
  it('calcula o percentual de letras corretas', () => {
    expect(percentCorrect('ABCD', 'ABCD')).toBe(100);
    expect(percentCorrect('ABCD', 'ABXX')).toBe(50);
    expect(percentCorrect('', '')).toBe(0);
  });
});
