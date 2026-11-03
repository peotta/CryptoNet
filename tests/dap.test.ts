import { createCipheriv, createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MAX_ATTEMPTS,
  buildTransData,
  checkFreshness,
  checkTag,
  concat,
  decryptCode,
  deriveK2,
  drawCode,
  drawIdentifier,
  encodeKeyShare,
  formatField,
  formatTimestamp,
  fromBase64,
  kdfInput,
  parseKeyShare,
  parseTimestamp,
  parseTransData,
  renderMask,
  sealChallenge,
  splitChallenge,
  splitKey,
  submitCode,
  toBase64,
  TEMPLATES,
  type PendingTransaction,
} from '../src/crypto/dap';
import { toHex, utf8Encode } from '../src/crypto/encoding';
import { engines } from '../src/crypto/engines';
import { fixedRandom, makeSeeds } from '../src/labs/dap/seeds';

const bytes = (n: number, seed = 1) => fixedRandom(seed)(n);
const customer = { id: '12345678901', keyId: 1, version: 1, keyTimestamp: 1_793_000_000 };
const TS = '261102133000';

describe('DAP: derivação de k2 (HMAC-SHA-512 com a chave-mestra)', () => {
  it('a entrada x tem o rótulo, os inteiros em ordem de rede e o ID', () => {
    const x = kdfInput(customer);
    expect(new TextDecoder().decode(x.slice(0, 9))).toBe('DAP-k2-v1');
    expect(x.length).toBe(9 + 4 + 4 + 2 + 11 + 8);
    expect(Array.from(x.slice(9, 13))).toEqual([0, 0, 0, 1]); // key_id
    expect(Array.from(x.slice(13, 17))).toEqual([0, 0, 0, 1]); // version
    expect(Array.from(x.slice(17, 19))).toEqual([0, 11]); // len(ID)
    expect(new TextDecoder().decode(x.slice(19, 30))).toBe('12345678901');
    expect(new DataView(x.buffer, x.byteOffset + 30, 8).getBigUint64(0)).toBe(1_793_000_000n);
  });

  it('k2 confere com o HMAC-SHA-512 do Node e muda com a versão e com o carimbo', async () => {
    const mk = bytes(64);
    const k2 = await deriveK2(mk, customer);
    expect(toHex(k2)).toBe(createHmac('sha512', mk).update(kdfInput(customer)).digest('hex'));
    expect(k2.length).toBe(64);
    expect(toHex(await deriveK2(mk, { ...customer, version: 2 }))).not.toBe(toHex(k2));
    expect(toHex(await deriveK2(mk, { ...customer, keyTimestamp: customer.keyTimestamp + 1 }))).not.toBe(toHex(k2));
  });

  it('a partição de k dá k\'1 (primeiros 32 octetos) e k\'2 (últimos 32)', () => {
    const k = bytes(64, 5);
    const { kMac, kEnc } = splitKey(k);
    expect(toHex(kMac)).toBe(toHex(k.slice(0, 32)));
    expect(toHex(kEnc)).toBe(toHex(k.slice(32)));
    expect(() => splitKey(bytes(32))).toThrow();
  });
});

describe('DAP: sorteios com rejeição', () => {
  it('drawCode usa seis dígitos e rejeita palavras acima do maior múltiplo de 10^6', () => {
    expect(drawCode(Uint8Array.from([0, 0, 0, 7, 9, 9, 9, 9]))).toBe('000007');
    // 0xFFFFFFFF excede 4.294.000.000 e é descartada; a palavra seguinte vale 1.234.567.
    const next = 1_234_567;
    const w = Uint8Array.from([0xff, 0xff, 0xff, 0xff, next >>> 24, (next >>> 16) & 255, (next >>> 8) & 255, next & 255]);
    expect(drawCode(w)).toBe('234567');
    expect(() => drawCode(Uint8Array.from([0xff, 0xff, 0xff, 0xff]))).toThrow();
  });

  it('drawIdentifier produz 20 caracteres de A a Z e 0 a 9 e descarta bytes com viés', () => {
    const id = drawIdentifier(bytes(48));
    expect(id).toMatch(/^[A-Z0-9]{20}$/);
    expect(drawIdentifier(Uint8Array.from([255, 254, 253, ...Array.from({ length: 30 }, (_, i) => i)]))).toBe('ABCDEFGHIJKLMNOPQRST');
    expect(() => drawIdentifier(bytes(5))).toThrow();
  });
});

describe('DAP: QR de troca de chaves (código 001)', () => {
  const enroll = '7QK2M9XW4HD1R8TZ5PB3';
  it('tem seis campos e o Check é o início do SHA-256 do texto anterior', async () => {
    const value = bytes(64, 3);
    const text = await encodeKeyShare({ share: '1', enroll, value });
    const f = text.split(';');
    expect(f).toHaveLength(6);
    expect(f.slice(0, 4)).toEqual(['099', '001', '1', enroll]);
    expect(f[4]).toHaveLength(88);
    expect(f[5]).toBe(createHash('sha256').update(f.slice(0, 5).join(';')).digest('hex').slice(0, 8).toUpperCase());
    const parsed = await parseKeyShare(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(toHex(parsed.qr.value)).toBe(toHex(value));
  });

  it('recusa campos a mais, versão, código, share, Enroll, tamanho e Check inválidos', async () => {
    const text = await encodeKeyShare({ share: '2', enroll, value: bytes(64) });
    const f = text.split(';');
    const reason = async (t: string) => {
      const r = await parseKeyShare(t);
      return r.ok ? 'ok' : r.reason;
    };
    expect(await reason(`${text};x`)).toBe('campos');
    expect(await reason(['098', ...f.slice(1)].join(';'))).toBe('versao');
    expect(await reason([f[0], '002', ...f.slice(2)].join(';'))).toBe('codigo');
    expect(await reason([f[0], f[1], '3', ...f.slice(3)].join(';'))).toBe('share');
    expect(await reason([f[0], f[1], f[2], 'curto', f[4], f[5]].join(';'))).toBe('enroll');
    expect(await reason([f[0], f[1], f[2], f[3], f[4].slice(4), f[5]].join(';'))).toBe('valor');
    expect(await reason([...f.slice(0, 5), '00000000'].join(';'))).toBe('check');
  });

  it('o Check não é autenticação: quem troca a metade recalcula o Check e o QR continua válido', async () => {
    const forged = await encodeKeyShare({ share: '1', enroll, value: bytes(64, 9) });
    expect((await parseKeyShare(forged)).ok).toBe(true);
  });
});

describe('DAP: trans_data, modelos e carimbo', () => {
  it('monta o exemplo do draft (código 818) e lê os campos de volta', () => {
    const td = buildTransData('7QK2M9XW4HD1R8TZ5PB3', '818', ['01234', '000000123456', '7', 'MARIA SILVA', '0000000150000', TS]);
    expect(td).toBe('7QK2M9XW4HD1R8TZ5PB3;099;818;01234;000000123456;7;MARIA SILVA;0000000150000;261102133000');
    const p = parseTransData(td);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.parsed.values.payee).toBe('MARIA SILVA');
      expect(renderMask(p.parsed.template, p.parsed.values)).toBe('Agência 01234, conta 000000123456-7\nFavorecido: MARIA SILVA\nValor: R$ 1.500,00\nData e hora: 02/11/2026 13:30:00 UTC');
    }
  });

  it('recusa ";" em campo, caractere fora do ASCII e campos fora do modelo', () => {
    expect(() => buildTransData('A'.repeat(20), '818', ['01234', '1', '7', 'A;B', '1', TS])).toThrow();
    expect(() => buildTransData('A'.repeat(20), '818', ['01234', '1', '7', 'JOÃO', '1', TS])).toThrow();
    const ok = 'A'.repeat(20);
    const reason = (t: string) => {
      const r = parseTransData(t);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason(`${ok};099;999;1`)).toBe('codigo');
    expect(reason(`${ok};098;818;1`)).toBe('versao');
    expect(reason(`${ok};099;818;01234`)).toBe('campos');
    expect(reason(`${ok};099;818;012345;1;7;X;1;${TS}`)).toBe('tipo'); // agência com 6 dígitos (máximo 5)
    expect(reason(`${ok};099;818;01234;1;7;maria;1;${TS}`)).toBe('tipo'); // minúsculas
    expect(reason(`${ok};099;818;01234;1;7;X;1;991302133000`)).toBe('carimbo');
    expect(reason(`curto;099;000;A;${TS}`)).toBe('nonce');
    expect(reason(`${ok};099;818;01234;1;7;X\u0001;1;${TS}`)).toBe('ascii');
  });

  it('carimbo YYMMDDHHMMSS em UTC: ida e volta e datas impossíveis', () => {
    const ms = Date.UTC(2026, 10, 2, 13, 30, 0);
    expect(formatTimestamp(ms)).toBe(TS);
    expect(parseTimestamp(TS)).toBe(ms);
    expect(parseTimestamp('260230120000')).toBeNull(); // 30 de fevereiro
    expect(parseTimestamp('26110213300')).toBeNull();
  });

  it('janela do MD: vencido acima de 120 s, futuro acima de 60 s à frente', () => {
    const g = Date.UTC(2026, 10, 2, 13, 30, 0);
    expect(checkFreshness(g, g + 120_000).state).toBe('ok');
    expect(checkFreshness(g, g + 121_000)).toEqual({ state: 'expired', ageSeconds: 121 });
    expect(checkFreshness(g, g - 60_000).state).toBe('ok');
    expect(checkFreshness(g, g - 61_000)).toEqual({ state: 'future', ageSeconds: -61 });
  });

  it('formata a moeda e a data', () => {
    const amount = TEMPLATES['818'].fields.find((f) => f.id === 'amount')!;
    expect(formatField(amount, '0000000000005')).toBe('R$ 0,05');
    expect(formatField(amount, '0000123456789')).toBe('R$ 1.234.567,89');
  });
});

describe('DAP: desafio trans_data | r\' | y', () => {
  const keys = splitKey(bytes(64, 4));
  const transData = buildTransData('7QK2M9XW4HD1R8TZ5PB3', '818', ['01234', '000000123456', '7', 'MARIA SILVA', '0000000150000', TS]);
  const iv = bytes(16, 6);

  it('r\' e y conferem com AES-256-CBC e HMAC-SHA-256 do Node', async () => {
    const ch = await sealChallenge(keys, transData, '431287', iv);
    const cipher = createCipheriv('aes-256-cbc', keys.kEnc, iv);
    const c = Buffer.concat([cipher.update('431287'), cipher.final()]);
    expect(ch.c.length).toBe(16);
    expect(toHex(ch.c)).toBe(c.toString('hex'));
    expect(toHex(ch.rPrime)).toBe(toHex(concat(iv, ch.c)));
    expect(ch.rPrime.length).toBe(32);
    expect(toHex(ch.y)).toBe(createHmac('sha256', keys.kMac).update(Buffer.concat([Buffer.from(transData), Buffer.from(ch.rPrime)])).digest('hex'));
    expect(ch.payload.length).toBe(transData.length + 64);
    expect(ch.base64).toBe(Buffer.from(ch.payload).toString('base64'));
  });

  it('o MD separa o desafio, confere y e recupera r_hat', async () => {
    const ch = await sealChallenge(keys, transData, '000042', iv);
    const split = splitChallenge(ch.base64)!;
    expect(split.transData).toBe(transData);
    expect(toHex(split.rPrime)).toBe(toHex(ch.rPrime));
    expect((await checkTag(keys.kMac, split)).equal).toBe(true);
    expect(await decryptCode(keys.kEnc, split.rPrime)).toBe('000042'); // zeros à esquerda preservados
  });

  it('qualquer octeto alterado em trans_data, r\' ou y faz a etiqueta falhar', async () => {
    const ch = await sealChallenge(keys, transData, '431287', iv);
    for (const pos of [0, 30, ch.payload.length - 64, ch.payload.length - 40, ch.payload.length - 1]) {
      const bad = ch.payload.slice();
      bad[pos] ^= 0x01;
      const split = splitChallenge(toBase64(bad))!;
      expect((await checkTag(keys.kMac, split)).equal, `octeto ${pos}`).toBe(false);
    }
  });

  it('uma chave k\'1 diferente nunca valida a etiqueta (Eva não forja y)', async () => {
    const ch = await sealChallenge(keys, transData, '431287', iv);
    const other = splitKey(bytes(64, 8));
    expect((await checkTag(other.kMac, splitChallenge(ch.base64)!)).equal).toBe(false);
  });

  it('a decifragem recusa preenchimento inválido e texto que não são seis dígitos', async () => {
    const ch = await sealChallenge(keys, transData, '431287', iv);
    expect(await decryptCode(splitKey(bytes(64, 8)).kEnc, ch.rPrime)).toBeNull();
    expect(await decryptCode(keys.kEnc, ch.rPrime.slice(0, 31))).toBeNull();
  });

  it('Base64 inválido ou curto não vira desafio', () => {
    expect(fromBase64('não é base64')).toBeNull();
    expect(splitChallenge('QUJD')).toBeNull();
    expect(splitChallenge('QUJDRA')).toBeNull(); // sem preenchimento
  });
});

describe('DAP: validação do código no e-Bank', () => {
  const g = Date.UTC(2026, 10, 2, 13, 30, 0);
  const fresh = (): PendingTransaction => ({ r: '123456', generatedAt: g, attempts: 0, status: 'pending' });

  it('código certo dentro de 120 s executa e invalida r', () => {
    const a = submitCode(fresh(), '123456', g + 45_000);
    expect(a.outcome).toBe('executed');
    expect(a.tx.status).toBe('executed');
    expect(submitCode(a.tx, '123456', g + 46_000).outcome).toBe('closed'); // repetição
  });

  it('depois de 120 s a transação é cancelada, mesmo com o código certo', () => {
    expect(submitCode(fresh(), '123456', g + 120_000).outcome).toBe('executed');
    const late = submitCode(fresh(), '123456', g + 121_000);
    expect(late.outcome).toBe('expired');
    expect(late.tx.status).toBe('cancelled');
  });

  it(`na ${MAX_ATTEMPTS}ª falha o desafio é invalidado e o código certo não vale mais`, () => {
    let tx = fresh();
    const outcomes: string[] = [];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const res = submitCode(tx, '000000', g + 5_000);
      tx = res.tx;
      outcomes.push(res.outcome);
    }
    expect(outcomes).toEqual(['wrong', 'wrong', 'locked']);
    expect(tx.status).toBe('cancelled');
    expect(submitCode(tx, '123456', g + 6_000).outcome).toBe('closed');
  });
});

describe('DAP: motor atrás da interface', () => {
  it('o conjunto completo tem o motor dap, que usa a Web Crypto', async () => {
    expect(engines.dap.kind).toBe('webcrypto');
    const seeds = makeSeeds(fixedRandom(1));
    const k2 = await engines.dap.deriveK2(seeds.mk, customer);
    expect(toHex(k2)).toBe(createHmac('sha512', seeds.mk).update(kdfInput(customer)).digest('hex'));
    expect(utf8Encode('x').length).toBe(1);
  });
});
