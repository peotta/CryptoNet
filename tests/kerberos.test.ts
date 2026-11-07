import { describe, expect, it } from 'vitest';
import { DEFAULT_DICTIONARY, open, runKerberos, seal, stringToKey, type KrbOptions } from '../src/crypto/kerberos';
import { buildProtocol, DEFAULT_NOW, STRONG_PASSWORD, WEAK_PASSWORD } from '../src/labs/kerberos/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

/** Gerador reproduzível: bytes a partir de um contador. */
function counterRand(): (n: number) => Uint8Array {
  let c = 1;
  return (n) => Uint8Array.from({ length: n }, () => (c++ * 37) & 0xff);
}

const base = (over: Partial<KrbOptions> = {}): KrbOptions => ({
  scenario: 'normal',
  rand: counterRand(),
  password: WEAK_PASSWORD,
  now: DEFAULT_NOW,
  skew: 300,
  replayCache: false,
  preauth: false,
  dictionary: DEFAULT_DICTIONARY,
  iterations: 64,
  ...over,
});

describe('Kerberos: primitivas', () => {
  it('stringToKey é determinística e depende da senha e do principal', async () => {
    const a = await stringToKey('abc', 'UNB.BR', 'alice', 8);
    expect(a).toHaveLength(32);
    expect(await stringToKey('abc', 'UNB.BR', 'alice', 8)).toEqual(a);
    expect(await stringToKey('abd', 'UNB.BR', 'alice', 8)).not.toEqual(a);
    expect(await stringToKey('abc', 'UNB.BR', 'bob', 8)).not.toEqual(a);
  });

  it('seal e open fazem o caminho de ida e volta e recusam a chave errada', async () => {
    const k = new Uint8Array(32).fill(7);
    const s = await seal(k, 'olá', new Uint8Array(12));
    expect(await open(k, s)).toBe('olá');
    expect(await open(new Uint8Array(32).fill(8), s)).toBeNull();
    s[s.length - 1] ^= 1;
    expect(await open(k, s)).toBeNull();
  });
});

describe('Kerberos: execução', () => {
  it('troca normal: Alice abre as respostas e Bob a autentica', async () => {
    const r = await runKerberos(base());
    expect(r.aliceKnowsKab).toBe(true);
    expect(r.bobAcceptsAlice).toBe(true);
    expect(r.ok).toBe(true);
  });

  it('repetição sem registro de autenticadores é aceita; com registro é recusada', async () => {
    const sem = await runKerberos(base({ scenario: 'replay' }));
    expect(sem.replayAccepted).toBe(true);
    expect(sem.ok).toBe(false);
    const com = await runKerberos(base({ scenario: 'replay', replayCache: true }));
    expect(com.replayAccepted).toBe(false);
    expect(com.replayReason).toBe('repeticao');
    expect(com.ok).toBe(true);
  });

  it('repetição fora da tolerância é recusada pelo relógio', async () => {
    const r = await runKerberos(base({ scenario: 'replay', skew: 10 }));
    expect(r.replayReason).toBe('relogio');
    expect(r.replayAccepted).toBe(false);
  });

  it('sem pré-autenticação a senha fraca é encontrada; a forte resiste; com pré-autenticação não há ataque', async () => {
    const fraca = await runKerberos(base({ scenario: 'guess' }));
    expect(fraca.found).toBe(WEAK_PASSWORD);
    expect(fraca.tried.at(-1)).toBe(WEAK_PASSWORD);
    expect(fraca.ok).toBe(false);
    const forte = await runKerberos(base({ scenario: 'guess', password: STRONG_PASSWORD }));
    expect(forte.found).toBeNull();
    expect(forte.tried).toHaveLength(DEFAULT_DICTIONARY.length);
    expect(forte.ok).toBe(true);
    const pre = await runKerberos(base({ scenario: 'guess', preauth: true }));
    expect(pre.kdcAnswered).toBe(false);
    expect(pre.tried).toHaveLength(0);
    expect(pre.ok).toBe(true);
  });
});

describe('Kerberos: animação', () => {
  it('os quatro participantes têm posições distintas e os ids das etapas são únicos', async () => {
    for (const over of [{}, { scenario: 'replay' as const }, { scenario: 'guess' as const }, { scenario: 'guess' as const, preauth: true }]) {
      const def = buildProtocol(await runKerberos(base(over)));
      expect(new Set(def.parties.map((p) => p.position)).size).toBe(4);
      expect(new Set(def.steps.map((s) => s.id)).size).toBe(def.steps.length);
      const last = ProtocolSimulationEngine.build(def).states.at(-1)!;
      expect(last.verdict).not.toBeNull();
    }
  });
});
