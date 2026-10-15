import { ALPHABET, groupsOfFive, letterPercentages, normalizeText, PT_FREQUENCY } from '../../crypto/classical';
import type { ClassicalEngine } from '../../crypto/engines';
import { indexOfCoincidence, percentCorrect, validateSubstitutionKey } from '../../crypto/substitution';
import { keyOrder, MAX_ATTACK_COLUMNS, pearson, percentAligned, readability, type ColumnarCandidate, type RailCandidate } from '../../crypto/transposition';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

export type TransMode = 'trilhos' | 'colunar' | 'produto';
export const MAX_LETTERS = 600;

export interface TransFlowData {
  mode: TransMode;
  /** Chave de Alice e Bob em texto curto. */
  keyText: string;
  nLetters: number;
  plain: string;
  cipherText: string;
  receivedText: string;
  recovered: string;
  tampered: boolean;
  tamperPosition: number;
  icPlain: number;
  icCipher: number;
  readPlain: number;
  readCipher: number;
  /** Correlação do histograma da cifra com o do português. */
  corrCipher: number;
  corrPlain: number;
  fingerprint: string;
  attackResult: string;
  attackKeyText: string;
  attackPlain: string;
  attackPct: number;
  level: 'total' | 'falha' | 'nao-tentou';
  /** Apenas na cifra produto: acertos (%) dos ataques isolados contra cada cifra sozinha e contra o produto. */
  compare: { label: string; pct: number }[];
  verdictText: string;
  ok: boolean;
}

export interface TransRun {
  flow: TransFlowData;
  mode: TransMode;
  plainLetters: string;
  /** Texto depois da substituição (cifra produto) ou o próprio texto claro. */
  midLetters: string;
  cipherLetters: string;
  rails: RailCandidate[] | null;
  columns: ColumnarCandidate[] | null;
  keyword: string;
  railCount: number;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
const num = (v: number, d = 3) => v.toFixed(d).replace('.', ',');
const pct = (v: number) => `${v.toFixed(0)}%`;

export async function runTransposition(
  engine: ClassicalEngine,
  input: { mode: TransMode; text: string; rails: number; keyword: string; subKey: string; tamper: boolean },
): Promise<TransRun> {
  const plain = normalizeText(input.text);
  if (plain.length === 0) throw new Error('Digite ao menos uma letra (A a Z).');
  if (plain.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras.`);
  const { mode } = input;
  const keyword = normalizeText(input.keyword);

  let cipher: string;
  let mid = plain;
  let keyText: string;
  if (mode === 'trilhos') {
    cipher = await engine.encryptRail(plain, input.rails);
    keyText = `${input.rails} trilhos`;
  } else if (mode === 'colunar') {
    cipher = await engine.encryptColumnar(plain, keyword);
    keyText = `palavra-chave ${keyword} (${keyword.length} colunas)`;
  } else {
    const sk = validateSubstitutionKey(input.subKey);
    mid = await engine.encryptSubstitution(sk, plain);
    cipher = await engine.encryptColumnar(mid, keyword);
    keyText = `substituição + palavra-chave ${keyword} (${keyword.length} colunas)`;
  }

  // Eva altera uma letra da cifra; cada letra da cifra corresponde a uma única letra do texto claro.
  const pos = Math.floor(cipher.length / 2);
  const received = input.tamper ? cipher.slice(0, pos) + ALPHABET[(ALPHABET.indexOf(cipher[pos]) + 1) % 26] + cipher.slice(pos + 1) : cipher;
  const recovered =
    mode === 'trilhos'
      ? await engine.decryptRail(received, input.rails)
      : mode === 'colunar'
        ? await engine.decryptColumnar(received, keyword)
        : await engine.decryptSubstitution(validateSubstitutionKey(input.subKey), await engine.decryptColumnar(received, keyword));

  // ---- Eva: impressão digital estatística ----
  const hist = (t: string) => letterPercentages(t);
  const corrCipher = pearson(hist(cipher), PT_FREQUENCY);
  const corrPlain = pearson(hist(plain), PT_FREQUENCY);
  const icPlain = indexOfCoincidence(plain);
  const icCipher = indexOfCoincidence(cipher);
  const readPlain = readability(plain);
  const readCipher = readability(cipher);
  const lettersIntact = corrCipher > 0.9;
  const scrambled = readCipher < readPlain - 0.5;
  const fingerprint =
    mode === 'produto'
      ? `IC = ${num(icCipher, 4)} (português 0,0745) mas o histograma não acompanha o do português (r = ${num(corrCipher, 2)}) e os pares estão embaralhados: substituição e transposição combinadas`
      : lettersIntact && scrambled
        ? `letras intactas (IC = ${num(icCipher, 4)}, r = ${num(corrCipher, 2)}) e pares embaralhados (legibilidade ${num(readCipher, 2)} contra ${num(readPlain, 2)}): é uma transposição`
        : `IC = ${num(icCipher, 4)}, r = ${num(corrCipher, 2)}`;

  let rails: RailCandidate[] | null = null;
  let columns: ColumnarCandidate[] | null = null;
  let attackResult: string;
  let attackKeyText = '';
  let attackPlain = '';
  let attackPct = 0;
  let level: TransFlowData['level'] = 'falha';
  const compare: TransFlowData['compare'] = [];
  let verdictText: string;

  if (mode === 'trilhos') {
    rails = await engine.crackRail(cipher);
    const best = rails[0];
    attackPlain = best.plaintext;
    attackPct = percentAligned(best.plaintext, plain);
    attackKeyText = `${best.rails} trilhos`;
    attackResult = `${best.rails} trilhos, ${pct(attackPct)} do texto`;
    level = attackPct >= 95 ? 'total' : 'falha';
    verdictText = `Eva reconheceu a transposição pela estatística (as letras estão intactas) e testou de 2 a 12 trilhos: o mais legível foi ${best.rails}, e recuperou ${pct(attackPct)} da mensagem. Poucos trilhos significam um espaço de chaves minúsculo.`;
  } else if (mode === 'colunar') {
    if (keyword.length <= MAX_ATTACK_COLUMNS) {
      columns = await engine.crackColumnar(cipher);
      const best = columns[0];
      attackPlain = best.plaintext;
      attackPct = percentAligned(best.plaintext, plain);
      attackKeyText = `ordem de leitura ${best.order.map((c) => c + 1).join(' ')}`;
      attackResult = `${best.columns} colunas, ${pct(attackPct)} do texto`;
      level = attackPct >= 95 ? 'total' : 'falha';
      verdictText = `Eva reconheceu a transposição pela estatística e tentou todas as ordens de colunas para 2 a ${MAX_ATTACK_COLUMNS} colunas, escolhendo o texto mais legível: ${best.columns} colunas, ${pct(attackPct)} da mensagem. A palavra-chave só precisa ser deduzida como ordem das colunas.`;
    } else {
      attackResult = `não tentou: ${keyword.length} colunas exigiriam testar ${keyword.length}! ordens`;
      level = 'nao-tentou';
      verdictText = `Com ${keyword.length} colunas a busca exaustiva (${keyword.length}! ordens) está além do que este laboratório executa (até ${MAX_ATTACK_COLUMNS} colunas), então Eva não tenta. Isso é limite do laboratório, e não segurança: busca local e análise por pares de colunas quebram chaves maiores.`;
    }
  } else {
    // Cifra produto: os mesmos ataques que quebram cada cifra sozinha contra a cifra produto.
    const sk = validateSubstitutionKey(input.subKey);
    const soloT = await engine.crackColumnar(await engine.encryptColumnar(plain, keyword));
    const soloS = await engine.crackSubstitution(await engine.encryptSubstitution(sk, plain));
    const prodT = (await engine.crackColumnar(cipher))[0];
    const prodS = await engine.crackSubstitution(cipher);
    const pSoloT = percentAligned(soloT[0].plaintext, plain);
    const pSoloS = percentCorrect(soloS.refinedPlain, plain);
    const pProdT = percentAligned(prodT.plaintext, plain);
    const pProdS = percentCorrect(prodS.refinedPlain, plain);
    compare.push(
      { label: 'Anagramação contra a transposição sozinha', pct: pSoloT },
      { label: 'Frequência e bigramas contra a substituição sozinha', pct: pSoloS },
      { label: 'Anagramação contra a cifra produto', pct: pProdT },
      { label: 'Frequência e bigramas contra a cifra produto', pct: pProdS },
    );
    attackPct = Math.max(pProdT, pProdS);
    attackPlain = pProdT >= pProdS ? prodT.plaintext : prodS.refinedPlain;
    attackResult = `anagramação ${pct(pProdT)}; substituição ${pct(pProdS)}`;
    level = attackPct >= 95 ? 'total' : 'falha';
    verdictText = `Os ataques que quebram cada cifra sozinha (${pct(pSoloT)} e ${pct(pSoloS)}) recuperaram só ${pct(pProdT)} e ${pct(pProdS)} contra o produto: a substituição esconde as letras (confusão) e a transposição desfaz os pares de letras de que o ataque por bigramas depende (difusão). Cada cifra anula o ataque da outra. Ataques conjuntos existem e quebraram cifras produto históricas (a ADFGVX alemã, de 1918, foi quebrada pelo francês Georges Painvin), mas exigem mais texto e trabalho.`;
  }
  if (input.tamper) verdictText += ' Além disso, Bob decifrou a mensagem alterada sem perceber: somente a letra atingida sai errada.';

  return {
    mode,
    plainLetters: plain,
    midLetters: mid,
    cipherLetters: cipher,
    rails,
    columns,
    keyword,
    railCount: input.rails,
    flow: {
      mode,
      keyText,
      nLetters: plain.length,
      plain: groupsOfFive(plain),
      cipherText: groupsOfFive(cipher),
      receivedText: groupsOfFive(received),
      recovered: groupsOfFive(recovered),
      tampered: input.tamper,
      tamperPosition: pos + 1,
      icPlain,
      icCipher,
      readPlain,
      readCipher,
      corrCipher,
      corrPlain,
      fingerprint,
      attackResult,
      attackKeyText,
      attackPlain: groupsOfFive(attackPlain),
      attackPct,
      level,
      compare,
      verdictText,
      ok: level !== 'total',
    },
  };
}

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
      { key: 'S', label: 'Impressão digital estatística', kind: 'param' },
      { key: 'K', label: 'Chave deduzida por Eva', kind: 'secret' },
      { key: 'P', label: 'Texto deduzido por Eva', kind: 'plain' },
      { key: 'forged', label: "Cifra alterada C' (enviada a Bob)", kind: 'cipher' },
    ],
  },
];

const NAMES: Record<TransMode, string> = { trilhos: 'cerca de trilhos', colunar: 'transposição colunar', produto: 'cifra produto' };

export function buildTransProtocol(d: TransFlowData): ProtocolDefinition {
  const name = NAMES[d.mode];
  const fingerStep: ProtocolStep = {
    id: 'eva-fingerprint',
    title: 'Eva examina a estatística das letras e dos pares',
    description:
      'Eva compara o histograma e o índice de coincidência da cifra com os do português, e mede a legibilidade dos pares de letras. Uma transposição só reordena: as letras continuam as mesmas, mas os pares ficam embaralhados. Uma substituição troca as letras, mas mantém os pares. Esses dois sinais dizem a Eva com que tipo de cifra ela está lidando.',
    operation: 'Cálculo do IC, da correlação do histograma e da legibilidade.',
    events: [
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Impressão digital da cifra',
          formula: 'IC, correlação de Pearson com o português, legibilidade dos pares',
          substituted: `IC = ${num(d.icCipher, 4)}; r = ${num(d.corrCipher, 2)}; legibilidade = ${num(d.readCipher, 2)} (português: ${num(d.readPlain, 2)})`,
          result: short(d.fingerprint, 60),
          kind: 'param',
        },
        entry: entry('S', 'Impressão digital estatística', d.mode === 'produto' ? 'substituição e transposição' : 'transposição', 'param'),
      },
    ],
  };

  const attackTitle: Record<TransMode, string> = {
    trilhos: 'Eva testa todos os números de trilhos',
    colunar: 'Eva testa todas as ordens de colunas (anagramação)',
    produto: 'Eva aplica os dois ataques isolados à cifra produto',
  };
  const attackDesc: Record<TransMode, string> = {
    trilhos: 'Para cada número de trilhos (2 a 12), Eva desfaz a transposição e mede a legibilidade do texto. O número certo produz texto legível; os demais, lixo.',
    colunar:
      'Para cada número de colunas (2 a 8), Eva testa todas as ordens de leitura possíveis e guarda a que produz o texto mais legível, medida pelos pares de letras. É a anagramação: reordenar colunas até o texto fazer sentido.',
    produto:
      'Eva aplica contra a cifra produto os dois ataques que quebram cada cifra sozinha: a anagramação (que depende de reconhecer texto legível) e a frequência com bigramas (que depende dos pares de letras estarem na ordem certa).',
  };
  const attackStep: ProtocolStep = {
    id: 'eva-attack',
    title: attackTitle[d.mode],
    description: attackDesc[d.mode],
    operation:
      d.mode === 'trilhos'
        ? 'Decifragem com 2 a 12 trilhos e escolha do texto mais legível.'
        : d.mode === 'colunar'
          ? 'Decifragem com todas as ordens de colunas e escolha do texto mais legível.'
          : 'Anagramação e quebra por frequência e bigramas contra a cifra produto.',
    events: [
      {
        type: 'compute',
        operation: {
          party: 'eva',
          title: 'Ataque por legibilidade',
          formula: d.mode === 'produto' ? 'ataques isolados contra C = T(S(P))' : 'escolher a chave que maximiza a legibilidade de D_{k}(C)',
          substituted: `${d.nLetters} letras`,
          result: d.attackResult,
          kind: d.mode === 'produto' ? 'plain' : 'secret',
        },
        ...(d.attackKeyText ? { entry: entry('K', 'Chave deduzida por Eva', d.attackKeyText, 'secret') } : {}),
      },
      ...(d.attackKeyText || d.mode === 'produto' ? [{ type: 'set' as const, party: 'eva', entry: entry('P', 'Texto deduzido por Eva', short(d.attackPlain), 'plain') }] : []),
    ],
    info: d.level === 'nao-tentou' ? [d.attackResult] : undefined,
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
        fingerStep,
        attackStep,
        {
          id: 'transit',
          title: 'Eva altera uma letra e reenvia a Bob',
          description: `Eva troca a letra ${d.tamperPosition} da cifra por outra e a entrega a Bob. Não há verificação de integridade: Bob não percebe, e somente a letra atingida sai errada.`,
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
        fingerStep,
        attackStep,
      ];

  const encryptDesc: Record<TransMode, string> = {
    trilhos: 'Alice escreve a mensagem em zigue-zague sobre os trilhos e lê um trilho de cada vez, de cima para baixo. As letras não mudam: só a ordem.',
    colunar: 'Alice escreve a mensagem em linhas sob a palavra-chave e lê as colunas na ordem alfabética das letras da chave. As letras não mudam: só a ordem.',
    produto: 'Primeiro, Alice substitui cada letra pela chave de substituição (confusão). Depois, escreve o resultado em linhas sob a palavra-chave e lê as colunas na ordem da chave (difusão).',
  };
  const keyDesc: Record<TransMode, string> = {
    trilhos: 'A chave é o número de trilhos. Eva não o conhece.',
    colunar: 'A chave é uma palavra: o número de letras dá o número de colunas, e a ordem alfabética das letras dá a ordem de leitura. Eva não a conhece.',
    produto: 'Há duas chaves: uma permutação das 26 letras (substituição) e uma palavra (transposição). Eva não conhece nenhuma.',
  };

  const steps: ProtocolStep[] = [
    {
      id: 'key',
      title: 'Alice e Bob combinam a chave',
      description: keyDesc[d.mode],
      operation: 'Nenhum cálculo: a chave já é conhecida por Alice e por Bob.',
      events: [
        { type: 'set', party: 'alice', entry: entry('K', 'Chave K', short(d.keyText, 34), 'secret') },
        { type: 'set', party: 'bob', entry: entry('K', 'Chave K', short(d.keyText, 34), 'secret') },
      ],
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
      title: `Alice cifra com a ${name}`,
      description: encryptDesc[d.mode],
      operation: `Cifragem por ${name} de ${d.nLetters} letras.`,
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: `Cifragem (${name})`,
            formula: d.mode === 'produto' ? 'C = T(S(P))' : 'C = T(P)',
            substituted: `${d.nLetters} letras, ${d.keyText}`,
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
      description: 'Bob guarda a cifra recebida e a decifra com a chave.',
      operation: 'Recepção da mensagem cifrada.',
      events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.receivedText), 'cipher') }],
    },
    {
      id: 'decrypt',
      title: 'Bob desfaz a cifra',
      description: d.mode === 'produto' ? 'Bob desfaz as operações na ordem inversa: primeiro a transposição, depois a substituição.' : 'Bob refaz a grade com a mesma chave e lê a mensagem na ordem original.',
      operation: 'Decifragem.',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'bob',
            title: 'Decifragem',
            formula: d.mode === 'produto' ? 'P = S^{-1}(T^{-1}(C))' : 'P = T^{-1}(C)',
            substituted: `${d.nLetters} letras, ${d.keyText}`,
            result: `P = ${short(d.recovered)}`,
            kind: 'plain',
          },
          entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
        },
      ],
    },
    {
      id: 'result',
      title: d.level === 'total' ? 'A cifra foi quebrada por Eva' : d.mode === 'produto' ? 'Os ataques isolados falham contra a cifra produto' : 'Eva não quebra a cifra nesta tentativa',
      description: d.verdictText,
      operation: 'Avaliação do resultado.',
      events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
    },
  ];
  return { id: `classica-${d.mode}`, title: `${name}: Alice, Bob e Eva`, parties, steps };
}

export { keyOrder };
