import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { buildGrid } from '../src/crypto/playfair';
import { keyFromWord, type Matrix } from '../src/crypto/hill';
import { buildHillProtocol, runHill } from '../src/labs/playfair-hill/hillFlows';
import { buildPlayfairProtocol, runPlayfair } from '../src/labs/playfair-hill/playfairFlows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const TEXTO =
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens.';
const pf = (keyword = 'MONARQUIA', tamper = false, text = TEXTO) => runPlayfair(engines.classical, { keyword, text, tamper });
const hl = (key: Matrix = [[3, 3], [2, 5]], tamper = false, knownLetters = 24, text = 'Atacar a ponte ao amanhecer sem avisar ninguém pois a surpresa é a nossa melhor arma') =>
  runHill(engines.classical, { key, text, knownLetters, tamper });

describe('fluxo do Playfair: Alice, Bob e Eva', () => {
  it('monta a grade, cifra e Bob recupera a mensagem (com os X da preparação)', async () => {
    const r = await pf();
    expect(r.grid).toBe(buildGrid('MONARQUIA'));
    expect(r.grid).toBe('MONARQUIBCDEFGHKLPSTVWXYZ');
    expect(r.cipherLetters.length % 2).toBe(0);
    expect(r.flow.recovered.replace(/ /g, '')).toBe(r.plainLetters);
    for (let i = 0; i < r.cipherLetters.length; i++) expect(r.cipherLetters[i]).not.toBe(r.plainLetters[i]); // nenhuma letra cifra em si mesma
  });
  it('o IC da cifra cai em relação ao do texto claro, e não há digrafos de letras iguais', async () => {
    const r = await pf();
    expect(r.flow.icCipher).toBeLessThan(r.flow.icPlain);
    expect(r.flow.icCipher).toBeLessThan(0.065); // bem abaixo do português (cerca de 0,0745)
    for (let i = 0; i < r.cipherLetters.length; i += 2) expect(r.cipherLetters[i]).not.toBe(r.cipherLetters[i + 1]);
  });
  it('as etapas seguem a ordem, com uma etapa de estatísticas de Eva', async () => {
    const def = buildPlayfairProtocol((await pf()).flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'transit', 'eva-stats', 'receive', 'decrypt', 'result']);
  });
  it('Eva vê as estatísticas, mas não obtém a chave nem o texto claro', async () => {
    const def = buildPlayfairProtocol((await pf()).flow);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.S.value).toMatch(/IC = /);
    expect(last.entries.eva.K).toBeUndefined();
    expect(Object.values(last.entries.eva).some((e) => e.kind === 'plain' || e.kind === 'secret')).toBe(false);
    expect(last.verdict?.ok).toBe(true); // Eva não leu a mensagem com a frequência de letras
    expect(last.verdict?.text).toMatch(/não é seguro/);
  });
  it('a chave nunca atravessa o canal', async () => {
    const def = buildPlayfairProtocol((await pf()).flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) expect(m.summary).not.toContain('MONARQUIA');
  });
  it('com adulteração, Eva intercepta e reenvia uma letra alterada, e Bob não percebe', async () => {
    const r = await pf('MONARQUIA', true);
    const def = buildPlayfairProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'intercept', 'eva-stats', 'transit', 'receive', 'decrypt', 'result']);
    const log = ProtocolSimulationEngine.build(def).states[def.steps.length].log;
    expect(log.map((m) => `${m.from}>${m.to}${m.tampered ? '*' : ''}`)).toEqual(['alice>eva', 'eva>bob*']);
    expect(r.flow.recovered.replace(/ /g, '')).not.toBe(r.plainLetters);
    expect(r.flow.verdictText).toMatch(/Bob decifrou a mensagem alterada sem perceber/);
  });
  it('cada etapa executa no máximo uma operação de cálculo, e avançar e voltar é consistente', async () => {
    for (const tamper of [false, true]) {
      const def = buildPlayfairProtocol((await pf('CRIPTOGRAFIA', tamper)).flow);
      for (const st of def.steps) expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
      const t = ProtocolSimulationEngine.build(def);
      for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
    }
  });
  it('Alice, Bob e Eva são os atores, e Eva é a adversária', async () => {
    const def = buildPlayfairProtocol((await pf()).flow);
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    expect(def.parties.filter((p) => p.adversary).map((p) => p.name)).toEqual(['Eva']);
  });
  it('valida palavra-chave e texto', async () => {
    await expect(pf('')).rejects.toThrow(/palavra-chave/);
    await expect(pf('123')).rejects.toThrow(/palavra-chave/);
    await expect(pf('A'.repeat(26))).rejects.toThrow(/no máximo 25/);
    await expect(pf('MONARQUIA', false, '!!!')).rejects.toThrow(/ao menos uma letra/);
    await expect(pf('MONARQUIA', false, 'A'.repeat(1501))).rejects.toThrow(/no máximo/);
  });
});

describe('fluxo do Hill: Alice, Bob e Eva', () => {
  it('2 x 2: Bob recupera a mensagem e Eva obtém a chave exata com 24 letras conhecidas', async () => {
    const r = await hl();
    expect(r.flow.recovered.replace(/ /g, '')).toBe(r.prepared);
    expect(r.flow.success).toBe(true);
    expect(r.flow.attackKeyText).toBe('[3 3; 2 5]');
    expect(r.flow.keyText).toBe('[3 3; 2 5]');
    expect(r.flow.ok).toBe(false); // a cifra foi quebrada
    expect(r.flow.verdictText).toMatch(/K = C · P⁻¹/);
    expect(r.system).not.toBeNull();
  });
  it('3 x 3: o ataque também recupera a chave', async () => {
    const r = await hl(keyFromWord('GYBNQKURP'), false, 27);
    expect(r.flow.success).toBe(true);
    expect(r.flow.attackKeyText).toBe('[6 24 1; 13 16 10; 20 17 15]');
  });
  it('as etapas seguem a ordem, com a etapa de ataque de Eva', async () => {
    const def = buildHillProtocol((await hl()).flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'transit', 'eva-attack', 'receive', 'decrypt', 'result']);
  });
  it('Eva só tem a chave depois da etapa de ataque, e passa a conhecer o início do texto', async () => {
    const def = buildHillProtocol((await hl()).flow);
    const t = ProtocolSimulationEngine.build(def);
    const i = def.steps.findIndex((s) => s.id === 'eva-attack');
    expect(t.states[i].entries.eva.K).toBeUndefined();
    expect(t.states[i + 1].entries.eva.K.value).toBe('[3 3; 2 5]');
    expect(t.states[i + 1].entries.eva.known.value).toMatch(/^ATACA/);
  });
  it('com poucas letras conhecidas (menos de n²), Eva não consegue, e o motivo é explicado', async () => {
    const r = await hl([[3, 3], [2, 5]], false, 2);
    expect(r.attack).toBeNull();
    expect(r.flow.success).toBe(false);
    expect(r.flow.failureReason).toMatch(/Eva conhece só 2 letras/);
    expect(r.flow.ok).toBe(true);
    const def = buildHillProtocol(r.flow);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.K).toBeUndefined();
  });
  it('com blocos dependentes, Eva precisa de mais texto claro conhecido', async () => {
    const texto = 'ABABHELPATACAREMOSAPONTE';
    const r = await hl([[3, 3], [2, 5]], false, 4, texto); // AB e AB: o mesmo bloco duas vezes
    expect(r.attack).toBeNull();
    expect(r.flow.failureReason).toMatch(/dependentes/);
    const more = await hl([[3, 3], [2, 5]], false, 8, texto); // acrescentando HE e LP há blocos independentes
    expect(more.flow.success).toBe(true);
  });
  it('com adulteração, Eva intercepta e reenvia, e Bob decifra um bloco inteiro errado', async () => {
    const r = await hl([[3, 3], [2, 5]], true);
    const def = buildHillProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'intercept', 'eva-attack', 'transit', 'receive', 'decrypt', 'result']);
    const log = ProtocolSimulationEngine.build(def).states[def.steps.length].log;
    expect(log.map((m) => `${m.from}>${m.to}${m.tampered ? '*' : ''}`)).toEqual(['alice>eva', 'eva>bob*']);
    const a = r.prepared;
    const b = r.flow.recovered.replace(/ /g, '');
    const diff = [...a].filter((ch, i) => ch !== b[i]).length;
    expect(diff).toBeGreaterThanOrEqual(1);
    expect(diff).toBeLessThanOrEqual(2); // o bloco de 2 letras atingido
    expect(r.flow.verdictText).toMatch(/Bob decifrou a mensagem alterada sem perceber/);
  });
  it('a chave nunca atravessa o canal', async () => {
    const def = buildHillProtocol((await hl()).flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) expect(m.summary).not.toContain('3 3; 2 5');
  });
  it('cada etapa executa no máximo uma operação de cálculo, e avançar e voltar é consistente', async () => {
    for (const tamper of [false, true]) {
      const def = buildHillProtocol((await hl([[3, 3], [2, 5]], tamper)).flow);
      for (const st of def.steps) expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
      const t = ProtocolSimulationEngine.build(def);
      for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
    }
  });
  it('Alice, Bob e Eva são os atores, e Eva é a adversária', async () => {
    const def = buildHillProtocol((await hl()).flow);
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    expect(def.parties.filter((p) => p.adversary).map((p) => p.name)).toEqual(['Eva']);
  });
  it('valida chave não inversível e texto', async () => {
    await expect(hl([[2, 0], [0, 1]])).rejects.toThrow(/não é inversível módulo 26/);
    await expect(hl([[3, 3], [2, 5]], false, 24, '123')).rejects.toThrow(/ao menos uma letra/);
    await expect(hl([[3, 3], [2, 5]], false, 24, 'A'.repeat(1501))).rejects.toThrow(/no máximo/);
  });
});
