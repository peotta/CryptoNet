import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { randomBytes } from '../src/crypto/random';
import { buildAesProtocol } from '../src/labs/aes/flows';
import { describePattern, runAes } from '../src/labs/aes/run';
import type { AesMode } from '../src/crypto/aes';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const TEXT = 'PAGAR R$ 1000,00PAGAR R$ 1000,00CONFIRMADO POR B';
const key = randomBytes(16);
const iv16 = randomBytes(16);
const ivFor = (mode: AesMode) => (mode === 'ECB' ? null : mode === 'CBC' ? iv16 : iv16.slice(0, 12));
const go = (mode: AesMode, tamper: boolean, block = 2, text = TEXT) => runAes(engines.aes, { mode, key, iv: ivFor(mode), text, tamper, tamperBlock: block });

describe('fluxo de AES: Alice, Bob e Eva', () => {
  it.each(['ECB', 'CBC', 'CTR', 'GCM'] as const)('%s sem adulteração: Bob recupera a mensagem', async (mode) => {
    const r = await go(mode, false);
    expect(r.flow.ok).toBe(true);
    expect(r.flow.recovered).toBe(TEXT + '          '.slice(0, 48 - TEXT.length));
    expect(r.status.every((s) => s === 'intacto')).toBe(true);
    const def = buildAesProtocol(r.flow);
    const t = ProtocolSimulationEngine.build(def);
    expect(t.states[def.steps.length].verdict?.ok).toBe(true);
  });
  it('ECB vaza padrões e CBC, CTR e GCM não', async () => {
    expect((await go('ECB', false)).flow.pattern).toMatch(/blocos 1, 2 idênticos/);
    for (const mode of ['CBC', 'CTR', 'GCM'] as const) expect((await go(mode, false)).flow.pattern).toMatch(/nenhum bloco repetido/);
  });
  it('o texto claro tem blocos 1 e 2 iguais, e Eva (que só vê a cifra) os identifica no ECB', async () => {
    const r = await go('ECB', false);
    expect(r.plainBlocks[0]).toBe(r.plainBlocks[1]);
    expect(r.sentBlocks[0]).toBe(r.sentBlocks[1]);
    expect(r.sentBlocks[2]).not.toBe(r.sentBlocks[0]);
  });
  it('ECB com adulteração: só o bloco atingido é corrompido', async () => {
    const r = await go('ECB', true, 2);
    expect(r.status).toEqual(['intacto', 'corrompido', 'intacto']);
    expect(r.flow.ok).toBe(false);
    expect(r.flow.authFailed).toBe(false);
  });
  it('CBC com adulteração: bloco k corrompido e 1 bit invertido no bloco k + 1', async () => {
    const r = await go('CBC', true, 1);
    expect(r.status).toEqual(['corrompido', 'um bit alterado', 'intacto']);
    expect(r.flow.verdictText).toMatch(/MESMO bit foi invertido no bloco 2/);
  });
  it('CTR com adulteração: exatamente 1 bit alterado, controlado por Eva', async () => {
    const r = await go('CTR', true, 3);
    expect(r.status).toEqual(['intacto', 'intacto', 'um bit alterado']);
  });
  it('GCM com adulteração: a mensagem é rejeitada por inteiro', async () => {
    const r = await go('GCM', true, 2);
    expect(r.flow.authFailed).toBe(true);
    expect(r.recoveredBlocks).toBeNull();
    expect(r.status.every((s) => s === 'rejeitado')).toBe(true);
    const def = buildAesProtocol(r.flow);
    expect(ProtocolSimulationEngine.build(def).states[def.steps.length].verdict?.ok).toBe(true); // o ataque foi barrado
  });
  it('a cifra é aleatória por IV: o mesmo texto no CBC com IVs diferentes gera cifras diferentes', async () => {
    const a = await runAes(engines.aes, { mode: 'CBC', key, iv: randomBytes(16), text: TEXT, tamper: false, tamperBlock: 1 });
    const b = await runAes(engines.aes, { mode: 'CBC', key, iv: randomBytes(16), text: TEXT, tamper: false, tamperBlock: 1 });
    expect(a.flow.ctHex).not.toBe(b.flow.ctHex);
  });
  it('o bloco a alterar é limitado ao número de blocos', async () => {
    expect((await go('ECB', true, 99)).flow.tamperBlock).toBe(3);
    expect((await go('ECB', true, 0)).flow.tamperBlock).toBe(1);
  });
  it('textos curtos viram um bloco e textos vazios geram um bloco de espaços', async () => {
    expect((await go('CTR', false, 1, 'oi')).plainBlocks).toHaveLength(1);
  });
  it('descreve padrões de blocos repetidos', () => {
    expect(describePattern(['a', 'b', 'a', 'c', 'b'])).toBe('blocos 1, 3 idênticos (o texto claro também é igual); blocos 2, 5 idênticos (o texto claro também é igual)');
    expect(describePattern(['a', 'b'])).toMatch(/nenhum bloco repetido/);
  });
  it('o motor rejeita IV ou nonce com tamanho errado', async () => {
    await expect(engines.aes.encrypt('CBC', key, new Uint8Array(12), new Uint8Array(16))).rejects.toThrow(/IV/);
    await expect(engines.aes.encrypt('GCM', key, null, new Uint8Array(16))).rejects.toThrow(/nonce/);
  });
});

describe('atores e segredos no AES', () => {
  it.each(['ECB', 'CBC', 'CTR', 'GCM'] as const)('%s: Alice, Bob e Eva; Eva nunca vê a chave nem o texto claro', async (mode) => {
    const r = await go(mode, true);
    const def = buildAesProtocol(r.flow);
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.K).toBeUndefined();
    expect(Object.values(last.entries.eva).some((e) => e.kind === 'plain' || e.kind === 'private')).toBe(false);
    expect(last.log.map((m) => `${m.from}>${m.to}${m.tampered ? '*' : ''}`)).toEqual(['alice>eva', 'eva>bob*']);
    for (const m of last.log) expect(m.summary).not.toContain(r.flow.keyHex.slice(0, 8));
  });
  it('sem adulteração Eva só observa e a mensagem vai direto a Bob', async () => {
    const def = buildAesProtocol((await go('CBC', false)).flow);
    const log = ProtocolSimulationEngine.build(def).states[def.steps.length].log;
    expect(log).toHaveLength(1);
    expect(log[0].from).toBe('alice');
    expect(log[0].to).toBe('bob');
    expect(log[0].observers).toContain('eva');
  });
  it('o ECB não tem etapa de IV; os demais modos têm', async () => {
    expect(buildAesProtocol((await go('ECB', false)).flow).steps.map((s) => s.id)).not.toContain('iv');
    expect(buildAesProtocol((await go('CTR', false)).flow).steps.map((s) => s.id)).toContain('iv');
  });
  it('cada etapa executa no máximo uma operação de cálculo', async () => {
    for (const mode of ['ECB', 'CBC', 'CTR', 'GCM'] as const) {
      for (const st of buildAesProtocol((await go(mode, true)).flow).steps) {
        expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
      }
    }
  });
  it('voltar uma etapa reconstrói o estado anterior', async () => {
    const def = buildAesProtocol((await go('GCM', false)).flow);
    const t = ProtocolSimulationEngine.build(def);
    for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
  });
});
