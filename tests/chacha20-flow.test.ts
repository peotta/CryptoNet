import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { randomBytes } from '../src/crypto/random';
import { buildChaChaProtocol, buildReuseProtocol, MAX_BYTES, printable, runChaCha, runReuse } from '../src/labs/chacha20/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const T1 = 'ATAQUE A PONTE AO AMANHECER SEM AVISAR';
const T2 = 'RECUAR PARA A FLORESTA AO ANOITECER AGORA';

const normal = (over: Partial<{ text: string; tamper: boolean; tamperByte: number }> = {}) =>
  runChaCha(engines.chacha, { key: randomBytes(32), nonce: randomBytes(12), text: 'PAGAR R$ 1000,00 PARA BOB', tamper: false, tamperByte: 10, ...over });
const reuse = (over: Partial<{ text1: string; text2: string; crib: string; cribIn: 1 | 2 }> = {}) =>
  runReuse(engines.chacha, { key: randomBytes(32), nonce: randomBytes(12), text1: T1, text2: T2, crib: 'AMANHECER', cribIn: 1, ...over });

describe('ChaCha20: uso correto, Alice, Bob e Eva', () => {
  it('Bob recupera a mensagem e Eva não lê nada', async () => {
    const r = await normal();
    expect(r.flow.recovered).toBe('PAGAR R$ 1000,00 PARA BOB');
    expect(r.flow.ok).toBe(true);
    expect(r.flow.verdictText).toMatch(/indistinguível/);
  });
  it('as etapas seguem a ordem, com Eva só observando', async () => {
    const def = buildChaChaProtocol((await normal()).flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'nonce', 'write', 'keystream', 'encrypt', 'transit', 'eva-look', 'receive', 'bob-keystream', 'decrypt', 'result']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.c).toBeDefined();
    expect(last.entries.eva.K).toBeUndefined();
    expect(last.entries.eva.ks).toBeUndefined();
    expect(last.verdict?.ok).toBe(true);
  });
  it('a chave e o fluxo de chaves nunca atravessam o canal', async () => {
    const r = await normal();
    const def = buildChaChaProtocol(r.flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) {
      expect(m.summary).not.toContain(r.flow.keyHex.slice(0, 12));
      expect(m.summary).not.toContain(r.flow.ksHex.slice(0, 12));
    }
  });
  it('com adulteração, só o byte atingido muda e Bob não percebe (maleabilidade)', async () => {
    const r = await normal({ tamper: true, tamperByte: 7 });
    expect(r.flow.changedBytes).toBe(1);
    expect(r.flow.recovered).not.toBe('PAGAR R$ 1000,00 PARA BOB');
    expect(r.flow.recovered[6]).toBe(String.fromCharCode('PAGAR R$ 1000,00 PARA BOB'.charCodeAt(6) ^ 1)); // byte 7 sofreu XOR com 0x01
    expect(r.flow.ok).toBe(false);
    const def = buildChaChaProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'nonce', 'write', 'keystream', 'encrypt', 'intercept', 'flip', 'receive', 'bob-keystream', 'decrypt', 'result']);
    expect(ProtocolSimulationEngine.build(def).states[def.steps.length].verdict?.ok).toBe(false);
  });
  it('valida a mensagem', async () => {
    await expect(normal({ text: '' })).rejects.toThrow(/Digite uma mensagem/);
    await expect(normal({ text: 'A'.repeat(MAX_BYTES + 1) })).rejects.toThrow(/no máximo/);
  });
});

describe('ChaCha20: nonce reutilizado', () => {
  it('C1 ⊕ C2 é igual a m1 ⊕ m2 e o texto provável revela o trecho da outra mensagem', async () => {
    const r = await reuse();
    expect(r.flow.realOffset).toBe(T1.indexOf('AMANHECER'));
    expect(r.flow.recoveredFragment).toBe(T2.slice(T1.indexOf('AMANHECER'), T1.indexOf('AMANHECER') + 9));
    expect(r.flow.ok).toBe(false);
    expect(r.rows.find((x) => x.real)!.readable).toBe(true);
    expect(r.flow.verdictText).toMatch(/destruiu o sigilo/);
  });
  it('o texto provável na mensagem 2 revela o trecho da mensagem 1', async () => {
    const r = await reuse({ crib: 'FLORESTA', cribIn: 2 });
    const at = T2.indexOf('FLORESTA');
    expect(r.flow.recoveredFragment).toBe(T1.slice(at, at + 8));
    expect(r.flow.other).toBe(1);
  });
  it('um texto provável que não existe não produz resultado confiável', async () => {
    const r = await reuse({ crib: 'XYZXYZXYZ' });
    expect(r.flow.realOffset).toBe(-1);
    expect(r.flow.ok).toBe(true);
    expect(r.flow.verdictText).toMatch(/não está na mensagem 1/);
  });
  it('as etapas incluem o XOR das cifras e o arrasto, e Eva nunca possui a chave', async () => {
    const r = await reuse();
    const def = buildReuseProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'nonce', 'enc1', 'enc2', 'transit', 'eva-xor', 'eva-crib', 'bob-decrypt', 'result']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.X).toBeDefined();
    expect(last.entries.eva.K).toBeUndefined();
    expect(last.verdict?.ok).toBe(false);
  });
  it('valida as entradas', async () => {
    await expect(reuse({ crib: 'AB' })).rejects.toThrow(/ao menos 3/);
    await expect(reuse({ crib: 'A'.repeat(100) })).rejects.toThrow(/maior que a parte comum/);
    await expect(reuse({ text1: '' })).rejects.toThrow(/as duas mensagens/);
  });
  it('printable troca bytes não imprimíveis por ponto', () => {
    expect(printable(Uint8Array.from([0x41, 0x00, 0x7f, 0x20]))).toBe('A·· ');
  });
});
