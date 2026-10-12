import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { toHex, utf8Encode } from '../src/crypto/encoding';
import { constantTimeEqual, type HashAlgo } from '../src/crypto/hash';
import { buildHmacProtocol, type HmacFlowData } from '../src/labs/hash-hmac/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

async function flow(message: string, tamper: boolean, algo: HashAlgo = 'SHA-256', key = 'segredo'): Promise<HmacFlowData> {
  const k = utf8Encode(key);
  const received = tamper ? `${message}!` : message;
  const sent = await engines.hash.hmac(algo, k, utf8Encode(message));
  const again = await engines.hash.hmac(algo, k, utf8Encode(received));
  return {
    algo,
    keyText: key,
    keyBytes: k.length,
    blockBytes: sent.trace.block,
    keyWasHashed: sent.trace.keyWasHashed,
    message,
    receivedMessage: received,
    innerHex: toHex(sent.trace.inner),
    tagHex: toHex(sent.trace.tag),
    recomputedHex: toHex(again.trace.tag),
    tampered: tamper,
    ok: constantTimeEqual(sent.trace.tag, again.trace.tag),
  };
}

describe('protocolo HMAC animado', () => {
  it('tem 9 etapas, com um cálculo por etapa', async () => {
    const def = buildHmacProtocol(await flow('olá', false));
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'inner', 'outer', 'transit', 'receive', 'recompute', 'compare']);
    for (const st of def.steps) expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
  });
  it('sem adulteração: as etiquetas coincidem e a mensagem é aceita', async () => {
    const def = buildHmacProtocol(await flow('olá', false));
    const t = ProtocolSimulationEngine.build(def);
    const last = t.states[def.steps.length];
    expect(last.verdict?.ok).toBe(true);
    expect(last.entries.bob.tag.value).toBe(last.entries.bob.tag2.value);
    expect(last.entries.bob.res.value).toMatch(/aceita/);
  });
  it('com adulteração: as etiquetas diferem e a mensagem é rejeitada', async () => {
    const def = buildHmacProtocol(await flow('Transferir R$ 100', true));
    const t = ProtocolSimulationEngine.build(def);
    const last = t.states[def.steps.length];
    expect(last.verdict?.ok).toBe(false);
    expect(last.entries.bob.tag.value).not.toBe(last.entries.bob.tag2.value);
    expect(last.log.filter((m) => m.tampered)).toHaveLength(1);
  });
  it('a chave K nunca atravessa o canal', async () => {
    const def = buildHmacProtocol(await flow('olá', false, 'SHA-256', 'chave-super-secreta'));
    const t = ProtocolSimulationEngine.build(def);
    for (const m of t.states[def.steps.length].log) {
      expect(m.summary).not.toContain('chave-super-secreta');
      expect(m.label).not.toContain('K');
    }
  });
  it('a etiqueta mostrada na animação é o HMAC real', async () => {
    const data = await flow('abc', false, 'SHA-256', 'Jefe');
    const t = ProtocolSimulationEngine.build(buildHmacProtocol(data));
    const shown = t.states[4].entries.alice.tag.value; // após a etapa 'outer'
    expect(shown.startsWith(data.tagHex.slice(0, 10))).toBe(true);
  });
  it('voltar uma etapa descarta os valores posteriores', async () => {
    const def = buildHmacProtocol(await flow('olá', false));
    const t = ProtocolSimulationEngine.build(def);
    expect(t.states[3].entries.alice.tag).toBeUndefined();
    expect(t.states[4].entries.alice.tag).toBeDefined();
    expect(ProtocolSimulationEngine.replay(def, 4)).toEqual(t.states[4]);
  });
  it('funciona com todas as funções hash', async () => {
    for (const algo of ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const) {
      const t = ProtocolSimulationEngine.build(buildHmacProtocol(await flow('x', false, algo)));
      expect(t.states[t.states.length - 1].verdict?.ok).toBe(true);
    }
  });
});

describe('HMAC: Eva como atacante entre Alice e Bob', () => {
  it('Eva participa com Alice e Bob e nunca conhece a chave K', async () => {
    const def = buildHmacProtocol(await flow('olá', true, 'SHA-256', 'chave-super-secreta'));
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.K).toBeUndefined();
    expect(JSON.stringify(last.entries.eva)).not.toContain('chave-super-secreta');
  });
  it('sem adulteração Eva só observa; com adulteração intercepta e reenvia', async () => {
    const calm = buildHmacProtocol(await flow('olá', false));
    const attack = buildHmacProtocol(await flow('olá', true));
    expect(calm.steps.map((s) => s.id)).not.toContain('intercept');
    expect(attack.steps.map((s) => s.id)).toEqual(['key', 'write', 'inner', 'outer', 'intercept', 'transit', 'receive', 'recompute', 'compare']);
    const log = ProtocolSimulationEngine.build(attack).states[attack.steps.length].log;
    expect(log.map((m) => `${m.from}>${m.to}${m.tampered ? '*' : ''}`)).toEqual(['alice>eva', 'eva>bob*']);
    const watch = ProtocolSimulationEngine.build(calm).states[calm.steps.length];
    expect(watch.entries.eva.m.value).toBe('olá');
    expect(watch.log[0].observers).toContain('eva');
  });
});
