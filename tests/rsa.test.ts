import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import {
  decryptDidactic,
  encryptDidactic,
  generateDidacticKeys,
  randomDidacticPrimes,
  signDidactic,
  suggestPublicExponent,
  verifyDidactic,
} from '../src/crypto/rsaDidactic';
import { engines } from '../src/crypto/engines';
import { flipBit, oaepMaxMessageBytes } from '../src/crypto/rsaWebCrypto';
import { utf8Decode, utf8Encode } from '../src/crypto/encoding';
import { runDidactic } from '../src/labs/rsa/run';

describe('RSA didático: geração de chaves', () => {
  it('reproduz o exemplo clássico (61, 53, 17)', () => {
    const k = generateDidacticKeys(61n, 53n, 17n);
    expect(k.n).toBe(3233n);
    expect(k.phi).toBe(3120n);
    expect(k.d).toBe(2753n);
    expect((k.e * k.d) % k.phi).toBe(1n);
  });
  it('rejeita primos inválidos', () => {
    expect(() => generateDidacticKeys(60n, 53n, 17n)).toThrow(/não é primo/);
    expect(() => generateDidacticKeys(61n, 61n, 17n)).toThrow(/distintos/);
    expect(() => generateDidacticKeys(2n, 53n, 17n)).toThrow(CryptoInputError);
    expect(() => generateDidacticKeys(61n, 2_000_003n, 17n)).toThrow(CryptoInputError);
  });
  it('valida o expoente público', () => {
    expect(() => generateDidacticKeys(61n, 53n, 1n)).toThrow(CryptoInputError);
    expect(() => generateDidacticKeys(61n, 53n, 3120n)).toThrow(CryptoInputError);
    expect(() => generateDidacticKeys(61n, 53n, 6n)).toThrow(/coprimo/); // mdc(6, 3120) = 6
  });
  it('sugere um expoente coprimo', () => {
    const e = suggestPublicExponent(3120n);
    expect(e).toBe(257n); // 257 < φ e coprimo com φ, preferido a 17
    expect(suggestPublicExponent(8n)).toBe(5n);
  });
  it('sorteia pares de primos válidos e distintos', () => {
    for (let i = 0; i < 20; i++) {
      const { p, q } = randomDidacticPrimes();
      expect(p).not.toBe(q);
      const k = generateDidacticKeys(p, q, suggestPublicExponent((p - 1n) * (q - 1n)));
      expect(decryptDidactic(encryptDidactic(42n, k.publicKey), k.privateKey)).toBe(42n);
    }
  });
});

describe('RSA didático: cifragem, decifragem e assinatura', () => {
  const k = generateDidacticKeys(61n, 53n, 17n);
  it('cifra e decifra', () => {
    expect(encryptDidactic(65n, k.publicKey)).toBe(2790n);
    expect(decryptDidactic(2790n, k.privateKey)).toBe(65n);
  });
  it('é uma bijeção em Z_n: decifrar inverte cifrar para todo m', () => {
    for (let m = 0n; m < k.n; m++) expect(decryptDidactic(encryptDidactic(m, k.publicKey), k.privateKey)).toBe(m);
  });
  it('rejeita mensagens fora de [0, n)', () => {
    expect(() => encryptDidactic(k.n, k.publicKey)).toThrow(CryptoInputError);
    expect(() => encryptDidactic(-1n, k.publicKey)).toThrow(CryptoInputError);
    expect(() => decryptDidactic(k.n + 5n, k.privateKey)).toThrow(CryptoInputError);
  });
  it('é determinístico e maleável (por isso é inseguro)', () => {
    expect(encryptDidactic(7n, k.publicKey)).toBe(encryptDidactic(7n, k.publicKey));
    const c = (encryptDidactic(5n, k.publicKey) * encryptDidactic(7n, k.publicKey)) % k.n;
    expect(decryptDidactic(c, k.privateKey)).toBe(35n);
  });
  it('assina e verifica', () => {
    const s = signDidactic(1234n, k.privateKey);
    expect(verifyDidactic(1234n, s, k.publicKey)).toBe(true);
    expect(verifyDidactic(1235n, s, k.publicKey)).toBe(false);
  });
});

describe('fluxo do laboratório didático (motor assíncrono)', () => {
  it('cifragem sem adulteração recupera a mensagem', async () => {
    const r = await runDidactic(engines.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 65n, scenario: 'cifragem', tamper: false });
    expect(r.flow.payload).toBe('2790');
    expect(r.flow.ok).toBe(true);
    expect(r.recovered).toBe(65n);
  });
  it('cifra adulterada NÃO gera erro no RSA sem padding, apenas outro número', async () => {
    const r = await runDidactic(engines.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 65n, scenario: 'cifragem', tamper: true });
    expect(r.flow.ok).toBe(false);
    expect(r.recovered).not.toBe(65n);
  });
  it('assinatura adulterada é rejeitada', async () => {
    const ok = await runDidactic(engines.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 65n, scenario: 'assinatura', tamper: false });
    const bad = await runDidactic(engines.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 65n, scenario: 'assinatura', tamper: true });
    expect(ok.flow.ok).toBe(true);
    expect(bad.flow.ok).toBe(false);
  });
  it('propaga erros de entrada', async () => {
    await expect(runDidactic(engines.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 99999n, scenario: 'cifragem', tamper: false })).rejects.toThrow(CryptoInputError);
  });
});

describe('RSA real: RSA-OAEP e RSA-PSS (Web Crypto)', () => {
  it('cifra e decifra com RSA-OAEP e resiste à adulteração', async () => {
    const keys = await engines.rsaReal.generateEncryptionKeys(2048);
    expect(keys.info.modulusBits).toBe(2048);
    expect(keys.info.exponent).toBe(65537);
    const msg = utf8Encode('mensagem secreta');
    const c1 = await engines.rsaReal.encrypt(keys, msg);
    const c2 = await engines.rsaReal.encrypt(keys, msg);
    expect(c1.length).toBe(256);
    expect(Buffer.from(c1).equals(Buffer.from(c2))).toBe(false); // OAEP é probabilístico
    expect(utf8Decode(await engines.rsaReal.decrypt(keys, c1))).toBe('mensagem secreta');
    await expect(engines.rsaReal.decrypt(keys, flipBit(c1, c1.length - 1))).rejects.toThrow();
  });
  it('assina e verifica com RSA-PSS e detecta adulteração', async () => {
    const keys = await engines.rsaReal.generateSigningKeys(2048);
    const msg = utf8Encode('documento importante');
    const sig = await engines.rsaReal.sign(keys, msg);
    expect(await engines.rsaReal.verify(keys, sig, msg)).toBe(true);
    expect(await engines.rsaReal.verify(keys, sig, utf8Encode('documento importante!'))).toBe(false);
    expect(await engines.rsaReal.verify(keys, flipBit(sig, 5), msg)).toBe(false);
  });
  it('a chave privada não é extraível', async () => {
    const keys = await engines.rsaReal.generateEncryptionKeys(2048);
    expect(keys.handle.privateKey.extractable).toBe(false);
    await expect(globalThis.crypto.subtle.exportKey('jwk', keys.handle.privateKey)).rejects.toThrow();
  });
  it('calcula o limite de mensagem do OAEP', () => {
    expect(oaepMaxMessageBytes(2048)).toBe(190);
    expect(oaepMaxMessageBytes(4096)).toBe(446);
  });
  it('rejeita mensagem maior que o limite do OAEP', async () => {
    const keys = await engines.rsaReal.generateEncryptionKeys(2048);
    await expect(engines.rsaReal.encrypt(keys, new Uint8Array(191))).rejects.toThrow();
  });
});
