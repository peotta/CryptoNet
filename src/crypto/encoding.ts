export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Bytes a partir de dígitos hexadecimais (número par de dígitos). */
export function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (x) => parseInt(x, 16));
}

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Inteiro não negativo em bytes big-endian (mínimo de 1 byte). */
export function bigintToBytes(value: bigint): Uint8Array {
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  return Uint8Array.from(hex.match(/../g) ?? ['00'], (h) => parseInt(h, 16));
}

/** Abrevia uma sequência hexadecimal longa para exibição. */
export function abbreviateHex(hex: string, keep = 16): string {
  return hex.length <= keep * 2 + 1 ? hex : `${hex.slice(0, keep)}…${hex.slice(-keep)}`;
}
