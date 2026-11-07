// Protocolo de Needham-Schroeder de chave pública (1978) e a correção de Lowe (1995).
//
// A cifragem é RSA DIDÁTICO SEM PADDING, com primos de 64 bits (módulo de 128 bits): suficiente para
// mostrar o protocolo, inseguro como cifra real. O foco do laboratório é a lógica de autenticação
// (nonces e identidades), não a robustez da cifra.
import { bitLength, CryptoInputError, gcd, isProbablePrime, modInverse, modPow } from './bigmath';

export type Principal = 'A' | 'B' | 'E';
export type Variant = 'original' | 'corrigido';
export type Scenario = 'normal' | 'ataque';

/** Fonte de octetos aleatórios (Web Crypto em uso normal; determinística em testes e documentação). */
export type RandomSource = (n: number) => Uint8Array;

export const PRINCIPAL_CODE: Record<Principal, number> = { A: 1, B: 2, E: 3 };
export const PRINCIPAL_NAME: Record<Principal, string> = { A: 'Alice', B: 'Bob', E: 'Eva' };
export const NONCE_BYTES = 4;
export const PRIME_BITS = 64;
export const PUBLIC_EXPONENT = 65537n;

export interface NsKeyPair {
  n: bigint;
  e: bigint;
  d: bigint;
  p: bigint;
  q: bigint;
}

const bytesToBig = (b: Uint8Array): bigint => b.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n);
function bigToBytes(v: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  for (let i = len - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}
export const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function randomPrime(rand: RandomSource, avoid?: bigint): bigint {
  for (let i = 0; i < 20000; i++) {
    const b = rand(PRIME_BITS / 8).slice();
    b[0] |= 0x80; // força 64 bits
    b[b.length - 1] |= 1; // ímpar
    const c = bytesToBig(b);
    if (c !== avoid && isProbablePrime(c) && gcd(PUBLIC_EXPONENT, c - 1n) === 1n) return c;
  }
  throw new CryptoInputError('Não foi possível sortear um primo.');
}

/** Par de chaves RSA didático (e = 65537, módulo de 128 bits). */
export function makeKeyPair(rand: RandomSource): NsKeyPair {
  const p = randomPrime(rand);
  const q = randomPrime(rand, p);
  const n = p * q;
  const d = modInverse(PUBLIC_EXPONENT, (p - 1n) * (q - 1n));
  return { n, e: PUBLIC_EXPONENT, d, p, q };
}

/** Cifra uma sequência de octetos (no máximo 14) com a chave pública; um octeto 0x01 à frente preserva o tamanho. */
export function encryptFor(pub: Pick<NsKeyPair, 'n' | 'e'>, data: Uint8Array): bigint {
  if (data.length > 14) throw new CryptoInputError('A mensagem é grande demais para o módulo didático.');
  const m = (1n << BigInt(8 * data.length)) | bytesToBig(data);
  if (m >= pub.n) throw new CryptoInputError('A mensagem não cabe no módulo.');
  return modPow(m, pub.e, pub.n);
}

/** Decifra com a chave privada; devolve null se o resultado não tiver o formato esperado (chave errada). */
export function decryptWith(priv: Pick<NsKeyPair, 'n' | 'd'>, c: bigint): Uint8Array | null {
  const m = modPow(c, priv.d, priv.n);
  const bits = bitLength(m);
  if (bits < 9 || (bits - 1) % 8 !== 0 || bits - 1 > 8 * 14) return null;
  return bigToBytes(m & ((1n << BigInt(bits - 1)) - 1n), (bits - 1) / 8);
}

export const nonceHex = (n: Uint8Array): string => hex(n);
export const cipherHex = (c: bigint): string => c.toString(16).padStart(32, '0');

/** Conteúdo em claro das mensagens do protocolo. */
export const packMsg1 = (na: Uint8Array, sender: Principal): Uint8Array => Uint8Array.of(...na, PRINCIPAL_CODE[sender]);
export const packMsg2 = (na: Uint8Array, nb: Uint8Array, responder: Principal | null): Uint8Array =>
  responder ? Uint8Array.of(...na, ...nb, PRINCIPAL_CODE[responder]) : Uint8Array.of(...na, ...nb);
export const packMsg3 = (nb: Uint8Array): Uint8Array => Uint8Array.from(nb);

const codeToPrincipal = (c: number): Principal | null => (c === 1 ? 'A' : c === 2 ? 'B' : c === 3 ? 'E' : null);

export interface Msg1 {
  na: Uint8Array;
  sender: Principal | null;
}
export function unpackMsg1(d: Uint8Array | null): Msg1 | null {
  if (!d || d.length !== NONCE_BYTES + 1) return null;
  return { na: d.slice(0, NONCE_BYTES), sender: codeToPrincipal(d[NONCE_BYTES]) };
}
export interface Msg2 {
  na: Uint8Array;
  nb: Uint8Array;
  /** Identidade do respondente (só na versão corrigida). */
  responder: Principal | null;
}
export function unpackMsg2(d: Uint8Array | null, fixed: boolean): Msg2 | null {
  const len = 2 * NONCE_BYTES + (fixed ? 1 : 0);
  if (!d || d.length !== len) return null;
  return { na: d.slice(0, NONCE_BYTES), nb: d.slice(NONCE_BYTES, 2 * NONCE_BYTES), responder: fixed ? codeToPrincipal(d[2 * NONCE_BYTES]) : null };
}
export function unpackMsg3(d: Uint8Array | null): Uint8Array | null {
  return d && d.length === NONCE_BYTES ? d.slice() : null;
}

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Uma mensagem trocada no canal, já cifrada, com a descrição de quem a lê. */
export interface WireMessage {
  /** Número da mensagem no protocolo: 1, 2 ou 3. */
  step: 1 | 2 | 3;
  from: Principal;
  to: Principal;
  /** Quem diz ser o remetente do ponto de vista do protocolo (Eva se passa por Alice). */
  claimedFrom: Principal;
  /** Chave pública usada na cifragem. */
  encryptedFor: Principal;
  cipher: bigint;
  /** O conteúdo em claro, conhecido por quem decifrou. */
  plain: Uint8Array;
  /** Mensagem refeita por Eva (decifrada e recifrada para outro destinatário). */
  relayedByEva: boolean;
}

export interface NsRun {
  variant: Variant;
  scenario: Scenario;
  keys: Record<Principal, NsKeyPair>;
  na: Uint8Array;
  nb: Uint8Array;
  messages: WireMessage[];
  /** Alice: o que concluiu ao receber a mensagem 2. */
  aliceCheck: { naMatches: boolean; responderMatches: boolean | null; accepted: boolean; reason: string };
  /** Bob: o que concluiu ao receber a mensagem 3. */
  bobCheck: { nbMatches: boolean; accepted: boolean };
  /** Com quem Alice acredita estar falando e com quem Bob acredita estar falando. */
  aliceTalksTo: Principal;
  bobBelievesPeer: Principal | null;
  /** Eva conhece Na e Nb? */
  evaKnowsNa: boolean;
  evaKnowsNb: boolean;
  /** O ataque teve êxito: Bob aceitou Eva como se fosse Alice. */
  attackSucceeded: boolean;
}

export interface RunOptions {
  variant: Variant;
  scenario: Scenario;
  rand: RandomSource;
}

/**
 * Executa o protocolo.
 *  - normal: Alice inicia uma sessão com Bob.
 *  - ataque: Alice inicia uma sessão com Eva (um participante legítimo, mas desonesto), que reaproveita
 *    a sessão para se passar por Alice diante de Bob (ataque de Lowe, 1995).
 */
export function runNeedhamSchroeder({ variant, scenario, rand }: RunOptions): NsRun {
  const fixed = variant === 'corrigido';
  const keys: Record<Principal, NsKeyPair> = { A: makeKeyPair(rand), B: makeKeyPair(rand), E: makeKeyPair(rand) };
  const na = rand(NONCE_BYTES).slice();
  const nb = rand(NONCE_BYTES).slice();
  const messages: WireMessage[] = [];
  const attack = scenario === 'ataque';
  const peer: Principal = attack ? 'E' : 'B'; // com quem Alice acredita falar

  // Mensagem 1: Alice -> peer: {Na, A}_Kpeer
  const p1 = packMsg1(na, 'A');
  messages.push({ step: 1, from: 'A', to: peer, claimedFrom: 'A', encryptedFor: peer, cipher: encryptFor(keys[peer], p1), plain: p1, relayedByEva: false });

  if (attack) {
    // Eva decifra, e recifra para Bob como se fosse Alice.
    const got = unpackMsg1(decryptWith(keys.E, messages[0].cipher))!;
    const re = packMsg1(got.na, 'A');
    messages.push({ step: 1, from: 'E', to: 'B', claimedFrom: 'A', encryptedFor: 'B', cipher: encryptFor(keys.B, re), plain: re, relayedByEva: true });
  }

  // Bob decifra a mensagem 1 e responde com a mensagem 2 a quem diz ser o remetente (Alice).
  const m1ForBob = attack ? messages[1] : messages[0];
  const bobGot = unpackMsg1(decryptWith(keys.B, m1ForBob.cipher))!;
  const bobPeer = bobGot.sender as Principal; // Bob acredita falar com Alice
  const p2 = packMsg2(bobGot.na, nb, fixed ? 'B' : null);
  const c2 = encryptFor(keys[bobPeer], p2);
  messages.push({ step: 2, from: 'B', to: attack ? 'E' : 'A', claimedFrom: 'B', encryptedFor: bobPeer, cipher: c2, plain: p2, relayedByEva: false });

  if (attack) {
    // Eva não decifra a mensagem 2 (é para a chave de Alice) e a repassa a Alice sem alteração.
    messages.push({ step: 2, from: 'E', to: 'A', claimedFrom: 'B', encryptedFor: 'A', cipher: c2, plain: p2, relayedByEva: true });
  }

  // Alice decifra a mensagem 2 e confere.
  const m2ForAlice = messages[messages.length - 1];
  const aliceGot = unpackMsg2(decryptWith(keys.A, m2ForAlice.cipher), fixed);
  const naMatches = !!aliceGot && same(aliceGot.na, na);
  const responderMatches = fixed ? !!aliceGot && aliceGot.responder === peer : null;
  const aliceAccepted = naMatches && (responderMatches ?? true);
  const aliceReason = !aliceGot
    ? 'A mensagem 2 não pôde ser decifrada.'
    : !naMatches
      ? 'O nonce Na devolvido não confere.'
      : responderMatches === false
        ? `A identidade dentro da mensagem 2 é ${PRINCIPAL_NAME[aliceGot.responder ?? 'A']}, e não ${PRINCIPAL_NAME[peer]}: Alice aborta o protocolo.`
        : 'O nonce Na confere' + (fixed ? ' e a identidade do respondente é a esperada.' : ': Alice acredita que Bob está vivo e é quem responde.');

  let bobAccepted = false;
  let nbMatches = false;
  let evaKnowsNb = false;
  if (aliceAccepted && aliceGot) {
    // Mensagem 3: Alice -> peer: {Nb}_Kpeer
    const p3 = packMsg3(aliceGot.nb);
    messages.push({ step: 3, from: 'A', to: peer, claimedFrom: 'A', encryptedFor: peer, cipher: encryptFor(keys[peer], p3), plain: p3, relayedByEva: false });
    let toBob = messages[messages.length - 1];
    if (attack) {
      const got = unpackMsg3(decryptWith(keys.E, toBob.cipher))!;
      evaKnowsNb = same(got, nb);
      const re = packMsg3(got);
      messages.push({ step: 3, from: 'E', to: 'B', claimedFrom: 'A', encryptedFor: 'B', cipher: encryptFor(keys.B, re), plain: re, relayedByEva: true });
      toBob = messages[messages.length - 1];
    }
    const bobNb = unpackMsg3(decryptWith(keys.B, toBob.cipher));
    nbMatches = !!bobNb && same(bobNb, nb);
    bobAccepted = nbMatches;
  }

  const evaKnowsNa = attack; // Eva decifrou a mensagem 1, que era para ela
  return {
    variant,
    scenario,
    keys,
    na,
    nb,
    messages,
    aliceCheck: { naMatches, responderMatches, accepted: aliceAccepted, reason: aliceReason },
    bobCheck: { nbMatches, accepted: bobAccepted },
    aliceTalksTo: peer,
    bobBelievesPeer: bobAccepted ? bobPeer : null,
    evaKnowsNa,
    evaKnowsNb: attack && evaKnowsNb,
    attackSucceeded: attack && bobAccepted,
  };
}
