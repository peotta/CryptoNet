import { createCipheriv, createDecipheriv } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  SEMI_WEAK_PAIRS,
  WEAK_KEYS,
  bitsToBin,
  bitsToHex,
  candidateKey,
  cbcDecrypt,
  cbcEncrypt,
  complementBytes,
  desBlock,
  desTrace,
  effectiveBits,
  hammingBits,
  hasOddParity,
  keySchedule,
  pkcs7Pad,
  pkcs7Unpad,
  searchKey,
  setOddParity,
  tdesBlock,
} from '../src/crypto/des';
import { fromHex, toHex } from '../src/crypto/encoding';

const K = fromHex('133457799bbcdff1');
const P = fromHex('0123456789abcdef');

describe('DES: vetores conhecidos', () => {
  it('133457799BBCDFF1 cifra 0123456789ABCDEF em 85E813540F0AB405', () => {
    expect(toHex(desBlock(K, P))).toBe('85e813540f0ab405');
    expect(toHex(desBlock(K, fromHex('85e813540f0ab405'), true))).toBe('0123456789abcdef');
  });
  it('vetor clássico de chave 0101010101010101', () => {
    expect(toHex(desBlock(fromHex('0101010101010101'), fromHex('8000000000000000')))).toBe('95f8a5e5dd31d900');
    expect(toHex(desBlock(fromHex('8001010101010101'), fromHex('0000000000000000')))).toBe('95a8d72813daa94d');
  });
  it('as subchaves do exemplo conhecido (K1 e K16)', () => {
    const ks = keySchedule(K);
    expect(bitsToBin(ks.rounds[0].key, 6)).toBe('000110 110000 001011 101111 111111 000111 000001 110010');
    expect(bitsToBin(ks.rounds[15].key, 6)).toBe('110010 110011 110110 001011 000011 100001 011111 110101');
    expect(bitsToBin(ks.pc1, 7)).toBe('1111000 0110011 0010101 0101111 0101010 1011001 1001111 0001111');
  });
  it('o rastro da primeira rodada confere com o exemplo conhecido', () => {
    const t = desTrace(K, P);
    expect(bitsToBin(t.afterIp.slice(0, 32), 4)).toBe('1100 1100 0000 0000 1100 1100 1111 1111');
    expect(bitsToBin(t.afterIp.slice(32), 4)).toBe('1111 0000 1010 1010 1111 0000 1010 1010');
    const r1 = t.rounds[0];
    expect(bitsToBin(r1.expanded, 6)).toBe('011110 100001 010101 010101 011110 100001 010101 010101');
    expect(bitsToBin(r1.mixed, 6)).toBe('011000 010001 011110 111010 100001 100110 010100 100111');
    expect(bitsToBin(r1.sOut, 4)).toBe('0101 1100 1000 0010 1011 0101 1001 0111');
    expect(bitsToBin(r1.f, 4)).toBe('0010 0011 0100 1010 1010 1001 1011 1011');
    expect(bitsToBin(r1.newR, 4)).toBe('1110 1111 0100 1010 0110 0101 0100 0100');
    expect(bitsToHex(t.output)).toBe('85e813540f0ab405');
    expect(t.rounds).toHaveLength(16);
  });
  it('o rastro de decifragem inverte a ordem das subchaves', () => {
    const t = desTrace(K, fromHex('85e813540f0ab405'), true);
    expect(bitsToHex(t.output)).toBe('0123456789abcdef');
    expect(bitsToHex(t.rounds[0].subkey)).toBe(bitsToHex(keySchedule(K).rounds[15].key));
  });
  it('rejeita tamanhos inválidos', () => {
    expect(() => desBlock(new Uint8Array(7), P)).toThrow(/8 bytes/);
    expect(() => desBlock(K, new Uint8Array(9))).toThrow(/8 bytes/);
  });
});

describe('DES: conferência com o OpenSSL (via Triple DES com a mesma chave)', () => {
  const ref = (key: Uint8Array, data: Uint8Array, enc: boolean) => {
    const k24 = Buffer.concat([key, key, key]);
    const c = (enc ? createCipheriv : createDecipheriv)('des-ede3-ecb', k24, null);
    c.setAutoPadding(false);
    return new Uint8Array(Buffer.concat([c.update(data), c.final()]));
  };
  it('mil blocos aleatórios', () => {
    for (let i = 0; i < 200; i++) {
      const key = crypto.getRandomValues(new Uint8Array(8));
      const blk = crypto.getRandomValues(new Uint8Array(8));
      expect(toHex(desBlock(key, blk))).toBe(toHex(ref(key, blk, true)));
      expect(toHex(desBlock(key, blk, true))).toBe(toHex(ref(key, blk, false)));
    }
  });
  it('Triple DES EDE com três chaves distintas', () => {
    for (let i = 0; i < 100; i++) {
      const [a, b, c] = [0, 1, 2].map(() => crypto.getRandomValues(new Uint8Array(8)));
      const blk = crypto.getRandomValues(new Uint8Array(8));
      const e = createCipheriv('des-ede3-ecb', Buffer.concat([a, b, c]), null);
      e.setAutoPadding(false);
      const expected = Buffer.concat([e.update(blk), e.final()]);
      expect(toHex(tdesBlock(a, b, c, blk))).toBe(expected.toString('hex'));
      expect(toHex(tdesBlock(a, b, c, tdesBlock(a, b, c, blk), true))).toBe(toHex(blk));
    }
  });
  it('com K1 = K2 = K3 o Triple DES equivale ao DES', () => {
    expect(toHex(tdesBlock(K, K, K, P))).toBe(toHex(desBlock(K, P)));
  });
  it('CBC com preenchimento confere com o OpenSSL (Triple DES) e decifra de volta', () => {
    const [a, b, c] = [0, 1, 2].map(() => crypto.getRandomValues(new Uint8Array(8)));
    const iv = crypto.getRandomValues(new Uint8Array(8));
    const msg = new TextEncoder().encode('PAGAR R$ 1000,00 PARA BOB');
    const e = createCipheriv('des-ede3-cbc', Buffer.concat([a, b, c]), iv);
    const expected = Buffer.concat([e.update(msg), e.final()]);
    const mine = cbcEncrypt([a, b, c], iv, msg);
    expect(toHex(mine)).toBe(expected.toString('hex'));
    const back = cbcDecrypt([a, b, c], iv, mine);
    expect(new TextDecoder().decode(back.plain!)).toBe('PAGAR R$ 1000,00 PARA BOB');
    // DES simples em CBC: uma chave
    const one = cbcEncrypt([K], iv, msg);
    expect(new TextDecoder().decode(cbcDecrypt([K], iv, one).plain!)).toBe('PAGAR R$ 1000,00 PARA BOB');
  });
});

describe('DES: propriedades', () => {
  it('propriedade do complemento: E(~K, ~P) = ~E(K, P)', () => {
    for (let i = 0; i < 20; i++) {
      const key = crypto.getRandomValues(new Uint8Array(8));
      const blk = crypto.getRandomValues(new Uint8Array(8));
      expect(toHex(desBlock(complementBytes(key), complementBytes(blk)))).toBe(toHex(complementBytes(desBlock(key, blk))));
    }
  });
  it('chaves fracas: cifrar duas vezes devolve o texto claro, e as 16 subchaves se reduzem a 1 ou 2 valores', () => {
    for (const { key } of WEAK_KEYS) {
      expect(toHex(desBlock(key, desBlock(key, P)))).toBe(toHex(P));
      expect(new Set(keySchedule(key).rounds.map((r) => bitsToHex(r.key))).size).toBeLessThanOrEqual(2);
    }
    expect(new Set(keySchedule(WEAK_KEYS[0].key).rounds.map((r) => bitsToHex(r.key))).size).toBe(1);
  });
  it('chaves semifracas: o par se desfaz', () => {
    for (const [a, b] of SEMI_WEAK_PAIRS) expect(toHex(desBlock(b, desBlock(a, P)))).toBe(toHex(P));
  });
  it('efeito avalanche: um bit do claro muda cerca de metade do bloco', () => {
    const flipped = P.slice();
    flipped[0] ^= 0x80;
    const d = hammingBits(desTrace(K, P).output, desTrace(K, flipped).output);
    expect(d).toBeGreaterThan(16);
    expect(d).toBeLessThan(48);
  });
  it('paridade da chave: os bits de paridade não mudam o resultado', () => {
    const noParity = K.map((b) => b & 0xfe);
    expect(hasOddParity(K)).toBe(true);
    expect(hasOddParity(noParity)).toBe(false);
    expect(toHex(setOddParity(noParity))).toBe(toHex(K));
    expect(toHex(desBlock(noParity, P))).toBe(toHex(desBlock(K, P)));
  });
  it('PKCS#7: preenche e remove; rejeita preenchimento inválido', () => {
    expect(pkcs7Pad(new Uint8Array(8))).toHaveLength(16);
    expect(pkcs7Unpad(pkcs7Pad(Uint8Array.of(1, 2, 3)))).toEqual(Uint8Array.of(1, 2, 3));
    expect(pkcs7Unpad(new Uint8Array(8))).toBeNull();
  });
});

describe('DES: busca exaustiva em escala didática', () => {
  it('encontra a chave quando só os últimos n bits são desconhecidos', async () => {
    const base = effectiveBits(setOddParity(fromHex('4a6f7365466f7231')));
    const secret = candidateKey(base, 10, 777);
    const cipher = desBlock(secret, P);
    const r = await searchKey(P, cipher, base, 10);
    expect(r.key && toHex(r.key)).toBe(toHex(secret));
    expect(r.tries).toBe(778);
    expect(r.space).toBe(1024);
  });
  it('devolve null se a chave não está no espaço de busca e valida n', async () => {
    const base = effectiveBits(setOddParity(fromHex('4a6f7365466f7231')));
    const outside = candidateKey(base, 12, 3000);
    const r = await searchKey(P, desBlock(outside, P), base, 8);
    expect(r.key).toBeNull();
    expect(r.tries).toBe(256);
    await expect(searchKey(P, P, base, 0)).rejects.toThrow(/bits desconhecidos/);
    await expect(searchKey(P, P, base, 25)).rejects.toThrow(/bits desconhecidos/);
  });
  it('mede a velocidade (informativo)', async () => {
    const base = effectiveBits(setOddParity(fromHex('4a6f7365466f7231')));
    const r = await searchKey(P, desBlock(candidateKey(base, 14, 16383), P), base, 14);
    console.log(`DES: ${Math.round(r.rate)} chaves/s`);
    expect(r.key).not.toBeNull();
  });
});
