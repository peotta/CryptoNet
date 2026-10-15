import type { ClassicalCipher } from '../../crypto/classical';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

export interface ClassicalFlowData {
  cipher: ClassicalCipher;
  /** Chave legível, como "k = 3" ou "a = 5, b = 8". */
  keyText: string;
  /** Inverso de a módulo 26 (na cifra afim). */
  inverseA: number;
  /** Texto claro e textos cifrados, normalizados e agrupados de cinco em cinco. */
  plain: string;
  cipherText: string;
  receivedText: string;
  recovered: string;
  tampered: boolean;
  tamperPosition: number;
  /** O que Eva deduziu apenas com o texto cifrado. */
  evaKeyText: string;
  evaPlain: string;
  evaChi2: number;
  evaSuccess: boolean;
  keyCount: number;
  nLetters: number;
  /** Letras alteradas por Eva em trânsito, quando há adulteração. */
  verdictText: string;
  ok: boolean;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: 'Chave K', kind: 'secret' },
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
      { key: 'K', label: 'Chave K', kind: 'secret' },
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
      { key: 'K', label: 'Chave deduzida por Eva', kind: 'secret' },
      { key: 'P', label: 'Texto claro deduzido por Eva', kind: 'plain' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

export function buildClassicalProtocol(d: ClassicalFlowData): ProtocolDefinition {
  const caesar = d.cipher === 'cesar';
  const name = caesar ? 'César' : 'afim';
  const enc = caesar ? 'C = (P + k) mod 26' : 'C = (a·P + b) mod 26';
  const dec = caesar ? 'P = (C - k) mod 26' : 'P = a^{-1}·(C - b) mod 26';
  const evaFormula = caesar ? 'k* = argmin χ²(D_{k}(C))' : '(a*, b*) = argmin χ²(D_{a,b}(C))';

  const crackStep: ProtocolStep = {
    id: 'eva-crack',
    title: `Eva tenta todas as ${d.keyCount} chaves (força bruta)`,
    description: `A cifra ${name} tem só ${d.keyCount} chaves possíveis. Para cada uma, Eva decifra o texto e mede o quanto o resultado se parece com português (estatística χ² contra a frequência das letras). A chave com o menor χ² é a mais provável. Eva não precisou da chave de Alice e Bob.`,
    operation: `Decifragem com as ${d.keyCount} chaves e escolha do menor χ².`,
    events: [
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Criptoanálise por força bruta e frequência',
          formula: evaFormula,
          substituted: `${d.keyCount} chaves testadas sobre ${d.nLetters} letras`,
          result: `${d.evaKeyText} (χ² = ${d.evaChi2.toFixed(1).replace('.', ',')})`,
          kind: 'secret',
        },
        entry: entry('K', 'Chave deduzida por Eva', d.evaKeyText, 'secret'),
      },
      { type: 'set', party: 'eva', entry: entry('P', 'Texto claro deduzido por Eva', short(d.evaPlain), 'plain') },
    ],
    info: d.nLetters < 25 ? ['O texto é curto: com poucas letras a análise de frequência pode errar, mas Eva ainda lê todos os candidatos e reconhece o português.'] : undefined,
  };

  const transit: ProtocolStep[] = d.tampered
    ? [
        {
          id: 'intercept',
          title: 'Eva intercepta a cifra',
          description: 'A cifra enviada por Alice chega a Eva, e não a Bob. O canal é público e Eva o controla.',
          operation: 'Interceptação da cifra.',
          events: [
            {
              type: 'send',
              message: { from: 'alice', to: 'eva', label: 'Cifra C', summary: short(d.cipherText), kind: 'cipher' },
              deliver: [entry('c', 'Cifra capturada', short(d.cipherText), 'cipher')],
            },
          ],
        },
        crackStep,
        {
          id: 'transit',
          title: 'Eva altera uma letra e reenvia a Bob',
          description: `Eva troca a letra ${d.tamperPosition} da cifra por outra e a entrega a Bob. Cifras clássicas não têm nenhuma verificação de integridade: Bob não tem como perceber.`,
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
          description: 'A cifra trafega pelo canal público. Eva a lê, pois todos os nós do caminho podem ler o que passa por ele.',
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
        crackStep,
      ];

  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob combinam a chave',
      description: `Na cifra ${name}, a chave é ${caesar ? 'o deslocamento k' : 'o par (a, b)'}. Os dois a combinaram antes, por um meio seguro. Eva não a conhece.`,
      operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Chave K', d.keyText, 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Chave K', d.keyText, 'secret') },
      ],
      info: [`Princípio de Kerckhoffs: a segurança deve depender só da chave. Aqui há apenas ${d.keyCount} chaves possíveis.`],
    },
    {
      id: 'write',
      title: 'Alice escreve a mensagem',
      description: 'O texto é normalizado: letras maiúsculas, sem acentos, espaços ou pontuação (alfabeto de 26 letras, A = 0 até Z = 25).',
      operation: 'Normalização e codificação das letras como números de 0 a 25.',
      events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.plain), 'plain') }],
    },
    {
      id: 'encrypt',
      title: `Alice cifra com a cifra ${name}`,
      description: caesar
        ? 'Cada letra é deslocada k posições no alfabeto, voltando ao início depois do Z.'
        : 'Cada letra P é multiplicada por a e somada a b, módulo 26. A condição mdc(a, 26) = 1 garante que a operação tem inversa.',
      operation: `Cifragem ${name} de ${d.nLetters} letras.`,
      events: [
        {
          type: 'compute',
          operation: { party: 'alice', title: `Cifragem ${name}`, formula: enc, substituted: `${d.nLetters} letras, ${d.keyText}`, result: `C = ${short(d.cipherText)}`, kind: 'cipher' },
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
      description: caesar ? 'Bob desloca cada letra k posições no sentido contrário.' : 'Bob aplica a operação inversa, usando o inverso multiplicativo de a módulo 26.',
      operation: `Decifragem ${name}.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Decifragem',
            formula: dec,
            substituted: caesar ? `${d.nLetters} letras, ${d.keyText}` : `${d.nLetters} letras, ${d.keyText}, a^{-1} = ${d.inverseA}`,
            result: `P = ${short(d.recovered)}`,
            kind: 'plain',
          },
          entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
        },
      ],
    },
    {
      id: 'result',
      title: d.ok ? 'A mensagem é recuperada' : 'A cifra foi quebrada por Eva',
      description: d.verdictText,
      operation: 'Avaliação do resultado.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
  return { id: `classica-${d.cipher}`, title: `Cifra ${name}: Alice, Bob e Eva`, parties, steps };
}
