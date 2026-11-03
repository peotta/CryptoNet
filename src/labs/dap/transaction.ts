// Parte C: autorização de uma transferência (código 818) e os ataques de Eva ao UC.
import type { DapEngine } from '../../crypto/engines';
import {
  MAX_ATTEMPTS,
  TTL_SECONDS,
  buildTransData,
  checkFreshness,
  concat,
  drawCode,
  drawIdentifier,
  formatTimestamp,
  parseTimestamp,
  parseTransData,
  splitChallenge,
  submitCode,
  toBase64,
  type Challenge,
  type CustomerRecord,
  type Freshness,
  type PendingTransaction,
  type SplitChallenge,
  type SubmitOutcome,
  type TransParse,
} from '../../crypto/dap';
import { utf8Encode } from '../../crypto/encoding';
import type { ProtocolDefinition, ProtocolStep, SimulationEvent } from '../../simulation/types';
import { ALICE_SLOTS, BOB_SLOTS, bobChallengeSteps, clip, compute, dapParties, entry, hex, mdVerifySteps, revealStep, step, type QrItem } from './common';
import { CUSTOMER_ID, keyset, validateTimes, type Keyset } from './provision';
import type { DapSeeds } from './seeds';

export type TxScenario = 'normal' | 'altera' | 'fraude' | 'forca-bruta' | 'replay';

export interface TxInput {
  scenario: TxScenario;
  seeds: DapSeeds;
  t0: number;
  /** Segundos até Alice ler o QR. */
  scanSec: number;
  /** Segundos, desde a geração, até o código chegar ao e-Bank. */
  typeSec: number;
  /** Relógio do MD menos o tempo real, em segundos. */
  mdOffset: number;
  /** Nome do favorecido digitado por Alice (sem acento, em maiúsculas). */
  payee: string;
  /** Valor em reais, como o usuário digita (por exemplo, 1500,00). */
  amount: string;
}

/** Dados que Eva põe no lugar dos de Alice. */
export const EVA_FIELDS = { account: '000000666666', digit: '1', payee: 'CONTA DE EVA', amount: '0000000900000' };
const BRANCH = '01234';
const ACCOUNT = '000000123456';
const DIGIT = '7';

/** Converte o nome em maiúsculas ASCII (o e-Bank faz isso antes de montar trans_data) e recusa o que o modelo não aceita. */
export function normalizePayee(text: string): string {
  const value = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
  if (!value) throw new Error('Informe o nome do favorecido.');
  if (value.length > 30) throw new Error('O nome do favorecido tem no máximo 30 caracteres.');
  if (!/^[A-Z0-9 ]+$/.test(value)) throw new Error('O favorecido aceita só letras, dígitos e espaço (o caractere ";" e a pontuação não são permitidos).');
  return value;
}

/** Valor em reais (1500, 1500,00 ou 1.500,00) para os 13 dígitos em centavos do modelo 818. */
export function amountToField(text: string): string {
  const t = text.trim().replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) throw new Error('Informe o valor em reais, por exemplo 1500,00.');
  const [int, dec = ''] = t.split('.');
  const cents = `${int}${dec.padEnd(2, '0')}`.replace(/^0+(?=\d)/, '');
  if (cents.length > 13) throw new Error('O valor excede 13 dígitos em centavos.');
  if (/^0+$/.test(cents)) throw new Error('O valor deve ser maior que zero.');
  return cents.padStart(13, '0');
}

export interface GuessResult {
  code: string;
  outcome: SubmitOutcome;
  tx: PendingTransaction;
  atSec: number;
}

export interface TxFlow {
  input: TxInput;
  customer: CustomerRecord;
  keys: Keyset;
  /** Campos que Alice quis (os mesmos mostrados no UC). */
  aliceFields: string[];
  /** Campos que o e-Bank assinou (os de Alice, ou os de Eva quando ela altera o pedido). */
  bankFields: string[];
  ch: Challenge;
  nonce: string;
  generatedAt: number;
  /** Desafio como chegou ao MD (adulterado por Eva no cenário "altera"). */
  received: string;
  forged: boolean;
  split: SplitChallenge | null;
  tag: { yPrime: Uint8Array; equal: boolean } | null;
  parse: TransParse | null;
  fresh: Freshness | null;
  rHat: string | null;
  outcome: SubmitOutcome | null;
  executed: boolean;
  /** Tentativas de Eva no cenário "forca-bruta". */
  guesses: GuessResult[];
  /** Segundo desafio e resultado da repetição do código no cenário "replay". */
  replay: { r2: string; nonce2: string; outcome: SubmitOutcome; atSec: number } | null;
  qrs: QrItem[];
}

export function validateTx(i: TxInput) {
  validateTimes(i.scanSec, i.typeSec);
  if (!Number.isInteger(i.mdOffset) || i.mdOffset < -600 || i.mdOffset > 600) throw new Error('O desvio do relógio do MD deve ser um inteiro de −600 a 600 s.');
}

export async function runTransaction(engine: DapEngine, input: TxInput): Promise<TxFlow> {
  validateTx(input);
  const { seeds, t0, scenario } = input;
  const customer: CustomerRecord = { id: CUSTOMER_ID, keyId: 1, version: 1, keyTimestamp: Math.floor(t0 / 1000) - 86400 };
  const keys = keyset(seeds.k1, await engine.deriveK2(seeds.mk, customer));
  const ts = formatTimestamp(t0);
  const generatedAt = parseTimestamp(ts) as number;
  const aliceFields = [BRANCH, ACCOUNT, DIGIT, normalizePayee(input.payee), amountToField(input.amount), ts];
  const evaPlaced = scenario === 'fraude' || scenario === 'forca-bruta';
  const bankFields = evaPlaced ? [BRANCH, EVA_FIELDS.account, EVA_FIELDS.digit, EVA_FIELDS.payee, EVA_FIELDS.amount, ts] : aliceFields;

  const nonce = drawIdentifier(seeds.tx.nonce);
  const r = drawCode(seeds.tx.rnd);
  const ch = await engine.seal(keys, buildTransData(nonce, '818', bankFields), r, seeds.tx.iv);

  // O que chega ao MD: no cenário "altera", Eva troca os dados dentro do QR sem poder refazer a etiqueta y.
  let received = ch.base64;
  let forged = false;
  if (scenario === 'altera') {
    const evaData = buildTransData(nonce, '818', [BRANCH, EVA_FIELDS.account, EVA_FIELDS.digit, EVA_FIELDS.payee, EVA_FIELDS.amount, ts]);
    received = toBase64(concat(utf8Encode(evaData), ch.rPrime, ch.y));
    forged = true;
  }

  let split: SplitChallenge | null = null;
  let tag: TxFlow['tag'] = null;
  let parse: TransParse | null = null;
  let fresh: Freshness | null = null;
  let rHat: string | null = null;
  let outcome: SubmitOutcome | null = null;
  let pending: PendingTransaction = { r, generatedAt, attempts: 0, status: 'pending' };
  const guesses: GuessResult[] = [];

  if (scenario === 'forca-bruta') {
    // Eva inicia a própria transação com a sessão de Alice e tenta adivinhar r: não tem k'2 para decifrar r'.
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) {
      const code = String((Number(r) + 1 + i * 7919) % 1_000_000).padStart(6, '0');
      const atSec = input.typeSec + i * 2;
      const res = submitCode(pending, code, generatedAt + atSec * 1000);
      pending = res.tx;
      guesses.push({ code, outcome: res.outcome, tx: res.tx, atSec });
      if (res.outcome !== 'wrong') break;
    }
  } else {
    split = splitChallenge(received);
    if (!split) throw new Error('Desafio malformado.');
    tag = await engine.checkTag(keys.kMac, split);
    if (tag.equal) {
      parse = parseTransData(split.transData);
      fresh = parse.ok ? checkFreshness(parse.parsed.generatedAt, generatedAt + (input.scanSec + input.mdOffset) * 1000) : null;
      if (parse.ok && fresh?.state === 'ok' && scenario !== 'fraude') rHat = await engine.reveal(keys.kEnc, split.rPrime);
    }
    if (rHat) {
      const res = submitCode(pending, rHat, generatedAt + input.typeSec * 1000);
      pending = res.tx;
      outcome = res.outcome;
    }
  }

  let replay: TxFlow['replay'] = null;
  if (scenario === 'replay' && outcome === 'executed' && rHat) {
    const nonce2 = drawIdentifier(seeds.tx2.nonce);
    const r2 = drawCode(seeds.tx2.rnd);
    const atSec = input.typeSec + 30;
    replay = { r2, nonce2, outcome: submitCode({ r: r2, generatedAt: generatedAt + (input.typeSec + 10) * 1000, attempts: 0, status: 'pending' }, rHat, generatedAt + atSec * 1000).outcome, atSec };
  }

  const qrs: QrItem[] = [{ stepId: 'send-chal', title: scenario === 'altera' ? 'QR do desafio como sai do e-Bank' : 'QR do desafio (código 818)', text: ch.base64 }];
  if (forged) qrs.push({ stepId: 'eva-alter', title: 'QR adulterado por Eva (a etiqueta y é a antiga)', text: received });
  return { input, customer, keys, aliceFields, bankFields, ch, nonce, generatedAt, received, forged, split, tag, parse, fresh, rHat, outcome, executed: outcome === 'executed', guesses, replay, qrs };
}

const EVA_SLOTS = [
  { key: 'req', label: 'Pedido alterado enviado ao e-Bank', kind: 'plain' as const },
  { key: 'chal', label: 'Desafio que passa pelo UC', kind: 'cipher' as const },
  { key: 'forged', label: 'Desafio adulterado enviado ao MD', kind: 'cipher' as const },
  { key: 'rhat', label: 'Código digitado, visto no UC', kind: 'secret' as const },
  { key: 'guess', label: 'Chute de código', kind: 'secret' as const },
  { key: 'K', label: 'Chave k: desconhecida para Eva', kind: 'secret' as const },
];

const summaryOf = (fields: string[]) => `agência ${fields[0]}, conta ${fields[1]}-${fields[2]}, ${fields[3]}, valor ${Number(fields[4]) / 100}`;

export function buildTransactionProtocol(f: TxFlow): ProtocolDefinition {
  const sc = f.input.scenario;
  const steps: ProtocolStep[] = [];
  const def = (): ProtocolDefinition => ({ id: 'dap-transaction', title: 'DAP: autorização de transação', parties: dapParties(ALICE_SLOTS, BOB_SLOTS, EVA_SLOTS), steps });
  const verdict = (ok: boolean, text: string): SimulationEvent => ({ type: 'verdict', verdict: { ok, text } });
  const ownReq = summaryOf(f.aliceFields);
  const bankReq = summaryOf(f.bankFields);

  steps.push(
    step(
      'setup',
      'Ponto de partida: o MD de Alice já foi ativado',
      'O provisionamento da chave e a ativação (Partes A e B) terminaram. O MD guarda a chave k no armazenamento protegido; o e-Bank guarda só k1, pois k2 se recalcula no HSM. Eva, no UC, não conhece k.',
      'Estado inicial do cadastro.',
      [
        { type: 'set', party: 'alice', entry: entry('k', 'Chave k (armazenamento protegido)', hex(f.keys.k, 6), 'secret') },
        { type: 'set', party: 'bob', entry: entry('k1', 'Metade k_{1} (guardada)', hex(f.keys.k1, 6), 'secret') },
        { type: 'set', party: 'eva', entry: entry('K', 'Chave k: desconhecida para Eva', 'desconhecida', 'secret') },
      ],
    ),
  );

  // Pedido da transação
  if (sc === 'fraude') {
    steps.push(
      step(
        'request',
        'Alice pede a transferência no UC, que é de Eva',
        `Alice autentica-se e preenche o pedido: ${ownReq}. O malware no navegador (ataque Man-in-the-Browser) lê o pedido antes de ele sair do computador.`,
        'Pedido m de Alice.',
        [{ type: 'send', message: { from: 'alice', to: 'eva', label: 'pedido m', summary: ownReq, kind: 'plain' }, deliver: [] }],
      ),
      step(
        'eva-alter-req',
        'Eva troca a conta e o valor do pedido e o envia ao e-Bank',
        'O navegador continua mostrando a Alice os dados dela, mas o pedido que chega ao e-Bank leva a conta de Eva. A sessão é legítima, então o e-Bank o aceita.',
        "Reenvio de m' ao e-Bank.",
        [
          { type: 'set', party: 'eva', entry: entry('req', 'Pedido alterado enviado ao e-Bank', clip(bankReq, 50), 'plain') },
          { type: 'send', message: { from: 'eva', to: 'bob', label: "pedido m'", summary: bankReq, kind: 'plain', tampered: true }, deliver: [] },
        ],
      ),
    );
  } else if (sc === 'forca-bruta') {
    steps.push(
      step(
        'request',
        'Eva inicia a própria transação com a sessão roubada de Alice',
        `Eva controla o UC e, com a sessão aberta, pede uma transferência para a conta dela (${bankReq}). Alice não participa e nem sabe: o celular dela não será usado.`,
        'Pedido iniciado por Eva.',
        [
          { type: 'set', party: 'eva', entry: entry('req', 'Pedido alterado enviado ao e-Bank', clip(bankReq, 50), 'plain') },
          { type: 'send', message: { from: 'eva', to: 'bob', label: 'pedido m', summary: bankReq, kind: 'plain', tampered: true }, deliver: [] },
        ],
      ),
    );
  } else {
    steps.push(
      step(
        'request',
        'Alice faz login e pede a transferência pelo UC',
        `Alice se autentica no e-Bank e pede a transferência: ${ownReq}. O pedido atravessa o UC e Eva o lê. A sessão autenticada sozinha nunca autoriza uma transação financeira no DAP.`,
        'Pedido m (login e transação).',
        [{ type: 'send', message: { from: 'alice', to: 'bob', label: 'pedido m', summary: ownReq, kind: 'plain', observers: ['eva'] }, deliver: [] }],
      ),
    );
  }

  steps.push(
    step(
      'bob-k',
      'O HSM recompõe a chave k do usuário',
      'Para cada desafio, o HSM recalcula k2 a partir da chave-mestra, combina com a k1 guardada, obtém k = k1 ⊕ k2 e descarta k2 e k da memória de trabalho depois de usá-las.',
      'k = k1 ⊕ HMAC-SHA-512(MK, x).',
      [
        { type: 'set', party: 'bob', entry: entry('k2', 'Metade k_{2} (recalculada no HSM)', hex(f.keys.k2, 6), 'secret') },
        compute('bob', 'Recomposição de k no HSM', 'k = k_{1} ⊕ k_{2}', `k = ${hex(f.keys.k1, 4)} ⊕ ${hex(f.keys.k2, 4)}`, `k = ${hex(f.keys.k, 6)}`, 'secret', entry('k', 'Chave k (só dentro do HSM)', hex(f.keys.k, 6), 'secret')),
      ],
    ),
    ...bobChallengeSteps({
      p: 'tx',
      ch: f.ch,
      nonce: f.nonce,
      keys: f.keys,
      what: 'O modelo do código 818 (transferência entre contas correntes) define os campos: agência, conta, dígito, favorecido, valor e carimbo de geração.',
      fieldsNote: 'O e-Bank confere que nenhum campo contém ";" e converte nomes para maiúsculas ASCII.',
    }),
  );

  // Entrega do desafio
  if (sc === 'forca-bruta') {
    steps.push(
      step(
        'send-chal',
        'O e-Bank entrega o QR do desafio ao UC, que é de Eva',
        'O QR aparece na tela de Eva. Ela o vê, mas não tem k\'1 para fabricar outro nem k\'2 para decifrar r\'. Só o celular de Alice poderia mostrar r_hat, e Alice não sabe de nada.',
        'Canal da Internet (UC).',
        [{ type: 'send', message: { from: 'bob', to: 'eva', label: 'QR(desafio)', summary: clip(f.ch.base64, 60), kind: 'cipher' }, deliver: [entry('chal', 'Desafio que passa pelo UC', hex(f.ch.base64, 10), 'cipher')] }],
      ),
    );
    f.guesses.forEach((g, i) => {
      const n = i + 1;
      steps.push(
        step(
          `guess-${n}`,
          `Eva chuta o código (tentativa ${n})`,
          'Sem poder decifrar r\', Eva só pode tentar um dos 10^6 códigos possíveis. Cada tentativa tem chance de 10^-6.',
          `Envio do chute ${n}.`,
          [
            { type: 'set', party: 'eva', entry: entry('guess', 'Chute de código', g.code, 'secret') },
            { type: 'send', message: { from: 'eva', to: 'bob', label: 'r_hat', summary: `chute ${g.code}`, kind: 'secret', tampered: true }, deliver: [] },
          ],
        ),
        step(
          `compare-${n}`,
          g.outcome === 'wrong' ? `O e-Bank recusa o chute ${n}` : g.outcome === 'locked' ? 'Na terceira falha o e-Bank cancela a transação' : 'O e-Bank fecha a transação',
          `O e-Bank compara em tempo constante e conta ${g.tx.attempts} falha${g.tx.attempts === 1 ? '' : 's'}. Depois de ${MAX_ATTEMPTS} falhas ele invalida o desafio e cancela a transação, o que limita Eva a ${MAX_ATTEMPTS} chances em um milhão.`,
          'r_hat = r? (até 3 tentativas)',
          [
            compute(
              'bob',
              `Comparação ${n}`,
              'r_hat = r ?',
              `r_hat = ${g.code}, tentativas anteriores = ${g.tx.attempts - (g.outcome === 'expired' ? 0 : 1)}`,
              g.outcome === 'wrong' ? 'diferentes: conta uma falha' : g.outcome === 'locked' ? 'diferentes: 3ª falha, desafio invalidado' : g.outcome === 'expired' ? 'prazo vencido: transação cancelada' : 'executado',
              'param',
              entry('res', 'Situação da transação', g.tx.status === 'cancelled' ? `cancelada (${g.tx.attempts} falhas)` : `pendente (${g.tx.attempts} falha${g.tx.attempts === 1 ? '' : 's'})`, 'param'),
            ),
            ...(g.outcome !== 'wrong'
              ? [
                  verdict(
                    g.outcome === 'executed',
                    g.outcome === 'locked'
                      ? 'Ataque barrado: depois de 3 chutes errados o e-Bank cancelou a transação. A chance de Eva acertar em 3 tentativas é de 3 × 10^-6.'
                      : g.outcome === 'expired'
                        ? `Ataque barrado: o prazo de ${TTL_SECONDS} s venceu e a transação foi cancelada.`
                        : 'Eva acertou o código por sorte (probabilidade de 10^-6).',
                  ),
                ]
              : []),
          ],
        ),
      );
    });
    return def();
  }

  if (sc === 'altera') {
    steps.push(
      step(
        'send-chal',
        'O e-Bank entrega o QR do desafio ao UC, que é de Eva',
        'O QR do desafio atravessa o computador comprometido. Eva o lê inteiro, pois trans_data vai em claro.',
        'Canal da Internet (UC).',
        [{ type: 'send', message: { from: 'bob', to: 'eva', label: 'QR(desafio)', summary: clip(f.ch.base64, 60), kind: 'cipher' }, deliver: [entry('chal', 'Desafio que passa pelo UC', hex(f.ch.base64, 10), 'cipher')] }],
      ),
      step(
        'eva-alter',
        'Eva troca os dados dentro do QR e mostra o QR alterado',
        'Eva altera a conta, o favorecido e o valor em trans_data e mantém r\' e y. Ela não conhece k\'1 e não consegue recalcular a etiqueta para o novo conteúdo.',
        "Substituição de trans_data por trans_data' (a etiqueta y fica a antiga).",
        [
          { type: 'set', party: 'eva', entry: entry('forged', 'Desafio adulterado enviado ao MD', hex(f.received, 10), 'cipher') },
          { type: 'send', message: { from: 'eva', to: 'alice', label: "QR(desafio')", summary: clip(f.received, 60), kind: 'cipher', tampered: true }, deliver: [] },
        ],
      ),
    );
  } else {
    steps.push(
      step(
        'send-chal',
        'O e-Bank exibe o QR do desafio no UC e Alice o lê com o celular',
        sc === 'fraude'
          ? 'Eva repassa o QR sem alterá-lo, pois não consegue forjar outro. O QR é autêntico e traz a transação de Eva. O UC exibe a Alice a tela dela, mas o QR codifica outra coisa.'
          : 'O QR do desafio aparece na tela do UC. A câmera do MD o lê: o canal é óptico e o MD não precisa de rede. Eva também vê o QR.',
        'Canal da Internet (UC) mais leitura óptica.',
        [{ type: 'send', message: { from: 'bob', to: 'alice', label: 'QR(desafio)', summary: clip(f.ch.base64, 60), kind: 'cipher', observers: ['eva'] }, deliver: [], observerEntries: [entry('chal', 'Desafio que passa pelo UC', hex(f.ch.base64, 10), 'cipher')] }],
      ),
    );
  }

  // Verificação no MD
  const split = f.split as SplitChallenge;
  const md = mdVerifySteps({ p: 'tx', split, tag: f.tag as NonNullable<TxFlow['tag']>, keys: f.keys, parse: f.parse as TransParse, fresh: f.fresh, mdOffset: f.input.mdOffset, scanSec: f.input.scanSec, rHat: f.rHat });
  steps.push(...md.steps);
  if (md.failure) return def();

  if (sc === 'fraude') {
    steps.push(
      step(
        'alice-cancel',
        'Alice vê a conta de Eva na tela do MD e cancela',
        `O MD mostra os dados reais autenticados (${bankReq}), diferentes do que Alice digitou (${ownReq}). Ela toca em Cancelar. O MD descarta o desafio e nunca decifra r\', então nenhum código é mostrado.`,
        'Cancelamento no MD.',
        [{ type: 'set', party: 'alice', entry: entry('rhat', 'Código r_hat', 'não mostrado (cancelado)', 'secret') }],
        ['O MD não fala com o e-Bank: ele não avisa do cancelamento. O usuário deve também cancelar no UC ou deixar o prazo vencer.'],
      ),
      step(
        'bob-timeout',
        `O prazo de ${TTL_SECONDS} s vence e o e-Bank cancela a transação`,
        'Sem um r_hat correto dentro do prazo, o e-Bank cancela automaticamente a transação e invalida r. O malware conseguiu alterar o pedido, mas não conseguiu autorizá-lo.',
        'Timeout do desafio.',
        [
          { type: 'set', party: 'bob', entry: entry('res', 'Situação da transação', `cancelada (prazo de ${TTL_SECONDS} s)`, 'param') },
          verdict(false, 'Ataque barrado: a tela confiável do MD revelou a conta de Eva e Alice cancelou. Sem o código r_hat, o e-Bank não executa a transação.'),
        ],
      ),
    );
    return def();
  }

  steps.push(
    revealStep('tx', f.keys, split, f.rHat),
    step(
      'type-rhat',
      'Alice digita r_hat no UC e o UC o envia ao e-Bank',
      'O usuário digita o código no navegador, que o envia ao e-Bank. Como o UC é de Eva, ela vê o código digitado, mas ele vale só para esta transação e por um prazo curto.',
      'Entrada de r_hat no UC.',
      [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: 'r_hat', summary: `código ${f.rHat}`, kind: 'secret', observers: ['eva'] },
          deliver: [],
          observerEntries: [entry('rhat', 'Código digitado, visto no UC', f.rHat ?? '', 'secret')],
        },
      ],
    ),
    step(
      'bob-compare',
      'O e-Bank confere o prazo e compara r_hat com r',
      `O e-Bank verifica o prazo de ${TTL_SECONDS} s com o próprio relógio, que é a autoridade, e compara r_hat com o r daquela transação em tempo constante. Se forem iguais, executa a transação e invalida r no ato.`,
      'Dentro de 120 s? r_hat = r?',
      [
        compute(
          'bob',
          'Conferência do código',
          'r_hat = r ?',
          `r_hat = ${f.rHat}, r = ${f.ch.r}, ${f.input.typeSec} s depois da geração`,
          f.outcome === 'executed' ? 'iguais, dentro do prazo: executa e invalida r' : f.outcome === 'expired' ? `prazo de ${TTL_SECONDS} s vencido: cancela` : 'diferentes',
          'param',
          entry('res', 'Situação da transação', f.outcome === 'executed' ? 'executada; r invalidado' : 'cancelada (prazo)', 'param'),
        ),
        ...(sc === 'replay' && f.replay
          ? []
          : [
              verdict(
                f.executed,
                f.executed
                  ? 'Transação autorizada: o MD autenticou o desafio, Alice conferiu os dados na tela confiável e o e-Bank validou o código dentro do prazo.'
                  : `Transação cancelada: o código chegou ${f.input.typeSec} s depois da geração e o prazo é de ${TTL_SECONDS} s. O usuário inicia nova transação.`,
              ),
            ]),
      ],
    ),
  );

  if (sc === 'replay' && f.replay) {
    const rp = f.replay;
    steps.push(
      step(
        'eva-tx2',
        'Eva abre uma segunda transação com a sessão de Alice',
        'Eva guardou o r_hat que viu no UC e tenta usá-lo em outra transação, mais cara, para a conta dela.',
        'Novo pedido m2 de Eva.',
        [
          { type: 'set', party: 'eva', entry: entry('req', 'Pedido alterado enviado ao e-Bank', 'outra transação m2 (conta de Eva)', 'plain') },
          { type: 'send', message: { from: 'eva', to: 'bob', label: 'pedido m2', summary: 'nova transferência para a conta de Eva', kind: 'plain', tampered: true }, deliver: [] },
        ],
      ),
      step(
        'bob-chal2',
        'O e-Bank gera um desafio novo, com outro r',
        `Cada transação ganha o seu Nonce (${rp.nonce2}) e o seu código r2, sorteado de novo. O r da primeira transação não vale mais para nada.`,
        'Nonce2 e r2 sorteados.',
        [compute('bob', 'Novo código', 'r_{2} ← {000000, …, 999999}', `Nonce2 = ${rp.nonce2}`, `r_{2} = ${rp.r2}`, 'secret', entry('r', 'Código r', rp.r2, 'secret'))],
      ),
      step(
        'eva-replay',
        'Eva reapresenta o r_hat capturado',
        'Eva envia ao e-Bank o código que viu antes.',
        'Reapresentação de r_hat.',
        [
          { type: 'set', party: 'eva', entry: entry('guess', 'Chute de código', f.rHat ?? '', 'secret') },
          { type: 'send', message: { from: 'eva', to: 'bob', label: 'r_hat', summary: `código ${f.rHat} (repetido)`, kind: 'secret', tampered: true }, deliver: [] },
        ],
      ),
      step(
        'bob-compare2',
        'O e-Bank rejeita o código repetido',
        'O código está ligado a uma única transação e é invalidado quando usado. Contra a segunda transação, ele é só um chute de 1 em 10^6.',
        'r_hat = r2?',
        [
          compute('bob', 'Conferência da segunda transação', 'r_hat = r_{2} ?', `r_hat = ${f.rHat}, r_{2} = ${rp.r2}`, rp.outcome === 'executed' ? 'iguais (coincidência)' : 'diferentes: conta uma falha', 'param', entry('res', 'Situação da transação', 'segunda transação: código recusado', 'param')),
          verdict(false, 'A transação de Alice foi executada, mas o código capturado por Eva não autoriza outra transação: r é de uso único e cada desafio tem o seu.'),
        ],
      ),
    );
  }
  return def();
}
