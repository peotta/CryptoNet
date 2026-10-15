import { describe, expect, it } from 'vitest';
import {
  certificateVerifyContent,
  deriveSecret,
  earlyStages,
  ecdhSecret,
  ecdsaSign,
  ecdsaVerify,
  generateEcdh,
  generateEcdsa,
  handshakeMessage,
  handshakeSecrets,
  hkdfExpand,
  hkdfExpandLabel,
  hkdfExtract,
  HS,
  openRecord,
  recordNonce,
  sealRecord,
  simulateHandshake,
  trafficKeys,
} from '../src/crypto/tls13';
import { toHex } from '../src/crypto/encoding';

const bytes = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));

describe('HKDF e cronograma de chaves do TLS 1.3', () => {
  it('HKDF (RFC 5869, caso 1): extract e expand', async () => {
    const ikm = new Uint8Array(22).fill(0x0b);
    const salt = bytes('000102030405060708090a0b0c');
    const info = bytes('f0f1f2f3f4f5f6f7f8f9');
    const prk = await hkdfExtract(salt, ikm);
    expect(toHex(prk)).toBe('077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5');
    expect(toHex(await hkdfExpand(prk, info, 42))).toBe('3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865');
  });
  it('Early Secret e "derived" sem PSK (RFC 8448)', async () => {
    const { early, derivedEarly } = await earlyStages();
    expect(toHex(early)).toBe('33ad0a1c607ec03b09e6cd9893680ce210adf300aa1f2660e1b22e10f170f92a');
    expect(toHex(derivedEarly)).toBe('6f2615a108c702c5678f54fc9dbab69716c076189c48250cebeac3576c3611ba');
  });
  it('Handshake Secret a partir do segredo ECDHE (RFC 8448)', async () => {
    const { derivedEarly } = await earlyStages();
    const shared = bytes('8bd4054fb55b9d63fdfbacf9f04b9f0d35e6d63f537563efd46272900f89492d');
    const hs = await handshakeSecrets(derivedEarly, shared, new Uint8Array(32));
    expect(toHex(hs.handshake)).toBe('1dc826e93606aa6fdc0aadc12f741b01046aa6b99f691ed221a9f0ca043fbeac');
  });
  it('HKDF-Expand-Label usa o prefixo "tls13 " e depende do rótulo e do contexto', async () => {
    const s = new Uint8Array(32).fill(7);
    const a = toHex(await hkdfExpandLabel(s, 'key', new Uint8Array(0), 16));
    expect(a).toHaveLength(32);
    expect(toHex(await hkdfExpandLabel(s, 'iv', new Uint8Array(0), 16))).not.toBe(a);
    expect(toHex(await hkdfExpandLabel(s, 'key', Uint8Array.of(1), 16))).not.toBe(a);
    expect(toHex(await deriveSecret(s, 'derived', new Uint8Array(32)))).toHaveLength(64);
  });
  it('as chaves de tráfego têm 16, 12 e 32 bytes', async () => {
    const k = await trafficKeys(new Uint8Array(32).fill(1));
    expect([k.key.length, k.iv.length, k.finishedKey.length]).toEqual([16, 12, 32]);
  });
});

describe('ECDHE, ECDSA e registros', () => {
  it('os dois lados do ECDHE chegam ao mesmo segredo', async () => {
    const a = await generateEcdh();
    const b = await generateEcdh();
    expect(a.publicRaw).toHaveLength(65);
    expect(toHex(await ecdhSecret(a.privateKey, b.publicRaw))).toBe(toHex(await ecdhSecret(b.privateKey, a.publicRaw)));
  });
  it('o ECDSA verifica a assinatura e rejeita dados alterados e outra chave', async () => {
    const k = await generateEcdsa();
    const other = await generateEcdsa();
    const sig = await ecdsaSign(k.privateKey, Uint8Array.of(1, 2, 3));
    expect(sig).toHaveLength(64);
    expect(await ecdsaVerify(k.publicRaw, sig, Uint8Array.of(1, 2, 3))).toBe(true);
    expect(await ecdsaVerify(k.publicRaw, sig, Uint8Array.of(1, 2, 4))).toBe(false);
    expect(await ecdsaVerify(other.publicRaw, sig, Uint8Array.of(1, 2, 3))).toBe(false);
  });
  it('o nonce do registro é o IV com XOR do número de sequência', () => {
    const iv = new Uint8Array(12).fill(0xff);
    expect(toHex(recordNonce(iv, 0))).toBe('ffffffffffffffffffffffff');
    expect(toHex(recordNonce(iv, 1))).toBe('fffffffffffffffffffffffe');
    expect(toHex(recordNonce(new Uint8Array(12), 258))).toBe('000000000000000000000102');
  });
  it('um registro protegido é aberto, e uma alteração é rejeitada pela etiqueta GCM', async () => {
    const keys = await trafficKeys(new Uint8Array(32).fill(9));
    const rec = await sealRecord(keys, 0, Uint8Array.of(72, 105), 0x17);
    expect(rec.slice(0, 3)).toEqual(Uint8Array.of(0x17, 3, 3));
    const open = await openRecord(keys, 0, rec);
    expect(open).toEqual({ content: Uint8Array.of(72, 105), type: 0x17 });
    const bad = Uint8Array.from(rec);
    bad[6] ^= 1;
    await expect(openRecord(keys, 0, bad)).rejects.toThrow();
    await expect(openRecord(keys, 1, rec)).rejects.toThrow(); // sequência errada
  });
  it('mensagens de handshake têm tipo, comprimento de 3 bytes e corpo', () => {
    expect(handshakeMessage(HS.finished, Uint8Array.of(1, 2, 3))).toEqual(Uint8Array.of(20, 0, 0, 3, 1, 2, 3));
    expect(certificateVerifyContent(new Uint8Array(32))).toHaveLength(64 + 33 + 1 + 32);
  });
});

describe('o handshake completo', () => {
  it('sem Eva ativa: Bob recebe a mensagem e todas as verificações passam', async () => {
    const h = await simulateHandshake({ serverName: 'banco.exemplo', message: 'GET /saldo', scenario: 'normal', clientVerifies: true });
    expect(h.certificateValid && h.certVerifyValid && h.finishedValid).toBe(true);
    expect(h.aborted).toBe(false);
    expect(h.received).toBe('GET /saldo');
    expect(h.evaReads).toBe(false);
    expect(h.ok).toBe(true);
    expect(h.sharedSecret).toHaveLength(64);
    expect(h.handshakeSecret).toHaveLength(64);
    expect(h.early).toBe('33ad0a1c607ec03b09e6cd9893680ce210adf300aa1f2660e1b22e10f170f92a');
    expect(h.clientHs).not.toBe(h.serverHs);
    expect(h.clientAp).not.toBe(h.serverAp);
    expect(h.appRecord).not.toContain('474554'); // "GET" em hex não aparece na cifra
    expect(h.passiveEvaDerives).toBe(false);
  });
  it('cada handshake usa chaves novas (sigilo adiante)', async () => {
    const x = await simulateHandshake({ serverName: 'a.exemplo', message: 'oi', scenario: 'normal', clientVerifies: true });
    const y = await simulateHandshake({ serverName: 'a.exemplo', message: 'oi', scenario: 'normal', clientVerifies: true });
    expect(x.sharedSecret).not.toBe(y.sharedSecret);
    expect(x.clientAp).not.toBe(y.clientAp);
  });
  it('com Eva ativa e Alice verificando, o CertificateVerify falha e o handshake é interrompido', async () => {
    const h = await simulateHandshake({ serverName: 'banco.exemplo', message: 'senha 1234', scenario: 'mitm', clientVerifies: true });
    expect(h.certificateValid).toBe(true); // o certificado verdadeiro é público e pode ser repetido
    expect(h.certVerifyValid).toBe(false); // mas Eva não pode assinar como o servidor
    expect(h.finishedValid).toBe(true); // o Finished sozinho não autentica a identidade
    expect(h.aborted).toBe(true);
    expect(h.abortReason).toMatch(/CertificateVerify inválido/);
    expect(h.received).toBeNull();
    expect(h.evaReads).toBe(false);
    expect(h.ok).toBe(true);
  });
  it('com Alice sem verificar, Eva lê a mensagem', async () => {
    const h = await simulateHandshake({ serverName: 'banco.exemplo', message: 'senha 1234', scenario: 'mitm', clientVerifies: false });
    expect(h.aborted).toBe(false);
    expect(h.evaReads).toBe(true);
    expect(h.received).toBe('senha 1234');
    expect(h.ok).toBe(false);
    expect(h.responderPub).not.toBe(h.serverPub);
  });
  it('valida o nome do servidor e a mensagem', async () => {
    await expect(simulateHandshake({ serverName: 'x y', message: 'a', scenario: 'normal', clientVerifies: true })).rejects.toThrow(/Nome do servidor/);
    await expect(simulateHandshake({ serverName: 'a.exemplo', message: '', scenario: 'normal', clientVerifies: true })).rejects.toThrow(/Digite a mensagem/);
    await expect(simulateHandshake({ serverName: 'a.exemplo', message: 'x'.repeat(201), scenario: 'normal', clientVerifies: true })).rejects.toThrow(/no máximo 200/);
  });
});
