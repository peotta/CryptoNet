// Partes A e B: provisionamento da chave por duas metades (Internet e ATM) e ativação com o código 000.
import type { DapEngine } from '../../crypto/engines';
import {
  TTL_SECONDS,
  buildTransData,
  checkFreshness,
  drawCode,
  drawIdentifier,
  formatTimestamp,
  parseTimestamp,
  parseTransData,
  splitChallenge,
  splitKey,
  submitCode,
  xorBytes,
  type Challenge,
  type CustomerRecord,
  type Freshness,
  type ShareParse,
  type SubKeys,
  type SubmitOutcome,
  type TransParse,
} from '../../crypto/dap';
import type { ProtocolDefinition, ProtocolStep, SimulationEvent } from '../../simulation/types';
import { ALICE_SLOTS, BOB_SLOTS, bobChallengeSteps, clip, compute, dapParties, entry, hex, mdVerifySteps, revealStep, step, type QrItem } from './common';
import type { DapSeeds } from './seeds';

export type ProvisionScenario = 'normal' | 'substitui' | 've-k2';

export interface ProvisionInput {
  scenario: ProvisionScenario;
  seeds: DapSeeds;
  /** Instante de geração da ativação, em ms desde 1970. */
  t0: number;
  /** Segundos até Alice ler o QR de ativação. */
  scanSec: number;
  /** Segundos até o código chegar ao e-Bank (contados da geração). */
  typeSec: number;
}

export interface Keyset extends SubKeys {
  k1: Uint8Array;
  k2: Uint8Array;
  k: Uint8Array;
}

export interface ProvisionFlow {
  input: ProvisionInput;
  customer: CustomerRecord;
  enroll: string;
  /** Chave no servidor (k1 guardada e k2 recalculada no HSM). */
  bob: Keyset;
  /** Chave no celular (k1 lida do QR, que Eva pode ter trocado). */
  alice: Keyset;
  qr1: string;
  /** QR de k1 como Alice o leu. */
  qr1Alice: string;
  qr2: string;
  parse1: ShareParse;
  parse2: ShareParse;
  act: Challenge;
  actNonce: string;
  generatedAt: number;
  tag: { yPrime: Uint8Array; equal: boolean };
  parse: TransParse;
  fresh: Freshness;
  rHat: string | null;
  outcome: SubmitOutcome | null;
  activated: boolean;
  /** Chave que Eva calculou (somente se viu as duas metades). */
  evaK: Uint8Array | null;
  qrs: QrItem[];
}

export const keyset = (k1: Uint8Array, k2: Uint8Array): Keyset => {
  const k = xorBytes(k1, k2);
  return { k1, k2, k, ...splitKey(k) };
};

export const CUSTOMER_ID = '12345678901';

export function validateTimes(scanSec: number, typeSec: number) {
  if (!Number.isInteger(scanSec) || scanSec < 0 || scanSec > 600) throw new Error('O tempo até a leitura do QR deve ser um inteiro de 0 a 600 s.');
  if (!Number.isInteger(typeSec) || typeSec < scanSec || typeSec > 600) throw new Error('O código deve chegar ao e-Bank depois da leitura do QR, em no máximo 600 s.');
}

export async function runProvision(engine: DapEngine, input: ProvisionInput): Promise<ProvisionFlow> {
  validateTimes(input.scanSec, input.typeSec);
  const { seeds, t0 } = input;
  const customer: CustomerRecord = { id: CUSTOMER_ID, keyId: 1, version: 1, keyTimestamp: Math.floor(t0 / 1000) - 60 };
  const enroll = drawIdentifier(seeds.enrollSrc);
  const k2 = await engine.deriveK2(seeds.mk, customer);
  const bob = keyset(seeds.k1, k2);

  const qr1 = await engine.encodeShare({ share: '1', enroll, value: seeds.k1 });
  const swapped = input.scenario === 'substitui';
  const k1Alice = swapped ? seeds.evaK1 : seeds.k1;
  const qr1Alice = swapped ? await engine.encodeShare({ share: '1', enroll, value: k1Alice }) : qr1;
  const qr2 = await engine.encodeShare({ share: '2', enroll, value: k2 });
  const parse1 = await engine.parseShare(qr1Alice);
  const parse2 = await engine.parseShare(qr2);
  const alice = keyset(k1Alice, k2);

  // Ativação: desafio com o código 000, montado pelo e-Bank com a chave que ele tem.
  const generatedAt = parseTimestamp(formatTimestamp(t0)) as number;
  const actNonce = drawIdentifier(seeds.act.nonce);
  const r = drawCode(seeds.act.rnd);
  const transData = buildTransData(actNonce, '000', ['ATIVACAO DO DAP', formatTimestamp(t0)]);
  const act = await engine.seal(bob, transData, r, seeds.act.iv);

  const split = splitChallenge(act.base64);
  if (!split) throw new Error('Desafio de ativação malformado.');
  const tag = await engine.checkTag(alice.kMac, split);
  const parse = parseTransData(split.transData);
  const fresh = checkFreshness(generatedAt, generatedAt + input.scanSec * 1000);
  const proceed = tag.equal && parse.ok && fresh.state === 'ok';
  const rHat = proceed ? await engine.reveal(alice.kEnc, split.rPrime) : null;
  let outcome: SubmitOutcome | null = null;
  if (rHat) outcome = submitCode({ r, generatedAt, attempts: 0, status: 'pending' }, rHat, generatedAt + input.typeSec * 1000).outcome;

  const evaK = input.scenario === 've-k2' ? xorBytes(seeds.k1, k2) : null;
  const qrs: QrItem[] = [
    { stepId: 'send-k1', title: swapped ? 'QR de k1 como sai do e-Bank' : 'QR de k1 (código 001, Share 1)', text: qr1 },
    ...(swapped ? [{ stepId: 'eva-swap', title: 'QR de k1 trocado por Eva', text: qr1Alice }] : []),
    { stepId: 'send-k2', title: 'QR de k2 no ATM (código 001, Share 2)', text: qr2 },
    { stepId: 'send-act', title: 'QR do desafio de ativação (código 000)', text: act.base64 },
  ];
  return { input, customer, enroll, bob, alice, qr1, qr1Alice, qr2, parse1, parse2, act, actNonce, generatedAt, tag, parse, fresh, rHat, outcome, activated: outcome === 'executed', evaK, qrs };
}

const EVA_SLOTS = [
  { key: 'k1', label: 'Metade k_{1} vista na tela do UC', kind: 'secret' as const },
  { key: 'k1e', label: 'Metade k_{1} trocada por Eva', kind: 'secret' as const },
  { key: 'k2', label: 'Metade k_{2} (só se Eva viu o ATM)', kind: 'secret' as const },
  { key: 'k', label: 'Chave k calculada por Eva', kind: 'secret' as const },
];

function buildFullProvision(f: ProvisionFlow): ProtocolDefinition {
  const sc = f.input.scenario;
  const swapped = sc === 'substitui';
  const steps: ProtocolStep[] = [];
  const qr1Entry = (label = 'Metade k_{1} vista na tela do UC') => entry('k1', label, hex(f.bob.k1, 6), 'secret');

  steps.push(
    step(
      'request',
      'Alice pede o cadastro do celular pela Internet',
      'Alice se autentica no e-Bank pelo computador (UC), pede a inclusão do celular como segundo fator e instala o aplicativo. Tudo passa pelo UC, que Eva controla: o pedido é visível a ela, mas não contém segredo.',
      'Pedido de cadastro (Passo 1).',
      [{ type: 'send', message: { from: 'alice', to: 'bob', label: 'cadastro do MD', summary: 'Autenticação do usuário e pedido de cadastro do celular', kind: 'plain', observers: ['eva'] }, deliver: [] }],
    ),
    step(
      'bob-k1',
      'Bob sorteia a metade k1 de 512 bits e a guarda',
      'O e-Bank gera k1 com um gerador de números aleatórios seguro, de distribuição uniforme em {0,1}^512, e a guarda no registro do usuário. Só k1 fica no banco de dados: a chave k completa nunca é guardada.',
      'k1 ← {0,1}^512.',
      [compute('bob', 'Sorteio de k_{1}', 'k_{1} ← {0,1}^{512}', 'gerador aleatório seguro (CSPRNG)', `k_{1} = ${hex(f.bob.k1, 6)}`, 'secret', entry('k1', 'Metade k_{1} (guardada)', hex(f.bob.k1, 6), 'secret'))],
    ),
    step(
      'bob-k2',
      'O HSM calcula a metade k2 com a chave-mestra MK',
      'O HSM deriva k2 por HMAC-SHA-512 com a chave-mestra MK, que nunca sai do módulo. A entrada x contém o rótulo "DAP-k2-v1", o key_id, a versão, o tamanho e o valor do ID do usuário e o carimbo de cadastro (inteiros em ordem de rede).',
      'k2 = HMAC-SHA-512(MK, label | key_id | version | len(ID) | ID | key_timestamp).',
      [
        compute(
          'bob',
          'Derivação de k_{2} no HSM',
          'k_{2} = HMAC-SHA-512(MK, x)',
          `x = "DAP-k2-v1" | ${f.customer.keyId} | ${f.customer.version} | len(ID)=${f.customer.id.length} | ID | ${f.customer.keyTimestamp}`,
          `k_{2} = ${hex(f.bob.k2, 6)}`,
          'secret',
          entry('k2', 'Metade k_{2} (recalculada no HSM)', hex(f.bob.k2, 6), 'secret'),
        ),
      ],
      ['k2 pode ser recalculada sempre que preciso. Por isso o servidor não precisa guardá-la.'],
    ),
  );

  // Metade 1 pelo UC
  if (!swapped) {
    steps.push(
      step(
        'send-k1',
        'Bob exibe o QR de k1 no UC e Alice o lê com o celular',
        'O e-Bank devolve k1 em um QR code de código 001 (Share 1). A câmera do MD lê a tela do UC: o canal é óptico e não usa rede. Como o UC é de Eva, ela também vê k1.',
        'Canal da Internet (UC) mais leitura óptica.',
        [
          {
            type: 'send',
            message: { from: 'bob', to: 'alice', label: 'QR(k_{1})', summary: clip(f.qr1, 60), kind: 'secret', observers: ['eva'] },
            deliver: [entry('k1', 'Metade k_{1} (temporária)', hex(f.bob.k1, 6), 'secret')],
            observerEntries: [qr1Entry()],
          },
        ],
        ['Uma só metade não revela nada sobre k: k1 é uniforme e k2 depende da chave-mestra.'],
      ),
    );
  } else {
    steps.push(
      step(
        'send-k1',
        'Bob exibe o QR de k1 no UC, que é de Eva',
        'O e-Bank devolve k1 no QR code 001. Como o UC está sob controle de Eva, é ela quem o recebe primeiro.',
        'Canal da Internet (UC).',
        [{ type: 'send', message: { from: 'bob', to: 'eva', label: 'QR(k_{1})', summary: clip(f.qr1, 60), kind: 'secret' }, deliver: [qr1Entry()] }],
      ),
      step(
        'eva-swap',
        'Eva troca k1 por um valor dela e exibe o QR alterado',
        'Eva sorteia uma metade k1\' e monta um QR válido (mesmo Enroll, Check correto, pois o Check não é secreto). O QR do código 001 não tem etiqueta: o MD não consegue notar a troca.',
        'k1\' no lugar de k1.',
        [
          { type: 'set', party: 'eva', entry: entry('k1e', 'Metade k_{1} trocada por Eva', hex(f.alice.k1, 6), 'secret') },
          {
            type: 'send',
            message: { from: 'eva', to: 'alice', label: "QR(k_{1}')", summary: clip(f.qr1Alice, 60), kind: 'secret', tampered: true },
            deliver: [entry('k1', 'Metade k_{1} (temporária)', hex(f.alice.k1, 6), 'secret')],
          },
        ],
      ),
    );
  }

  steps.push(
    step(
      'alice-check1',
      'O MD valida o QR da primeira metade',
      'O MD confere se o texto tem seis campos, se a versão é suportada, se o código é 001, se o Value decodifica para 64 octetos e se o Check (primeiros 4 octetos do SHA-256) confere. O Check só detecta erro de leitura: não protege contra um adversário.',
      'Seis campos, Version, Code = 001, |Value| = 64 octetos, Check correto.',
      [
        compute(
          'alice',
          'Validação do QR 001',
          'Check = SHA-256(Version ; … ; Value)[0..3]',
          `Check recebido = ${f.parse1.ok ? f.parse1.check : '?'}`,
          f.parse1.ok ? 'QR aceito; guarda a metade 1 com seu Enroll' : f.parse1.message,
          'param',
        ),
      ],
    ),
    step(
      'atm-auth',
      'Alice se identifica no ATM com o cartão e a senha',
      'O ATM é um terminal do banco em rede dedicada, que Eva não controla. O cartão inteligente e a senha (PIN) autenticam Alice fisicamente. Se o e-Bank não tivesse iniciado a inscrição pela Internet, ele não exibiria k2.',
      'Autenticação no ATM (Passo 4).',
      [{ type: 'send', message: { from: 'alice', to: 'bob', label: 'cartão + PIN', summary: 'Autenticação física no ATM', kind: 'private' }, deliver: [] }],
    ),
    step(
      'send-k2',
      sc === 've-k2' ? 'O ATM exibe o QR de k2 e uma câmera oculta de Eva o grava' : 'O ATM exibe o QR de k2 e Alice o lê com o celular',
      sc === 've-k2'
        ? 'O QR de k2 aparece uma única vez na tela do ATM. Aqui a hipótese de segurança é violada: Eva tem uma câmera oculta e vê a segunda metade. Com k1 (do UC) e k2, ela possui as duas metades.'
        : 'O ATM exibe o QR do código 001 (Share 2) uma única vez e por pouco tempo. A leitura é óptica e a rede do banco, dedicada, não é observada por Eva.',
      'Canal do ATM mais leitura óptica.',
      [
        {
          type: 'send',
          message: { from: 'bob', to: 'alice', label: 'QR(k_{2})', summary: clip(f.qr2, 60), kind: 'secret', observers: sc === 've-k2' ? ['eva'] : [] },
          deliver: [entry('k2', 'Metade k_{2} (temporária)', hex(f.bob.k2, 6), 'secret')],
          observerEntries: [entry('k2', 'Metade k_{2} (só se Eva viu o ATM)', hex(f.bob.k2, 6), 'secret')],
        },
      ],
    ),
    step(
      'alice-check2',
      'O MD valida o QR da segunda metade e o Enroll',
      'As mesmas validações do primeiro QR, mais duas: o Share deve ser diferente do já guardado e o Enroll deve ser igual. Assim o MD não combina metades de inscrições distintas.',
      'Share 1 + Share 2 e o mesmo Enroll.',
      [
        compute(
          'alice',
          'Validação do segundo QR 001',
          'Enroll_{1} = Enroll_{2}, Share_{1} ≠ Share_{2}',
          `Enroll = ${f.enroll}`,
          f.parse2.ok ? 'QR aceito; as duas metades podem ser combinadas' : f.parse2.message,
          'param',
        ),
      ],
    ),
  );

  if (sc === 've-k2') {
    steps.push(
      step(
        'eva-k',
        'Eva combina as duas metades que viu e obtém a chave k',
        'Pelo argumento do one-time pad, cada metade sozinha não revela nada. Com as duas, k = k1 ⊕ k2 é calculada sem esforço. Por isso o ATM deve exibir k2 uma só vez, por pouco tempo e com tela protegida.',
        'k = k1 ⊕ k2 (Eva).',
        [
          compute(
            'eva',
            'Eva calcula k',
            'k = k_{1} ⊕ k_{2}',
            `k = ${hex(f.bob.k1, 4)} ⊕ ${hex(f.bob.k2, 4)}`,
            `k = ${hex(f.evaK as Uint8Array, 6)}`,
            'secret',
            entry('k', 'Chave k calculada por Eva', hex(f.evaK as Uint8Array, 6), 'secret'),
          ),
        ],
      ),
    );
  }

  steps.push(
    step(
      'alice-k',
      'O MD calcula a chave k = k1 ⊕ k2',
      'O MD combina as duas metades (512 bits cada). A chave k nunca trafegou inteira por nenhum canal.',
      'k = k1 ⊕ k2.',
      [
        compute(
          'alice',
          'Combinação das metades',
          'k = k_{1} ⊕ k_{2}',
          `k = ${hex(f.alice.k1, 4)} ⊕ ${hex(f.alice.k2, 4)}`,
          `k = ${hex(f.alice.k, 6)}`,
          'secret',
          entry('k', 'Chave k (armazenamento protegido)', hex(f.alice.k, 6), 'secret'),
        ),
      ],
      swapped ? ['Como a metade k1 foi trocada, a chave do MD já é diferente da do e-Bank. O MD não tem como perceber.'] : undefined,
    ),
    step(
      'alice-split',
      "O MD separa k'1 e k'2 e apaga k1 e k2 da memória",
      "Os 32 primeiros octetos de k formam k'_{1}, a chave do HMAC-SHA-256. Os 32 últimos formam k'_{2}, a chave do AES-256-CBC. A chave fica no armazenamento protegido do aplicativo (não exportável, fora de backups) e as duas metades são zeradas.",
      "k'_{1} = k[0..31]; k'_{2} = k[32..63].",
      [
        compute('alice', 'Partição da chave', "(k'_{1}, k'_{2}) = k", `k'_{1} = ${hex(f.alice.kMac, 4)}; k'_{2} = ${hex(f.alice.kEnc, 4)}`, 'k_{1} e k_{2} zerados', 'secret'),
        { type: 'set', party: 'alice', entry: entry('k1', 'Metade k_{1} (temporária)', 'zerada', 'secret') },
        { type: 'set', party: 'alice', entry: entry('k2', 'Metade k_{2} (temporária)', 'zerada', 'secret') },
      ],
    ),
    step(
      'bob-key',
      'O e-Bank combina k1 e k2 no HSM para a ativação',
      'O e-Bank só marca o MD como habilitado depois de uma ativação bem-sucedida, que prova que os dois têm a mesma chave. Para montar o desafio, o HSM recompõe k = k1 ⊕ k2 com a sua cópia e descarta k2 e k da memória de trabalho.',
      'k = k1 ⊕ k2 (no HSM).',
      [compute('bob', 'Recomposição de k', 'k = k_{1} ⊕ k_{2}', `k = ${hex(f.bob.k1, 4)} ⊕ ${hex(f.bob.k2, 4)}`, `k = ${hex(f.bob.k, 6)}`, 'secret', entry('k', 'Chave k (só dentro do HSM)', hex(f.bob.k, 6), 'secret'))],
    ),
    ...bobChallengeSteps({
      p: 'act',
      ch: f.act,
      nonce: f.actNonce,
      keys: f.bob,
      what: 'O desafio de ativação usa o código 000: o modelo não tem campos financeiros, só uma mensagem e o carimbo de geração.',
      fieldsNote: 'Os campos da ativação são a mensagem e o carimbo.',
    }),
    step(
      'send-act',
      'O ATM exibe o desafio de ativação e Alice o lê',
      'O desafio, no formato trans_data | r\' | y, aparece como QR code na tela do ATM. A leitura é óptica.',
      'Canal do ATM mais leitura óptica.',
      [{ type: 'send', message: { from: 'bob', to: 'alice', label: 'QR(000)', summary: clip(f.act.base64, 60), kind: 'cipher' }, deliver: [] }],
    ),
  );

  const split = splitChallenge(f.act.base64) as NonNullable<ReturnType<typeof splitChallenge>>;
  const md = mdVerifySteps({ p: 'act', split, tag: f.tag, keys: f.alice, parse: f.parse, fresh: f.fresh, mdOffset: 0, scanSec: f.input.scanSec, rHat: f.rHat });
  steps.push(...md.steps);

  if (!f.tag.equal) {
    const lastStep = steps[steps.length - 1];
    lastStep.events = lastStep.events.filter((e) => e.type !== 'verdict');
    lastStep.events.push({
      type: 'verdict',
      verdict: {
        ok: false,
        text: swapped
          ? 'Ativação falhou: Eva trocou k1, então o MD e o e-Bank têm chaves diferentes e a etiqueta y não confere. O e-Bank não habilita o MD e o usuário refaz o cadastro. O Check do QR não detecta a troca.'
          : 'Ativação falhou: a etiqueta y não confere.',
      },
    });
    return { id: 'dap-provision', title: 'DAP: provisionamento e ativação', parties: dapParties(ALICE_SLOTS, BOB_SLOTS, EVA_SLOTS), steps };
  }
  if (md.failure) return { id: 'dap-provision', title: 'DAP: provisionamento e ativação', parties: dapParties(ALICE_SLOTS, BOB_SLOTS, EVA_SLOTS), steps };

  steps.push(
    revealStep('act', f.alice, split, f.rHat),
    step(
      'type-rhat',
      'Alice digita r_hat no teclado do ATM',
      'O usuário digita o código mostrado pelo MD no ATM, que o envia ao e-Bank pela rede dedicada. No ATM não há computador de Eva no caminho.',
      'Entrada de r_hat no ATM.',
      [{ type: 'send', message: { from: 'alice', to: 'bob', label: 'r_hat', summary: `código ${f.rHat}`, kind: 'secret' }, deliver: [] }],
    ),
    step(
      'bob-compare',
      'O e-Bank confere o prazo e compara r_hat com r',
      `O e-Bank verifica se ${TTL_SECONDS} s não passaram (a autoridade do prazo é o servidor) e compara r_hat com r em tempo constante, com até 3 tentativas. Se coincidirem, marca o MD como habilitado.`,
      'Dentro de 120 s? r_hat = r?',
      [
        compute(
          'bob',
          'Conferência da ativação',
          'r_hat = r ?',
          `r_hat = ${f.rHat}, r = ${f.act.r}, ${f.input.typeSec} s depois da geração`,
          f.outcome === 'executed' ? 'iguais, dentro do prazo: MD habilitado' : f.outcome === 'expired' ? `prazo de ${TTL_SECONDS} s vencido` : 'diferentes',
          'param',
          entry('res', 'Situação da transação', f.activated ? 'MD habilitado' : f.outcome === 'expired' ? 'ativação cancelada (prazo)' : 'ativação recusada', 'param'),
        ),
        {
          type: 'verdict',
          verdict: f.activated
            ? {
                ok: !f.evaK,
                text: f.evaK
                  ? 'Ativação concluída, mas Eva viu as duas metades e conhece k: a hipótese de independência das metades foi violada e o segundo fator está comprometido. O banco deveria invalidar a chave e refazer o cadastro.'
                  : 'Ativação concluída: o e-Bank e o MD têm a mesma chave k, e o MD passa a ser um autorizador válido. Eva viu só k1.',
              }
            : { ok: false, text: `Ativação não concluída${f.outcome === 'expired' ? `: o código chegou depois de ${TTL_SECONDS} s` : ''}. O usuário repete o procedimento.` },
        },
      ] as SimulationEvent[],
    ),
  );
  return { id: 'dap-provision', title: 'DAP: provisionamento e ativação', parties: dapParties(ALICE_SLOTS, BOB_SLOTS, EVA_SLOTS), steps };
}


/** Fase da Parte A: a chave (até o MD guardar k), a ativação (confirma que as duas pontas têm a mesma chave) ou as duas juntas. */
export type ProvisionPhase = 'chave' | 'ativacao' | 'completo';

const VERDICT_KEY: Record<ProvisionScenario, (f: ProvisionFlow) => { ok: boolean; text: string }> = {
  normal: () => ({
    ok: true,
    text: 'Chave provisionada: o MD guarda k e apagou k1 e k2. Eva viu só k1, que sozinha nada revela sobre k. Falta a ativação, que confirma que o e-Bank e o MD têm a mesma chave.',
  }),
  substitui: () => ({
    ok: false,
    text: 'O MD aceitou o QR trocado e calculou uma chave diferente da do e-Bank, sem perceber (o Check não protege contra adversário). A troca só será descoberta na ativação.',
  }),
  've-k2': () => ({
    ok: false,
    text: 'Eva viu as duas metades e conhece k: a hipótese de independência das metades foi violada e o segundo fator está comprometido. A ativação não percebe isso.',
  }),
};

export function buildProvisionProtocol(f: ProvisionFlow, phase: ProvisionPhase = 'completo'): ProtocolDefinition {
  const full = buildFullProvision(f);
  if (phase === 'completo') return full;
  const cut = full.steps.findIndex((x) => x.id === 'alice-split') + 1;
  if (phase === 'chave') {
    const steps = full.steps.slice(0, cut).map((x) => ({ ...x, events: [...x.events] }));
    steps[steps.length - 1].events.push({ type: 'verdict', verdict: VERDICT_KEY[f.input.scenario](f) });
    return { ...full, id: 'dap-chave', title: 'DAP: provisionamento da chave', steps };
  }
  // Ativação: parte do estado em que o MD já guarda a chave que calculou.
  const sc = f.input.scenario;
  const setup = step(
    'setup',
    'Ponto de partida: o MD já calculou a chave k',
    'O provisionamento terminou: o MD guarda a chave k no armazenamento protegido e apagou k1 e k2, e o e-Bank guarda só k1, pois k2 se recalcula no HSM. O e-Bank ainda não sabe se o MD tem a chave certa e, por isso, não o trata como autorizador. A ativação confirma isso.',
    'Estado ao fim do provisionamento da chave.',
    [
      { type: 'set', party: 'alice', entry: entry('k', 'Chave k (armazenamento protegido)', hex(f.alice.k, 6), 'secret') },
      { type: 'set', party: 'bob', entry: entry('k1', 'Metade k_{1} (guardada)', hex(f.bob.k1, 6), 'secret') },
      { type: 'set', party: 'bob', entry: entry('res', 'Situação da transação', 'MD ainda não habilitado', 'param') },
      { type: 'set', party: 'eva', entry: entry('k1', 'Metade k_{1} vista na tela do UC', hex(f.bob.k1, 6), 'secret') },
      ...(sc === 'substitui' ? [{ type: 'set' as const, party: 'eva', entry: entry('k1e', 'Metade k_{1} trocada por Eva', hex(f.alice.k1, 6), 'secret') }] : []),
      ...(sc === 've-k2'
        ? [
            { type: 'set' as const, party: 'eva', entry: entry('k2', 'Metade k_{2} (só se Eva viu o ATM)', hex(f.bob.k2, 6), 'secret') },
            { type: 'set' as const, party: 'eva', entry: entry('k', 'Chave k calculada por Eva', hex(f.evaK as Uint8Array, 6), 'secret') },
          ]
        : []),
    ],
    sc === 'substitui' ? ['Neste cenário, Eva trocou k1 no provisionamento: a chave do MD já difere da do e-Bank.'] : sc === 've-k2' ? ['Neste cenário, Eva viu as duas metades no provisionamento e conhece k.'] : undefined,
  );
  return { ...full, id: 'dap-ativacao', title: 'DAP: ativação do dispositivo', steps: [setup, ...full.steps.slice(cut)] };
}
