// CIFRAS DE TRANSPOSIÇÃO (cerca de trilhos e transposição colunar) e CIFRA PRODUTO (substituição seguida de
// transposição). A transposição só reordena as letras: a frequência de cada letra não muda. Cifras de ensino.
import { CryptoInputError } from './bigmath';
import { ALPHABET, normalizeText } from './classical';
import { LOG_BIGRAM, substitutionDecrypt, substitutionEncrypt } from './substitution';

const code = (ch: string) => ch.charCodeAt(0) - 65;

// ---------------- Cerca de trilhos (rail fence) ----------------
export const MAX_RAILS = 12;

/** Trilho (a partir de 0) de cada posição do texto no zigue-zague. */
export function railPattern(length: number, rails: number): number[] {
  if (rails === 1) return new Array<number>(length).fill(0);
  const period = 2 * (rails - 1);
  return Array.from({ length }, (_, i) => {
    const r = i % period;
    return r < rails ? r : period - r;
  });
}

export function validateRails(rails: number, length: number): void {
  if (!Number.isInteger(rails) || rails < 2) throw new CryptoInputError('A cerca de trilhos precisa de pelo menos 2 trilhos.');
  if (rails > MAX_RAILS) throw new CryptoInputError(`O limite didático é de ${MAX_RAILS} trilhos.`);
  if (length > 0 && rails > length) throw new CryptoInputError(`Há mais trilhos (${rails}) do que letras na mensagem (${length}).`);
}

export function railEncrypt(text: string, rails: number): string {
  const t = normalizeText(text);
  validateRails(rails, t.length);
  const pat = railPattern(t.length, rails);
  let out = '';
  for (let r = 0; r < rails; r++) for (let i = 0; i < t.length; i++) if (pat[i] === r) out += t[i];
  return out;
}

export function railDecrypt(cipher: string, rails: number): string {
  const c = normalizeText(cipher);
  validateRails(rails, c.length);
  const pat = railPattern(c.length, rails);
  const out = new Array<string>(c.length);
  let k = 0;
  for (let r = 0; r < rails; r++) for (let i = 0; i < c.length; i++) if (pat[i] === r) out[i] = c[k++];
  return out.join('');
}

// ---------------- Transposição colunar com palavra-chave ----------------
export const MAX_COLUMNS = 12;

/** Ordem de leitura das colunas: índices das colunas ordenados pela letra da chave (empates: da esquerda para a direita). */
export function keyOrder(keyword: string): number[] {
  const k = normalizeText(keyword);
  if (k.length < 2) throw new CryptoInputError('A palavra-chave da transposição deve ter pelo menos 2 letras (A a Z).');
  if (k.length > MAX_COLUMNS) throw new CryptoInputError(`A palavra-chave deve ter no máximo ${MAX_COLUMNS} letras.`);
  return [...k].map((ch, i) => ({ ch, i })).sort((a, b) => a.ch.localeCompare(b.ch) || a.i - b.i).map((x) => x.i);
}

/** Tamanho (em letras) de cada coluna da grade de `n` letras com `c` colunas, sem preenchimento. */
export function columnLengths(n: number, c: number): number[] {
  const rows = Math.floor(n / c);
  const rem = n % c;
  return Array.from({ length: c }, (_, j) => rows + (j < rem ? 1 : 0));
}

/** Grade de escrita: linhas de `c` letras (a última pode ser incompleta). */
export function toGrid(text: string, c: number): string[][] {
  const t = normalizeText(text);
  return Array.from({ length: Math.ceil(t.length / c) }, (_, r) => [...t.slice(r * c, r * c + c)]);
}

/** Cifra: escreve em linhas sob a chave e lê as colunas na ordem alfabética das letras da chave. */
export function columnarEncrypt(text: string, keyword: string): string {
  const order = keyOrder(keyword);
  const grid = toGrid(text, order.length);
  return order.map((j) => grid.map((row) => row[j] ?? '').join('')).join('');
}

/** Decifra com uma ordem de leitura de colunas conhecida (índices das colunas na ordem em que foram lidas). */
export function columnarDecryptOrder(cipher: string, order: number[]): string {
  const c = normalizeText(cipher);
  const cols = order.length;
  const lens = columnLengths(c.length, cols);
  const columns = new Array<string>(cols);
  let pos = 0;
  for (const j of order) {
    columns[j] = c.slice(pos, pos + lens[j]);
    pos += lens[j];
  }
  const rows = Math.ceil(c.length / cols);
  let out = '';
  for (let r = 0; r < rows; r++) for (let j = 0; j < cols; j++) if (r < lens[j]) out += columns[j][r];
  return out;
}

export const columnarDecrypt = (cipher: string, keyword: string): string => columnarDecryptOrder(cipher, keyOrder(keyword));

/** Dupla transposição: duas transposições colunares em sequência (usada na prática até a Segunda Guerra). */
export const doubleEncrypt = (text: string, key1: string, key2: string): string => columnarEncrypt(columnarEncrypt(text, key1), key2);
export const doubleDecrypt = (cipher: string, key1: string, key2: string): string => columnarDecrypt(columnarDecrypt(cipher, key2), key1);

// ---------------- Legibilidade e criptoanálise por anagramação ----------------
/** Média do log da probabilidade dos pares de letras: maior = mais parecido com português. */
export function readability(text: string): number {
  const t = normalizeText(text);
  if (t.length < 2) return -Infinity;
  let s = 0;
  for (let i = 1; i < t.length; i++) s += LOG_BIGRAM[code(t[i - 1])][code(t[i])];
  return s / (t.length - 1);
}

export interface RailCandidate {
  rails: number;
  plaintext: string;
  score: number;
}

/** Força bruta sobre o número de trilhos: o texto mais legível é o provável. */
export function crackRail(cipher: string): RailCandidate[] {
  const c = normalizeText(cipher);
  const out: RailCandidate[] = [];
  for (let rails = 2; rails <= Math.min(MAX_RAILS, c.length); rails++) {
    const plaintext = railDecrypt(c, rails);
    out.push({ rails, plaintext, score: readability(plaintext) });
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface ColumnarCandidate {
  columns: number;
  order: number[];
  plaintext: string;
  score: number;
}

export const MAX_ATTACK_COLUMNS = 8;

/** Percorre todas as permutações de 0..n-1 (algoritmo de Heap), chamando `visit` com o vetor corrente (não o copie). */
function forEachPermutation(n: number, visit: (p: number[]) => void): void {
  const a = Array.from({ length: n }, (_, i) => i);
  const c = new Array<number>(n).fill(0);
  visit(a);
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const k = i % 2 === 0 ? 0 : c[i];
      [a[k], a[i]] = [a[i], a[k]];
      visit(a);
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

/**
 * Anagramação: para cada número de colunas de 2 a `maxColumns`, testa todas as ordens de leitura das colunas e guarda
 * a de texto mais legível. Retorna o melhor candidato de cada número de colunas, ordenados do mais para o menos legível.
 * (A pontuação é calculada diretamente sobre os códigos das letras, sem montar textos intermediários.)
 */
export function crackColumnar(cipher: string, maxColumns = MAX_ATTACK_COLUMNS): ColumnarCandidate[] {
  const c = normalizeText(cipher);
  const n = c.length;
  const codes = Uint8Array.from([...c].map(code));
  const out: ColumnarCandidate[] = [];
  for (let cols = 2; cols <= Math.min(maxColumns, n); cols++) {
    const lens = columnLengths(n, cols);
    const rows = Math.ceil(n / cols);
    const start = new Array<number>(cols).fill(0);
    let bestScore = -Infinity;
    let bestOrder: number[] = [];
    forEachPermutation(cols, (order) => {
      let pos = 0;
      for (let k = 0; k < cols; k++) {
        const j = order[k];
        start[j] = pos;
        pos += lens[j];
      }
      let total = 0;
      let prev = -1;
      for (let r = 0; r < rows; r++) {
        for (let j = 0; j < cols; j++) {
          if (r < lens[j]) {
            const ch = codes[start[j] + r];
            if (prev >= 0) total += LOG_BIGRAM[prev][ch];
            prev = ch;
          }
        }
      }
      if (total > bestScore) {
        bestScore = total;
        bestOrder = [...order];
      }
    });
    out.push({ columns: cols, order: bestOrder, plaintext: columnarDecryptOrder(c, bestOrder), score: bestScore / Math.max(1, n - 1) });
  }
  return out.sort((x, y) => y.score - x.score);
}

/** Percentual de letras iguais entre dois textos de mesmo tamanho. */
export function percentSame(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let ok = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) ok++;
  return (100 * ok) / n;
}

/**
 * Como `percentSame`, mas tolera um deslocamento de até 3 letras (escolhe o melhor alinhamento). Com a última linha
 * incompleta, o texto mais legível pode ser o original deslocado de uma letra, o que ainda é uma quebra da cifra.
 */
export function percentAligned(a: string, b: string, maxShift = 3): number {
  let best = 0;
  for (let s = -maxShift; s <= maxShift; s++) {
    let ok = 0;
    let n = 0;
    for (let i = 0; i < b.length; i++) {
      const j = i + s;
      if (j < 0 || j >= a.length) continue;
      n++;
      if (a[j] === b[i]) ok++;
    }
    if (n > 0) best = Math.max(best, (100 * ok) / Math.max(n, b.length - maxShift));
  }
  return best;
}

export { ALPHABET };

// ---------------- Cifra produto: substituição seguida de transposição ----------------

/** Cifra produto: primeiro a substituição simples (confusão), depois a transposição colunar (difusão). */
export function productEncrypt(text: string, substitutionKey: string, keyword: string): string {
  return columnarEncrypt(substitutionEncrypt(substitutionKey, text), keyword);
}

export function productDecrypt(cipher: string, substitutionKey: string, keyword: string): string {
  return substitutionDecrypt(substitutionKey, columnarDecrypt(cipher, keyword));
}

/** Coeficiente de correlação de Pearson entre dois vetores de mesmo tamanho. */
export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}
