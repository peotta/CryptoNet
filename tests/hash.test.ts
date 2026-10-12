import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { toHex, utf8Encode } from '../src/crypto/encoding';
import { avalancheStats, bitDifference, constantTimeEqual, digest, hmacTrace, hmacWebCrypto, HASH_ALGOS, HASH_INFO } from '../src/crypto/hash';
import { randomBytes } from '../src/crypto/random';

const hex = (u: Uint8Array) => toHex(u);

describe('funções hash (vetores do FIPS 180)', () => {
  it('SHA-256("abc")', async () => {
    expect(hex(await digest('SHA-256', utf8Encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('SHA-1("abc")', async () => {
    expect(hex(await digest('SHA-1', utf8Encode('abc')))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });
  it('SHA-256 da mensagem vazia', async () => {
    expect(hex(await digest('SHA-256', new Uint8Array()))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it.each(HASH_ALGOS)('%s: tamanho da saída e concordância com node:crypto', async (algo) => {
    const data = randomBytes(77);
    const out = await digest(algo, data);
    expect(out.length * 8).toBe(HASH_INFO[algo].bits);
    expect(hex(out)).toBe(createHash(algo.replace('-', '').toLowerCase()).update(data).digest('hex'));
  });
});

describe('HMAC passo a passo (RFC 2104) contra vetores da RFC 4231 e da RFC 2202', () => {
  it('RFC 4231, caso 1 (chave de 20 bytes)', async () => {
    const t = await hmacTrace('SHA-256', new Uint8Array(20).fill(0x0b), utf8Encode('Hi There'));
    expect(hex(t.tag)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });
  it('RFC 4231, caso 2 (chave "Jefe")', async () => {
    const t = await hmacTrace('SHA-256', utf8Encode('Jefe'), utf8Encode('what do ya want for nothing?'));
    expect(hex(t.tag)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
    expect(t.keyWasHashed).toBe(false);
    expect(t.keyPrime.length).toBe(64);
  });
  it('RFC 4231, caso 6 (chave maior que o bloco é reduzida por hash)', async () => {
    const t = await hmacTrace('SHA-256', new Uint8Array(131).fill(0xaa), utf8Encode('Test Using Larger Than Block-Size Key - Hash Key First'));
    expect(hex(t.tag)).toBe('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54');
    expect(t.keyWasHashed).toBe(true);
  });
  it('RFC 2202, caso 2 (HMAC-SHA-1)', async () => {
    const t = await hmacTrace('SHA-1', utf8Encode('Jefe'), utf8Encode('what do ya want for nothing?'));
    expect(hex(t.tag)).toBe('effcdf6ae5eb2fa2d27416d5f184df9c259a7c79');
  });
  it.each(HASH_ALGOS)('%s: implementação manual = Web Crypto = node:crypto (chaves curtas, no limite e longas)', async (algo) => {
    const block = HASH_INFO[algo].block;
    for (const keyLen of [1, 16, block, block + 1, block * 2]) {
      const key = randomBytes(keyLen);
      const msg = randomBytes(100);
      const trace = await hmacTrace(algo, key, msg);
      const nodeTag = createHmac(algo.replace('-', '').toLowerCase(), key).update(msg).digest('hex');
      expect(hex(trace.tag)).toBe(nodeTag);
      expect(hex(await hmacWebCrypto(algo, key, msg))).toBe(nodeTag);
    }
  });
  it('os valores intermediários seguem a definição (ipad = 0x36, opad = 0x5c)', async () => {
    const t = await hmacTrace('SHA-256', utf8Encode('k'), utf8Encode('m'));
    expect(t.ipadKey[0]).toBe(utf8Encode('k')[0] ^ 0x36);
    expect(t.ipadKey[1]).toBe(0x36);
    expect(t.opadKey[1]).toBe(0x5c);
    const inner = await digest('SHA-256', new Uint8Array([...t.ipadKey, ...utf8Encode('m')]));
    expect(hex(t.inner)).toBe(hex(inner));
    expect(hex(t.tag)).toBe(hex(await digest('SHA-256', new Uint8Array([...t.opadKey, ...inner]))));
  });
  it('o motor confere o HMAC manual contra a implementação nativa', async () => {
    const r = await engines.hash.hmac('SHA-256', utf8Encode('chave'), utf8Encode('mensagem'));
    expect(r.matchesReference).toBe(true);
  });
  it('mensagem ou chave diferente muda o HMAC; hash simples não depende de chave', async () => {
    const a = await hmacTrace('SHA-256', utf8Encode('k1'), utf8Encode('m'));
    const b = await hmacTrace('SHA-256', utf8Encode('k2'), utf8Encode('m'));
    const c = await hmacTrace('SHA-256', utf8Encode('k1'), utf8Encode('m!'));
    expect(hex(a.tag)).not.toBe(hex(b.tag));
    expect(hex(a.tag)).not.toBe(hex(c.tag));
    expect(hex(await digest('SHA-256', utf8Encode('m')))).toBe(hex(await digest('SHA-256', utf8Encode('m'))));
  });
});

describe('efeito avalanche', () => {
  it('"CryptoNet" e "CryptoNeu" diferem em exatamente 1 bit na entrada', () => {
    expect(bitDifference(utf8Encode('CryptoNet'), utf8Encode('CryptoNeu')).differing).toBe(1);
  });
  it('1 bit de diferença na entrada altera cerca de metade dos bits do SHA-256', async () => {
    const d = bitDifference(await digest('SHA-256', utf8Encode('CryptoNet')), await digest('SHA-256', utf8Encode('CryptoNeu')));
    expect(d.total).toBe(256);
    expect(d.mask).toHaveLength(256);
    expect(d.mask.filter(Boolean).length).toBe(d.differing);
    expect(d.differing).toBeGreaterThan(90);
    expect(d.differing).toBeLessThan(166);
  });
  it('a média em 100 execuções fica próxima de 50%', async () => {
    const s = await avalancheStats('SHA-256', 100);
    expect(s.meanFraction).toBeGreaterThan(0.46);
    expect(s.meanFraction).toBeLessThan(0.54);
    expect(s.minFraction).toBeLessThanOrEqual(s.meanFraction);
    expect(s.maxFraction).toBeGreaterThanOrEqual(s.meanFraction);
  });
  it('entradas de tamanhos diferentes são comparadas com preenchimento de zeros', () => {
    expect(bitDifference(new Uint8Array([0xff]), new Uint8Array([0xff, 0x01])).differing).toBe(1);
  });
});

describe('comparação em tempo constante', () => {
  it('detecta igualdade e diferenças, inclusive de tamanho', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });
});
