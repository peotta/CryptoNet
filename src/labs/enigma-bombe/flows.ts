import { groupsOfFive, normalizeText } from '../../crypto/classical';
import type { ClassicalEngine } from '../../crypto/engines';
import type { BombeAttack } from '../../crypto/bombe';
import { parsePlugs, type EnigmaConfig } from '../../crypto/enigma';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition } from '../../simulation/types';
import { percentSame } from '../../crypto/transposition';

export const MAX_LETTERS = 400;

export type BombeLevel = 'total' | 'muitas-paradas' | 'nenhuma-parada' | 'escolha-errada';

export interface BombeFlowData {
  configText: string;
  nLetters: number;
  plain: string;
  cipherText: string;
  recovered: string;
  crib: string;
  /** Posição (a partir de 1) em que Eva supõe que o texto provável começa. */
  cribPosition: number;
  menuLetters: number;
  menuComponents: number;
  menuLoops: number;
  testLetter: string;
  tested: number;
  rejected: number;
  stops: number;
  tooMany: boolean;
  chosenPositions: string;
  chosenPlugs: string;
  deducedText: string;
  pct: number;
  trueStopPresent: boolean;
  level: BombeLevel;
  verdictText: string;
  ok: boolean;
}

export interface BombeRun {
  config: EnigmaConfig;
  flow: BombeFlowData;
  plainLetters: string;
  cipherLetters: string;
  attack: BombeAttack;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
const pct = (v: number) => `${v.toFixed(0)}%`;
export const bigText = (n: bigint): string => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export async function runBombeLab(engine: ClassicalEngine, input: { config: EnigmaConfig; text: string; crib: string; cribPosition: number }): Promise<BombeRun> {
  const plain = normalizeText(input.text);
  if (plain.length < 20) throw new Error('Use uma mensagem de pelo menos 20 letras (A a Z).');
  if (plain.length > MAX_LETTERS) throw new Error(`Use no máximo ${MAX_LETTERS} letras.`);
  const crib = normalizeText(input.crib);
  if (crib.length < 3) throw new Error('O texto provável deve ter ao menos 3 letras.');
  if (!Number.isInteger(input.cribPosition) || input.cribPosition < 1) throw new Error('A posição do texto provável deve ser um inteiro a partir de 1.');
  if (input.cribPosition - 1 + crib.length > plain.length) throw new Error('O texto provável não cabe na mensagem a partir dessa posição.');

  const cipher = (await engine.runEnigma(input.config, plain)).output;
  const bob = (await engine.runEnigma(input.config, cipher)).output;
  const setup = { rotors: input.config.rotors, reflector: input.config.reflector, rings: input.config.rings };
  const attack = await engine.runBombe(setup, cipher, crib, input.cribPosition - 1);
  const { stats, result } = attack;
  const best = attack.verified[0];
  const trueStopPresent = result.stops.some((s) => s.positions === input.config.positions.toUpperCase());
  const pctRecovered = best ? percentSame(best.completion.plaintext, plain) : 0;

  let level: BombeLevel;
  let verdictText: string;
  if (result.stops.length === 0) {
    level = 'nenhuma-parada';
    verdictText = `Nenhuma das ${result.tested.toLocaleString('pt-BR')} posições sobreviveu: o texto provável "${crib}" não está na posição ${input.cribPosition}, ou a ordem dos rotores, o refletor ou os anéis supostos por Eva estão errados. Na prática, Eva repetia a Bombe para cada alinhamento possível do texto provável.`;
  } else if (attack.tooMany) {
    level = 'muitas-paradas';
    verdictText = `Sobraram ${result.stops.length.toLocaleString('pt-BR')} paradas, quase todas falsas: o menu tem ${stats.loops} ${stats.loops === 1 ? 'laço' : 'laços'}, e sem laços as contradições são raras. Eva não consegue verificar tantas paradas decifrando e lendo. Era preciso um texto provável mais longo ou com laços (letras que se repetem formando ciclos).${trueStopPresent ? ' A posição verdadeira está entre as paradas, mas Eva não tem como reconhecê-la.' : ''}`;
  } else if (pctRecovered >= 95) {
    level = 'total';
    verdictText = `A Bombe eliminou ${result.rejected.toLocaleString('pt-BR')} das ${result.tested.toLocaleString('pt-BR')} posições e deixou ${result.stops.length} ${result.stops.length === 1 ? 'parada' : 'paradas'}. Eva decifrou com as posições ${best.stop.positions} e completou o painel de plugues pela legibilidade do texto: recuperou ${pct(pctRecovered)} da mensagem. O menu tinha ${stats.loops} ${stats.loops === 1 ? 'laço' : 'laços'}, o que tornou as contradições frequentes.`;
  } else {
    level = 'escolha-errada';
    verdictText = `Restaram ${result.stops.length} ${result.stops.length === 1 ? 'parada' : 'paradas'}, mas a de texto mais legível levou Eva a ${pct(pctRecovered)} da mensagem. ${trueStopPresent ? 'A posição verdadeira estava entre as paradas, mas Eva escolheu outra.' : 'A posição verdadeira não estava entre as paradas.'} Mensagens curtas dificultam distinguir a parada certa.`;
  }

  return {
    config: input.config,
    plainLetters: plain,
    cipherLetters: cipher,
    attack,
    flow: {
      configText: `${input.config.rotors.join('-')} · ${input.config.reflector} · ${input.config.positions} · ${input.config.rings} · ${parsePlugs(input.config.plugs).length} plugues`,
      nLetters: plain.length,
      plain: groupsOfFive(plain),
      cipherText: groupsOfFive(cipher),
      recovered: groupsOfFive(bob),
      crib,
      cribPosition: input.cribPosition,
      menuLetters: stats.letters.length,
      menuComponents: stats.components,
      menuLoops: stats.loops,
      testLetter: stats.testLetter,
      tested: result.tested,
      rejected: result.rejected,
      stops: result.stops.length,
      tooMany: attack.tooMany,
      chosenPositions: best?.stop.positions ?? '',
      chosenPlugs: best?.completion.plugs ?? '',
      deducedText: best ? groupsOfFive(best.completion.plaintext) : '',
      pct: pctRecovered,
      trueStopPresent,
      level,
      verdictText,
      ok: level !== 'total',
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
    role: 'Criptoanalista (opera a Bombe)',
    position: 'center',
    adversary: true,
    slots: [
      { key: 'c', label: 'Cifra observada', kind: 'cipher' },
      { key: 'M', label: 'Menu do texto provável', kind: 'param' },
      { key: 'B', label: 'Paradas da Bombe', kind: 'param' },
      { key: 'K', label: 'Posições e plugues deduzidos', kind: 'secret' },
      { key: 'P', label: 'Texto deduzido por Eva', kind: 'plain' },
    ],
  },
];

export function buildBombeProtocol(d: BombeFlowData): ProtocolDefinition {
  const menuText = `${d.menuLetters} letras, ${d.menuLoops} ${d.menuLoops === 1 ? 'laço' : 'laços'}`;
  const stopsText = d.stops === 0 ? 'nenhuma parada' : `${d.stops.toLocaleString('pt-BR')} ${d.stops === 1 ? 'parada' : 'paradas'}`;
  return {
    id: 'enigma-bombe',
    title: 'Enigma e a Bombe: Alice, Bob e Eva',
    parties,
    steps: [
      {
        id: 'key',
        title: 'Alice e Bob ajustam a máquina do dia',
        description: 'A configuração do dia (ordem dos rotores, refletor, anéis, posições iniciais e plugues) é distribuída por livro de códigos. Eva não a conhece.',
        operation: 'Nenhum cálculo: a configuração já é conhecida por Alice e por Bob.',
        events: [
          { type: 'set', party: 'alice', entry: entry('K', 'Configuração do dia', d.configText, 'secret') },
          { type: 'set', party: 'bob', entry: entry('K', 'Configuração do dia', d.configText, 'secret') },
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
        title: 'Alice cifra na Enigma',
        description: 'Cada tecla faz os rotores girarem e atravessa plugues, rotores, refletor e volta. Nenhuma letra se cifra em si mesma.',
        operation: `Cifragem de ${d.nLetters} letras.`,
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Cifragem na Enigma', formula: 'C = Enigma(configuração do dia, m)', substituted: `${d.nLetters} letras`, result: `C = ${short(d.cipherText)}`, kind: 'cipher' },
            entry: entry('c', 'Cifra C', short(d.cipherText), 'cipher'),
          },
        ],
      },
      {
        id: 'transit',
        title: 'A cifra atravessa o canal',
        description: 'A mensagem é transmitida por rádio; Eva a intercepta.',
        operation: 'Transmissão da cifra por rádio.',
        events: [
          {
            type: 'send',
            message: { from: 'alice', to: 'bob', label: 'Cifra C', summary: short(d.cipherText), kind: 'cipher', observers: ['eva'] },
            deliver: [],
            observerEntries: [entry('c', 'Cifra observada', short(d.cipherText), 'cipher')],
          },
        ],
      },
      {
        id: 'eva-menu',
        title: 'Eva monta o menu do texto provável',
        description: `Eva supõe que a mensagem contém "${d.crib}" a partir da tecla ${d.cribPosition}. Cada tecla liga a letra suposta à letra cifrada: o conjunto dessas ligações é o menu (um grafo). Quanto mais laços, mais contradições a Bombe consegue provocar.`,
        operation: 'Montagem do grafo de letras do texto provável alinhado à cifra.',
        events: [
          {
            type: 'compute',
            operation: { party: 'eva', title: 'Menu do texto provável', formula: 'aresta (letra clara, letra cifrada) em cada tecla', substituted: `"${short(d.crib, 16)}" na tecla ${d.cribPosition}`, result: menuText, kind: 'param' },
            entry: entry('M', 'Menu do texto provável', menuText, 'param'),
          },
        ],
      },
      {
        id: 'eva-bombe',
        title: 'Eva roda a Bombe nas 17.576 posições',
        description: `Para cada posição inicial dos rotores, a Bombe supõe um plugue para a letra de teste (${d.testLetter}) e propaga as consequências pelo menu. Se a letra ${d.testLetter} ficaria com dois plugues diferentes, a hipótese é contradição. Se as 26 hipóteses falham, a posição é eliminada. As que sobram são as paradas.`,
        operation: 'Propagação das hipóteses de plugue em cada posição inicial.',
        events: [
          {
            type: 'compute',
            operation: {
              party: 'eva',
              title: 'Busca da Bombe',
              formula: 'para cada posição: testar as 26 hipóteses de plugue da letra de teste',
              substituted: `${d.tested.toLocaleString('pt-BR')} posições`,
              result: `${d.rejected.toLocaleString('pt-BR')} eliminadas; ${stopsText}`,
              kind: 'param',
            },
            entry: entry('B', 'Paradas da Bombe', stopsText, 'param'),
          },
        ],
      },
      {
        id: 'eva-verify',
        title: d.level === 'muitas-paradas' ? 'Eva não consegue verificar tantas paradas' : d.level === 'nenhuma-parada' ? 'A Bombe não deixou nenhuma parada' : 'Eva verifica as paradas lendo o texto',
        description:
          d.level === 'muitas-paradas'
            ? 'Para cada parada, Eva precisaria decifrar a mensagem e avaliar se o texto faz sentido. Com milhares de paradas falsas, a verificação é inviável.'
            : d.level === 'nenhuma-parada'
              ? 'Sem paradas, Eva muda o alinhamento do texto provável (ou as hipóteses sobre a máquina) e repete a Bombe.'
              : 'Para cada parada, Eva decifra a mensagem com as posições e os plugues que a Bombe deduziu, completa os plugues restantes escolhendo os pares que deixam o texto mais legível e fica com a parada de melhor legibilidade.',
        operation: d.level === 'muitas-paradas' || d.level === 'nenhuma-parada' ? 'Nenhuma verificação possível.' : 'Decifragem de cada parada e escolha pela legibilidade do texto.',
        events:
          d.chosenPositions && d.level !== 'muitas-paradas'
            ? [
                {
                  type: 'compute',
                  operation: {
                    party: 'eva',
                    title: 'Verificação das paradas',
                    formula: 'decifrar com as posições da parada e os plugues deduzidos; completar o painel pela legibilidade',
                    substituted: `${stopsText}`,
                    result: `posições ${d.chosenPositions}; plugues ${short(d.chosenPlugs, 24)}`,
                    kind: 'secret',
                  },
                  entry: entry('K', 'Posições e plugues deduzidos', `${d.chosenPositions}; ${short(d.chosenPlugs, 24)}`, 'secret'),
                },
                { type: 'set', party: 'eva', entry: entry('P', 'Texto deduzido por Eva', short(d.deducedText), 'plain') },
              ]
            : [],
      },
      {
        id: 'receive',
        title: 'Bob recebe a cifra',
        description: 'Bob a recebe e ajusta a máquina com a configuração do dia.',
        operation: 'Recepção da cifra.',
        events: [{ type: 'set', party: 'bob', entry: entry('c', 'Cifra recebida', short(d.cipherText), 'cipher') }],
      },
      {
        id: 'decrypt',
        title: 'Bob decifra na Enigma',
        description: 'A Enigma é recíproca: com a mesma configuração, digitar a cifra devolve a mensagem.',
        operation: 'Decifragem na Enigma.',
        events: [
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Decifragem na Enigma', formula: 'm = Enigma(configuração do dia, C)', substituted: `${d.nLetters} letras`, result: `m = ${short(d.recovered)}`, kind: 'plain' },
            entry: entry('mrec', 'Mensagem recuperada', short(d.recovered), 'plain'),
          },
        ],
      },
      {
        id: 'result',
        title:
          d.level === 'total' ? 'A Bombe quebrou a chave do dia' : d.level === 'muitas-paradas' ? 'Paradas falsas demais: o menu é fraco' : d.level === 'nenhuma-parada' ? 'Nenhuma parada com este texto provável' : 'Eva escolheu a parada errada',
        description: d.verdictText,
        operation: 'Avaliação do resultado.',
        events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }],
      },
    ],
  };
}

