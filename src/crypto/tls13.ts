// HANDSHAKE DO TLS 1.3 (RFC 8446), versão didática de 1-RTT com a suíte TLS_AES_128_GCM_SHA256 e o grupo P-256.
// Reais (Web Crypto): ECDHE, HKDF-SHA-256 com o cronograma de chaves da seção 7.1, ECDSA P-256 (CertificateVerify),
// HMAC (Finished) e AES-128-GCM (registros). Simplificações: mensagens com campos reduzidos (sem extensões completas),
// "certificado" didático assinado por uma autoridade fictícia, um único registro por voo. Não use para proteger dados reais.
import { digest, hmacWebCrypto } from './hash';
import { toHex, utf8Encode } from './encoding';
import { randomBytes } from './random';

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto indisponível: use HTTPS ou localhost em um navegador atual.');
  return s;
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const u8 = (...n: number[]) => Uint8Array.from(n);
const sha256 = (d: Uint8Array) => digest('SHA-256', d);
export const ZEROS32 = new Uint8Array(32);

// ---------------- HKDF e cronograma de chaves ----------------
export const hkdfExtract = (salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> => hmacWebCrypto('SHA-256', salt, ikm);

/** HKDF-Expand (RFC 5869) com SHA-256. */
export async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const blocks = Math.ceil(length / 32);
  if (blocks > 255) throw new Error('Comprimento de HKDF-Expand excede 255 blocos.');
  let t: Uint8Array = new Uint8Array(0);
  const out: Uint8Array[] = [];
  for (let i = 1; i <= blocks; i++) {
    t = await hmacWebCrypto('SHA-256', prk, concat(t, info, u8(i)));
    out.push(t);
  }
  return concat(...out).slice(0, length);
}

/** HKDF-Expand-Label (RFC 8446, seção 7.1): o rótulo recebe o prefixo "tls13 ". */
export function hkdfExpandLabel(secret: Uint8Array, label: string, context: Uint8Array, length: number): Promise<Uint8Array> {
  const full = utf8Encode(`tls13 ${label}`);
  const info = concat(u8(length >> 8, length & 0xff), u8(full.length), full, u8(context.length), context);
  return hkdfExpand(secret, info, length);
}

/** Derive-Secret(secret, rótulo, mensagens) = HKDF-Expand-Label(secret, rótulo, Hash(mensagens), 32). */
export const deriveSecret = (secret: Uint8Array, label: string, transcriptHash: Uint8Array) => hkdfExpandLabel(secret, label, transcriptHash, 32);

export interface TrafficKeys {
  key: Uint8Array;
  iv: Uint8Array;
  finishedKey: Uint8Array;
}

/** Chave AES-128, IV de 12 bytes e chave do Finished derivados de um segredo de tráfego. */
export async function trafficKeys(secret: Uint8Array): Promise<TrafficKeys> {
  return {
    key: await hkdfExpandLabel(secret, 'key', new Uint8Array(0), 16),
    iv: await hkdfExpandLabel(secret, 'iv', new Uint8Array(0), 12),
    finishedKey: await hkdfExpandLabel(secret, 'finished', new Uint8Array(0), 32),
  };
}

export interface EarlyStages {
  early: Uint8Array;
  derivedEarly: Uint8Array;
}

/** Early Secret (sem PSK) e o segredo "derived" que o liga ao Handshake Secret. */
export async function earlyStages(): Promise<EarlyStages> {
  const early = await hkdfExtract(ZEROS32, ZEROS32);
  return { early, derivedEarly: await deriveSecret(early, 'derived', await sha256(new Uint8Array(0))) };
}

export interface HandshakeSecrets {
  handshake: Uint8Array;
  clientHs: Uint8Array;
  serverHs: Uint8Array;
}

/** Handshake Secret = Extract(derived, segredo ECDHE); segredos de tráfego do handshake sobre Hash(ClientHello..ServerHello). */
export async function handshakeSecrets(derivedEarly: Uint8Array, ecdhe: Uint8Array, helloHash: Uint8Array): Promise<HandshakeSecrets> {
  const handshake = await hkdfExtract(derivedEarly, ecdhe);
  return { handshake, clientHs: await deriveSecret(handshake, 'c hs traffic', helloHash), serverHs: await deriveSecret(handshake, 's hs traffic', helloHash) };
}

export interface ApplicationSecrets {
  master: Uint8Array;
  clientAp: Uint8Array;
  serverAp: Uint8Array;
}

/** Master Secret e segredos de tráfego da aplicação sobre Hash(ClientHello..Finished do servidor). */
export async function applicationSecrets(handshake: Uint8Array, finishedHash: Uint8Array): Promise<ApplicationSecrets> {
  const derived = await deriveSecret(handshake, 'derived', await sha256(new Uint8Array(0)));
  const master = await hkdfExtract(derived, ZEROS32);
  return { master, clientAp: await deriveSecret(master, 'c ap traffic', finishedHash), serverAp: await deriveSecret(master, 's ap traffic', finishedHash) };
}

export const finishedMac = (finishedKey: Uint8Array, transcriptHash: Uint8Array) => hmacWebCrypto('SHA-256', finishedKey, transcriptHash);

// ---------------- Mensagens de handshake (simplificadas) ----------------
export const HS = { clientHello: 1, serverHello: 2, encryptedExtensions: 8, certificate: 11, certificateVerify: 15, finished: 20 } as const;

export function handshakeMessage(type: number, body: Uint8Array): Uint8Array {
  return concat(u8(type, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff), body);
}

/** Conteúdo assinado no CertificateVerify do servidor (RFC 8446, seção 4.4.3). */
export const certificateVerifyContent = (transcriptHash: Uint8Array): Uint8Array =>
  concat(new Uint8Array(64).fill(0x20), utf8Encode('TLS 1.3, server CertificateVerify'), u8(0), transcriptHash);

// ---------------- ECDHE, ECDSA e registros ----------------
export interface EcdhPair {
  privateKey: CryptoKey;
  publicRaw: Uint8Array;
}

export async function generateEcdh(): Promise<EcdhPair> {
  const k = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { privateKey: k.privateKey, publicRaw: new Uint8Array(await subtle().exportKey('raw', k.publicKey)) };
}

export async function ecdhSecret(privateKey: CryptoKey, peerPublicRaw: Uint8Array): Promise<Uint8Array> {
  const pub = await subtle().importKey('raw', peerPublicRaw as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: pub }, privateKey, 256));
}

export interface EcdsaPair {
  privateKey: CryptoKey;
  publicRaw: Uint8Array;
}

export async function generateEcdsa(): Promise<EcdsaPair> {
  const k = await subtle().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { privateKey: k.privateKey, publicRaw: new Uint8Array(await subtle().exportKey('raw', k.publicKey)) };
}

export async function ecdsaSign(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data as BufferSource));
}

export async function ecdsaVerify(publicRaw: Uint8Array, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
  const pub = await subtle().importKey('raw', publicRaw as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, signature as BufferSource, data as BufferSource);
}

/** Nonce do registro = IV XOR número de sequência (64 bits, alinhado à direita), RFC 8446 seção 5.3. */
export function recordNonce(iv: Uint8Array, seq: number): Uint8Array {
  const n = Uint8Array.from(iv);
  let s = BigInt(seq);
  for (let i = 11; i >= 4 && s > 0n; i--) {
    n[i] ^= Number(s & 0xffn);
    s >>= 8n;
  }
  return n;
}

const recordHeader = (len: number) => u8(0x17, 0x03, 0x03, len >> 8, len & 0xff);

/** Protege um registro: cifra (conteúdo || tipo) com AES-128-GCM; o cabeçalho do registro é o dado associado. */
export async function sealRecord(keys: TrafficKeys, seq: number, content: Uint8Array, type: number): Promise<Uint8Array> {
  const inner = concat(content, u8(type));
  const aad = recordHeader(inner.length + 16);
  const key = await subtle().importKey('raw', keys.key as BufferSource, 'AES-GCM', false, ['encrypt']);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv: recordNonce(keys.iv, seq) as BufferSource, additionalData: aad as BufferSource }, key, inner as BufferSource);
  return concat(aad, new Uint8Array(ct));
}

/** Abre um registro; lança erro se a etiqueta de autenticação não conferir. */
export async function openRecord(keys: TrafficKeys, seq: number, record: Uint8Array): Promise<{ content: Uint8Array; type: number }> {
  const aad = record.slice(0, 5);
  const key = await subtle().importKey('raw', keys.key as BufferSource, 'AES-GCM', false, ['decrypt']);
  const inner = new Uint8Array(
    await subtle().decrypt({ name: 'AES-GCM', iv: recordNonce(keys.iv, seq) as BufferSource, additionalData: aad as BufferSource }, key, record.slice(5) as BufferSource),
  );
  return { content: inner.slice(0, inner.length - 1), type: inner[inner.length - 1] };
}

// ---------------- Simulação completa do handshake ----------------
export type TlsScenario = 'normal' | 'mitm';

export interface TlsInput {
  serverName: string;
  message: string;
  scenario: TlsScenario;
  /** Se Alice (cliente) valida o certificado e o CertificateVerify. Só tem efeito no cenário com Eva ativa. */
  clientVerifies: boolean;
}

export interface TlsHandshake {
  scenario: TlsScenario;
  clientVerifies: boolean;
  serverName: string;
  /** Valores em hexadecimal, na ordem do protocolo. */
  clientPub: string;
  clientRandom: string;
  /** Chave pública de quem respondeu como servidor para Alice (Bob no cenário normal; Eva no ataque). */
  responderPub: string;
  serverRandom: string;
  serverPub: string;
  sharedSecret: string;
  early: string;
  derivedEarly: string;
  handshakeSecret: string;
  clientHs: string;
  serverHs: string;
  helloHash: string;
  serverFlightHash: string;
  certVerifyHash: string;
  finishedHash: string;
  masterSecret: string;
  clientAp: string;
  serverAp: string;
  serverHsKey: string;
  serverHsIv: string;
  clientApKey: string;
  clientApIv: string;
  caPub: string;
  certSignature: string;
  certificateValid: boolean;
  certVerifySignature: string;
  certVerifyValid: boolean;
  serverFinished: string;
  finishedValid: boolean;
  clientFinished: string;
  flightRecord: string;
  appRecord: string;
  /** Alice interrompeu o handshake (alerta decrypt_error). */
  aborted: boolean;
  abortReason: string;
  /** Texto recebido por quem estava do outro lado do canal protegido (Bob, ou Eva no ataque), ou nulo. */
  received: string | null;
  evaReads: boolean;
  /** Eva (passiva) consegue derivar o segredo? Sempre falso: ela só tem as chaves públicas. */
  passiveEvaDerives: boolean;
  ok: boolean;
}

/** Um handshake completo e real (Web Crypto), com ou sem Eva ativa entre Alice (cliente) e Bob (servidor). */
export async function simulateHandshake(input: TlsInput): Promise<TlsHandshake> {
  const name = input.serverName.trim();
  if (!/^[a-z0-9]([a-z0-9.-]{0,60}[a-z0-9])?$/i.test(name)) throw new Error('Nome do servidor inválido: use letras, dígitos, pontos e hífens (ex.: banco.exemplo).');
  const appBytes = utf8Encode(input.message);
  if (appBytes.length === 0) throw new Error('Digite a mensagem de aplicação de Alice.');
  if (appBytes.length > 200) throw new Error('Use no máximo 200 bytes na mensagem.');

  // identidades: autoridade certificadora (CA) fictícia e servidor
  const ca = await generateEcdsa();
  const serverId = await generateEcdsa();
  const certSig = await ecdsaSign(ca.privateKey, concat(utf8Encode(name), serverId.publicRaw));
  const certificate = concat(u8(name.length), utf8Encode(name), serverId.publicRaw, certSig);

  // chaves efêmeras e mensagens Hello
  const a = await generateEcdh();
  const b = await generateEcdh();
  const eva = input.scenario === 'mitm' ? await generateEcdh() : null;
  const responder = eva ?? b; // quem responde a Alice como "servidor"
  const clientRandom = randomBytes(32);
  const serverRandom = randomBytes(32);
  const clientHello = handshakeMessage(HS.clientHello, concat(u8(3, 3), clientRandom, a.publicRaw));
  const serverHello = handshakeMessage(HS.serverHello, concat(u8(3, 3), serverRandom, responder.publicRaw));

  // segredo ECDHE e cronograma de chaves do handshake (idênticos nos dois lados)
  const shared = await ecdhSecret(a.privateKey, responder.publicRaw);
  const sharedOther = await ecdhSecret(responder.privateKey, a.publicRaw);
  if (toHex(shared) !== toHex(sharedOther)) throw new Error('Falha interna: os segredos ECDHE não coincidem.');
  const { early, derivedEarly } = await earlyStages();
  const helloHash = await sha256(concat(clientHello, serverHello));
  const hs = await handshakeSecrets(derivedEarly, shared, helloHash);
  const sKeys = await trafficKeys(hs.serverHs);
  const cKeys = await trafficKeys(hs.clientHs);

  // voo do servidor: EncryptedExtensions, Certificate, CertificateVerify, Finished
  const ee = handshakeMessage(HS.encryptedExtensions, u8(0, 0));
  const certMsg = handshakeMessage(HS.certificate, certificate);
  const certVerifyHash = await sha256(concat(clientHello, serverHello, ee, certMsg));
  // no ataque, Eva repete o certificado verdadeiro (público), mas só pode assinar com a sua própria chave
  const evaId = input.scenario === 'mitm' ? await generateEcdsa() : null;
  const signer = evaId ?? serverId;
  const cvSig = await ecdsaSign(signer.privateKey, certificateVerifyContent(certVerifyHash));
  const certVerify = handshakeMessage(HS.certificateVerify, cvSig);
  const preFinHash = await sha256(concat(clientHello, serverHello, ee, certMsg, certVerify));
  const serverFinished = await finishedMac(sKeys.finishedKey, preFinHash);
  const finMsg = handshakeMessage(HS.finished, serverFinished);
  const flight = concat(ee, certMsg, certVerify, finMsg);
  const flightRecord = await sealRecord(sKeys, 0, flight, 0x16);

  // Alice abre o voo e valida
  const opened = await openRecord(sKeys, 0, flightRecord);
  if (toHex(opened.content) !== toHex(flight)) throw new Error('Falha interna: o voo do servidor não decifrou.');
  const certificateValid = await ecdsaVerify(ca.publicRaw, certSig, concat(utf8Encode(name), serverId.publicRaw));
  const certVerifyValid = await ecdsaVerify(serverId.publicRaw, cvSig, certificateVerifyContent(certVerifyHash));
  const expectedFin = await finishedMac(sKeys.finishedKey, preFinHash);
  const finishedValid = toHex(expectedFin) === toHex(serverFinished);
  const checks = input.scenario === 'mitm' && !input.clientVerifies ? true : certificateValid && certVerifyValid && finishedValid;
  const aborted = !checks;
  const abortReason = aborted ? (!certVerifyValid ? 'CertificateVerify inválido: a assinatura não corresponde à chave pública do certificado (decrypt_error)' : !certificateValid ? 'certificado não assinado por uma autoridade confiável (bad_certificate)' : 'Finished inválido (decrypt_error)') : '';

  // Finished do cliente e chaves de aplicação
  const finishedHash = await sha256(concat(clientHello, serverHello, ee, certMsg, certVerify, finMsg));
  const app = await applicationSecrets(hs.handshake, finishedHash);
  const cAp = await trafficKeys(app.clientAp);
  const clientFinished = await finishedMac(cKeys.finishedKey, finishedHash);

  let appRecord = '';
  let received: string | null = null;
  if (!aborted) {
    const rec = await sealRecord(cAp, 0, appBytes, 0x17);
    appRecord = toHex(rec);
    const back = await openRecord(cAp, 0, rec);
    received = new TextDecoder().decode(back.content);
  }
  const evaReads = input.scenario === 'mitm' && received !== null;

  return {
    scenario: input.scenario,
    clientVerifies: input.clientVerifies,
    serverName: name,
    clientPub: toHex(a.publicRaw),
    clientRandom: toHex(clientRandom),
    responderPub: toHex(responder.publicRaw),
    serverRandom: toHex(serverRandom),
    serverPub: toHex(b.publicRaw),
    sharedSecret: toHex(shared),
    early: toHex(early),
    derivedEarly: toHex(derivedEarly),
    handshakeSecret: toHex(hs.handshake),
    clientHs: toHex(hs.clientHs),
    serverHs: toHex(hs.serverHs),
    helloHash: toHex(helloHash),
    serverFlightHash: toHex(certVerifyHash),
    certVerifyHash: toHex(preFinHash),
    finishedHash: toHex(finishedHash),
    masterSecret: toHex(app.master),
    clientAp: toHex(app.clientAp),
    serverAp: toHex(app.serverAp),
    serverHsKey: toHex(sKeys.key),
    serverHsIv: toHex(sKeys.iv),
    clientApKey: toHex(cAp.key),
    clientApIv: toHex(cAp.iv),
    caPub: toHex(ca.publicRaw),
    certSignature: toHex(certSig),
    certificateValid,
    certVerifySignature: toHex(cvSig),
    certVerifyValid,
    serverFinished: toHex(serverFinished),
    finishedValid,
    clientFinished: toHex(clientFinished),
    flightRecord: toHex(flightRecord),
    appRecord,
    aborted,
    abortReason,
    received,
    evaReads,
    passiveEvaDerives: false,
    ok: input.scenario === 'normal' ? true : !evaReads,
  };
}
