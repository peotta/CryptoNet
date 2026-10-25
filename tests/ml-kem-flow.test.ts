import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { DEFAULT_LWE } from '../src/crypto/lwe';
import { ML_KEM_1024, ML_KEM_512, ML_KEM_768 } from '../src/crypto/mlkem';
import { buildLweProtocol, buildMlKemProtocol, runLwe, runMlKem } from '../src/labs/ml-kem/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed * 17 + (i >> 3)) & 0xff);
const input = (params = ML_KEM_768, tamper = false) => ({ params, d: bytes(32, 1), z: bytes(32, 2), m: bytes(32, 3), tamper });
const last = (def: Parameters<typeof ProtocolSimulationEngine.build>[0]) => ProtocolSimulationEngine.build(def).states[def.steps.length];

describe('ML-KEM: Alice, Bob e Eva', () => {
  it('fluxo normal: as chaves coincidem e Eva só vê ek e c', async () => {
    const f = await runMlKem(engines.mlkem, input());
    expect(f.keysMatch).toBe(true);
    expect(f.dec.valid).toBe(true);
    expect(f.maxNoise).not.toBeNull();
    expect(f.maxNoise!).toBeLessThan(f.noiseLimit);
    const def = buildMlKemProtocol(f);
    expect(def.steps.map((s) => s.id)).toEqual([
      'params', 'alice-seeds', 'alice-g', 'alice-matrix', 'alice-s', 'alice-e', 'alice-t', 'alice-pack', 'send-ek', 'bob-check', 'bob-m', 'bob-g', 'bob-noise', 'bob-u', 'bob-v', 'bob-c', 'send-c',
      'alice-dec', 'alice-g', 'alice-reenc', 'alice-key', 'result',
    ]);
    const st = last(def);
    expect(st.verdict?.ok).toBe(true);
    expect(st.entries.alice.K.value).toBe(st.entries.bob.K.value);
    expect(st.entries.eva.K).toBeUndefined(); // Eva nunca obtém a chave
    expect(st.entries.eva.seen).toBeDefined();
    expect(st.log.map((m) => m.label)).toEqual(['ek', 'c']);
    for (const m of st.log) expect(m.observers).toContain('eva');
  });

  it('cada etapa faz no máximo uma operação de cálculo (passo a passo)', async () => {
    for (const tamper of [false, true]) {
      const def = buildMlKemProtocol(await runMlKem(engines.mlkem, input(ML_KEM_768, tamper)));
      for (const s of def.steps) expect(s.events.filter((e) => e.type === 'compute').length, s.id).toBeLessThanOrEqual(1);
    }
  });

  it('com Eva adulterando um bit: rejeição implícita, chaves diferentes e nenhum erro', async () => {
    const f = await runMlKem(engines.mlkem, input(ML_KEM_768, true));
    expect(f.keysMatch).toBe(false);
    expect(f.dec.valid).toBe(false);
    expect(f.maxNoise).toBeNull();
    expect(f.flipped).toEqual({ byte: 5, bit: 0 });
    const def = buildMlKemProtocol(f);
    expect(def.steps.map((s) => s.id)).toContain('intercept');
    expect(def.steps.map((s) => s.id)).not.toContain('send-c');
    const st = last(def);
    expect(st.verdict?.ok).toBe(true); // a defesa funcionou
    expect(st.entries.alice.K.value).not.toBe(st.entries.bob.K.value);
    expect(st.entries.eva.K).toBeUndefined();
    const tampered = st.log.filter((m) => m.tampered);
    expect(tampered).toHaveLength(1);
    expect(tampered[0].from).toBe('eva');
    expect(tampered[0].to).toBe('alice');
    expect(f.verdictText).toMatch(/rejeição|K̄/);
  });

  it.each([ML_KEM_512, ML_KEM_768, ML_KEM_1024])('funciona com $name', async (p) => {
    const f = await runMlKem(engines.mlkem, input(p));
    expect(f.keysMatch).toBe(true);
    expect(f.enc.c.length).toBe(32 * (p.du * p.k + p.dv));
  });

  it('valida o tamanho das sementes', async () => {
    await expect(runMlKem(engines.mlkem, { ...input(), d: new Uint8Array(31) })).rejects.toThrow(/32 bytes/);
    await expect(runMlKem(engines.mlkem, { ...input(), m: new Uint8Array(33) })).rejects.toThrow(/32 bytes/);
  });

  it('as chaves privadas e a semente secreta não aparecem em nenhuma mensagem', async () => {
    const f = await runMlKem(engines.mlkem, input());
    const st = last(buildMlKemProtocol(f));
    const text = JSON.stringify(st.log);
    expect(text).not.toContain('Segredo');
    for (const m of st.log) expect(['ek', 'c']).toContain(m.label);
  });
});

describe('LWE didático: Alice, Bob e Eva', () => {
  const base = { params: DEFAULT_LWE, seed: 7, rSeed: 1007, bit: 1 as const };

  it('com ruído, a álgebra falha e a força bruta vence (n minúsculo)', async () => {
    const f = await runLwe(engines.lwe, base);
    expect(f.dec.bit).toBe(1);
    expect(f.gauss.correct).toBe(false);
    expect(f.brute.correct).toBe(true);
    expect(f.evaBit).toBe(1);
    expect(f.broken).toBe(true);
    const def = buildLweProtocol(f);
    expect(def.steps.map((s) => s.id)).toEqual(['params', 'alice-secret', 'alice-matrix', 'alice-noise', 'alice-b', 'send-pub', 'bob-r', 'bob-u', 'bob-v', 'send-ct', 'alice-dec', 'eva-gauss', 'eva-brute', 'eva-read', 'result']);
    const st = last(def);
    expect(st.entries.eva.s.value).toBe(`(${f.keys.s.join(', ')})`);
    expect(st.entries.eva.bit.value).toBe('1');
    expect(st.entries.alice.bit.value).toBe('1');
    expect(st.log.map((m) => m.label)).toEqual(['(A, b)', '(u, v)']);
  });

  it('sem ruído, a eliminação de Gauss basta', async () => {
    const f = await runLwe(engines.lwe, { ...base, params: { ...DEFAULT_LWE, noise: 0 } });
    expect(f.gauss.correct).toBe(true);
    expect(f.keys.e.every((x) => x === 0)).toBe(true);
    expect(f.verdictText).toMatch(/Sem ruído/);
  });

  it('decifra os dois bits e valida os parâmetros', async () => {
    for (const bit of [0, 1] as const) expect((await runLwe(engines.lwe, { ...base, bit })).dec.bit).toBe(bit);
    await expect(runLwe(engines.lwe, { ...base, params: { ...DEFAULT_LWE, n: 9 } })).rejects.toThrow(/entre 2 e 3/);
    await expect(runLwe(engines.lwe, { ...base, seed: 0 })).rejects.toThrow(/semente/);
  });

  it('cada etapa tem no máximo uma operação de cálculo', async () => {
    const def = buildLweProtocol(await runLwe(engines.lwe, base));
    for (const s of def.steps) expect(s.events.filter((e) => e.type === 'compute').length, s.id).toBeLessThanOrEqual(1);
  });
});
