// DIFFIE-HELLMAN DIDÁTICO sobre Z_p^*, com BigInt. Grupos pequenos servem à visualização
// e NÃO oferecem segurança. Em produção, usar grupos >= 2048 bits (RFC 7919) ou ECDH (X25519).
import { CryptoInputError, isPrimitiveRoot, isProbablePrime, modPow } from './bigmath';
import { randomBigIntInRange } from './random';

export const DH_LIMITS = { minP: 11n, maxP: 1_000_000_000n } as const;

export interface DhGroup {
  id: string;
  name: string;
  p: bigint;
  g: bigint;
  note: string;
}

/** Grupos didáticos previamente validados (p primo seguro e g raiz primitiva; verificado nos testes). */
export const DH_GROUPS: DhGroup[] = [
  { id: 'g23', name: 'p = 23, g = 5', p: 23n, g: 5n, note: 'Exemplo clássico de livro-texto; permite acompanhar todas as contas à mão.' },
  { id: 'g467', name: 'p = 467, g = 2', p: 467n, g: 2n, note: 'Primo seguro (467 = 2 x 233 + 1); g = 2 gera todo o grupo.' },
  { id: 'g2027', name: 'p = 2027, g = 2', p: 2027n, g: 2n, note: 'Primo seguro (2027 = 2 x 1013 + 1); espaço de segredos maior.' },
];

export interface DhParamCheck {
  errors: string[];
  warnings: string[];
}

export function checkDhParameters(p: bigint, g: bigint): DhParamCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (p < DH_LIMITS.minP || p > DH_LIMITS.maxP) {
    errors.push(`p deve estar entre ${DH_LIMITS.minP} e ${DH_LIMITS.maxP} (limite didático).`);
  } else if (!isProbablePrime(p)) {
    errors.push(`p = ${p} não é primo.`);
  } else {
    if (g < 2n || g > p - 2n) errors.push(`g deve satisfazer 2 ≤ g ≤ p - 2 = ${p - 2n}.`);
    else if (!isPrimitiveRoot(g, p)) {
      warnings.push(`g = ${g} não é raiz primitiva módulo ${p}: gera apenas um subgrupo, reduzindo o espaço de valores possíveis.`);
    }
    if (!isProbablePrime((p - 1n) / 2n) || (p - 1n) % 2n !== 0n) {
      warnings.push('p não é um primo seguro (p = 2q + 1): o grupo admite subgrupos pequenos, o que facilita ataques.');
    }
  }
  return { errors, warnings };
}

export function checkPrivateExponent(label: string, x: bigint, p: bigint): string | null {
  return x < 2n || x > p - 2n ? `${label} deve satisfazer 2 ≤ ${label} ≤ p - 2 = ${p - 2n}.` : null;
}

export function generatePrivateExponent(p: bigint): bigint {
  return randomBigIntInRange(2n, p - 2n);
}

export interface DhSession {
  p: bigint;
  g: bigint;
  a: bigint;
  b: bigint;
  A: bigint;
  B: bigint;
  kAlice: bigint;
  kBob: bigint;
  match: boolean;
}

export function runDhSession(p: bigint, g: bigint, a: bigint, b: bigint): DhSession {
  const errors = checkDhParameters(p, g).errors;
  const ea = checkPrivateExponent('a', a, p);
  const eb = checkPrivateExponent('b', b, p);
  const all = [...errors, ...(ea ? [ea] : []), ...(eb ? [eb] : [])];
  if (all.length) throw new CryptoInputError(all.join(' '));
  const A = modPow(g, a, p);
  const B = modPow(g, b, p);
  const kAlice = modPow(B, a, p);
  const kBob = modPow(A, b, p);
  return { p, g, a, b, A, B, kAlice, kBob, match: kAlice === kBob };
}

export interface MitmSession {
  p: bigint;
  g: bigint;
  a: bigint;
  b: bigint;
  e: bigint;
  A: bigint;
  B: bigint;
  /** Valor público de Eva, enviado a Alice e a Bob no lugar de B e de A. */
  E: bigint;
  kAlice: bigint; // E^a = K_AE
  kBob: bigint; // E^b = K_EB
  kEvaAlice: bigint; // A^e
  kEvaBob: bigint; // B^e
  aliceMatchesEva: boolean;
  bobMatchesEva: boolean;
  aliceMatchesBob: boolean;
}

export function runMitmSession(p: bigint, g: bigint, a: bigint, b: bigint, e: bigint): MitmSession {
  const base = runDhSession(p, g, a, b);
  const ee = checkPrivateExponent('e', e, p);
  if (ee) throw new CryptoInputError(ee);
  const E = modPow(g, e, p);
  const kAlice = modPow(E, a, p);
  const kBob = modPow(E, b, p);
  const kEvaAlice = modPow(base.A, e, p);
  const kEvaBob = modPow(base.B, e, p);
  return {
    p, g, a, b, e,
    A: base.A,
    B: base.B,
    E,
    kAlice,
    kBob,
    kEvaAlice,
    kEvaBob,
    aliceMatchesEva: kAlice === kEvaAlice,
    bobMatchesEva: kBob === kEvaBob,
    aliceMatchesBob: kAlice === kBob,
  };
}

export interface BruteForceResult {
  found: boolean;
  exponent: bigint | null;
  iterations: number;
}

/** Busca exaustiva de x com g^x = target (mod p): só viável em grupos minúsculos. */
export function bruteForceDiscreteLog(g: bigint, target: bigint, p: bigint, maxIterations = 5_000_000): BruteForceResult {
  let cur = 1n;
  const limit = BigInt(maxIterations);
  for (let x = 1n; x <= limit && x < p; x++) {
    cur = (cur * g) % p;
    if (cur === target) return { found: true, exponent: x, iterations: Number(x) };
  }
  return { found: false, exponent: null, iterations: maxIterations };
}
