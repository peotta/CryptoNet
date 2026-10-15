import type { ChaChaEngine } from '../../crypto/engines';
import { toHex, utf8Decode, utf8Encode } from '../../crypto/encoding';
import { xorBytes } from '../../crypto/chacha20';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition } from '../../simulation/types';

export const MAX_BYTES = 120;
export const COUNTER = 1;

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
/** Texto legível de bytes: caracteres não imprimíveis viram "·". */
export const printable = (b: Uint8Array): string => [...b].map((x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : '·')).join('');

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: 'Chave K (256 bits)', kind: 'secret' },
      { key: 'N', label: 'Nonce N (96 bits)', kind: 'param' },
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
      { key: 'K', label: 'Chave K (256 bits)', kind: 'secret' },
      { key: 'N', label: 'Nonce N (96 bits)', kind: 'param' },
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
      { key: 'X', label: 'C1 ⊕ C2 (= m1 ⊕ m2)', kind: 'param' },
      { key: 'P', label: 'Trecho deduzido por Eva', kind: 'plain' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// Cenário 1: uso correto (nonce único), com a opção de Eva alterar um bit da cifra.
// ---------------------------------------------------------------------------------------------
export interface ChaChaFlowData {
  keyHex: string;
  nonceHex: string;
  message: string;
  nBytes: number;
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

export interface ChaChaRun {
  flow: ChaChaFlowData;
  plain: Uint8Array;
  keystream: Uint8Array;
  cipher: Uint8Array;
}

export async function runChaCha(
  engine: ChaChaEngine,
  input: { key: Uint8Array; nonce: Uint8Array; text: string; tamper: boolean; tamperByte: number },
): Promise<ChaChaRun> {
  const plain = utf8Encode(input.text);
  if (plain.length === 0) throw new Error('Digite uma mensagem.');
  if (plain.length > MAX_BYTES) throw new Error(`Use no máximo ${MAX_BYTES} bytes (a mensagem tem ${plain.length}).`);
  const keystream = await engine.crypt(input.key, input.nonce, COUNTER, new Uint8Array(plain.length)); // XOR com zeros expõe o fluxo
  const cipher = xorBytes(plain, keystream);
  const k = Math.min(Math.max(1, Math.round(input.tamperByte)), plain.length);
  const received = new Uint8Array(cipher);
  if (input.tamper) received[k - 1] ^= 0x01;
  const recoveredBytes = await engine.crypt(input.key, input.nonce, COUNTER, received);
  const recovered = utf8Decode(recoveredBytes);
  const changedBytes = recoveredBytes.reduce((n, v, i) => n + (v !== plain[i] ? 1 : 0), 0);
  const verdictText = input.tamper
    ? `Eva inverteu um bit do byte ${k} da cifra, sem conhecer a chave, e Bob decifrou a mensagem com exatamente esse bit invertido (${changedBytes} byte alterado), sem perceber. O ChaCha20 sozinho não autentica: é preciso um código de autenticação (Poly1305, no ChaCha20-Poly1305).`
    : 'Eva observa apenas bytes que parecem aleatórios. Sem a chave, o fluxo de chaves é indistinguível de uma sequência aleatória, e a cifra não revela o texto. Mas isso só vale se o par (chave, nonce) nunca se repetir.';
  return {
    plain,
    keystream,
    cipher,
    flow: {
      keyHex: toHex(input.key),
      nonceHex: toHex(input.nonce),
      message: input.text,
      nBytes: plain.length,
      ksHex: toHex(keystream),
      ctHex: toHex(cipher),
      receivedHex: toHex(received),
      tampered: input.tamper,
      tamperByte: k,
      recovered,
      changedBytes,
      ok: !input.tamper,
      verdictText,
    },
  };
}

export function buildChaChaProtocol(d: ChaChaFlowData): ProtocolDefinition {
  const transit = d.tampered
    ? [
        {
          id: 'intercept',
          title: 'Eva intercepta a cifra',
          description: 'A cifra enviada por Alice chega a Eva, e não a Bob.',
          operation: 'Interceptação da cifra.',
          events: [
            {
              type: 'send' as const,
              message: { from: 'alice', to: 'eva', label: 'Cifra C', summary: short(d.ctHex), kind: 'cipher' as const },
              deliver: [entry('c', 'Cifra capturada', short(d.ctHex), 'cipher')],
            },
          ],
        },
        {
          id: 'flip',
          title: 'Eva inverte um bit e reenvia a Bob',
          description: `Eva faz XOR de 0x01 no byte ${d.tamperByte} da cifra. Como a cifra é C = m ⊕ fluxo, o byte correspondente do texto claro também sofre XOR com 0x01. Eva não precisa da chave.`,
          operation: `XOR de 0x01 no byte ${d.tamperByte} da cifra.`,
          events: [
            { type: 'set' as const, party: 'eva', entry: entry('forged', "Cifra alterada C' (enviada a Bob)", short(d.receivedHex), 'cipher') },
            {
              type: 'send' as const,
              message: { from: 'eva', to: 'bob', label: "Cifra C'", summary: short(d.receivedHex), kind: 'cipher' as const, tampered: true },
              deliver: [],
            },
          ],
        },
      ]
    : [
        {
          id: 'transit',
          title: 'A cifra atravessa o canal',
          description: 'A cifra e o nonce trafegam pelo canal público; Eva os lê. A chave não trafega.',
          operation: 'Transmissão da cifra e do nonce.',
          events: [
            {
              type: 'send' as const,
              message: { from: 'alice', to: 'bob', label: 'N, C', summary: `N = ${d.nonceHex}; C = ${short(d.ctHex, 16)}`, kind: 'cipher' as const, observers: ['eva'] },
              deliver: [],
              observerEntries: [entry('c', 'Cifra observada', short(d.ctHex), 'cipher')],
            },
          ],
        },
        {
          id: 'eva-look',
          title: 'Eva tenta ler a cifra',
          description:
            'Sem a chave, Eva não consegue gerar o fluxo de chaves. A cifra parece uma sequência aleatória de bytes: não há frequência de letras nem padrão a explorar, ao contrário das cifras clássicas.',
          operation: 'Nenhum cálculo útil: o fluxo de chaves depende da chave K, que Eva não tem.',
          events: [],
        },
      ];

  return {
    id: 'chacha20-normal',
    title: 'ChaCha20: Alice, Bob e Eva',
    parties,
    steps: [
      {
        id: 'key',
        title: 'Alice e Bob compartilham a chave',
        description: 'A chave de 256 bits é combinada previamente por um canal seguro (ou derivada, como no Diffie-Hellman). O nonce de 96 bits é público, mas não pode se repetir com a mesma chave.',
        operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
        events: [
          { type: 'set', party: 'alice', entry: entry('K', 'Chave K (256 bits)', short(d.keyHex), 'secret') },
          { type: 'set', party: 'bob', entry: entry('K', 'Chave K (256 bits)', short(d.keyHex), 'secret') },
        ],
      },
      {
        id: 'nonce',
        title: 'Alice escolhe um nonce novo',
        description: 'Para cada mensagem, Alice usa um nonce diferente (um contador ou um valor aleatório de 96 bits) e o envia junto com a cifra.',
        operation: 'Escolha de um nonce de 96 bits.',
        events: [{ type: 'set', party: 'alice', entry: entry('N', 'Nonce N (96 bits)', d.nonceHex, 'param') }],
      },
      {
        id: 'write',
        title: 'Alice escreve a mensagem',
        description: 'A mensagem é convertida em bytes (UTF-8).',
        operation: 'Codificação UTF-8 da mensagem.',
        events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.message), 'plain') }],
      },
      {
        id: 'keystream',
        title: 'Alice gera o fluxo de chaves',
        description: 'A função de bloco do ChaCha20 (20 rodadas ARX) transforma a chave, o nonce e o contador em blocos de 64 bytes pseudoaleatórios. O contador começa em 1 e aumenta a cada bloco.',
        operation: `Geração de ${d.nBytes} bytes de fluxo de chaves.`,
        events: [
          {
            type: 'compute',
            operation: {
              party: 'alice',
              title: 'Fluxo de chaves',
              formula: 'KS = ChaCha20(K, N, contador = 1, 2, ...)',
              substituted: `K = ${short(d.keyHex, 12)}, N = ${d.nonceHex}`,
              result: `KS = ${short(d.ksHex, 24)}`,
              kind: 'secret',
            },
            entry: entry('ks', 'Fluxo de chaves', short(d.ksHex), 'secret'),
          },
        ],
      },
      {
        id: 'encrypt',
        title: 'Alice faz o XOR da mensagem com o fluxo',
        description: 'Cada byte da mensagem sofre XOR com o byte correspondente do fluxo de chaves. É a mesma ideia do one-time pad, mas com um fluxo pseudoaleatório gerado de uma chave curta.',
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
        title: 'Bob recebe a cifra e o nonce',
        description: 'Bob guarda a cifra recebida e o nonce.',
        operation: 'Recepção da cifra e do nonce.',
        events: [
          { type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedHex), 'cipher') },
          { type: 'set', party: 'bob', entry: entry('N', 'Nonce N (96 bits)', d.nonceHex, 'param') },
        ],
      },
      {
        id: 'bob-keystream',
        title: 'Bob gera o mesmo fluxo de chaves',
        description: 'Com a mesma chave, o mesmo nonce e o mesmo contador, Bob obtém exatamente o mesmo fluxo de chaves.',
        operation: 'Geração do fluxo de chaves.',
        events: [
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Fluxo de chaves', formula: 'KS = ChaCha20(K, N, contador = 1, 2, ...)', substituted: `K = ${short(d.keyHex, 12)}, N = ${d.nonceHex}`, result: `KS = ${short(d.ksHex, 24)}`, kind: 'secret' },
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
        title: d.tampered ? 'Bob aceita uma mensagem alterada' : 'Eva não lê a mensagem',
        description: d.verdictText,
        operation: 'Avaliação do resultado.',
        events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Cenário 2: Alice reutiliza o nonce (o "two-time pad" do ChaCha20).
// ---------------------------------------------------------------------------------------------
export interface CribRow {
  offset: number;
  fragment: string;
  /** Todos os bytes do fragmento são caracteres de texto (letras, dígitos, espaço e pontuação comum). */
  readable: boolean;
  real: boolean;
}

export interface ReuseFlowData {
  nonceHex: string;
  m1: string;
  m2: string;
  nCommon: number;
  c1Hex: string;
  c2Hex: string;
  xorHex: string;
  crib: string;
  cribIn: 1 | 2;
  realOffset: number;
  readableCount: number;
  recoveredFragment: string;
  other: 1 | 2;
  ok: boolean;
  verdictText: string;
}

export interface ReuseRun {
  flow: ReuseFlowData;
  rows: CribRow[];
}

const isText = (x: number) => (x >= 0x41 && x <= 0x5a) || (x >= 0x61 && x <= 0x7a) || (x >= 0x30 && x <= 0x39) || x === 0x20 || x === 0x2c || x === 0x2e;

export async function runReuse(
  engine: ChaChaEngine,
  input: { key: Uint8Array; nonce: Uint8Array; text1: string; text2: string; crib: string; cribIn: 1 | 2 },
): Promise<ReuseRun> {
  const p1 = utf8Encode(input.text1);
  const p2 = utf8Encode(input.text2);
  if (p1.length === 0 || p2.length === 0) throw new Error('Digite as duas mensagens.');
  if (p1.length > MAX_BYTES || p2.length > MAX_BYTES) throw new Error(`Use no máximo ${MAX_BYTES} bytes em cada mensagem.`);
  const cribBytes = utf8Encode(input.crib);
  if (cribBytes.length < 3) throw new Error('O texto provável deve ter ao menos 3 caracteres.');
  const n = Math.min(p1.length, p2.length);
  if (cribBytes.length > n) throw new Error(`O texto provável (${cribBytes.length} bytes) é maior que a parte comum das mensagens (${n} bytes).`);
  // Alice usa o MESMO par (chave, nonce, contador) nas duas mensagens: erro grave.
  const c1 = await engine.crypt(input.key, input.nonce, COUNTER, p1);
  const c2 = await engine.crypt(input.key, input.nonce, COUNTER, p2);
  const x = xorBytes(c1.slice(0, n), c2.slice(0, n));
  const own = input.cribIn === 1 ? p1 : p2;
  const realOffset = (() => {
    const at = utf8Decode(own).indexOf(input.crib);
    return at < 0 ? -1 : utf8Encode(utf8Decode(own).slice(0, at)).length;
  })();
  const rows: CribRow[] = [];
  for (let off = 0; off + cribBytes.length <= n; off++) {
    const frag = xorBytes(x.slice(off, off + cribBytes.length), cribBytes);
    rows.push({ offset: off, fragment: printable(frag), readable: [...frag].every(isText), real: off === realOffset });
  }
  const readableCount = rows.filter((r) => r.readable).length;
  const real = rows.find((r) => r.real);
  const other: 1 | 2 = input.cribIn === 1 ? 2 : 1;
  const recoveredFragment = real?.fragment ?? '';
  const found = !!real && real.readable;
  const verdictText = found
    ? `O texto provável "${input.crib}" aparece na mensagem ${input.cribIn} a partir do byte ${realOffset + 1}, e o mesmo trecho da mensagem ${other} sai legível: "${recoveredFragment}". Eva obteve ainda ${cribBytes.length} bytes do fluxo de chaves (C ⊕ texto provável), com os quais pode estender o ataque. Nenhuma chave foi descoberta, mas a reutilização do nonce destruiu o sigilo.`
    : realOffset < 0
      ? `O texto provável "${input.crib}" não está na mensagem ${input.cribIn}, então nenhuma posição produz um trecho coerente de forma confiável: ${readableCount} posições parecem legíveis por acaso. Eva precisa de um palpite melhor, mas o vazamento continua: C1 ⊕ C2 = m1 ⊕ m2.`
      : `O trecho da mensagem ${other} não ficou legível nesta posição. Tente outro texto provável.`;
  return {
    rows,
    flow: {
      nonceHex: toHex(input.nonce),
      m1: input.text1,
      m2: input.text2,
      nCommon: n,
      c1Hex: toHex(c1),
      c2Hex: toHex(c2),
      xorHex: toHex(x),
      crib: input.crib,
      cribIn: input.cribIn,
      realOffset,
      readableCount,
      recoveredFragment,
      other,
      ok: !found,
      verdictText,
    },
  };
}

export function buildReuseProtocol(d: ReuseFlowData): ProtocolDefinition {
  return {
    id: 'chacha20-reuso',
    title: 'ChaCha20 com nonce reutilizado: Alice, Bob e Eva',
    parties,
    steps: [
      {
        id: 'key',
        title: 'Alice e Bob compartilham a chave',
        description: 'Chave de 256 bits conhecida somente por Alice e Bob.',
        operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
        events: [
          { type: 'set', party: 'alice', entry: entry('K', 'Chave K (256 bits)', 'secreta', 'secret') },
          { type: 'set', party: 'bob', entry: entry('K', 'Chave K (256 bits)', 'secreta', 'secret') },
        ],
      },
      {
        id: 'nonce',
        title: 'Alice usa o mesmo nonce nas duas mensagens (erro)',
        description: 'Por descuido, Alice não troca o nonce: as duas mensagens usarão o mesmo fluxo de chaves. É o erro que o ChaCha20, o AES-CTR e o AES-GCM não perdoam.',
        operation: 'Reutilização do nonce.',
        events: [{ type: 'set', party: 'alice', entry: entry('N', 'Nonce N (96 bits)', d.nonceHex, 'param') }],
      },
      {
        id: 'enc1',
        title: 'Alice cifra a mensagem 1',
        description: 'C1 = m1 ⊕ KS.',
        operation: 'XOR da mensagem 1 com o fluxo de chaves.',
        events: [
          { type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.m1), 'plain') },
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Cifragem da mensagem 1', formula: 'C1 = m1 ⊕ KS', substituted: `${d.m1.length} caracteres`, result: `C1 = ${short(d.c1Hex, 24)}`, kind: 'cipher' },
            entry: entry('c', 'Cifra C', `C1 = ${short(d.c1Hex, 20)}`, 'cipher'),
          },
        ],
      },
      {
        id: 'enc2',
        title: 'Alice cifra a mensagem 2 com o mesmo fluxo',
        description: 'C2 = m2 ⊕ KS, com o MESMO KS. Eis o erro.',
        operation: 'XOR da mensagem 2 com o mesmo fluxo de chaves.',
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Cifragem da mensagem 2', formula: 'C2 = m2 ⊕ KS', substituted: `${d.m2.length} caracteres`, result: `C2 = ${short(d.c2Hex, 24)}`, kind: 'cipher' },
            entry: entry('c', 'Cifra C', `C2 = ${short(d.c2Hex, 20)}`, 'cipher'),
          },
        ],
      },
      {
        id: 'transit',
        title: 'As duas cifras atravessam o canal',
        description: 'Alice envia C1 e C2 com o mesmo nonce. Eva captura ambas.',
        operation: 'Transmissão das duas cifras.',
        events: [
          {
            type: 'send',
            message: { from: 'alice', to: 'bob', label: 'N, C1, C2', summary: `N = ${d.nonceHex}; C1, C2`, kind: 'cipher', observers: ['eva'] },
            deliver: [],
            observerEntries: [entry('c', 'Cifras observadas', `C1 = ${short(d.c1Hex, 12)}, C2 = ${short(d.c2Hex, 12)}`, 'cipher')],
          },
        ],
      },
      {
        id: 'eva-xor',
        title: 'Eva faz o XOR das duas cifras',
        description: 'C1 ⊕ C2 = (m1 ⊕ KS) ⊕ (m2 ⊕ KS) = m1 ⊕ m2. O fluxo de chaves se cancela: Eva passa a lidar com a relação entre dois textos em linguagem natural, sem nenhuma chave.',
        operation: 'XOR de C1 com C2 (o fluxo de chaves cancela).',
        events: [
          {
            type: 'compute',
            operation: { party: 'eva', title: 'XOR das cifras', formula: 'C1 ⊕ C2 = m1 ⊕ m2', substituted: `${d.nCommon} bytes em comum`, result: `X = ${short(d.xorHex, 24)}`, kind: 'param' },
            entry: entry('X', 'C1 ⊕ C2 (= m1 ⊕ m2)', short(d.xorHex), 'param'),
          },
        ],
      },
      {
        id: 'eva-crib',
        title: 'Eva arrasta um texto provável',
        description: `Eva supõe que "${d.crib}" aparece na mensagem ${d.cribIn}. Em cada posição, faz o XOR desse texto com X: onde o palpite está certo, o trecho correspondente da mensagem ${d.other} aparece legível.`,
        operation: 'XOR do texto provável com X em cada posição (arrasto).',
        events: [
          {
            type: 'compute',
            operation: {
              party: 'eva',
              title: 'Arrasto do texto provável',
              formula: 'trecho = X[i..] ⊕ texto provável',
              substituted: `texto provável = "${short(d.crib, 16)}"`,
              result: d.realOffset >= 0 ? `posição ${d.realOffset + 1}: "${short(d.recoveredFragment, 20)}"` : 'nenhuma posição coerente',
              kind: 'plain',
            },
            ...(d.recoveredFragment ? { entry: entry('P', 'Trecho deduzido por Eva', short(d.recoveredFragment), 'plain') } : {}),
          },
        ],
      },
      {
        id: 'bob-decrypt',
        title: 'Bob decifra normalmente',
        description: 'Bob, com a chave e o nonce, recupera as duas mensagens sem notar problema algum.',
        operation: 'Decifragem das duas mensagens.',
        events: [
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Decifragem', formula: 'm = C ⊕ KS', substituted: 'C1 e C2', result: `m1 = ${short(d.m1, 16)}`, kind: 'plain' },
            entry: entry('mrec', 'Mensagem recuperada', short(d.m1), 'plain'),
          },
        ],
      },
      {
        id: 'result',
        title: d.ok ? 'O palpite de Eva não rendeu nesta tentativa' : 'A reutilização do nonce destruiu o sigilo',
        description: d.verdictText,
        operation: 'Avaliação do resultado.',
        events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
      },
    ],
  };
}
