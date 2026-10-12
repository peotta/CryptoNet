import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

export type RsaScenario = 'cifragem' | 'assinatura';
export type RsaMode = 'didatico' | 'real';

export interface OpText {
  formula: string;
  substituted: string;
  result: string;
}

/** Valores já calculados (pelo motor didático ou pelo Web Crypto) que alimentam as etapas animadas. */
export interface RsaFlowData {
  scenario: RsaScenario;
  mode: RsaMode;
  message: string;
  /** Mensagem como o destinatário a recebe (difere de message se adulterada em trânsito, na assinatura). */
  receivedMessage: string;
  publicKey: string;
  privateKey: string;
  keygen: OpText;
  /** Cifragem (c) ou assinatura (s). */
  forward: OpText;
  payload: string;
  receivedPayload: string;
  /** Decifragem (m') ou verificação. */
  backward: OpText;
  outcome: string;
  ok: boolean;
  tampered: boolean;
  verdictText: string;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });

function legitimateParties(scenario: RsaScenario): PartyDef[] {
  if (scenario === 'cifragem') {
    return [
      {
        id: 'alice',
        name: 'Alice',
        role: 'Remetente',
        position: 'left',
        slots: [
          { key: 'pub', label: 'Chave pública de Bob', kind: 'public' },
          { key: 'm', label: 'Mensagem m', kind: 'plain' },
          { key: 'c', label: 'Cifra c', kind: 'cipher' },
        ],
      },
      {
        id: 'bob',
        name: 'Bob',
        role: 'Destinatário',
        position: 'right',
        slots: [
          { key: 'pub', label: 'Chave pública', kind: 'public' },
          { key: 'c', label: 'Cifra recebida c', kind: 'cipher' },
          { key: 'mrec', label: "Mensagem recuperada m'", kind: 'plain' },
          { key: 'priv', label: 'Chave privada', kind: 'private' },
        ],
      },
    ];
  }
  return [
    {
      id: 'alice',
      name: 'Alice',
      role: 'Signatária',
      position: 'left',
      slots: [
        { key: 'pub', label: 'Chave pública', kind: 'public' },
        { key: 'm', label: 'Mensagem m', kind: 'plain' },
        { key: 's', label: 'Assinatura s', kind: 'signature' },
        { key: 'priv', label: 'Chave privada', kind: 'private' },
      ],
    },
    {
      id: 'bob',
      name: 'Bob',
      role: 'Verificador',
      position: 'right',
      slots: [
        { key: 'pub', label: 'Chave pública de Alice', kind: 'public' },
        { key: 'm', label: 'Mensagem recebida', kind: 'plain' },
        { key: 's', label: 'Assinatura recebida', kind: 'signature' },
        { key: 'check', label: 'Resultado da verificação', kind: 'signature' },
      ],
    },
  ];
}

/** Eva é a atacante em todos os laboratórios: observa o canal e, quando há adulteração, intercepta e altera. */
function evaParty(scenario: RsaScenario): PartyDef {
  return {
    id: 'eva',
    name: 'Eva',
    role: 'Atacante (observa e, se puder, altera o canal)',
    position: 'center',
    adversary: true,
    slots:
      scenario === 'cifragem'
        ? [
            { key: 'pub', label: 'Chave pública de Bob (observada)', kind: 'public' },
            { key: 'c', label: 'Cifra observada ou capturada', kind: 'cipher' },
            { key: 'forged', label: "Cifra alterada c' (enviada a Bob)", kind: 'cipher' },
          ]
        : [
            { key: 'pub', label: 'Chave pública de Alice (observada)', kind: 'public' },
            { key: 'm', label: 'Mensagem observada ou capturada', kind: 'plain' },
            { key: 's', label: 'Assinatura observada ou capturada', kind: 'signature' },
            { key: 'forged', label: "Mensagem alterada m' (enviada a Bob)", kind: 'plain' },
          ],
  };
}

function parties(scenario: RsaScenario): PartyDef[] {
  return [...legitimateParties(scenario), evaParty(scenario)];
}

/** Sem adulteração, Eva apenas observa; com adulteração, ela intercepta e reenvia uma versão alterada. */
function cipherTransit(d: RsaFlowData): ProtocolStep[] {
  if (!d.tampered) {
    return [
      {
        id: 'transit',
        title: 'A cifra atravessa o canal',
        description: 'Apenas a cifra c trafega pelo canal. Eva a observa, mas não obtém m sem a chave privada de Bob.',
        operation: 'Transmissão da cifra pelo canal público.',
        events: [
          {
            type: 'send',
            message: { from: 'alice', to: 'bob', label: 'Cifra c', summary: d.payload, kind: 'cipher', observers: ['eva'] },
            deliver: [],
            observerEntries: [entry('c', 'Cifra observada', d.payload, 'cipher')],
          },
        ],
      },
    ];
  }
  return [
    {
      id: 'intercept',
      title: 'Eva intercepta a cifra',
      description: 'O canal é público e Eva o controla: a cifra enviada por Alice chega a Eva, e não a Bob.',
      operation: 'Interceptação da cifra c.',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'eva', label: 'Cifra c', summary: d.payload, kind: 'cipher' },
          deliver: [entry('c', 'Cifra capturada', d.payload, 'cipher')],
        },
      ],
    },
    {
      id: 'transit',
      title: 'Eva altera a cifra e a reenvia a Bob',
      description: 'Eva modifica a cifra e a entrega a Bob como se fosse de Alice. Ela não precisa conhecer a chave privada para alterar o tráfego.',
      operation: 'Reenvio de uma cifra alterada.',
      events: [
        { type: 'set', party: 'eva', entry: entry('forged', "Cifra alterada c' (enviada a Bob)", d.receivedPayload, 'cipher') },
        {
          type: 'send',
          message: { from: 'eva', to: 'bob', label: "Cifra c'", summary: d.receivedPayload, kind: 'cipher', tampered: true },
          deliver: [],
        },
      ],
    },
  ];
}

function signatureTransit(d: RsaFlowData): ProtocolStep[] {
  if (!d.tampered) {
    return [
      {
        id: 'transit',
        title: 'Mensagem e assinatura atravessam o canal',
        description: 'A mensagem segue em claro junto com a assinatura: assinar não é cifrar, e Eva lê tudo. Mas ela não consegue alterar a mensagem sem invalidar a assinatura.',
        operation: 'Transmissão do par (m, s).',
        events: [
          {
            type: 'send',
            message: { from: 'alice', to: 'bob', label: '(m, s)', summary: `${d.message} | ${d.payload}`, kind: 'signature', observers: ['eva'] },
            deliver: [],
            observerEntries: [entry('m', 'Mensagem observada', d.message, 'plain'), entry('s', 'Assinatura observada', d.payload, 'signature')],
          },
        ],
      },
    ];
  }
  return [
    {
      id: 'intercept',
      title: 'Eva intercepta a mensagem e a assinatura',
      description: 'O par (m, s) enviado por Alice chega a Eva, e não a Bob.',
      operation: 'Interceptação do par (m, s).',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'eva', label: '(m, s)', summary: `${d.message} | ${d.payload}`, kind: 'signature' },
          deliver: [entry('m', 'Mensagem capturada', d.message, 'plain'), entry('s', 'Assinatura capturada', d.payload, 'signature')],
        },
      ],
    },
    {
      id: 'transit',
      title: 'Eva altera a mensagem e reenvia a Bob',
      description: "Eva troca m por m' e mantém a assinatura original. Sem a chave privada de Alice, ela não consegue produzir uma assinatura válida para m'.",
      operation: "Reenvio de (m', s).",
      events: [
        { type: 'set', party: 'eva', entry: entry('forged', "Mensagem alterada m' (enviada a Bob)", d.receivedMessage, 'plain') },
        {
          type: 'send',
          message: { from: 'eva', to: 'bob', label: "(m', s)", summary: `${d.receivedMessage} | ${d.receivedPayload}`, kind: 'signature', tampered: true },
          deliver: [],
        },
      ],
    },
  ];
}

function encryptionSteps(d: RsaFlowData): ProtocolStep[] {
  const didactic = d.mode === 'didatico';
  return [
    {
      id: 'gen',
      title: 'Bob gera o par de chaves',
      description: didactic
        ? 'Bob escolhe dois primos, calcula n e φ(n), escolhe e e obtém d como inverso modular de e. O par (n, e) é a chave pública e (n, d) é a privada.'
        : 'Bob gera, no próprio navegador, um par RSA com a Web Crypto API. A chave privada é criada como não extraível: nem o código desta página consegue lê-la.',
      operation: 'Geração do par de chaves RSA.',
      events: [
        {
          type: 'compute',
          operation: { party: 'bob', title: 'Geração do par de chaves', ...d.keygen, kind: 'public' },
          entry: entry('pub', 'Chave pública', d.publicKey, 'public'),
        },
        { type: 'set', party: 'bob', entry: entry('priv', 'Chave privada', d.privateKey, 'private') },
      ],
    },
    {
      id: 'publish',
      title: 'A chave pública fica disponível para Alice',
      description: 'A chave pública pode ser divulgada livremente (diretório, certificado, site). Quem a conhece (inclusive Eva) pode cifrar para Bob, mas não decifrar.',
      operation: 'Distribuição da chave pública de Bob.',
      events: [
        {
          type: 'send',
          message: { from: 'bob', to: 'alice', label: 'Chave pública', summary: d.publicKey, kind: 'public', observers: ['eva'] },
          deliver: [entry('pub', 'Chave pública de Bob', d.publicKey, 'public')],
          observerEntries: [entry('pub', 'Chave pública de Bob (observada)', d.publicKey, 'public')],
        },
      ],
    },
    {
      id: 'private-stays',
      title: 'A chave privada permanece com Bob',
      description: 'A chave privada nunca é transmitida. Toda a segurança do esquema depende de ela permanecer em poder exclusivo de Bob.',
      operation: 'Nenhum cálculo: apenas a política de guarda da chave privada.',
      events: [],
      info: ['A área protegida de Bob mostra a chave privada; nenhuma mensagem do canal a contém.'],
    },
    {
      id: 'write',
      title: 'Alice escreve a mensagem',
      description: didactic
        ? 'Alice representa a mensagem como um inteiro m tal que 0 ≤ m < n.'
        : 'Alice escreve um texto, que é convertido em bytes (UTF-8) antes de ser cifrado.',
      operation: 'Codificação da mensagem.',
      events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', d.message, 'plain') }],
    },
    {
      id: 'encrypt',
      title: 'Alice cifra com a chave pública de Bob',
      description: didactic
        ? 'Alice calcula c = m^e mod n. Sem padding, o mesmo m sempre produz o mesmo c (determinístico) e a cifra é maleável: por isso este modo é inseguro.'
        : 'Alice aplica RSA-OAEP (SHA-256, MGF1). O preenchimento aleatório torna a cifra diferente a cada execução, mesmo para a mesma mensagem.',
      operation: didactic ? 'Cifragem RSA sem padding.' : 'Cifragem RSA-OAEP.',
      events: [{ type: 'compute', operation: { party: 'alice', title: 'Cifragem', ...d.forward, kind: 'cipher' }, entry: entry('c', 'Cifra c', d.payload, 'cipher') }],
    },
    ...cipherTransit(d),
    {
      id: 'receive',
      title: 'Bob recebe a cifra',
      description: 'Bob armazena a cifra recebida e se prepara para decifrá-la com a chave privada.',
      operation: 'Recepção da mensagem cifrada.',
      events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida c', d.receivedPayload, 'cipher') }],
    },
    {
      id: 'decrypt',
      title: 'Bob decifra com a chave privada',
      description: didactic
        ? 'Bob calcula m = c^d mod n. Como e·d ≡ 1 (mod φ(n)), o resultado é a mensagem original (Teorema de Euler).'
        : 'Bob aplica RSA-OAEP na decifragem. Se a cifra foi adulterada, a verificação interna do OAEP falha e nenhuma mensagem é devolvida.',
      operation: didactic ? 'Decifragem RSA sem padding.' : 'Decifragem RSA-OAEP.',
      events: [{ type: 'compute', operation: { party: 'bob', title: 'Decifragem', ...d.backward, kind: 'plain' }, entry: entry('mrec', "Mensagem recuperada m'", d.outcome, 'plain') }],
    },
    {
      id: 'recovered',
      title: d.ok ? 'A mensagem original é recuperada' : 'A mensagem não é recuperada',
      description: d.verdictText,
      operation: 'Comparação entre a mensagem enviada e a recuperada.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
}

function signatureSteps(d: RsaFlowData): ProtocolStep[] {
  const didactic = d.mode === 'didatico';
  return [
    {
      id: 'gen',
      title: 'Alice gera o par de chaves de assinatura',
      description: didactic
        ? 'Os parâmetros são os mesmos do RSA: (n, e) é a chave pública e (n, d) a privada. Na assinatura, os papéis se invertem: a privada assina e a pública verifica.'
        : 'Alice gera um par RSA-PSS. Por boa prática, chaves de assinatura e de cifragem são pares distintos.',
      operation: 'Geração do par de chaves RSA.',
      events: [
        { type: 'compute', operation: { party: 'alice', title: 'Geração do par de chaves', ...d.keygen, kind: 'public' }, entry: entry('pub', 'Chave pública', d.publicKey, 'public') },
        { type: 'set', party: 'alice', entry: entry('priv', 'Chave privada', d.privateKey, 'private') },
      ],
    },
    {
      id: 'publish',
      title: 'A chave pública é entregue a Bob',
      description: 'Bob precisa obter a chave pública de Alice por um meio confiável (por exemplo, um certificado). Eva também a vê, o que não é problema; o risco seria Eva entregar a Bob uma chave pública dela, passando-se por Alice.',
      operation: 'Distribuição da chave pública de Alice.',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: 'Chave pública', summary: d.publicKey, kind: 'public', observers: ['eva'] },
          deliver: [entry('pub', 'Chave pública de Alice', d.publicKey, 'public')],
          observerEntries: [entry('pub', 'Chave pública de Alice (observada)', d.publicKey, 'public')],
        },
      ],
    },
    {
      id: 'write',
      title: 'Alice escreve a mensagem',
      description: 'Alice define o documento que deseja assinar.',
      operation: 'Definição da mensagem a assinar.',
      events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', d.message, 'plain') }],
    },
    {
      id: 'sign',
      title: 'Alice assina com a chave privada',
      description: didactic
        ? 'Alice calcula s = m^d mod n. Sem hash e sem padding, esta assinatura é falsificável (por exemplo, por propriedade multiplicativa); serve apenas para ilustrar a ideia.'
        : 'Alice calcula o hash SHA-256 da mensagem e o assina com RSA-PSS, que acrescenta sal aleatório: assinar duas vezes a mesma mensagem gera assinaturas diferentes, ambas válidas.',
      operation: didactic ? 'Assinatura RSA sem hash e sem padding.' : 'Assinatura RSA-PSS (SHA-256).',
      events: [{ type: 'compute', operation: { party: 'alice', title: 'Assinatura', ...d.forward, kind: 'signature' }, entry: entry('s', 'Assinatura s', d.payload, 'signature') }],
    },
    ...signatureTransit(d),
    {
      id: 'receive',
      title: 'Bob recebe a mensagem e a assinatura',
      description: 'Bob guarda o que recebeu e se prepara para verificar com a chave pública de Alice.',
      operation: 'Recepção do par (m, s).',
      events: [
        { type: 'set', party: 'bob', entry: entry('m', 'Mensagem recebida', d.receivedMessage, 'plain') },
        { type: 'set', party: 'bob', entry: entry('s', 'Assinatura recebida', d.receivedPayload, 'signature') },
      ],
    },
    {
      id: 'verify',
      title: 'Bob verifica com a chave pública de Alice',
      description: didactic
        ? 'Bob calcula s^e mod n e compara com m. A igualdade só ocorre se s foi produzida com a chave privada correspondente.'
        : 'Bob verifica a assinatura RSA-PSS sobre a mensagem recebida, usando a chave pública de Alice.',
      operation: didactic ? 'Verificação RSA sem padding.' : 'Verificação RSA-PSS.',
      events: [{ type: 'compute', operation: { party: 'bob', title: 'Verificação', ...d.backward, kind: 'signature' }, entry: entry('check', 'Resultado da verificação', d.outcome, 'signature') }],
    },
    {
      id: 'result',
      title: d.ok ? 'A assinatura é válida' : 'A assinatura é inválida',
      description: d.verdictText,
      operation: 'Conclusão da verificação.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
}

export function buildRsaProtocol(d: RsaFlowData): ProtocolDefinition {
  return {
    id: `rsa-${d.mode}-${d.scenario}`,
    title: d.scenario === 'cifragem' ? 'RSA: cifragem e decifragem' : 'RSA: assinatura digital',
    parties: parties(d.scenario),
    steps: d.scenario === 'cifragem' ? encryptionSteps(d) : signatureSteps(d),
  };
}
