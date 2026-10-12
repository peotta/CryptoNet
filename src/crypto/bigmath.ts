// Aritmética modular com BigInt. SIMULAÇÃO MATEMÁTICA EDUCACIONAL: sem tempo constante,
// nunca deve ser usada para proteger dados reais.

export class CryptoInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoInputError';
  }
}

/** Exponenciação modular por quadrados repetidos: base^exp mod mod, em O(log exp). */
export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod <= 0n) throw new CryptoInputError('O módulo deve ser positivo.');
  if (exp < 0n) throw new CryptoInputError('O expoente deve ser não negativo.');
  if (mod === 1n) return 0n;
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
}

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

export interface EgcdRow {
  q: bigint | null;
  r: bigint;
  s: bigint;
  t: bigint;
}

/** Algoritmo de Euclides estendido com rastro: r = s*a + t*b em cada linha. */
export function egcdTrace(a: bigint, b: bigint): { g: bigint; x: bigint; y: bigint; rows: EgcdRow[] } {
  const rows: EgcdRow[] = [
    { q: null, r: a, s: 1n, t: 0n },
    { q: null, r: b, s: 0n, t: 1n },
  ];
  let [r0, r1, s0, s1, t0, t1] = [a, b, 1n, 0n, 0n, 1n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
    [t0, t1] = [t1, t0 - q * t1];
    rows.push({ q, r: r1, s: s1, t: t1 });
  }
  return { g: r0, x: s0, y: t0, rows };
}

/** Inverso modular a^-1 mod m; lança erro se gcd(a, m) != 1. */
export function modInverse(a: bigint, m: bigint): bigint {
  if (m <= 1n) throw new CryptoInputError('O módulo deve ser maior que 1.');
  const { g, x } = egcdTrace(((a % m) + m) % m, m);
  if (g !== 1n) throw new CryptoInputError(`${a} não possui inverso módulo ${m}, pois mdc(${a}, ${m}) = ${g}.`);
  return ((x % m) + m) % m;
}

const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

/** Miller-Rabin; determinístico para n < 3,3 x 10^24 com as 12 primeiras bases primas. */
export function isProbablePrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of MR_BASES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }
  outer: for (const a of MR_BASES) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

/** Fatoração por divisão tentativa (uso limitado a números pequenos). */
export function primeFactors(n: bigint): bigint[] {
  const out: bigint[] = [];
  let m = n;
  for (let f = 2n; f * f <= m; f += f === 2n ? 1n : 2n) {
    if (m % f === 0n) {
      out.push(f);
      while (m % f === 0n) m /= f;
    }
  }
  if (m > 1n) out.push(m);
  return out;
}

/** g é raiz primitiva módulo o primo p se gera todo o grupo multiplicativo (ordem p - 1). */
export function isPrimitiveRoot(g: bigint, p: bigint): boolean {
  if (g % p === 0n) return false;
  const phi = p - 1n;
  return primeFactors(phi).every((q) => modPow(g, phi / q, p) !== 1n);
}

export function bitLength(n: bigint): number {
  return n === 0n ? 0 : n.toString(2).length;
}

/** Converte texto decimal em BigInt com limite de tamanho, sem lançar SyntaxError. */
export function parseDecimal(text: string, label: string, maxDigits = 18): bigint {
  const t = text.trim();
  if (t === '') throw new CryptoInputError(`Informe um valor para ${label}.`);
  if (!/^\d+$/.test(t)) throw new CryptoInputError(`${label} deve ser um inteiro não negativo (apenas dígitos).`);
  if (t.length > maxDigits) throw new CryptoInputError(`${label} excede o limite didático de ${maxDigits} dígitos.`);
  return BigInt(t);
}
