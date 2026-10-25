import * as nodeCrypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha3_256, sha3_512, shake128, shake256 } from '../src/crypto/keccak';
import {
  ML_KEM_1024,
  ML_KEM_512,
  ML_KEM_768,
  Q,
  centered,
  compress,
  decaps,
  decapsDetailed,
  decompress,
  encaps,
  encapsDetailed,
  invNtt,
  keyGen,
  keyGenDetailed,
  multiplyNtts,
  ntt,
  polyMulSchoolbook,
  sizes,
  type MlKemParams,
} from '../src/crypto/mlkem';

const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed * 17 + (i >> 3)) & 0xff);
// encapsulate e decapsulate (ML-KEM) existem no Node 24 com OpenSSL 3.5, mas ainda não nos tipos instalados.
const kem = nodeCrypto as unknown as {
  encapsulate: (key: nodeCrypto.KeyObject) => { sharedKey: Buffer; ciphertext: Buffer };
  decapsulate: (key: nodeCrypto.KeyObject, ciphertext: Buffer) => Buffer;
};
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('Keccak (FIPS 202) contra o OpenSSL do Node', () => {
  const sizes_ = [0, 1, 55, 71, 72, 135, 136, 137, 167, 168, 169, 500];
  it.each(sizes_)('SHA3-256 e SHA3-512 de %i bytes', (n) => {
    const m = bytes(n, n);
    expect(hex(sha3_256(m))).toBe(nodeCrypto.createHash('sha3-256').update(m).digest('hex'));
    expect(hex(sha3_512(m))).toBe(nodeCrypto.createHash('sha3-512').update(m).digest('hex'));
  });
  it.each(sizes_)('SHAKE128 e SHAKE256 de %i bytes de entrada, saída maior que a taxa', (n) => {
    const m = bytes(n, n + 1);
    expect(hex(shake128(m).squeeze(400))).toBe(nodeCrypto.createHash('shake128', { outputLength: 400 }).update(m).digest('hex'));
    expect(hex(shake256(m, 300))).toBe(nodeCrypto.createHash('shake256', { outputLength: 300 }).update(m).digest('hex'));
  });
  it('a esponja pode ser espremida em pedaços, com o mesmo resultado', () => {
    const m = bytes(10, 3);
    const a = shake128(m);
    const parts = [a.squeeze(3), a.squeeze(200), a.squeeze(5)];
    expect(hex(Uint8Array.from(parts.flatMap((p) => [...p])))).toBe(hex(shake128(m).squeeze(208)));
  });
  it('vetor conhecido: SHA3-256("abc")', () => {
    expect(hex(sha3_256(new TextEncoder().encode('abc')))).toBe('3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532');
  });
});

describe('ML-KEM: aritmética do anel', () => {
  const rnd = (seed: number) => Array.from({ length: 256 }, (_, i) => (i * i * 7 + i * seed * 13 + seed * 101) % Q);
  it('a NTT inversa desfaz a NTT', () => {
    const f = rnd(5);
    expect(invNtt(ntt(f))).toEqual(f);
  });
  it('multiplicar na NTT equivale à multiplicação de polinômios módulo X^256 + 1', () => {
    const f = rnd(3);
    const g = rnd(11);
    expect(invNtt(multiplyNtts(ntt(f), ntt(g)))).toEqual(polyMulSchoolbook(f, g));
  });
  it('compress e decompress só perdem a precisão descartada', () => {
    for (const d of [1, 4, 5, 10, 11]) {
      const maxErr = Math.ceil(Q / 2 ** (d + 1));
      for (let x = 0; x < Q; x++) {
        const back = decompress(compress(x, d), d);
        const diff = Math.min((back - x + Q) % Q, (x - back + Q) % Q);
        expect(diff).toBeLessThanOrEqual(maxErr);
      }
    }
  });
  it('centered devolve o valor com sinal', () => {
    expect(centered(3328)).toBe(-1);
    expect(centered(2)).toBe(2);
  });
});

const OID: Record<string, number> = { 'ML-KEM-512': 1, 'ML-KEM-768': 2, 'ML-KEM-1024': 3 };
const NODE_NAME: Record<string, string> = { 'ML-KEM-512': 'ml-kem-512', 'ML-KEM-768': 'ml-kem-768', 'ML-KEM-1024': 'ml-kem-1024' };
const nodeHasMlKem = (() => {
  try {
    nodeCrypto.generateKeyPairSync('ml-kem-768' as never);
    return true;
  } catch {
    return false;
  }
})();

// PKCS#8 com a semente (d || z) de 64 bytes: o OpenSSL deriva do mesmo par de chaves que o nosso.
const pkcs8FromSeed = (p: MlKemParams, seed: Uint8Array) =>
  Buffer.concat([Buffer.from('3054020100300b06096086480165030404', 'hex'), Buffer.from([OID[p.name]]), Buffer.from('04428040', 'hex'), Buffer.from(seed)]);

describe.each([ML_KEM_512, ML_KEM_768, ML_KEM_1024])('%s', (p) => {
  const d = bytes(32, 1);
  const z = bytes(32, 2);
  const m = bytes(32, 3);

  it('tamanhos de chave e de texto cifrado da FIPS 203', () => {
    const { ek, dk } = keyGen(d, z, p);
    const { c, K } = encaps(ek, m, p);
    expect(ek.length).toBe(sizes(p).ek);
    expect(dk.length).toBe(sizes(p).dk);
    expect(c.length).toBe(sizes(p).ciphertext);
    expect(K.length).toBe(32);
    expect([ek.length, dk.length, c.length]).toEqual(
      { 'ML-KEM-512': [800, 1632, 768], 'ML-KEM-768': [1184, 2400, 1088], 'ML-KEM-1024': [1568, 3168, 1568] }[p.name],
    );
  });

  it('Alice e Bob chegam à mesma chave', () => {
    const { ek, dk } = keyGen(d, z, p);
    const { c, K } = encaps(ek, m, p);
    expect(hex(decaps(dk, c, p))).toBe(hex(K));
  });

  it('é determinístico para as mesmas sementes', () => {
    expect(hex(keyGen(d, z, p).ek)).toBe(hex(keyGen(d, z, p).ek));
    const { ek } = keyGen(d, z, p);
    expect(hex(encaps(ek, m, p).c)).toBe(hex(encaps(ek, m, p).c));
  });

  it('texto cifrado adulterado gera outra chave, sem erro (rejeição implícita)', () => {
    const { ek, dk } = keyGen(d, z, p);
    const { c, K } = encaps(ek, m, p);
    const bad = c.slice();
    bad[5] ^= 0x01;
    const det = decapsDetailed(dk, bad, p);
    expect(det.valid).toBe(false);
    expect(hex(det.K)).not.toBe(hex(K));
    expect(hex(det.K)).toBe(hex(det.KBar));
    expect(decapsDetailed(dk, c, p).valid).toBe(true);
  });

  it('o ruído da decifragem fica longe do limiar: w está perto de 0 ou de q/2', () => {
    const { ek, dk } = keyGen(d, z, p);
    const { c } = encaps(ek, m, p);
    const { decrypt } = decapsDetailed(dk, c, p);
    const mu = encapsDetailed(ek, m, p).mu;
    const maxNoise = Math.max(...decrypt.w.map((w, i) => Math.abs(centered((w - mu[i] + Q) % Q))));
    expect(maxNoise).toBeLessThan(Q / 4); // abaixo de q/4 a decifragem é sempre correta
  });

  it('recusa chave pública com tamanho errado ou coeficiente fora de [0, q)', () => {
    const { ek } = keyGen(d, z, p);
    expect(() => encaps(ek.slice(1), m, p)).toThrow(/tamanho/);
    const bad = ek.slice();
    bad[0] = 0xff;
    bad[1] = 0xff; // coeficiente 0xfff = 4095 >= q
    expect(() => encaps(bad, m, p)).toThrow(/inválida/);
  });

  it('os valores intermediários da geração de chaves são coerentes', () => {
    const kg = keyGenDetailed(d, z, p);
    expect(kg.s).toHaveLength(p.k);
    expect(kg.A).toHaveLength(p.k);
    expect(kg.s.every((poly) => poly.every((c) => Math.abs(centered(c)) <= p.eta1))).toBe(true);
    expect(kg.ek.subarray(384 * p.k)).toEqual(kg.rho);
  });

  it.skipIf(!nodeHasMlKem)('a chave pública é idêntica à do OpenSSL para a mesma semente', () => {
    const seed = Uint8Array.from([...d, ...z]);
    const priv = nodeCrypto.createPrivateKey({ key: pkcs8FromSeed(p, seed), format: 'der', type: 'pkcs8' });
    expect(priv.asymmetricKeyType).toBe(NODE_NAME[p.name]);
    const spki = nodeCrypto.createPublicKey(priv).export({ format: 'der', type: 'spki' });
    expect(hex(spki.subarray(spki.length - sizes(p).ek))).toBe(hex(keyGen(d, z, p).ek));
  });

  it.skipIf(!nodeHasMlKem)('interoperam com o OpenSSL nos dois sentidos, inclusive a rejeição implícita', () => {
    const seed = Uint8Array.from([...d, ...z]);
    const priv = nodeCrypto.createPrivateKey({ key: pkcs8FromSeed(p, seed), format: 'der', type: 'pkcs8' });
    const pub = nodeCrypto.createPublicKey(priv);
    const mine = keyGen(d, z, p);
    // o OpenSSL encapsula para a chave pública; nós desencapsulamos
    const enc = kem.encapsulate(pub);
    expect(hex(decaps(mine.dk, new Uint8Array(enc.ciphertext), p))).toBe(hex(new Uint8Array(enc.sharedKey)));
    // nós encapsulamos; o OpenSSL desencapsula
    const own = encaps(mine.ek, m, p);
    expect(hex(new Uint8Array(kem.decapsulate(priv, Buffer.from(own.c))))).toBe(hex(own.K));
    // texto cifrado adulterado: a chave "de rejeição" também é a mesma nas duas implementações
    const bad = own.c.slice();
    bad[40] ^= 0x80;
    expect(hex(new Uint8Array(kem.decapsulate(priv, Buffer.from(bad))))).toBe(hex(decaps(mine.dk, bad, p)));
  });
});

// Valores obtidos com a semente fixa abaixo e conferidos contra o OpenSSL 3.5 (testes acima). Servem de vetor de
// regressão onde o Node não tem ML-KEM (o GitHub Actions usa o Node 22): SHA-256 de cada artefato.
describe('vetores de regressão (conferidos contra o OpenSSL 3.5)', () => {
  const sha = (b: Uint8Array) => nodeCrypto.createHash('sha256').update(b).digest('hex');
  const PINS = [
  { name: 'ML-KEM-512', ek: '8f4b02e8c3ce1069a58d496da7d9d82044f7810f65735758ffbe9d5aa1331675', dk: '75658382fc853fb12b3f466082ef066cb667f776054a20931c6c59131586a0a4', c: 'dba3e94cdbab42877096e728638b7ddefd037208dd377a4bdf33af219f53f9b7', K: 'f9e55c2e935d5e4f16c267e823d79cac98afbdf9caa77dcbbaf8bed77443c6cf' },
  { name: 'ML-KEM-768', ek: '455cd7e83ab9dd2f2ec7a5cf554eb70fe70be54e13e2d5651ec134252c0721db', dk: 'dcbb8dec212bb1c75e8b66af8af217e69a0be27a49669b953afa7f5dfeed0845', c: '5d4a35d788c280acd83dd7f35a8a1c4fff9ebe1d3d183fd52db5e83dc3bf07fe', K: 'ea41c37d3ce5bba768d467a333fa24a7dd26d0ed30da89d0eea75820dc791823' },
  { name: 'ML-KEM-1024', ek: 'f58bf3e55846b04d4672a7f945070a9e515276689654061f5a38c08efde0db8a', dk: '61447231e7b540a6b75e72c846ac12174446296d381b3fdffe747e2ddde3f1b0', c: 'bca9f903cc8b86a26e1f94f93de63cb600912f0de648b9f1c2d83251a5bdb39d', K: '8d13c5e79fb6eb003a57fc4095f6c82148ca5137b5f2950eece365ad1f96a164' },
  ];
  it.each(PINS)('$name', (pin) => {
    const p = [ML_KEM_512, ML_KEM_768, ML_KEM_1024].find((x) => x.name === pin.name)!;
    const { ek, dk } = keyGen(bytes(32, 1), bytes(32, 2), p);
    const { c, K } = encaps(ek, bytes(32, 3), p);
    expect([sha(ek), sha(dk), sha(c), hex(K)]).toEqual([pin.ek, pin.dk, pin.c, pin.K]);
  });
});
