import { describe, expect, it } from 'vitest';
import { RFC_SECRET, base32Decode, base32Encode, checkRfcVectors, counterToBytes, hotp, timeCounter, totp, verifyTotp } from '../src/crypto/otpAuth';
import { toHex } from '../src/crypto/encoding';

const KEY = new TextEncoder().encode(RFC_SECRET);

describe('HOTP e TOTP (RFC 4226 e RFC 6238)', () => {
  it('reproduz todos os vetores publicados nas RFCs', async () => {
    const checks = await checkRfcVectors();
    expect(checks).toHaveLength(16);
    for (const c of checks) expect(c.obtained, c.label).toBe(c.expected);
  });
  it('expõe os valores intermediários do apêndice D da RFC 4226', async () => {
    const t = await hotp(KEY, 0n);
    expect(toHex(t.hmac)).toBe('cc93cf18508d94934c64b65d8ba7667fb7cde4b0');
    expect(t.offset).toBe(0);
    expect(toHex(t.fourBytes)).toBe('cc93cf18');
    expect(t.truncated).toBe(1284755224);
    expect(t.code).toBe('755224');
  });
  it('codifica o contador em 8 bytes big-endian', () => {
    expect(toHex(counterToBytes(1n))).toBe('0000000000000001');
    expect(toHex(counterToBytes(0x1234567890n))).toBe('0000001234567890');
    expect(() => counterToBytes(-1n)).toThrow();
  });
  it('calcula o contador de tempo em passos de 30 s', () => {
    expect(timeCounter(59)).toBe(1n);
    expect(timeCounter(60)).toBe(2n);
    expect(timeCounter(1111111109)).toBe(37037036n);
  });
  it('gera os vetores SHA-256 e SHA-512 da RFC 6238 (chaves de 32 e 64 bytes)', async () => {
    const k256 = new TextEncoder().encode('12345678901234567890123456789012');
    const k512 = new TextEncoder().encode('1234567890123456789012345678901234567890123456789012345678901234');
    expect((await totp(k256, 59, 8, 'SHA-256')).code).toBe('46119246');
    expect((await totp(k512, 59, 8, 'SHA-512')).code).toBe('90693936');
  });
  it('converte Base32 nos dois sentidos (RFC 4648)', () => {
    expect(base32Encode(KEY)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(new TextDecoder().decode(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'))).toBe(RFC_SECRET);
    expect(base32Encode(new TextEncoder().encode('foobar'))).toBe('MZXW6YTBOI');
    expect(() => base32Decode('1!')).toThrow();
  });
  it('rejeita parâmetros inválidos', async () => {
    await expect(hotp(new Uint8Array(0), 0n)).rejects.toThrow();
    await expect(hotp(KEY, 0n, 5)).rejects.toThrow();
  });
  it('valida com janela de um passo e recusa um código fora dela', async () => {
    const t = 1_700_000_010;
    const code = (await totp(KEY, t)).code;
    expect((await verifyTotp(KEY, t, code)).ok).toBe(true);
    expect((await verifyTotp(KEY, t + 30, code)).ok).toBe(true);
    const late = await verifyTotp(KEY, t + 90, code);
    expect(late.ok).toBe(false);
    expect(late.reason).toBe('fora-da-janela');
  });
  it('recusa o segundo uso de um código já aceito (RFC 6238, seção 5.2)', async () => {
    const t = 1_700_000_010;
    const code = (await totp(KEY, t)).code;
    const first = await verifyTotp(KEY, t, code);
    expect(first.ok).toBe(true);
    const again = await verifyTotp(KEY, t + 5, code, { lastAccepted: first.counter });
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('ja-usado');
  });
});
