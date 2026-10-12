import { createCipheriv, createDecipheriv } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  aesBlockWebCrypto,
  cbcDecrypt,
  cbcEncrypt,
  ctrXor,
  decryptBlock,
  ecbDecrypt,
  ecbEncrypt,
  encryptBlock,
  expandKey,
  gcmDecrypt,
  gcmEncrypt,
  INV_SBOX,
  padWithSpaces,
  SBOX,
  splitBlocks,
  traceEncrypt,
  invMixColumns,
  mixColumns,
  shiftRows,
  invShiftRows,
} from '../src/crypto/aes';
import { toHex, utf8Encode } from '../src/crypto/encoding';
import { randomBytes } from '../src/crypto/random';

const bytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
const range = (n: number) => Uint8Array.from({ length: n }, (_, i) => i);
const PT = bytes('00112233445566778899aabbccddeeff');

describe('AES: vetores do FIPS 197 (apêndice C)', () => {
  it.each([
    [16, '69c4e0d86a7b0430d8cdb78070b4c55a'],
    [24, 'dda97ca4864cdfe06eaf70a0ec0d7191'],
    [32, '8ea2b7ca516745bfeafc49904b496089'],
  ])('AES com chave de %i bytes', (keyLen, expected) => {
    const rk = expandKey(range(keyLen));
    expect(rk).toHaveLength(keyLen / 4 + 7);
    const ct = encryptBlock(rk, PT);
    expect(toHex(ct)).toBe(expected);
    expect(toHex(decryptBlock(rk, ct))).toBe(toHex(PT));
  });
  it('S-box gerada: valores conhecidos e inversa consistente', () => {
    expect(SBOX[0x00]).toBe(0x63);
    expect(SBOX[0x01]).toBe(0x7c);
    expect(SBOX[0x53]).toBe(0xed); // exemplo do FIPS 197
    expect(SBOX[0xff]).toBe(0x16);
    for (let i = 0; i < 256; i++) expect(INV_SBOX[SBOX[i]]).toBe(i);
    expect(new Set(SBOX).size).toBe(256); // bijeção
  });
  it('a expansão da chave de 128 bits gera a última chave de rodada do FIPS 197 (A.1)', () => {
    const rk = expandKey(bytes('2b7e151628aed2a6abf7158809cf4f3c'));
    expect(toHex(rk[1])).toBe('a0fafe1788542cb123a339392a6c7605');
    expect(toHex(rk[10])).toBe('d014f9a8c9ee2589e13f0cc8b6630ca6');
  });
  it('MixColumns do exemplo clássico e inversas', () => {
    const col = bytes('db135345f20a225c01010101c6c6c6c6'); // colunas do exemplo de Wikipedia / FIPS
    expect(toHex(mixColumns(col))).toBe('8e4da1bc9fdc589d01010101c6c6c6c6');
    expect(toHex(invMixColumns(mixColumns(PT)))).toBe(toHex(PT));
    expect(toHex(invShiftRows(shiftRows(PT)))).toBe(toHex(PT));
  });
  it('rejeita chaves e blocos inválidos', () => {
    expect(() => expandKey(new Uint8Array(15))).toThrow();
    expect(() => encryptBlock(expandKey(range(16)), new Uint8Array(15))).toThrow();
  });
});

describe('AES didático confere com node:crypto e com a Web Crypto', () => {
  it.each([16, 24, 32])('ECB, CBC e CTR com chave de %i bytes', (keyLen) => {
    const key = randomBytes(keyLen);
    const pt = randomBytes(16 * 5);
    const iv = randomBytes(16);
    const names = { 16: 'aes-128', 24: 'aes-192', 32: 'aes-256' } as const;
    const n = names[keyLen as 16 | 24 | 32];

    const ecb = createCipheriv(`${n}-ecb`, key, null);
    ecb.setAutoPadding(false);
    expect(toHex(ecbEncrypt(key, pt))).toBe(Buffer.concat([ecb.update(pt), ecb.final()]).toString('hex'));

    const cbc = createCipheriv(`${n}-cbc`, key, iv);
    cbc.setAutoPadding(false);
    expect(toHex(cbcEncrypt(key, iv, pt))).toBe(Buffer.concat([cbc.update(pt), cbc.final()]).toString('hex'));

    const nonce = iv.slice(0, 12);
    const ctr = createCipheriv(`${n}-ctr`, key, Buffer.concat([nonce, Buffer.alloc(4)]));
    expect(toHex(ctrXor(key, nonce, pt))).toBe(Buffer.concat([ctr.update(pt), ctr.final()]).toString('hex'));
  });
  it('decifra o que cifra, em todos os modos', () => {
    const key = randomBytes(16);
    const iv = randomBytes(16);
    const pt = randomBytes(64);
    expect(toHex(ecbDecrypt(key, ecbEncrypt(key, pt)))).toBe(toHex(pt));
    expect(toHex(cbcDecrypt(key, iv, cbcEncrypt(key, iv, pt)))).toBe(toHex(pt));
    expect(toHex(ctrXor(key, iv.slice(0, 12), ctrXor(key, iv.slice(0, 12), pt)))).toBe(toHex(pt));
  });
  it('CTR cifra comprimentos que não são múltiplos de 16 e concorda com node:crypto', () => {
    const key = randomBytes(16);
    const nonce = randomBytes(12);
    const pt = randomBytes(37);
    const c = createCipheriv('aes-128-ctr', key, Buffer.concat([nonce, Buffer.alloc(4)]));
    expect(toHex(ctrXor(key, nonce, pt))).toBe(Buffer.concat([c.update(pt), c.final()]).toString('hex'));
  });
  it('um bloco concorda com a Web Crypto', async () => {
    const key = range(16);
    expect(toHex(await aesBlockWebCrypto(key, PT))).toBe('69c4e0d86a7b0430d8cdb78070b4c55a');
    const k2 = randomBytes(32);
    const b = randomBytes(16);
    expect(toHex(await aesBlockWebCrypto(k2, b))).toBe(toHex(encryptBlock(expandKey(k2), b)));
  });
  it('CBC didático concorda com o AES-CBC da Web Crypto (blocos completos)', async () => {
    const key = randomBytes(16);
    const iv = randomBytes(16);
    const pt = randomBytes(48);
    const k = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-CBC', false, ['encrypt']);
    const real = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, k, pt as BufferSource));
    expect(toHex(real.slice(0, 48))).toBe(toHex(cbcEncrypt(key, iv, pt)));
  });
  it('CTR didático concorda com o AES-CTR da Web Crypto', async () => {
    const key = randomBytes(16);
    const nonce = randomBytes(12);
    const pt = randomBytes(48);
    const k = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-CTR', false, ['encrypt']);
    const counter = new Uint8Array(16);
    counter.set(nonce);
    const real = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CTR', counter: counter as BufferSource, length: 32 }, k, pt as BufferSource));
    expect(toHex(real)).toBe(toHex(ctrXor(key, nonce, pt)));
  });
});

describe('rastro das rodadas', () => {
  it('AES-128 tem 1 + 4 + 9*4 + 3 + ... operações e termina no texto cifrado', () => {
    const rk = expandKey(range(16));
    const t = traceEncrypt(rk, PT);
    // entrada + AddRoundKey inicial + 9 rodadas completas (4 ops) + rodada final (3 ops)
    expect(t).toHaveLength(2 + 9 * 4 + 3);
    expect(toHex(t[t.length - 1].state)).toBe('69c4e0d86a7b0430d8cdb78070b4c55a');
    expect(t[1].op).toBe('AddRoundKey');
    expect(toHex(t[1].state)).toBe('00102030405060708090a0b0c0d0e0f0'); // FIPS 197, C.1: início da rodada 1
    expect(t.filter((s) => s.round === 10).map((s) => s.op)).toEqual(['SubBytes', 'ShiftRows', 'AddRoundKey']);
  });
  it('o primeiro SubBytes do FIPS 197 (C.1) confere', () => {
    const t = traceEncrypt(expandKey(range(16)), PT);
    expect(toHex(t[2].state)).toBe('63cab7040953d051cd60e0e7ba70e18c');
    expect(toHex(t[3].state)).toBe('6353e08c0960e104cd70b751bacad0e7');
    expect(toHex(t[4].state)).toBe('5f72641557f5bc92f7be3b291db9f91a');
  });
});

describe('modos de operação e adulteração (o que Eva consegue fazer)', () => {
  const key = randomBytes(16);
  const iv = randomBytes(16);
  const pt = padWithSpaces(utf8Encode('PAGAR R$ 1000,00PAGAR R$ 1000,00CONFIRMADO POR B'));

  it('o preenchimento didático completa até múltiplo de 16 bytes', () => {
    expect(padWithSpaces(utf8Encode('abc')).length).toBe(16);
    expect(padWithSpaces(new Uint8Array(16)).length).toBe(16);
    expect(padWithSpaces(new Uint8Array(17)).length).toBe(32);
    expect(padWithSpaces(new Uint8Array(0)).length).toBe(16);
  });
  it('ECB vaza padrões: blocos iguais geram cifras iguais', () => {
    const ct = splitBlocks(ecbEncrypt(key, pt)).map(toHex);
    expect(ct[0]).toBe(ct[1]);
    expect(ct[2]).not.toBe(ct[0]);
  });
  it('CBC e CTR não repetem blocos de cifra para blocos de texto claro iguais', () => {
    for (const ct of [cbcEncrypt(key, iv, pt), ctrXor(key, iv.slice(0, 12), pt)]) {
      const hex = splitBlocks(ct).map(toHex);
      expect(new Set(hex).size).toBe(hex.length);
    }
  });
  it('ECB: inverter 1 bit do cifrado corrompe só o bloco atingido', () => {
    const ct = ecbEncrypt(key, pt);
    ct[16] ^= 1; // bloco 2
    const rec = splitBlocks(ecbDecrypt(key, ct));
    const orig = splitBlocks(pt);
    expect(toHex(rec[0])).toBe(toHex(orig[0]));
    expect(toHex(rec[1])).not.toBe(toHex(orig[1]));
    expect(toHex(rec[2])).toBe(toHex(orig[2]));
  });
  it('CBC: inverter 1 bit no bloco k corrompe o bloco k e inverte o MESMO bit no bloco k + 1 (ataque de manipulação de bits)', () => {
    const ct = cbcEncrypt(key, iv, pt);
    ct[0] ^= 0x01; // bloco 1, bit 0 do byte 0
    const rec = splitBlocks(cbcDecrypt(key, iv, ct));
    const orig = splitBlocks(pt);
    expect(toHex(rec[0])).not.toBe(toHex(orig[0])); // corrompido
    expect(rec[1][0]).toBe(orig[1][0] ^ 0x01); // bit controlado por Eva
    expect(toHex(rec[1].slice(1))).toBe(toHex(orig[1].slice(1)));
    expect(toHex(rec[2])).toBe(toHex(orig[2]));
  });
  it('CTR: inverter 1 bit do cifrado inverte exatamente o mesmo bit do texto claro (maleável)', () => {
    const nonce = iv.slice(0, 12);
    const ct = ctrXor(key, nonce, pt);
    ct[17] ^= 0x04;
    const rec = ctrXor(key, nonce, ct);
    const diff = rec.map((b, i) => b ^ pt[i]);
    expect(diff.filter((d) => d !== 0)).toHaveLength(1);
    expect(diff[17]).toBe(0x04);
  });
  it('GCM: cifra, decifra e REJEITA qualquer adulteração (autenticado)', async () => {
    const nonce = iv.slice(0, 12);
    const sealed = await gcmEncrypt(key, nonce, pt);
    expect(sealed.length).toBe(pt.length + 16);
    expect(toHex(await gcmDecrypt(key, nonce, sealed))).toBe(toHex(pt));
    const bad = new Uint8Array(sealed);
    bad[3] ^= 1;
    await expect(gcmDecrypt(key, nonce, bad)).rejects.toThrow();
    const badTag = new Uint8Array(sealed);
    badTag[badTag.length - 1] ^= 1;
    await expect(gcmDecrypt(key, nonce, badTag)).rejects.toThrow();
  });
  it('GCM com nonce diferente gera cifra diferente para o mesmo texto', async () => {
    const a = await gcmEncrypt(key, randomBytes(12), pt);
    const b = await gcmEncrypt(key, randomBytes(12), pt);
    expect(toHex(a)).not.toBe(toHex(b));
  });
  it('comprimentos inválidos são rejeitados', () => {
    expect(() => ecbEncrypt(key, new Uint8Array(15))).toThrow();
    expect(() => cbcEncrypt(key, iv, new Uint8Array(0))).toThrow();
    expect(() => ctrXor(key, new Uint8Array(8), pt)).toThrow();
  });
  it('decifrador com node:crypto aceita o que o didático cifra (CBC)', () => {
    const ct = cbcEncrypt(key, iv, pt);
    const d = createDecipheriv('aes-128-cbc', key, iv);
    d.setAutoPadding(false);
    expect(Buffer.concat([d.update(ct), d.final()]).toString('hex')).toBe(toHex(pt));
  });
});
