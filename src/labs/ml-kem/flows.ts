import { toHex } from '../../crypto/encoding';
import type { MlKemEngine, LweEngine } from '../../crypto/engines';
import type { LweAttack, LweCiphertext, LweDecryption, LweKeys, LweParams } from '../../crypto/lwe';
import { Q, centered, sizes, type DecapsDetail, type EncapsDetail, type KeyGenDetail, type MlKemParams, type Poly } from '../../crypto/mlkem';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep, SimulationEvent } from '../../simulation/types';

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
/** Abrevia um valor hexadecimal longo para caber na tela. */
export const hex = (x: Uint8Array | string, n = 8) => {
  const h = typeof x === 'string' ? x : toHex(x);
  return h.length > n * 2 + 1 ? `${h.slice(0, n * 2)}…` : h;
};

type Compute = Extract<SimulationEvent, { type: 'compute' }>;
const compute = (party: string, title: string, formula: string, substituted: string, result: string, kind: ItemKind, e?: Entry): Compute => ({
  type: 'compute',
  operation: { party, title, formula, substituted, result, kind },
  ...(e ? { entry: e } : {}),
});
const step = (id: string, title: string, description: string, operation: string, events: SimulationEvent[], info?: string[]): ProtocolStep => ({ id, title, description, operation, events, ...(info ? { info } : {}) });

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Primeiros coeficientes de um polinômio, para exibição. Com signed, mostra o valor centrado (ruído). */
export const polyStr = (p: Poly, signed = false, n = 6) => `[${p.slice(0, n).map((c) => (signed ? centered(c) : c)).join(', ')}, …]`;

// ---------------------------------------------------------------------------------------------
// LWE didático
// ---------------------------------------------------------------------------------------------
export interface LweInput {
  params: LweParams;
  /** Semente do segredo, da matriz e do ruído de Alice. */
  seed: number;
  /** Semente da escolha aleatória de Bob. */
  rSeed: number;
  bit: 0 | 1;
}

export interface LweFlow {
  input: LweInput;
  keys: LweKeys;
  ct: LweCiphertext;
  dec: LweDecryption;
  gauss: LweAttack;
  brute: LweAttack;
  /** Bit que Eva leu usando um segredo encontrado (null se nenhum ataque funcionou). */
  evaBit: 0 | 1 | null;
  broken: boolean;
  verdictText: string;
}

export const LWE_MAX_N = 3;

export async function runLwe(engine: LweEngine, input: LweInput): Promise<LweFlow> {
  const { params } = input;
  if (!Number.isInteger(params.n) || params.n < 2 || params.n > LWE_MAX_N) throw new Error(`A dimensão n deve ficar entre 2 e ${LWE_MAX_N}.`);
  if (!Number.isInteger(input.seed) || input.seed < 1 || input.seed > 99999) throw new Error('A semente deve ser um inteiro de 1 a 99999.');
  const keys = await engine.keyGen(params, input.seed);
  const ct = await engine.encrypt(keys, input.bit, input.rSeed);
  const dec = await engine.decrypt(params, keys.s, ct.u, ct.v);
  const gauss = await engine.attackGauss(keys);
  const brute = await engine.attackBruteForce(keys);
  const winner = gauss.correct ? gauss : brute.correct ? brute : null;
  const evaBit = winner?.found ? (await engine.decrypt(params, winner.found, ct.u, ct.v)).bit : null;
  const broken = evaBit !== null;
  const total = params.q ** params.n;
  const noiseText = params.noise === 0 ? 'Sem ruído, o sistema b = A·s é linear e a eliminação de Gauss resolve em um instante' : `Com ruído de até ±${params.noise}, a eliminação de Gauss resolve um sistema que não é o verdadeiro (resíduo ${gauss.residual}, contra o máximo ${params.noise} esperado do ruído)`;
  return {
    input,
    keys,
    ct,
    dec,
    gauss,
    brute,
    evaBit,
    broken,
    verdictText: `${noiseText}. A busca exaustiva testou ${brute.tries} dos ${total} segredos possíveis e ${brute.correct ? 'achou s' : 'não achou s'}. ${
      broken ? `Eva leu o bit ${evaBit}: em escala didática (n = ${params.n}, q = ${params.q}) o ruído só barra a álgebra, e o espaço de segredos é pequeno demais.` : 'Eva não leu o bit.'
    } No ML-KEM-768 o segredo tem 768 coeficientes módulo 3329 (3329^768 possibilidades), e os melhores ataques conhecidos, por redução de reticulados, custam algo comparável à busca de chave do AES-192 (categoria 3 do NIST).`,
  };
}

const lweParties: PartyDef[] = [
  { id: 'alice', name: 'Alice', role: 'Participante (gera as chaves)', position: 'left', slots: [{ key: 's', label: 'Segredo s', kind: 'secret' }, { key: 'e', label: 'Ruído e', kind: 'secret' }, { key: 'b', label: 'b = A·s + e', kind: 'public' }, { key: 'bit', label: 'Bit decifrado', kind: 'plain' }] },
  { id: 'bob', name: 'Bob', role: 'Participante (cifra um bit)', position: 'right', slots: [{ key: 'pub', label: 'Chave pública (A, b)', kind: 'public' }, { key: 'r', label: 'Escolha aleatória r', kind: 'secret' }, { key: 'bit', label: 'Bit a cifrar', kind: 'plain' }, { key: 'ct', label: 'Texto cifrado (u, v)', kind: 'cipher' }] },
  { id: 'eva', name: 'Eva', role: 'Atacante (observa o canal)', position: 'center', adversary: true, slots: [{ key: 'seen', label: 'Observado no canal', kind: 'public' }, { key: 's', label: 'Segredo deduzido', kind: 'secret' }, { key: 'bit', label: 'Bit lido por Eva', kind: 'plain' }] },
];

const vec = (v: number[]) => `(${v.join(', ')})`;
const mat = (A: number[][], rows = 4) => `${A.slice(0, rows).map((r) => `[${r.join(' ')}]`).join(' ')}${A.length > rows ? ` … (${A.length} linhas)` : ''}`;

export function buildLweProtocol(f: LweFlow): ProtocolDefinition {
  const { params: p } = f.input;
  const { keys: k, ct, dec } = f;
  const half = Math.floor(p.q / 2);
  const steps: ProtocolStep[] = [
    step('params', 'Alice e Bob combinam os parâmetros', `Dimensão n = ${p.n}, ${p.m} amostras, módulo primo q = ${p.q} e ruído de ${p.noise === 0 ? 'nenhum' : `até ±${p.noise}`}. São números minúsculos, só para ver as contas.`, 'Nenhum cálculo: os parâmetros são públicos.', []),
    step('alice-secret', 'Alice sorteia o segredo s', `Um vetor de ${p.n} números módulo ${p.q}. É a chave privada.`, 'Sorteio de s.', [
      compute('alice', 'Segredo', 's ← Z_{q}^{n}', `n = ${p.n}, q = ${p.q}`, `s = ${vec(k.s)}`, 'secret', entry('s', 'Segredo s', vec(k.s), 'secret')),
    ]),
    step('alice-matrix', 'Alice sorteia a matriz pública A', `Uma matriz de ${p.m} linhas e ${p.n} colunas de números uniformes módulo ${p.q}. Qualquer um pode conhecê-la.`, 'Sorteio de A.', [
      compute('alice', 'Matriz pública', 'A ← Z_{q}^{m×n}', `m = ${p.m}, n = ${p.n}`, `A = ${mat(k.A)}`, 'public'),
    ]),
    step('alice-noise', 'Alice sorteia o ruído e', p.noise === 0 ? 'Neste cenário o ruído é zero: é a versão insegura, só para comparar.' : `Cada erro é um número pequeno, de -${p.noise} a ${p.noise}. É o ruído que esconde o segredo.`, 'Sorteio de e.', [
      compute('alice', 'Ruído', `e_{i} ∈ [-${p.noise}, ${p.noise}]`, `${p.m} erros`, `e = ${vec(k.e)}`, 'secret', entry('e', 'Ruído e', vec(k.e), 'secret')),
    ]),
    step('alice-b', 'Alice calcula b = A·s + e', 'Cada bᵢ é o produto da linha i de A por s, somado ao erro, módulo q. Sem o erro, seria um sistema linear fácil de resolver.', 'Multiplicação matriz-vetor com ruído.', [
      compute('alice', 'Chave pública', 'b = A·s + e  (mod q)', `s = ${vec(k.s)}, e = ${vec(k.e)}`, `b = ${vec(k.b)}`, 'public', entry('b', 'b = A·s + e', vec(k.b), 'public')),
    ]),
    step('send-pub', 'Alice envia (A, b) a Bob', 'A chave pública é o par (A, b). Eva a vê, mas s e e ficam com Alice.', 'Envio da chave pública.', [
      { type: 'send', message: { from: 'alice', to: 'bob', label: '(A, b)', summary: `A = ${mat(k.A, 2)}; b = ${vec(k.b)}`, kind: 'public', observers: ['eva'] }, deliver: [entry('pub', 'Chave pública (A, b)', `b = ${vec(k.b)}`, 'public')], observerEntries: [entry('seen', 'Observado no canal', `(A, b) com b = ${vec(k.b)}`, 'public')] },
    ]),
    step('bob-r', 'Bob escolhe um subconjunto r das linhas', `Para cifrar o bit ${f.input.bit}, Bob sorteia ${p.m} valores 0 ou 1, que dizem quais linhas ele soma.`, 'Sorteio de r.', [
      compute('bob', 'Escolha aleatória', `r ∈ {0, 1}^{m}`, `m = ${p.m}`, `r = ${vec(ct.r)}`, 'secret', entry('r', 'Escolha aleatória r', vec(ct.r), 'secret')),
      { type: 'set', party: 'bob', entry: entry('bit', 'Bit a cifrar', String(f.input.bit), 'plain') },
    ]),
    step('bob-u', 'Bob calcula u = Aᵀ·r', 'Soma as linhas de A escolhidas por r. O resultado tem n números.', 'Soma das linhas escolhidas de A.', [
      compute('bob', 'Primeira parte', 'u = Aᵀ·r  (mod q)', `r = ${vec(ct.r)}`, `u = ${vec(ct.u)}`, 'cipher'),
    ]),
    step('bob-v', 'Bob calcula v = b·r + bit·⌊q/2⌋', `Soma os b escolhidos e esconde o bit na metade do módulo (⌊q/2⌋ = ${half}): o bit 0 soma 0 e o bit 1 soma ${half}.`, 'Soma dos b escolhidos mais o bit na metade do módulo.', [
      compute('bob', 'Segunda parte', 'v = b·r + bit·⌊q/2⌋  (mod q)', `bit = ${f.input.bit}, ⌊q/2⌋ = ${half}`, `v = ${ct.v}`, 'cipher', entry('ct', 'Texto cifrado (u, v)', `u = ${vec(ct.u)}, v = ${ct.v}`, 'cipher')),
    ]),
    step('send-ct', 'Bob envia (u, v) a Alice', 'Eva vê o texto cifrado, mas sem s não sabe separar o bit do ruído.', 'Envio do texto cifrado.', [
      { type: 'send', message: { from: 'bob', to: 'alice', label: '(u, v)', summary: `u = ${vec(ct.u)}, v = ${ct.v}`, kind: 'cipher', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `(A, b) e (u, v) = (${vec(ct.u)}, ${ct.v})`, 'cipher')] },
    ]),
    step('alice-dec', 'Alice decifra com o segredo s', `Calcula v − s·u = (ruído acumulado) + bit·⌊q/2⌋. Perto de 0 é o bit 0; perto de ${half} é o bit 1. O ruído acumulado (no máximo ${p.m * p.noise}) é menor que q/4 = ${p.q / 4}, e a decisão acerta.`, 'Subtração e arredondamento.', [
      compute('alice', 'Decifragem', 'd = v − s·u  (mod q);  bit = 1 se |d| > q/4', `v = ${ct.v}, s·u calculado`, `d = ${dec.d}, bit = ${dec.bit} (folga ${dec.margin})`, 'plain', entry('bit', 'Bit decifrado', String(dec.bit), 'plain')),
    ]),
    step('eva-gauss', 'Eva tenta resolver o sistema por eliminação de Gauss', p.noise === 0 ? 'Sem ruído, A·s = b é um sistema linear comum.' : 'Com ruído, o sistema é inconsistente: as equações discordam por pequenos erros, e a solução exata não é a verdadeira.', 'Eliminação de Gauss módulo q.', [
      compute('eva', 'Ataque algébrico', 'resolver A·s = b  (mod q)', `${p.m} equações, ${p.n} incógnitas`, f.gauss.correct ? `s = ${vec(f.gauss.found!)} (correto)` : `s′ = ${f.gauss.found ? vec(f.gauss.found) : 'sem solução'} (errado; resíduo ${f.gauss.residual})`, 'secret', f.gauss.correct ? entry('s', 'Segredo deduzido', vec(f.gauss.found!), 'secret') : undefined),
    ]),
    step('eva-brute', 'Eva testa todos os segredos possíveis', `Há ${p.q}^${p.n} = ${p.q ** p.n} segredos. Para cada um, Eva confere se b − A·s tem só valores pequenos (até ±${p.noise}).`, 'Busca exaustiva de s.', [
      compute('eva', 'Ataque exaustivo', 'achar s com |b − A·s| ≤ B', `${p.q ** p.n} candidatos`, f.brute.correct ? `s = ${vec(f.brute.found!)} após ${f.brute.tries} testes` : `não achou (${f.brute.tries} testes)`, 'secret', f.brute.correct ? entry('s', 'Segredo deduzido', vec(f.brute.found!), 'secret') : undefined),
    ]),
  ];
  if (f.evaBit !== null) {
    steps.push(
      step('eva-read', 'Eva decifra o bit', 'Com o segredo deduzido, Eva repete a conta de Alice sobre o texto cifrado que viu no canal.', 'Subtração e arredondamento com o s deduzido.', [
        compute('eva', 'Decifragem por Eva', 'd = v − s·u  (mod q)', `s deduzido, u = ${vec(ct.u)}, v = ${ct.v}`, `bit = ${f.evaBit}`, 'plain', entry('bit', 'Bit lido por Eva', String(f.evaBit), 'plain')),
      ]),
    );
  }
  steps.push(step('result', f.broken ? 'Em escala didática, Eva quebra o esquema' : 'Eva não leu o bit', f.verdictText, 'Avaliação do resultado.', [{ type: 'verdict', verdict: { ok: !f.broken, text: f.verdictText } }]));
  return { id: 'lwe', title: 'LWE em escala didática: Alice, Bob e Eva', parties: lweParties, steps };
}

// ---------------------------------------------------------------------------------------------
// ML-KEM
// ---------------------------------------------------------------------------------------------
export interface MlKemInput {
  params: MlKemParams;
  d: Uint8Array;
  z: Uint8Array;
  m: Uint8Array;
  /** Eva inverte um bit do texto cifrado em trânsito. */
  tamper: boolean;
}

export interface MlKemFlow {
  input: MlKemInput;
  kg: KeyGenDetail;
  enc: EncapsDetail;
  /** Texto cifrado que Alice recebe (adulterado, se for o caso). */
  received: Uint8Array;
  /** Posição do bit invertido por Eva. */
  flipped: { byte: number; bit: number } | null;
  dec: DecapsDetail;
  keysMatch: boolean;
  /** Maior ruído acumulado na decifragem sem adulteração (null com adulteração). */
  maxNoise: number | null;
  /** Limiar de q/4 a partir do qual a decifragem erraria. */
  noiseLimit: number;
  verdictText: string;
}

const check32 = (b: Uint8Array, nome: string) => {
  if (b.length !== 32) throw new Error(`${nome} deve ter 32 bytes.`);
};

export async function runMlKem(engine: MlKemEngine, input: MlKemInput): Promise<MlKemFlow> {
  check32(input.d, 'A semente d');
  check32(input.z, 'A semente z');
  check32(input.m, 'A mensagem m');
  const p = input.params;
  const kg = await engine.keyGen(p, input.d, input.z);
  const enc = await engine.encaps(p, kg.ek, input.m);
  let received = enc.c;
  let flipped: MlKemFlow['flipped'] = null;
  if (input.tamper) {
    flipped = { byte: 5, bit: 0 };
    received = enc.c.slice();
    received[flipped.byte] ^= 1 << flipped.bit;
  }
  const dec = await engine.decaps(p, kg.dk, received);
  const keysMatch = sameBytes(enc.K, dec.K);
  const maxNoise = input.tamper ? null : Math.max(...dec.decrypt.w.map((w, i) => Math.abs(centered((((w - enc.mu[i]) % Q) + Q) % Q))));
  const noiseLimit = Math.floor(Q / 4);
  const verdictText = input.tamper
    ? `Eva inverteu o bit ${flipped!.bit} do byte ${flipped!.byte} do texto cifrado. Alice decifrou, refez a cifragem e viu que o resultado não bate com o que recebeu. Em vez de acusar erro, devolveu a chave de rejeição K̄ = J(z ‖ c) = ${hex(dec.KBar)}, diferente da chave de Bob (${hex(enc.K)}). Alice e Bob não compartilham chave, e Eva não aprendeu nada sobre s: a falha só aparece depois, quando o que Bob cifrar com K não abrir em Alice (por exemplo, a etiqueta do AES-GCM). Isso evita que Eva use as respostas de Alice como oráculo para descobrir o segredo.`
    : `Alice e Bob chegaram à mesma chave de 32 bytes (${hex(enc.K)}). Eva viu a chave de encapsulamento (${sizes(p).ek} bytes) e o texto cifrado (${sizes(p).ciphertext} bytes), mas para chegar à chave precisaria do segredo s, escondido pelo ruído no problema Module-LWE. O ruído acumulado na decifragem chegou a no máximo ${maxNoise}, bem abaixo do limite q/4 = ${noiseLimit}, por isso a decifragem não falha.`;
  return { input, kg, enc, received, flipped, dec, keysMatch, maxNoise, noiseLimit, verdictText };
}

const mlkemParties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Participante (gera o par de chaves)',
    position: 'left',
    slots: [
      { key: 'seeds', label: 'Sementes d e z', kind: 'secret' },
      { key: 'rho', label: 'Semente pública ρ', kind: 'public' },
      { key: 's', label: 'Segredo s', kind: 'secret' },
      { key: 'e', label: 'Ruído e', kind: 'secret' },
      { key: 'ek', label: 'Chave de encapsulamento ek', kind: 'public' },
      { key: 'dk', label: 'Chave de desencapsulamento dk', kind: 'secret' },
      { key: 'c', label: 'Texto cifrado recebido', kind: 'cipher' },
      { key: 'm', label: 'Mensagem recuperada m′', kind: 'secret' },
      { key: 'K', label: 'Chave K de Alice', kind: 'secret' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Participante (encapsula a chave)',
    position: 'right',
    slots: [
      { key: 'ek', label: 'ek recebida', kind: 'public' },
      { key: 'm', label: 'Mensagem aleatória m', kind: 'secret' },
      { key: 'K', label: 'Chave K de Bob', kind: 'secret' },
      { key: 'c', label: 'Texto cifrado c', kind: 'cipher' },
    ],
  },
  { id: 'eva', name: 'Eva', role: 'Atacante (observa o canal)', position: 'center', adversary: true, slots: [{ key: 'seen', label: 'Observado no canal', kind: 'public' }, { key: 'c2', label: 'Texto cifrado alterado', kind: 'cipher' }, { key: 'K', label: 'Chave K deduzida', kind: 'secret' }] },
];

export function buildMlKemProtocol(f: MlKemFlow): ProtocolDefinition {
  const { params: p } = f.input;
  const { kg, enc, dec } = f;
  const sz = sizes(p);
  const steps: ProtocolStep[] = [
    step('params', `Alice e Bob escolhem o ${p.name}`, `Parâmetros públicos: polinômios de 256 coeficientes módulo q = ${Q}, k = ${p.k} (vetores de ${p.k} polinômios), ruído binomial centrado de parâmetros η₁ = ${p.eta1} e η₂ = ${p.eta2}, compressão d_u = ${p.du} e d_v = ${p.dv}.`, 'Nenhum cálculo: os parâmetros são públicos.', []),
    step('alice-seeds', 'Alice sorteia as sementes d e z', 'Duas sementes de 32 bytes. A semente d gera o par de chaves; a semente z servirá à rejeição implícita, depois.', 'Sorteio de 2 × 32 bytes.', [
      compute('alice', 'Sementes', 'd, z ← 32 bytes aleatórios', '2 × 32 bytes', `d = ${hex(kg.d, 6)}, z = ${hex(kg.z, 6)}`, 'secret', entry('seeds', 'Sementes d e z', `d = ${hex(kg.d, 6)}`, 'secret')),
    ]),
    step('alice-g', 'Alice separa ρ e σ com SHA3-512', 'A função G (SHA3-512) transforma d em 64 bytes: os 32 primeiros são ρ (pública, gera a matriz A) e os 32 últimos são σ (secreta, gera o ruído).', 'Cálculo de SHA3-512(d ‖ k).', [
      compute('alice', 'Separação das sementes', '(ρ, σ) = G(d ‖ k)', `d = ${hex(kg.d, 6)}, k = ${p.k}`, `ρ = ${hex(kg.rho, 6)}, σ = ${hex(kg.sigma, 6)}`, 'public', entry('rho', 'Semente pública ρ', hex(kg.rho, 8), 'public')),
    ]),
    step('alice-matrix', 'Alice expande a matriz pública Â', `Cada um dos ${p.k * p.k} polinômios de Â sai de SHAKE128(ρ ‖ j ‖ i) com amostragem por rejeição (coeficientes de 12 bits menores que q). Bob refará o mesmo cálculo a partir de ρ, que vai dentro da chave pública.`, `Expansão de ${p.k * p.k} polinômios com SHAKE128.`, [
      compute('alice', 'Matriz pública', 'Â[i][j] = SampleNTT(ρ ‖ j ‖ i)', `k = ${p.k}`, `matriz ${p.k}×${p.k} de polinômios; Â[0][0] = ${polyStr(kg.A[0][0])}`, 'public'),
    ]),
    step('alice-s', 'Alice sorteia o segredo s', `Cada coeficiente de s é a diferença de dois somatórios de ${p.eta1} bits, ou seja, fica em [−${p.eta1}, ${p.eta1}]. O vetor tem ${p.k} polinômios.`, 'Amostragem binomial centrada de s.', [
      compute('alice', 'Segredo', 's ← CBD_{η1}(PRF(σ, i))', `σ = ${hex(kg.sigma, 6)}`, `s[0] = ${polyStr(kg.s[0], true)}`, 'secret', entry('s', 'Segredo s', `${p.k} polinômios, s[0] = ${polyStr(kg.s[0], true, 4)}`, 'secret')),
    ]),
    step('alice-e', 'Alice sorteia o ruído e', 'O ruído tem a mesma forma do segredo: coeficientes pequenos. É ele que impede resolver o sistema por álgebra linear.', 'Amostragem binomial centrada de e.', [
      compute('alice', 'Ruído', 'e ← CBD_{η1}(PRF(σ, k + i))', `σ = ${hex(kg.sigma, 6)}`, `e[0] = ${polyStr(kg.e[0], true)}`, 'secret', entry('e', 'Ruído e', `${p.k} polinômios, e[0] = ${polyStr(kg.e[0], true, 4)}`, 'secret')),
    ]),
    step('alice-t', 'Alice calcula t̂ = Â∘ŝ + ê', 'No domínio da NTT (transformada teórica dos números), multiplicar polinômios custa 256 multiplicações de coeficientes, em vez de 65 536. Alice leva s e e para esse domínio, multiplica pela matriz e soma o ruído.', 'Multiplicação matriz-vetor no domínio da NTT mais o ruído.', [
      compute('alice', 'Parte pública', 't̂ = Â∘ŝ + ê', `ŝ = NTT(s), ê = NTT(e)`, `t̂[0] = ${polyStr(kg.tHat[0])}`, 'public'),
    ]),
    step('alice-pack', 'Alice empacota ek e dk', `ek = t̂ (12 bits por coeficiente) ‖ ρ, com ${sz.ek} bytes. dk = ŝ ‖ ek ‖ H(ek) ‖ z, com ${sz.dk} bytes, e fica só com Alice.`, 'Codificação em bytes.', [
      compute('alice', 'Chaves', 'ek = t̂ ‖ ρ;  dk = ŝ ‖ ek ‖ H(ek) ‖ z', `k = ${p.k}`, `ek = ${sz.ek} bytes, dk = ${sz.dk} bytes`, 'public', entry('ek', 'Chave de encapsulamento ek', `${sz.ek} bytes: ${hex(kg.ek, 6)}`, 'public')),
      { type: 'set', party: 'alice', entry: entry('dk', 'Chave de desencapsulamento dk', `${sz.dk} bytes (secreta)`, 'secret') },
    ]),
    step('send-ek', 'Alice envia ek a Bob', `A chave de encapsulamento (${sz.ek} bytes, bem maior que os 32 do X25519) atravessa o canal; Eva a vê.`, 'Envio da chave pública ek.', [
      { type: 'send', message: { from: 'alice', to: 'bob', label: 'ek', summary: `${sz.ek} bytes: ${hex(kg.ek, 8)}`, kind: 'public', observers: ['eva'] }, deliver: [entry('ek', 'ek recebida', `${sz.ek} bytes: ${hex(kg.ek, 6)}`, 'public')], observerEntries: [entry('seen', 'Observado no canal', `ek (${sz.ek} bytes)`, 'public')] },
    ]),
    step('bob-check', 'Bob verifica a chave recebida', 'Antes de usar ek, Bob confere o tamanho e se cada coeficiente decodificado é menor que q (decodificar e recodificar deve devolver os mesmos bytes).', 'Verificação de módulo da FIPS 203.', [
      compute('bob', 'Verificação de ek', 'ByteEncode₁₂(ByteDecode₁₂(ek)) = ek', `${sz.ek} bytes`, 'ek válida', 'param'),
    ]),
    step('bob-m', 'Bob sorteia a mensagem m', 'Uma mensagem aleatória de 32 bytes. Dela sairão a chave K e toda a aleatoriedade da cifragem.', 'Sorteio de 32 bytes.', [
      compute('bob', 'Mensagem aleatória', 'm ← 32 bytes aleatórios', '32 bytes', `m = ${hex(enc.m, 6)}`, 'secret', entry('m', 'Mensagem aleatória m', `${hex(enc.m, 6)}`, 'secret')),
    ]),
    step('bob-g', 'Bob deriva a chave K e a semente r', 'G (SHA3-512) mistura m com o hash da chave pública: os primeiros 32 bytes são a chave compartilhada K e os últimos são r, que determina toda a cifragem. Assim a cifragem é determinística e Alice poderá conferi-la.', 'Cálculo de SHA3-512(m ‖ H(ek)).', [
      compute('bob', 'Chave e semente', '(K, r) = G(m ‖ H(ek))', `m = ${hex(enc.m, 6)}, H(ek) = ${hex(enc.h, 6)}`, `K = ${hex(enc.K, 6)}, r = ${hex(enc.r, 6)}`, 'secret', entry('K', 'Chave K de Bob', `${hex(enc.K)}`, 'secret')),
    ]),
    step('bob-noise', 'Bob sorteia y, e₁ e e₂ a partir de r', `Mais ruído pequeno: y e e₁ são vetores de ${p.k} polinômios e e₂ é um polinômio, todos com coeficientes em [−η, η].`, 'Amostragem binomial centrada.', [
      compute('bob', 'Ruído de Bob', 'y, e1, e2 ← CBD(PRF(r, i))', `r = ${hex(enc.r, 6)}`, `y[0] = ${polyStr(enc.y[0], true)}, e₂ = ${polyStr(enc.e2, true)}`, 'secret'),
    ]),
    step('bob-u', 'Bob calcula u = NTT⁻¹(Âᵀ∘ŷ) + e₁', 'Bob multiplica a transposta de Â pelo seu vetor y e soma o ruído e₁. É o análogo, do lado de Bob, de t = A·s + e.', 'Multiplicação e soma com ruído.', [
      compute('bob', 'Primeira parte', 'u = NTT⁻¹(Âᵀ∘ŷ) + e1', 'ŷ = NTT(y)', `u[0] = ${polyStr(enc.u[0])}`, 'cipher'),
    ]),
    step('bob-v', 'Bob calcula v = NTT⁻¹(t̂ᵀ∘ŷ) + e₂ + μ', 'Bob usa a chave pública t̂ de Alice e esconde a mensagem m em μ: cada bit de m vira 0 ou q/2 (cerca de 1665), no meio do intervalo.', 'Produto interno com t̂, ruído e a mensagem.', [
      compute('bob', 'Segunda parte', 'v = NTT⁻¹(t̂ᵀ∘ŷ) + e2 + μ', 'μ = Decompress₁(m)', `v = ${polyStr(enc.v)}`, 'cipher'),
    ]),
    step('bob-c', 'Bob comprime u e v e monta o texto cifrado', `A compressão descarta os bits menos significativos (u com ${p.du} bits por coeficiente e v com ${p.dv}); o erro que isso causa é pequeno e entra na conta do ruído. Resultado: ${sz.ciphertext} bytes.`, 'Compressão e codificação em bytes.', [
      compute('bob', 'Texto cifrado', 'c = Encode(Compress(u)) ‖ Encode(Compress(v))', `d_u = ${p.du}, d_v = ${p.dv}`, `c = ${sz.ciphertext} bytes: ${hex(enc.c, 6)}`, 'cipher', entry('c', 'Texto cifrado c', `${sz.ciphertext} bytes: ${hex(enc.c, 6)}`, 'cipher')),
    ]),
  ];
  if (f.input.tamper && f.flipped) {
    steps.push(
      step('intercept', 'Eva inverte um bit do texto cifrado', 'Eva intercepta o texto cifrado, inverte um único bit e o reenvia a Alice. Ela não sabe o que isso causa, mas quer ver se Alice reage de forma que revele algo.', 'Inversão de um bit do texto cifrado.', [
        { type: 'send', message: { from: 'bob', to: 'eva', label: 'c', summary: `${sz.ciphertext} bytes: ${hex(enc.c, 8)}`, kind: 'cipher' }, deliver: [entry('seen', 'Capturado no canal', `ek e c (${sz.ciphertext} bytes)`, 'cipher')] },
        compute('eva', 'Adulteração', "c′ = c com o bit invertido", `byte ${f.flipped.byte}, bit ${f.flipped.bit}`, `c′ = ${hex(f.received, 6)}`, 'cipher', entry('c2', 'Texto cifrado alterado', `${hex(f.received, 6)}`, 'cipher')),
        { type: 'send', message: { from: 'eva', to: 'alice', label: "c′", summary: `${sz.ciphertext} bytes: ${hex(f.received, 8)}`, kind: 'cipher', tampered: true }, deliver: [entry('c', 'Texto cifrado recebido', `${hex(f.received, 6)}`, 'cipher')] },
      ]),
    );
  } else {
    steps.push(
      step('send-c', 'Bob envia c a Alice', `O texto cifrado (${sz.ciphertext} bytes) atravessa o canal; Eva o vê, mas sem s não consegue extrair a chave.`, 'Envio do texto cifrado.', [
        { type: 'send', message: { from: 'bob', to: 'alice', label: 'c', summary: `${sz.ciphertext} bytes: ${hex(enc.c, 8)}`, kind: 'cipher', observers: ['eva'] }, deliver: [entry('c', 'Texto cifrado recebido', `${hex(enc.c, 6)}`, 'cipher')], observerEntries: [entry('seen', 'Observado no canal', `ek e c (${sz.ciphertext} bytes)`, 'cipher')] },
      ]),
    );
  }
  steps.push(
    step('alice-dec', 'Alice decifra e recupera m′', 'Alice calcula w = v′ − sᵀu′. Como v = tᵀy + e₂ + μ e u = Aᵀy + e₁, sobra μ mais um ruído pequeno; arredondar cada coeficiente para 0 ou q/2 recupera os bits de m.', 'Decifragem K-PKE e arredondamento.', [
      compute('alice', 'Decifragem', "m′ = Compress₁(v′ − sᵀ·u′)", 'u′ e v′ descomprimidos de c', `m′ = ${hex(dec.mPrime, 6)}`, 'secret', entry('m', 'Mensagem recuperada m′', `${hex(dec.mPrime, 6)}`, 'secret')),
    ]),
    step('alice-g', 'Alice deriva K′ e r′ da mensagem recuperada', 'O mesmo cálculo de Bob, agora sobre m′ e o hash H(ek) guardado em dk.', 'Cálculo de SHA3-512(m′ ‖ H(ek)).', [
      compute('alice', 'Chave e semente', "(K′, r′) = G(m′ ‖ H(ek))", `m′ = ${hex(dec.mPrime, 6)}`, `K′ = ${hex(dec.KPrime, 6)}, r′ = ${hex(dec.rPrime, 6)}`, 'secret'),
    ]),
    step('alice-reenc', 'Alice refaz a cifragem e compara', 'Alice cifra m′ com a chave ek e a semente r′ e vê se obtém exatamente o texto cifrado que recebeu. Se alguém alterou c, a conta não fecha (transformação de Fujisaki-Okamoto).', 'Recifragem K-PKE e comparação.', [
      compute('alice', 'Verificação', "c′ = K-PKE.Encrypt(ek, m′, r′);  c′ = c ?", `${sz.ciphertext} bytes`, dec.valid ? 'c′ = c: texto cifrado íntegro' : 'c′ ≠ c: texto cifrado rejeitado', 'param'),
    ]),
    step('alice-key', dec.valid ? 'Alice adota a chave K′' : 'Alice adota a chave de rejeição K̄', dec.valid ? 'O texto cifrado conferiu: a chave de Alice é K′, igual à de Bob.' : 'O texto cifrado não conferiu. Em vez de falhar com um erro, Alice calcula K̄ = J(z ‖ c) com a sua semente secreta z. A chave parece normal, mas é imprevisível e diferente da de Bob (rejeição implícita).', 'Escolha entre K′ e K̄.', [
      compute('alice', 'Chave compartilhada', dec.valid ? 'K = K′' : 'K = J(z ‖ c)', dec.valid ? 'c′ = c' : 'c′ ≠ c', `K = ${hex(dec.K, 6)}`, 'secret', entry('K', 'Chave K de Alice', `${hex(dec.K)}`, 'secret')),
    ]),
    step('result', f.keysMatch ? 'Alice e Bob têm a mesma chave' : 'A adulteração foi neutralizada', f.verdictText, 'Avaliação do resultado.', [{ type: 'verdict', verdict: { ok: f.input.tamper ? !f.keysMatch : f.keysMatch, text: f.verdictText } }]),
  );
  return { id: 'ml-kem', title: `${p.name}: Alice, Bob e Eva`, parties: mlkemParties, steps };
}
