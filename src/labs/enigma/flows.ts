import { groupsOfFive, normalizeText } from '../../crypto/classical';
import type { ClassicalEngine } from '../../crypto/engines';
import { keySpace, parsePlugs, type CribOffset, type EnigmaConfig, type EnigmaResult, type KeySpace } from '../../crypto/enigma';
import { indexOfCoincidence } from '../../crypto/substitution';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

export const MAX_LETTERS = 600;

export interface EnigmaFlowData {
  /** Configuração do dia em texto curto, como "I-II-III · B · KLM · AAA · 10 plugues". */
  configText: string;
  nLetters: number;
  plain: string;
  cipherText: string;
  receivedText: string;
  recovered: string;
  tampered: boolean;
  tamperPosition: number;
  crib: string;
  /** Posição verdadeira do texto provável na mensagem (que Eva não conhece); -1 se o texto provável não está na mensagem. */
  cribTrueOffset: number;
  offsetsTotal: number;
  offsetsImpossible: number;
  offsetsPossible: number;
  icPlain: number;
  icCipher: number;
  verdictText: string;
  ok: boolean;
}

export interface EnigmaRun {
  config: EnigmaConfig;
  flow: EnigmaFlowData;
  plainLetters: string;
  cipherLetters: string;
  encryption: EnigmaResult;
  offsets: CribOffset[];
  space: KeySpace;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
const num = (v: number, d = 4) => v.toFixed(d).replace('.', ',');
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const configText = (c: EnigmaConfig): string => {
  const pairs = parsePlugs(c.plugs).length;
  return `${c.rotors.join('-')} · ${c.reflector} · ${c.positions} · ${c.rings} · ${pairs} ${pairs === 1 ? 'plugue' : 'plugues'}`;
};

/** Formata um inteiro grande com pontos de milhar. */
export const bigText = (n: bigint): string => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export async function runEnigmaFlow(engine: ClassicalEngine, input: { config: EnigmaConfig; text: string; crib: string; tamper: boolean }): Promise<EnigmaRun> {
  const plain = normalizeText(input.text);
  if (plain.length === 0) throw new Error('Digite ao menos uma letra (A a Z).');
  if (plain.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras.`);
  const crib = normalizeText(input.crib);
  if (crib.length < 3) throw new Error('O texto provável deve ter ao menos 3 letras.');
  if (crib.length > plain.length) throw new Error('O texto provável não pode ser maior que a mensagem.');

  const encryption = await engine.runEnigma(input.config, plain);
  const cipher = encryption.output;
  const pos = Math.floor(cipher.length / 2);
  const received = input.tamper ? cipher.slice(0, pos) + ALPHA[(ALPHA.indexOf(cipher[pos]) + 1) % 26] + cipher.slice(pos + 1) : cipher;
  // Bob usa a mesma configuração e as mesmas posições iniciais: a Enigma é recíproca.
  const recovered = (await engine.runEnigma(input.config, received)).output;

  const offsets = await engine.analyzeCrib(cipher, crib);
  const impossible = offsets.filter((o) => !o.possible).length;
  const space = keySpace(10); // a estimativa usual considera 10 pares de plugues

  let verdictText =
    `Eva alinhou o texto provável "${crib}" em ${offsets.length} posições e descartou ${impossible} por conterem uma letra igual à cifrada (a Enigma nunca cifra uma letra em si mesma). ` +
    `Restam ${offsets.length - impossible} posições, e ela ainda não conhece a configuração: o espaço de chaves é cerca de ${bigText(space.withoutRings)} (com 10 pares de plugues, sem contar os anéis). ` +
    'Historicamente, a quebra da Enigma combinou essa propriedade com textos prováveis e com as Bombes de Turing; esta simulação não inclui a Bombe.';
  if (input.tamper) verdictText += ' Além disso, Bob decifrou a mensagem alterada sem perceber: não há verificação de integridade (somente a letra atingida fica errada).';

  return {
    config: input.config,
    plainLetters: plain,
    cipherLetters: cipher,
    encryption,
    offsets,
    space,
    flow: {
      configText: configText(input.config),
      nLetters: plain.length,
      plain: groupsOfFive(plain),
      cipherText: groupsOfFive(cipher),
      receivedText: groupsOfFive(received),
      recovered: groupsOfFive(recovered),
      tampered: input.tamper,
      tamperPosition: pos + 1,
      crib,
      cribTrueOffset: plain.indexOf(crib),
      offsetsTotal: offsets.length,
      offsetsImpossible: impossible,
      offsetsPossible: offsets.length - impossible,
      icPlain: indexOfCoincidence(plain),
      icCipher: indexOfCoincidence(cipher),
      verdictText,
      ok: true,
    },
  };
}

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Operadora (transmissora)',
    position: 'left',
    slots: [
      { key: 'K', label: 'Configuração do dia', kind: 'secret' },
      { key: 'm', label: 'Mensagem m', kind: 'plain' },
      { key: 'c', label: 'Cifra C', kind: 'cipher' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Operador (receptor)',
    position: 'right',
    slots: [
      { key: 'K', label: 'Configuração do dia', kind: 'secret' },
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
      { key: 'S', label: 'Alinhamentos do texto provável', kind: 'param' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

export function buildEnigmaProtocol(d: EnigmaFlowData): ProtocolDefinition {
  const cribStep: ProtocolStep = {
    id: 'eva-crib',
    title: 'Eva testa um texto provável e usa a fraqueza do refletor',
    description: `Eva suspeita que a mensagem contém "${d.crib}" (um texto provável, como um cabeçalho ou uma frase de rotina). Ela o alinha com a cifra em cada posição possível. Como a Enigma nunca cifra uma letra em si mesma, qualquer alinhamento em que uma letra do texto provável coincide com a letra cifrada na mesma posição é impossível.`,
    operation: `Alinhamento do texto provável em ${d.offsetsTotal} posições e descarte dos impossíveis.`,
    events: [
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Descarte por coincidência de letras',
          formula: 'descartar o alinhamento se P_{j} = C_{k+j} para algum j',
          substituted: `"${d.crib}" em ${d.offsetsTotal} alinhamentos`,
          result: `${d.offsetsImpossible} impossíveis, ${d.offsetsPossible} possíveis`,
          kind: 'param',
        },
        entry: entry('S', 'Alinhamentos do texto provável', `${d.offsetsPossible} de ${d.offsetsTotal} possíveis`, 'param'),
      },
    ],
    info: ['Isso reduz o trabalho, mas não revela a configuração: ainda há cerca de 1,6 × 10²⁰ configurações a testar em cada alinhamento possível.'],
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
        cribStep,
        {
          id: 'transit',
          title: 'Eva altera uma letra e reenvia a Bob',
          description: `Eva troca a letra ${d.tamperPosition} da cifra por outra e a entrega a Bob. Na Enigma, cada letra é cifrada independentemente: somente a letra atingida sai errada, e Bob não percebe.`,
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
          description: 'A cifra (por rádio, na história) trafega pelo canal público e Eva a capta.',
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
        cribStep,
      ];

  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob ajustam a configuração do dia',
      description: `Os dois configuram as suas máquinas igualmente: ordem dos rotores, refletor, anéis, posições iniciais e painel de plugues (${d.configText}). Na história, a configuração vinha de um livro de códigos distribuído mensalmente. Eva não a conhece.`,
      operation: 'Nenhum cálculo: a configuração já é conhecida por Alice e por Bob.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Configuração do dia', d.configText, 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Configuração do dia', d.configText, 'secret') },
      ],
    },
    {
      id: 'write',
      title: 'Alice escreve a mensagem',
      description: 'O texto é normalizado: maiúsculas, sem acentos, espaços ou pontuação (a Enigma só cifra as 26 letras).',
      operation: 'Normalização do texto em letras de A a Z.',
      events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.plain), 'plain') }],
    },
    {
      id: 'encrypt',
      title: 'Alice digita a mensagem na Enigma',
      description:
        'A cada tecla, primeiro os rotores avançam (o da direita sempre; os outros nos entalhes, com o passo duplo do rotor do meio). Depois o sinal passa pelos plugues, pelos três rotores, pelo refletor, volta pelos rotores e pelos plugues, e acende uma lâmpada.',
      operation: `Cifragem de ${d.nLetters} teclas, uma a uma, com rotores em movimento.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: 'Cifragem Enigma',
            formula: 'C_{i} = plugues(rotores^{-1}(refletor(rotores(plugues(P_{i})))))',
            substituted: `${d.nLetters} teclas, ${d.configText}`,
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
      description: 'Bob anota a cifra recebida. A sua máquina está na mesma configuração e nas mesmas posições iniciais de Alice.',
      operation: 'Recepção da mensagem cifrada.',
      events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedText), 'cipher') }],
    },
    {
      id: 'decrypt',
      title: 'Bob digita a cifra na Enigma',
      description:
        'A Enigma é recíproca: o refletor faz o mesmo caminho valer nos dois sentidos, então digitar a cifra na mesma configuração e nas mesmas posições iniciais devolve o texto claro. Não é preciso um modo de decifrar.',
      operation: 'Cifragem da cifra com a mesma configuração: P = E(C).',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Decifragem (a Enigma é recíproca)',
            formula: 'P_{i} = E_{i}(C_{i})',
            substituted: 'mesma configuração e mesmas posições iniciais',
            result: `P = ${short(d.recovered)}`,
            kind: 'plain',
          },
          entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
        },
      ],
    },
    {
      id: 'result',
      title: 'Eva reduz as hipóteses, mas não lê a mensagem',
      description: d.verdictText,
      operation: 'Avaliação do resultado.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
  return { id: 'classica-enigma', title: 'Enigma: Alice, Bob e Eva', parties, steps };
}

export { num };
