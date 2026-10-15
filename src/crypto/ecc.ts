// CURVAS ELÍPTICAS. Parte didática (BigInt): aritmética de pontos sobre uma curva minúscula y² = x³ + ax + b (mod p),
// com rastros passo a passo, ECDH, ECDSA e os ataques a uma curva pequena e à reutilização do nonce k.
// Parte real (Web Crypto): ECDSA P-256 e Ed25519. A curva didática NÃO oferece segurança alguma.
import { CryptoInputError } from './bigmath';
import { toHex } from './encoding';

export type Point = { x: bigint; y: bigint } | null; // null = ponto no infinito (elemento neutro)

export interface Curve {
  name: string;
  p: bigint;
  a: bigint;
  b: bigint;
  G: { x: bigint; y: bigint };
  /** Ordem (prima) do subgrupo gerado por G. */
  n: bigint;
}

/** Curva clássica de livros-texto: y² = x³ + 2x + 2 (mod 17), G = (5, 1), ordem 19. */
export const TOY_CURVE: Curve = { name: 'y² = x³ + 2x + 2 (mod 17)', p: 17n, a: 2n, b: 2n, G: { x: 5n, y: 1n }, n: 19n };

const mod = (v: bigint, m: bigint) => ((v % m) + m) % m;

export function modInverse(a: bigint, m: bigint): bigint {
  let [r0, r1] = [mod(a, m), m];
  let [s0, s1] = [1n, 0n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1n) throw new CryptoInputError(`${a} não tem inverso módulo ${m}.`);
  return mod(s0, m);
}

export const isOnCurve = (c: Curve, P: Point): boolean => P === null || mod(P.y * P.y - (P.x ** 3n + c.a * P.x + c.b), c.p) === 0n;

/** Todos os pontos da curva (incluindo o infinito, que vem por último). */
export function curvePoints(c: Curve): Point[] {
  const out: Point[] = [];
  for (let x = 0n; x < c.p; x++) for (let y = 0n; y < c.p; y++) if (isOnCurve(c, { x, y })) out.push({ x, y });
  out.push(null);
  return out;
}

export const showPoint = (P: Point): string => (P === null ? 'O (infinito)' : `(${P.x}, ${P.y})`);
export const samePoint = (A: Point, B: Point): boolean => (A === null || B === null ? A === B : A.x === B.x && A.y === B.y);

export type AddKind = 'identidade' | 'oposto' | 'soma' | 'dobro' | 'dobro-y0';

export interface AddStep {
  kind: AddKind;
  P: Point;
  Q: Point;
  /** Inclinação λ = (y2 − y1)/(x2 − x1) para soma, ou (3x² + a)/(2y) para dobro. */
  numerator?: bigint;
  denominator?: bigint;
  inverse?: bigint;
  lambda?: bigint;
  R: Point;
}

/** Soma de pontos com todos os valores intermediários, para a visualização passo a passo. */
export function addTrace(c: Curve, P: Point, Q: Point): AddStep {
  if (P === null) return { kind: 'identidade', P, Q, R: Q };
  if (Q === null) return { kind: 'identidade', P, Q, R: P };
  if (P.x === Q.x && mod(P.y + Q.y, c.p) === 0n) return { kind: P.y === 0n ? 'dobro-y0' : 'oposto', P, Q, R: null };
  const dbl = P.x === Q.x && P.y === Q.y;
  const numerator = dbl ? mod(3n * P.x * P.x + c.a, c.p) : mod(Q.y - P.y, c.p);
  const denominator = dbl ? mod(2n * P.y, c.p) : mod(Q.x - P.x, c.p);
  const inverse = modInverse(denominator, c.p);
  const lambda = mod(numerator * inverse, c.p);
  const x3 = mod(lambda * lambda - P.x - Q.x, c.p);
  const y3 = mod(lambda * (P.x - x3) - P.y, c.p);
  return { kind: dbl ? 'dobro' : 'soma', P, Q, numerator, denominator, inverse, lambda, R: { x: x3, y: y3 } };
}

export const pointAdd = (c: Curve, P: Point, Q: Point): Point => addTrace(c, P, Q).R;
export const pointNeg = (c: Curve, P: Point): Point => (P === null ? null : { x: P.x, y: mod(-P.y, c.p) });

export interface MulStep {
  /** Índice do bit (do mais para o menos significativo) e seu valor. */
  bitIndex: number;
  bit: 0 | 1;
  op: 'dobrar' | 'somar';
  before: Point;
  after: Point;
  detail: AddStep;
}

/** Multiplicação escalar por dobrar-e-somar (da esquerda para a direita), uma operação de grupo por passo. */
export function scalarMulTrace(c: Curve, k: bigint, P: Point): { steps: MulStep[]; result: Point; bits: string } {
  if (k < 0n) throw new CryptoInputError('O escalar deve ser não negativo.');
  const bits = k.toString(2);
  let acc: Point = null;
  const steps: MulStep[] = [];
  [...bits].forEach((ch, i) => {
    const bit = ch === '1' ? 1 : 0;
    const d = addTrace(c, acc, acc);
    steps.push({ bitIndex: i, bit, op: 'dobrar', before: acc, after: d.R, detail: d });
    acc = d.R;
    if (bit) {
      const s = addTrace(c, acc, P);
      steps.push({ bitIndex: i, bit, op: 'somar', before: acc, after: s.R, detail: s });
      acc = s.R;
    }
  });
  return { steps, result: acc, bits };
}

export const scalarMul = (c: Curve, k: bigint, P: Point): Point => scalarMulTrace(c, k, P).result;

/** Menor k > 0 com k·G = Q (força bruta do logaritmo discreto); devolve também quantas somas foram feitas. */
export function discreteLogBruteForce(c: Curve, Q: Point): { k: bigint | null; tries: number } {
  let acc: Point = null;
  for (let k = 1n; k <= c.n; k++) {
    acc = pointAdd(c, acc, c.G);
    if (samePoint(acc, Q)) return { k, tries: Number(k) };
  }
  return { k: null, tries: Number(c.n) };
}

export function validatePrivate(c: Curve, d: bigint): void {
  if (d < 1n || d >= c.n) throw new CryptoInputError(`A chave privada deve estar entre 1 e ${c.n - 1n}.`);
}

export const publicKey = (c: Curve, d: bigint): Point => {
  validatePrivate(c, d);
  return scalarMulTrace(c, d, c.G).result;
};

/** ECDH: o ponto compartilhado d·Q; o segredo é a coordenada x. */
export function ecdh(c: Curve, d: bigint, Q: Point): Point {
  validatePrivate(c, d);
  if (Q === null || !isOnCurve(c, Q)) throw new CryptoInputError('A chave pública recebida não é um ponto válido da curva.');
  return scalarMulTrace(c, d, Q).result;
}

// ---------------- ECDSA ----------------
/** Converte o hash em inteiro: os bits mais à esquerda, em número igual ao tamanho de n (FIPS 186-4). */
export function hashToInt(hash: Uint8Array, n: bigint): bigint {
  const nb = n.toString(2).length;
  let v = 0n;
  for (const byte of hash) v = (v << 8n) | BigInt(byte);
  const hb = hash.length * 8;
  return hb > nb ? v >> BigInt(hb - nb) : v;
}

export interface EcdsaSignature {
  r: bigint;
  s: bigint;
  k: bigint;
  kG: Point;
}

/** Assinatura ECDSA com o nonce k explícito (para expor o que acontece quando ele se repete). */
export function ecdsaSign(c: Curve, d: bigint, z: bigint, k: bigint): EcdsaSignature {
  validatePrivate(c, d);
  if (k < 1n || k >= c.n) throw new CryptoInputError(`O nonce k deve estar entre 1 e ${c.n - 1n}.`);
  const kG = scalarMulTrace(c, k, c.G).result;
  const r = mod(kG!.x, c.n);
  const s = mod(modInverse(k, c.n) * (mod(z, c.n) + r * d), c.n);
  if (r === 0n || s === 0n) throw new CryptoInputError('Assinatura degenerada (r ou s igual a zero): escolha outro k.');
  return { r, s, k, kG };
}

export interface EcdsaVerification {
  valid: boolean;
  w: bigint;
  u1: bigint;
  u2: bigint;
  point: Point;
}

export function ecdsaVerify(c: Curve, Q: Point, z: bigint, r: bigint, s: bigint): EcdsaVerification {
  if (r < 1n || r >= c.n || s < 1n || s >= c.n) return { valid: false, w: 0n, u1: 0n, u2: 0n, point: null };
  const w = modInverse(s, c.n);
  const u1 = mod(mod(z, c.n) * w, c.n);
  const u2 = mod(r * w, c.n);
  const point = pointAdd(c, scalarMulTrace(c, u1, c.G).result, scalarMulTrace(c, u2, Q).result);
  return { valid: point !== null && mod(point.x, c.n) === r, w, u1, u2, point };
}

/**
 * Reutilização do nonce: duas assinaturas com o mesmo k (logo o mesmo r) revelam k e a chave privada d.
 * s1 − s2 = k⁻¹(z1 − z2)  ⇒  k = (z1 − z2)/(s1 − s2);  d = (s1·k − z1)/r.
 */
export function recoverFromNonceReuse(c: Curve, z1: bigint, s1: bigint, z2: bigint, s2: bigint, r: bigint): { k: bigint; d: bigint } | null {
  const ds = mod(s1 - s2, c.n);
  if (ds === 0n) return null;
  const k = mod(mod(z1 - z2, c.n) * modInverse(ds, c.n), c.n);
  const d = mod((s1 * k - z1) * modInverse(r, c.n), c.n);
  return { k, d };
}

// ---------------- Assinaturas reais (Web Crypto) ----------------
export type RealSigAlgo = 'ECDSA-P256' | 'Ed25519';

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto indisponível: use HTTPS ou localhost em um navegador atual.');
  return s;
}

const keyGenParams = (a: RealSigAlgo) => (a === 'Ed25519' ? { name: 'Ed25519' } : { name: 'ECDSA', namedCurve: 'P-256' }) as EcKeyGenParams;
const algoParams = (a: RealSigAlgo) => (a === 'Ed25519' ? { name: 'Ed25519' } : { name: 'ECDSA', hash: 'SHA-256' });

export async function realSigSupported(algo: RealSigAlgo): Promise<boolean> {
  try {
    await subtle().generateKey(keyGenParams(algo), false, ['sign', 'verify']);
    return true;
  } catch {
    return false;
  }
}

export interface RealSigRun {
  algo: RealSigAlgo;
  publicHex: string;
  signatureHex: string;
  /** Segunda assinatura da mesma mensagem: igual no Ed25519 (determinístico), diferente no ECDSA (nonce aleatório). */
  secondSignatureHex: string;
  deterministic: boolean;
  messageHex: string;
  /** Mensagem recebida por Bob (alterada por Eva, se for o caso). */
  receivedHex: string;
  valid: boolean;
  signatureBytes: number;
  publicBytes: number;
}

export async function realSignatureDemo(algo: RealSigAlgo, message: Uint8Array, tamper: boolean): Promise<RealSigRun> {
  if (message.length === 0) throw new CryptoInputError('Digite a mensagem a assinar.');
  const pair = await subtle().generateKey(keyGenParams(algo), true, ['sign', 'verify']);
  const params = algoParams(algo);
  const sig = new Uint8Array(await subtle().sign(params, pair.privateKey, message as BufferSource));
  const sig2 = new Uint8Array(await subtle().sign(params, pair.privateKey, message as BufferSource));
  const received = Uint8Array.from(message);
  if (tamper) received[0] ^= 0x01;
  const valid = await subtle().verify(params, pair.publicKey, sig as BufferSource, received as BufferSource);
  const pub = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
  return {
    algo,
    publicHex: toHex(pub),
    signatureHex: toHex(sig),
    secondSignatureHex: toHex(sig2),
    deterministic: toHex(sig) === toHex(sig2),
    messageHex: toHex(message),
    receivedHex: toHex(received),
    valid,
    signatureBytes: sig.length,
    publicBytes: pub.length,
  };
}
