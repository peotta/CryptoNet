import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import { chachaBlock, chachaCrypt, chachaKeystream, hex32, initialState, quarterRound, quarterRoundTrace, xorBytes } from '../src/crypto/chacha20';

const bytes = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const KEY = Uint8Array.from({ length: 32 }, (_, i) => i);
const ascii = (s: string) => new TextEncoder().encode(s);

describe('ChaCha20 (RFC 8439)', () => {
  it('quarter round: vetor da seção 2.1.1', () => {
    expect(quarterRound(0x11111111, 0x01020304, 0x9b8d6f43, 0x01234567).map(hex32)).toEqual(['ea2a92f4', 'cb1cf8ce', '4581472e', '5881c4bb']);
  });
  it('o rastro tem 12 operações ARX na ordem (4 somas, 4 XORs, 4 rotações) e termina no mesmo resultado', () => {
    const t = quarterRoundTrace(0x11111111, 0x01020304, 0x9b8d6f43, 0x01234567);
    expect(t).toHaveLength(12);
    expect(t.map((s) => s.op).join()).toBe('add,xor,rotl,add,xor,rotl,add,xor,rotl,add,xor,rotl');
    expect(t.filter((s) => s.rotate).map((s) => s.rotate)).toEqual([16, 12, 8, 7]);
    expect(t[0].a).toBe((0x11111111 + 0x01020304) >>> 0);
    expect(hex32(t[11].a)).toBe('ea2a92f4');
  });
  it('estado inicial: constantes, chave, contador e nonce (seção 2.3.2)', () => {
    const s = initialState(KEY, bytes('000000090000004a00000000'), 1);
    expect(s.map(hex32)).toEqual([
      '61707865', '3320646e', '79622d32', '6b206574',
      '03020100', '07060504', '0b0a0908', '0f0e0d0c',
      '13121110', '17161514', '1b1a1918', '1f1e1d1c',
      '00000001', '09000000', '4a000000', '00000000',
    ]);
  });
  it('bloco: vetor da seção 2.3.2', () => {
    const b = chachaBlock(KEY, bytes('000000090000004a00000000'), 1);
    expect(b.mixed.map(hex32).slice(0, 4)).toEqual(['837778ab', 'e238d763', 'a67ae21e', '5950bb2f']);
    expect(b.final.map(hex32).slice(0, 4)).toEqual(['e4e7f110', '15593bd1', '1fdd0f50', 'c47120a3']);
    expect(toHex(b.keystream)).toBe(
      '10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c068030422aa9ac3d46c4ed2826446079faa0914c2d705d98b02a2b5129cd1de164eb9cbd083e8a2503c4e',
    );
    expect(b.rounds).toHaveLength(20);
    expect(b.rounds.map((r) => r.kind).slice(0, 2)).toEqual(['coluna', 'diagonal']);
  });
  it('cifragem: vetor da seção 2.4.2', () => {
    const pt = ascii("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
    const ct = chachaCrypt(KEY, bytes('000000000000004a00000000'), 1, pt);
    expect(toHex(ct)).toBe(
      '6e2e359a2568f98041ba0728dd0d6981e97e7aec1d4360c20a27afccfd9fae0bf91b65c5524733ab8f593dabcd62b3571639d624e65152ab8f530c359f0861d807ca0dbf500d6a6156a38e088a22b65e52bc514d16ccf806818ce91ab77937365af90bbf74a35be6b40b8eedf2785e42874d',
    );
    expect(chachaCrypt(KEY, bytes('000000000000004a00000000'), 1, ct)).toEqual(pt);
  });
  it('o fluxo de chaves cobre vários blocos e é determinístico', () => {
    const n = new Uint8Array(12);
    const ks = chachaKeystream(KEY, n, 0, 150);
    expect(ks).toHaveLength(150);
    expect(ks.slice(64, 128)).toEqual(chachaBlock(KEY, n, 1).keystream);
    expect(chachaKeystream(KEY, n, 0, 150)).toEqual(ks);
  });
  it('reutilizar o nonce faz C1 xor C2 = P1 xor P2 (o fluxo de chaves some)', () => {
    const n = new Uint8Array(12);
    const p1 = ascii('ATAQUE AO AMANHECER');
    const p2 = ascii('RECUAR PARA A PONTE');
    const c1 = chachaCrypt(KEY, n, 1, p1);
    const c2 = chachaCrypt(KEY, n, 1, p2);
    expect(xorBytes(c1, c2)).toEqual(xorBytes(p1, p2));
  });
  it('é maleável: inverter um bit da cifra inverte o mesmo bit do texto claro', () => {
    const n = new Uint8Array(12);
    const p = ascii('PAGAR 100');
    const c = chachaCrypt(KEY, n, 1, p);
    c[6] ^= '1'.charCodeAt(0) ^ '9'.charCodeAt(0);
    expect(new TextDecoder().decode(chachaCrypt(KEY, n, 1, c))).toBe('PAGAR 900');
  });
  it('valida chave, nonce e contador', () => {
    expect(() => chachaBlock(new Uint8Array(16), new Uint8Array(12), 0)).toThrow(/32 bytes/);
    expect(() => chachaBlock(KEY, new Uint8Array(8), 0)).toThrow(/12 bytes/);
    expect(() => chachaBlock(KEY, new Uint8Array(12), -1)).toThrow(CryptoInputError);
    expect(() => chachaKeystream(KEY, new Uint8Array(12), 0xffffffff, 200)).toThrow(/estouraria/);
    expect(() => xorBytes(new Uint8Array(2), new Uint8Array(3))).toThrow(CryptoInputError);
  });
});
