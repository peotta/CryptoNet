// BOMBE (simulação didática do ataque de Turing e Welchman à Enigma): dado um texto provável (crib) alinhado à
// cifra, monta o "menu" (grafo de letras) e, para cada posição inicial dos rotores, testa se a hipótese de plugue
// de uma letra de teste leva a contradição ao propagar as consequências pelos circuitos da Enigma.
// Hipóteses do laboratório: Eva conhece a ordem dos rotores, o refletor e os anéis; procura as posições iniciais
// e o painel de plugues. A máquina física exigia que o rotor do meio não girasse durante o texto provável; aqui
// o avanço exato é simulado, de modo que essa restrição não existe.
import { CryptoInputError } from './bigmath';
import { normalizeText } from './classical';
import { LOG_BIGRAM } from './substitution';
import { MAX_PLUGS, REFLECTORS, ROTORS, validateConfig, type EnigmaConfig } from './enigma';

const code = (ch: string) => ch.charCodeAt(0) - 65;
const mod = (n: number) => ((n % 26) + 26) % 26;
const A = (c: number) => String.fromCharCode(65 + c);

export interface BombeSetup {
  rotors: EnigmaConfig['rotors'];
  reflector: EnigmaConfig['reflector'];
  rings: string;
}

export interface MenuEdge {
  /** Letra do texto provável (suposto texto claro). */
  plain: string;
  /** Letra cifrada na mesma tecla. */
  cipher: string;
  /** Número da tecla (a partir de 1) na mensagem. */
  step: number;
}

/** O menu: uma aresta por tecla do texto provável, ligando a letra clara à cifrada. */
export function bombeMenu(ciphertext: string, crib: string, offset: number): MenuEdge[] {
  const c = normalizeText(ciphertext);
  const p = normalizeText(crib);
  if (p.length < 3) throw new CryptoInputError('O texto provável deve ter ao menos 3 letras.');
  if (offset < 0 || offset + p.length > c.length) throw new CryptoInputError('O texto provável não cabe na mensagem a partir dessa posição.');
  const edges = [...p].map((ch, k) => ({ plain: ch, cipher: c[offset + k], step: offset + k + 1 }));
  const bad = edges.find((e) => e.plain === e.cipher);
  if (bad) throw new CryptoInputError(`Alinhamento impossível: a letra ${bad.plain} do texto provável coincide com a cifrada na tecla ${bad.step} (a Enigma nunca cifra uma letra em si mesma).`);
  return edges;
}

export interface MenuStats {
  letters: string[];
  components: number;
  /** Número de ciclos independentes: arestas - letras + componentes. */
  loops: number;
  /** Letra de maior grau (desempate: ordem alfabética), onde a hipótese de plugue é feita. */
  testLetter: string;
  degree: Record<string, number>;
}

export function menuStats(edges: MenuEdge[]): MenuStats {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const degree: Record<string, number> = {};
  for (const e of edges) {
    degree[e.plain] = (degree[e.plain] ?? 0) + 1;
    degree[e.cipher] = (degree[e.cipher] ?? 0) + 1;
    parent.set(find(e.plain), find(e.cipher));
  }
  const letters = Object.keys(degree).sort();
  const components = new Set(letters.map(find)).size;
  // a letra de teste fica no maior componente (o que mais restringe)
  const size = new Map<string, number>();
  letters.forEach((l) => size.set(find(l), (size.get(find(l)) ?? 0) + 1));
  const best = letters.slice().sort((a, b) => size.get(find(b))! - size.get(find(a))! || degree[b] - degree[a] || a.localeCompare(b))[0];
  return { letters, components, loops: edges.length - letters.length + components, testLetter: best, degree };
}

// ---------------- Máquina rápida (sem plugues) ----------------
interface Machine {
  wf: Uint8Array[]; // ligações de ida (esquerda, meio, direita)
  wb: Uint8Array[]; // ligações de volta
  refl: Uint8Array;
  rings: number[];
  notchM: number;
  notchR: number;
}

function buildMachine(setup: BombeSetup): Machine {
  const cfg = validateConfig({ rotors: setup.rotors, reflector: setup.reflector, positions: 'AAA', rings: setup.rings, plugs: '' });
  const wf = cfg.rotors.map((n) => Uint8Array.from([...ROTORS[n].wiring].map(code)));
  const wb = wf.map((w) => {
    const inv = new Uint8Array(26);
    w.forEach((v, i) => (inv[v] = i));
    return inv;
  });
  return {
    wf,
    wb,
    refl: Uint8Array.from([...REFLECTORS[cfg.reflector]].map(code)),
    rings: [...cfg.rings].map(code),
    notchM: code(ROTORS[cfg.rotors[1]].notch),
    notchR: code(ROTORS[cfg.rotors[2]].notch),
  };
}

/** Permutação do núcleo da máquina (rotores e refletor, sem plugues) para as posições dos rotores já avançadas. */
function corePermutation(m: Machine, l: number, mi: number, r: number, out: Uint8Array): void {
  const sL = l - m.rings[0];
  const sM = mi - m.rings[1];
  const sR = r - m.rings[2];
  for (let c = 0; c < 26; c++) {
    let x = mod(m.wf[2][mod(c + sR)] - sR);
    x = mod(m.wf[1][mod(x + sM)] - sM);
    x = mod(m.wf[0][mod(x + sL)] - sL);
    x = m.refl[x];
    x = mod(m.wb[0][mod(x + sL)] - sL);
    x = mod(m.wb[1][mod(x + sM)] - sM);
    x = mod(m.wb[2][mod(x + sR)] - sR);
    out[c] = x;
  }
}

/** Permutações do núcleo para as teclas 1..n a partir das posições iniciais dadas (uma por tecla, já avançada). */
export function coreSequence(setup: BombeSetup, start: string, n: number): Uint8Array[] {
  const m = buildMachine(setup);
  let [l, mi, r] = [...start.toUpperCase()].map(code);
  const seq: Uint8Array[] = [];
  for (let k = 0; k < n; k++) {
    if (mi === m.notchM) {
      l = mod(l + 1);
      mi = mod(mi + 1);
    } else if (r === m.notchR) {
      mi = mod(mi + 1);
    }
    r = mod(r + 1);
    const p = new Uint8Array(26);
    corePermutation(m, l, mi, r, p);
    seq.push(p);
  }
  return seq;
}

// ---------------- Propagação (o "diagonal board") ----------------
export interface Propagation {
  contradiction: boolean;
  /** Letra em que a contradição foi detectada, se houve. */
  at: string | null;
  /** Plugues deduzidos: para cada letra conhecida, a letra ligada a ela (-1 = desconhecido). */
  steckers: number[];
  /** Sequência didática das deduções: letra, valor deduzido e a tecla que a produziu. */
  log: { from: string; to: string; value: string; step: number }[];
  /** A dedução que levou à contradição: a letra já tinha outro plugue. */
  conflict: { from: string; to: string; value: string; step: number; existing: string } | null;
}

/**
 * Supõe que a letra de teste está ligada a `assumed` no painel de plugues e propaga: se S(a) = y e a tecla k liga a e b
 * (S(b) = E_k(S(a))), então S(b) = E_k(y). O painel é simétrico (S(a) = y implica S(y) = a). Contradição = uma letra
 * com dois plugues diferentes.
 */
export function propagate(edges: MenuEdge[], perms: Map<number, Uint8Array>, test: string, assumed: string, wantLog = false): Propagation {
  const S = new Int8Array(26).fill(-1);
  const log: Propagation['log'] = [];
  const adj = new Map<number, { to: number; step: number }[]>();
  for (const e of edges) {
    const a = code(e.plain);
    const b = code(e.cipher);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push({ to: b, step: e.step });
    (adj.get(b) ?? adj.set(b, []).get(b)!).push({ to: a, step: e.step });
  }
  const queue: number[] = [];
  let at: number | null = null;
  let conflict: Propagation['conflict'] = null;
  const assign = (a: number, y: number, from: number, step: number): boolean => {
    if (S[a] === y && S[y] === a) return true;
    if ((S[a] !== -1 && S[a] !== y) || (S[y] !== -1 && S[y] !== a)) {
      at = S[a] !== -1 && S[a] !== y ? a : y;
      conflict = { from: A(from), to: A(a), value: A(y), step, existing: A(S[at]) };
      return false;
    }
    S[a] = y;
    S[y] = a;
    if (wantLog) log.push({ from: A(from), to: A(a), value: A(y), step });
    queue.push(a);
    if (y !== a) queue.push(y);
    return true;
  };
  let ok = assign(code(test), code(assumed), code(test), 0);
  while (ok && queue.length) {
    const n = queue.shift()!;
    for (const { to, step } of adj.get(n) ?? []) {
      if (!ok) break;
      ok = assign(to, perms.get(step)![S[n]], n, step);
    }
  }
  return { contradiction: !ok, at: at === null ? null : A(at), steckers: Array.from(S), log, conflict };
}

export interface BombeStop {
  /** Posições iniciais dos rotores, da esquerda para a direita. */
  positions: string;
  /** Plugues deduzidos para a letra de teste (cada hipótese que sobreviveu). */
  survivors: string[];
  /** Pares de plugues deduzidos (a < b), para a primeira hipótese que sobreviveu. */
  pairs: string[];
  /** Letras que a propagação mostrou sem plugue. */
  unplugged: string[];
}

export interface BombeResult {
  tested: number;
  stops: BombeStop[];
  /** Número de posições eliminadas por contradição em todas as 26 hipóteses. */
  rejected: number;
}

const stepsOf = (edges: MenuEdge[]) => [...new Set(edges.map((e) => e.step))];

/** Perms por tecla do menu, para as posições iniciais dadas. */
function menuPerms(m: Machine, start: number, steps: number[], maxStep: number, scratch: Map<number, Uint8Array>): void {
  let l = Math.floor(start / 676);
  let mi = Math.floor(start / 26) % 26;
  let r = start % 26;
  const want = new Set(steps);
  for (let k = 1; k <= maxStep; k++) {
    if (mi === m.notchM) {
      l = mod(l + 1);
      mi = mod(mi + 1);
    } else if (m.notchR === r) {
      mi = mod(mi + 1);
    }
    r = mod(r + 1);
    if (want.has(k)) corePermutation(m, l, mi, r, scratch.get(k)!);
  }
}

export const startLabel = (i: number) => A(Math.floor(i / 676)) + A(Math.floor(i / 26) % 26) + A(i % 26);

/** Executa a Bombe sobre as 17.576 posições iniciais. */
export function bombeSearch(setup: BombeSetup, edges: MenuEdge[], testLetter: string): BombeResult {
  const m = buildMachine(setup);
  const steps = stepsOf(edges);
  const maxStep = Math.max(...steps);
  const scratch = new Map<number, Uint8Array>(steps.map((s) => [s, new Uint8Array(26)]));
  const stops: BombeStop[] = [];
  let rejected = 0;
  for (let start = 0; start < 17576; start++) {
    menuPerms(m, start, steps, maxStep, scratch);
    const survivors: string[] = [];
    let first: Propagation | null = null;
    for (let x = 0; x < 26; x++) {
      const p = propagate(edges, scratch, testLetter, A(x));
      if (!p.contradiction) {
        survivors.push(A(x));
        first ??= p;
      }
    }
    if (survivors.length === 0) rejected++;
    else stops.push({ positions: startLabel(start), survivors, ...pairsOf(first!.steckers) });
  }
  return { tested: 17576, stops, rejected };
}

function pairsOf(S: number[]): { pairs: string[]; unplugged: string[] } {
  const pairs: string[] = [];
  const unplugged: string[] = [];
  S.forEach((y, a) => {
    if (y === -1) return;
    if (y === a) unplugged.push(A(a));
    else if (a < y) pairs.push(A(a) + A(y));
  });
  return { pairs, unplugged };
}

// ---------------- Verificação e completamento do painel ----------------
/** Decifra `cipher` com as posições iniciais dadas e o painel de plugues `S` (Int8Array-like: S[a] = ligada a, ou a). */
export function decryptWith(seq: Uint8Array[], S: number[], cipher: string): string {
  let out = '';
  for (let i = 0; i < cipher.length; i++) out += A(S[seq[i][S[code(cipher[i])]]]);
  return out;
}

const readabilityOf = (seq: Uint8Array[], S: number[], codes: number[]): number => {
  let prev = -1;
  let total = 0;
  for (let i = 0; i < codes.length; i++) {
    const x = S[seq[i][S[codes[i]]]];
    if (prev >= 0) total += LOG_BIGRAM[prev][x];
    prev = x;
  }
  return total / Math.max(1, codes.length - 1);
};

export interface Completion {
  /** Painel final como pares ("AV BS ..."). */
  plugs: string;
  plaintext: string;
  readability: number;
  /** Pares acrescentados pelo completamento (além dos deduzidos pela Bombe). */
  added: string[];
}

/**
 * Parte dos plugues deduzidos pela Bombe e acrescenta, de forma gulosa, o par de letras livres que mais melhora a
 * legibilidade (pares de letras do português) do texto decifrado, até não haver melhora ou atingir 10 pares.
 */
export function completePlugboard(setup: BombeSetup, positions: string, cipher: string, known: string[], unplugged: string[]): Completion {
  const c = normalizeText(cipher);
  const codes = [...c].map(code);
  const seq = coreSequence(setup, positions, c.length);
  const S = Array.from({ length: 26 }, (_, i) => i);
  const fixed = new Set<number>(unplugged.map(code));
  for (const p of known) {
    S[code(p[0])] = code(p[1]);
    S[code(p[1])] = code(p[0]);
    fixed.add(code(p[0]));
    fixed.add(code(p[1]));
  }
  let pairsCount = known.length;
  let best = readabilityOf(seq, S, codes);
  const added: string[] = [];
  while (pairsCount < MAX_PLUGS) {
    let bestPair: [number, number] | null = null;
    let bestScore = best;
    for (let a = 0; a < 26; a++) {
      if (fixed.has(a) || S[a] !== a) continue;
      for (let b = a + 1; b < 26; b++) {
        if (fixed.has(b) || S[b] !== b) continue;
        S[a] = b;
        S[b] = a;
        const sc = readabilityOf(seq, S, codes);
        S[a] = a;
        S[b] = b;
        if (sc > bestScore + 1e-9) {
          bestScore = sc;
          bestPair = [a, b];
        }
      }
    }
    if (!bestPair) break;
    S[bestPair[0]] = bestPair[1];
    S[bestPair[1]] = bestPair[0];
    fixed.add(bestPair[0]);
    fixed.add(bestPair[1]);
    added.push(A(bestPair[0]) + A(bestPair[1]));
    best = bestScore;
    pairsCount++;
  }
  const all = [...known, ...added].map((p) => p).sort();
  return { plugs: all.join(' '), plaintext: decryptWith(seq, S, c), readability: best, added };
}

/** Permutações do núcleo por tecla do menu, para uma posição inicial (usadas pelo inspetor passo a passo). */
export function permsFor(setup: BombeSetup, start: string, edges: MenuEdge[]): Map<number, Uint8Array> {
  const t = start.toUpperCase();
  if (!/^[A-Z]{3}$/.test(t)) throw new CryptoInputError('As posições iniciais devem ter exatamente 3 letras (A a Z).');
  const m = buildMachine(setup);
  const steps = stepsOf(edges);
  const scratch = new Map<number, Uint8Array>(steps.map((k) => [k, new Uint8Array(26)]));
  menuPerms(m, code(t[0]) * 676 + code(t[1]) * 26 + code(t[2]), steps, Math.max(...steps), scratch);
  return scratch;
}

export interface BombeAttack {
  edges: MenuEdge[];
  stats: MenuStats;
  result: BombeResult;
  /** Paradas verificadas por Eva (decifrar e medir a legibilidade); vazio se houve paradas demais. */
  verified: { stop: BombeStop; completion: Completion }[];
  tooMany: boolean;
}

/** Limite de paradas que Eva verifica à mão (decifrando e lendo); acima disso o menu é fraco demais. */
export const MAX_VERIFIED_STOPS = 60;

/** Ataque completo: menu, busca em todas as posições iniciais e verificação das paradas. */
export function bombeAttack(setup: BombeSetup, ciphertext: string, crib: string, offset: number): BombeAttack {
  const edges = bombeMenu(ciphertext, crib, offset);
  const stats = menuStats(edges);
  const result = bombeSearch(setup, edges, stats.testLetter);
  const tooMany = result.stops.length > MAX_VERIFIED_STOPS;
  const verified = tooMany
    ? []
    : result.stops
        .map((stop) => ({ stop, completion: completePlugboard(setup, stop.positions, ciphertext, stop.pairs, stop.unplugged) }))
        .sort((a, b) => b.completion.readability - a.completion.readability);
  return { edges, stats, result, verified, tooMany };
}
