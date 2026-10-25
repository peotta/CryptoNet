// Fluxo do Playfair com Alice, Bob e Eva, e a execução que alimenta a animação.
import { groupsOfFive, normalizeText } from '../../crypto/classical';
import type { ClassicalEngine } from '../../crypto/engines';
import { GRID_ALPHABET, type DigraphStep } from '../../crypto/playfair';
import { indexOfCoincidence } from '../../crypto/substitution';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

export const MAX_LETTERS = 1500;

export interface DigraphCount {
  digraph: string;
  count: number;
}

export interface PlayfairFlowData {
  keyword: string;
  grid: string;
  nLetters: number;
  nDigraphs: number;
  plainDigraphs: string;
  cipherDigraphs: string;
  receivedDigraphs: string;
  recovered: string;
  tampered: boolean;
  tamperPosition: number;
  icPlain: number;
  icCipher: number;
  distinctCipherDigraphs: number;
  topCipher: DigraphCount[];
  topPlain: DigraphCount[];
  verdictText: string;
  ok: boolean;
}

export interface PlayfairRun {
  flow: PlayfairFlowData;
  grid: string;
  steps: DigraphStep[];
  cipherLetters: string;
  plainLetters: string;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
const num = (v: number, d = 4) => v.toFixed(d).replace('.', ',');
const pairs = (s: string) => (s.match(/.{1,2}/g) ?? []).join(' ');

function topDigraphs(text: string, k = 8): { top: DigraphCount[]; distinct: number } {
  const m = new Map<string, number>();
  for (let i = 0; i + 1 < text.length; i += 2) m.set(text.slice(i, i + 2), (m.get(text.slice(i, i + 2)) ?? 0) + 1);
  const all = [...m.entries()].map(([digraph, count]) => ({ digraph, count })).sort((a, b) => b.count - a.count || a.digraph.localeCompare(b.digraph));
  return { top: all.slice(0, k), distinct: all.length };
}

export async function runPlayfair(engine: ClassicalEngine, input: { keyword: string; text: string; tamper: boolean }): Promise<PlayfairRun> {
  const kw = normalizeText(input.keyword);
  if (kw.length === 0) throw new Error('A palavra-chave deve ter ao menos uma letra (A a Z).');
  if (kw.length > 25) throw new Error('A palavra-chave deve ter no máximo 25 letras.');
  const plain = normalizeText(input.text);
  if (plain.length === 0) throw new Error('Digite ao menos uma letra (A a Z).');
  if (plain.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras.`);

  const { grid, steps, cipher } = await engine.encryptPlayfair(kw, plain);
  const preparedPlain = steps.map((s) => s.input).join('');
  const pos = Math.floor(cipher.length / 2);
  const bump = GRID_ALPHABET[(GRID_ALPHABET.indexOf(cipher[pos]) + 1) % 25];
  const received = input.tamper ? cipher.slice(0, pos) + bump + cipher.slice(pos + 1) : cipher;
  const recovered = await engine.decryptPlayfair(grid, received);

  const c = topDigraphs(cipher);
  const p = topDigraphs(preparedPlain);
  const icPlain = indexOfCoincidence(preparedPlain);
  const icCipher = indexOfCoincidence(cipher);

  let verdictText =
    `A frequência de letras isolada não revela a mensagem: o IC da cifra é ${num(icCipher)} (português: 0,0745) e o histograma é achatado. Eva precisaria de análise de digrafos com centenas de letras, ` +
    'de palavras prováveis ou de texto claro conhecido. O Playfair foi usado em campo por décadas, mas não é seguro: é quebrado por esses métodos, e por computador.';
  if (input.tamper) verdictText += ' Além disso, Bob decifrou a mensagem alterada sem perceber: não há verificação de integridade.';

  return {
    grid,
    steps,
    cipherLetters: cipher,
    plainLetters: preparedPlain,
    flow: {
      keyword: kw,
      grid,
      nLetters: preparedPlain.length,
      nDigraphs: steps.length,
      plainDigraphs: pairs(preparedPlain),
      cipherDigraphs: pairs(cipher),
      receivedDigraphs: pairs(received),
      recovered: pairs(recovered),
      tampered: input.tamper,
      tamperPosition: pos + 1,
      icPlain,
      icCipher,
      distinctCipherDigraphs: c.distinct,
      topCipher: c.top,
      topPlain: p.top,
      verdictText,
      ok: true,
    },
  };
}

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: 'Palavra-chave', kind: 'secret' },
      { key: 'm', label: 'Digrafos da mensagem', kind: 'plain' },
      { key: 'c', label: 'Cifra C', kind: 'cipher' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Destinatário',
    position: 'right',
    slots: [
      { key: 'K', label: 'Palavra-chave', kind: 'secret' },
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
      { key: 'S', label: 'Estatísticas observadas por Eva', kind: 'param' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

export function buildPlayfairProtocol(d: PlayfairFlowData): ProtocolDefinition {
  const top = d.topCipher[0];
  const statsStep: ProtocolStep = {
    id: 'eva-stats',
    title: 'Eva tenta a análise de frequência',
    description:
      'Eva conta as letras e os digrafos da cifra. O Playfair cifra pares de letras: a frequência de uma letra isolada se espalha por várias letras cifradas e o histograma fica achatado. Restam as estatísticas de digrafos, que existem mas são muito mais numerosas (cerca de 600 digrafos possíveis) e exigem muito mais texto.',
    operation: 'Cálculo do IC e da frequência de digrafos da cifra.',
    events: [
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Estatísticas da cifra',
          formula: 'IC e frequência de digrafos',
          substituted: `${d.nDigraphs} digrafos, ${d.distinctCipherDigraphs} distintos`,
          result: `IC = ${num(d.icCipher)}; digrafo mais frequente: ${top ? `${top.digraph} (${top.count}x)` : 'nenhum'}`,
          kind: 'param',
        },
        entry: entry('S', 'Estatísticas observadas por Eva', `IC = ${num(d.icCipher)}`, 'param'),
      },
    ],
    info: ['Eva não consegue ler a mensagem só com isso. Em textos curtos, o Playfair resiste às técnicas de frequência de letras que quebram a substituição simples.'],
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
              message: { from: 'alice', to: 'eva', label: 'Cifra C', summary: short(d.cipherDigraphs), kind: 'cipher' },
              deliver: [entry('c', 'Cifra capturada', short(d.cipherDigraphs), 'cipher')],
            },
          ],
        },
        statsStep,
        {
          id: 'transit',
          title: 'Eva altera uma letra e reenvia a Bob',
          description: `Eva troca a letra ${d.tamperPosition} da cifra por outra e a entrega a Bob. O Playfair não tem verificação de integridade: Bob não percebe, e a alteração estraga duas letras do texto claro.`,
          operation: `Alteração da letra ${d.tamperPosition} e reenvio.`,
          events: [
            { type: 'set', party: 'eva', entry: entry('forged', "Cifra alterada C' (enviada a Bob)", short(d.receivedDigraphs), 'cipher') },
            {
              type: 'send',
              message: { from: 'eva', to: 'bob', label: "Cifra C'", summary: short(d.receivedDigraphs), kind: 'cipher', tampered: true },
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
              message: { from: 'alice', to: 'bob', label: 'Cifra C', summary: short(d.cipherDigraphs), kind: 'cipher', observers: ['eva'] },
              deliver: [],
              observerEntries: [entry('c', 'Cifra observada', short(d.cipherDigraphs), 'cipher')],
            },
          ],
        },
        statsStep,
      ];

  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob combinam a palavra-chave',
      description: `A palavra-chave ${d.keyword} gera a grade 5 × 5: primeiro as letras da chave, sem repetir, depois as demais do alfabeto (J e I compartilham a mesma casa). Eva não conhece a chave.`,
      operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Palavra-chave', d.keyword, 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Palavra-chave', d.keyword, 'secret') },
      ],
      info: [`Grade: ${Array.from({ length: 5 }, (_, r) => d.grid.slice(r * 5, r * 5 + 5)).join(' / ')}`],
    },
    {
      id: 'write',
      title: 'Alice prepara a mensagem em digrafos',
      description: 'O texto é normalizado (J vira I) e dividido em pares de letras. Entre duas letras iguais do mesmo par insere-se X, e se sobrar uma letra no fim ela é completada com X.',
      operation: `Divisão em ${d.nDigraphs} digrafos.`,
      events: [{ type: 'set', party: 'alice', entry: entry('m', 'Digrafos da mensagem', short(d.plainDigraphs), 'plain') }],
    },
    {
      id: 'encrypt',
      title: 'Alice cifra cada digrafo pela grade',
      description:
        'Mesma linha: cada letra é trocada pela da direita. Mesma coluna: pela de baixo. Em linhas e colunas diferentes (retângulo): cada letra é trocada pela da própria linha, na coluna da outra.',
      operation: `Cifragem de ${d.nDigraphs} digrafos com a grade.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: 'Cifragem Playfair',
            formula: 'AB → regra da linha, da coluna ou do retângulo',
            substituted: `${d.nDigraphs} digrafos, grade de ${d.keyword}`,
            result: `C = ${short(d.cipherDigraphs)}`,
            kind: 'cipher',
          },
          entry: entry('c', 'Cifra C', short(d.cipherDigraphs), 'cipher'),
        },
      ],
    },
    ...transit,
    {
      id: 'receive',
      title: 'Bob recebe a cifra',
      description: 'Bob guarda a cifra recebida e a decifra com a mesma grade.',
      operation: 'Recepção da mensagem cifrada.',
      events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedDigraphs), 'cipher') }],
    },
    {
      id: 'decrypt',
      title: 'Bob decifra pela regra inversa',
      description: 'Bob aplica as regras ao contrário: letras à esquerda na linha, acima na coluna, e o mesmo retângulo. Os X inseridos pela preparação permanecem no texto.',
      operation: 'Decifragem Playfair.',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Decifragem',
            formula: 'AB → regra inversa (esquerda, acima ou retângulo)',
            substituted: `${d.nDigraphs} digrafos`,
            result: `P = ${short(d.recovered)}`,
            kind: 'plain',
          },
          entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
        },
      ],
    },
    {
      id: 'result',
      title: 'Eva não lê a mensagem só com a frequência de letras',
      description: d.verdictText,
      operation: 'Avaliação do resultado.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
  return { id: 'classica-playfair', title: 'Playfair: Alice, Bob e Eva', parties, steps };
}

export { groupsOfFive };
