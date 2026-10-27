import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { randomBytes } from '../src/crypto/random';
import { buildRc4Protocol, buildWepProtocol, MAX_BYTES, runRc4, runWep } from '../src/labs/rc4/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const normal = (over: Partial<{ text: string; drop: 0 | 256; tamper: boolean; tamperByte: number }> = {}) =>
  runRc4(engines.rc4, { key: randomBytes(16), text: 'PAGAR R$ 1000,00 PARA BOB', drop: 0, tamper: false, tamperByte: 10, ...over });
const wep = (payload = 'GET /saldo HTTP/1.1') => runWep(engines.rc4, { root: randomBytes(5), iv: randomBytes(3), payload });

describe('RC4: uso, Alice, Bob e Eva', () => {
  it('Bob recupera a mensagem e Eva só observa', async () => {
    const r = await normal();
    expect(r.flow.recovered).toBe('PAGAR R$ 1000,00 PARA BOB');
    expect(r.flow.ok).toBe(true);
    const def = buildRc4Protocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'ksa', 'write', 'prga', 'encrypt', 'transit', 'eva-look', 'receive', 'bob-keystream', 'decrypt', 'result']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.c).toBeDefined();
    expect(last.entries.eva.K).toBeUndefined();
    expect(last.entries.eva.ks).toBeUndefined();
    expect(last.verdict?.ok).toBe(true);
  });
  it('a chave e o fluxo nunca atravessam o canal', async () => {
    const r = await normal();
    const def = buildRc4Protocol(r.flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) {
      expect(m.summary).not.toContain(r.flow.keyHex.slice(0, 12));
      expect(m.summary).not.toContain(r.flow.ksHex.slice(0, 12));
    }
  });
  it('descartar 256 bytes muda o fluxo e Bob ainda decifra', async () => {
    const key = randomBytes(16);
    const a = await runRc4(engines.rc4, { key, text: 'mensagem de teste', drop: 0, tamper: false, tamperByte: 1 });
    const b = await runRc4(engines.rc4, { key, text: 'mensagem de teste', drop: 256, tamper: false, tamperByte: 1 });
    expect(a.flow.ksHex).not.toBe(b.flow.ksHex);
    expect(b.flow.recovered).toBe('mensagem de teste');
  });
  it('maleabilidade: um bit invertido na cifra inverte o mesmo bit do claro', async () => {
    const r = await normal({ tamper: true, tamperByte: 7 });
    expect(r.flow.changedBytes).toBe(1);
    expect(r.flow.recovered[6]).toBe(String.fromCharCode('PAGAR R$ 1000,00 PARA BOB'.charCodeAt(6) ^ 1));
    expect(r.flow.ok).toBe(false);
    const def = buildRc4Protocol(r.flow);
    expect(def.steps.map((s) => s.id)).toContain('flip');
    expect(ProtocolSimulationEngine.build(def).states[def.steps.length].verdict?.ok).toBe(false);
  });
  it('valida a mensagem', async () => {
    await expect(normal({ text: '' })).rejects.toThrow(/Digite uma mensagem/);
    await expect(normal({ text: 'A'.repeat(MAX_BYTES + 1) })).rejects.toThrow(/no máximo/);
  });
});

describe('WEP: ataque FMS', () => {
  it('Eva recupera a chave raiz e lê o quadro', async () => {
    const r = await wep();
    expect(r.flow.found).toBe(true);
    expect(r.flow.recoveredHex).toBe(r.flow.rootHex);
    expect(r.flow.decrypted).toBe('GET /saldo HTTP/1.1');
    expect(r.flow.ok).toBe(false);
    expect(r.flow.nPackets).toBe(1280);
    expect(r.flow.bytes).toHaveLength(5);
    expect(r.flow.bytes.every((b) => b.correct)).toBe(true);
    const def = buildWepProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'encrypt', 'transit', 'bob-decrypt', 'eva-collect', 'eva-z0', 'eva-byte-1', 'eva-byte-2', 'eva-byte-3', 'eva-byte-4', 'eva-byte-5', 'eva-verify', 'result']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.Kf.value).toBe(r.flow.rootHex);
    expect(last.entries.eva.P).toBeDefined();
    expect(last.verdict?.ok).toBe(false);
  });
  it('a chave raiz nunca atravessa o ar', async () => {
    const r = await wep();
    const def = buildWepProtocol(r.flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) expect(m.summary).not.toContain(r.flow.rootHex);
  });
  it('valida os parâmetros', async () => {
    await expect(runWep(engines.rc4, { root: randomBytes(4), iv: randomBytes(3), payload: 'x' })).rejects.toThrow(/5 bytes/);
    await expect(runWep(engines.rc4, { root: randomBytes(5), iv: randomBytes(2), payload: 'x' })).rejects.toThrow(/3 bytes/);
    await expect(wep('')).rejects.toThrow(/conteúdo/);
  });
});
