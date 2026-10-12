import { abbreviateHex } from '../../crypto/encoding';
import type { AesMode } from '../../crypto/aes';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

/** Valores já calculados (pelos motores) que alimentam as etapas animadas. */
export interface AesFlowData {
  mode: AesMode;
  keyBits: number;
  keyHex: string;
  /** IV (CBC, 16 bytes) ou nonce (CTR e GCM, 12 bytes); vazio no ECB. */
  ivHex: string;
  message: string;
  nBlocks: number;
  ctHex: string;
  receivedCtHex: string;
  tagHex: string;
  tampered: boolean;
  tamperBlock: number;
  recovered: string | null;
  /** Etiqueta de autenticação inválida (somente GCM). */
  authFailed: boolean;
  ok: boolean;
  /** Descrição dos padrões que Eva enxerga nos blocos cifrados. */
  pattern: string;
  verdictText: string;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (hex: string) => abbreviateHex(hex, 8);
const quote = (t: string) => `"${t.length > 24 ? `${t.slice(0, 24)}…` : t}"`;

const MODE_FORMULA: Record<AesMode, { enc: string; dec: string }> = {
  ECB: { enc: 'C_{i} = E_{K}(P_{i})', dec: 'P_{i} = D_{K}(C_{i})' },
  CBC: { enc: 'C_{i} = E_{K}(P_{i} ⊕ C_{i-1}),  C_{0} = IV', dec: 'P_{i} = D_{K}(C_{i}) ⊕ C_{i-1},  C_{0} = IV' },
  CTR: { enc: 'C_{i} = P_{i} ⊕ E_{K}(nonce ‖ i)', dec: 'P_{i} = C_{i} ⊕ E_{K}(nonce ‖ i)' },
  GCM: { enc: '(C, tag) = GCM-Cifrar(K, nonce, P)', dec: 'P = GCM-Decifrar(K, nonce, C, tag)' },
};

const MODE_NOTE: Record<AesMode, string> = {
  ECB: 'No ECB cada bloco é cifrado de forma independente: blocos de texto claro iguais geram blocos cifrados iguais, e os padrões da mensagem vazam.',
  CBC: 'No CBC cada bloco de texto claro é combinado (XOR) com o bloco cifrado anterior; o IV aleatório torna a cifra diferente a cada mensagem.',
  CTR: 'No CTR o AES gera um fluxo de chaves a partir de nonce e contador, e o XOR com o texto claro produz a cifra: um modo de cifra de fluxo.',
  GCM: 'O GCM combina o CTR com uma etiqueta de autenticação (GHASH): garante sigilo, integridade e autenticidade (criptografia autenticada, AEAD).',
};

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: 'Chave K', kind: 'secret' },
      { key: 'm', label: 'Mensagem m', kind: 'plain' },
      { key: 'iv', label: 'IV ou nonce', kind: 'param' },
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
      { key: 'mrec', label: 'Resultado da decifragem', kind: 'plain' },
    ],
  },
  {
    id: 'eva',
    name: 'Eva',
    role: 'Atacante (observa e, se puder, altera o canal)',
    position: 'center',
    adversary: true,
    slots: [
      { key: 'c', label: 'Cifra observada ou capturada', kind: 'cipher' },
      { key: 'pattern', label: 'Padrões nos blocos cifrados', kind: 'param' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
      { key: 'K', label: 'Chave K: desconhecida para Eva', kind: 'secret' },
    ],
  },
];

function transitSteps(d: AesFlowData): ProtocolStep[] {
  const label = d.mode === 'ECB' ? 'C' : d.mode === 'GCM' ? '(nonce, C, tag)' : '(IV, C)';
  const summary = (hex: string) => `${short(hex)}${d.tagHex ? ` + tag ${short(d.tagHex)}` : ''}`;
  const patternEntry = entry('pattern', 'Padrões nos blocos cifrados', d.pattern, 'param');
  if (!d.tampered) {
    return [
      {
        id: 'transit',
        title: 'A cifra atravessa o canal',
        description:
          'Alice envia a cifra' + (d.ivHex ? ` e o ${d.mode === 'CBC' ? 'IV' : 'nonce'} (que não é secreto)` : '') + '. Eva lê tudo o que passa pelo canal e analisa os blocos cifrados em busca de padrões, mas não conhece a chave K.',
        operation: 'Transmissão da cifra pelo canal público.',
        events: [
          {
            type: 'send',
            message: { from: 'alice', to: 'bob', label, summary: summary(d.ctHex), kind: 'cipher', observers: ['eva'] },
            deliver: [],
            observerEntries: [entry('c', 'Cifra observada', short(d.ctHex), 'cipher'), patternEntry],
          },
        ],
      },
    ];
  }
  return [
    {
      id: 'intercept',
      title: 'Eva intercepta a cifra',
      description: 'A cifra enviada por Alice chega a Eva, e não a Bob. Eva também analisa os padrões dos blocos.',
      operation: 'Interceptação da cifra.',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'eva', label, summary: summary(d.ctHex), kind: 'cipher' },
          deliver: [entry('c', 'Cifra capturada', short(d.ctHex), 'cipher'), patternEntry],
        },
      ],
    },
    {
      id: 'transit',
      title: `Eva inverte 1 bit do bloco ${d.tamperBlock} e reenvia a Bob`,
      description:
        'Eva não conhece K e não decifra nada, mas pode alterar bits do texto cifrado. O que acontece depois depende do modo de operação: é por isso que o modo importa.',
      operation: `Inversão de 1 bit no bloco cifrado ${d.tamperBlock} e reenvio.`,
      events: [
        { type: 'set', party: 'eva', entry: entry('forged', "Cifra alterada C' (enviada a Bob)", short(d.receivedCtHex), 'cipher') },
        {
          type: 'send',
          message: { from: 'eva', to: 'bob', label: label.replace('C', "C'"), summary: summary(d.receivedCtHex), kind: 'cipher', tampered: true },
          deliver: [],
        },
      ],
    },
  ];
}

export function buildAesProtocol(d: AesFlowData): ProtocolDefinition {
  const ivName = d.mode === 'CBC' ? 'IV' : 'nonce';
  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob compartilham a chave K',
      description: `A criptografia simétrica exige que os dois participantes já possuam a mesma chave (por exemplo, derivada de um Diffie-Hellman com HKDF). Aqui a chave tem ${d.keyBits} bits. Eva não a conhece.`,
      operation: 'Nenhum cálculo: K já é conhecida por Alice e por Bob e nunca trafega.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Chave K', short(d.keyHex), 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Chave K', short(d.keyHex), 'secret') },
      ],
    },
    {
      id: 'write',
      title: 'Alice escreve a mensagem',
      description: `A mensagem é dividida em ${d.nBlocks} blocos de 16 bytes (128 bits), o tamanho do bloco do AES. O texto é completado com espaços apenas para fechar o último bloco (neste laboratório, para dispensar o preenchimento padronizado).`,
      operation: 'Divisão da mensagem em blocos de 16 bytes.',
      events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', quote(d.message), 'plain') }],
    },
    ...(d.mode === 'ECB'
      ? []
      : [
          {
            id: 'iv',
            title: `Alice gera ${d.mode === 'CBC' ? 'um IV' : 'um nonce'} aleatório`,
            description: `O ${ivName} não é secreto, mas precisa ser imprevisível (CBC) ou nunca repetido com a mesma chave (CTR e GCM). Repetir um nonce no CTR ou no GCM é uma falha grave: revela o XOR dos textos claros.`,
            operation: `Sorteio do ${ivName} com gerador criptograficamente seguro.`,
            events: [{ type: 'set' as const, party: 'alice', entry: entry('iv', ivName === 'IV' ? 'IV (16 bytes)' : 'Nonce (12 bytes)', short(d.ivHex), 'param') }],
          },
        ]),
    {
      id: 'encrypt',
      title: `Alice cifra com AES-${d.keyBits} no modo ${d.mode}`,
      description: MODE_NOTE[d.mode],
      operation: `Cifragem AES-${d.keyBits}-${d.mode}.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: `Cifragem AES-${d.mode}`,
            formula: MODE_FORMULA[d.mode].enc,
            substituted: `${d.nBlocks} blocos de 16 bytes, chave de ${d.keyBits} bits${d.ivHex ? `, ${ivName} = ${short(d.ivHex)}` : ''}`,
            result: `C = ${short(d.ctHex)}${d.tagHex ? ` e tag = ${short(d.tagHex)}` : ''}`,
            kind: 'cipher',
          },
          entry: entry('c', 'Cifra C', short(d.ctHex), 'cipher'),
        },
      ],
    },
    ...transitSteps(d),
    {
      id: 'receive',
      title: 'Bob recebe a cifra',
      description: `Bob guarda a cifra${d.ivHex ? ` e o ${ivName}` : ''}${d.tagHex ? ' e a etiqueta' : ''} recebidos.`,
      operation: 'Recepção da mensagem cifrada.',
      events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedCtHex), 'cipher') }],
    },
    {
      id: 'decrypt',
      title: d.mode === 'GCM' ? 'Bob verifica a etiqueta e decifra' : 'Bob decifra com a chave K',
      description:
        d.mode === 'GCM'
          ? 'O GCM só entrega o texto claro se a etiqueta de autenticação conferir. Qualquer alteração na cifra, no nonce ou nos dados autenticados faz a operação falhar por inteiro.'
          : 'Bob aplica a operação inversa. Nada nesta operação verifica se a cifra foi alterada: o modo não oferece integridade.',
      operation: d.mode === 'GCM' ? 'Verificação da etiqueta e decifragem AES-GCM.' : `Decifragem AES-${d.keyBits}-${d.mode}.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Decifragem',
            formula: MODE_FORMULA[d.mode].dec,
            substituted: `${d.nBlocks} blocos de 16 bytes${d.mode === 'GCM' ? ', etiqueta recebida' : ''}`,
            result: d.authFailed ? 'ERRO: etiqueta de autenticação inválida' : `P = ${quote(d.recovered ?? '')}`,
            kind: 'plain',
          },
          entry: entry('mrec', 'Resultado da decifragem', d.authFailed ? 'rejeitada: etiqueta inválida' : quote(d.recovered ?? ''), 'plain'),
        },
      ],
    },
    {
      id: 'result',
      title: d.ok ? 'A mensagem original é recuperada' : d.authFailed ? 'A mensagem é rejeitada' : 'A mensagem chega alterada, sem que Bob perceba',
      description: d.verdictText,
      operation: 'Comparação entre a mensagem enviada e a recuperada.',
      events: [{ type: 'verdict', verdict: { ok: d.ok || d.authFailed, text: d.verdictText } }],
    },
  ];
  return { id: `aes-${d.mode}-${d.keyBits}`, title: `AES-${d.mode}: cifragem de mensagens`, parties, steps };
}
