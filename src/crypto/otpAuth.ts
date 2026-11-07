// HOTP (RFC 4226) e TOTP (RFC 6238): senhas de uso único baseadas em HMAC.
// O HMAC vem da Web Crypto API; o restante (contador, truncamento dinâmico, validação) é calculado aqui, passo a passo.

export type OtpAlgo = 'SHA-1' | 'SHA-256' | 'SHA-512';

export const OTP_ALGOS: OtpAlgo[] = ['SHA-1', 'SHA-256', 'SHA-512'];
export const DEFAULT_STEP = 30;

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('A Web Crypto API não está disponível neste ambiente.');
  return s;
}

/** HMAC (RFC 2104) pela Web Crypto API. */
export async function hmacBytes(algo: OtpAlgo, key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const k = await subtle().importKey('raw', key as BufferSource, { name: 'HMAC', hash: algo }, false, ['sign']);
  return new Uint8Array(await subtle().sign('HMAC', k, message as BufferSource));
}

// --- Base32 (RFC 4648, alfabeto padrão, sem preenchimento ao exibir) ---------------------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error(`Caractere inválido em Base32: "${ch}".`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

// --- HOTP --------------------------------------------------------------------------------------
export interface HotpTrace {
  /** Contador de 64 bits, em big-endian (8 bytes). */
  counter: bigint;
  counterBytes: Uint8Array;
  /** Resultado do HMAC (20, 32 ou 64 bytes). */
  hmac: Uint8Array;
  /** Posição do truncamento: o quarto bit menos significativo do último byte (0 a 15 no SHA-1). */
  offset: number;
  /** Quatro bytes do HMAC a partir de offset. */
  fourBytes: Uint8Array;
  /** O mesmo valor sem o bit mais significativo (máscara 0x7FFFFFFF). */
  truncated: number;
  digits: number;
  /** Código com zeros à esquerda. */
  code: string;
}

export function counterToBytes(counter: bigint): Uint8Array {
  if (counter < 0n || counter >= 1n << 64n) throw new Error('O contador deve caber em 64 bits.');
  const out = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  return out;
}

export async function hotp(key: Uint8Array, counter: bigint, digits = 6, algo: OtpAlgo = 'SHA-1'): Promise<HotpTrace> {
  if (key.length === 0) throw new Error('A chave não pode ser vazia.');
  if (!Number.isInteger(digits) || digits < 6 || digits > 9) throw new Error('Use de 6 a 9 dígitos.');
  const counterBytes = counterToBytes(counter);
  const hmac = await hmacBytes(algo, key, counterBytes);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const fourBytes = hmac.slice(offset, offset + 4);
  const truncated = (((fourBytes[0] & 0x7f) << 24) | (fourBytes[1] << 16) | (fourBytes[2] << 8) | fourBytes[3]) >>> 0;
  const code = String(truncated % 10 ** digits).padStart(digits, '0');
  return { counter, counterBytes, hmac, offset, fourBytes, truncated, digits, code };
}

// --- TOTP --------------------------------------------------------------------------------------
/** Contador de passos de tempo: T = floor((tempo Unix - T0) / X). */
export function timeCounter(unixSeconds: number, step = DEFAULT_STEP, t0 = 0): bigint {
  if (!Number.isFinite(unixSeconds) || unixSeconds < t0) throw new Error('O instante deve ser um tempo Unix não negativo.');
  if (!Number.isInteger(step) || step < 1) throw new Error('O passo deve ser um inteiro de pelo menos 1 segundo.');
  return BigInt(Math.floor((unixSeconds - t0) / step));
}

export async function totp(key: Uint8Array, unixSeconds: number, digits = 6, algo: OtpAlgo = 'SHA-1', step = DEFAULT_STEP): Promise<HotpTrace> {
  return hotp(key, timeCounter(unixSeconds, step), digits, algo);
}

// --- Validação no servidor ---------------------------------------------------------------------
export interface VerifyOptions {
  digits?: number;
  algo?: OtpAlgo;
  step?: number;
  /** Quantos passos antes e depois do atual o servidor aceita (tolerância a atraso e a deriva de relógio). */
  window?: number;
  /** Maior contador já aceito: um código desse contador ou de um anterior é recusado (RFC 6238, seção 5.2). */
  lastAccepted?: bigint | null;
}

export interface VerifyResult {
  ok: boolean;
  /** Contador em que o código foi reconhecido, quando aceito. */
  counter: bigint | null;
  /** Contadores testados pelo servidor. */
  tried: bigint[];
  reason: 'aceito' | 'fora-da-janela' | 'ja-usado';
}

export async function verifyTotp(key: Uint8Array, unixSeconds: number, code: string, options: VerifyOptions = {}): Promise<VerifyResult> {
  const { digits = 6, algo = 'SHA-1', step = DEFAULT_STEP, window = 1, lastAccepted = null } = options;
  const now = timeCounter(unixSeconds, step);
  const tried: bigint[] = [];
  let matched: bigint | null = null;
  for (let d = -window; d <= window; d++) {
    const c = now + BigInt(d);
    if (c < 0n) continue;
    tried.push(c);
    const expected = (await hotp(key, c, digits, algo)).code;
    if (matched === null && expected === code) matched = c;
  }
  if (matched === null) return { ok: false, counter: null, tried, reason: 'fora-da-janela' };
  if (lastAccepted !== null && matched <= lastAccepted) return { ok: false, counter: matched, tried, reason: 'ja-usado' };
  return { ok: true, counter: matched, tried, reason: 'aceito' };
}

// --- Vetores de teste oficiais -----------------------------------------------------------------
/** RFC 4226, apêndice D: chave "12345678901234567890", contadores 0 a 9, 6 dígitos. */
export const HOTP_VECTORS: { counter: number; code: string }[] = [
  { counter: 0, code: '755224' },
  { counter: 1, code: '287082' },
  { counter: 2, code: '359152' },
  { counter: 3, code: '969429' },
  { counter: 4, code: '338314' },
  { counter: 5, code: '254676' },
  { counter: 6, code: '287922' },
  { counter: 7, code: '162583' },
  { counter: 8, code: '399871' },
  { counter: 9, code: '520489' },
];

/** RFC 6238, apêndice B: SHA-1 com a chave de 20 bytes "12345678901234567890", 8 dígitos. */
export const TOTP_VECTORS_SHA1: { time: number; code: string }[] = [
  { time: 59, code: '94287082' },
  { time: 1111111109, code: '07081804' },
  { time: 1111111111, code: '14050471' },
  { time: 1234567890, code: '89005924' },
  { time: 2000000000, code: '69279037' },
  { time: 20000000000, code: '65353130' },
];

export const RFC_SECRET = '12345678901234567890';

export interface VectorCheck {
  label: string;
  expected: string;
  obtained: string;
  ok: boolean;
}

/** Recalcula os vetores das RFCs e compara com os valores publicados. */
export async function checkRfcVectors(): Promise<VectorCheck[]> {
  const key = new TextEncoder().encode(RFC_SECRET);
  const out: VectorCheck[] = [];
  for (const v of HOTP_VECTORS) {
    const got = (await hotp(key, BigInt(v.counter), 6)).code;
    out.push({ label: `HOTP, contador ${v.counter}`, expected: v.code, obtained: got, ok: got === v.code });
  }
  for (const v of TOTP_VECTORS_SHA1) {
    const got = (await totp(key, v.time, 8)).code;
    out.push({ label: `TOTP SHA-1, tempo ${v.time} s`, expected: v.code, obtained: got, ok: got === v.code });
  }
  return out;
}
