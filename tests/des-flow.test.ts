import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { randomBytes } from '../src/crypto/random';
import { buildBruteProtocol, buildDesProtocol, buildTdesProtocol, humanTime, MAX_BYTES, runBrute, runDes, runTdes } from '../src/labs/des/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const MSG = 'PAGAR R$ 1000,00 PARA BOB E CONFIRMAR';

const cbc = (over: Partial<{ text: string; tamper: boolean; tamperBlock: number }> = {}) =>
  runDes(engines.des, { key: randomBytes(8), iv: randomBytes(8), text: MSG, tamper: false, tamperBlock: 1, ...over });
const brute = (over: Partial<{ text: string; unknownBits: number; secret: number }> = {}) =>
  runBrute(engines.des, { baseKey: randomBytes(8), iv: randomBytes(8), text: 'MENSAGEM SECRETA DE ALICE', unknownBits: 10, secret: 500, ...over });
const tdes = (keying: 'tres' | 'duas' | 'igual') =>
  runTdes(engines.des, { k1: randomBytes(8), k2: randomBytes(8), k3: randomBytes(8), iv: randomBytes(8), text: MSG, keying });

describe('DES em CBC: Alice, Bob e Eva', () => {
  it('Bob recupera a mensagem e Eva só observa', async () => {
    const r = await cbc();
    expect(r.flow.recovered).toBe(MSG);
    expect(r.flow.ok).toBe(true);
    expect(r.flow.blockDiffs.every((n) => n === 0)).toBe(true);
    const def = buildDesProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'iv', 'write', 'encrypt', 'transit', 'eva-look', 'receive', 'decrypt', 'result']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.c).toBeDefined();
    expect(last.entries.eva.K).toBeUndefined();
    expect(last.verdict?.ok).toBe(true);
  });
  it('a chave nunca atravessa o canal', async () => {
    const r = await cbc();
    const def = buildDesProtocol(r.flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) expect(m.summary).not.toContain(r.flow.keyHex);
  });
  it('inverter um bit do bloco k destrói o bloco k e inverte o mesmo bit do bloco k+1', async () => {
    const r = await cbc({ tamper: true, tamperBlock: 2 });
    expect(r.flow.blockDiffs[0]).toBe(0);
    expect(r.flow.blockDiffs[1]).toBeGreaterThan(10);
    expect(r.flow.blockDiffs[2]).toBe(1);
    expect(r.flow.blockDiffs[3]).toBe(0);
    expect(r.flow.ok).toBe(false);
    const def = buildDesProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'iv', 'write', 'encrypt', 'intercept', 'flip', 'receive', 'decrypt', 'result']);
    expect(ProtocolSimulationEngine.build(def).states[def.steps.length].verdict?.ok).toBe(false);
  });
  it('no último bloco só ele é destruído', async () => {
    const r = await cbc({ tamper: true, tamperBlock: 99 });
    expect(r.flow.tamperBlock).toBe(r.flow.nBlocks);
    expect(r.flow.blockDiffs.slice(0, -1).every((n) => n === 0)).toBe(true);
    expect(r.flow.blockDiffs[r.flow.nBlocks - 1]).toBeGreaterThan(10);
  });
  it('valida a mensagem', async () => {
    await expect(cbc({ text: '' })).rejects.toThrow(/Digite uma mensagem/);
    await expect(cbc({ text: 'A'.repeat(MAX_BYTES + 1) })).rejects.toThrow(/no máximo/);
  });
});

describe('DES: busca exaustiva', () => {
  it('Eva acha a chave e lê a mensagem', async () => {
    const r = await brute();
    expect(r.flow.foundHex).toBe(r.flow.keyHex);
    expect(r.flow.tries).toBe(501);
    expect(r.flow.recovered).toBe('MENSAGEM SECRETA DE ALICE');
    expect(r.flow.ok).toBe(false);
    expect(r.flow.secondsHere).toBeGreaterThan(r.flow.secondsEff);
    const def = buildBruteProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'encrypt', 'transit', 'receive', 'eva-known', 'eva-target', 'eva-search', 'eva-decrypt', 'result']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.Kf).toBeDefined();
    expect(last.entries.eva.P).toBeDefined();
    expect(last.verdict?.ok).toBe(false);
  });
  it('valida os parâmetros', async () => {
    await expect(brute({ text: 'curto' })).rejects.toThrow(/ao menos 8 bytes/);
    await expect(brute({ unknownBits: 0 })).rejects.toThrow(/1 a 20/);
    await expect(brute({ unknownBits: 21 })).rejects.toThrow(/1 a 20/);
  });
  it('formata o tempo', () => {
    expect(humanTime(0.2)).toBe('menos de 1 segundo');
    expect(humanTime(30)).toMatch(/segundos/);
    expect(humanTime(3600)).toMatch(/minutos/);
    expect(humanTime(86400 * 5)).toMatch(/dias/);
    expect(humanTime(86400 * 365.25 * 40)).toMatch(/anos/);
  });
});

describe('Triple DES', () => {
  it('três chaves: Bob recupera a mensagem e as etapas E, D, E aparecem', async () => {
    const r = await tdes('tres');
    expect(r.flow.recovered).toBe(MSG);
    expect(r.flow.sameAsDes).toBe(false);
    const def = buildTdesProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'iv', 'mix', 'e1', 'd2', 'e3', 'transit', 'eva-cost', 'bob-decrypt', 'result']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.K1).toBeUndefined();
    expect(last.entries.bob.mrec).toBeDefined();
  });
  it('K1 = K2 = K3 equivale ao DES simples', async () => {
    const r = await tdes('igual');
    expect(r.flow.sameAsDes).toBe(true);
    expect(r.flow.k2Hex).toBe(r.flow.k1Hex);
    expect(r.flow.k3Hex).toBe(r.flow.k1Hex);
    expect(r.flow.strength).toMatch(/56 bits/);
  });
  it('duas chaves: K3 = K1', async () => {
    const r = await tdes('duas');
    expect(r.flow.k3Hex).toBe(r.flow.k1Hex);
    expect(r.flow.k2Hex).not.toBe(r.flow.k1Hex);
    expect(r.flow.sameAsDes).toBe(false);
  });
});
