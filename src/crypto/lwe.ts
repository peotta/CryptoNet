// LWE (Learning With Errors) em escala didática: a ideia por trás do ML-KEM com números minúsculos,
// para que cada conta caiba na tela. Nada aqui oferece segurança: os parâmetros reais são centenas de vezes maiores.

export interface LweParams {
  /** Dimensão do segredo s. */
  n: number;
  /** Número de amostras (linhas de A). */
  m: number;
  /** Módulo primo. */
  q: number;
  /** Ruído: cada erro e_i fica no intervalo [-B, B]. B = 0 não tem ruído. */
  noise: number;
}

export const DEFAULT_LWE: LweParams = { n: 3, m: 8, q: 97, noise: 1 };

const mod = (x: number, q: number) => ((x % q) + q) % q;
/** Representante centrado de x módulo q, no intervalo (-q/2, q/2]. */
export const centeredMod = (x: number, q: number) => {
  const r = mod(x, q);
  return r > q / 2 ? r - q : r;
};

/** Gerador pseudoaleatório pequeno (mulberry32): a mesma semente repete a demonstração. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LweKeys {
  params: LweParams;
  /** Segredo de Alice. */
  s: number[];
  /** Matriz pública m x n. */
  A: number[][];
  /** Erros pequenos (ficam com Alice). */
  e: number[];
  /** b = A s + e (mod q), pública. */
  b: number[];
}

export function lweKeyGen(params: LweParams, seed: number): LweKeys {
  const { n, m, q, noise } = params;
  const rnd = prng(seed);
  const s = Array.from({ length: n }, () => Math.floor(rnd() * q));
  const A = Array.from({ length: m }, () => Array.from({ length: n }, () => Math.floor(rnd() * q)));
  const e = Array.from({ length: m }, () => Math.floor(rnd() * (2 * noise + 1)) - noise);
  const b = A.map((row, i) => mod(row.reduce((acc, a, j) => acc + a * s[j], 0) + e[i], q));
  return { params, s, A, e, b };
}

export interface LweCiphertext {
  /** Subconjunto das linhas escolhido por Bob (vetor de 0 e 1). */
  r: number[];
  u: number[];
  v: number;
  bit: 0 | 1;
}

/** Cifra um bit: soma as linhas escolhidas por r e esconde o bit na metade do módulo (q/2). */
export function lweEncrypt(keys: Pick<LweKeys, 'params' | 'A' | 'b'>, bit: 0 | 1, seed: number): LweCiphertext {
  const { n, m, q } = keys.params;
  const rnd = prng(seed);
  const r: number[] = Array.from({ length: m }, () => (rnd() < 0.5 ? 0 : 1));
  const u = Array.from({ length: n }, (_, j) => mod(r.reduce((acc, ri, i) => acc + ri * keys.A[i][j], 0), q));
  const v = mod(r.reduce((acc, ri, i) => acc + ri * keys.b[i], 0) + bit * Math.floor(q / 2), q);
  return { r, u, v, bit };
}

export interface LweDecryption {
  /** v - s.u (mod q), centrado: perto de 0 é o bit 0 e perto de q/2 é o bit 1. */
  d: number;
  bit: 0 | 1;
  /** Folga: quanto falta para o ruído acumulado atrapalhar a decisão (positivo é seguro). */
  margin: number;
}

export function lweDecrypt(params: LweParams, s: number[], u: number[], v: number): LweDecryption {
  const { q } = params;
  const d = centeredMod(v - u.reduce((acc, ui, j) => acc + ui * s[j], 0), q);
  const bit: 0 | 1 = Math.abs(d) > q / 4 ? 1 : 0;
  // O valor ideal é 0 (bit 0) ou q/2 (bit 1); a decisão erra quando o ruído passa de q/4.
  const noise = bit === 0 ? Math.abs(d) : Math.abs(Math.abs(d) - Math.floor(q / 2));
  return { d, bit, margin: Math.floor(q / 4) - noise };
}

/** Eliminação de Gauss-Jordan módulo q (q primo): resolve as n primeiras equações independentes. */
export function gaussSolve(params: LweParams, A: number[][], b: number[]): number[] | null {
  const { n, q } = params;
  const inv = (a: number) => {
    let r = 1;
    for (let e = q - 2, base = mod(a, q); e > 0; e >>= 1) {
      if (e & 1) r = (r * base) % q;
      base = (base * base) % q;
    }
    return r;
  };
  const M = A.map((row, i) => [...row, b[i]]);
  let rank = 0;
  for (let col = 0; col < n; col++) {
    const piv = M.findIndex((row, i) => i >= rank && row[col] % q !== 0);
    if (piv < 0) return null;
    [M[rank], M[piv]] = [M[piv], M[rank]];
    const f = inv(M[rank][col]);
    M[rank] = M[rank].map((x) => (x * f) % q);
    for (let i = 0; i < M.length; i++) {
      if (i !== rank && M[i][col] % q !== 0) {
        const k = M[i][col];
        M[i] = M[i].map((x, j) => mod(x - k * M[rank][j], q));
      }
    }
    rank++;
  }
  return Array.from({ length: n }, (_, i) => M[i][n]);
}

export interface LweAttack {
  /** Segredo encontrado (ou null). */
  found: number[] | null;
  /** O candidato reproduz o segredo verdadeiro? */
  correct: boolean;
  /** Maior |b - A s'| entre todas as amostras: com o segredo certo é no máximo o ruído B. */
  residual: number;
  tries: number;
}

const residualOf = (params: LweParams, A: number[][], b: number[], s: number[]) =>
  Math.max(...A.map((row, i) => Math.abs(centeredMod(b[i] - row.reduce((acc, a, j) => acc + a * s[j], 0), params.q))));

/** Ataque algébrico: resolve o sistema como se não houvesse ruído. Funciona só quando B = 0. */
export function attackGauss(keys: LweKeys): LweAttack {
  const found = gaussSolve(keys.params, keys.A, keys.b);
  if (!found) return { found: null, correct: false, residual: Infinity, tries: 1 };
  return { found, correct: found.every((x, j) => x === keys.s[j]), residual: residualOf(keys.params, keys.A, keys.b, found), tries: 1 };
}

/** Ataque exaustivo: testa todos os segredos e guarda o primeiro cujo resíduo cabe no ruído. Só cabe em n muito pequeno. */
export function attackBruteForce(keys: LweKeys): LweAttack {
  const { n, q, noise } = keys.params;
  const total = q ** n;
  const cand = new Array<number>(n).fill(0);
  for (let t = 0; t < total; t++) {
    let x = t;
    for (let j = n - 1; j >= 0; j--) {
      cand[j] = x % q;
      x = Math.floor(x / q);
    }
    const residual = residualOf(keys.params, keys.A, keys.b, cand);
    if (residual <= noise) return { found: cand.slice(), correct: cand.every((c, j) => c === keys.s[j]), residual, tries: t + 1 };
  }
  return { found: null, correct: false, residual: Infinity, tries: total };
}
