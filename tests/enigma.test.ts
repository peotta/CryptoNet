import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import {
  cribOffsets,
  enigmaEncrypt,
  enigmaRun,
  keySpace,
  parsePlugs,
  plugboardCombinations,
  REFLECTORS,
  ROTORS,
  stepRotors,
  validateConfig,
  type EnigmaConfig,
} from '../src/crypto/enigma';
import { randomBigIntBelow } from '../src/crypto/random';

const BASE: EnigmaConfig = { rotors: ['I', 'II', 'III'], reflector: 'B', positions: 'AAA', rings: 'AAA', plugs: '' };
const cfg = (over: Partial<EnigmaConfig> = {}): EnigmaConfig => ({ ...BASE, ...over });

describe('dados históricos dos rotores e refletores', () => {
  it('cada ligação é uma permutação das 26 letras', () => {
    for (const r of Object.values(ROTORS)) expect(new Set(r.wiring).size).toBe(26);
    for (const r of Object.values(REFLECTORS)) expect(new Set(r).size).toBe(26);
  });
  it('os refletores são involuções sem ponto fixo (nenhuma letra se liga a ela mesma)', () => {
    for (const r of Object.values(REFLECTORS)) {
      for (let i = 0; i < 26; i++) {
        const j = r.charCodeAt(i) - 65;
        expect(j).not.toBe(i);
        expect(r.charCodeAt(j) - 65).toBe(i);
      }
    }
  });
});

describe('vetores de verificação', () => {
  it('rotores I-II-III, refletor B, posições AAA: AAAAA vira BDZGO', () => {
    expect(enigmaEncrypt(BASE, 'AAAAA')).toBe('BDZGO');
  });
  it('rotores I-II-III, refletor B, posições AAA: HELLOWORLD vira ILBDAAMTAZ', () => {
    expect(enigmaEncrypt(BASE, 'HELLOWORLD')).toBe('ILBDAAMTAZ');
  });
  it('a tecla A, na posição AAA, sai como B: o caminho do sinal começa em A e termina em B', () => {
    const t = enigmaRun(BASE, 'A').trace[0];
    expect(t.path[0]).toBe('A');
    expect(t.path[9]).toBe('B');
    expect(t.path).toHaveLength(10);
  });
});

describe('avanço dos rotores', () => {
  it('o rotor da direita avança a cada tecla', () => {
    expect(enigmaRun(BASE, 'AAA').trace.map((t) => t.after)).toEqual(['AAB', 'AAC', 'AAD']);
  });
  it('o rotor do meio avança quando o da direita passa pelo entalhe (rotor III: V)', () => {
    const r = enigmaRun(cfg({ positions: 'AAU' }), 'AAA');
    expect(r.trace.map((t) => t.after)).toEqual(['AAV', 'ABW', 'ABX']);
    expect(r.trace[1].stepped).toEqual([false, true, true]);
  });
  it('passo duplo: ADU → ADV → AEW → BFX → BFY (o rotor do meio avança duas vezes seguidas)', () => {
    const r = enigmaRun(cfg({ positions: 'ADU' }), 'AAAA');
    expect(r.trace.map((t) => t.after)).toEqual(['ADV', 'AEW', 'BFX', 'BFY']);
    expect(r.trace[2].stepped).toEqual([true, true, true]);
  });
  it('stepRotors respeita o entalhe do rotor II (E) e do rotor I (Q)', () => {
    expect(stepRotors([0, 4, 5], ['I', 'II', 'III']).pos).toEqual([1, 5, 6]); // meio em E (entalhe do II): avança com o esquerdo
    expect(stepRotors([0, 0, 16], ['I', 'II', 'I']).pos).toEqual([0, 1, 17]); // direito em Q (entalhe do I): o meio avança
  });
});

describe('propriedades da Enigma', () => {
  const texto = 'RELATORIODOTEMPOSEMNOVIDADESNADAAREPORTARNESTAMADRUGADA';
  it('é recíproca: cifrar duas vezes com a mesma configuração devolve o texto', () => {
    for (const c of [BASE, cfg({ rotors: ['V', 'III', 'I'], reflector: 'C', positions: 'MCK', rings: 'BUX', plugs: 'AV BS CG DL FU HZ IN KM OW RX' })]) {
      expect(enigmaEncrypt(c, enigmaEncrypt(c, texto))).toBe(texto);
    }
  });
  it('nenhuma letra é cifrada em si mesma (consequência do refletor)', () => {
    const c = cfg({ positions: 'XQB', plugs: 'AB CD EF' });
    const cifra = enigmaEncrypt(c, texto);
    for (let i = 0; i < texto.length; i++) expect(cifra[i]).not.toBe(texto[i]);
  });
  it('a mesma letra vira letras diferentes (polialfabética): AAAAAAAAAA não repete', () => {
    const cifra = enigmaEncrypt(BASE, 'A'.repeat(26));
    expect(new Set(cifra).size).toBeGreaterThan(15);
  });
  it('configurações aleatórias válidas são sempre recíprocas e sem ponto fixo', () => {
    const rnd = (n: number) => Number(randomBigIntBelow(BigInt(n)));
    const letter = () => String.fromCharCode(65 + rnd(26));
    const all = ['I', 'II', 'III', 'IV', 'V'] as const;
    for (let i = 0; i < 25; i++) {
      const pool = [...all];
      const rotors = [0, 1, 2].map(() => pool.splice(rnd(pool.length), 1)[0]) as EnigmaConfig['rotors'];
      const c: EnigmaConfig = { rotors, reflector: rnd(2) ? 'B' : 'C', positions: letter() + letter() + letter(), rings: letter() + letter() + letter(), plugs: 'AB EF GH' };
      const cifra = enigmaEncrypt(c, texto);
      expect(enigmaEncrypt(c, cifra)).toBe(texto);
      expect([...cifra].some((ch, k) => ch === texto[k])).toBe(false);
    }
  });
  it('o painel de plugues, os anéis, os rotores e as posições mudam a cifra', () => {
    const base = enigmaEncrypt(BASE, texto);
    expect(enigmaEncrypt(cfg({ plugs: 'AB' }), texto)).not.toBe(base);
    expect(enigmaEncrypt(cfg({ rings: 'BAA' }), texto)).not.toBe(base);
    expect(enigmaEncrypt(cfg({ rings: 'AAB' }), texto)).not.toBe(base);
    expect(enigmaEncrypt(cfg({ rotors: ['II', 'I', 'III'] }), texto)).not.toBe(base);
    expect(enigmaEncrypt(cfg({ positions: 'AAB' }), texto)).not.toBe(base);
    expect(enigmaEncrypt(cfg({ reflector: 'C' }), texto)).not.toBe(base);
  });
  it('um plugue AB troca A e B na entrada e na saída', () => {
    const t = enigmaRun(cfg({ plugs: 'AB' }), 'A').trace[0];
    expect(t.path[1]).toBe('B'); // a tecla A entra como B depois do painel
    const noPlug = enigmaRun(BASE, 'B').trace[0];
    expect(t.path.slice(2, 9)).toEqual(noPlug.path.slice(2, 9));
  });
  it('o texto é normalizado (acentos, espaços e pontuação são descartados)', () => {
    expect(enigmaEncrypt(BASE, 'Ação, é bom!')).toBe(enigmaEncrypt(BASE, 'ACAOEBOM'));
  });
  it('o caminho do sinal tem os dez estágios e termina na lâmpada', () => {
    const t = enigmaRun(BASE, 'HELLO').trace;
    for (const k of t) {
      expect(k.path).toHaveLength(10);
      expect(k.path[0]).toBe(k.input);
      expect(k.path[9]).toBe(k.output);
    }
  });
});

describe('validação da configuração', () => {
  it('rejeita rotores repetidos, refletor inválido e posições ou anéis mal formados', () => {
    expect(() => validateConfig(cfg({ rotors: ['I', 'I', 'III'] }))).toThrow(/diferentes/);
    expect(() => validateConfig(cfg({ reflector: 'A' as 'B' }))).toThrow(/Refletor/);
    expect(() => validateConfig(cfg({ positions: 'AB' }))).toThrow(/3 letras/);
    expect(() => validateConfig(cfg({ rings: '123' }))).toThrow(/3 letras/);
  });
  it('rejeita plugues inválidos: letra repetida, par com a mesma letra, formato e excesso de pares', () => {
    expect(() => parsePlugs('AB AC')).toThrow(/mais de um par/);
    expect(() => parsePlugs('AA')).toThrow(/ela mesma/);
    expect(() => parsePlugs('ABC')).toThrow(/duas letras/);
    expect(() => parsePlugs('AB CD EF GH IJ KL MN OP QR ST UV')).toThrow(/no máximo 10/);
    expect(parsePlugs('AB CD EF GH IJ KL MN OP QR ST')).toHaveLength(10);
    expect(parsePlugs('')).toEqual([]);
    expect(parsePlugs('ab, cd')).toEqual([['A', 'B'], ['C', 'D']]);
  });
  it('a configuração inválida impede a cifragem', () => {
    expect(() => enigmaEncrypt(cfg({ rotors: ['I', 'II', 'II'] }), 'A')).toThrow(CryptoInputError);
  });
});

describe('espaço de chaves', () => {
  it('o painel com 10 pares tem 150.738.274.937.250 combinações', () => {
    expect(plugboardCombinations(10)).toBe(150738274937250n);
    expect(plugboardCombinations(0)).toBe(1n);
    expect(plugboardCombinations(1)).toBe(325n); // C(26, 2)
  });
  it('o total clássico, sem contar os anéis, é 158.962.555.217.826.360.000 (≈ 1,6 x 10^20)', () => {
    const k = keySpace(10);
    expect(k.rotorOrders).toBe(60n);
    expect(k.positions).toBe(17576n);
    expect(k.withoutRings).toBe(158962555217826360000n);
    expect(k.rings).toBe(676n); // o anel do rotor esquerdo é redundante
    expect(k.withRings).toBe(k.withoutRings * 676n);
  });
});

describe('texto provável (crib) e a fraqueza do refletor', () => {
  const msg = 'RELATORIODOTEMPOSEMNOVIDADESNADAAREPORTARNESTAMADRUGADAMANTENHAAPOSICAOATENOVAORDEM';
  const cifra = enigmaEncrypt(cfg({ positions: 'KLM', plugs: 'AV BS CG DL FU HZ IN KM OW RX' }), msg);

  it('descarta os alinhamentos em que uma letra do texto provável coincide com a da cifra', () => {
    const o = cribOffsets('ABCDE', 'XBZ');
    expect(o).toHaveLength(3);
    // deslocamento 0: o B do texto provável coincide com o B da cifra, o que a Enigma nunca produz
    expect(o[0]).toMatchObject({ offset: 0, possible: false, conflictAt: 1, conflictLetter: 'B' });
    expect(o[1]).toMatchObject({ offset: 1, possible: true, conflictAt: null });
    expect(o[2]).toMatchObject({ offset: 2, possible: true });
  });
  it('o alinhamento verdadeiro nunca é descartado, e outros são', () => {
    for (const crib of ['RELATORIO', 'NADAAREPORTAR', 'MADRUGADA', 'POSICAO']) {
      const verdadeiro = msg.indexOf(crib);
      expect(verdadeiro).toBeGreaterThanOrEqual(0);
      const o = cribOffsets(cifra, crib);
      expect(o).toHaveLength(msg.length - crib.length + 1);
      expect(o[verdadeiro].possible).toBe(true); // a propriedade garante: nenhuma letra cifra em si mesma
      expect(o.filter((x) => !x.possible).length).toBeGreaterThan(0);
    }
  });
  it('cribs mais longos eliminam proporcionalmente mais alinhamentos', () => {
    const frac = (crib: string) => {
      const o = cribOffsets(cifra, crib);
      return o.filter((x) => !x.possible).length / o.length;
    };
    expect(frac('RELATORIODOT')).toBeGreaterThan(frac('RE'));
  });
  it('o alinhamento possível mais frequente é o verdadeiro? não: restam vários, e Eva ainda precisa testá-los', () => {
    const o = cribOffsets(cifra, 'RELATORIO');
    expect(o.filter((x) => x.possible).length).toBeGreaterThan(1);
  });
  it('trata crib vazio ou maior que a cifra', () => {
    expect(cribOffsets('ABC', '')).toEqual([]);
    expect(cribOffsets('ABC', 'ABCDE')).toEqual([]);
  });
});
