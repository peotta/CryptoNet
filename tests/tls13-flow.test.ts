import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import type { TlsInput } from '../src/crypto/tls13';
import { buildTlsProtocol, hex, runTls } from '../src/labs/tls13/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const base: TlsInput = { serverName: 'banco.exemplo', message: 'GET /saldo', scenario: 'normal', clientVerifies: true };
const go = (over: Partial<TlsInput> = {}) => runTls(engines.tls, { ...base, ...over });
const lastState = (def: ReturnType<typeof buildTlsProtocol>) => ProtocolSimulationEngine.build(def).states[def.steps.length];

describe('TLS 1.3: Alice, Bob e Eva', () => {
  it('handshake normal: ordem das etapas, Eva só observa', async () => {
    const r = await go();
    const def = buildTlsProtocol(r.hs);
    expect(def.steps.map((s) => s.id)).toEqual([
      'client-keygen', 'client-hello', 'server-keygen', 'server-hello', 'alice-shared', 'bob-shared', 'eva-try',
      'alice-hs', 'alice-traffic', 'bob-hs', 'bob-traffic', 'server-cv', 'server-fin', 'server-flight',
      'alice-cert', 'alice-cv', 'alice-fin', 'alice-app', 'client-fin', 'bob-app', 'alice-seal', 'app-send', 'bob-open', 'result',
    ]);
    const last = lastState(def);
    expect(last.verdict?.ok).toBe(true);
    expect(last.entries.bob.mrec.value).toBe('GET /saldo');
    // Eva observa chaves públicas e registros cifrados, mas nunca possui segredos nem o texto
    expect(last.entries.eva.seen).toBeDefined();
    expect(last.entries.eva.S).toBeUndefined();
    expect(last.entries.eva.x).toBeUndefined();
    expect(last.entries.eva.P).toBeUndefined();
    expect(r.verdictText).toMatch(/sigilo adiante/);
  });

  it('as chaves privadas, o segredo ECDHE e os segredos de tráfego nunca atravessam o canal', async () => {
    const r = await go();
    const def = buildTlsProtocol(r.hs);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) {
      expect(m.summary).not.toContain(r.hs.sharedSecret.slice(0, 12));
      expect(m.summary).not.toContain(r.hs.clientHs.slice(0, 12));
      expect(m.summary).not.toContain(r.hs.handshakeSecret.slice(0, 12));
      expect(m.summary).not.toContain('GET /saldo');
    }
  });

  it('ataque com Alice verificando: o CertificateVerify falha e o handshake é interrompido', async () => {
    const r = await go({ scenario: 'mitm', message: 'senha 1234' });
    const def = buildTlsProtocol(r.hs);
    const ids = def.steps.map((s) => s.id);
    expect(ids).toContain('eva-cv');
    expect(ids).toContain('alice-cv');
    expect(ids).not.toContain('alice-seal');
    expect(ids[ids.length - 1]).toBe('result');
    const last = lastState(def);
    expect(last.verdict?.ok).toBe(true);
    expect(last.entries.eva.P).toBeUndefined(); // Eva não leu nada
    expect(r.verdictText).toMatch(/Finished de Eva estava correto/);
  });

  it('ataque com Alice sem verificar: Eva decifra a mensagem', async () => {
    const r = await go({ scenario: 'mitm', message: 'senha 1234', clientVerifies: false });
    const def = buildTlsProtocol(r.hs);
    const ids = def.steps.map((s) => s.id);
    expect(ids).toContain('eva-open');
    expect(ids).not.toContain('bob-open');
    const last = lastState(def);
    expect(last.verdict?.ok).toBe(false);
    expect(last.entries.eva.P.value).toBe('senha 1234');
    expect(r.verdictText).toMatch(/homem do meio/);
  });

  it('no ataque, Bob não participa do handshake', async () => {
    const def = buildTlsProtocol((await go({ scenario: 'mitm', clientVerifies: false })).hs);
    const last = lastState(def);
    expect(last.entries.bob.S).toBeUndefined();
    expect(last.entries.bob.mrec).toBeUndefined();
  });

  it('valida as entradas', async () => {
    await expect(go({ serverName: 'a b' })).rejects.toThrow(/Nome do servidor/);
    await expect(go({ message: '' })).rejects.toThrow(/Digite a mensagem/);
  });

  it('hex abrevia valores longos', () => {
    expect(hex('ab')).toBe('ab');
    expect(hex('0123456789abcdef'.repeat(4))).toMatch(/^[0-9a-f]{12}…[0-9a-f]{4}$/);
  });
});
