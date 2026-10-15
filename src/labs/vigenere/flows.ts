import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

export interface VigenereFlowData {
  key: string;
  plain: string;
  cipherText: string;
  receivedText: string;
  recovered: string;
  tampered: boolean;
  tamperPosition: number;
  nLetters: number;
  icPlain: number;
  icCipher: number;
  /** O que Eva deduziu. */
  evaLength: number;
  evaKey: string;
  evaPlain: string;
  /** Fatores mais frequentes no teste de Kasiski (os três primeiros). */
  kasiskiTop: number[];
  /** IC médio das colunas no tamanho escolhido por Eva. */
  icAtLength: number;
  finalPct: number;
  level: 'total' | 'parcial' | 'falha';
  verdictText: string;
  ok: boolean;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
const num = (v: number, d = 4) => v.toFixed(d).replace('.', ',');
const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: 'Chave K (palavra)', kind: 'secret' },
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
      { key: 'K', label: 'Chave K (palavra)', kind: 'secret' },
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
      { key: 'L', label: 'Tamanho da chave deduzido', kind: 'param' },
      { key: 'K', label: 'Chave deduzida por Eva', kind: 'secret' },
      { key: 'P', label: 'Texto deduzido por Eva', kind: 'plain' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

export function buildVigenereProtocol(d: VigenereFlowData): ProtocolDefinition {
  const m = d.key.length;
  const lengthStep: ProtocolStep = {
    id: 'eva-length',
    title: 'Eva descobre o tamanho da chave',
    description:
      'Eva usa duas ferramentas. O teste de Kasiski procura sequências repetidas na cifra: a distância entre elas costuma ser múltiplo do tamanho da chave. O índice de coincidência (IC) médio das colunas, para cada tamanho possível, tem um pico no tamanho certo, porque cada coluna é um César simples e volta a ter a cara do português.',
    operation: 'Teste de Kasiski e IC médio das colunas para m = 1, 2, 3, ...',
    events: [
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Tamanho da chave: Kasiski e IC por coluna',
          formula: 'm* = menor m com IC_{médio}(m) ≈ IC_{português}',
          substituted: `Kasiski: fatores mais comuns ${d.kasiskiTop.join(', ')}; IC médio em m = ${d.evaLength}: ${num(d.icAtLength)}`,
          result: `m = ${d.evaLength}`,
          kind: 'param',
        },
        entry: entry('L', 'Tamanho da chave deduzido', `m = ${d.evaLength}`, 'param'),
      },
    ],
    info: [`O IC do texto inteiro cai para ${num(d.icCipher)} (o do português é cerca de 0,0745): a Vigenère esconde a frequência, mas não a periodicidade.`],
  };

  const keyStep: ProtocolStep = {
    id: 'eva-key',
    title: 'Eva deduz a chave coluna a coluna',
    description: `Com o tamanho ${d.evaLength} conhecido, Eva separa a cifra em ${d.evaLength} colunas. Cada coluna foi cifrada por um único César, então a análise de frequência de cada uma revela a sua letra da chave. Juntas, as letras formam a chave.`,
    operation: `Análise de frequência de ${d.evaLength} colunas.`,
    events: [
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Chave por análise de frequência de cada coluna',
          formula: 'K_{j} = argmin_{k} χ²(D_{k}(coluna j))',
          substituted: `${d.evaLength} colunas de cerca de ${Math.round(d.nLetters / d.evaLength)} letras`,
          result: `chave = ${d.evaKey}`,
          kind: 'secret',
        },
        entry: entry('K', 'Chave deduzida por Eva', d.evaKey, 'secret'),
      },
      { type: 'set', party: 'eva', entry: entry('P', 'Texto deduzido por Eva', short(d.evaPlain), 'plain') },
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
        lengthStep,
        keyStep,
        {
          id: 'transit',
          title: 'Eva altera uma letra e reenvia a Bob',
          description: `Eva troca a letra ${d.tamperPosition} da cifra por outra e a entrega a Bob. A Vigenère não tem verificação de integridade: Bob não percebe.`,
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
        lengthStep,
        keyStep,
      ];

  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob combinam a chave',
      description: `A chave é uma palavra de ${m} ${m === 1 ? 'letra' : 'letras'}, repetida ao longo da mensagem. Cada letra da chave define um deslocamento de César diferente. Eva não conhece a chave.`,
      operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Chave K (palavra)', d.key, 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Chave K (palavra)', d.key, 'secret') },
      ],
      info: ['A Vigenère foi chamada de "le chiffre indéchiffrable" (a cifra indecifrável) por quase três séculos, até Kasiski publicar o seu método em 1863.'],
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
      title: 'Alice cifra com a Vigenère',
      description: 'A i-ésima letra do texto é somada, módulo 26, à letra da chave na posição i mod m. A mesma letra clara vira letras cifradas diferentes, conforme a posição.',
      operation: `Cifragem Vigenère de ${d.nLetters} letras com chave de ${m} ${m === 1 ? 'letra' : 'letras'}.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: 'Cifragem Vigenère',
            formula: 'C_{i} = (P_{i} + K_{i mod m}) mod 26',
            substituted: `${d.nLetters} letras, m = ${m}`,
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
      description: 'Bob guarda a cifra recebida e a decifra com a mesma chave.',
      operation: 'Recepção da mensagem cifrada.',
      events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedText), 'cipher') }],
    },
    {
      id: 'decrypt',
      title: 'Bob decifra com a chave K',
      description: 'Bob subtrai a letra da chave, módulo 26, de cada letra da cifra.',
      operation: 'Decifragem Vigenère.',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Decifragem',
            formula: 'P_{i} = (C_{i} - K_{i mod m}) mod 26',
            substituted: `${d.nLetters} letras, m = ${m}`,
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
  return { id: 'classica-vigenere', title: 'Vigenère: Alice, Bob e Eva', parties, steps };
}

export { pct };
