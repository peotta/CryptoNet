import type { DesEngine } from '../../crypto/engines';
import { bytesToBits, candidateKey, effectiveBits, hammingBits, pkcs7Pad, type Bits } from '../../crypto/des';
import { toHex, utf8Decode, utf8Encode } from '../../crypto/encoding';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition } from '../../simulation/types';

export const MAX_BYTES = 40;

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
/** Texto legível de bytes: caracteres não imprimíveis viram "·". */
export const printable = (b: Uint8Array): string => [...b].map((x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : '·')).join('');
const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

/** Tempo em unidades legíveis (segundos, minutos, horas, dias ou anos). */
export function humanTime(seconds: number): string {
  const f = (v: number, u: string) => `${v >= 100 ? Math.round(v).toLocaleString('pt-BR') : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${u}`;
  if (seconds < 1) return 'menos de 1 segundo';
  if (seconds < 120) return f(seconds, 'segundos');
  if (seconds < 7200) return f(seconds / 60, 'minutos');
  if (seconds < 172800) return f(seconds / 3600, 'horas');
  if (seconds < 86400 * 730) return f(seconds / 86400, 'dias');
  return f(seconds / (86400 * 365.25), 'anos');
}

const secretSlot = { key: 'K', label: 'Chave K (56 bits úteis)', kind: 'secret' as const };

function parties(kind: 'cbc' | 'brute' | 'tdes'): PartyDef[] {
  const keys =
    kind === 'tdes'
      ? [
          { key: 'K1', label: 'Chave K1', kind: 'secret' as const },
          { key: 'K2', label: 'Chave K2', kind: 'secret' as const },
          { key: 'K3', label: 'Chave K3', kind: 'secret' as const },
        ]
      : [secretSlot];
  return [
    {
      id: 'alice',
      name: 'Alice',
      role: 'Remetente',
      position: 'left',
      slots: [...keys, { key: 'IV', label: 'Vetor de inicialização IV (64 bits)', kind: 'param' }, { key: 'm', label: 'Mensagem m', kind: 'plain' }, { key: 'c', label: 'Cifra C (blocos de 64 bits)', kind: 'cipher' }],
    },
    {
      id: 'bob',
      name: 'Bob',
      role: 'Destinatário',
      position: 'right',
      slots: [...keys, { key: 'IV', label: 'Vetor de inicialização IV', kind: 'param' }, { key: 'c', label: 'Cifra recebida', kind: 'cipher' }, { key: 'mrec', label: 'Mensagem recuperada', kind: 'plain' }],
    },
    {
      id: 'eva',
      name: 'Eva',
      role: 'Atacante (observa e, se puder, altera o canal)',
      position: 'center',
      adversary: true,
      slots:
        kind === 'brute'
          ? [
              { key: 'c', label: 'Cifra e IV observados', kind: 'cipher' },
              { key: 'P1', label: 'Primeiro bloco do claro (conhecido)', kind: 'plain' },
              { key: 'X', label: 'Entrada da cifra: P1 ⊕ IV', kind: 'param' },
              { key: 'Kf', label: 'Chave encontrada', kind: 'secret' },
              { key: 'P', label: 'Mensagem lida por Eva', kind: 'plain' },
            ]
          : [
              { key: 'c', label: 'Cifra e IV observados', kind: 'cipher' },
              { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
            ],
    },
  ];
}

const sendCipher = (d: { ivHex: string; ctHex: string }, observers: string[] = ['eva']) =>
  ({
    type: 'send' as const,
    message: { from: 'alice', to: 'bob', label: 'IV, C', summary: `IV = ${d.ivHex}; C = ${short(d.ctHex, 24)}`, kind: 'cipher' as const, observers },
    deliver: [] as Entry[],
    observerEntries: [entry('c', 'Cifra e IV observados', `IV = ${d.ivHex}; C = ${short(d.ctHex, 20)}`, 'cipher')],
  });

// ---------------------------------------------------------------------------------------------
// Cenário 1: DES no modo CBC, com a opção de Eva inverter um bit da cifra.
// ---------------------------------------------------------------------------------------------
export interface DesFlowData {
  keyHex: string;
  ivHex: string;
  message: string;
  nBytes: number;
  nBlocks: number;
  ctHex: string;
  receivedHex: string;
  tampered: boolean;
  tamperBlock: number;
  recovered: string;
  paddingOk: boolean;
  /** Bits diferentes (de 64) entre cada bloco recuperado por Bob e o original. */
  blockDiffs: number[];
  ok: boolean;
  verdictText: string;
}

export interface DesRun {
  flow: DesFlowData;
  plain: Uint8Array;
  cipher: Uint8Array;
}

export async function runDes(engine: DesEngine, input: { key: Uint8Array; iv: Uint8Array; text: string; tamper: boolean; tamperBlock: number }): Promise<DesRun> {
  const plain = utf8Encode(input.text);
  if (plain.length === 0) throw new Error('Digite uma mensagem.');
  if (plain.length > MAX_BYTES) throw new Error(`Use no máximo ${MAX_BYTES} bytes (a mensagem tem ${plain.length}).`);
  const blocks = await engine.cbcEncrypt([input.key], input.iv, plain);
  const cipher = concat(blocks.map((b) => b.cipher));
  const n = blocks.length;
  const k = Math.min(Math.max(1, Math.round(input.tamperBlock)), n);
  const received = cipher.slice();
  if (input.tamper) received[(k - 1) * 8] ^= 0x01;
  const dec = await engine.cbcDecrypt([input.key], input.iv, received);
  const padded = pkcs7Pad(plain);
  const blockDiffs = Array.from({ length: n }, (_, i) => hammingBits(bytesToBits(dec.raw.slice(8 * i, 8 * i + 8)), bytesToBits(padded.slice(8 * i, 8 * i + 8))));
  const recovered = dec.plain ? utf8Decode(dec.plain) : printable(dec.raw);
  const verdictText = input.tamper
    ? k < n
      ? `Eva inverteu um bit do bloco cifrado ${k}, sem conhecer a chave. No CBC, Bob recebeu o bloco ${k} destruído (${blockDiffs[k - 1]} de 64 bits diferentes, resultado imprevisível) e o bloco ${k + 1} com ${blockDiffs[k]} bit invertido, exatamente na mesma posição do bit que Eva alterou. Ela corrompe um bloco para mudar de forma dirigida o seguinte. O DES-CBC não autentica: é preciso um código de autenticação (HMAC ou um modo AEAD).`
      : `Eva inverteu um bit do último bloco cifrado. Bob recebeu esse bloco destruído (${blockDiffs[k - 1]} de 64 bits diferentes)${dec.plain ? '' : ' e o preenchimento ficou inválido, o que denuncia a alteração'}. Mesmo quando algo é detectado, foi por acaso: o CBC não autentica.`
    : 'Eva observa o IV e blocos de 64 bits que parecem aleatórios. Sem a chave, ela não lê a mensagem. Porém a chave do DES tem só 56 bits úteis, e esse sigilo vale apenas enquanto a busca exaustiva for inviável, o que hoje não é verdade (veja o cenário seguinte).';
  return {
    plain,
    cipher,
    flow: { keyHex: toHex(input.key), ivHex: toHex(input.iv), message: input.text, nBytes: plain.length, nBlocks: n, ctHex: toHex(cipher), receivedHex: toHex(received), tampered: input.tamper, tamperBlock: k, recovered, paddingOk: dec.plain !== null, blockDiffs, ok: !input.tamper, verdictText },
  };
}

export function buildDesProtocol(d: DesFlowData): ProtocolDefinition {
  const transit = d.tampered
    ? [
        {
          id: 'intercept',
          title: 'Eva intercepta a cifra',
          description: 'A cifra enviada por Alice chega a Eva, e não a Bob.',
          operation: 'Interceptação do IV e da cifra.',
          events: [{ ...sendCipher(d, []), message: { from: 'alice', to: 'eva', label: 'IV, C', summary: `IV = ${d.ivHex}; C = ${short(d.ctHex, 24)}`, kind: 'cipher' as const }, deliver: [entry('c', 'Cifra e IV capturados', `IV = ${d.ivHex}; C = ${short(d.ctHex, 20)}`, 'cipher')], observerEntries: undefined }],
        },
        {
          id: 'flip',
          title: 'Eva inverte um bit e reenvia a Bob',
          description: `Eva faz XOR de 0x01 no primeiro byte do bloco cifrado ${d.tamperBlock}. Na decifragem CBC, o bloco ${d.tamperBlock} é decifrado pelo DES (e fica irreconhecível), e o mesmo bit é invertido no bloco seguinte, pois o bloco cifrado alterado entra no XOR dele.`,
          operation: `XOR de 0x01 no primeiro byte do bloco cifrado ${d.tamperBlock}.`,
          events: [
            { type: 'set' as const, party: 'eva', entry: entry('forged', "Cifra alterada C' (enviada a Bob)", short(d.receivedHex), 'cipher') },
            { type: 'send' as const, message: { from: 'eva', to: 'bob', label: "IV, C'", summary: `IV = ${d.ivHex}; C' = ${short(d.receivedHex, 24)}`, kind: 'cipher' as const, tampered: true }, deliver: [] },
          ],
        },
      ]
    : [
        { id: 'transit', title: 'A cifra atravessa o canal', description: 'O IV e a cifra trafegam pelo canal público; Eva os lê. A chave não trafega.', operation: 'Transmissão do IV e da cifra.', events: [sendCipher(d)] },
        {
          id: 'eva-look',
          title: 'Eva tenta ler a cifra',
          description: 'Sem a chave, Eva vê blocos de 64 bits sem padrão. Como o modo é CBC, blocos iguais do claro não geram blocos iguais na cifra. O que a protege é só o tamanho da chave, e 56 bits são pouco.',
          operation: 'Nenhum cálculo útil sem a chave K.',
          events: [],
        },
      ];

  return {
    id: 'des-cbc',
    title: 'DES em CBC: Alice, Bob e Eva',
    parties: parties('cbc'),
    steps: [
      {
        id: 'key',
        title: 'Alice e Bob compartilham a chave',
        description: 'A chave do DES tem 64 bits, dos quais 8 são de paridade: restam 56 bits úteis. É combinada previamente por um canal seguro.',
        operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
        events: [
          { type: 'set', party: 'alice', entry: entry('K', 'Chave K (56 bits úteis)', short(d.keyHex), 'secret') },
          { type: 'set', party: 'bob', entry: entry('K', 'Chave K (56 bits úteis)', short(d.keyHex), 'secret') },
        ],
      },
      {
        id: 'iv',
        title: 'Alice escolhe um IV novo',
        description: 'No CBC, o primeiro bloco do claro sofre XOR com um vetor de inicialização de 64 bits, imprevisível e diferente a cada mensagem. O IV é público e viaja com a cifra.',
        operation: 'Escolha de um IV de 64 bits.',
        events: [{ type: 'set', party: 'alice', entry: entry('IV', 'Vetor de inicialização IV (64 bits)', d.ivHex, 'param') }],
      },
      {
        id: 'write',
        title: 'Alice escreve a mensagem e a completa',
        description: `A mensagem (${d.nBytes} bytes) é dividida em blocos de 8 bytes. O último é completado pelo preenchimento PKCS#7: cada byte acrescentado vale o número de bytes acrescentados (sempre há ao menos um). Resultam ${d.nBlocks} blocos.`,
        operation: 'Codificação UTF-8 e preenchimento PKCS#7.',
        events: [{ type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.message), 'plain') }],
      },
      {
        id: 'encrypt',
        title: 'Alice cifra bloco a bloco em CBC',
        description: 'Para cada bloco: C(i) = DES(K, P(i) ⊕ C(i-1)), com C(0) = IV. Cada bloco cifrado depende de todos os anteriores.',
        operation: `${d.nBlocks} cifragens DES de 16 rodadas, encadeadas.`,
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Cifragem CBC', formula: 'C(i) = DES_K(P(i) ⊕ C(i-1))', substituted: `K = ${short(d.keyHex, 8)}, IV = ${d.ivHex}`, result: `C = ${short(d.ctHex, 24)}`, kind: 'cipher' },
            entry: entry('c', 'Cifra C (blocos de 64 bits)', short(d.ctHex), 'cipher'),
          },
        ],
      },
      ...transit,
      {
        id: 'receive',
        title: 'Bob recebe o IV e a cifra',
        description: 'Bob guarda o IV e a cifra recebida.',
        operation: 'Recepção do IV e da cifra.',
        events: [
          { type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedHex), 'cipher') },
          { type: 'set', party: 'bob', entry: entry('IV', 'Vetor de inicialização IV', d.ivHex, 'param') },
        ],
      },
      {
        id: 'decrypt',
        title: 'Bob decifra bloco a bloco',
        description: 'P(i) = DES⁻¹(K, C(i)) ⊕ C(i-1). O DES decifra com as mesmas rodadas, usando as subchaves em ordem inversa. Depois Bob retira o preenchimento.',
        operation: `${d.nBlocks} decifragens DES e XOR com o bloco cifrado anterior.`,
        events: [
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Decifragem CBC', formula: 'P(i) = DES⁻¹_K(C(i)) ⊕ C(i-1)', substituted: `K = ${short(d.keyHex, 8)}, IV = ${d.ivHex}`, result: `m = ${short(d.recovered)}`, kind: 'plain' },
            entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
          },
        ],
      },
      {
        id: 'result',
        title: d.tampered ? 'Bob aceita uma mensagem alterada' : 'Eva não lê a mensagem (por enquanto)',
        description: d.verdictText,
        operation: 'Avaliação do resultado.',
        events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Cenário 2: Eva testa todas as chaves possíveis (em escala didática).
// ---------------------------------------------------------------------------------------------
export interface BruteFlowData {
  ivHex: string;
  message: string;
  nBlocks: number;
  keyHex: string;
  ctHex: string;
  knownHex: string;
  knownText: string;
  xHex: string;
  c1Hex: string;
  unknownBits: number;
  space: number;
  tries: number;
  ms: number;
  rate: number;
  foundHex: string | null;
  recovered: string;
  /** Estimativas (em segundos) para a chave inteira de 56 bits: busca média = 2^55 chaves. */
  secondsHere: number;
  secondsEff: number;
  ok: boolean;
  verdictText: string;
}

export interface BruteRun {
  flow: BruteFlowData;
}

/** Chaves testadas por segundo pela máquina de 1999 (EFF e distributed.net): mais de 240 bilhões. */
export const EFF_RATE = 240e9;

export async function runBrute(
  engine: DesEngine,
  input: { baseKey: Uint8Array; iv: Uint8Array; text: string; unknownBits: number; secret: number },
): Promise<BruteRun> {
  const plain = utf8Encode(input.text);
  if (plain.length < 8) throw new Error('A mensagem deve ter ao menos 8 bytes (Eva conhece o primeiro bloco).');
  if (plain.length > MAX_BYTES) throw new Error(`Use no máximo ${MAX_BYTES} bytes (a mensagem tem ${plain.length}).`);
  const n = input.unknownBits;
  if (!Number.isInteger(n) || n < 1 || n > 20) throw new Error('Use de 1 a 20 bits desconhecidos.');
  const base: Bits = effectiveBits(input.baseKey);
  const secret = Math.min(Math.max(0, Math.floor(input.secret)), 2 ** n - 1);
  const key = candidateKey(base, n, secret);
  const blocks = await engine.cbcEncrypt([key], input.iv, plain);
  const cipher = concat(blocks.map((b) => b.cipher));
  const known = plain.slice(0, 8);
  const x = blocks[0].mixed; // P1 ⊕ IV: a entrada do DES no primeiro bloco
  const found = await engine.search(x, blocks[0].cipher, base, n);
  const dec = found.key ? await engine.cbcDecrypt([found.key], input.iv, cipher) : null;
  const recovered = dec ? (dec.plain ? utf8Decode(dec.plain) : printable(dec.raw)) : '';
  const total = 2 ** 55; // média de uma busca em 2^56 chaves
  const secondsHere = total / found.rate;
  const secondsEff = total / EFF_RATE;
  const ok = !found.key;
  const verdictText = found.key
    ? `Eva encontrou a chave testando ${found.tries.toLocaleString('pt-BR')} de ${found.space.toLocaleString('pt-BR')} candidatas e leu a mensagem inteira. Aqui só ${n} bits eram desconhecidos. Na chave inteira de 56 bits o espaço é ${(2 ** 56 / found.space).toLocaleString('pt-BR')} vezes maior: a projeção para este navegador está na tabela de resultados, e a máquina da EFF com a rede distributed.net (1999) acabaria em ${humanTime(secondsEff)} em média. Hoje, com circuitos dedicados ou em nuvem, é uma questão de horas ou dias. Por isso o DES foi aposentado.`
    : 'Nenhuma chave do espaço de busca cifra o bloco conhecido para a cifra observada.';
  return {
    flow: {
      ivHex: toHex(input.iv),
      message: input.text,
      nBlocks: blocks.length,
      keyHex: toHex(key),
      ctHex: toHex(cipher),
      knownHex: toHex(known),
      knownText: printable(known),
      xHex: toHex(x),
      c1Hex: toHex(blocks[0].cipher),
      unknownBits: n,
      space: found.space,
      tries: found.tries,
      ms: found.ms,
      rate: found.rate,
      foundHex: found.key ? toHex(found.key) : null,
      recovered,
      secondsHere,
      secondsEff,
      ok,
      verdictText,
    },
  };
}

export function buildBruteProtocol(d: BruteFlowData): ProtocolDefinition {
  return {
    id: 'des-forca-bruta',
    title: 'DES: Eva testa todas as chaves',
    parties: parties('brute'),
    steps: [
      {
        id: 'key',
        title: 'Alice e Bob compartilham uma chave de poucos bits',
        description: `Para a busca caber no navegador, a chave de Alice tem apenas ${d.unknownBits} bits desconhecidos para Eva (por exemplo, derivada de uma senha curta). Os demais bits úteis são fixos e Eva os conhece. Na chave de verdade seriam 56 bits.`,
        operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
        events: [
          { type: 'set', party: 'alice', entry: entry('K', 'Chave K (56 bits úteis)', short(d.keyHex), 'secret') },
          { type: 'set', party: 'bob', entry: entry('K', 'Chave K (56 bits úteis)', short(d.keyHex), 'secret') },
        ],
      },
      {
        id: 'encrypt',
        title: 'Alice cifra a mensagem em CBC',
        description: `Alice escolhe o IV e cifra a mensagem (${d.nBlocks} blocos). A mensagem começa por um cabeçalho que Eva conhece ("${d.knownText}").`,
        operation: 'Cifragem DES-CBC.',
        events: [
          { type: 'set', party: 'alice', entry: entry('IV', 'Vetor de inicialização IV (64 bits)', d.ivHex, 'param') },
          { type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.message), 'plain') },
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Cifragem CBC', formula: 'C(i) = DES_K(P(i) ⊕ C(i-1))', substituted: `IV = ${d.ivHex}`, result: `C = ${short(d.ctHex, 24)}`, kind: 'cipher' },
            entry: entry('c', 'Cifra C (blocos de 64 bits)', short(d.ctHex), 'cipher'),
          },
        ],
      },
      { id: 'transit', title: 'A cifra atravessa o canal', description: 'Eva captura o IV e a cifra.', operation: 'Transmissão do IV e da cifra.', events: [sendCipher(d)] },
      {
        id: 'receive',
        title: 'Bob recebe e decifra',
        description: 'Bob decifra normalmente com a chave que compartilha com Alice.',
        operation: 'Decifragem DES-CBC.',
        events: [
          { type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.ctHex), 'cipher') },
          { type: 'set', party: 'bob', entry: entry('IV', 'Vetor de inicialização IV', d.ivHex, 'param') },
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Decifragem CBC', formula: 'P(i) = DES⁻¹_K(C(i)) ⊕ C(i-1)', substituted: `K = ${short(d.keyHex, 8)}`, result: `m = ${short(d.message, 20)}`, kind: 'plain' },
            entry: entry('mrec', 'Mensagem recuperada', short(d.message), 'plain'),
          },
        ],
      },
      {
        id: 'eva-known',
        title: 'Eva usa o cabeçalho que conhece',
        description: 'Eva sabe como a mensagem começa (um cabeçalho de protocolo, uma saudação). Isso é o ataque de texto claro conhecido: um par (claro, cifra) basta para reconhecer a chave certa.',
        operation: 'Texto claro conhecido: primeiros 8 bytes.',
        events: [{ type: 'set', party: 'eva', entry: entry('P1', 'Primeiro bloco do claro (conhecido)', `${d.knownText} (${d.knownHex})`, 'plain') }],
      },
      {
        id: 'eva-target',
        title: 'Eva calcula a entrada do DES no primeiro bloco',
        description: 'No CBC o primeiro bloco cifrado é C(1) = DES(K, P(1) ⊕ IV). Eva conhece P(1), o IV e C(1), então sabe qual bloco entra no DES e qual deve sair. Falta achar a chave.',
        operation: 'XOR de P(1) com o IV.',
        events: [
          {
            type: 'compute',
            operation: { party: 'eva', title: 'Entrada da cifra', formula: 'X = P(1) ⊕ IV', substituted: `${d.knownHex} ⊕ ${d.ivHex}`, result: `X = ${d.xHex}`, kind: 'param' },
            entry: entry('X', 'Entrada da cifra: P1 ⊕ IV', d.xHex, 'param'),
          },
        ],
      },
      {
        id: 'eva-search',
        title: `Eva testa as ${d.space.toLocaleString('pt-BR')} chaves possíveis`,
        description: `Para cada candidata, Eva calcula DES(K', X) e compara com C(1) = ${d.c1Hex}. Cada teste tem 16 rodadas. ${d.foundHex ? `Ela parou na tentativa ${d.tries.toLocaleString('pt-BR')}.` : 'Nenhuma candidata serviu.'}`,
        operation: `Até ${d.space.toLocaleString('pt-BR')} cifragens DES de um bloco.`,
        events: [
          {
            type: 'compute',
            operation: {
              party: 'eva',
              title: 'Busca exaustiva',
              formula: "procura K' tal que DES(K', X) = C(1)",
              substituted: `${d.space.toLocaleString('pt-BR')} candidatas (${d.unknownBits} bits)`,
              result: d.foundHex ? `K = ${d.foundHex} (${d.tries.toLocaleString('pt-BR')} testes)` : 'não encontrada',
              kind: 'secret',
            },
            ...(d.foundHex ? { entry: entry('Kf', 'Chave encontrada', d.foundHex, 'secret') } : {}),
          },
        ],
      },
      {
        id: 'eva-decrypt',
        title: 'Eva decifra a mensagem inteira',
        description: 'Com a chave, Eva decifra todos os blocos exatamente como Bob.',
        operation: 'Decifragem DES-CBC com a chave encontrada.',
        events: d.foundHex
          ? [
              {
                type: 'compute',
                operation: { party: 'eva', title: 'Decifragem pela atacante', formula: 'P(i) = DES⁻¹_K(C(i)) ⊕ C(i-1)', substituted: `K = ${short(d.foundHex, 8)}`, result: `m = ${short(d.recovered, 20)}`, kind: 'plain' },
                entry: entry('P', 'Mensagem lida por Eva', short(d.recovered), 'plain'),
              },
            ]
          : [],
      },
      {
        id: 'result',
        title: d.ok ? 'A busca não encontrou a chave' : 'O DES não resiste à busca exaustiva',
        description: d.verdictText,
        operation: 'Avaliação do resultado.',
        events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Cenário 3: Triple DES (EDE).
// ---------------------------------------------------------------------------------------------
export type TdesKeying = 'tres' | 'duas' | 'igual';

export interface TdesFlowData {
  keying: TdesKeying;
  k1Hex: string;
  k2Hex: string;
  k3Hex: string;
  ivHex: string;
  message: string;
  nBlocks: number;
  ctHex: string;
  mixedHex: string;
  afterE1: string;
  afterD2: string;
  afterE3: string;
  recovered: string;
  /** O resultado coincide com o do DES simples (só quando K1 = K2 = K3). */
  sameAsDes: boolean;
  strength: string;
  ok: boolean;
  verdictText: string;
}

export interface TdesRun {
  flow: TdesFlowData;
}

export async function runTdes(engine: DesEngine, input: { k1: Uint8Array; k2: Uint8Array; k3: Uint8Array; iv: Uint8Array; text: string; keying: TdesKeying }): Promise<TdesRun> {
  const plain = utf8Encode(input.text);
  if (plain.length === 0) throw new Error('Digite uma mensagem.');
  if (plain.length > MAX_BYTES) throw new Error(`Use no máximo ${MAX_BYTES} bytes (a mensagem tem ${plain.length}).`);
  const k1 = input.k1;
  const k2 = input.keying === 'igual' ? k1 : input.k2;
  const k3 = input.keying === 'tres' ? input.k3 : k1;
  const blocks = await engine.cbcEncrypt([k1, k2, k3], input.iv, plain);
  const cipher = concat(blocks.map((b) => b.cipher));
  const st = await engine.tdesStages(k1, k2, k3, blocks[0].mixed);
  const dec = await engine.cbcDecrypt([k1, k2, k3], input.iv, cipher);
  const recovered = dec.plain ? utf8Decode(dec.plain) : printable(dec.raw);
  const single = await engine.cbcEncrypt([k1], input.iv, plain);
  const sameAsDes = concat(single.map((b) => b.cipher)).every((v, i) => v === cipher[i]);
  const strength = input.keying === 'tres' ? '112 bits (ataque do encontro no meio)' : input.keying === 'duas' ? '80 bits (SP 800-57)' : '56 bits (equivale ao DES)';
  const verdictText =
    input.keying === 'igual'
      ? `Com K1 = K2 = K3, o passo D(K2, ·) desfaz o E(K1, ·) e o Triple DES equivale ao DES simples (a cifra coincide: ${sameAsDes ? 'sim' : 'não'}). Foi assim que o TDEA manteve a compatibilidade com o DES. A segurança continua a de 56 bits.`
      : `Bob recuperou a mensagem. O Triple DES triplica o trabalho por bloco e leva a chave a ${input.keying === 'tres' ? '168 bits armazenados, com segurança efetiva de 112 bits: o ataque do encontro no meio (meet-in-the-middle) reduz o custo de 2^168 para cerca de 2^112' : '112 bits armazenados, com segurança de 80 bits segundo o SP 800-57'}. Mesmo assim o bloco continua de 64 bits: depois de cerca de 2^32 blocos com a mesma chave, o paradoxo do aniversário permite recuperar texto claro (ataque Sweet32). Por isso o 3DES foi retirado pelo NIST em 2024.`;
  return {
    flow: {
      keying: input.keying,
      k1Hex: toHex(k1),
      k2Hex: toHex(k2),
      k3Hex: toHex(k3),
      ivHex: toHex(input.iv),
      message: input.text,
      nBlocks: blocks.length,
      ctHex: toHex(cipher),
      mixedHex: toHex(blocks[0].mixed),
      afterE1: toHex(st.afterE1),
      afterD2: toHex(st.afterD2),
      afterE3: toHex(st.afterE3),
      recovered,
      sameAsDes,
      strength,
      ok: true,
      verdictText,
    },
  };
}

export function buildTdesProtocol(d: TdesFlowData): ProtocolDefinition {
  const keySets = (party: 'alice' | 'bob') => [
    { type: 'set' as const, party, entry: entry('K1', 'Chave K1', short(d.k1Hex, 16), 'secret') },
    { type: 'set' as const, party, entry: entry('K2', 'Chave K2', short(d.k2Hex, 16), 'secret') },
    { type: 'set' as const, party, entry: entry('K3', 'Chave K3', short(d.k3Hex, 16), 'secret') },
  ];
  return {
    id: 'des-triple',
    title: 'Triple DES (EDE): Alice, Bob e Eva',
    parties: parties('tdes'),
    steps: [
      {
        id: 'key',
        title: 'Alice e Bob compartilham as chaves',
        description:
          d.keying === 'tres' ? 'Três chaves independentes de 56 bits úteis (168 bits no total).' : d.keying === 'duas' ? 'Duas chaves independentes; a terceira repete a primeira (K3 = K1).' : 'Uma só chave repetida três vezes (K1 = K2 = K3): o Triple DES degenera no DES.',
        operation: 'Nenhum cálculo: as chaves já são conhecidas por Alice e por Bob.',
        events: [...keySets('alice'), ...keySets('bob')],
      },
      {
        id: 'iv',
        title: 'Alice escolhe um IV novo',
        description: 'O Triple DES também usa blocos de 64 bits; no CBC o primeiro bloco sofre XOR com um IV público e novo a cada mensagem.',
        operation: 'Escolha de um IV de 64 bits.',
        events: [
          { type: 'set', party: 'alice', entry: entry('IV', 'Vetor de inicialização IV (64 bits)', d.ivHex, 'param') },
          { type: 'set', party: 'alice', entry: entry('m', 'Mensagem m', short(d.message), 'plain') },
        ],
      },
      {
        id: 'mix',
        title: 'Alice combina o primeiro bloco com o IV',
        description: 'Como no CBC com o DES: o bloco P(1) sofre XOR com o IV antes de entrar na cifra.',
        operation: 'XOR de P(1) com o IV.',
        events: [
          { type: 'compute', operation: { party: 'alice', title: 'Entrada da cifra', formula: 'X = P(1) ⊕ IV', substituted: `IV = ${d.ivHex}`, result: `X = ${d.mixedHex}`, kind: 'param' } },
        ],
      },
      {
        id: 'e1',
        title: 'Primeiro estágio: cifrar com K1',
        description: 'O DES completo (16 rodadas) cifra o bloco com a chave K1.',
        operation: 'E(K1, X).',
        events: [{ type: 'compute', operation: { party: 'alice', title: 'Estágio E com K1', formula: 'A = E(K1, X)', substituted: `X = ${d.mixedHex}`, result: `A = ${d.afterE1}`, kind: 'cipher' } }],
      },
      {
        id: 'd2',
        title: 'Segundo estágio: decifrar com K2',
        description: 'A operação do meio é a decifragem DES com K2. Escolher D, e não E, é o que permite K1 = K2 = K3 equivaler ao DES simples.',
        operation: 'D(K2, A).',
        events: [{ type: 'compute', operation: { party: 'alice', title: 'Estágio D com K2', formula: 'B = D(K2, A)', substituted: `A = ${d.afterE1}`, result: `B = ${d.afterD2}`, kind: 'cipher' } }],
      },
      {
        id: 'e3',
        title: 'Terceiro estágio: cifrar com K3',
        description: 'O último estágio cifra de novo. O resultado é o primeiro bloco cifrado; os demais blocos seguem o encadeamento do CBC.',
        operation: 'E(K3, B).',
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Estágio E com K3', formula: 'C(1) = E(K3, B)', substituted: `B = ${d.afterD2}`, result: `C(1) = ${d.afterE3}`, kind: 'cipher' },
            entry: entry('c', 'Cifra C (blocos de 64 bits)', short(d.ctHex), 'cipher'),
          },
        ],
      },
      { id: 'transit', title: 'A cifra atravessa o canal', description: 'Eva captura o IV e a cifra.', operation: 'Transmissão do IV e da cifra.', events: [sendCipher(d)] },
      {
        id: 'eva-cost',
        title: 'Eva avalia o custo de atacar',
        description:
          d.keying === 'igual'
            ? 'Como o Triple DES está reduzido ao DES, a busca exaustiva de 2^56 chaves ainda vale (veja o cenário anterior).'
            : `A busca direta exigiria 2^168 testes, mas o ataque do encontro no meio cifra de um lado e decifra do outro e guarda tabelas, baixando o custo a cerca de 2^112 operações e muita memória. Segurança efetiva: ${d.strength}. Inviável hoje, mas o bloco de 64 bits é o ponto fraco (Sweet32).`,
        operation: 'Estimativa de custo (sem cálculo).',
        events: [],
      },
      {
        id: 'bob-decrypt',
        title: 'Bob decifra na ordem inversa',
        description: 'D(K3, ·), depois E(K2, ·) e depois D(K1, ·), e então o XOR com o IV ou com o bloco cifrado anterior.',
        operation: 'Decifragem Triple DES em CBC.',
        events: [
          { type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.ctHex), 'cipher') },
          { type: 'set', party: 'bob', entry: entry('IV', 'Vetor de inicialização IV', d.ivHex, 'param') },
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Decifragem Triple DES', formula: 'P = D(K1, E(K2, D(K3, C))) ⊕ C(i-1)', substituted: `${d.nBlocks} blocos`, result: `m = ${short(d.recovered, 20)}`, kind: 'plain' },
            entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
          },
        ],
      },
      { id: 'result', title: 'Comunicação protegida, mas legada', description: d.verdictText, operation: 'Avaliação do resultado.', events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }] },
    ],
  };
}
