import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import { normalizeText } from '../src/crypto/classical';
import { bombeAttack, bombeMenu, coreSequence, decryptWith, menuStats, permsFor, propagate, startLabel, MAX_VERIFIED_STOPS } from '../src/crypto/bombe';
import { enigmaRun, parsePlugs, type EnigmaConfig } from '../src/crypto/enigma';

const TEXT = normalizeText(
  'Relatório do tempo sem novidades. Nada a reportar nesta madrugada. Mantenha a posição até nova ordem. Aguardamos a confirmação do comando no horário combinado e seguiremos as instruções recebidas ontem à noite pelo rádio',
);
const PLUGS = 'AV BS CG DL FU HZ IN KM OW RX';
const cfg = (positions: string, plugs = PLUGS): EnigmaConfig => ({ rotors: ['I', 'II', 'III'], reflector: 'B', positions, rings: 'AAA', plugs });
const setup = (c: EnigmaConfig) => ({ rotors: c.rotors, reflector: c.reflector, rings: c.rings });
const identity = Array.from({ length: 26 }, (_, i) => i);

describe('menu da Bombe', () => {
  it('uma aresta por tecla do texto provável, ligando a letra clara à cifrada', () => {
    const cipher = enigmaRun(cfg('QDV'), TEXT).output;
    const edges = bombeMenu(cipher, 'RELATORIO', 0);
    expect(edges).toHaveLength(9);
    expect(edges[0]).toEqual({ plain: 'R', cipher: cipher[0], step: 1 });
    expect(edges[8].step).toBe(9);
  });
  it('conta letras, componentes e laços (ciclos independentes)', () => {
    // arestas A-B, B-C, C-A formam um laço
    const stats = menuStats([
      { plain: 'A', cipher: 'B', step: 1 },
      { plain: 'B', cipher: 'C', step: 2 },
      { plain: 'C', cipher: 'A', step: 3 },
      { plain: 'X', cipher: 'Y', step: 4 },
    ]);
    expect(stats.letters).toEqual(['A', 'B', 'C', 'X', 'Y']);
    expect(stats.components).toBe(2);
    expect(stats.loops).toBe(1);
    expect(['A', 'B', 'C']).toContain(stats.testLetter); // o maior componente
  });
  it('rejeita alinhamento impossível e textos inválidos', () => {
    const cipher = enigmaRun(cfg('QDV'), TEXT).output;
    expect(() => bombeMenu(cipher, TEXT.slice(0, 4), 0)).not.toThrow(); // posição correta
    expect(() => bombeMenu('ABCDEF', 'ABC', 0)).toThrow(/Alinhamento impossível/);
    expect(() => bombeMenu('ABCDEF', 'AB', 0)).toThrow(/ao menos 3/);
    expect(() => bombeMenu('ABCDEF', 'XYZW', 4)).toThrow(CryptoInputError);
  });
});

describe('núcleo da máquina e propagação', () => {
  it('a sequência de permutações do núcleo reproduz a Enigma completa', () => {
    const c = cfg('KLM', '');
    const cipher = enigmaRun(c, TEXT).output;
    expect(decryptWith(coreSequence(setup(c), 'KLM', TEXT.length), identity, cipher)).toBe(TEXT);
  });
  it('com os plugues certos a sequência também decifra', () => {
    const c = cfg('QDV');
    const S = [...identity];
    for (const [a, b] of parsePlugs(PLUGS)) {
      S[a.charCodeAt(0) - 65] = b.charCodeAt(0) - 65;
      S[b.charCodeAt(0) - 65] = a.charCodeAt(0) - 65;
    }
    expect(decryptWith(coreSequence(setup(c), 'QDV', TEXT.length), S, enigmaRun(c, TEXT).output)).toBe(TEXT);
  });
  it('na posição verdadeira e com o plugue verdadeiro não há contradição, e os plugues deduzidos são os verdadeiros', () => {
    const c = cfg('QDV');
    const cipher = enigmaRun(c, TEXT).output;
    const edges = bombeMenu(cipher, 'RELATORIODOTEMPO', 0);
    const stats = menuStats(edges);
    const perms = permsFor(setup(c), 'QDV', edges);
    const truth = new Map(parsePlugs(PLUGS).flatMap(([a, b]) => [[a, b], [b, a]] as [string, string][]));
    const p = propagate(edges, perms, stats.testLetter, truth.get(stats.testLetter) ?? stats.testLetter);
    expect(p.contradiction).toBe(false);
    p.steckers.forEach((y, a) => {
      if (y === -1) return;
      const letter = String.fromCharCode(65 + a);
      expect(String.fromCharCode(65 + y)).toBe(truth.get(letter) ?? letter);
    });
  });
  it('numa posição errada, as 26 hipóteses levam a contradição quando o menu tem laços', () => {
    const c = cfg('QDV');
    const edges = bombeMenu(enigmaRun(c, TEXT).output, 'RELATORIODOTEMPO', 0);
    const stats = menuStats(edges);
    const perms = permsFor(setup(c), 'AAA', edges);
    let survivors = 0;
    for (let x = 0; x < 26; x++) if (!propagate(edges, perms, stats.testLetter, String.fromCharCode(65 + x)).contradiction) survivors++;
    expect(stats.loops).toBeGreaterThanOrEqual(2);
    expect(survivors).toBe(0);
  });
  it('registra a dedução que causa o conflito', () => {
    const c = cfg('QDV');
    const edges = bombeMenu(enigmaRun(c, TEXT).output, 'RELATORIODOTEMPO', 0);
    const stats = menuStats(edges);
    const perms = permsFor(setup(c), 'AAA', edges);
    for (let x = 0; x < 26; x++) {
      const p = propagate(edges, perms, stats.testLetter, String.fromCharCode(65 + x), true);
      expect(p.contradiction).toBe(true);
      expect(p.conflict).not.toBeNull();
      expect(p.log[0]).toMatchObject({ step: 0, value: String.fromCharCode(65 + x) });
    }
  });
  it('valida as posições do inspetor', () => {
    const c = cfg('QDV');
    const edges = bombeMenu(enigmaRun(c, TEXT).output, 'RELATORIO', 0);
    expect(() => permsFor(setup(c), 'AB', edges)).toThrow(/3 letras/);
  });
  it('startLabel converte o índice em letras', () => {
    expect(startLabel(0)).toBe('AAA');
    expect(startLabel(17575)).toBe('ZZZ');
    expect(startLabel(26)).toBe('ABA');
  });
});

describe('o ataque completo', () => {
  it('com um menu de dois laços, sobra uma única parada, que recupera a mensagem e o painel inteiro', () => {
    const c = cfg('QDV');
    const cipher = enigmaRun(c, TEXT).output;
    const a = bombeAttack(setup(c), cipher, 'RELATORIODOTEMPO', 0);
    expect(a.stats.loops).toBeGreaterThanOrEqual(2);
    expect(a.result.tested).toBe(17576);
    expect(a.result.stops).toHaveLength(1);
    expect(a.result.rejected).toBe(17575);
    expect(a.tooMany).toBe(false);
    const best = a.verified[0];
    expect(best.stop.positions).toBe('QDV');
    expect(best.completion.plaintext).toBe(TEXT);
    expect(best.completion.plugs.split(' ').sort()).toEqual(parsePlugs(PLUGS).map((p) => p.join('')).sort());
  }, 60000);
  it('com um menu sem laços, há milhares de paradas falsas e Eva não consegue verificá-las', () => {
    const c = cfg('KLM');
    const cipher = enigmaRun(c, TEXT).output;
    const a = bombeAttack(setup(c), cipher, 'RELATORIO', 0);
    expect(a.stats.loops).toBe(0);
    expect(a.result.stops.length).toBeGreaterThan(MAX_VERIFIED_STOPS);
    expect(a.tooMany).toBe(true);
    expect(a.verified).toEqual([]);
    expect(a.result.stops.some((s) => s.positions === 'KLM')).toBe(true); // a verdadeira nunca é descartada
  }, 60000);
  it('uma posição errada do texto provável não deixa paradas', () => {
    const c = cfg('QDV');
    const cipher = enigmaRun(c, TEXT).output;
    const a = bombeAttack(setup(c), cipher, 'RELATORIODOTEMPO', 5);
    expect(a.result.stops.some((s) => s.positions === 'QDV')).toBe(false);
  }, 60000);
});
