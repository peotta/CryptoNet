// Peças comuns dos fluxos do DAP: participantes, ajudantes de etapas e as etapas do desafio (e-Bank) e da verificação (MD).
//
// Mapeamento para o modelo Alice, Bob e Eva do laboratório:
//   Alice = usuária com o celular de confiança (MD)    Bob = e-Bank com o HSM
//   Eva   = computador não confiável (UC), que controla o canal da Internet entre Alice e Bob
// O ATM é um canal dedicado entre o e-Bank e Alice, que Eva não controla.
import { abbreviateHex, toHex } from '../../crypto/encoding';
import {
  SKEW_SECONDS,
  TTL_SECONDS,
  renderMask,
  type Challenge,
  type Freshness,
  type ParsedTransData,
  type SplitChallenge,
  type SubKeys,
  type TransParse,
} from '../../crypto/dap';
import { plainFormula } from '../../animations/Formula';
import type { Entry, ItemKind, PartyDef, ProtocolStep, SimulationEvent } from '../../simulation/types';

export const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
/** Abrevia octetos em hexadecimal para a tela. */
export const hex = (x: Uint8Array | string, n = 6) => abbreviateHex(typeof x === 'string' ? x : toHex(x), n);
export const clip = (t: string, n = 44) => (t.length > n ? `${t.slice(0, n)}…` : t);

type Compute = Extract<SimulationEvent, { type: 'compute' }>;
export const compute = (party: string, title: string, formula: string, substituted: string, result: string, kind: ItemKind, e?: Entry): Compute => ({
  type: 'compute',
  operation: { party, title, formula, substituted, result, kind },
  ...(e ? { entry: e } : {}),
});
/** Títulos, descrições e notas são texto simples: a marcação x_{i} das fórmulas vira x_i. */
export const step = (id: string, title: string, description: string, operation: string, events: SimulationEvent[], info?: string[]): ProtocolStep => ({
  id,
  title: plainFormula(title),
  description: plainFormula(description),
  operation: plainFormula(operation),
  events,
  ...(info ? { info: info.map(plainFormula) } : {}),
});

/** Um QR code exibido ao final de uma etapa (o painel desenha a matriz de módulos). */
export interface QrItem {
  stepId: string;
  title: string;
  text: string;
}

export function dapParties(alice: PartyDef['slots'], bob: PartyDef['slots'], eva: PartyDef['slots']): PartyDef[] {
  return [
    { id: 'alice', name: 'Alice', role: 'Usuária com o celular de confiança (MD)', position: 'left', slots: alice },
    { id: 'bob', name: 'Bob', role: 'e-Bank com o HSM', position: 'right', slots: bob },
    { id: 'eva', name: 'Eva', role: 'Computador não confiável (UC) controlado pela atacante', position: 'center', adversary: true, slots: eva },
  ];
}

export const ALICE_SLOTS: PartyDef['slots'] = [
  { key: 'k1', label: 'Metade k_{1} (temporária)', kind: 'secret' },
  { key: 'k2', label: 'Metade k_{2} (temporária)', kind: 'secret' },
  { key: 'k', label: 'Chave k (armazenamento protegido)', kind: 'secret' },
  { key: 'yp', label: "Etiqueta y' recalculada", kind: 'signature' },
  { key: 'tela', label: 'Tela do MD (WYSIWYS)', kind: 'plain' },
  { key: 'rhat', label: 'Código r_hat', kind: 'secret' },
];

export const BOB_SLOTS: PartyDef['slots'] = [
  { key: 'k1', label: 'Metade k_{1} (guardada)', kind: 'secret' },
  { key: 'k2', label: 'Metade k_{2} (recalculada no HSM)', kind: 'secret' },
  { key: 'k', label: 'Chave k (só dentro do HSM)', kind: 'secret' },
  { key: 'td', label: 'trans_data', kind: 'plain' },
  { key: 'r', label: 'Código r', kind: 'secret' },
  { key: 'rp', label: "r' = IV | C", kind: 'cipher' },
  { key: 'y', label: 'Etiqueta y', kind: 'signature' },
  { key: 'res', label: 'Situação da transação', kind: 'param' },
];

// ---------------------------------------------------------------------------------------------
// Etapas do e-Bank: montagem do desafio (Seção 6.1.1)
// ---------------------------------------------------------------------------------------------
export interface ChallengeStepsInput {
  /** Prefixo dos identificadores das etapas ('act' ou 'tx'). */
  p: string;
  ch: Challenge;
  nonce: string;
  keys: SubKeys;
  /** Resumo de uma frase do que é a operação (ativação ou transferência). */
  what: string;
  fieldsNote: string;
}

export function bobChallengeSteps(c: ChallengeStepsInput): ProtocolStep[] {
  const { p, ch } = c;
  return [
    step(
      `${p}-transdata`,
      'Bob monta trans_data e inicia o relógio de 120 s',
      `O e-Bank registra o instante de geração, que vai dentro de trans_data como carimbo, e dispara o prazo de ${TTL_SECONDS} s. O Nonce (20 caracteres de A a Z e 0 a 9) identifica esta transação. ${c.fieldsNote}`,
      'trans_data = Nonce ; Version ; Code ; Field_1 ; … ; Field_n (ASCII imprimível).',
      [
        compute(
          'bob',
          'Montagem de trans_data',
          'trans_data = Nonce ; Version ; Code ; Field_1 ; … ; Field_n',
          `trans_data = ${clip(ch.transData, 60)}`,
          `${ch.transData.length} octetos em claro`,
          'plain',
          entry('td', 'trans_data', clip(ch.transData, 40), 'plain'),
        ),
        { type: 'set', party: 'bob', entry: entry('res', 'Situação da transação', `pendente (timer de ${TTL_SECONDS} s)`, 'param') },
      ],
      [c.what, 'O texto do trans_data vai em claro no QR: o DAP protege a integridade dele e o sigilo do código r, não o sigilo dos dados da transação.'],
    ),
    step(
      `${p}-r`,
      'Bob sorteia o código autorizador r',
      'O código tem seis dígitos, uniformes de 000000 a 999999. O sorteio usa amostragem com rejeição para evitar o viés do módulo: palavras de 32 bits acima do maior múltiplo de 10^6 são descartadas.',
      'r = amostragem com rejeição em [0, 10^6).',
      [compute('bob', 'Sorteio de r', 'r ← {000000, …, 999999}', 'rejeição de palavras de 32 bits ≥ 4.294.000.000', `r = ${ch.r}`, 'secret', entry('r', 'Código r', ch.r, 'secret'))],
      ['Um chute de Eva acerta com probabilidade 10^-6 por tentativa; com o limite de 3 tentativas, no máximo 3 × 10^-6 por desafio.'],
    ),
    step(
      `${p}-enc`,
      "Bob cifra r com o AES-256-CBC: r' = IV | C",
      "Bob sorteia um IV de 128 bits novo e cifra os seis dígitos ASCII com k'_{2}. O preenchimento PKCS#7 completa um único bloco de 16 octetos, e r' = IV | C tem 32 octetos.",
      "C = CBC-Enc(k'_{2}, IV, r); r' = IV | C.",
      [
        compute(
          'bob',
          "Cifragem de r",
          "C = AES-256-CBC(k'_{2}, IV, r)",
          `C = AES-256-CBC(${hex(c.keys.kEnc, 4)}, ${hex(ch.iv, 4)}, "${ch.r}")`,
          `r' = ${hex(ch.rPrime, 8)}`,
          'cipher',
          entry('rp', "r' = IV | C", hex(ch.rPrime, 8), 'cipher'),
        ),
      ],
      ['O IV nunca se repete com a mesma chave k\'_{2}. O sigilo de r depende de k\'_{2}; a integridade de r\' fica a cargo da etiqueta y.'],
    ),
    step(
      `${p}-mac`,
      "Bob calcula a etiqueta y sobre trans_data | r'",
      "A etiqueta cobre os dados da transação, o carimbo e o código cifrado. Quem não tem k'_{1} não consegue produzir um y válido para outro conteúdo.",
      "y = HMAC-SHA-256(k'_{1}, trans_data | r').",
      [
        compute(
          'bob',
          'Etiqueta de autenticação',
          "y = HMAC-SHA-256(k'_{1}, trans_data | r')",
          `y = HMAC-SHA-256(${hex(c.keys.kMac, 4)}, ${clip(ch.transData, 24)} | ${hex(ch.rPrime, 4)})`,
          `y = ${hex(ch.y, 8)}`,
          'signature',
          entry('y', 'Etiqueta y', hex(ch.y, 8), 'signature'),
        ),
      ],
    ),
    step(
      `${p}-pack`,
      'Bob codifica o desafio em Base64 para o QR',
      'O desafio é a sequência trans_data | r\' | y (os últimos 64 octetos são r\' e y). O texto em Base64 é o conteúdo do QR code.',
      "desafio = Base64(trans_data | r' | y).",
      [
        compute(
          'bob',
          'Codificação do desafio',
          "desafio = Base64(trans_data | r' | y)",
          `${ch.payload.length} octetos = ${ch.transData.length} + 32 + 32`,
          `${ch.base64.length} caracteres em Base64`,
          'cipher',
        ),
      ],
    ),
  ];
}

// ---------------------------------------------------------------------------------------------
// Etapas do MD: verificação do desafio (Seção 6.1.2)
// ---------------------------------------------------------------------------------------------
export interface MdInput {
  p: string;
  split: SplitChallenge;
  tag: { yPrime: Uint8Array; equal: boolean };
  keys: SubKeys;
  parse: TransParse;
  fresh: Freshness | null;
  mdOffset: number;
  scanSec: number;
  rHat: string | null;
}

export type MdFailure = 'tag' | 'campos' | 'expirado' | 'futuro' | 'decifra' | null;

/** Etapas do MD até mostrar a transação (sem o código). failure indica onde a verificação parou. */
export function mdVerifySteps(m: MdInput): { steps: ProtocolStep[]; failure: MdFailure } {
  const { p } = m;
  const steps: ProtocolStep[] = [];
  steps.push(
    step(
      `${p}-yprime`,
      "O MD recalcula a etiqueta y' e compara com y",
      "O MD separa y (últimos 32 octetos), r' (os 32 anteriores) e trans_data (o resto) e recalcula a etiqueta com a sua chave k'_{1}. A comparação é em tempo constante. Se falhar, o MD para sem decifrar r'.",
      "y' = HMAC-SHA-256(k'_{1}, trans_data | r'); aceita só se y' = y.",
      [
        compute(
          'alice',
          "Verificação da etiqueta",
          "y' = HMAC-SHA-256(k'_{1}, trans_data | r')",
          `y' = HMAC-SHA-256(${hex(m.keys.kMac, 4)}, ${clip(m.split.transData, 24)} | ${hex(m.split.rPrime, 4)})`,
          m.tag.equal ? `y' = ${hex(m.tag.yPrime, 6)} = y: autêntico` : `y' = ${hex(m.tag.yPrime, 6)} ≠ y: rejeitado`,
          'signature',
          entry('yp', "Etiqueta y' recalculada", m.tag.equal ? `${hex(m.tag.yPrime, 6)} (igual a y)` : `${hex(m.tag.yPrime, 6)} (diferente de y)`, 'signature'),
        ),
        ...(m.tag.equal
          ? []
          : ([
              {
                type: 'verdict',
                verdict: { ok: false, text: 'Erro de integridade ou autenticidade: o MD descartou o desafio sem decifrar r\'. O código nunca foi revelado.' },
              },
            ] as SimulationEvent[])),
      ],
    ),
  );
  if (!m.tag.equal) return { steps, failure: 'tag' };

  const validated = m.parse.ok && m.fresh?.state === 'ok';
  let result = '';
  let failure: MdFailure = null;
  let verdictText = '';
  if (!m.parse.ok) {
    failure = 'campos';
    result = `rejeitado: ${m.parse.message}`;
    verdictText = `Desafio rejeitado: ${m.parse.message}`;
  } else if (m.fresh?.state === 'expired') {
    failure = 'expirado';
    result = `vencido: ${m.fresh.ageSeconds} s > ${TTL_SECONDS} s`;
    verdictText = `Desafio expirado (${m.fresh.ageSeconds} s depois da geração, limite de ${TTL_SECONDS} s): o MD não mostra a transação nem decifra r'. O usuário deve iniciar nova transação.`;
  } else if (m.fresh?.state === 'future') {
    failure = 'futuro';
    result = `carimbo ${-(m.fresh.ageSeconds)} s à frente do relógio do MD (limite ${SKEW_SECONDS} s)`;
    verdictText = `O carimbo está mais de ${SKEW_SECONDS} s à frente do relógio do MD: o aparelho pede ao usuário que confira a data e a hora.`;
  } else {
    result = `válido; idade ${m.fresh?.ageSeconds ?? 0} s (limite ${TTL_SECONDS} s)`;
  }
  steps.push(
    step(
      `${p}-validate`,
      'O MD valida Version, Code, campos e carimbo',
      `Com a etiqueta correta, o MD confere a versão, procura o modelo do código de transação, verifica o número, o tipo e o tamanho dos campos e compara o carimbo com o próprio relógio (UTC). A tolerância é de ${SKEW_SECONDS} s para um carimbo no futuro e de ${TTL_SECONDS} s de idade.`,
      'Version suportada? Code conhecido? Campos conforme o modelo? −60 s ≤ idade ≤ 120 s?',
      [
        compute(
          'alice',
          'Validação do conteúdo',
          'idade = relógio do MD − carimbo',
          m.fresh ? `idade = (carimbo + ${m.scanSec} s ${m.mdOffset >= 0 ? '+' : '−'} ${Math.abs(m.mdOffset)} s) − carimbo = ${m.fresh.ageSeconds} s` : 'campos inválidos: o carimbo não foi lido',
          result,
          validated ? 'param' : 'plain',
        ),
        ...(validated ? [] : ([{ type: 'verdict', verdict: { ok: false, text: verdictText } }] as SimulationEvent[])),
      ],
    ),
  );
  if (!validated) return { steps, failure };

  const parsed = (m.parse as Extract<TransParse, { ok: true }>).parsed;
  steps.push(showStep(p, parsed));
  return { steps, failure: null };
}

export function showStep(p: string, parsed: ParsedTransData): ProtocolStep {
  const screen = renderMask(parsed.template, parsed.values).replace(/\n/g, ' | ');
  return step(
    `${p}-show`,
    'O MD mostra a transação pelo modelo (WYSIWYS)',
    'Os dados exibidos vêm do próprio desafio autenticado, e não do computador. É a tela do MD que o usuário compara com o que pretendia fazer: o princípio "o que você vê é o que você assina".',
    `Aplicação da máscara do modelo ${parsed.code} (${parsed.template.name}).`,
    [{ type: 'set', party: 'alice', entry: entry('tela', 'Tela do MD (WYSIWYS)', screen, 'plain') }],
    ['A tela do MD tem de ser conferida com atenção: se o usuário confirmar uma transação fraudulenta, o protocolo a autoriza.'],
  );
}

export function revealStep(p: string, keys: SubKeys, split: SplitChallenge, rHat: string | null): ProtocolStep {
  return step(
    `${p}-reveal`,
    "Alice confirma e o MD decifra r' para mostrar r_hat",
    "Só depois da confirmação explícita o MD decifra r' com k'_{2}. Se o preenchimento ou o formato forem inválidos, o MD não mostra nenhum código.",
    "r_hat = CBC-Dec(k'_{2}, IV, C).",
    [
      compute(
        'alice',
        'Decifragem de r',
        "r_hat = AES-256-CBC-Dec(k'_{2}, IV, C)",
        `r_hat = AES-256-CBC-Dec(${hex(keys.kEnc, 4)}, ${hex(split.rPrime.slice(0, 16), 4)}, ${hex(split.rPrime.slice(16), 4)})`,
        rHat ? `r_hat = ${rHat}` : 'preenchimento inválido: nenhum código é mostrado',
        'secret',
        rHat ? entry('rhat', 'Código r_hat', rHat, 'secret') : undefined,
      ),
    ],
  );
}
