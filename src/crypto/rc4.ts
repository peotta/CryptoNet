// RC4 (Rivest, 1987): cifra de fluxo com um estado de 256 bytes. Hoje proibida no TLS (RFC 7465) e abandonada no Wi-Fi (WEP).
// Implementação didática com rastro, vetores de teste conhecidos e o ataque FMS contra o WEP. Não use para proteger dados reais.
import { CryptoInputError } from './bigmath';

export const RC4_N = 256;
export const RC4_MAX_KEY = 256;

export function validateRc4Key(key: Uint8Array): void {
  if (key.length < 1 || key.length > RC4_MAX_KEY) throw new CryptoInputError(`A chave do RC4 deve ter de 1 a ${RC4_MAX_KEY} bytes; recebida com ${key.length}.`);
}

export interface KsaStep {
  /** Passo i da KSA (0 a 255): j = j + S[i] + K[i mod tamanho]; troca S[i] com S[j]. */
  i: number;
  j: number;
  /** Byte da chave usado: K[i mod tamanho]. */
  keyByte: number;
  /** Estado depois da troca. */
  state: Uint8Array;
}

/** Estado inicial (identidade) e KSA (key-scheduling algorithm) com o rastro de cada troca. */
export function ksaTrace(key: Uint8Array): { steps: KsaStep[]; state: Uint8Array } {
  validateRc4Key(key);
  const S = Uint8Array.from({ length: RC4_N }, (_, i) => i);
  let j = 0;
  const steps: KsaStep[] = [];
  for (let i = 0; i < RC4_N; i++) {
    const keyByte = key[i % key.length];
    j = (j + S[i] + keyByte) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
    steps.push({ i, j, keyByte, state: S.slice() });
  }
  return { steps, state: S };
}

export interface PrgaStep {
  /** Número do byte gerado (1, 2, ...). */
  n: number;
  i: number;
  j: number;
  /** Posição t = S[i] + S[j] (depois da troca) e byte de saída K = S[t]. */
  t: number;
  out: number;
  state: Uint8Array;
}

/** PRGA (pseudo-random generation algorithm): gera `count` bytes a partir de um estado, com o rastro de cada um. */
export function prgaTrace(initial: Uint8Array, count: number, skip = 0): PrgaStep[] {
  const S = initial.slice();
  let i = 0;
  let j = 0;
  const out: PrgaStep[] = [];
  for (let n = 1; n <= skip + count; n++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
    const t = (S[i] + S[j]) & 0xff;
    if (n > skip) out.push({ n: n - skip, i, j, t, out: S[t], state: S.slice() });
  }
  return out;
}

/** Fluxo de chaves de `n` bytes, descartando os `drop` primeiros (RC4-drop[n]). */
export function rc4Stream(key: Uint8Array, n: number, drop = 0): Uint8Array {
  validateRc4Key(key);
  const S = Uint8Array.from({ length: RC4_N }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < RC4_N; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const out = new Uint8Array(n);
  let a = 0;
  let b = 0;
  for (let k = 0; k < drop + n; k++) {
    a = (a + 1) & 0xff;
    b = (b + S[a]) & 0xff;
    [S[a], S[b]] = [S[b], S[a]];
    if (k >= drop) out[k - drop] = S[(S[a] + S[b]) & 0xff];
  }
  return out;
}

/** Cifra ou decifra (a operação é a mesma): XOR com o fluxo de chaves. */
export function rc4Crypt(key: Uint8Array, data: Uint8Array, drop = 0): Uint8Array {
  const ks = rc4Stream(key, data.length, drop);
  return data.map((b, i) => b ^ ks[i]);
}

// ---------------------------------------------------------------------------------------------
// WEP: chave por pacote = IV (3 bytes, em claro) seguido da chave raiz. O ataque FMS (Fluhrer, Mantin e Shamir, 2001).
// ---------------------------------------------------------------------------------------------
export const WEP_IV_BYTES = 3;
/** Primeiro byte do cabeçalho LLC/SNAP de todo quadro IP no 802.11: conhecido por Eva. */
export const SNAP_FIRST_BYTE = 0xaa;

export const wepKey = (iv: Uint8Array, root: Uint8Array): Uint8Array => Uint8Array.from([...iv, ...root]);
export const wepEncrypt = (iv: Uint8Array, root: Uint8Array, plain: Uint8Array): Uint8Array => rc4Crypt(wepKey(iv, root), plain);

export interface WepPacket {
  iv: Uint8Array;
  /** Primeiro byte cifrado do quadro. */
  c0: number;
}

export interface FmsByteResult {
  /** Posição do byte da chave raiz (0 a n-1). */
  index: number;
  /** Candidatos ordenados por número de votos. */
  ranking: { value: number; votes: number }[];
  /** Pacotes com IV fracos (B+3, 255, X) usados. */
  packets: number;
  /** Pacotes em que a condição de resolução vale (os que votam). */
  voters: number;
}
export interface FmsResult {
  key: Uint8Array;
  bytes: FmsByteResult[];
}

/**
 * Para o byte B da chave raiz, com os bytes anteriores conhecidos, usa os IV da forma (B+3, 255, X):
 * em cerca de 5% dos casos o primeiro byte do fluxo revela K[B].
 */
export function fmsVotes(known: Uint8Array, index: number, packets: WepPacket[]): FmsByteResult {
  const votes = new Array<number>(256).fill(0);
  let used = 0;
  let voters = 0;
  const A = index + WEP_IV_BYTES;
  for (const p of packets) {
    if (p.iv[0] !== A || p.iv[1] !== 255) continue;
    used++;
    const K = Uint8Array.from([...p.iv, ...known]);
    const S = Uint8Array.from({ length: RC4_N }, (_, i) => i);
    let j = 0;
    for (let i = 0; i < A; i++) {
      j = (j + S[i] + K[i]) & 0xff;
      [S[i], S[j]] = [S[j], S[i]];
    }
    // Condição de resolução: S[1] < A e S[1] + S[S[1]] = A (então, em geral, o primeiro byte de saída vem de S[A]).
    if (S[1] < A && ((S[1] + S[S[1]]) & 0xff) === A) {
      voters++;
      const z = p.c0 ^ SNAP_FIRST_BYTE;
      const inv = S.indexOf(z);
      votes[(inv - j - S[A] + 512) & 0xff]++;
    }
  }
  const ranking = votes.map((v, value) => ({ value, votes: v })).sort((a, b) => b.votes - a.votes || a.value - b.value);
  return { index, ranking, packets: used, voters };
}

/** Recupera a chave raiz byte a byte (o candidato mais votado de cada posição). */
export function fmsRecover(rootLen: number, packets: WepPacket[]): FmsResult {
  const key = new Uint8Array(rootLen);
  const bytes: FmsByteResult[] = [];
  for (let b = 0; b < rootLen; b++) {
    const r = fmsVotes(key.slice(0, b), b, packets);
    key[b] = r.ranking[0].value;
    bytes.push(r);
  }
  return { key, bytes };
}

/** Pacotes que um ponto de acesso gera quando o IV percorre os valores fracos para cada byte da chave. */
export function weakPackets(root: Uint8Array, rootLen: number): WepPacket[] {
  const out: WepPacket[] = [];
  for (let b = 0; b < rootLen; b++) {
    for (let x = 0; x < 256; x++) {
      const iv = Uint8Array.of(b + WEP_IV_BYTES, 255, x);
      out.push({ iv, c0: rc4Stream(wepKey(iv, root), 1)[0] ^ SNAP_FIRST_BYTE });
    }
  }
  return out;
}

export interface FmsVerified extends FmsResult {
  /** A chave com o candidato mais votado de cada byte já servia. */
  greedyOk: boolean;
  /** Número de chaves testadas contra o quadro de verificação (1 se a primeira servia). */
  tested: number;
  /** Alguma combinação dos três candidatos mais votados passou na verificação. */
  found: boolean;
}

/**
 * Como `fmsRecover`, mas confere a chave contra um quadro cujo claro Eva conhece (`verify`). Se o candidato mais votado de
 * cada byte não servir, testa as combinações dos três mais votados (3^n chaves), como fazem as ferramentas reais.
 */
export function fmsRecoverVerified(rootLen: number, packets: WepPacket[], verify: (key: Uint8Array) => boolean): FmsVerified {
  const r = fmsRecover(rootLen, packets);
  if (verify(r.key)) return { ...r, greedyOk: true, tested: 1, found: true };
  const top = r.bytes.map((b) => b.ranking.slice(0, 3).map((x) => x.value));
  const total = 3 ** rootLen;
  let tested = 1;
  for (let n = 0; n < total; n++) {
    const key = new Uint8Array(rootLen);
    let m = n;
    for (let b = 0; b < rootLen; b++) {
      key[b] = top[b][m % 3];
      m = Math.floor(m / 3);
    }
    tested++;
    if (verify(key)) return { ...r, key, greedyOk: false, tested, found: true };
  }
  return { ...r, greedyOk: false, tested, found: false };
}
