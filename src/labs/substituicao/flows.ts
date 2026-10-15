import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

export interface SubstitutionFlowData {
  /** Chave de Alice e Bob: permutação das 26 letras. */
  keyText: string;
  plain: string;
  cipherText: string;
  receivedText: string;
  recovered: string;
  tampered: boolean;
  tamperPosition: number;
  nLetters: number;
  ic: number;
  /** Resultado da análise de frequência isolada e do refinamento com bigramas. */
  freqPlain: string;
  freqPct: number;
  finalPlain: string;
  finalPct: number;
  /** Chave deduzida por Eva (permutação das 26 letras, na mesma forma da chave real). */
  evaKey: string;
  level: 'total' | 'parcial' | 'falha';
  verdictText: string;
  ok: boolean;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
const pct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;
const icText = (n: number) => n.toFixed(4).replace('.', ',');

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: 'Chave K (26 letras)', kind: 'secret' },
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
      { key: 'K', label: 'Chave K (26 letras)', kind: 'secret' },
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
      { key: 'P0', label: 'Palpite só por frequência', kind: 'plain' },
      { key: 'K', label: 'Chave deduzida por Eva', kind: 'secret' },
      { key: 'P', label: 'Texto deduzido após refinamento', kind: 'plain' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

export function buildSubstitutionProtocol(d: SubstitutionFlowData): ProtocolDefinition {
  const freqStep: ProtocolStep = {
    id: 'eva-freq',
    title: 'Eva analisa a frequência das letras',
    description:
      'Eva conta quantas vezes cada letra aparece na cifra e ordena. Como a substituição só troca os nomes das letras, a mais frequente na cifra provavelmente é o A ou o E do português, e assim por diante. Ela também calcula o índice de coincidência, que não muda com a substituição e confirma que o texto é uma língua natural cifrada por substituição.',
    operation: 'Contagem de letras, ordenação e correspondência com a frequência do português.',
    events: [
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Análise de frequência',
          formula: 'posto(f_{cifra}) ↔ posto(f_{português})',
          substituted: `${d.nLetters} letras, IC = ${icText(d.ic)}`,
          result: `${pct(d.freqPct)} das letras corretas`,
          kind: 'plain',
        },
        entry: entry('P0', 'Palpite só por frequência', short(d.freqPlain), 'plain'),
      },
    ],
    info: ['A frequência sozinha costuma acertar só cerca de metade das letras: as letras de frequência parecida se confundem.'],
  };

  const refineStep: ProtocolStep = {
    id: 'eva-refine',
    title: 'Eva refina o palpite com bigramas',
    description:
      'Eva troca pares de letras do palpite enquanto o texto decifrado ficar mais parecido com português: pares comuns como "QU", "ÃO" e "DE" pontuam bem, pares impossíveis pontuam mal. Em poucos instantes ela converge para a chave, sem testar as 26! possibilidades.',
    operation: 'Busca local por trocas de letras, maximizando a verossimilhança dos bigramas do português.',
    events: [
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Refinamento por bigramas',
          formula: 'maximizar Σ log P(letra_{i+1} | letra_{i})',
          substituted: 'trocas de pares de letras a partir do palpite por frequência',
          result: `${pct(d.finalPct)} das letras corretas`,
          kind: 'secret',
        },
        entry: entry('K', 'Chave deduzida por Eva', d.evaKey, 'secret'),
      },
      { type: 'set', party: 'eva', entry: entry('P', 'Texto deduzido após refinamento', short(d.finalPlain), 'plain') },
    ],
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
        freqStep,
        refineStep,
        {
          id: 'transit',
          title: 'Eva altera uma letra e reenvia a Bob',
          description: `Eva troca a letra ${d.tamperPosition} da cifra por outra e a entrega a Bob. A substituição simples não tem verificação de integridade: Bob não percebe.`,
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
        freqStep,
        refineStep,
      ];

  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob combinam a chave',
      description: 'A chave é uma permutação das 26 letras: a letra de posição i do alfabeto é trocada pela letra de posição i da chave. Há 26! ≈ 4,0 × 10²⁶ chaves possíveis. Eva não conhece a chave.',
      operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Chave K (26 letras)', d.keyText, 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Chave K (26 letras)', d.keyText, 'secret') },
      ],
      info: ['Testar as 26! chaves, a 1 bilhão por segundo, levaria cerca de 12,8 bilhões de anos. Mesmo assim, Eva não precisará disso.'],
    },
    {
      id: 'write',
      title: 'Alice escreve a mensagem',
      description: 'O texto é normalizado: maiúsculas, sem acentos, espaços ou pontuação.',
      operation: 'Normalização do texto em letras de A a Z.',
      events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.plain), 'plain') }],
    },
    {
      id: 'encrypt',
      title: 'Alice cifra por substituição',
      description: 'Cada letra é trocada pela letra correspondente da chave. A mesma letra clara sempre vira a mesma letra cifrada.',
      operation: `Substituição de ${d.nLetters} letras pela tabela da chave.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: 'Cifragem por substituição',
            formula: 'C_{i} = chave[P_{i}]',
            substituted: `${d.nLetters} letras, chave de 26 letras`,
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
      description: 'Bob guarda a cifra recebida e a decifra com a tabela inversa.',
      operation: 'Recepção da mensagem cifrada.',
      events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedText), 'cipher') }],
    },
    {
      id: 'decrypt',
      title: 'Bob decifra com a chave K',
      description: 'Bob usa a tabela inversa: procura cada letra cifrada na chave e volta à letra clara.',
      operation: 'Substituição inversa.',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Decifragem',
            formula: 'P_{i} = chave^{-1}[C_{i}]',
            substituted: `${d.nLetters} letras`,
            result: `P = ${short(d.recovered)}`,
            kind: 'plain',
          },
          entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
        },
      ],
    },
    {
      id: 'result',
      title: d.ok ? 'Eva não consegue ler a mensagem nesta tentativa' : 'A cifra foi quebrada por Eva',
      description: d.verdictText,
      operation: 'Avaliação do resultado.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
  return { id: 'classica-substituicao', title: 'Substituição simples: Alice, Bob e Eva', parties, steps };
}
