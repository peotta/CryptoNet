// MÁQUINA ENIGMA (Wehrmacht, Enigma I / M3): três rotores escolhidos entre cinco, refletor B ou C, anéis
// (Ringstellung) e painel de plugues. Simulação de ensino; as ligações dos rotores são as históricas.
import { CryptoInputError } from './bigmath';
import { ALPHABET, normalizeText } from './classical';

export const ROTOR_NAMES = ['I', 'II', 'III', 'IV', 'V'] as const;
export type RotorName = (typeof ROTOR_NAMES)[number];
export const REFLECTOR_NAMES = ['B', 'C'] as const;
export type ReflectorName = (typeof REFLECTOR_NAMES)[number];

/** Ligações (entrada A-Z → saída) e posição do entalhe: o rotor à esquerda avança quando este rotor passa pela letra do entalhe. */
export const ROTORS: Record<RotorName, { wiring: string; notch: string }> = {
  I: { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  II: { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
  IV: { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
  V: { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' },
};
export const REFLECTORS: Record<ReflectorName, string> = {
  B: 'YRUHQSLDPXNGOKMIEBFZCWVJAT',
  C: 'FVPJIAOYEDRZXWGCTKUQSBNMHL',
};

/** Teclado da Enigma (QWERTZ), usado na visualização. */
export const KEYBOARD_ROWS = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'];

export interface EnigmaConfig {
  /** Rotores da esquerda para a direita (o rotor da direita gira a cada tecla). */
  rotors: [RotorName, RotorName, RotorName];
  reflector: ReflectorName;
  /** Letras visíveis nas janelas, da esquerda para a direita (3 letras). */
  positions: string;
  /** Anéis (Ringstellung), da esquerda para a direita (3 letras). */
  rings: string;
  /** Pares do painel de plugues, como "AV BS CG" (até 10 pares). */
  plugs: string;
}

export const MAX_PLUGS = 10;
const code = (ch: string) => ch.charCodeAt(0) - 65;
const mod = (n: number) => ((n % 26) + 26) % 26;

export function parsePlugs(text: string): [string, string][] {
  const t = text.toUpperCase().trim();
  if (t === '') return [];
  const pairs = t.split(/[\s,]+/).filter(Boolean);
  const used = new Set<string>();
  const out: [string, string][] = [];
  for (const p of pairs) {
    if (!/^[A-Z]{2}$/.test(p)) throw new CryptoInputError(`O par de plugues "${p}" deve ter exatamente duas letras (A a Z).`);
    if (p[0] === p[1]) throw new CryptoInputError(`O par "${p}" liga uma letra a ela mesma.`);
    for (const ch of p) {
      if (used.has(ch)) throw new CryptoInputError(`A letra ${ch} aparece em mais de um par de plugues.`);
      used.add(ch);
    }
    out.push([p[0], p[1]]);
  }
  if (out.length > MAX_PLUGS) throw new CryptoInputError(`O painel tem no máximo ${MAX_PLUGS} pares de plugues.`);
  return out;
}

function threeLetters(label: string, v: string): string {
  const t = v.toUpperCase();
  if (!/^[A-Z]{3}$/.test(t)) throw new CryptoInputError(`${label} deve ter exatamente 3 letras (A a Z).`);
  return t;
}

export function validateConfig(cfg: EnigmaConfig): EnigmaConfig {
  const [l, m, r] = cfg.rotors;
  if (![l, m, r].every((x) => ROTOR_NAMES.includes(x))) throw new CryptoInputError('Rotor inválido: escolha entre I, II, III, IV e V.');
  if (new Set([l, m, r]).size !== 3) throw new CryptoInputError('Os três rotores devem ser diferentes entre si.');
  if (!REFLECTOR_NAMES.includes(cfg.reflector)) throw new CryptoInputError('Refletor inválido: escolha B ou C.');
  const plugs = parsePlugs(cfg.plugs);
  return { ...cfg, positions: threeLetters('As posições iniciais', cfg.positions), rings: threeLetters('Os anéis', cfg.rings), plugs: plugs.map((p) => p.join('')).join(' ') };
}

function plugMap(plugs: string): number[] {
  const map = Array.from({ length: 26 }, (_, i) => i);
  for (const [a, b] of parsePlugs(plugs)) {
    map[code(a)] = code(b);
    map[code(b)] = code(a);
  }
  return map;
}

const inverse = (wiring: string): number[] => {
  const inv = new Array<number>(26);
  [...wiring].forEach((ch, i) => (inv[code(ch)] = i));
  return inv;
};

/** Avança os rotores conforme a regra da Enigma I, inclusive o "passo duplo" do rotor do meio. */
export function stepRotors(pos: number[], rotors: [RotorName, RotorName, RotorName]): { pos: number[]; stepped: [boolean, boolean, boolean] } {
  const [l, m, r] = [0, 1, 2];
  const next = [...pos];
  const rightAtNotch = pos[r] === code(ROTORS[rotors[r]].notch);
  const middleAtNotch = pos[m] === code(ROTORS[rotors[m]].notch);
  const stepped: [boolean, boolean, boolean] = [false, false, true];
  if (middleAtNotch) {
    next[l] = mod(pos[l] + 1);
    next[m] = mod(pos[m] + 1);
    stepped[0] = true;
    stepped[1] = true;
  } else if (rightAtNotch) {
    next[m] = mod(pos[m] + 1);
    stepped[1] = true;
  }
  next[r] = mod(pos[r] + 1);
  return { pos: next, stepped };
}

/** Rótulos, em ordem, das dez letras do caminho do sinal por uma tecla. */
export const PATH_STAGES = [
  'Tecla',
  'Plugues',
  'Rotor direito',
  'Rotor do meio',
  'Rotor esquerdo',
  'Refletor',
  'Rotor esquerdo (volta)',
  'Rotor do meio (volta)',
  'Rotor direito (volta)',
  'Plugues (volta) e lâmpada',
] as const;

export interface KeyTrace {
  index: number;
  input: string;
  output: string;
  before: string;
  after: string;
  stepped: [boolean, boolean, boolean];
  /** Letra em cada estágio de PATH_STAGES. */
  path: string[];
}

export interface EnigmaResult {
  output: string;
  trace: KeyTrace[];
  finalPositions: string;
}

const letters = (pos: number[]) => pos.map((p) => ALPHABET[p]).join('');

/** Passa o texto pela máquina, tecla a tecla. A Enigma é recíproca: com a mesma configuração, cifrar e decifrar são a mesma operação. */
export function enigmaRun(config: EnigmaConfig, text: string): EnigmaResult {
  const cfg = validateConfig(config);
  const wirings = cfg.rotors.map((n) => ROTORS[n].wiring);
  const invs = wirings.map(inverse);
  const refl = [...REFLECTORS[cfg.reflector]].map(code);
  const plug = plugMap(cfg.plugs);
  const rings = [...cfg.rings].map(code);
  let pos = [...cfg.positions].map(code);
  const trace: KeyTrace[] = [];
  let out = '';

  const fwd = (k: number, c: number) => {
    const s = pos[k] - rings[k];
    return mod(code(wirings[k][mod(c + s)]) - s);
  };
  const back = (k: number, c: number) => {
    const s = pos[k] - rings[k];
    return mod(invs[k][mod(c + s)] - s);
  };

  [...normalizeText(text)].forEach((ch, i) => {
    const before = letters(pos);
    const st = stepRotors(pos, cfg.rotors);
    pos = st.pos;
    const c0 = code(ch);
    const c1 = plug[c0];
    const c2 = fwd(2, c1);
    const c3 = fwd(1, c2);
    const c4 = fwd(0, c3);
    const c5 = refl[c4];
    const c6 = back(0, c5);
    const c7 = back(1, c6);
    const c8 = back(2, c7);
    const c9 = plug[c8];
    const path = [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9].map((v) => ALPHABET[v]);
    out += path[9];
    trace.push({ index: i, input: ch, output: path[9], before, after: letters(pos), stepped: st.stepped, path });
  });
  return { output: out, trace, finalPositions: letters(pos) };
}

export const enigmaEncrypt = (config: EnigmaConfig, text: string): string => enigmaRun(config, text).output;

// ---------------- Espaço de chaves ----------------
const factorial = (n: number): bigint => Array.from({ length: n }, (_, i) => BigInt(i + 1)).reduce((a, b) => a * b, 1n);

/** Número de painéis de plugues distintos com exatamente k pares: 26! / ((26 - 2k)! · k! · 2^k). */
export function plugboardCombinations(pairs: number): bigint {
  return factorial(26) / (factorial(26 - 2 * pairs) * factorial(pairs) * 2n ** BigInt(pairs));
}

export interface KeySpace {
  rotorOrders: bigint;
  positions: bigint;
  rings: bigint;
  plugboard: bigint;
  /** Rotores x posições x plugues (sem contar os anéis, como em geral se cita). */
  withoutRings: bigint;
  withRings: bigint;
}

export function keySpace(plugPairs = 10): KeySpace {
  const rotorOrders = 60n; // 5 · 4 · 3
  const positions = 26n ** 3n;
  // O anel do rotor esquerdo é redundante (ele não aciona nenhum outro rotor): contam-se 26 x 26 anéis.
  const rings = 26n ** 2n;
  const plugboard = plugboardCombinations(plugPairs);
  const withoutRings = rotorOrders * positions * plugboard;
  return { rotorOrders, positions, rings, plugboard, withoutRings, withRings: withoutRings * rings };
}

// ---------------- Texto provável (crib) e a fraqueza do refletor ----------------
export interface CribOffset {
  /** Posição inicial (a partir de 0) do texto provável na cifra. */
  offset: number;
  possible: boolean;
  /** Índice, dentro do texto provável, da primeira letra que coincide com a cifra (impossível na Enigma). */
  conflictAt: number | null;
  conflictLetter: string | null;
}

/**
 * A Enigma nunca cifra uma letra em si mesma (consequência do refletor). Logo, qualquer alinhamento do texto
 * provável em que uma letra coincide com a letra cifrada na mesma posição é impossível.
 */
export function cribOffsets(ciphertext: string, crib: string): CribOffset[] {
  const c = normalizeText(ciphertext);
  const p = normalizeText(crib);
  if (p.length === 0 || p.length > c.length) return [];
  return Array.from({ length: c.length - p.length + 1 }, (_, offset) => {
    const j = [...p].findIndex((ch, k) => ch === c[offset + k]);
    return { offset, possible: j < 0, conflictAt: j < 0 ? null : j, conflictLetter: j < 0 ? null : p[j] };
  });
}
