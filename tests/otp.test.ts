import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import { normalizeText } from '../src/crypto/classical';
import { cribDrag, entropyBits, keyForTarget, letterDifference, otpDecrypt, otpEncrypt, possibleTexts, randomPad, validatePad } from '../src/crypto/otp';

const M1 = normalizeText(
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha.',
);
const M2 = normalizeText(
  'O diretor da escola reuniu os professores na sala principal para discutir o calendário das provas do próximo semestre. Alguns colegas pediram mais tempo para corrigir os trabalhos, outros sugeriram que as avaliações fossem distribuídas.',
);

describe('one-time pad: cifragem e decifragem', () => {
  it('reproduz o exemplo clássico: HELLO + XMCKL = EQNVZ', () => {
    expect(otpEncrypt('XMCKL', 'HELLO')).toBe('EQNVZ');
    expect(otpDecrypt('XMCKL', 'EQNVZ')).toBe('HELLO');
  });
  it('decifrar inverte cifrar com chaves aleatórias', () => {
    for (let i = 0; i < 30; i++) {
      const key = randomPad(M1.length);
      expect(otpDecrypt(key, otpEncrypt(key, M1))).toBe(M1);
    }
  });
  it('a chave A não altera o texto, e uma chave de uma letra repetida é um César', () => {
    expect(otpEncrypt('AAAAAA', 'ATAQUE')).toBe('ATAQUE');
    expect(otpEncrypt('DDDDDD', 'ATAQUE')).toBe('DWDTXH');
  });
  it('usa só a parte da chave de que precisa e ignora espaços e minúsculas na chave', () => {
    expect(otpEncrypt('x m c k l z z z', 'HELLO')).toBe('EQNVZ');
  });
  it('a chave deve ser tão longa quanto a mensagem: chave curta é rejeitada', () => {
    expect(() => otpEncrypt('ABC', 'ATAQUE')).toThrow(/tão longa quanto a mensagem/);
    expect(() => otpEncrypt('ABC', 'ATAQUE')).toThrow(/Vigenère/);
    expect(() => otpDecrypt('AB', 'CIFRA')).toThrow(CryptoInputError);
  });
  it('rejeita chaves com caracteres que não são letras', () => {
    expect(() => validatePad('AB1CD', 3)).toThrow(/somente letras/);
    expect(() => validatePad('', 1)).toThrow(CryptoInputError);
  });
  it('normaliza o texto da mensagem', () => {
    expect(otpEncrypt(randomPad(8), 'Ação é bom!')).toHaveLength(8);
  });
});

describe('chave aleatória', () => {
  it('tem o tamanho pedido, só letras, e varia entre sorteios', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const k = randomPad(30);
      expect(k).toMatch(/^[A-Z]{30}$/);
      keys.add(k);
    }
    expect(keys.size).toBe(40);
  });
  it('cobre todas as letras de forma aproximadamente uniforme (qui-quadrado dentro do esperado)', () => {
    const k = randomPad(5200); // esperado: 200 de cada letra
    const counts = new Array(26).fill(0);
    for (const ch of k) counts[ch.charCodeAt(0) - 65]++;
    const chi2 = counts.reduce((s, c) => s + (c - 200) ** 2 / 200, 0);
    expect(chi2).toBeLessThan(60); // 25 graus de liberdade: o limite de 0,01% é cerca de 52
  });
  it('não usa Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random não deve ser usado');
    };
    try {
      expect(() => randomPad(100)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
  it('rejeita tamanhos inválidos', () => {
    expect(() => randomPad(0)).toThrow(CryptoInputError);
    expect(() => randomPad(2.5)).toThrow(CryptoInputError);
  });
});

describe('sigilo perfeito', () => {
  it('para qualquer texto de mesmo tamanho existe uma chave que leva a cifra a ele', () => {
    const key = randomPad(M1.length);
    const cifra = otpEncrypt(key, M1);
    for (const alvo of [M1, M2.slice(0, M1.length), 'A'.repeat(M1.length), 'RECUAR'.repeat(100).slice(0, M1.length)]) {
      const k2 = keyForTarget(cifra, alvo);
      expect(otpDecrypt(k2, cifra)).toBe(alvo);
    }
    expect(keyForTarget(cifra, M1)).toBe(key); // o texto verdadeiro volta a chave verdadeira
  });
  it('exige o mesmo tamanho da cifra', () => {
    expect(() => keyForTarget('ABCDE', 'ABC')).toThrow(/exatamente 5 letras/);
  });
  it('a distribuição da cifra não depende do texto claro: A e Z geram cifras uniformes', () => {
    for (const p of ['A', 'Z']) {
      const counts = new Array(26).fill(0);
      for (let i = 0; i < 5200; i++) counts[otpEncrypt(randomPad(1), p).charCodeAt(0) - 65]++;
      const chi2 = counts.reduce((s, c) => s + (c - 200) ** 2 / 200, 0);
      expect(chi2).toBeLessThan(60);
    }
  });
  it('o IC da cifra fica perto do aleatório, mesmo que o texto seja português', () => {
    const cifra = otpEncrypt(randomPad(M1.length), M1);
    const counts = new Array(26).fill(0);
    for (const ch of cifra) counts[ch.charCodeAt(0) - 65]++;
    const n = cifra.length;
    const ic = counts.reduce((s, c) => s + c * (c - 1), 0) / (n * (n - 1));
    expect(ic).toBeLessThan(0.055);
  });
  it('calcula o número de textos possíveis (26^n) e a entropia', () => {
    expect(possibleTexts(1)).toBe(26n);
    expect(possibleTexts(5)).toBe(11881376n);
    expect(entropyBits(5)).toBeCloseTo(23.5, 1);
  });
  it('é maleável: somar d a uma letra da cifra soma d à mesma letra do texto claro (sem integridade)', () => {
    const key = randomPad(M1.length);
    const cifra = otpEncrypt(key, M1);
    const i = 20;
    const alterada = cifra.slice(0, i) + String.fromCharCode(65 + ((cifra.charCodeAt(i) - 65 + 3) % 26)) + cifra.slice(i + 1);
    const p2 = otpDecrypt(key, alterada);
    expect([...p2].filter((ch, k) => ch !== M1[k])).toHaveLength(1);
    expect(p2.charCodeAt(i) - 65).toBe((M1.charCodeAt(i) - 65 + 3) % 26);
  });
});

describe('reutilização da chave (two-time pad)', () => {
  const n = 120;
  const p1 = M1.slice(0, n);
  const p2 = M2.slice(0, n);
  const key = randomPad(n);
  const c1 = otpEncrypt(key, p1);
  const c2 = otpEncrypt(key, p2);

  it('a diferença das cifras é a diferença dos textos claros: a chave cancela', () => {
    const d = letterDifference(c1, c2);
    const esperado = [...p1].map((ch, i) => String.fromCharCode(65 + ((p2.charCodeAt(i) - ch.charCodeAt(0) + 26) % 26))).join('');
    expect(d).toBe(esperado);
    // e não depende da chave: outra chave dá a mesma diferença
    const k2 = randomPad(n);
    expect(letterDifference(otpEncrypt(k2, p1), otpEncrypt(k2, p2))).toBe(d);
  });
  it('com chaves independentes, a diferença das cifras NÃO revela a diferença dos textos', () => {
    const d = letterDifference(otpEncrypt(randomPad(n), p1), otpEncrypt(randomPad(n), p2));
    expect(d).not.toBe(letterDifference(c1, c2));
  });
  it.each(['AMANHECER', 'ATACAREMOS', 'FORTALEZA', 'NINGUEM'])('o arrasto do texto provável %s (em P1) coloca a posição verdadeira entre as melhores', (crib) => {
    const real = p1.indexOf(crib);
    expect(real).toBeGreaterThanOrEqual(0);
    const r = cribDrag(c1, c2, crib, true);
    const rank = r.findIndex((x) => x.offset === real) + 1;
    expect(rank).toBeLessThanOrEqual(2);
    const certo = r.find((x) => x.offset === real)!;
    expect(certo.fragment).toBe(p2.slice(real, real + crib.length)); // o fragmento da outra mensagem sai exato
    expect(certo.keyFragment).toBe(key.slice(real, real + crib.length)); // e o fragmento da chave também
  });
  it.each(['PROFESSORES', 'CALENDARIO', 'PRINCIPAL'])('o arrasto do texto provável %s (em P2) recupera o trecho de P1', (crib) => {
    const real = p2.indexOf(crib);
    expect(real).toBeGreaterThanOrEqual(0);
    const r = cribDrag(c1, c2, crib, false);
    expect(r.findIndex((x) => x.offset === real) + 1).toBeLessThanOrEqual(2);
    expect(r.find((x) => x.offset === real)!.fragment).toBe(p1.slice(real, real + crib.length));
  });
  it('o melhor alinhamento tem pontuação maior e fragmento mais legível que os demais', () => {
    const r = cribDrag(c1, c2, 'AMANHECER', true);
    expect(r[0].offset).toBe(p1.indexOf('AMANHECER'));
    expect(r[0].score).toBeGreaterThan(r[r.length - 1].score);
    expect(r).toHaveLength(n - 'AMANHECER'.length + 1);
  });
  it('com mensagens de tamanhos diferentes usa a região comum', () => {
    expect(letterDifference('ABCDEFG', 'BCD')).toHaveLength(3);
    expect(cribDrag('ABCDEFG', 'BCDEF', 'AB', true)).toHaveLength(4);
  });
  it('trata crib curto demais ou maior que as mensagens', () => {
    expect(cribDrag(c1, c2, 'A', true)).toEqual([]);
    expect(cribDrag('ABC', 'DEF', 'ABCDE', true)).toEqual([]);
  });
});
