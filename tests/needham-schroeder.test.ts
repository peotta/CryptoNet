import { describe, expect, it } from 'vitest';
import { decryptWith, encryptFor, makeKeyPair, runNeedhamSchroeder } from '../src/crypto/needhamSchroeder';
import { engines } from '../src/crypto/local/needhamSchroeder';
import { fixedRandom } from '../src/labs/needham-schroeder/flows';

const run = (variant: 'original' | 'corrigido', scenario: 'normal' | 'ataque', seed = 1) => runNeedhamSchroeder({ variant, scenario, rand: fixedRandom(seed) });

describe('RSA didático do Needham-Schroeder', () => {
  it('gera módulos de 128 bits e decifra o que cifra', () => {
    const k = makeKeyPair(fixedRandom(3));
    expect(k.n.toString(2).length).toBeGreaterThanOrEqual(127);
    const m = Uint8Array.of(0, 0, 5, 9, 1);
    expect(decryptWith(k, encryptFor(k, m))).toEqual(m);
  });
  it('preserva zeros à esquerda e rejeita chave errada', () => {
    const a = makeKeyPair(fixedRandom(1));
    const b = makeKeyPair(fixedRandom(2));
    const m = Uint8Array.of(0, 0, 0, 7);
    expect(decryptWith(a, encryptFor(a, m))).toEqual(m);
    expect(decryptWith(b, encryptFor(a, m))).not.toEqual(m);
  });
  it('recusa mensagens grandes demais', () => {
    const k = makeKeyPair(fixedRandom(1));
    expect(() => encryptFor(k, new Uint8Array(15))).toThrow();
  });
});

describe('protocolo de Needham-Schroeder de chave pública', () => {
  it('sessão normal: Alice e Bob se autenticam, Eva nada aprende', () => {
    const r = run('original', 'normal');
    expect(r.messages.map((m) => m.step)).toEqual([1, 2, 3]);
    expect(r.aliceCheck.accepted).toBe(true);
    expect(r.bobCheck.accepted).toBe(true);
    expect(r.bobBelievesPeer).toBe('A');
    expect(r.evaKnowsNa || r.evaKnowsNb).toBe(false);
    expect(r.attackSucceeded).toBe(false);
  });
  it('ataque de Lowe: Bob autentica Alice, mas quem fala é Eva, que conhece Na e Nb', () => {
    const r = run('original', 'ataque');
    expect(r.aliceTalksTo).toBe('E');
    expect(r.bobBelievesPeer).toBe('A');
    expect(r.attackSucceeded).toBe(true);
    expect(r.evaKnowsNa).toBe(true);
    expect(r.evaKnowsNb).toBe(true);
    expect(r.messages.filter((m) => m.relayedByEva).length).toBe(3);
  });
  it('com a correção de Lowe, a sessão normal continua funcionando', () => {
    const r = run('corrigido', 'normal');
    expect(r.aliceCheck.responderMatches).toBe(true);
    expect(r.bobCheck.accepted).toBe(true);
    expect(r.attackSucceeded).toBe(false);
  });
  it('com a correção de Lowe, Alice aborta e Eva não aprende Nb', () => {
    const r = run('corrigido', 'ataque');
    expect(r.aliceCheck.responderMatches).toBe(false);
    expect(r.aliceCheck.accepted).toBe(false);
    expect(r.messages.some((m) => m.step === 3)).toBe(false);
    expect(r.bobCheck.accepted).toBe(false);
    expect(r.evaKnowsNb).toBe(false);
    expect(r.evaKnowsNa).toBe(true);
    expect(r.attackSucceeded).toBe(false);
  });
  it('a mensagem 2 repassada por Eva é idêntica à enviada por Bob (Eva não altera nem decifra)', () => {
    const r = run('original', 'ataque');
    const [b, e] = r.messages.filter((m) => m.step === 2);
    expect(e.cipher).toBe(b.cipher);
    expect(e.encryptedFor).toBe('A');
  });
  it('é reproduzível com a mesma semente e muda com outra', () => {
    expect(run('original', 'normal', 5).messages[0].cipher).toBe(run('original', 'normal', 5).messages[0].cipher);
    expect(run('original', 'normal', 5).messages[0].cipher).not.toBe(run('original', 'normal', 6).messages[0].cipher);
  });
  it('o motor local executa o protocolo', async () => {
    const r = await engines.ns.run({ variant: 'original', scenario: 'ataque', rand: fixedRandom(1) });
    expect(r.attackSucceeded).toBe(true);
  });
});
