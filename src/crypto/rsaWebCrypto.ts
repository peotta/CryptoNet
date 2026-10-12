// RSA REAL via Web Crypto API: RSA-OAEP (cifragem) e RSA-PSS (assinatura), ambos com SHA-256.
// Chaves privadas são geradas como não extraíveis: jamais saem do módulo criptográfico do navegador.
import { fromBase64Url, toHex } from './encoding';

export const RSA_KEY_SIZES = [2048, 3072, 4096] as const;
export type RsaKeySize = (typeof RSA_KEY_SIZES)[number];

export const HASH_BYTES = 32; // SHA-256
export const PSS_SALT_BYTES = 32;

/** Tamanho máximo da mensagem em RSA-OAEP: k - 2*hLen - 2 (RFC 8017, seção 7.1.1). */
export function oaepMaxMessageBytes(size: RsaKeySize): number {
  return size / 8 - 2 * HASH_BYTES - 2;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto indisponível: use HTTPS ou localhost em um navegador atual.');
  return s;
}

function generate(name: 'RSA-OAEP' | 'RSA-PSS', size: RsaKeySize, usages: KeyUsage[]): Promise<CryptoKeyPair> {
  return subtle().generateKey(
    { name, modulusLength: size, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    false, // chave privada não extraível
    usages,
  ) as Promise<CryptoKeyPair>;
}

export const generateOaepKeyPair = (size: RsaKeySize) => generate('RSA-OAEP', size, ['encrypt', 'decrypt']);
export const generatePssKeyPair = (size: RsaKeySize) => generate('RSA-PSS', size, ['sign', 'verify']);

export async function encryptOaep(publicKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().encrypt({ name: 'RSA-OAEP' }, publicKey, data as BufferSource));
}

export async function decryptOaep(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().decrypt({ name: 'RSA-OAEP' }, privateKey, data as BufferSource));
}

export async function signPss(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().sign({ name: 'RSA-PSS', saltLength: PSS_SALT_BYTES }, privateKey, data as BufferSource));
}

export function verifyPss(publicKey: CryptoKey, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
  return subtle().verify({ name: 'RSA-PSS', saltLength: PSS_SALT_BYTES }, publicKey, signature as BufferSource, data as BufferSource);
}

export interface PublicKeyInfo {
  modulusBits: number;
  modulusHex: string;
  exponent: number;
}

/** Parâmetros públicos (n, e) lidos do JWK da chave pública. */
export async function describePublicKey(publicKey: CryptoKey): Promise<PublicKeyInfo> {
  const jwk = await subtle().exportKey('jwk', publicKey);
  const n = fromBase64Url(jwk.n ?? '');
  const e = fromBase64Url(jwk.e ?? '');
  const exponent = e.reduce((acc, b) => acc * 256 + b, 0);
  const first = n.findIndex((b) => b !== 0);
  const trimmed = n.slice(Math.max(first, 0));
  const lead = trimmed.length ? Math.clz32(trimmed[0]) - 24 : 0;
  return { modulusBits: trimmed.length * 8 - lead, modulusHex: toHex(trimmed), exponent };
}

/** Inverte um bit (primeiro byte) para simular adulteração em trânsito. */
export function flipBit(data: Uint8Array, index = 0): Uint8Array {
  const copy = new Uint8Array(data);
  copy[index] ^= 0x01;
  return copy;
}
