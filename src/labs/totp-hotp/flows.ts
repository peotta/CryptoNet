import type { OtpAuthEngine } from '../../crypto/engines';
import { base32Encode, DEFAULT_STEP, timeCounter, type OtpAlgo } from '../../crypto/otpAuth';
import { toHex } from '../../crypto/encoding';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition } from '../../simulation/types';

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);

/** Horário legível de um instante Unix, em UTC. */
export const clock = (unixSeconds: number): string => `${new Date(unixSeconds * 1000).toISOString().slice(11, 19)} UTC`;

/** Instante fixo (2 de novembro de 2026, 13:30:10 UTC), usado como padrão e na documentação gerada. */
export const DEFAULT_TIME = Math.floor(Date.UTC(2026, 10, 2, 13, 30, 10) / 1000);
export const WINDOW = 1;
export const LATE_DELAY = 90;
export const REPLAY_DELAY = 5;
export const FORWARD_DELAY = 4;

// ---------------------------------------------------------------------------------------------
// Parte A: o algoritmo, operação por operação (Alice gera o código, Bob o recalcula).
// ---------------------------------------------------------------------------------------------
export interface AlgoInput {
  mode: 'hotp' | 'totp';
  /** Segredo compartilhado, em texto (os vetores das RFCs usam "12345678901234567890"). */
  secret: string;
  counter: number;
  time: number;
  digits: number;
  algo: OtpAlgo;
}

export interface AlgoFlowData extends AlgoInput {
  keyHex: string;
  keyB32: string;
  counterValue: string;
  counterHex: string;
  hmacHex: string;
  hmacBytes: number;
  offset: number;
  fourHex: string;
  maskedHex: string;
  truncated: number;
  modulus: string;
  code: string;
  bobCode: string;
  match: boolean;
}

export async function runAlgo(engine: OtpAuthEngine, input: AlgoInput): Promise<AlgoFlowData> {
  const key = new TextEncoder().encode(input.secret);
  if (key.length === 0) throw new Error('Digite o segredo compartilhado.');
  if (key.length > 64) throw new Error('Use no máximo 64 caracteres no segredo.');
  const trace = input.mode === 'hotp' ? await engine.hotp(key, BigInt(Math.max(0, Math.floor(input.counter))), input.digits, input.algo) : await engine.totp(key, input.time, input.digits, input.algo);
  const again = input.mode === 'hotp' ? await engine.hotp(key, trace.counter, input.digits, input.algo) : await engine.totp(key, input.time, input.digits, input.algo);
  const masked = new Uint8Array(trace.fourBytes);
  masked[0] &= 0x7f;
  return {
    ...input,
    keyHex: toHex(key),
    keyB32: base32Encode(key),
    counterValue: trace.counter.toString(),
    counterHex: toHex(trace.counterBytes),
    hmacHex: toHex(trace.hmac),
    hmacBytes: trace.hmac.length,
    offset: trace.offset,
    fourHex: toHex(trace.fourBytes),
    maskedHex: toHex(masked),
    truncated: trace.truncated,
    modulus: `10^${input.digits}`,
    code: trace.code,
    bobCode: again.code,
    match: trace.code === again.code,
  };
}

const algoParties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Usuária (aplicativo autenticador)',
    position: 'left',
    slots: [
      { key: 'K', label: 'Segredo compartilhado K', kind: 'secret' },
      { key: 'C', label: 'Contador C (8 bytes)', kind: 'param' },
      { key: 'H', label: 'HMAC(K, C)', kind: 'secret' },
      { key: 'S', label: 'Inteiro de 31 bits', kind: 'param' },
      { key: 'code', label: 'Código de uso único', kind: 'signature' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Servidor de autenticação',
    position: 'right',
    slots: [
      { key: 'K', label: 'Segredo compartilhado K', kind: 'secret' },
      { key: 'rx', label: 'Código recebido', kind: 'signature' },
      { key: 'exp', label: 'Código esperado', kind: 'signature' },
    ],
  },
];

export function buildAlgoProtocol(d: AlgoFlowData): ProtocolDefinition {
  const name = d.mode === 'hotp' ? 'HOTP' : 'TOTP';
  const hash = d.algo;
  return {
    id: `otp-algoritmo-${d.mode}`,
    title: `${name}: do segredo ao código de ${d.digits} dígitos`,
    parties: algoParties,
    steps: [
      {
        id: 'share',
        title: 'Alice e Bob compartilham o segredo',
        description: `No cadastro, o servidor gera o segredo K e o entrega por um canal separado, em geral um QR code com o segredo em Base32. Aqui K tem ${d.keyHex.length / 2} bytes e vale ${short(d.keyB32, 20)} em Base32. O segredo nunca mais trafega.`,
        operation: 'Nenhum cálculo: o segredo já é conhecido por Alice e por Bob.',
        events: [
          { type: 'set', party: 'alice', entry: entry('K', 'Segredo compartilhado K', short(d.keyHex, 20), 'secret') },
          { type: 'set', party: 'bob', entry: entry('K', 'Segredo compartilhado K', short(d.keyHex, 20), 'secret') },
        ],
      },
      {
        id: 'counter',
        title: d.mode === 'hotp' ? 'Alice usa o contador de eventos' : 'Alice converte o horário em um contador',
        description:
          d.mode === 'hotp'
            ? 'No HOTP o contador C avança a cada código gerado e precisa estar sincronizado com o do servidor. Ele é escrito em 8 bytes, na ordem big-endian.'
            : 'No TOTP o contador é o número de passos de tempo desde 1.º de janeiro de 1970: C = ⌊T / X⌋, com X = 30 segundos. Assim Alice e Bob chegam ao mesmo C sem trocar nada, desde que os relógios estejam próximos. O contador é escrito em 8 bytes, na ordem big-endian.',
        operation: d.mode === 'hotp' ? 'Codificação do contador em 8 bytes.' : 'Divisão do tempo Unix pelo passo de 30 s e codificação em 8 bytes.',
        events: [
          {
            type: 'compute',
            operation: {
              party: 'alice',
              title: 'Contador',
              formula: d.mode === 'hotp' ? 'C = contador de eventos' : 'C = ⌊T / X⌋',
              substituted: d.mode === 'hotp' ? `C = ${d.counterValue}` : `T = ${d.time} (${clock(d.time)}), X = ${DEFAULT_STEP} s`,
              result: `C = ${d.counterValue} = 0x${d.counterHex}`,
              kind: 'param',
            },
            entry: entry('C', 'Contador C (8 bytes)', d.counterHex, 'param'),
          },
        ],
      },
      {
        id: 'hmac',
        title: `Alice calcula o HMAC-${hash}`,
        description: `O contador é autenticado com o segredo: H = HMAC(K, C). Com ${hash} o resultado tem ${d.hmacBytes} bytes. Sem K ninguém prevê H, e é essa imprevisibilidade que protege o código.`,
        operation: `HMAC-${hash} do contador com a chave K.`,
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'HMAC', formula: `H = HMAC-${hash}(K, C)`, substituted: `K = ${short(d.keyHex, 12)}, C = ${d.counterHex}`, result: `H = ${short(d.hmacHex, 24)}`, kind: 'secret' },
            entry: entry('H', 'HMAC(K, C)', short(d.hmacHex, 24), 'secret'),
          },
        ],
      },
      {
        id: 'offset',
        title: 'Alice escolhe a posição do truncamento',
        description: `O truncamento dinâmico usa o último byte de H: seus 4 bits menos significativos dão o deslocamento. O último byte é 0x${d.hmacHex.slice(-2)}, então o deslocamento é ${d.offset}. Como o ponto de corte depende de H, cada código aproveita uma parte diferente do HMAC.`,
        operation: 'Leitura dos 4 bits menos significativos do último byte do HMAC.',
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Deslocamento', formula: 'offset = H[último] & 0x0F', substituted: `H[último] = 0x${d.hmacHex.slice(-2)}`, result: `offset = ${d.offset}`, kind: 'param' },
          },
        ],
      },
      {
        id: 'bytes',
        title: 'Alice extrai 4 bytes e apaga o bit de sinal',
        description: `Alice copia os 4 bytes de H a partir do deslocamento (0x${d.fourHex}) e zera o bit mais significativo (máscara 0x7FFFFFFF), para obter um inteiro positivo de 31 bits sem ambiguidade de sinal entre implementações. O resultado é 0x${d.maskedHex}, ou seja, ${d.truncated.toLocaleString('pt-BR')}.`,
        operation: 'Extração de 4 bytes e máscara 0x7FFFFFFF.',
        events: [
          {
            type: 'compute',
            operation: {
              party: 'alice',
              title: 'Inteiro de 31 bits',
              formula: 'S = H[offset..offset+3] & 0x7FFFFFFF',
              substituted: `H[${d.offset}..${d.offset + 3}] = 0x${d.fourHex}`,
              result: `S = 0x${d.maskedHex} = ${d.truncated}`,
              kind: 'param',
            },
            entry: entry('S', 'Inteiro de 31 bits', String(d.truncated), 'param'),
          },
        ],
      },
      {
        id: 'digits',
        title: `Alice reduz o inteiro a ${d.digits} dígitos`,
        description: `O código é o resto da divisão do inteiro por 10^${d.digits}, completado com zeros à esquerda. A perda de informação é grande de propósito: o código tem só ${d.digits} dígitos e, por isso, é preciso limitar as tentativas no servidor.`,
        operation: `Resto da divisão por 10^${d.digits}.`,
        events: [
          {
            type: 'compute',
            operation: { party: 'alice', title: 'Código', formula: `código = S mod 10^${d.digits}`, substituted: `S = ${d.truncated}`, result: `código = ${d.code}`, kind: 'signature' },
            entry: entry('code', 'Código de uso único', d.code, 'signature'),
          },
        ],
      },
      {
        id: 'send',
        title: 'Alice digita o código no site',
        description: 'O código é digitado pelo usuário (ou lido de um aplicativo). O segredo K não sai do aparelho de Alice.',
        operation: 'Envio do código ao servidor.',
        events: [
          {
            type: 'send',
            message: { from: 'alice', to: 'bob', label: 'Código', summary: d.code, kind: 'signature' },
            deliver: [entry('rx', 'Código recebido', d.code, 'signature')],
          },
        ],
      },
      {
        id: 'bob',
        title: 'Bob calcula o mesmo código',
        description: 'Bob tem K e o mesmo contador (o do evento esperado ou o do seu relógio) e repete as mesmas operações. Se o código coincidir, a posse do segredo foi demonstrada.',
        operation: 'Repetição do cálculo no servidor e comparação.',
        events: [
          {
            type: 'compute',
            operation: {
              party: 'bob',
              title: 'Conferência',
              formula: `código esperado = ${name}(K, C)`,
              substituted: `K = ${short(d.keyHex, 12)}, C = ${d.counterValue}`,
              result: `esperado = ${d.bobCode}`,
              kind: 'signature',
            },
            entry: entry('exp', 'Código esperado', d.bobCode, 'signature'),
          },
        ],
      },
      {
        id: 'result',
        title: d.match ? 'Os códigos coincidem' : 'Os códigos diferem',
        description: d.match
          ? 'Alice e Bob chegaram ao mesmo código sem que o segredo trafegasse. O código vale para um único contador: no próximo, o valor muda por completo.'
          : 'Os códigos diferem: o contador ou o segredo não são os mesmos nos dois lados.',
        operation: 'Avaliação do resultado.',
        events: [{ type: 'verdict', verdict: { ok: d.match, text: d.match ? 'Autenticação aceita: Alice provou conhecer K.' : 'Autenticação recusada.' } }],
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Parte B: Alice, Bob e Eva em quatro cenários.
// ---------------------------------------------------------------------------------------------
export type Scenario = 'normal' | 'replay' | 'phishing' | 'forca-bruta';

export interface ScenarioInput {
  scenario: Scenario;
  key: Uint8Array;
  time: number;
  /** No cenário de repetição: o servidor recusa um código já aceito (RFC 6238, seção 5.2). */
  rejectUsed: boolean;
  /** No cenário de força bruta: tentativas erradas antes do bloqueio da conta. */
  limit: number;
}

export interface ScenarioFlowData {
  scenario: Scenario;
  keyB32: string;
  time: number;
  counter: string;
  code: string;
  tried: string[];
  /** Segundo acesso, feito por Eva. */
  evaTime: number;
  evaCounter: string;
  evaTried: string[];
  evaAccepted: boolean;
  evaReason: 'aceito' | 'fora-da-janela' | 'ja-usado';
  rejectUsed: boolean;
  limit: number;
  guesses: string[];
  hit: boolean;
  probability: number;
  ok: boolean;
  verdictText: string;
}

/** Palpites de Eva: valores fixos e distintos do código correto, para a execução ser reproduzível. */
const guessList = (code: string, n: number): string[] => Array.from({ length: n }, (_, i) => String((Number(code) + 111111 * (i + 1)) % 1_000_000).padStart(6, '0'));

export async function runScenario(engine: OtpAuthEngine, input: ScenarioInput): Promise<ScenarioFlowData> {
  const { key, time, scenario } = input;
  const trace = await engine.totp(key, time, 6, 'SHA-1');
  const login = await engine.verify(key, time, trace.code, { window: WINDOW });
  const base = {
    scenario,
    keyB32: base32Encode(key),
    time,
    counter: trace.counter.toString(),
    code: trace.code,
    tried: login.tried.map(String),
    rejectUsed: input.rejectUsed,
    limit: Math.max(1, Math.min(20, Math.floor(input.limit))),
    guesses: [] as string[],
    hit: false,
    probability: 0,
  };
  if (scenario === 'normal') {
    const evaTime = time + LATE_DELAY;
    const late = await engine.verify(key, evaTime, trace.code, { window: WINDOW, lastAccepted: login.counter });
    return {
      ...base,
      evaTime,
      evaCounter: timeCounter(evaTime).toString(),
      evaTried: late.tried.map(String),
      evaAccepted: late.ok,
      evaReason: late.reason,
      ok: !late.ok,
      verdictText: late.ok
        ? 'Inesperado: o servidor aceitou um código vencido.'
        : `Eva leu o código no canal, mas ${LATE_DELAY} segundos depois ele já não vale: o servidor só aceita os contadores vizinhos do atual. O código captado é inútil fora da janela de 30 s (com tolerância de um passo).`,
    };
  }
  if (scenario === 'replay') {
    const evaTime = time + REPLAY_DELAY;
    const again = await engine.verify(key, evaTime, trace.code, { window: WINDOW, lastAccepted: input.rejectUsed ? login.counter : null });
    return {
      ...base,
      evaTime,
      evaCounter: timeCounter(evaTime).toString(),
      evaTried: again.tried.map(String),
      evaAccepted: again.ok,
      evaReason: again.reason,
      ok: !again.ok,
      verdictText: again.ok
        ? `Eva repetiu o código ${REPLAY_DELAY} segundos depois, ainda dentro da janela, e o servidor o aceitou de novo. Sem registrar o último contador aceito, "uso único" vale só para o relógio, não para o servidor. A RFC 6238 exige que o verificador não aceite uma segunda tentativa de um código já validado.`
        : 'Eva repetiu o código dentro da janela, mas o servidor guardou o contador do último código aceito e recusou a repetição. É a defesa exigida pela RFC 6238, seção 5.2.',
    };
  }
  if (scenario === 'phishing') {
    const evaTime = time + FORWARD_DELAY;
    const fwd = await engine.verify(key, evaTime, trace.code, { window: WINDOW });
    return {
      ...base,
      evaTime,
      evaCounter: timeCounter(evaTime).toString(),
      evaTried: fwd.tried.map(String),
      evaAccepted: fwd.ok,
      evaReason: fwd.reason,
      ok: !fwd.ok,
      verdictText: fwd.ok
        ? `Alice digitou o código em um site falso de Eva, que o repassou ao servidor verdadeiro ${FORWARD_DELAY} segundos depois, ainda dentro da janela. O TOTP não vincula o código ao site em que ele é digitado, então não resiste a esse ataque de retransmissão em tempo real. A defesa é um fator que verifica a origem, como o WebAuthn.`
        : 'O servidor recusou o código retransmitido.',
    };
  }
  // força bruta
  const guesses = guessList(trace.code, base.limit);
  let hit = false;
  for (const g of guesses) if ((await engine.verify(key, time, g, { window: WINDOW })).ok) hit = true;
  const valid = 2 * WINDOW + 1;
  const probability = 1 - (1 - valid / 10 ** 6) ** base.limit;
  return {
    ...base,
    evaTime: time,
    evaCounter: base.counter,
    evaTried: base.tried,
    evaAccepted: hit,
    evaReason: hit ? 'aceito' : 'fora-da-janela',
    guesses,
    hit,
    probability,
    ok: !hit,
    verdictText: hit
      ? 'Eva acertou por sorte um dos códigos válidos antes do bloqueio.'
      : `Com ${valid} códigos válidos em 10^6, cada palpite acerta com probabilidade ${(valid / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 6 })}. Com o bloqueio após ${base.limit} erros, a chance total de Eva é de cerca de ${(probability * 100).toLocaleString('pt-BR', { maximumSignificantDigits: 2 })}%. Sem limite de tentativas, o código de 6 dígitos cairia em minutos.`,
  };
}

const scenarioParties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Usuária (aplicativo autenticador)',
    position: 'left',
    slots: [
      { key: 'K', label: 'Segredo compartilhado K', kind: 'secret' },
      { key: 'T', label: 'Horário do aparelho', kind: 'param' },
      { key: 'code', label: 'Código de uso único', kind: 'signature' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Servidor de autenticação',
    position: 'right',
    slots: [
      { key: 'K', label: 'Segredo compartilhado K', kind: 'secret' },
      { key: 'rx', label: 'Código recebido', kind: 'signature' },
      { key: 'last', label: 'Último contador aceito', kind: 'param' },
    ],
  },
  {
    id: 'eva',
    name: 'Eva',
    role: 'Atacante (observa e age na rede)',
    position: 'center',
    adversary: true,
    slots: [
      { key: 'cap', label: 'Código capturado', kind: 'signature' },
      { key: 'try', label: 'Palpites', kind: 'signature' },
    ],
  },
];

const secs = (n: number) => `${n} s`;

export function buildScenarioProtocol(d: ScenarioFlowData): ProtocolDefinition {
  const provision = {
    id: 'provision',
    title: 'Alice e Bob compartilham o segredo',
    description: `No cadastro, o servidor entrega o segredo K (${short(d.keyB32, 16)} em Base32) por um QR code. Eva não participa dessa etapa. Daqui em diante o segredo não trafega.`,
    operation: 'Nenhum cálculo: o segredo já é conhecido por Alice e por Bob.',
    events: [
      { type: 'set' as const, party: 'alice', entry: entry('K', 'Segredo compartilhado K', short(d.keyB32, 16), 'secret') },
      { type: 'set' as const, party: 'bob', entry: entry('K', 'Segredo compartilhado K', short(d.keyB32, 16), 'secret') },
    ],
  };
  const aliceCode = {
    id: 'alice-code',
    title: 'Alice gera o código do instante atual',
    description: `O aparelho de Alice marca ${clock(d.time)}, o que dá o contador C = ${d.counter}. O código é HOTP(K, C), de 6 dígitos, e vale enquanto o contador for o mesmo (30 s).`,
    operation: 'Cálculo de TOTP(K, T) no aparelho de Alice.',
    events: [
      { type: 'set' as const, party: 'alice', entry: entry('T', 'Horário do aparelho', clock(d.time), 'param') },
      {
        type: 'compute' as const,
        operation: { party: 'alice', title: 'Código TOTP', formula: 'código = HOTP(K, ⌊T / 30⌋)', substituted: `T = ${clock(d.time)}, C = ${d.counter}`, result: `código = ${d.code}`, kind: 'signature' as const },
        entry: entry('code', 'Código de uso único', d.code, 'signature'),
      },
    ],
  };
  const bobVerify = (id: string, title: string, time: number, tried: string[], lastCounter: string | null, resultText: string, ok: boolean) => ({
    id,
    title,
    description: `Bob calcula o código dos contadores ${tried.join(', ')} (o atual e os vizinhos, para tolerar atraso e diferença de relógio) e compara com o recebido.`,
    operation: 'Cálculo dos códigos esperados e comparação.',
    events: [
      {
        type: 'compute' as const,
        operation: {
          party: 'bob',
          title: 'Validação',
          formula: 'recebido ∈ { HOTP(K, C + δ) : δ ∈ {−1, 0, +1} } ?',
          substituted: `T = ${clock(time)}, contadores ${tried.join(', ')}${lastCounter ? `, último aceito ${lastCounter}` : ''}`,
          result: resultText,
          kind: ok ? ('signature' as const) : ('param' as const),
        },
        ...(ok ? { entry: entry('last', 'Último contador aceito', d.counter, 'param') } : {}),
      },
    ],
  });
  const firstLogin = {
    id: 'login',
    title: 'Alice envia o código ao servidor',
    description: 'O código trafega pelo canal. Eva o lê, pois o TOTP não cifra nada: ele só prova a posse do segredo.',
    operation: 'Envio do código pela rede.',
    events: [
      {
        type: 'send' as const,
        message: { from: 'alice', to: 'bob', label: 'Código', summary: d.code, kind: 'signature' as const, observers: ['eva'] },
        deliver: [entry('rx', 'Código recebido', d.code, 'signature')],
        observerEntries: [entry('cap', 'Código capturado', d.code, 'signature')],
      },
    ],
  };
  const accepted = bobVerify('bob-verify', 'Bob valida o código', d.time, d.tried, null, `aceito: código reconhecido no contador ${d.counter}`, true);

  if (d.scenario === 'normal') {
    return {
      id: 'totp-normal',
      title: 'TOTP: acesso normal e código vencido',
      parties: scenarioParties,
      steps: [
        provision,
        aliceCode,
        firstLogin,
        accepted,
        {
          id: 'late',
          title: `Eva tenta usar o código ${secs(LATE_DELAY)} depois`,
          description: `Eva guardou o código lido no canal e o apresenta ao servidor às ${clock(d.evaTime)}, no contador ${d.evaCounter}.`,
          operation: 'Reapresentação do código capturado.',
          events: [
            {
              type: 'send',
              message: { from: 'eva', to: 'bob', label: 'Código capturado', summary: d.code, kind: 'signature' },
              deliver: [],
            },
          ],
        },
        bobVerify('bob-late', 'Bob recusa o código vencido', d.evaTime, d.evaTried, d.counter, `recusado: ${d.code} não é o código dos contadores ${Number(d.evaCounter) - 1} a ${Number(d.evaCounter) + 1}`, false),
        { id: 'result', title: 'O código vencido não serve a Eva', description: d.verdictText, operation: 'Avaliação do resultado.', events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }] },
      ],
    };
  }

  if (d.scenario === 'replay') {
    return {
      id: 'totp-repeticao',
      title: d.rejectUsed ? 'TOTP: repetição recusada pelo servidor' : 'TOTP: repetição dentro da janela',
      parties: scenarioParties,
      steps: [
        provision,
        aliceCode,
        firstLogin,
        accepted,
        {
          id: 'replay',
          title: `Eva repete o código ${secs(REPLAY_DELAY)} depois`,
          description: `Ainda dentro dos 30 s (${clock(d.evaTime)}, contador ${d.evaCounter}), Eva envia o mesmo código que leu no canal.`,
          operation: 'Repetição do código capturado.',
          events: [
            {
              type: 'send',
              message: { from: 'eva', to: 'bob', label: 'Código capturado', summary: d.code, kind: 'signature' },
              deliver: [],
            },
          ],
        },
        bobVerify(
          'bob-replay',
          d.rejectUsed ? 'Bob recusa o código já usado' : 'Bob aceita o código pela segunda vez',
          d.evaTime,
          d.evaTried,
          d.rejectUsed ? d.counter : null,
          d.rejectUsed ? `recusado: o contador ${d.counter} já foi aceito` : `aceito: Eva autenticada com o código de Alice`,
          d.evaAccepted,
        ),
        { id: 'result', title: d.ok ? 'A repetição foi barrada' : 'Eva entrou com o código repetido', description: d.verdictText, operation: 'Avaliação do resultado.', events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }] },
      ],
    };
  }

  if (d.scenario === 'phishing') {
    return {
      id: 'totp-phishing',
      title: 'TOTP: Eva retransmite o código em tempo real',
      parties: scenarioParties,
      steps: [
        provision,
        aliceCode,
        {
          id: 'fake',
          title: 'Alice digita o código em um site falso de Eva',
          description: 'Alice recebeu um link enganoso e abriu uma página de Eva, idêntica à do servidor. O código sai do aparelho de Alice e chega a Eva, não a Bob.',
          operation: 'Envio do código ao site falso.',
          events: [
            {
              type: 'send',
              message: { from: 'alice', to: 'eva', label: 'Código', summary: d.code, kind: 'signature' },
              deliver: [entry('cap', 'Código capturado', d.code, 'signature')],
            },
          ],
        },
        {
          id: 'forward',
          title: `Eva repassa o código ao servidor verdadeiro em ${secs(FORWARD_DELAY)}`,
          description: `Eva, que já tem a senha de Alice, usa o código recém-capturado no servidor verdadeiro às ${clock(d.evaTime)}, dentro da mesma janela de 30 s.`,
          operation: 'Retransmissão do código ao servidor.',
          events: [
            {
              type: 'send',
              message: { from: 'eva', to: 'bob', label: 'Código retransmitido', summary: d.code, kind: 'signature' },
              deliver: [entry('rx', 'Código recebido', d.code, 'signature')],
            },
          ],
        },
        bobVerify('bob-forwarded', 'Bob valida o código', d.evaTime, d.evaTried, null, d.evaAccepted ? `aceito: código reconhecido no contador ${d.counter}` : 'recusado', d.evaAccepted),
        { id: 'result', title: d.ok ? 'O servidor recusou o código' : 'O TOTP não impediu o phishing', description: d.verdictText, operation: 'Avaliação do resultado.', events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }] },
      ],
    };
  }

  return {
    id: 'totp-forca-bruta',
    title: 'TOTP: Eva tenta adivinhar o código',
    parties: scenarioParties,
    steps: [
      provision,
      {
        id: 'guess',
        title: `Eva faz ${d.limit} palpites`,
        description: `Eva não tem o segredo e tenta códigos de 6 dígitos: ${d.guesses.join(', ')}. O servidor aceita 3 códigos por vez (o atual e os dois vizinhos), de modo que cada palpite acerta com probabilidade 3 em 10^6.`,
        operation: 'Envio de palpites ao servidor.',
        events: [
          { type: 'set', party: 'eva', entry: entry('try', 'Palpites', short(d.guesses.join(' '), 40), 'signature') },
          { type: 'send', message: { from: 'eva', to: 'bob', label: `${d.limit} palpites`, summary: d.guesses.join(', '), kind: 'signature' }, deliver: [entry('rx', 'Código recebido', short(d.guesses.join(' '), 40), 'signature')] },
        ],
      },
      {
        id: 'bob-verify',
        title: d.hit ? 'Bob aceita um dos palpites' : 'Bob recusa todos e bloqueia a conta',
        description: d.hit ? 'Um dos palpites coincidiu com um código válido.' : `Nenhum palpite coincide com os contadores ${d.tried.join(', ')}. Após ${d.limit} erros, o servidor bloqueia a conta e Eva precisa parar.`,
        operation: 'Comparação de cada palpite e bloqueio.',
        events: [
          {
            type: 'compute',
            operation: { party: 'bob', title: 'Validação dos palpites', formula: 'cada palpite ∈ { HOTP(K, C + δ) } ?', substituted: `${d.limit} palpites, contadores ${d.tried.join(', ')}`, result: d.hit ? 'um palpite aceito' : `${d.limit} recusados, conta bloqueada`, kind: 'param' },
          },
        ],
      },
      {
        id: 'prob',
        title: 'Eva calcula a chance de sucesso',
        description: 'A probabilidade de ao menos um acerto em n tentativas independentes é 1 − (1 − W / 10^d)^n, com W códigos válidos e d dígitos. O limite de tentativas é o que torna o código curto aceitável.',
        operation: 'Cálculo da probabilidade de acerto.',
        events: [
          {
            type: 'compute',
            operation: {
              party: 'eva',
              title: 'Chance de acerto',
              formula: 'P = 1 − (1 − W / 10^d)^n',
              substituted: `W = 3, d = 6, n = ${d.limit}`,
              result: `P ≈ ${(d.probability * 100).toLocaleString('pt-BR', { maximumSignificantDigits: 2 })}%`,
              kind: 'param',
            },
          },
        ],
      },
      { id: 'result', title: d.ok ? 'O limite de tentativas protegeu a conta' : 'Eva teve sorte', description: d.verdictText, operation: 'Avaliação do resultado.', events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }] },
    ],
  };
}
