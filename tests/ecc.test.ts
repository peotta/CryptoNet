import { describe, expect, it } from 'vitest';
import { CryptoInputError } from '../src/crypto/bigmath';
import {
  addTrace,
  curvePoints,
  discreteLogBruteForce,
  ecdh,
  ecdsaSign,
  ecdsaVerify,
  hashToInt,
  isOnCurve,
  modInverse,
  pointAdd,
  pointNeg,
  publicKey,
  realSignatureDemo,
  realSigSupported,
  recoverFromNonceReuse,
  samePoint,
  scalarMul,
  scalarMulTrace,
  showPoint,
  TOY_CURVE as C,
  type Point,
} from '../src/crypto/ecc';

const G = C.G;
const P = (x: number, y: number): Point => ({ x: BigInt(x), y: BigInt(y) });

describe('curva didática y² = x³ + 2x + 2 (mod 17)', () => {
  it('tem 19 pontos (o infinito incluído) e G é gerador de ordem 19', () => {
    const pts = curvePoints(C);
    expect(pts).toHaveLength(19);
    expect(pts.filter((p) => p !== null).every((p) => isOnCurve(C, p))).toBe(true);
    expect(scalarMul(C, 19n, G)).toBeNull();
    for (let k = 1n; k < 19n; k++) expect(scalarMul(C, k, G)).not.toBeNull();
  });
  it('múltiplos de G conferem com o exemplo clássico', () => {
    const expected = [[5, 1], [6, 3], [10, 6], [3, 1], [9, 16], [16, 13], [0, 6], [13, 7], [7, 6], [7, 11], [13, 10], [0, 11], [16, 4], [9, 1], [3, 16], [10, 11], [6, 14], [5, 16]];
    expected.forEach(([x, y], i) => expect(scalarMul(C, BigInt(i + 1), G)).toEqual(P(x, y)));
  });
  it('soma de pontos: dobro, soma, oposto e identidade', () => {
    expect(addTrace(C, G, G)).toMatchObject({ kind: 'dobro', lambda: 13n, R: P(6, 3) });
    expect(addTrace(C, P(5, 1), P(6, 3))).toMatchObject({ kind: 'soma', R: P(10, 6) });
    expect(addTrace(C, G, pointNeg(C, G))).toMatchObject({ kind: 'oposto', R: null });
    expect(addTrace(C, null, G).R).toEqual(G);
    expect(addTrace(C, G, null).kind).toBe('identidade');
    expect(pointAdd(C, null, null)).toBeNull();
  });
  it('a soma é comutativa e associativa na curva', () => {
    const pts = curvePoints(C);
    for (const a of pts) for (const b of pts) expect(samePoint(pointAdd(C, a, b), pointAdd(C, b, a))).toBe(true);
    const [a, b, c] = [P(5, 1), P(7, 6), P(3, 16)];
    expect(samePoint(pointAdd(C, pointAdd(C, a, b), c), pointAdd(C, a, pointAdd(C, b, c)))).toBe(true);
  });
  it('a multiplicação escalar mostra uma operação de grupo por passo (dobrar e somar)', () => {
    const t = scalarMulTrace(C, 13n, G); // 13 = 1101
    expect(t.bits).toBe('1101');
    expect(t.steps.map((s) => s.op)).toEqual(['dobrar', 'somar', 'dobrar', 'somar', 'dobrar', 'dobrar', 'somar']);
    expect(t.result).toEqual(P(16, 4));
    expect(scalarMulTrace(C, 0n, G).result).toBeNull();
    expect(() => scalarMulTrace(C, -1n, G)).toThrow(CryptoInputError);
  });
  it('modInverse', () => {
    expect(modInverse(3n, 17n)).toBe(6n);
    expect(() => modInverse(2n, 4n)).toThrow(/não tem inverso/);
  });
  it('showPoint', () => {
    expect(showPoint(null)).toMatch(/infinito/);
    expect(showPoint(P(5, 1))).toBe('(5, 1)');
  });
});

describe('ECDH na curva didática', () => {
  it('Alice e Bob chegam ao mesmo ponto', () => {
    for (let a = 1n; a < 19n; a += 3n) {
      for (let b = 2n; b < 19n; b += 4n) {
        expect(ecdh(C, a, publicKey(C, b))).toEqual(ecdh(C, b, publicKey(C, a)));
      }
    }
  });
  it('Eva resolve o logaritmo discreto por força bruta em até 19 somas', () => {
    const Q = publicKey(C, 11n);
    expect(discreteLogBruteForce(C, Q)).toEqual({ k: 11n, tries: 11 });
    expect(discreteLogBruteForce(C, null).k).toBe(19n);
  });
  it('valida chaves e pontos', () => {
    expect(() => publicKey(C, 0n)).toThrow(/entre 1 e 18/);
    expect(() => publicKey(C, 19n)).toThrow(CryptoInputError);
    expect(() => ecdh(C, 3n, P(1, 1))).toThrow(/não é um ponto válido/);
    expect(() => ecdh(C, 3n, null)).toThrow(CryptoInputError);
  });
});

describe('ECDSA na curva didática', () => {
  const d = 7n;
  const Q = publicKey(C, d);
  it('assina e verifica; rejeita mensagem alterada', () => {
    const sig = ecdsaSign(C, d, 10n, 5n);
    expect(ecdsaVerify(C, Q, 10n, sig.r, sig.s).valid).toBe(true);
    expect(ecdsaVerify(C, Q, 11n, sig.r, sig.s).valid).toBe(false);
    expect(ecdsaVerify(C, publicKey(C, 8n), 10n, sig.r, sig.s).valid).toBe(false);
    expect(ecdsaVerify(C, Q, 10n, 0n, sig.s).valid).toBe(false);
  });
  it('a reutilização do nonce k revela k e a chave privada', () => {
    const s1 = ecdsaSign(C, d, 4n, 9n);
    const s2 = ecdsaSign(C, d, 12n, 9n);
    expect(s1.r).toBe(s2.r);
    expect(recoverFromNonceReuse(C, 4n, s1.s, 12n, s2.s, s1.r)).toEqual({ k: 9n, d });
  });
  it('nonces diferentes dão r diferentes e nada vaza', () => {
    const s1 = ecdsaSign(C, d, 4n, 9n);
    const s3 = ecdsaSign(C, d, 12n, 6n);
    expect(s1.r).not.toBe(s3.r);
  });
  it('valida k e converte o hash em inteiro', () => {
    expect(() => ecdsaSign(C, d, 4n, 0n)).toThrow(/entre 1 e 18/);
    expect(hashToInt(Uint8Array.of(0xff, 0x00), 19n)).toBe(31n); // 5 bits mais à esquerda de 11111111 00000000
    expect(hashToInt(Uint8Array.of(0x01), 2n ** 20n)).toBe(1n);
  });
});

describe('assinaturas reais (Web Crypto)', () => {
  it.each(['ECDSA-P256', 'Ed25519'] as const)('%s: assina, verifica e rejeita a mensagem alterada', async (algo) => {
    if (!(await realSigSupported(algo))) return; // ambiente sem suporte
    const msg = new TextEncoder().encode('Transferir R$ 100');
    const ok = await realSignatureDemo(algo, msg, false);
    expect(ok.valid).toBe(true);
    expect(ok.signatureBytes).toBe(64);
    const bad = await realSignatureDemo(algo, msg, true);
    expect(bad.valid).toBe(false);
    expect(bad.receivedHex).not.toBe(bad.messageHex);
  });
  it('Ed25519 é determinístico e ECDSA não (nonce aleatório)', async () => {
    if (await realSigSupported('Ed25519')) expect((await realSignatureDemo('Ed25519', Uint8Array.of(1, 2, 3), false)).deterministic).toBe(true);
    const e = await realSignatureDemo('ECDSA-P256', Uint8Array.of(1, 2, 3), false);
    expect(e.deterministic).toBe(false);
    expect(e.publicBytes).toBe(65);
  });
  it('rejeita mensagem vazia', async () => {
    await expect(realSignatureDemo('ECDSA-P256', new Uint8Array(0), false)).rejects.toThrow(/Digite a mensagem/);
  });
});
