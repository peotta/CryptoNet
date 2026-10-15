import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { buildEcdhProtocol, buildEcdsaProtocol, buildRealProtocol, runEcdh, runEcdsa, runRealSignature } from '../src/labs/ecc/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const E = engines.ecc;
const M1 = 'PAGAR R$ 100 A BOB';
const M2 = 'PAGAR R$ 900 A BOB';
const last = (def: { steps: unknown[] } & Parameters<typeof ProtocolSimulationEngine.build>[0]) => ProtocolSimulationEngine.build(def).states[def.steps.length];

describe('ECDH na curva didática: Alice, Bob e Eva', () => {
  it('Alice e Bob chegam ao mesmo ponto, e Eva o obtém por força bruta (a curva é minúscula)', async () => {
    const r = await runEcdh(E, { a: 11n, b: 7n });
    expect(r.evaA).toBe(11n);
    expect(r.tries).toBe(11);
    expect(r.broken).toBe(true);
    expect(r.evaS).toEqual(r.S);
    const def = buildEcdhProtocol(r);
    expect(def.steps.map((s) => s.id)).toEqual(['params', 'alice-keygen', 'bob-keygen', 'send-a', 'send-b', 'alice-shared', 'bob-shared', 'eva-dlog', 'eva-shared', 'result']);
    const st = last(def);
    expect(st.verdict?.ok).toBe(false);
    expect(st.entries.eva.d.value).toBe('11');
    expect(st.entries.alice.S.value).toBe(st.entries.bob.S.value);
    expect(r.verdictText).toMatch(/rho de Pollard/);
  });
  it('antes do ataque Eva só conhece as chaves públicas; as privadas nunca atravessam o canal', async () => {
    const r = await runEcdh(E, { a: 5n, b: 13n });
    const def = buildEcdhProtocol(r);
    const states = ProtocolSimulationEngine.build(def).states;
    const before = states[def.steps.findIndex((s) => s.id === 'eva-dlog')];
    expect(before.entries.eva.d).toBeUndefined();
    expect(before.entries.eva.seen).toBeDefined();
    for (const m of states[def.steps.length].log) expect(['A', 'B']).toContain(m.label); // só as chaves públicas A e B trafegam
  });
  it('valida as chaves', async () => {
    await expect(runEcdh(E, { a: 0n, b: 3n })).rejects.toThrow(/entre 1 e 18/);
    await expect(runEcdh(E, { a: 3n, b: 19n })).rejects.toThrow(/entre 1 e 18/);
  });
});

describe('ECDSA na curva didática: Alice, Bob e Eva', () => {
  it('uso correto: Bob aceita e Eva não forja', async () => {
    const r = await runEcdsa(E, { d: 7n, k: 9n, m1: M1, m2: M2, reuse: false, tamper: false });
    expect(r.bobAccepts1).toBe(true);
    expect(r.ok).toBe(true);
    const def = buildEcdsaProtocol(r);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'hash1', 'sign1', 'send1', 'verify', 'result']);
    const st = last(def);
    expect(st.verdict?.ok).toBe(true);
    expect(st.entries.eva.d).toBeUndefined();
    expect(st.entries.eva.forged).toBeUndefined();
    expect(st.entries.bob.ok.value).toBe('aceita');
  });
  it('mensagem alterada por Eva: a verificação falha', async () => {
    const r = await runEcdsa(E, { d: 7n, k: 9n, m1: M1, m2: M2, reuse: false, tamper: true });
    expect(r.received1.startsWith('Q')).toBe(true);
    expect(r.bobAccepts1).toBe(false);
    const def = buildEcdsaProtocol(r);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'hash1', 'sign1', 'intercept', 'verify', 'result']);
    expect(last(def).entries.bob.ok.value).toBe('rejeitada');
    expect(r.verdictText).toMatch(/falhou/);
  });
  it('nonce reutilizado: Eva recupera k e d, forja uma assinatura e Bob a aceita', async () => {
    const r = await runEcdsa(E, { d: 7n, k: 9n, m1: M1, m2: M2, reuse: true, tamper: false });
    expect(r.recovered).toEqual({ k: 9n, d: 7n });
    expect(r.bobAcceptsForged).toBe(true);
    expect(r.ok).toBe(false);
    const def = buildEcdsaProtocol(r);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'hash1', 'sign1', 'send1', 'sign2', 'send2', 'eva-k', 'eva-d', 'eva-forge', 'send-forged', 'verify-forged', 'result']);
    const st = last(def);
    expect(st.verdict?.ok).toBe(false);
    expect(st.entries.eva.d.value).toBe('7');
    expect(st.entries.bob.ok.value).toMatch(/forjada/);
    expect(r.verdictText).toMatch(/PlayStation 3/);
  });
  it('Eva não sabe d nem k antes de comparar as assinaturas', async () => {
    const r = await runEcdsa(E, { d: 7n, k: 9n, m1: M1, m2: M2, reuse: true, tamper: false });
    const def = buildEcdsaProtocol(r);
    const before = ProtocolSimulationEngine.build(def).states[def.steps.findIndex((s) => s.id === 'eva-k')];
    expect(before.entries.eva.k).toBeUndefined();
    expect(before.entries.eva.d).toBeUndefined();
    expect(before.entries.eva.seen.value).toMatch(/repetido/);
  });
  it('valida as entradas', async () => {
    await expect(runEcdsa(E, { d: 0n, k: 9n, m1: M1, m2: M2, reuse: false, tamper: false })).rejects.toThrow(/entre 1 e 18/);
    await expect(runEcdsa(E, { d: 7n, k: 0n, m1: M1, m2: M2, reuse: false, tamper: false })).rejects.toThrow(/entre 1 e 18/);
    await expect(runEcdsa(E, { d: 7n, k: 9n, m1: '', m2: M2, reuse: false, tamper: false })).rejects.toThrow(/Digite a mensagem 1/);
    await expect(runEcdsa(E, { d: 7n, k: 9n, m1: M1, m2: M1, reuse: true, tamper: false })).rejects.toThrow(/mesmo hash reduzido/);
  });
});

describe('assinaturas reais: Alice, Bob e Eva', () => {
  it.each(['ECDSA-P256', 'Ed25519'] as const)('%s: aceita a mensagem original e rejeita a alterada por Eva', async (algo) => {
    if (!(await E.realSupported(algo))) return;
    const ok = await runRealSignature(E, { algo, message: 'Transferir R$ 100', tamper: false });
    expect(ok.run.valid).toBe(true);
    expect(ok.ok).toBe(true);
    const bad = await runRealSignature(E, { algo, message: 'Transferir R$ 100', tamper: true });
    expect(bad.run.valid).toBe(false);
    expect(bad.ok).toBe(true); // a defesa funcionou
    const def = buildRealProtocol(bad);
    expect(def.steps.map((s) => s.id)).toEqual(['keygen', 'send-pub', 'sign', 'intercept', 'verify', 'result']);
    const st = last(def);
    expect(st.entries.bob.ok.value).toBe('rejeitada');
    expect(st.verdict?.ok).toBe(true);
    expect(st.entries.alice.d.value).toBe('guardada em segredo');
  });
  it('a chave privada nunca atravessa o canal', async () => {
    const r = await runRealSignature(E, { algo: 'ECDSA-P256', message: 'x', tamper: false });
    const def = buildRealProtocol(r);
    for (const m of last(def).log) expect(m.summary).not.toContain('segredo');
  });
  it('valida a mensagem', async () => {
    await expect(runRealSignature(E, { algo: 'ECDSA-P256', message: '', tamper: false })).rejects.toThrow(/Digite a mensagem/);
    await expect(runRealSignature(E, { algo: 'ECDSA-P256', message: 'x'.repeat(201), tamper: false })).rejects.toThrow(/no máximo 200/);
  });
});
