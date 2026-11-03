// DAP (Dynamic Authorization Protocol): autorização visual de transações fora de banda.
// Implementa o draft-melo-dap-visual-oob-auth-00 (trabalho em andamento, sem número de RFC):
// derivação da metade k_2, formato do QR de troca de chaves (código 001), desafio trans_data | r' | y,
// verificação no celular (MD) e validação do código no e-Bank. As operações criptográficas usam a Web Crypto
// (HMAC-SHA-512, HMAC-SHA-256, SHA-256 e AES-256-CBC com preenchimento PKCS#7).
import { constantTimeEqual, digest, hmacWebCrypto } from './hash';
import { toHex, utf8Encode } from './encoding';

export const DAP_VERSION = '099';
export const KDF_LABEL = 'DAP-k2-v1';
/** Validade do desafio, em segundos (Seção 3.2, premissa 1). */
export const TTL_SECONDS = 120;
/** Tolerância do relógio do MD para um carimbo no futuro, em segundos (Seção 6.1.2). */
export const SKEW_SECONDS = 60;
export const MAX_ATTEMPTS = 3;
export const NONCE_LENGTH = 20;
export const KEY_BYTES = 64;

const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ---------------------------------------------------------------------------------------------
// Codificações
// ---------------------------------------------------------------------------------------------
export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export const xorBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  if (a.length !== b.length) throw new Error('XOR exige sequências de mesmo tamanho.');
  return a.map((v, i) => v ^ b[i]);
};

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
/** Base64 padrão com preenchimento (RFC 4648); devolve null se o texto não for Base64 válido. */
export function fromBase64(text: string): Uint8Array | null {
  if (!B64.test(text)) return null;
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/** Texto ASCII imprimível (0x20 a 0x7E), único conjunto aceito em trans_data. */
export const isPrintableAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);

// ---------------------------------------------------------------------------------------------
// Aleatoriedade com rejeição (sem viés de módulo)
// ---------------------------------------------------------------------------------------------
/** Código autorizador de 6 dígitos, uniforme em 000000 a 999999, por amostragem com rejeição de palavras de 32 bits. */
export function drawCode(random: Uint8Array): string {
  const limit = Math.floor(2 ** 32 / 1_000_000) * 1_000_000;
  for (let i = 0; i + 4 <= random.length; i += 4) {
    const v = ((random[i] << 24) | (random[i + 1] << 16) | (random[i + 2] << 8) | random[i + 3]) >>> 0;
    if (v < limit) return String(v % 1_000_000).padStart(6, '0');
  }
  throw new Error('Bytes aleatórios insuficientes para sortear o código r.');
}

/** Texto de 20 caracteres de A a Z e 0 a 9 (Nonce e Enroll), com rejeição. */
export function drawIdentifier(random: Uint8Array): string {
  const limit = 252; // 7 * 36: acima disso o módulo 36 teria viés
  let out = '';
  for (const b of random) {
    if (b < limit) out += NONCE_ALPHABET[b % 36];
    if (out.length === NONCE_LENGTH) return out;
  }
  throw new Error('Bytes aleatórios insuficientes para sortear o identificador.');
}

// ---------------------------------------------------------------------------------------------
// Chave do cliente
// ---------------------------------------------------------------------------------------------
export interface CustomerRecord {
  /** Identificador do cliente (não de uma conta); fica no servidor e nunca vai em desafio. */
  id: string;
  keyId: number;
  version: number;
  /** Instante de cadastro, em segundos desde 1970-01-01T00:00:00Z. */
  keyTimestamp: number;
}

/** x = label | key_id | version | len(ID) | ID | key_timestamp (inteiros em ordem de rede). */
export function kdfInput(c: CustomerRecord): Uint8Array {
  const id = utf8Encode(c.id);
  const out = new Uint8Array(KDF_LABEL.length + 4 + 4 + 2 + id.length + 8);
  const dv = new DataView(out.buffer);
  out.set(utf8Encode(KDF_LABEL), 0);
  let o = KDF_LABEL.length;
  dv.setUint32(o, c.keyId);
  o += 4;
  dv.setUint32(o, c.version);
  o += 4;
  dv.setUint16(o, id.length);
  o += 2;
  out.set(id, o);
  o += id.length;
  dv.setBigUint64(o, BigInt(c.keyTimestamp));
  return out;
}

/** k_2 = HMAC-SHA-512 com a chave-mestra MK sobre x (512 bits). */
export async function deriveK2(mk: Uint8Array, c: CustomerRecord): Promise<Uint8Array> {
  if (mk.length !== KEY_BYTES) throw new Error('A chave-mestra MK deve ter 512 bits (64 octetos).');
  return hmacWebCrypto('SHA-512', mk, kdfInput(c));
}

export interface SubKeys {
  /** k'_1: primeiros 32 octetos, chave do HMAC-SHA-256. */
  kMac: Uint8Array;
  /** k'_2: últimos 32 octetos, chave do AES-256-CBC. */
  kEnc: Uint8Array;
}

export function splitKey(k: Uint8Array): SubKeys {
  if (k.length !== KEY_BYTES) throw new Error('A chave k deve ter 512 bits (64 octetos).');
  return { kMac: k.slice(0, 32), kEnc: k.slice(32) };
}

// ---------------------------------------------------------------------------------------------
// QR de troca de chaves (código 001, Seção 5.2)
// ---------------------------------------------------------------------------------------------
export interface KeyShareQr {
  share: '1' | '2';
  enroll: string;
  value: Uint8Array;
}

/** Check: 8 dígitos hexadecimais maiúsculos, os 4 primeiros octetos do SHA-256 do texto antes do último ";". */
async function shareCheck(prefix: string): Promise<string> {
  return toHex((await digest('SHA-256', utf8Encode(prefix))).slice(0, 4)).toUpperCase();
}

export async function encodeKeyShare(q: KeyShareQr): Promise<string> {
  if (q.value.length !== KEY_BYTES) throw new Error('A metade da chave deve ter 64 octetos.');
  const prefix = [DAP_VERSION, '001', q.share, q.enroll, toBase64(q.value)].join(';');
  return `${prefix};${await shareCheck(prefix)}`;
}

export type ShareFailure = 'campos' | 'versao' | 'codigo' | 'share' | 'enroll' | 'valor' | 'check';
export type ShareParse = { ok: true; qr: KeyShareQr; check: string } | { ok: false; reason: ShareFailure; message: string };

const SHARE_MESSAGES: Record<ShareFailure, string> = {
  campos: 'O texto não tem exatamente seis campos.',
  versao: 'Versão do DAP não suportada.',
  codigo: 'O código de transação não é 001.',
  share: 'O campo Share deve ser 1 ou 2.',
  enroll: 'O identificador Enroll é inválido.',
  valor: 'O campo Value não decodifica para 64 octetos.',
  check: 'O valor de Check não confere (erro de leitura).',
};
const fail = (reason: ShareFailure): ShareParse => ({ ok: false, reason, message: SHARE_MESSAGES[reason] });

export async function parseKeyShare(text: string): Promise<ShareParse> {
  const f = text.split(';');
  if (f.length !== 6) return fail('campos');
  const [version, code, share, enroll, value, check] = f;
  if (version !== DAP_VERSION) return fail('versao');
  if (code !== '001') return fail('codigo');
  if (share !== '1' && share !== '2') return fail('share');
  if (!/^[A-Z0-9]{20}$/.test(enroll)) return fail('enroll');
  const bytes = fromBase64(value);
  if (!bytes || bytes.length !== KEY_BYTES) return fail('valor');
  const expected = await shareCheck(f.slice(0, 5).join(';'));
  if (check !== expected) return fail('check');
  return { ok: true, qr: { share, enroll, value: bytes }, check };
}

// ---------------------------------------------------------------------------------------------
// Modelos (templates) e trans_data
// ---------------------------------------------------------------------------------------------
export interface TemplateField {
  id: string;
  label: string;
  /** N: numérico; A: alfanumérico (A a Z, dígitos, espaço e a pontuação listada em extra). */
  type: 'N' | 'A';
  max: number;
  role?: 'timestamp';
  currency?: string;
  decimals?: number;
}

export interface Template {
  code: string;
  name: string;
  fields: TemplateField[];
  /** Máscara de exibição; {id} é substituído pelo valor formatado do campo. */
  mask: string;
}

export const TEMPLATES: Record<string, Template> = {
  '000': {
    code: '000',
    name: 'Ativação do DAP',
    fields: [
      { id: 'msg', label: 'Mensagem', type: 'A', max: 40 },
      { id: 'time', label: 'Data e hora', type: 'N', max: 12, role: 'timestamp' },
    ],
    mask: 'Ativar o DAP neste aparelho?\n{msg}\nData e hora: {time}',
  },
  '818': {
    code: '818',
    name: 'Transferência entre contas correntes',
    fields: [
      { id: 'branch', label: 'Agência', type: 'N', max: 5 },
      { id: 'account', label: 'Conta', type: 'N', max: 12 },
      { id: 'digit', label: 'Dígito', type: 'N', max: 1 },
      { id: 'payee', label: 'Favorecido', type: 'A', max: 30 },
      { id: 'amount', label: 'Valor', type: 'N', max: 13, currency: 'BRL', decimals: 2 },
      { id: 'time', label: 'Data e hora', type: 'N', max: 12, role: 'timestamp' },
    ],
    mask: 'Agência {branch}, conta {account}-{digit}\nFavorecido: {payee}\nValor: {amount}\nData e hora: {time}',
  },
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** YYMMDDHHMMSS em UTC. */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getUTCFullYear() % 100)}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`;
}

/** Instante (ms) de um carimbo YYMMDDHHMMSS (século 2000), ou null se o carimbo não for uma data válida. */
export function parseTimestamp(s: string): number | null {
  if (!/^\d{12}$/.test(s)) return null;
  const [yy, mo, dd, hh, mi, ss] = [0, 2, 4, 6, 8, 10].map((i) => Number(s.slice(i, i + 2)));
  const ms = Date.UTC(2000 + yy, mo - 1, dd, hh, mi, ss);
  const back = new Date(ms);
  const same = back.getUTCFullYear() === 2000 + yy && back.getUTCMonth() === mo - 1 && back.getUTCDate() === dd && back.getUTCHours() === hh && back.getUTCMinutes() === mi && back.getUTCSeconds() === ss;
  return same ? ms : null;
}

/** Valor mostrado ao cliente: moeda com separadores e carimbo em dd/mm/aaaa hh:mm:ss UTC. */
export function formatField(f: TemplateField, value: string): string {
  if (f.currency && f.decimals !== undefined && /^\d+$/.test(value)) {
    const digits = value.replace(/^0+(?=\d)/, '').padStart(f.decimals + 1, '0');
    const int = digits.slice(0, -f.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${f.currency === 'BRL' ? 'R$' : f.currency} ${int},${digits.slice(-f.decimals)}`;
  }
  if (f.role === 'timestamp') {
    const ms = parseTimestamp(value);
    if (ms !== null) {
      const d = new Date(ms);
      return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`;
    }
  }
  return value;
}

export function renderMask(t: Template, values: Record<string, string>): string {
  const byId = new Map(t.fields.map((f) => [f.id, f]));
  return t.mask.replace(/\{(\w+)\}/g, (_, id: string) => {
    const f = byId.get(id);
    return f && id in values ? formatField(f, values[id]) : `{${id}}`;
  });
}

export function buildTransData(nonce: string, code: string, fields: string[]): string {
  const t = TEMPLATES[code];
  if (!t) throw new Error(`Código de transação desconhecido: ${code}.`);
  if (fields.length !== t.fields.length) throw new Error('O número de campos não confere com o modelo.');
  const text = [nonce, DAP_VERSION, code, ...fields].join(';');
  const bad = fields.findIndex((v) => v.includes(';'));
  if (bad >= 0) throw new Error('O caractere ";" não pode aparecer em um campo.');
  if (!isPrintableAscii(text)) throw new Error('trans_data aceita apenas ASCII imprimível.');
  return text;
}

export interface ParsedTransData {
  nonce: string;
  version: string;
  code: string;
  template: Template;
  values: Record<string, string>;
  /** Carimbo de geração do desafio (ms desde 1970), lido do campo com role = timestamp. */
  generatedAt: number;
}

export type TransFailure = 'ascii' | 'campos' | 'nonce' | 'versao' | 'codigo' | 'tipo' | 'carimbo';
export type TransParse = { ok: true; parsed: ParsedTransData } | { ok: false; reason: TransFailure; message: string };

const TRANS_MESSAGES: Record<TransFailure, string> = {
  ascii: 'trans_data contém caractere fora do conjunto permitido.',
  campos: 'O número de campos não confere com o modelo.',
  nonce: 'O Nonce não tem 20 caracteres de A a Z e 0 a 9.',
  versao: 'Versão do DAP não suportada.',
  codigo: 'Código de transação desconhecido.',
  tipo: 'Um campo não respeita o tipo ou o tamanho máximo do modelo.',
  carimbo: 'O carimbo de geração não é uma data válida.',
};
const tfail = (reason: TransFailure): TransParse => ({ ok: false, reason, message: TRANS_MESSAGES[reason] });

/** Verificações do passo 4 da Seção 6.1.2 (a ordem segue o draft). */
export function parseTransData(transData: string): TransParse {
  if (!isPrintableAscii(transData)) return tfail('ascii');
  const f = transData.split(';');
  if (f.length < 3) return tfail('campos');
  const [nonce, version, code, ...rest] = f;
  if (!/^[A-Z0-9]{20}$/.test(nonce)) return tfail('nonce');
  if (version !== DAP_VERSION) return tfail('versao');
  const template = TEMPLATES[code];
  if (!template) return tfail('codigo');
  if (rest.length !== template.fields.length) return tfail('campos');
  const values: Record<string, string> = {};
  for (const [i, field] of template.fields.entries()) {
    const v = rest[i];
    const typeOk = field.type === 'N' ? /^\d+$/.test(v) : /^[A-Z0-9 ]+$/.test(v);
    if (!typeOk || v.length > field.max) return tfail('tipo');
    values[field.id] = v;
  }
  const tsField = template.fields.find((x) => x.role === 'timestamp');
  const generatedAt = tsField ? parseTimestamp(values[tsField.id]) : null;
  if (generatedAt === null) return tfail('carimbo');
  return { ok: true, parsed: { nonce, version, code, template, values, generatedAt } };
}

/** Janela de validade no MD: vencido (mais de 120 s), no futuro (mais de 60 s à frente do relógio) ou válido. */
export type Freshness = { state: 'ok' | 'expired' | 'future'; ageSeconds: number };
export function checkFreshness(generatedAt: number, mdNowMs: number): Freshness {
  const age = Math.floor((mdNowMs - generatedAt) / 1000);
  if (age > TTL_SECONDS) return { state: 'expired', ageSeconds: age };
  if (age < -SKEW_SECONDS) return { state: 'future', ageSeconds: age };
  return { state: 'ok', ageSeconds: age };
}

// ---------------------------------------------------------------------------------------------
// Desafio: trans_data | r' | y
// ---------------------------------------------------------------------------------------------
export interface Challenge {
  transData: string;
  r: string;
  iv: Uint8Array;
  /** C: único bloco de 16 octetos do AES-256-CBC. */
  c: Uint8Array;
  /** r' = IV | C (32 octetos). */
  rPrime: Uint8Array;
  /** y = HMAC-SHA-256(k'_1, trans_data | r') (32 octetos). */
  y: Uint8Array;
  /** Octetos antes do Base64. */
  payload: Uint8Array;
  /** Texto do QR. */
  base64: string;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto indisponível: use HTTPS ou localhost em um navegador atual.');
  return s;
}

async function aesKey(kEnc: Uint8Array, usage: 'encrypt' | 'decrypt') {
  return subtle().importKey('raw', kEnc as BufferSource, { name: 'AES-CBC' }, false, [usage]);
}

/** C = AES-256-CBC(k'_2, IV, r) com preenchimento PKCS#7: seis dígitos viram um bloco de 16 octetos. */
export async function encryptCode(kEnc: Uint8Array, iv: Uint8Array, r: string): Promise<Uint8Array> {
  if (!/^\d{6}$/.test(r)) throw new Error('O código r deve ter seis dígitos decimais.');
  if (iv.length !== 16) throw new Error('O IV deve ter 16 octetos.');
  return new Uint8Array(await subtle().encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, await aesKey(kEnc, 'encrypt'), utf8Encode(r) as BufferSource));
}

export async function tagOf(kMac: Uint8Array, transData: string, rPrime: Uint8Array): Promise<Uint8Array> {
  return hmacWebCrypto('SHA-256', kMac, concat(utf8Encode(transData), rPrime));
}

export async function sealChallenge(keys: SubKeys, transData: string, r: string, iv: Uint8Array): Promise<Challenge> {
  const c = await encryptCode(keys.kEnc, iv, r);
  const rPrime = concat(iv, c);
  const y = await tagOf(keys.kMac, transData, rPrime);
  const payload = concat(utf8Encode(transData), rPrime, y);
  return { transData, r, iv, c, rPrime, y, payload, base64: toBase64(payload) };
}

export interface SplitChallenge {
  transData: string;
  rPrime: Uint8Array;
  y: Uint8Array;
}

/** Separa y (últimos 32 octetos), r' (32 octetos anteriores) e trans_data (o resto). Null se não for Base64 ou for curto. */
export function splitChallenge(base64: string): SplitChallenge | null {
  const bytes = fromBase64(base64);
  if (!bytes || bytes.length < 64 + 1) return null;
  const y = bytes.slice(bytes.length - 32);
  const rPrime = bytes.slice(bytes.length - 64, bytes.length - 32);
  const body = bytes.slice(0, bytes.length - 64);
  return { transData: String.fromCharCode(...body), rPrime, y };
}

/** y' = HMAC-SHA-256(k'_1, trans_data | r') e a comparação em tempo constante com y. */
export async function checkTag(kMac: Uint8Array, s: SplitChallenge): Promise<{ yPrime: Uint8Array; equal: boolean }> {
  const yPrime = await tagOf(kMac, s.transData, s.rPrime);
  return { yPrime, equal: constantTimeEqual(yPrime, s.y) };
}

/** r_hat = AES-256-CBC-Dec(k'_2, IV, C); null se o preenchimento for inválido ou o resultado não forem seis dígitos. */
export async function decryptCode(kEnc: Uint8Array, rPrime: Uint8Array): Promise<string | null> {
  if (rPrime.length !== 32) return null;
  try {
    const plain = await subtle().decrypt({ name: 'AES-CBC', iv: rPrime.slice(0, 16) as BufferSource }, await aesKey(kEnc, 'decrypt'), rPrime.slice(16) as BufferSource);
    const text = String.fromCharCode(...new Uint8Array(plain));
    return /^\d{6}$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Validação do código no e-Bank (Seção 6.1.3, passo 4)
// ---------------------------------------------------------------------------------------------
export interface PendingTransaction {
  r: string;
  /** Instante de geração, em ms desde 1970. */
  generatedAt: number;
  attempts: number;
  status: 'pending' | 'executed' | 'cancelled';
}

export type SubmitOutcome = 'executed' | 'wrong' | 'expired' | 'locked' | 'closed';

/** O relógio é o do servidor, a autoridade do prazo. Após executar, expirar ou esgotar as tentativas, r é invalidado. */
export function submitCode(tx: PendingTransaction, rHat: string, serverNowMs: number): { tx: PendingTransaction; outcome: SubmitOutcome } {
  if (tx.status !== 'pending') return { tx, outcome: 'closed' };
  if (serverNowMs - tx.generatedAt > TTL_SECONDS * 1000) return { tx: { ...tx, status: 'cancelled' }, outcome: 'expired' };
  if (constantTimeEqual(utf8Encode(rHat), utf8Encode(tx.r))) return { tx: { ...tx, status: 'executed' }, outcome: 'executed' };
  const attempts = tx.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) return { tx: { ...tx, attempts, status: 'cancelled' }, outcome: 'locked' };
  return { tx: { ...tx, attempts }, outcome: 'wrong' };
}
