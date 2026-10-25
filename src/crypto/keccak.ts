// Keccak-f[1600] e as funções da família SHA-3 (FIPS 202), escritas para estudo.
// Implementação direta e lenta (lanes de 64 bits em BigInt); serve ao ML-KEM didático, não a grandes volumes.

const MASK = (1n << 64n) - 1n;
const rotl = (x: bigint, n: bigint) => (n === 0n ? x : ((x << n) | (x >> (64n - n))) & MASK);

// Constantes de rodada (iota), geradas pelo registrador LFSR de x^8 + x^6 + x^5 + x^4 + 1.
const RC: bigint[] = (() => {
  const out: bigint[] = [];
  let lfsr = 1;
  const nextBit = () => {
    const bit = lfsr & 1;
    lfsr = lfsr & 0x80 ? ((lfsr << 1) ^ 0x71) & 0xff : (lfsr << 1) & 0xff;
    return bit;
  };
  for (let r = 0; r < 24; r++) {
    let c = 0n;
    for (let j = 0; j < 7; j++) if (nextBit()) c |= 1n << BigInt((1 << j) - 1);
    out.push(c);
  }
  return out;
})();

// Deslocamentos de rotação (rho) por lane (x, y), na ordem de caminhada do passo pi.
const ROT: number[][] = (() => {
  const r = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
  let x = 1;
  let y = 0;
  for (let t = 0; t < 24; t++) {
    r[x][y] = (((t + 1) * (t + 2)) / 2) % 64;
    [x, y] = [y, (2 * x + 3 * y) % 5];
  }
  return r;
})();

/** Permutação Keccak-f[1600] sobre 25 lanes (índice x + 5y). Altera o vetor recebido. */
export function keccakF(a: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    // theta: mistura cada coluna com as colunas vizinhas
    const c = [0, 1, 2, 3, 4].map((x) => a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20]);
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1n);
      for (let y = 0; y < 5; y++) a[x + 5 * y] ^= d;
    }
    // rho e pi: rotaciona cada lane e a move para outra posição
    const b = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(a[x + 5 * y], BigInt(ROT[x][y]));
    // chi: única etapa não linear
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) a[x + 5 * y] = b[x + 5 * y] ^ (~b[(x + 1) % 5 + 5 * y] & MASK & b[(x + 2) % 5 + 5 * y]);
    // iota: quebra a simetria entre as rodadas
    a[0] ^= RC[round];
  }
}

/** Esponja de Keccak: absorve bytes e depois "espreme" quantos bytes forem necessários. */
export class Sponge {
  private readonly state: bigint[] = new Array<bigint>(25).fill(0n);
  private buf = new Uint8Array(0);
  private squeezing = false;
  private offset = 0;

  /** rate em bytes (200 menos a capacidade); suffix é o sufixo de domínio (0x06 para SHA-3, 0x1f para SHAKE). */
  constructor(
    private readonly rate: number,
    private readonly suffix: number,
  ) {}

  private xorBlock(block: Uint8Array) {
    for (let i = 0; i < this.rate; i++) this.state[i >> 3] ^= BigInt(block[i]) << BigInt(8 * (i & 7));
    keccakF(this.state);
  }

  absorb(data: Uint8Array): this {
    if (this.squeezing) throw new Error('Esponja já finalizada.');
    const all = new Uint8Array(this.buf.length + data.length);
    all.set(this.buf);
    all.set(data, this.buf.length);
    let i = 0;
    for (; i + this.rate <= all.length; i += this.rate) this.xorBlock(all.subarray(i, i + this.rate));
    this.buf = all.slice(i);
    return this;
  }

  private pad() {
    const block = new Uint8Array(this.rate);
    block.set(this.buf);
    block[this.buf.length] ^= this.suffix;
    block[this.rate - 1] ^= 0x80;
    this.xorBlock(block);
    this.squeezing = true;
    this.offset = 0;
  }

  squeeze(n: number): Uint8Array {
    if (!this.squeezing) this.pad();
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (this.offset === this.rate) {
        keccakF(this.state);
        this.offset = 0;
      }
      out[i] = Number((this.state[this.offset >> 3] >> BigInt(8 * (this.offset & 7))) & 0xffn);
      this.offset++;
    }
    return out;
  }
}

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

export const sha3_256 = (...m: Uint8Array[]) => new Sponge(136, 0x06).absorb(concat(m)).squeeze(32);
export const sha3_512 = (...m: Uint8Array[]) => new Sponge(72, 0x06).absorb(concat(m)).squeeze(64);
export const shake128 = (m: Uint8Array) => new Sponge(168, 0x1f).absorb(m);
export const shake256 = (m: Uint8Array, outLen: number) => new Sponge(136, 0x1f).absorb(m).squeeze(outLen);
