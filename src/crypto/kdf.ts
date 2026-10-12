// OPERAÇÕES CRIPTOGRÁFICAS REAIS: HKDF-SHA-256 (RFC 5869) e AES-256-GCM (NIST SP 800-38D)
// via Web Crypto. Usadas para mostrar como um segredo de DH vira uma chave simétrica.
import { bigintToBytes, toHex, utf8Decode, utf8Encode } from './encoding';
import { randomBytes } from './random';

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto indisponível: use HTTPS ou localhost em um navegador atual.');
  return s;
}

export async function hkdfSha256(secret: bigint, info: string, salt: Uint8Array = new Uint8Array(32), lengthBytes = 32): Promise<Uint8Array> {
  const ikm = await subtle().importKey('raw', bigintToBytes(secret) as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: utf8Encode(info) as BufferSource },
    ikm,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
}

export interface SealedMessage {
  iv: Uint8Array;
  ciphertext: Uint8Array; // inclui a tag de autenticação de 16 bytes ao final
}

async function aesKey(keyBytes: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  return subtle().importKey('raw', keyBytes as BufferSource, 'AES-GCM', false, [usage]);
}

export async function aesGcmEncrypt(keyBytes: Uint8Array, plaintext: string): Promise<SealedMessage> {
  const iv = randomBytes(12);
  const key = await aesKey(keyBytes, 'encrypt');
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, utf8Encode(plaintext) as BufferSource);
  return { iv, ciphertext: new Uint8Array(ct) };
}

export async function aesGcmDecrypt(keyBytes: Uint8Array, sealed: SealedMessage): Promise<string> {
  const key = await aesKey(keyBytes, 'decrypt');
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: sealed.iv as BufferSource }, key, sealed.ciphertext as BufferSource);
  return utf8Decode(new Uint8Array(pt));
}

export { toHex };
