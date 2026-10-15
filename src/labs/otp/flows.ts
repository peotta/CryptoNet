import { ALPHABET, groupsOfFive, normalizeText } from '../../crypto/classical';
import type { ClassicalEngine } from '../../crypto/engines';
import { entropyBits, keyForTarget, letterDifference, possibleTexts, validatePad, type DragResult } from '../../crypto/otp';
import { indexOfCoincidence } from '../../crypto/substitution';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

export const MAX_LETTERS = 400;

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
const bigText = (n: bigint): string => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const sci = (n: bigint): string => {
  const s = n.toString();
  return s.length > 15 ? `≈ ${s[0]},${s.slice(1, 3)} × 10^${s.length - 1}` : bigText(n);
};
const bitsText = (b: number) => `${b.toFixed(1).replace('.', ',')} bits`;

/** Texto de uma "hipótese" de Eva com o mesmo tamanho da cifra. */
export function defaultDecoy(n: number): string {
  const base = normalizeText('Recuar para a estação central ao anoitecer sem resistência e destruir as pontes atrás de nós nada deve ficar para o inimigo');
  return base.repeat(Math.ceil(n / base.length)).slice(0, n);
}

// ====================================================================================================
// Uso correto: chave única
// ====================================================================================================
export interface OtpFlowData {
  nLetters: number;
  plain: string;
  keyLetters: string;
  cipherText: string;
  receivedText: string;
  recovered: string;
  tampered: boolean;
  tamperPosition: number;
  tamperOld: string;
  tamperNew: string;
  icPlain: number;
  icCipher: number;
  decoy: string;
  decoyKey: string;
  possible: string;
  entropy: number;
  verdictText: string;
  ok: boolean;
}

export interface OtpRun {
  flow: OtpFlowData;
  plainLetters: string;
  keyLetters: string;
  cipherLetters: string;
  receivedLetters: string;
  decoyLetters: string;
  decoyKey: string;
}

export async function runOtp(engine: ClassicalEngine, input: { text: string; key: string; tamper: boolean; decoy: string | null }): Promise<OtpRun> {
  const plain = normalizeText(input.text);
  if (plain.length === 0) throw new Error('Digite ao menos uma letra (A a Z).');
  if (plain.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras.`);
  const key = validatePad(input.key, plain.length);
  const cipher = await engine.encryptOtp(key, plain);

  // Eva soma d a uma letra da cifra; sem a chave, ela controla exatamente a mudança no texto claro (maleabilidade).
  const pos = Math.floor(cipher.length / 2);
  const old = plain[pos];
  const nova = ALPHABET[(ALPHABET.indexOf(old) + 1) % 26];
  const received = input.tamper ? cipher.slice(0, pos) + ALPHABET[(ALPHABET.indexOf(cipher[pos]) + 1) % 26] + cipher.slice(pos + 1) : cipher;
  const recovered = await engine.decryptOtp(key, received);

  const decoy = normalizeText(input.decoy ?? defaultDecoy(plain.length));
  const decoyKey = keyForTarget(cipher, decoy); // lança erro se o tamanho diferir

  let verdictText =
    `Eva não aprendeu nada além do tamanho da mensagem (${plain.length} letras): para o candidato que ela testou existe a chave ${short(decoyKey, 14)}, tão aleatória quanto a verdadeira, e o mesmo vale para qualquer outro dos ${sci(possibleTexts(plain.length))} textos possíveis. ` +
    'É o sigilo perfeito de Shannon. Ele depende de a chave ser aleatória, do tamanho da mensagem, usada uma única vez e secreta, e não protege a integridade.';
  if (input.tamper) verdictText += ` Eva, sabendo que a letra ${pos + 1} era ${old}, somou 1 à letra cifrada: Bob decifrou ${nova} nessa posição, sem erro algum (maleabilidade).`;

  return {
    plainLetters: plain,
    keyLetters: key,
    cipherLetters: cipher,
    receivedLetters: received,
    decoyLetters: decoy,
    decoyKey,
    flow: {
      nLetters: plain.length,
      plain: groupsOfFive(plain),
      keyLetters: key,
      cipherText: groupsOfFive(cipher),
      receivedText: groupsOfFive(received),
      recovered: groupsOfFive(recovered),
      tampered: input.tamper,
      tamperPosition: pos + 1,
      tamperOld: old,
      tamperNew: nova,
      icPlain: indexOfCoincidence(plain),
      icCipher: indexOfCoincidence(cipher),
      decoy: groupsOfFive(decoy),
      decoyKey: groupsOfFive(decoyKey),
      possible: bigText(possibleTexts(plain.length)),
      entropy: entropyBits(plain.length),
      verdictText,
      ok: true,
    },
  };
}

const partiesCorrect: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente',
    position: 'left',
    slots: [
      { key: 'K', label: 'Chave (pad) K', kind: 'secret' },
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
      { key: 'K', label: 'Chave (pad) K', kind: 'secret' },
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
      { key: 'T', label: 'Texto candidato testado (hipótese)', kind: 'plain' },
      { key: 'K2', label: 'Chave que levaria a esse candidato', kind: 'param' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

export function buildOtpProtocol(d: OtpFlowData): ProtocolDefinition {
  const tryStep: ProtocolStep = {
    id: 'eva-try',
    title: 'Eva testa um texto candidato e descobre que nada o descarta',
    description:
      'Eva supõe que a mensagem é um texto qualquer do mesmo tamanho e calcula a chave que levaria a cifra até ele: K′ = C − T. Essa chave sempre existe e é tão aleatória quanto a verdadeira. Como todos os textos de mesmo tamanho são igualmente possíveis, a cifra não favorece nenhum.',
    operation: "Cálculo da chave K′ = C − T para o texto candidato T.",
    events: [
      { type: 'set', party: 'eva', entry: entry('T', 'Texto candidato testado (hipótese)', short(d.decoy), 'plain') },
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Chave compatível com a hipótese',
          formula: "K′_{i} = (C_{i} − T_{i}) mod 26",
          substituted: `${d.nLetters} letras; ${d.possible} textos possíveis`,
          result: `K′ = ${short(d.decoyKey)} (existe, e é plausível)`,
          kind: 'param',
        },
        entry: entry('K2', 'Chave que levaria a esse candidato', short(d.decoyKey), 'param'),
      },
    ],
    info: [`A incerteza de Eva sobre a mensagem é de ${bitsText(d.entropy)} (n · log₂ 26), a mesma de antes de ver a cifra.`],
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
        tryStep,
        {
          id: 'transit',
          title: 'Eva soma 1 a uma letra e reenvia a Bob',
          description: `Eva sabe que a letra ${d.tamperPosition} do texto claro é ${d.tamperOld} (por exemplo, um valor ou um nome de formato conhecido) e quer ${d.tamperNew}. Sem conhecer a chave, ela soma 1 à letra cifrada dessa posição: a soma se propaga ao texto claro. É a maleabilidade do one-time pad.`,
          operation: `Soma de 1 à letra cifrada ${d.tamperPosition} e reenvio.`,
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
          description: 'A cifra trafega pelo canal público e Eva a lê. Ela vê um texto que parece sorteado: qualquer letra tem probabilidade 1/26 em qualquer posição.',
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
        tryStep,
      ];

  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob possuem a mesma chave aleatória',
      description: `A chave (o "pad") tem ${d.nLetters} letras, o mesmo tamanho da mensagem, sorteadas ao acaso. Foi entregue antes, por um meio seguro (historicamente, por um mensageiro). Cada letra será usada uma única vez. Eva não a conhece.`,
      operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Chave (pad) K', `${d.nLetters} letras sorteadas`, 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Chave (pad) K', `${d.nLetters} letras sorteadas`, 'secret') },
      ],
      info: ['As quatro condições do sigilo perfeito: chave aleatória, do tamanho da mensagem, de uso único e secreta.'],
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
      title: 'Alice soma a chave à mensagem, letra a letra',
      description: 'Cada letra do texto claro é somada, módulo 26, à letra da chave na mesma posição. Como a chave é aleatória e nunca se repete, cada letra da cifra é uniformemente aleatória.',
      operation: `Soma módulo 26 de ${d.nLetters} letras.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: 'Cifragem one-time pad',
            formula: 'C_{i} = (P_{i} + K_{i}) mod 26',
            substituted: `${d.nLetters} letras, chave de ${d.nLetters} letras`,
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
      description: 'Bob guarda a cifra recebida e subtrai a mesma chave.',
      operation: 'Recepção da mensagem cifrada.',
      events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedText), 'cipher') }],
    },
    {
      id: 'decrypt',
      title: 'Bob subtrai a chave da cifra',
      description: 'Bob subtrai a letra da chave de cada letra da cifra, módulo 26, e recupera o texto claro. A chave pode ser destruída agora: nunca mais será usada.',
      operation: 'Subtração módulo 26.',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Decifragem',
            formula: 'P_{i} = (C_{i} − K_{i}) mod 26',
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
      title: 'Eva não aprende nada sobre o conteúdo',
      description: d.verdictText,
      operation: 'Avaliação do resultado.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
  return { id: 'otp-uso-correto', title: 'One-time pad: uso correto', parties: partiesCorrect, steps };
}

// ====================================================================================================
// Reutilização da chave: two-time pad
// ====================================================================================================
export interface ReuseFlowData {
  /** Tamanho da região comum às duas mensagens (onde Eva trabalha). */
  nLetters: number;
  nLetters1: number;
  nLetters2: number;
  plain1: string;
  plain2: string;
  cipher1: string;
  cipher2: string;
  diff: string;
  crib: string;
  cribIn: 1 | 2;
  /** Posição verdadeira do texto provável (a partir de 0); -1 se não está na mensagem. */
  trueOffset: number;
  rank: number;
  totalOffsets: number;
  bestOffset: number;
  bestFragment: string;
  bestKeyFragment: string;
  success: boolean;
  recovered1: string;
  recovered2: string;
  verdictText: string;
  ok: boolean;
}

export interface ReuseRun {
  flow: ReuseFlowData;
  key: string;
  plain1: string;
  plain2: string;
  cipher1: string;
  cipher2: string;
  diff: string;
  drag: DragResult[];
}

export async function runReuse(engine: ClassicalEngine, input: { text1: string; text2: string; key: string; crib: string; cribIn: 1 | 2 }): Promise<ReuseRun> {
  const p1 = normalizeText(input.text1);
  const p2 = normalizeText(input.text2);
  if (p1.length === 0 || p2.length === 0) throw new Error('Digite ao menos uma letra (A a Z) em cada mensagem.');
  if (p1.length > MAX_LETTERS || p2.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras em cada mensagem.`);
  const crib = normalizeText(input.crib);
  if (crib.length < 4) throw new Error('O texto provável deve ter ao menos 4 letras.');
  const key = validatePad(input.key, Math.max(p1.length, p2.length));

  const c1 = await engine.encryptOtp(key, p1);
  const c2 = await engine.encryptOtp(key, p2); // a MESMA chave: é o erro
  const r1 = await engine.decryptOtp(key, c1);
  const r2 = await engine.decryptOtp(key, c2);
  const common = Math.min(p1.length, p2.length);
  if (crib.length > common) throw new Error(`O texto provável (${crib.length} letras) não pode ser maior que a região comum às mensagens (${common} letras).`);

  const drag = await engine.dragOtp(c1, c2, crib, input.cribIn === 1);
  const trueOffset = (input.cribIn === 1 ? p1 : p2).indexOf(crib);
  const rank = trueOffset < 0 ? 0 : drag.findIndex((d) => d.offset === trueOffset) + 1;
  const best = drag[0];
  const success = rank === 1;
  const other = input.cribIn === 1 ? 2 : 1;

  let verdictText: string;
  if (success) {
    verdictText =
      `Reutilizar a chave destruiu o sigilo: D = C2 − C1 = P2 − P1 não contém a chave. Eva arrastou o texto provável "${crib}" e, na posição ${best.offset + 1}, obteve o fragmento "${best.fragment}" da mensagem ${other} e o fragmento "${best.keyFragment}" da chave. ` +
      'Com o fragmento da chave, ela lê as duas mensagens nesse trecho e continua estendendo, adivinhando palavras vizinhas. Foi assim que o projeto Venona decifrou mensagens soviéticas.';
  } else if (rank > 0) {
    verdictText = `A posição correta ficou em ${rank}º lugar entre ${drag.length}: o texto provável é curto e vários alinhamentos parecem plausíveis. Eva testa mais textos prováveis ou um maior, e a posição certa sobe ao topo.`;
  } else {
    verdictText = `O texto provável "${crib}" não está na mensagem ${input.cribIn}, então nenhum alinhamento produz um fragmento legível. Eva tenta outras palavras prováveis. A chave reutilizada continua vazando: basta acertar um trecho.`;
  }

  return {
    key,
    plain1: p1,
    plain2: p2,
    cipher1: c1,
    cipher2: c2,
    diff: letterDifference(c1, c2),
    drag,
    flow: {
      nLetters: common,
      nLetters1: p1.length,
      nLetters2: p2.length,
      plain1: groupsOfFive(p1),
      plain2: groupsOfFive(p2),
      cipher1: groupsOfFive(c1),
      cipher2: groupsOfFive(c2),
      diff: groupsOfFive(letterDifference(c1, c2)),
      crib,
      cribIn: input.cribIn,
      trueOffset,
      rank,
      totalOffsets: drag.length,
      bestOffset: best?.offset ?? -1,
      bestFragment: best?.fragment ?? '',
      bestKeyFragment: best?.keyFragment ?? '',
      success,
      recovered1: groupsOfFive(r1),
      recovered2: groupsOfFive(r2),
      verdictText,
      ok: !success,
    },
  };
}

const partiesReuse: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Remetente (reutiliza a chave)',
    position: 'left',
    slots: [
      { key: 'K', label: 'Chave (pad) K', kind: 'secret' },
      { key: 'm1', label: 'Mensagem 1', kind: 'plain' },
      { key: 'm2', label: 'Mensagem 2', kind: 'plain' },
      { key: 'c1', label: 'Cifra 1 (com K)', kind: 'cipher' },
      { key: 'c2', label: 'Cifra 2 (com a MESMA K)', kind: 'cipher' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Destinatário',
    position: 'right',
    slots: [
      { key: 'K', label: 'Chave (pad) K', kind: 'secret' },
      { key: 'c1', label: 'Cifra 1 recebida', kind: 'cipher' },
      { key: 'c2', label: 'Cifra 2 recebida', kind: 'cipher' },
      { key: 'm1', label: 'Mensagem 1 recuperada', kind: 'plain' },
      { key: 'm2', label: 'Mensagem 2 recuperada', kind: 'plain' },
    ],
  },
  {
    id: 'eva',
    name: 'Eva',
    role: 'Criptoanalista (observa o canal)',
    position: 'center',
    adversary: true,
    slots: [
      { key: 'c1', label: 'Cifra 1 observada', kind: 'cipher' },
      { key: 'c2', label: 'Cifra 2 observada', kind: 'cipher' },
      { key: 'D', label: 'Diferença D = C2 − C1', kind: 'param' },
      { key: 'frag', label: 'Fragmento da outra mensagem', kind: 'plain' },
      { key: 'kfrag', label: 'Fragmento da chave', kind: 'secret' },
    ],
  },
];

export function buildReuseProtocol(d: ReuseFlowData): ProtocolDefinition {
  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob possuem a mesma chave aleatória',
      description: 'A chave é aleatória e secreta, mas desta vez Alice vai usá-la duas vezes: o erro que este cenário mostra.',
      operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Chave (pad) K', 'chave aleatória secreta', 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Chave (pad) K', 'chave aleatória secreta', 'secret') },
      ],
    },
    {
      id: 'write',
      title: 'Alice escreve duas mensagens',
      description: 'Duas mensagens diferentes, que ela cifrará com a mesma chave porque "a chave é longa e ainda dá".',
      operation: 'Normalização dos dois textos.',
      events: [
        { type: 'set', party: 'alice', entry: entry('m1', 'Mensagem 1', short(d.plain1), 'plain') },
        { type: 'set', party: 'alice', entry: entry('m2', 'Mensagem 2', short(d.plain2), 'plain') },
      ],
    },
    {
      id: 'encrypt-1',
      title: 'Alice cifra a mensagem 1 com a chave K',
      description: 'Soma módulo 26 da chave ao texto claro 1.',
      operation: 'C1 = P1 + K (mod 26).',
      events: [
        {
          type: 'compute',
          operation: { party: 'alice', title: 'Cifragem da mensagem 1', formula: 'C1_{i} = (P1_{i} + K_{i}) mod 26', substituted: `${d.nLetters1} letras`, result: `C1 = ${short(d.cipher1)}`, kind: 'cipher' },
          entry: entry('c1', 'Cifra 1 (com K)', short(d.cipher1), 'cipher'),
        },
      ],
    },
    {
      id: 'encrypt-2',
      title: 'Alice cifra a mensagem 2 com a MESMA chave K',
      description: 'Aqui está o erro: a mesma chave, as mesmas posições. A cifra 2 é a soma da mesma chave a outro texto claro.',
      operation: 'C2 = P2 + K (mod 26), com o mesmo K.',
      events: [
        {
          type: 'compute',
          operation: { party: 'alice', title: 'Cifragem da mensagem 2 (chave reutilizada)', formula: 'C2_{i} = (P2_{i} + K_{i}) mod 26', substituted: `${d.nLetters2} letras, a mesma chave`, result: `C2 = ${short(d.cipher2)}`, kind: 'cipher' },
          entry: entry('c2', 'Cifra 2 (com a MESMA K)', short(d.cipher2), 'cipher'),
        },
      ],
    },
    {
      id: 'transit-1',
      title: 'A cifra 1 atravessa o canal',
      description: 'A cifra 1 trafega pelo canal público e Eva a capta. Sozinha, ela é indistinguível de letras sorteadas.',
      operation: 'Transmissão da cifra 1.',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: 'Cifra 1', summary: short(d.cipher1), kind: 'cipher', observers: ['eva'] },
          deliver: [entry('c1', 'Cifra 1 recebida', short(d.cipher1), 'cipher')],
          observerEntries: [entry('c1', 'Cifra 1 observada', short(d.cipher1), 'cipher')],
        },
      ],
    },
    {
      id: 'transit-2',
      title: 'A cifra 2 atravessa o canal',
      description: 'A cifra 2 também é captada por Eva. Agora ela tem duas cifras feitas com a mesma chave.',
      operation: 'Transmissão da cifra 2.',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: 'Cifra 2', summary: short(d.cipher2), kind: 'cipher', observers: ['eva'] },
          deliver: [entry('c2', 'Cifra 2 recebida', short(d.cipher2), 'cipher')],
          observerEntries: [entry('c2', 'Cifra 2 observada', short(d.cipher2), 'cipher')],
        },
      ],
    },
    {
      id: 'eva-diff',
      title: 'Eva subtrai as duas cifras: a chave desaparece',
      description:
        'D = C2 − C1 = (P2 + K) − (P1 + K) = P2 − P1. A chave se cancela, e Eva fica com uma relação só entre os dois textos claros, que são português: eles têm estrutura que a chave aleatória escondia.',
      operation: `Diferença módulo 26 das duas cifras (região comum de ${d.nLetters} letras).`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'eva',
            title: 'Cancelamento da chave',
            formula: 'D_{i} = (C2_{i} − C1_{i}) mod 26 = P2_{i} − P1_{i}',
            substituted: `${d.nLetters} letras`,
            result: `D = ${short(d.diff)}`,
            kind: 'param',
          },
          entry: entry('D', 'Diferença D = C2 − C1', short(d.diff), 'param'),
        },
      ],
    },
    {
      id: 'eva-drag',
      title: `Eva arrasta o texto provável "${d.crib}"`,
      description: `Eva supõe que "${d.crib}" aparece na mensagem ${d.cribIn} e o desliza por todas as posições. Em cada uma, calcula o trecho que ficaria na outra mensagem (P_outra = P_conhecida ± D). Se o alinhamento está certo, o trecho é texto legível; se errado, é lixo. Ela escolhe a posição de trecho mais parecido com português.`,
      operation: `Arrasto do texto provável em ${d.totalOffsets} posições, ordenadas pela legibilidade do trecho.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'eva',
            title: 'Arrasto do texto provável',
            formula: 'P_{outra} = P_{provável} + D (nas posições testadas)',
            substituted: `"${d.crib}" na mensagem ${d.cribIn}, ${d.totalOffsets} posições`,
            result: `melhor posição: ${d.bestOffset + 1}, trecho "${d.bestFragment}"`,
            kind: 'plain',
          },
          entry: entry('frag', 'Fragmento da outra mensagem', d.bestFragment, 'plain'),
        },
        { type: 'set', party: 'eva', entry: entry('kfrag', 'Fragmento da chave', d.bestKeyFragment, 'secret') },
      ],
      info: [d.success ? 'O trecho é legível: o alinhamento está certo. Eva estende o ataque adivinhando as palavras vizinhas.' : 'Com um texto provável curto, mais de um alinhamento parece plausível: Eva precisa de mais texto provável.'],
    },
    {
      id: 'receive',
      title: 'Bob recebe as duas cifras',
      description: 'Bob já recebeu as duas cifras e se prepara para decifrá-las com a chave.',
      operation: 'Recepção das mensagens cifradas.',
      events: [],
    },
    {
      id: 'decrypt-1',
      title: 'Bob decifra a mensagem 1',
      description: 'Bob subtrai a chave da cifra 1.',
      operation: 'P1 = C1 − K (mod 26).',
      events: [
        {
          type: 'compute',
          operation: { party: 'bob', title: 'Decifragem da mensagem 1', formula: 'P1_{i} = (C1_{i} − K_{i}) mod 26', substituted: `${d.nLetters1} letras`, result: `P1 = ${short(d.recovered1)}`, kind: 'plain' },
          entry: entry('m1', 'Mensagem 1 recuperada', short(d.recovered1), 'plain'),
        },
      ],
    },
    {
      id: 'decrypt-2',
      title: 'Bob decifra a mensagem 2',
      description: 'Bob subtrai a mesma chave da cifra 2. Para Bob tudo funciona; é Eva quem foi beneficiada pelo erro.',
      operation: 'P2 = C2 − K (mod 26).',
      events: [
        {
          type: 'compute',
          operation: { party: 'bob', title: 'Decifragem da mensagem 2', formula: 'P2_{i} = (C2_{i} − K_{i}) mod 26', substituted: `${d.nLetters2} letras`, result: `P2 = ${short(d.recovered2)}`, kind: 'plain' },
          entry: entry('m2', 'Mensagem 2 recuperada', short(d.recovered2), 'plain'),
        },
      ],
    },
    {
      id: 'result',
      title: d.success ? 'O sigilo perfeito foi destruído pela reutilização' : 'A reutilização da chave ainda vaza informação',
      description: d.verdictText,
      operation: 'Avaliação do resultado.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
  return { id: 'otp-reutilizacao', title: 'One-time pad: reutilização da chave', parties: partiesReuse, steps };
}
