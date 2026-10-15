import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { randomSubstitutionKey } from '../src/crypto/substitution';
import { buildTransProtocol, MAX_LETTERS, runTransposition, type TransMode } from '../src/labs/transposicao/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const TEXTO =
  'Atacaremos a fortaleza ao amanhecer sem avisar ninguém pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens.';

const go = (mode: TransMode, over: Partial<{ text: string; rails: number; keyword: string; subKey: string; tamper: boolean }> = {}) =>
  runTransposition(engines.classical, { mode, text: TEXTO, rails: 4, keyword: 'CHAVE', subKey: randomSubstitutionKey(), tamper: false, ...over });

describe('transposição: Alice, Bob e Eva', () => {
  it('cerca de trilhos: Bob recupera a mensagem e Eva a quebra', async () => {
    const r = await go('trilhos');
    expect(r.flow.recovered.replace(/ /g, '')).toBe(r.plainLetters);
    expect(r.flow.level).toBe('total');
    expect(r.flow.ok).toBe(false);
    expect(r.rails?.[0].rails).toBe(4);
    expect(r.flow.attackKeyText).toBe('4 trilhos');
    expect(r.flow.verdictText).toMatch(/Poucos trilhos/);
  });

  it('transposição colunar: Eva descobre a ordem das colunas', async () => {
    const r = await go('colunar');
    expect(r.flow.level).toBe('total');
    expect(r.flow.attackPct).toBe(100);
    expect(r.columns?.[0].columns).toBe(5);
    expect(r.flow.recovered.replace(/ /g, '')).toBe(r.plainLetters);
  }, 30000);

  it('colunar com mais de 8 colunas: Eva não tenta a busca exaustiva', async () => {
    const r = await go('colunar', { keyword: 'ABCDEFGHIJ' });
    expect(r.flow.level).toBe('nao-tentou');
    expect(r.columns).toBeNull();
    expect(r.flow.ok).toBe(true);
    expect(r.flow.attackResult).toMatch(/não tentou/);
    expect(r.flow.recovered.replace(/ /g, '')).toBe(r.plainLetters);
  });

  it('cifra produto: Bob recupera, e os ataques isolados falham contra o produto', async () => {
    const r = await go('produto', { keyword: 'CHAVE' });
    expect(r.flow.recovered.replace(/ /g, '')).toBe(r.plainLetters);
    expect(r.flow.compare).toHaveLength(4);
    expect(r.flow.compare[0].pct).toBe(100); // anagramação contra a transposição sozinha
    expect(r.flow.compare[1].pct).toBeGreaterThan(70); // frequência contra a substituição sozinha
    expect(r.flow.compare[2].pct).toBeLessThan(40);
    expect(r.flow.compare[3].pct).toBeLessThan(40);
    expect(r.flow.level).toBe('falha');
    expect(r.flow.ok).toBe(true);
    expect(r.flow.verdictText).toMatch(/Painvin/);
  }, 60000);

  it('a impressão digital distingue transposição de substituição', async () => {
    const t = await go('colunar', { keyword: 'LUA' });
    expect(t.flow.corrCipher).toBeGreaterThan(0.9);
    expect(t.flow.icCipher).toBeCloseTo(t.flow.icPlain, 10);
    expect(t.flow.readCipher).toBeLessThan(t.flow.readPlain - 0.5);
    expect(t.flow.fingerprint).toMatch(/é uma transposição/);
    const p = await go('produto', { keyword: 'LUA' });
    expect(p.flow.fingerprint).toMatch(/substituição e transposição combinadas/);
  }, 60000);

  it('as etapas seguem a ordem sem adulteração', async () => {
    const def = buildTransProtocol((await go('trilhos')).flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'transit', 'eva-fingerprint', 'eva-attack', 'receive', 'decrypt', 'result']);
  });

  it('com adulteração Eva intercepta, analisa, altera uma letra e reenvia', async () => {
    const r = await go('trilhos', { tamper: true });
    const def = buildTransProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'intercept', 'eva-fingerprint', 'eva-attack', 'transit', 'receive', 'decrypt', 'result']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.forged).toBeDefined();
    // só a letra atingida sai errada: a cifra de trilhos mapeia uma letra da cifra a uma do texto
    const a = r.flow.recovered.replace(/ /g, '');
    const b = r.plainLetters;
    expect([...a].filter((ch, i) => ch !== b[i])).toHaveLength(1);
  });

  it('Eva nunca possui a chave de Alice e Bob nem o texto claro verdadeiro antes de atacar', async () => {
    const r = await go('colunar', { keyword: 'ABCDEFGHIJ' });
    const def = buildTransProtocol(r.flow);
    const states = ProtocolSimulationEngine.build(def).states;
    const final = states[def.steps.length];
    expect(final.entries.eva.K).toBeUndefined();
    expect(final.entries.eva.P).toBeUndefined();
    expect(final.verdict?.ok).toBe(true);
  });

  it('a chave não atravessa o canal', async () => {
    const r = await go('colunar', { keyword: 'SEGREDO' });
    const def = buildTransProtocol(r.flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) expect(m.summary).not.toContain('SEGREDO');
  }, 30000);

  it('valida os parâmetros', async () => {
    await expect(go('trilhos', { text: '123' })).rejects.toThrow(/ao menos uma letra/);
    await expect(go('trilhos', { text: 'A'.repeat(MAX_LETTERS + 1) })).rejects.toThrow(/no máximo/);
    await expect(go('trilhos', { rails: 1 })).rejects.toThrow(/pelo menos 2 trilhos/);
    await expect(go('colunar', { keyword: 'A' })).rejects.toThrow(/pelo menos 2 letras/);
    await expect(go('produto', { subKey: 'ABC' })).rejects.toThrow();
  });
});
