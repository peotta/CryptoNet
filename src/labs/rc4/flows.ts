import type { Rc4Engine } from '../../crypto/engines';
import { toHex, utf8Decode, utf8Encode } from '../../crypto/encoding';
import { SNAP_FIRST_BYTE, WEP_IV_BYTES } from '../../crypto/rc4';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition } from '../../simulation/types';

export const MAX_BYTES = 120;

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
const hex2 = (n: number) => n.toString(16).padStart(2, '0');

// ---------------------------------------------------------------------------------------------
// Cenário 1: uso do RC4 (chave de sessão), com a opção de descartar o início do fluxo e de Eva alterar um bit.
// ---------------------------------------------------------------------------------------------
const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: 'Chave K', kind: 'secret' },
      { key: 'S', label: 'Estado S depois da KSA', kind: 'secret' },
      { key: 'm', label: 'Mensagem m', kind: 'plain' },
      { key: 'ks', label: 'Fluxo de chaves', kind: 'secret' },
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
      { key: 'ks', label: 'Fluxo de chaves', kind: 'secret' },
      { key: 'mrec', label: 'Mensagem recuperada', kind: 'plain' },
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
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

export interface Rc4FlowData {
  keyHex: string;
  message: string;
  nBytes: number;
  drop: number;
  ksHex: string;
  ctHex: string;
  receivedHex: string;
  tampered: boolean;
  tamperByte: number;
  recovered: string;
  changedBytes: number;
  ok: boolean;
  verdictText: string;
}

export interface Rc4Run {
  flow: Rc4FlowData;
}

export async function runRc4(engine: Rc4Engine, input: { key: Uint8Array; text: string; drop: 0 | 256; tamper: boolean; tamperByte: number }): Promise<Rc4Run> {
  const plain = utf8Encode(input.text);
  if (plain.length === 0) throw new Error('Digite uma mensagem.');
  if (plain.length > MAX_BYTES) throw new Error(`Use no máximo ${MAX_BYTES} bytes (a mensagem tem ${plain.length}).`);
  const ks = await engine.stream(input.key, plain.length, input.drop);
  const cipher = await engine.crypt(input.key, plain, input.drop);
  const k = Math.min(Math.max(1, Math.round(input.tamperByte)), plain.length);
  const received = cipher.slice();
  if (input.tamper) received[k - 1] ^= 0x01;
  const back = await engine.crypt(input.key, received, input.drop);
  const changedBytes = back.reduce((n, v, i) => n + (v !== plain[i] ? 1 : 0), 0);
  const verdictText = input.tamper
    ? `Eva inverteu um bit do byte ${k} da cifra, sem conhecer a chave, e Bob decifrou a mensagem com exatamente esse bit invertido (${changedBytes} byte alterado), sem perceber. O RC4 só cifra: não autentica.`
    : `Eva observa apenas bytes que parecem aleatórios. Mas o RC4 é uma cifra descontinuada: o fluxo tem vieses estatísticos (o segundo byte vale zero com o dobro da probabilidade esperada) e a chave do WEP foi quebrada por eles. ${input.drop === 256 ? 'Descartar os 256 primeiros bytes (RC4-drop[256]) elimina os vieses iniciais mais conhecidos, mas não os demais.' : 'Sem descartar o início do fluxo, os primeiros bytes são os mais enviesados.'}`;
  return {
    flow: {
      keyHex: toHex(input.key),
      message: input.text,
      nBytes: plain.length,
      drop: input.drop,
      ksHex: toHex(ks),
      ctHex: toHex(cipher),
      receivedHex: toHex(received),
      tampered: input.tamper,
      tamperByte: k,
      recovered: utf8Decode(back),
      changedBytes,
      ok: !input.tamper,
      verdictText,
    },
  };
}

export function buildRc4Protocol(d: Rc4FlowData): ProtocolDefinition {
  const transit = d.tampered
    ? [
        {
          id: 'intercept',
          title: 'Eva intercepta a cifra',
          description: 'A cifra enviada por Alice chega a Eva, e não a Bob.',
          operation: 'Interceptação da cifra.',
          events: [{ type: 'send' as const, message: { from: 'alice', to: 'eva', label: 'Cifra C', summary: short(d.ctHex), kind: 'cipher' as const }, deliver: [entry('c', 'Cifra capturada', short(d.ctHex), 'cipher')] }],
        },
        {
          id: 'flip',
          title: 'Eva inverte um bit e reenvia a Bob',
          description: `Eva faz XOR de 0x01 no byte ${d.tamperByte} da cifra. Como C = m ⊕ fluxo, o byte correspondente do claro também sofre XOR com 0x01. Eva não precisa da chave.`,
          operation: `XOR de 0x01 no byte ${d.tamperByte} da cifra.`,
          events: [
            { type: 'set' as const, party: 'eva', entry: entry('forged', "Cifra alterada C' (enviada a Bob)", short(d.receivedHex), 'cipher') },
            { type: 'send' as const, message: { from: 'eva', to: 'bob', label: "Cifra C'", summary: short(d.receivedHex), kind: 'cipher' as const, tampered: true }, deliver: [] },
          ],
        },
      ]
    : [
        {
          id: 'transit',
          title: 'A cifra atravessa o canal',
          description: 'A cifra trafega pelo canal público; Eva a lê. A chave não trafega.',
          operation: 'Transmissão da cifra.',
          events: [
            {
              type: 'send' as const,
              message: { from: 'alice', to: 'bob', label: 'C', summary: short(d.ctHex, 28), kind: 'cipher' as const, observers: ['eva'] },
              deliver: [] as Entry[],
              observerEntries: [entry('c', 'Cifra observada', short(d.ctHex), 'cipher')],
            },
          ],
        },
        {
          id: 'eva-look',
          title: 'Eva tenta ler a cifra',
          description: 'Sem a chave, Eva não gera o fluxo de chaves, e a cifra parece aleatória. Só uma análise estatística de muitas mensagens (ou o uso indevido da chave) revelaria algo.',
          operation: 'Nenhum cálculo útil sem a chave K.',
          events: [],
        },
      ];

  const ks = `${d.drop === 256 ? 'descarta 256 bytes; ' : ''}KS = ${short(d.ksHex, 24)}`;
  return {
    id: 'rc4-normal',
    title: 'RC4: Alice, Bob e Eva',
    parties,
    steps: [
      {
        id: 'key',
        title: 'Alice e Bob compartilham a chave',
        description: 'O RC4 aceita chaves de 1 a 256 bytes (as de 5 a 16 bytes são as usuais). A chave é combinada previamente por um canal seguro. O RC4 não tem nonce: a mesma chave gera sempre o mesmo fluxo.',
        operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
        events: [
          { type: 'set', party: 'alice', entry: entry('K', 'Chave K', short(d.keyHex), 'secret') },
          { type: 'set', party: 'bob', entry: entry('K', 'Chave K', short(d.keyHex), 'secret') },
        ],
      },
      {
        id: 'ksa',
        title: 'Alice embaralha o estado com a chave (KSA)',
        description: 'O estado S começa como a permutação identidade de 0 a 255. A KSA percorre i de 0 a 255, faz j = j + S[i] + K[i mod tamanho] e troca S[i] com S[j]. O resultado é uma permutação que depende da chave. A Parte A mostra cada troca.',
        operation: '256 trocas (KSA).',
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'KSA', formula: 'j = j + S[i] + K[i mod n]; troca(S[i], S[j])', substituted: `K = ${short(d.keyHex, 12)}`, result: 'S = permutação de 0..255', kind: 'secret' },
            entry: entry('S', 'Estado S depois da KSA', 'permutação de 0..255', 'secret'),
          },
        ],
      },
      {
        id: 'write',
        title: 'Alice escreve a mensagem',
        description: 'A mensagem é convertida em bytes (UTF-8).',
        operation: 'Codificação UTF-8 da mensagem.',
        events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.message), 'plain') }],
      },
      {
        id: 'prga',
        title: 'Alice gera o fluxo de chaves (PRGA)',
        description: `Para cada byte, a PRGA faz i = i + 1, j = j + S[i], troca S[i] com S[j] e emite S[(S[i] + S[j]) mod 256]. ${d.drop === 256 ? 'Os 256 primeiros bytes são descartados (RC4-drop[256]).' : 'Nenhum byte é descartado.'}`,
        operation: `Geração de ${d.nBytes} bytes de fluxo de chaves.`,
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Fluxo de chaves', formula: 'KS = PRGA(S)', substituted: `${d.nBytes} bytes`, result: ks, kind: 'secret' },
            entry: entry('ks', 'Fluxo de chaves', short(d.ksHex), 'secret'),
          },
        ],
      },
      {
        id: 'encrypt',
        title: 'Alice faz o XOR da mensagem com o fluxo',
        description: 'Cada byte da mensagem sofre XOR com o byte correspondente do fluxo de chaves, como no one-time pad, mas com um fluxo gerado e não sorteado.',
        operation: 'XOR byte a byte: C = m ⊕ KS.',
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Cifragem', formula: 'C = m ⊕ KS', substituted: `${d.nBytes} bytes`, result: `C = ${short(d.ctHex, 24)}`, kind: 'cipher' },
            entry: entry('c', 'Cifra C', short(d.ctHex), 'cipher'),
          },
        ],
      },
      ...transit,
      {
        id: 'receive',
        title: 'Bob recebe a cifra',
        description: 'Bob guarda a cifra recebida.',
        operation: 'Recepção da cifra.',
        events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedHex), 'cipher') }],
      },
      {
        id: 'bob-keystream',
        title: 'Bob gera o mesmo fluxo de chaves',
        description: 'Com a mesma chave, Bob executa a KSA e a PRGA e obtém exatamente o mesmo fluxo.',
        operation: 'KSA e PRGA com a chave K.',
        events: [
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Fluxo de chaves', formula: 'KS = PRGA(KSA(K))', substituted: `K = ${short(d.keyHex, 12)}`, result: ks, kind: 'secret' },
            entry: entry('ks', 'Fluxo de chaves', short(d.ksHex), 'secret'),
          },
        ],
      },
      {
        id: 'decrypt',
        title: 'Bob faz o XOR da cifra com o fluxo',
        description: 'O XOR é a sua própria inversa: decifrar é a mesma operação de cifrar.',
        operation: 'XOR byte a byte: m = C ⊕ KS.',
        events: [
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Decifragem', formula: 'm = C ⊕ KS', substituted: `${d.nBytes} bytes`, result: `m = ${short(d.recovered)}`, kind: 'plain' },
            entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
          },
        ],
      },
      {
        id: 'result',
        title: d.tampered ? 'Bob aceita uma mensagem alterada' : 'Eva não lê a mensagem, mas o RC4 está aposentado',
        description: d.verdictText,
        operation: 'Avaliação do resultado.',
        events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Cenário 2: WEP. A chave de cada quadro é o IV (3 bytes, em claro) seguido da chave raiz; Eva usa o ataque FMS.
// ---------------------------------------------------------------------------------------------
export interface WepByte {
  index: number;
  recovered: number;
  votes: number;
  second: number;
  secondVotes: number;
  voters: number;
  packets: number;
  correct: boolean;
}

export interface WepFlowData {
  rootHex: string;
  rootLen: number;
  payload: string;
  ivHex: string;
  frameHex: string;
  nPackets: number;
  bytes: WepByte[];
  recoveredHex: string;
  greedyOk: boolean;
  tested: number;
  found: boolean;
  decrypted: string;
  ok: boolean;
  verdictText: string;
}

export interface WepRun {
  flow: WepFlowData;
}

export const WEP_ROOT_BYTES = 5;
/** Cabeçalho LLC/SNAP que abre todo quadro IP em 802.11: AA AA 03 00 00 00. */
const SNAP = Uint8Array.of(SNAP_FIRST_BYTE, 0xaa, 0x03, 0x00, 0x00, 0x00);

export async function runWep(engine: Rc4Engine, input: { root: Uint8Array; iv: Uint8Array; payload: string }): Promise<WepRun> {
  if (input.root.length !== WEP_ROOT_BYTES) throw new Error(`A chave raiz do WEP de 40 bits tem ${WEP_ROOT_BYTES} bytes.`);
  if (input.iv.length !== WEP_IV_BYTES) throw new Error(`O IV do WEP tem ${WEP_IV_BYTES} bytes.`);
  const body = utf8Encode(input.payload);
  if (body.length === 0) throw new Error('Digite o conteúdo do quadro.');
  if (body.length > MAX_BYTES) throw new Error(`Use no máximo ${MAX_BYTES} bytes (o conteúdo tem ${body.length}).`);
  const plain = Uint8Array.from([...SNAP, ...body]);
  const key = Uint8Array.from([...input.iv, ...input.root]);
  const frame = await engine.crypt(key, plain, 0);
  const packets = await engine.wepCapture(input.root);
  const res = await engine.fms(input.root.length, packets, input.iv, plain, frame);
  const decrypted = utf8Decode((await engine.crypt(Uint8Array.from([...input.iv, ...res.key]), frame, 0)).slice(SNAP.length));
  const bytes: WepByte[] = res.bytes.map((b, i) => ({
    index: i,
    recovered: res.key[i],
    votes: b.ranking.find((r) => r.value === res.key[i])?.votes ?? 0,
    second: b.ranking[res.key[i] === b.ranking[0].value ? 1 : 0].value,
    secondVotes: b.ranking[res.key[i] === b.ranking[0].value ? 1 : 0].votes,
    voters: b.voters,
    packets: b.packets,
    correct: res.key[i] === input.root[i],
  }));
  const ok = !(res.found && res.key.every((v, i) => v === input.root[i]));
  const verdictText = res.found
    ? `Eva recuperou a chave raiz de ${res.key.length * 8} bits com ${packets.length.toLocaleString('pt-BR')} quadros, sem testar as 2^40 chaves: ${res.greedyOk ? 'o candidato mais votado de cada byte já servia' : `foi preciso testar ${res.tested.toLocaleString('pt-BR')} combinações dos três mais votados`}. Com a chave, ela lê e forja quadros da rede. O defeito é do uso do RC4 no WEP (IV curto e em claro, chave por quadro = IV mais chave raiz), explorado pelo ataque FMS (2001); o WEP foi substituído pelo WPA e pelo WPA2.`
    : 'O ataque não achou a chave com estes quadros. Na prática Eva colheria mais quadros (as ferramentas reais usam dezenas de milhares ou mais).';
  return {
    flow: {
      rootHex: toHex(input.root),
      rootLen: input.root.length,
      payload: input.payload,
      ivHex: toHex(input.iv),
      frameHex: toHex(frame),
      nPackets: packets.length,
      bytes,
      recoveredHex: toHex(res.key),
      greedyOk: res.greedyOk,
      tested: res.tested,
      found: res.found,
      decrypted,
      ok,
      verdictText,
    },
  };
}

export function buildWepProtocol(d: WepFlowData): ProtocolDefinition {
  const wepParties: PartyDef[] = [
    {
      id: 'alice',
      name: 'Alice',
      role: 'Estação (cliente Wi-Fi)',
      position: 'left',
      slots: [
        { key: 'K', label: 'Chave raiz K (40 bits)', kind: 'secret' },
        { key: 'IV', label: 'IV do quadro (24 bits, em claro)', kind: 'param' },
        { key: 'm', label: 'Quadro em claro', kind: 'plain' },
        { key: 'c', label: 'Quadro cifrado', kind: 'cipher' },
      ],
    },
    {
      id: 'bob',
      name: 'Bob',
      role: 'Ponto de acesso',
      position: 'right',
      slots: [
        { key: 'K', label: 'Chave raiz K (40 bits)', kind: 'secret' },
        { key: 'c', label: 'Quadro recebido', kind: 'cipher' },
        { key: 'mrec', label: 'Quadro recuperado', kind: 'plain' },
      ],
    },
    {
      id: 'eva',
      name: 'Eva',
      role: 'Atacante passiva (escuta o rádio)',
      position: 'center',
      adversary: true,
      slots: [
        { key: 'c', label: 'Quadros colhidos (IV e 1º byte cifrado)', kind: 'cipher' },
        { key: 'z0', label: 'Primeiro byte do fluxo (c0 ⊕ 0xAA)', kind: 'param' },
        { key: 'Kf', label: 'Chave raiz recuperada', kind: 'secret' },
        { key: 'P', label: 'Quadro lido por Eva', kind: 'plain' },
      ],
    },
  ];
  const partial = (n: number) => d.bytes.slice(0, n).map((b) => hex2(b.recovered)).join('') + '??'.repeat(d.rootLen - n);
  return {
    id: 'rc4-wep',
    title: 'WEP com RC4: Alice, Bob e Eva',
    parties: wepParties,
    steps: [
      {
        id: 'key',
        title: 'A estação e o ponto de acesso compartilham a chave raiz',
        description: 'No WEP de 40 bits, a rede toda usa uma chave de 5 bytes. Para cada quadro, a chave do RC4 é o IV de 3 bytes seguido dessa chave raiz.',
        operation: 'Nenhum cálculo: a chave raiz já é conhecida por Alice e por Bob.',
        events: [
          { type: 'set', party: 'alice', entry: entry('K', 'Chave raiz K (40 bits)', 'secreta', 'secret') },
          { type: 'set', party: 'bob', entry: entry('K', 'Chave raiz K (40 bits)', 'secreta', 'secret') },
        ],
      },
      {
        id: 'encrypt',
        title: 'Alice cifra um quadro com IV mais chave raiz',
        description: `Alice escolhe um IV de 24 bits (aqui ${d.ivHex}), forma a chave do RC4 como IV ‖ K e faz o XOR do quadro com o fluxo. Todo quadro IP começa pelo cabeçalho LLC/SNAP AA AA 03 00 00 00, que Eva conhece.`,
        operation: 'Cifragem RC4 com a chave IV ‖ K.',
        events: [
          { type: 'set', party: 'alice', entry: entry('IV', 'IV do quadro (24 bits, em claro)', d.ivHex, 'param') },
          { type: 'set', party: 'alice', entry: entry('m', 'Quadro em claro', short(`AA AA 03 00 00 00 + ${d.payload}`), 'plain') },
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Cifragem WEP', formula: 'C = quadro ⊕ RC4(IV ‖ K)', substituted: `IV = ${d.ivHex}`, result: `C = ${short(d.frameHex, 24)}`, kind: 'cipher' },
            entry: entry('c', 'Quadro cifrado', short(d.frameHex), 'cipher'),
          },
        ],
      },
      {
        id: 'transit',
        title: 'O quadro vai pelo ar, com o IV em claro',
        description: 'O IV precisa viajar sem cifra para que o ponto de acesso monte a mesma chave. Eva escuta todos os quadros: vê o IV e o texto cifrado.',
        operation: 'Transmissão do IV e do quadro cifrado.',
        events: [
          {
            type: 'send',
            message: { from: 'alice', to: 'bob', label: 'IV, C', summary: `IV = ${d.ivHex}; C = ${short(d.frameHex, 24)}`, kind: 'cipher', observers: ['eva'] },
            deliver: [entry('c', 'Quadro recebido', short(d.frameHex), 'cipher')],
            observerEntries: [entry('c', 'Quadros colhidos (IV e 1º byte cifrado)', `1 quadro (IV = ${d.ivHex})`, 'cipher')],
          },
        ],
      },
      {
        id: 'bob-decrypt',
        title: 'Bob decifra o quadro',
        description: 'O ponto de acesso monta a mesma chave IV ‖ K e faz o XOR.',
        operation: 'Decifragem RC4 com a chave IV ‖ K.',
        events: [
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Decifragem WEP', formula: 'quadro = C ⊕ RC4(IV ‖ K)', substituted: `IV = ${d.ivHex}`, result: `quadro = ${short(d.payload, 20)}`, kind: 'plain' },
            entry: entry('mrec', 'Quadro recuperado', short(d.payload), 'plain'),
          },
        ],
      },
      {
        id: 'eva-collect',
        title: 'Eva colhe quadros com IV fracos',
        description: `Como o IV tem só 24 bits e muda a cada quadro, valores da forma (B+3, 255, X) aparecem com frequência. Eva guarda ${d.nPackets.toLocaleString('pt-BR')} quadros assim, ${d.nPackets / d.rootLen} para cada byte da chave raiz.`,
        operation: `Coleta de ${d.nPackets.toLocaleString('pt-BR')} quadros (IV e primeiro byte cifrado).`,
        events: [{ type: 'set', party: 'eva', entry: entry('c', 'Quadros colhidos (IV e 1º byte cifrado)', `${d.nPackets.toLocaleString('pt-BR')} quadros`, 'cipher') }],
      },
      {
        id: 'eva-z0',
        title: 'Eva obtém o primeiro byte do fluxo de cada quadro',
        description: 'O primeiro byte do claro é sempre 0xAA (cabeçalho SNAP). Logo, o primeiro byte do fluxo de chaves é c0 ⊕ 0xAA. É um texto claro conhecido: Eva não precisa adivinhar nada.',
        operation: 'XOR do primeiro byte cifrado com 0xAA.',
        events: [
          {
            type: 'compute',
            operation: { party: 'eva', title: 'Primeiro byte do fluxo', formula: 'z0 = c0 ⊕ 0xAA', substituted: `${d.nPackets.toLocaleString('pt-BR')} quadros`, result: 'um byte de fluxo por quadro', kind: 'param' },
            entry: entry('z0', 'Primeiro byte do fluxo (c0 ⊕ 0xAA)', 'um por quadro', 'param'),
          },
        ],
      },
      ...d.bytes.map((b) => ({
        id: `eva-byte-${b.index + 1}`,
        title: `Eva descobre o byte ${b.index + 1} da chave raiz`,
        description: `Com os ${b.index + 3} primeiros bytes da chave do RC4 conhecidos (3 do IV e ${b.index} já descobertos), Eva simula ${b.index + 3} passos da KSA para cada quadro com IV (${b.index + 3}, 255, X). Em cerca de 5% deles, o primeiro byte do fluxo revela o próximo byte da chave: K[${b.index + 3}] = S⁻¹[z0] − j − S[${b.index + 3}]. Dos ${b.packets} quadros, ${b.voters} satisfazem a condição e votam. Cada voto indica um valor; o mais votado vence.`,
        operation: `Votação para o byte ${b.index + 1} (${b.voters} votos).`,
        events: [
          {
            type: 'compute' as const,
            operation: {
              party: 'eva',
              title: `Byte ${b.index + 1} da chave`,
              formula: 'K[B] = S⁻¹[z0] − j − S[B]',
              substituted: `${b.voters} votos entre ${b.packets} quadros`,
              result: `0x${hex2(b.recovered)} com ${b.votes} votos (segundo: 0x${hex2(b.second)} com ${b.secondVotes})`,
              kind: 'secret' as const,
            },
            entry: entry('Kf', 'Chave raiz recuperada', partial(b.index + 1), 'secret'),
          },
        ],
      })),
      {
        id: 'eva-verify',
        title: 'Eva confere a chave e lê o quadro',
        description: d.found
          ? `Eva testa a chave ${d.greedyOk ? 'formada pelos mais votados' : 'em combinações dos três mais votados'} no quadro capturado, cujo cabeçalho ela conhece. Servindo, ela decifra o quadro inteiro.`
          : 'Nenhuma combinação dos três mais votados decifrou o quadro de conferência.',
        operation: 'Decifragem do quadro com a chave recuperada.',
        events: d.found
          ? [
              {
                type: 'compute',
                operation: { party: 'eva', title: 'Leitura do quadro', formula: 'quadro = C ⊕ RC4(IV ‖ K recuperada)', substituted: `K = ${d.recoveredHex}`, result: `quadro = ${short(d.decrypted, 20)}`, kind: 'plain' },
                entry: entry('P', 'Quadro lido por Eva', short(d.decrypted), 'plain'),
              },
            ]
          : [],
      },
      {
        id: 'result',
        title: d.ok ? 'O ataque não achou a chave' : 'O WEP caiu: a chave raiz foi recuperada',
        description: d.verdictText,
        operation: 'Avaliação do resultado.',
        events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
      },
    ],
  };
}
