import { abbreviateHex } from '../../crypto/encoding';
import type { HashAlgo } from '../../crypto/hash';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

/** Valores do fluxo de autenticação por HMAC (hexadecimal completo; a exibição é abreviada aqui). */
export interface HmacFlowData {
  algo: HashAlgo;
  keyText: string;
  blockBytes: number;
  keyBytes: number;
  keyWasHashed: boolean;
  message: string;
  receivedMessage: string;
  innerHex: string;
  tagHex: string;
  recomputedHex: string;
  tampered: boolean;
  ok: boolean;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (hex: string) => abbreviateHex(hex, 10);
const quote = (t: string) => `"${t.length > 30 ? `${t.slice(0, 30)}…` : t}"`;

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: 'Chave compartilhada K', kind: 'secret' },
      { key: 'm', label: 'Mensagem m', kind: 'plain' },
      { key: 'inner', label: 'Hash interno', kind: 'param' },
      { key: 'tag', label: 'Etiqueta HMAC', kind: 'signature' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Verificador',
    position: 'right',
    slots: [
      { key: 'K', label: 'Chave compartilhada K', kind: 'secret' },
      { key: 'm', label: 'Mensagem recebida', kind: 'plain' },
      { key: 'tag', label: 'Etiqueta recebida', kind: 'signature' },
      { key: 'tag2', label: 'Etiqueta recalculada', kind: 'signature' },
      { key: 'res', label: 'Resultado da comparação', kind: 'param' },
    ],
  },
];

export function buildHmacProtocol(d: HmacFlowData): ProtocolDefinition {
  const H = d.algo;
  const keyNote = d.keyWasHashed
    ? `A chave tem ${d.keyBytes} bytes, mais que o bloco de ${d.blockBytes}: K' = ${H}(K), completada com zeros.`
    : `A chave tem ${d.keyBytes} bytes, menos que o bloco de ${d.blockBytes}: K' = K completada com zeros à direita.`;
  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob compartilham a chave K',
      description:
        'O HMAC é um mecanismo de chave simétrica: os dois participantes já possuem a mesma chave K, obtida antes por outro meio (por exemplo, um Diffie-Hellman seguido de HKDF). Quem não conhece K não consegue produzir etiquetas válidas.',
      operation: 'Nenhum cálculo: K já é conhecida por ambos e não trafega pelo canal.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Chave compartilhada K', d.keyText, 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Chave compartilhada K', d.keyText, 'secret') },
      ],
      info: [keyNote],
    },
    {
      id: 'write',
      title: 'Alice escolhe a mensagem',
      description: 'Alice define a mensagem que deseja enviar com garantia de integridade e de autenticidade da origem.',
      operation: 'Definição da mensagem m.',
      events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', d.message, 'plain') }],
    },
    {
      id: 'inner',
      title: 'Alice calcula o hash interno',
      description: `Alice aplica ${H} à concatenação de (K' XOR ipad) com a mensagem. O ipad é o byte 0x36 repetido até completar o bloco.`,
      operation: `hash interno = ${H}((K' ⊕ ipad) ‖ m).`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: 'Passagem interna do HMAC',
            formula: "interno = H((K' ⊕ ipad) ‖ m)",
            substituted: `interno = ${H}((K' ⊕ 0x36…36) ‖ ${quote(d.message)})`,
            result: `interno = ${short(d.innerHex)}`,
            kind: 'param',
          },
          entry: entry('inner', 'Hash interno', short(d.innerHex), 'param'),
        },
      ],
    },
    {
      id: 'outer',
      title: 'Alice calcula a etiqueta (hash externo)',
      description: `Alice aplica ${H} à concatenação de (K' XOR opad) com o hash interno. O opad é o byte 0x5c repetido. O resultado é a etiqueta de autenticação (tag).`,
      operation: `tag = ${H}((K' ⊕ opad) ‖ hash interno).`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: 'Passagem externa do HMAC',
            formula: "tag = H((K' ⊕ opad) ‖ interno)",
            substituted: `tag = ${H}((K' ⊕ 0x5c…5c) ‖ ${short(d.innerHex)})`,
            result: `tag = ${short(d.tagHex)}`,
            kind: 'signature',
          },
          entry: entry('tag', 'Etiqueta HMAC', short(d.tagHex), 'signature'),
        },
      ],
      info: ['A estrutura em duas passagens impede o ataque de extensão de comprimento, que afeta H(K ‖ m) calculado de forma ingênua.'],
    },
    {
      id: 'transit',
      title: 'A mensagem e a etiqueta atravessam o canal',
      description: d.tampered
        ? 'Um atacante altera a mensagem em trânsito. Como ele não conhece K, não consegue recalcular a etiqueta: ela segue inalterada.'
        : 'A mensagem segue em claro e acompanhada da etiqueta. O HMAC não cifra: ele garante integridade e autenticidade, não sigilo.',
      operation: 'Transmissão do par (m, tag).',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: '(m, tag)', summary: `${quote(d.receivedMessage)} | ${short(d.tagHex)}`, kind: 'signature', tampered: d.tampered },
          deliver: [],
        },
      ],
    },
    {
      id: 'receive',
      title: 'Bob recebe a mensagem e a etiqueta',
      description: 'Bob guarda o que recebeu. Ele ainda não sabe se a mensagem é íntegra: precisa recalcular a etiqueta com a sua cópia de K.',
      operation: 'Recepção de (m, tag).',
      events: [
        { type: 'set', party: 'bob', entry: entry('m', 'Mensagem recebida', d.receivedMessage, 'plain') },
        { type: 'set', party: 'bob', entry: entry('tag', 'Etiqueta recebida', short(d.tagHex), 'signature') },
      ],
    },
    {
      id: 'recompute',
      title: 'Bob recalcula a etiqueta sobre a mensagem recebida',
      description: 'Bob repete exatamente o mesmo cálculo de duas passagens, usando a chave K e a mensagem que de fato recebeu.',
      operation: "tag' = HMAC(K, m recebida).",
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Recálculo do HMAC',
            formula: "tag' = HMAC(K, m)",
            substituted: `tag' = HMAC-${H}(K, ${quote(d.receivedMessage)})`,
            result: `tag' = ${short(d.recomputedHex)}`,
            kind: 'signature',
          },
          entry: entry('tag2', 'Etiqueta recalculada', short(d.recomputedHex), 'signature'),
        },
      ],
    },
    {
      id: 'compare',
      title: d.ok ? 'As etiquetas coincidem: mensagem autêntica' : 'As etiquetas diferem: mensagem rejeitada',
      description: d.ok
        ? 'tag = tag\': a mensagem não foi alterada e foi produzida por quem conhece K. Na prática, a comparação deve ser em tempo constante, para não vazar informação por temporização.'
        : 'tag ≠ tag\': a mensagem (ou a etiqueta) foi alterada. Bob a descarta. Sem K, o atacante não consegue produzir uma etiqueta válida para a mensagem alterada.',
      operation: "Comparação em tempo constante entre tag e tag'.",
      events: [
        { type: 'set', party: 'bob', entry: entry('res', 'Resultado da comparação', d.ok ? 'iguais: aceita' : 'diferentes: rejeitada', 'param') },
        {
          type: 'verdict',
          verdict: {
            ok: d.ok,
            text: d.ok ? 'Mensagem autêntica e íntegra: as etiquetas HMAC coincidem.' : 'Falha de autenticação: as etiquetas HMAC são diferentes e a mensagem foi rejeitada.',
          },
        },
      ],
    },
  ];
  return { id: `hmac-${d.algo}`, title: 'HMAC: autenticação de mensagem', parties, steps };
}
