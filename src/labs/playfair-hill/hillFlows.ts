// Fluxo do Hill com Alice, Bob e Eva, e a execução que alimenta a animação.
import { ALPHABET, groupsOfFive, normalizeText } from '../../crypto/classical';
import type { ClassicalEngine } from '../../crypto/engines';
import { inverseMod26, multiply, type HillAttack, type HillBlock, type Matrix } from '../../crypto/hill';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

export const MAX_LETTERS = 1500;

export interface HillFlowData {
  n: number;
  keyText: string;
  invText: string;
  nLetters: number;
  nBlocks: number;
  plain: string;
  cipherText: string;
  receivedText: string;
  recovered: string;
  tampered: boolean;
  tamperPosition: number;
  knownLetters: number;
  knownPlain: string;
  /** Resultado do ataque de Eva. */
  attackKeyText: string | null;
  usedBlocks: number[];
  success: boolean;
  failureReason: string;
  verdictText: string;
  ok: boolean;
}

export interface HillRun {
  flow: HillFlowData;
  key: Matrix;
  inverse: Matrix;
  blocks: HillBlock[];
  prepared: string;
  attack: HillAttack | null;
  /** Matrizes do sistema de Eva: P (texto claro), C (cifra) e a inversa de P. */
  system: { P: Matrix; C: Matrix; Pinv: Matrix } | null;
}

export const matrixText = (m: Matrix): string => `[${m.map((r) => r.join(' ')).join('; ')}]`;
const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);

export async function runHill(engine: ClassicalEngine, input: { key: Matrix; text: string; knownLetters: number; tamper: boolean }): Promise<HillRun> {
  const plainText = normalizeText(input.text);
  if (plainText.length === 0) throw new Error('Digite ao menos uma letra (A a Z).');
  if (plainText.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras.`);
  const n = input.key.length;
  const { prepared, blocks, cipher } = await engine.encryptHill(input.key, plainText);
  const inverse = inverseMod26(input.key);

  const pos = Math.floor(cipher.length / 2);
  const received = input.tamper ? cipher.slice(0, pos) + ALPHABET[(ALPHABET.indexOf(cipher[pos]) + 1) % 26] + cipher.slice(pos + 1) : cipher;
  const recovered = await engine.decryptHill(input.key, received);

  // Eva conhece o início do texto claro (por exemplo, um cabeçalho padronizado) e captura a cifra original.
  const knownLetters = Math.max(0, Math.min(Math.floor(input.knownLetters), prepared.length));
  const knownPlain = prepared.slice(0, knownLetters);
  const attack = await engine.attackHill(n, knownPlain, cipher);
  const success = attack !== null && attack.key.every((row, r) => row.every((v, c) => v === input.key[r][c]));

  let system: HillRun['system'] = null;
  if (attack) {
    const idx = attack.usedBlocks.map((b) => b - 1);
    const col = (src: number[][]) => Array.from({ length: n }, (_, r) => idx.map((i) => src[i][r]));
    const pb = Array.from({ length: Math.floor(knownLetters / n) }, (_, i) => [...knownPlain.slice(i * n, i * n + n)].map((ch) => ALPHABET.indexOf(ch)));
    const cb = blocks.slice(0, pb.length).map((b) => b.cipher);
    const P = col(pb);
    system = { P, C: col(cb), Pinv: inverseMod26(P) };
    void multiply;
  }

  const keyText = matrixText(input.key);
  const nBlocks = blocks.length;
  const minLetters = n * n;
  let failureReason = '';
  if (!attack) {
    failureReason =
      knownLetters < minLetters
        ? `Eva conhece só ${knownLetters} ${knownLetters === 1 ? 'letra' : 'letras'}: para uma matriz ${n} × ${n} são necessárias ao menos ${minLetters} (${n} blocos de ${n} letras)`
        : `Os blocos conhecidos por Eva são dependentes (nenhuma escolha de ${n} blocos dá uma matriz inversível módulo 26): ela precisa de mais texto claro conhecido`;
  }

  let verdictText: string;
  if (success) {
    verdictText = `Eva montou o sistema C = K · P com ${n} blocos independentes e o resolveu: K = C · P⁻¹ (mod 26). Obteve a chave exata ${keyText} conhecendo apenas ${knownLetters} letras do texto claro. A cifra de Hill é linear, e a linearidade é a sua fraqueza.`;
  } else if (attack) {
    verdictText = `Eva obteve uma matriz diferente da chave real. Isso não deveria ocorrer com texto claro conhecido correto.`;
  } else {
    verdictText = `${failureReason}. Isso é limitação dela nesta tentativa, e não segurança: com texto claro conhecido suficiente a cifra cai.`;
  }
  if (input.tamper) verdictText += ' Além disso, Bob decifrou a mensagem alterada sem perceber: não há verificação de integridade.';

  return {
    key: input.key,
    inverse,
    blocks,
    prepared,
    attack,
    system,
    flow: {
      n,
      keyText,
      invText: matrixText(inverse),
      nLetters: prepared.length,
      nBlocks,
      plain: groupsOfFive(prepared),
      cipherText: groupsOfFive(cipher),
      receivedText: groupsOfFive(received),
      recovered: groupsOfFive(recovered),
      tampered: input.tamper,
      tamperPosition: pos + 1,
      knownLetters,
      knownPlain,
      attackKeyText: attack ? matrixText(attack.key) : null,
      usedBlocks: attack?.usedBlocks ?? [],
      success,
      failureReason,
      verdictText,
      ok: !success,
    },
  };
}

const parties = (n: number): PartyDef[] => [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: `Chave K (matriz ${n} × ${n})`, kind: 'secret' },
      { key: 'm', label: 'Mensagem m', kind: 'plain' },
      { key: 'c', label: 'Cifra C', kind: 'cipher' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Destinatário',
    position: 'right',
    slots: [
      { key: 'K', label: `Chave K (matriz ${n} × ${n})`, kind: 'secret' },
      { key: 'c', label: 'Cifra recebida', kind: 'cipher' },
      { key: 'mrec', label: 'Mensagem recuperada', kind: 'plain' },
    ],
  },
  {
    id: 'eva',
    name: 'Eva',
    role: 'Criptoanalista (observa e, se puder, altera o canal)',
    position: 'center',
    adversary: true,
    slots: [
      { key: 'c', label: 'Cifra observada ou capturada', kind: 'cipher' },
      { key: 'known', label: 'Texto claro conhecido por Eva', kind: 'plain' },
      { key: 'K', label: 'Chave deduzida por Eva', kind: 'secret' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

export function buildHillProtocol(d: HillFlowData): ProtocolDefinition {
  const attackStep: ProtocolStep = {
    id: 'eva-attack',
    title: 'Eva resolve a chave com texto claro conhecido',
    description:
      `Eva sabe que a mensagem começa por um texto conhecido (por exemplo, um cabeçalho padronizado) e dispõe da cifra correspondente. Cada bloco satisfaz C = K · P. Com ${d.n} blocos independentes, ela monta as matrizes P e C (blocos nas colunas) e calcula K = C · P⁻¹ módulo 26.`,
    operation: `Resolução de K = C · P⁻¹ com ${d.n} blocos independentes.`,
    events: [
      { type: 'set', party: 'eva', entry: entry('known', 'Texto claro conhecido por Eva', short(d.knownPlain) || '(nenhum)', 'plain') },
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Ataque de texto claro conhecido',
          formula: 'K = C · P^{-1} (mod 26)',
          substituted: d.success || d.attackKeyText ? `blocos ${d.usedBlocks.join(' e ')} dos ${Math.floor(d.knownLetters / d.n)} conhecidos` : `${d.knownLetters} letras conhecidas, ${Math.floor(d.knownLetters / d.n)} blocos`,
          result: d.attackKeyText ? `K = ${d.attackKeyText}` : 'sem solução: blocos insuficientes ou dependentes',
          kind: 'secret',
        },
        ...(d.attackKeyText ? { entry: entry('K', 'Chave deduzida por Eva', d.attackKeyText, 'secret') } : {}),
      },
    ],
    info: d.attackKeyText ? undefined : [d.failureReason],
  };

  const transit: ProtocolStep[] = d.tampered
    ? [
        {
          id: 'intercept',
          title: 'Eva intercepta a cifra',
          description: 'A cifra enviada por Alice chega a Eva, e não a Bob.',
          operation: 'Interceptação da cifra.',
          events: [
            {
              type: 'send',
              message: { from: 'alice', to: 'eva', label: 'Cifra C', summary: short(d.cipherText), kind: 'cipher' },
              deliver: [entry('c', 'Cifra capturada', short(d.cipherText), 'cipher')],
            },
          ],
        },
        attackStep,
        {
          id: 'transit',
          title: 'Eva altera uma letra e reenvia a Bob',
          description: `Eva troca a letra ${d.tamperPosition} da cifra por outra e a entrega a Bob. No Hill, a alteração de uma letra corrompe o bloco inteiro de ${d.n} letras no texto claro.`,
          operation: `Alteração da letra ${d.tamperPosition} e reenvio.`,
          events: [
            { type: 'set', party: 'eva', entry: entry('forged', "Cifra alterada C' (enviada a Bob)", short(d.receivedText), 'cipher') },
            {
              type: 'send',
              message: { from: 'eva', to: 'bob', label: "Cifra C'", summary: short(d.receivedText), kind: 'cipher', tampered: true },
              deliver: [],
            },
          ],
        },
      ]
    : [
        {
          id: 'transit',
          title: 'A cifra atravessa o canal',
          description: 'A cifra trafega pelo canal público e Eva a lê.',
          operation: 'Transmissão da cifra pelo canal público.',
          events: [
            {
              type: 'send',
              message: { from: 'alice', to: 'bob', label: 'Cifra C', summary: short(d.cipherText), kind: 'cipher', observers: ['eva'] },
              deliver: [],
              observerEntries: [entry('c', 'Cifra observada', short(d.cipherText), 'cipher')],
            },
          ],
        },
        attackStep,
      ];

  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob combinam a matriz-chave',
      description: `A chave é uma matriz ${d.n} × ${d.n} de inteiros módulo 26. Ela precisa ser inversível módulo 26 (o determinante deve ser coprimo com 26) para que Bob consiga decifrar. Eva não conhece a chave.`,
      operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', `Chave K (matriz ${d.n} × ${d.n})`, d.keyText, 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', `Chave K (matriz ${d.n} × ${d.n})`, d.keyText, 'secret') },
      ],
    },
    {
      id: 'write',
      title: 'Alice prepara a mensagem em blocos',
      description: `As letras viram números (A = 0, ..., Z = 25) e são agrupadas em blocos de ${d.n}. Se faltar, o último bloco é completado com X.`,
      operation: `Divisão em ${d.nBlocks} blocos de ${d.n} letras.`,
      events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.plain), 'plain') }],
    },
    {
      id: 'encrypt',
      title: 'Alice multiplica cada bloco pela matriz',
      description: `Cada bloco P (vetor coluna) é multiplicado por K, módulo 26: C = K · P. Uma letra do texto claro afeta todas as ${d.n} letras do bloco cifrado: é a difusão do Hill.`,
      operation: `C = K · P (mod 26), bloco a bloco.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: 'Cifragem Hill',
            formula: 'C = K · P (mod 26)',
            substituted: `${d.nBlocks} blocos de ${d.n} letras, K = ${d.keyText}`,
            result: `C = ${short(d.cipherText)}`,
            kind: 'cipher',
          },
          entry: entry('c', 'Cifra C', short(d.cipherText), 'cipher'),
        },
      ],
    },
    ...transit,
    {
      id: 'receive',
      title: 'Bob recebe a cifra',
      description: 'Bob guarda a cifra recebida. Ele calculará a inversa da chave para decifrar.',
      operation: 'Recepção da mensagem cifrada.',
      events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedText), 'cipher') }],
    },
    {
      id: 'decrypt',
      title: 'Bob multiplica pela inversa da chave',
      description: 'Bob calcula K⁻¹ módulo 26 (inverso do determinante vezes a adjunta) e aplica P = K⁻¹ · C a cada bloco.',
      operation: 'Decifragem: P = K⁻¹ · C (mod 26).',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Decifragem Hill',
            formula: 'P = K^{-1} · C (mod 26)',
            substituted: `K^{-1} = ${d.invText}`,
            result: `P = ${short(d.recovered)}`,
            kind: 'plain',
          },
          entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
        },
      ],
    },
    {
      id: 'result',
      title: d.success ? 'A cifra foi quebrada por Eva' : 'Eva não conseguiu resolver a chave nesta tentativa',
      description: d.verdictText,
      operation: 'Avaliação do resultado.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
  return { id: `classica-hill-${d.n}`, title: `Hill ${d.n} × ${d.n}: Alice, Bob e Eva`, parties: parties(d.n), steps };
}
