// CIFRA DE PLAYFAIR (1854): digrafos sobre uma grade 5 x 5 formada por uma palavra-chave. Cifra de ensino:
// NÃO oferece segurança. A grade tem 25 letras (J e I são tratadas como a mesma letra: J vira I).
import { CryptoInputError } from './bigmath';
import { ALPHABET, normalizeText } from './classical';

export const FILLER = 'X';
export const GRID_ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // sem J

/** Grade 5 x 5: letras da chave (sem repetir, J = I) seguidas das demais letras do alfabeto. */
export function buildGrid(keyword: string): string {
  const key = normalizeText(keyword).replace(/J/g, 'I');
  const seen = new Set<string>();
  for (const ch of key + GRID_ALPHABET) seen.add(ch);
  return [...seen].join('');
}

export function validateGrid(grid: string): string {
  const g = normalizeText(grid).replace(/J/g, 'I');
  if (g.length !== 25 || new Set(g).size !== 25) throw new CryptoInputError('A grade deve conter 25 letras distintas (J é tratada como I).');
  return g;
}

export const positionOf = (grid: string, ch: string): { row: number; col: number } => {
  const i = grid.indexOf(ch);
  return { row: Math.floor(i / 5), col: i % 5 };
};

/**
 * Prepara a mensagem: J vira I; entre duas letras iguais de um mesmo digrafo insere-se X; se sobrar uma
 * letra no fim, completa-se com X. Retorna os digrafos.
 */
export function toDigraphs(text: string): string[] {
  const t = normalizeText(text).replace(/J/g, 'I');
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    const a = t[i];
    const b = t[i + 1];
    if (b === undefined) {
      out.push(a + (a === FILLER ? 'Z' : FILLER));
      i += 1;
    } else if (a === b) {
      out.push(a + (a === FILLER ? 'Z' : FILLER));
      i += 1;
    } else {
      out.push(a + b);
      i += 2;
    }
  }
  return out;
}

export type PlayfairRule = 'linha' | 'coluna' | 'retângulo';

export interface DigraphStep {
  input: string;
  output: string;
  rule: PlayfairRule;
  /** Posições (linha, coluna) das duas letras de entrada. */
  from: [{ row: number; col: number }, { row: number; col: number }];
}

/** Regra do Playfair para um digrafo; `dir` = 1 cifra (desloca para a direita/abaixo) e -1 decifra. */
export function transformDigraph(grid: string, pair: string, dir: 1 | -1): DigraphStep {
  const [a, b] = [pair[0], pair[1]];
  const pa = positionOf(grid, a);
  const pb = positionOf(grid, b);
  const at = (r: number, c: number) => grid[((r + 5) % 5) * 5 + ((c + 5) % 5)];
  let out: string;
  let rule: PlayfairRule;
  if (pa.row === pb.row) {
    rule = 'linha';
    out = at(pa.row, pa.col + dir) + at(pb.row, pb.col + dir);
  } else if (pa.col === pb.col) {
    rule = 'coluna';
    out = at(pa.row + dir, pa.col) + at(pb.row + dir, pb.col);
  } else {
    rule = 'retângulo';
    out = at(pa.row, pb.col) + at(pb.row, pa.col);
  }
  return { input: pair, output: out, rule, from: [pa, pb] };
}

export function playfairEncryptSteps(grid: string, plaintext: string): DigraphStep[] {
  const g = validateGrid(grid);
  return toDigraphs(plaintext).map((d) => transformDigraph(g, d, 1));
}

export function playfairEncrypt(grid: string, plaintext: string): string {
  return playfairEncryptSteps(grid, plaintext).map((s) => s.output).join('');
}

/** Decifra uma cifra de comprimento par; os X inseridos na preparação permanecem no texto claro. */
export function playfairDecrypt(grid: string, ciphertext: string): string {
  const g = validateGrid(grid);
  const c = normalizeText(ciphertext).replace(/J/g, 'I');
  if (c.length % 2 !== 0) throw new CryptoInputError('A cifra do Playfair tem sempre um número par de letras.');
  const out: string[] = [];
  for (let i = 0; i < c.length; i += 2) out.push(transformDigraph(g, c.slice(i, i + 2), -1).output);
  return out.join('');
}

export { ALPHABET };
