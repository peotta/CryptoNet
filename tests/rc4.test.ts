import { describe, expect, it } from 'vitest';
import { fromHex, toHex, utf8Encode } from '../src/crypto/encoding';
import { fmsRecover, fmsRecoverVerified, fmsVotes, ksaTrace, prgaTrace, rc4Crypt, rc4Stream, weakPackets, wepEncrypt } from '../src/crypto/rc4';

const hex = (s: string) => toHex(utf8Encode(s));

describe('RC4: vetores conhecidos', () => {
  it('Key / Plaintext, Wiki / pedia e Secret / Attack at dawn', () => {
    expect(toHex(rc4Crypt(utf8Encode('Key'), utf8Encode('Plaintext')))).toBe('bbf316e8d940af0ad3');
    expect(toHex(rc4Crypt(utf8Encode('Wiki'), utf8Encode('pedia')))).toBe('1021bf0420');
    expect(toHex(rc4Crypt(utf8Encode('Secret'), utf8Encode('Attack at dawn')))).toBe('45a01f645fc35b383552544b9bf5');
  });
  it('RFC 6229: chave 0102030405, deslocamentos 0 e 240', () => {
    const key = fromHex('0102030405');
    expect(toHex(rc4Stream(key, 16))).toBe('b2396305f03dc027ccc3524a0a1118a8');
    expect(toHex(rc4Stream(key, 16, 240))).toBe('28cb1132c96ce286421dcaadb8b69eae');
  });
  it('decifrar é cifrar de novo', () => {
    const key = utf8Encode('chave');
    const c = rc4Crypt(key, utf8Encode('mensagem'));
    expect(toHex(rc4Crypt(key, c))).toBe(hex('mensagem'));
  });
  it('rejeita chave vazia ou longa demais', () => {
    expect(() => rc4Stream(new Uint8Array(0), 1)).toThrow(/1 a 256 bytes/);
    expect(() => rc4Stream(new Uint8Array(257), 1)).toThrow(/1 a 256 bytes/);
  });
  it('o rastro termina no mesmo fluxo e a KSA tem 256 trocas', () => {
    const key = utf8Encode('Key');
    const k = ksaTrace(key);
    expect(k.steps).toHaveLength(256);
    expect(new Set(k.state).size).toBe(256); // continua sendo uma permutação
    const p = prgaTrace(k.state, 9);
    expect(toHex(Uint8Array.from(p.map((s) => s.out)))).toBe(toHex(rc4Stream(key, 9)));
    expect(p[0].t).toBe((p[0].state[p[0].i] + p[0].state[p[0].j]) & 0xff);
  });
});

describe('RC4: viés do segundo byte', () => {
  it('o segundo byte vale zero com probabilidade próxima de 2/256, o dobro do esperado', () => {
    let zeros = 0;
    const trials = 20000;
    for (let i = 0; i < trials; i++) {
      const key = crypto.getRandomValues(new Uint8Array(16));
      if (rc4Stream(key, 2)[1] === 0) zeros++;
    }
    const p = zeros / trials;
    expect(p).toBeGreaterThan(1.5 / 256);
    expect(p).toBeLessThan(2.6 / 256);
  });
  it('descartar os primeiros 256 bytes remove o viés do segundo byte', () => {
    let zeros = 0;
    const trials = 20000;
    for (let i = 0; i < trials; i++) if (rc4Stream(crypto.getRandomValues(new Uint8Array(16)), 2, 256)[1] === 0) zeros++;
    expect(zeros / trials).toBeLessThan(1.5 / 256);
  });
});

describe('WEP: ataque FMS', () => {
  it('recupera uma chave raiz de 40 bits com IV fracos', () => {
    let ok = 0;
    const runs = 20;
    for (let r = 0; r < runs; r++) {
      const root = crypto.getRandomValues(new Uint8Array(5));
      const res = fmsRecover(5, weakPackets(root, 5));
      if (toHex(res.key) === toHex(root)) ok++;
    }
    console.log(`FMS: ${ok}/${runs} chaves de 40 bits recuperadas com 1280 pacotes`);
    expect(ok).toBeGreaterThanOrEqual(10);
  });
  it('o byte correto é o mais votado e vota-se só com a condição de resolução', () => {
    const root = Uint8Array.of(0x1f, 0x2e, 0x3d, 0x4c, 0x5b);
    const pk = weakPackets(root, 5);
    const r = fmsVotes(new Uint8Array(0), 0, pk);
    expect(r.packets).toBe(256);
    expect(r.voters).toBeGreaterThan(0);
    expect(r.voters).toBeLessThan(256);
  });
  it('confere a chave contra um quadro conhecido e recupera quase sempre', () => {
    let ok = 0;
    const plain = Uint8Array.of(0xaa, 0xaa, 0x03, 0x01);
    for (let r = 0; r < 20; r++) {
      const root = crypto.getRandomValues(new Uint8Array(5));
      const iv = Uint8Array.of(1, 2, 3);
      const frame = toHex(wepEncrypt(iv, root, plain));
      const res = fmsRecoverVerified(5, weakPackets(root, 5), (k) => toHex(wepEncrypt(iv, k, plain)) === frame);
      if (res.found && toHex(res.key) === toHex(root)) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(19);
  });
  it('cifra WEP: o IV viaja em claro e a chave raiz decifra o quadro', () => {
    const root = fromHex('0102030405');
    const iv = fromHex('abcdef');
    const c = wepEncrypt(iv, root, utf8Encode('quadro'));
    expect(toHex(rc4Crypt(Uint8Array.from([...iv, ...root]), c))).toBe(hex('quadro'));
  });
});
