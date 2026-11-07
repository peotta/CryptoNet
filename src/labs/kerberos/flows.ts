import type { KerberosEngine } from '../../crypto/engines';
import { DEFAULT_DICTIONARY, DEFAULT_SKEW, REALM, REPLAY_DELAY, type KrbRun, type KrbScenario } from '../../crypto/kerberos';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 14) => (t.length > n ? `${t.slice(0, n)}…` : t);

/** Horário legível de um instante Unix, em UTC. */
export const clock = (unixSeconds: number): string => `${new Date(unixSeconds * 1000).toISOString().slice(11, 19)} UTC`;

/** Instante fixo (2 de novembro de 2026, 13:30:10 UTC), usado como padrão e na documentação gerada. */
export const DEFAULT_NOW = Math.floor(Date.UTC(2026, 10, 2, 13, 30, 10) / 1000);
export const WEAK_PASSWORD = 'primavera';
export const STRONG_PASSWORD = 'cavalo-grampo-correto-pilha-47';
export { DEFAULT_DICTIONARY, DEFAULT_SKEW };

export interface KrbInput {
  scenario: KrbScenario;
  password: string;
  now: number;
  skew: number;
  replayCache: boolean;
  preauth: boolean;
  dictionary: string[];
  iterations?: number;
}

export function parseDictionary(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 200);
}

export async function runScenario(engine: KerberosEngine, input: KrbInput, rand: (n: number) => Uint8Array): Promise<KrbRun> {
  if (input.password.length === 0) throw new Error('Digite a senha de Alice.');
  const skew = Math.max(1, Math.min(3600, Math.floor(input.skew)));
  return engine.run({ ...input, skew, rand });
}

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Cliente (usuária)',
    position: 'left',
    slots: [
      { key: 'Kc', label: 'Chave de Alice K_c (da senha)', kind: 'secret' },
      { key: 'Kat', label: 'Chave de sessão K_AT', kind: 'secret' },
      { key: 'tgt', label: 'TGT (opaco para Alice)', kind: 'cipher' },
      { key: 'Kab', label: 'Chave de sessão K_AB', kind: 'secret' },
      { key: 'tkt', label: 'Tíquete de Bob (opaco)', kind: 'cipher' },
    ],
  },
  {
    id: 'kdc',
    name: 'KDC',
    role: 'Centro de distribuição de chaves (AS e TGS)',
    position: 'center-left',
    slots: [
      { key: 'Kc', label: 'Chave de Alice K_c', kind: 'secret' },
      { key: 'Ktgs', label: 'Chave do TGS K_tgs', kind: 'secret' },
      { key: 'Kb', label: 'Chave de Bob K_b', kind: 'secret' },
    ],
  },
  {
    id: 'eva',
    name: 'Eva',
    role: 'Atacante (observa e age na rede)',
    position: 'center-right',
    adversary: true,
    slots: [
      { key: 'cap', label: 'Mensagens capturadas', kind: 'cipher' },
      { key: 'try', label: 'Senhas testadas offline', kind: 'param' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Serviço',
    position: 'right',
    slots: [
      { key: 'Kb', label: 'Chave de Bob K_b', kind: 'secret' },
      { key: 'Kab', label: 'Chave de sessão K_AB', kind: 'secret' },
      { key: 'seen', label: 'Autenticadores já vistos', kind: 'param' },
    ],
  },
];

const OBS = ['eva'];

export function buildProtocol(d: KrbRun): ProtocolDefinition {
  const verdictStep = (title: string): ProtocolStep => ({ id: 'result', title, description: d.verdictText, operation: 'Avaliação do resultado.', events: [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }] });
  const ticketLife = '10 h';
  const prefix: ProtocolStep[] = [
    {
      id: 'setup',
      title: 'As chaves de longo prazo',
      description: `Alice e o KDC derivam a chave K_c da senha de Alice (PBKDF2, ${d.iterations} iterações, sal ${REALM}alice). O KDC também guarda K_tgs, com que sela os TGTs, e K_b, que partilha com Bob. A senha nunca trafega. No RFC 4120 a derivação é a string-to-key do RFC 3962; aqui usa-se PBKDF2 com SHA-256.`,
      operation: 'Derivação de K_c e distribuição prévia das chaves de longo prazo.',
      events: [
        { type: 'compute', operation: { party: 'alice', title: 'string-to-key', formula: 'K_c = PBKDF2(senha, sal, iterações)', substituted: `sal = ${REALM}alice, ${d.iterations} iterações`, result: `K_c = ${short(d.kcHex)}`, kind: 'secret' }, entry: entry('Kc', 'Chave de Alice K_c (da senha)', short(d.kcHex), 'secret') },
        { type: 'set', party: 'kdc', entry: entry('Kc', 'Chave de Alice K_c', short(d.kcHex), 'secret') },
        { type: 'set', party: 'kdc', entry: entry('Ktgs', 'Chave do TGS K_tgs', short(d.ktgsHex), 'secret') },
        { type: 'set', party: 'kdc', entry: entry('Kb', 'Chave de Bob K_b', short(d.kbHex), 'secret') },
        { type: 'set', party: 'bob', entry: entry('Kb', 'Chave de Bob K_b', short(d.kbHex), 'secret') },
      ],
    },
    {
      id: 'as-req',
      title: 'AS-REQ: Alice pede um TGT',
      description: d.preauth
        ? `Alice envia seu nome, o serviço desejado (krbtgt) e um nonce N1 = ${d.n1}, mais a pré-autenticação: o horário ${clock(d.now)} cifrado com K_c. Só quem conhece K_c produz esse dado (RFC 4120, seção 5.2.7.2).`
        : `Alice envia seu nome, o serviço desejado (krbtgt) e um nonce N1 = ${d.n1}. Sem pré-autenticação, o pedido não prova nada: qualquer pessoa pode fazê-lo em nome de Alice.`,
      operation: 'Envio do pedido ao serviço de autenticação (AS).',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'kdc', label: 'AS-REQ', summary: d.preauth ? `alice, krbtgt, N1=${d.n1}, {T}K_c=${short(d.asReqPadataHex, 24)}` : `alice, krbtgt, N1=${d.n1}`, kind: d.preauth ? 'cipher' : 'plain', observers: OBS },
          deliver: [],
          observerEntries: [entry('cap', 'Mensagens capturadas', 'AS-REQ', 'cipher')],
        },
      ],
    },
    {
      id: 'as-rep',
      title: 'AS-REP: o KDC entrega o TGT',
      description: `O KDC gera a chave de sessão K_AT e responde com duas partes: {K_AT, N1}K_c, que só Alice abre, e o TGT, que contém K_AT e o nome de Alice selado com K_tgs. Alice não consegue ler nem alterar o TGT, apenas guardá-lo. Validade: ${ticketLife}.`,
      operation: 'Geração de K_AT e selagem de {K_AT, N1}K_c e do TGT.',
      events: [
        {
          type: 'send',
          message: { from: 'kdc', to: 'alice', label: 'AS-REP', summary: `TGT=${short(d.tgtHex, 24)}, {K_AT, N1}K_c=${short(d.asRepHex, 24)}`, kind: 'cipher', observers: OBS },
          deliver: [entry('tgt', 'TGT (opaco para Alice)', short(d.tgtHex), 'cipher')],
          observerEntries: [entry('cap', 'Mensagens capturadas', 'AS-REQ, AS-REP', 'cipher')],
        },
        { type: 'compute', operation: { party: 'alice', title: 'Abre {K_AT, N1}K_c', formula: '(K_AT, N1) = Dec(K_c, resposta)', substituted: `K_c = ${short(d.kcHex)}`, result: `K_AT = ${short(d.katHex)}, N1 = ${d.n1} confere`, kind: 'secret' }, entry: entry('Kat', 'Chave de sessão K_AT', short(d.katHex), 'secret') },
      ],
    },
    {
      id: 'tgs-req',
      title: 'TGS-REQ: Alice pede um tíquete para Bob',
      description: `Alice envia o TGT, um autenticador {alice, T}K_AT que prova que ela conhece K_AT agora, o nome do serviço (bob) e um nonce N2 = ${d.n2}. O TGT sozinho não basta: sem K_AT, quem o capturou não monta o autenticador.`,
      operation: 'Envio do TGT e do autenticador ao serviço de concessão de tíquetes (TGS).',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'kdc', label: 'TGS-REQ', summary: `TGT, {alice, T}K_AT=${short(d.tgsAuthHex, 24)}, bob, N2=${d.n2}`, kind: 'cipher', observers: OBS },
          deliver: [],
          observerEntries: [entry('cap', 'Mensagens capturadas', 'AS-REQ, AS-REP, TGS-REQ', 'cipher')],
        },
      ],
    },
    {
      id: 'tgs-rep',
      title: 'TGS-REP: o KDC entrega o tíquete de Bob',
      description: 'O KDC abre o TGT com K_tgs, tira K_AT, confere o autenticador e gera a chave de sessão K_AB. Responde com {K_AB, N2}K_AT para Alice e com o tíquete de Bob, que contém K_AB selada com K_b.',
      operation: 'Geração de K_AB e selagem de {K_AB, N2}K_AT e do tíquete de Bob.',
      events: [
        { type: 'compute', operation: { party: 'kdc', title: 'Abre o TGT e o autenticador', formula: 'K_AT = Dec(K_tgs, TGT); T = Dec(K_AT, autenticador)', substituted: `K_tgs = ${short(d.ktgsHex)}`, result: `Alice autenticada, K_AB = ${short(d.kabHex)}`, kind: 'secret' } },
        {
          type: 'send',
          message: { from: 'kdc', to: 'alice', label: 'TGS-REP', summary: `Tíquete=${short(d.tktBHex, 24)}, {K_AB, N2}K_AT=${short(d.tgsRepHex, 24)}`, kind: 'cipher', observers: OBS },
          deliver: [entry('tkt', 'Tíquete de Bob (opaco)', short(d.tktBHex), 'cipher')],
          observerEntries: [entry('cap', 'Mensagens capturadas', 'AS e TGS (tudo cifrado)', 'cipher')],
        },
        { type: 'compute', operation: { party: 'alice', title: 'Abre {K_AB, N2}K_AT', formula: '(K_AB, N2) = Dec(K_AT, resposta)', substituted: `K_AT = ${short(d.katHex)}`, result: `K_AB = ${short(d.kabHex)}, N2 = ${d.n2} confere`, kind: 'secret' }, entry: entry('Kab', 'Chave de sessão K_AB', short(d.kabHex), 'secret') },
      ],
    },
    {
      id: 'ap-req',
      title: 'AP-REQ: Alice se apresenta a Bob',
      description: `Alice envia o tíquete de Bob e um autenticador {alice, T}K_AB com o horário ${clock(d.apTime)}. Bob não consulta o KDC: o tíquete é a prova de que o KDC conhece Alice, e o autenticador, a de que quem o envia tem K_AB agora.`,
      operation: 'Envio do tíquete e do autenticador ao serviço.',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: 'AP-REQ', summary: `Tíquete=${short(d.tktBHex, 24)}, {alice, T}K_AB=${short(d.apAuthHex, 24)}`, kind: 'cipher', observers: OBS },
          deliver: [],
          observerEntries: [entry('cap', 'Mensagens capturadas', 'tíquete de Bob + autenticador', 'cipher')],
        },
      ],
    },
    {
      id: 'bob-verify',
      title: 'Bob valida o tíquete e o autenticador',
      description: `Bob abre o tíquete com K_b, tira K_AB e usa K_AB para abrir o autenticador. Confere o nome e verifica se o horário está dentro da tolerância de ${d.skew} s do seu relógio${d.replayCache ? ' e registra o autenticador para recusar repetições' : ''}.`,
      operation: 'Abertura do tíquete e do autenticador e verificação do horário.',
      events: [
        { type: 'compute', operation: { party: 'bob', title: 'Validação', formula: 'K_AB = Dec(K_b, tíquete); T = Dec(K_AB, autenticador); |T − agora| ≤ tolerância', substituted: `tolerância = ${d.skew} s`, result: d.bobAcceptsAlice ? 'Alice autenticada' : 'recusado', kind: 'secret' }, entry: entry('Kab', 'Chave de sessão K_AB', short(d.kabHex), 'secret') },
        ...(d.replayCache ? [{ type: 'set' as const, party: 'bob', entry: entry('seen', 'Autenticadores já vistos', short(d.apAuthHex), 'param') }] : []),
      ],
    },
    {
      id: 'ap-rep',
      title: 'AP-REP: Bob prova quem é (autenticação mútua)',
      description: `Bob devolve o horário do autenticador cifrado com K_AB. Só quem abriu o tíquete conhece K_AB, então Alice sabe que fala com o verdadeiro Bob. ${d.aliceKnowsKab ? 'A partir daqui os dois compartilham K_AB.' : 'A chave de sessão não confere.'}`,
      operation: 'Envio da prova de Bob a Alice.',
      events: [{ type: 'send', message: { from: 'bob', to: 'alice', label: 'AP-REP', summary: `{T}K_AB=${short(d.apRepHex, 24)}`, kind: 'cipher', observers: OBS }, deliver: [] }],
    },
  ];

  if (d.scenario === 'normal') {
    return { id: 'krb-normal', title: 'Kerberos: troca completa com Eva no canal', parties, steps: [...prefix, verdictStep('Eva só viu texto cifrado')] };
  }

  if (d.scenario === 'replay') {
    return {
      id: 'krb-repeticao',
      title: d.replayCache ? 'Kerberos: repetição recusada pelo serviço' : 'Kerberos: repetição dentro da tolerância',
      parties,
      steps: [
        ...prefix,
        {
          id: 'replay',
          title: `Eva reapresenta o tíquete e o autenticador ${REPLAY_DELAY} s depois`,
          description: `Eva capturou o AP-REQ no canal e o reenvia às ${clock(d.replayTime)}. O autenticador tem ${REPLAY_DELAY} s de idade, bem dentro da tolerância de ${d.skew} s. Eva não conhece K_AB e não consegue montar um autenticador novo, mas o antigo é válido.`,
          operation: 'Reenvio do AP-REQ capturado.',
          events: [{ type: 'send', message: { from: 'eva', to: 'bob', label: 'AP-REQ repetido', summary: `Tíquete=${short(d.tktBHex, 24)}, {alice, T}K_AB=${short(d.apAuthHex, 24)}`, kind: 'cipher' }, deliver: [] }],
        },
        {
          id: 'bob-replay',
          title: d.replayCache ? 'Bob recusa o autenticador repetido' : d.replayReason === 'relogio' ? 'Bob recusa: fora da tolerância' : 'Bob aceita Eva como Alice',
          description: d.replayCache
            ? 'Bob guarda os autenticadores recentes (a janela é a tolerância de relógio) e reconhece este: responde KRB_AP_ERR_REPEAT.'
            : d.replayReason === 'relogio'
              ? `A idade do autenticador excede a tolerância de ${d.skew} s: KRB_AP_ERR_SKEW.`
              : 'O tíquete abre, o autenticador abre e o horário está na tolerância. Sem registro de autenticadores, nada distingue a repetição de um acesso legítimo.',
          operation: 'Abertura do tíquete e do autenticador, verificação do horário e consulta ao registro.',
          events: [
            {
              type: 'compute',
              operation: {
                party: 'bob',
                title: 'Validação da repetição',
                formula: 'tíquete e autenticador válidos? |T − agora| ≤ tolerância? autenticador já visto?',
                substituted: `T = ${clock(d.apTime)}, agora = ${clock(d.replayTime)}, tolerância = ${d.skew} s`,
                result: d.replayAccepted ? 'aceito: Eva autenticada como Alice' : d.replayReason === 'repeticao' ? 'recusado: KRB_AP_ERR_REPEAT' : 'recusado: KRB_AP_ERR_SKEW',
                kind: d.replayAccepted ? 'param' : 'signature',
              },
            },
          ],
        },
        verdictStep(d.ok ? 'A repetição foi barrada' : 'Eva entrou com o autenticador repetido'),
      ],
    };
  }

  // Adivinhar a senha (AS-REP roasting)
  const evaSteps: ProtocolStep[] = [
    {
      id: 'as-req-eva',
      title: 'Eva faz um AS-REQ em nome de Alice',
      description: d.preauth
        ? 'Eva sabe apenas o nome de Alice. Sem K_c, ela não tem como produzir a pré-autenticação (o horário cifrado com K_c) e envia o pedido sem ela.'
        : 'Eva sabe apenas o nome de Alice e pede ao KDC um TGT para ela. Sem pré-autenticação, o KDC não exige prova nenhuma.',
      operation: 'Envio de um AS-REQ sem prova de identidade.',
      events: [{ type: 'send', message: { from: 'eva', to: 'kdc', label: 'AS-REQ', summary: 'alice, krbtgt, N1', kind: 'plain' }, deliver: [] }],
    },
  ];
  if (!d.kdcAnswered) {
    evaSteps.push({
      id: 'kdc-refuse',
      title: 'O KDC exige a pré-autenticação',
      description: 'O KDC responde KDC_ERR_PREAUTH_REQUIRED e não entrega nenhum texto cifrado com K_c. Eva fica sem material para atacar.',
      operation: 'Recusa do pedido sem pré-autenticação.',
      events: [{ type: 'send', message: { from: 'kdc', to: 'eva', label: 'KDC_ERR_PREAUTH_REQUIRED', summary: 'erro, sem texto cifrado', kind: 'plain' }, deliver: [] }],
    });
  } else {
    evaSteps.push(
      {
        id: 'kdc-answer',
        title: 'O KDC responde a Eva com {K_AT, N1}K_c',
        description: 'Sem pré-autenticação, o KDC entrega a resposta cifrada com a chave derivada da senha de Alice a quem pedir. Eva guarda esse texto cifrado e não precisa mais falar com a rede.',
        operation: 'Entrega do AS-REP a Eva.',
        events: [{ type: 'send', message: { from: 'kdc', to: 'eva', label: 'AS-REP', summary: `{K_AT, N1}K_c=${short(d.guessCipherHex, 24)}`, kind: 'cipher' }, deliver: [entry('cap', 'Mensagens capturadas', short(d.guessCipherHex), 'cipher')] }],
      },
      {
        id: 'offline',
        title: `Eva testa ${d.dictionary.length} senhas do dicionário offline`,
        description: `Para cada palavra, Eva calcula K = PBKDF2(palavra, ${REALM}alice, ${d.iterations}) e tenta abrir a resposta. Se a autenticação do AES-GCM passa, a palavra é a senha. ${d.found ? `Testou ${d.tried.length} e acertou.` : `Testou ${d.tried.length} e nenhuma abriu.`}`,
        operation: 'Derivação de chaves candidatas e tentativa de abertura da resposta.',
        events: [
          { type: 'set', party: 'eva', entry: entry('try', 'Senhas testadas offline', `${d.tried.length} de ${d.dictionary.length}`, 'param') },
          {
            type: 'compute',
            operation: { party: 'eva', title: 'Ataque de dicionário', formula: 'para cada palavra w: Dec(PBKDF2(w), resposta) abre?', substituted: `${d.tried.length} palavras, ${d.iterations} iterações cada`, result: d.found ? `senha = "${d.found}"` : 'nenhuma palavra abriu a resposta', kind: 'param' },
          },
        ],
      },
    );
  }
  evaSteps.push(verdictStep(d.ok ? 'A senha resistiu' : 'Eva descobriu a senha de Alice'));
  return { id: 'krb-senha', title: d.preauth ? 'Kerberos: pré-autenticação contra a adivinhação de senha' : 'Kerberos: adivinhação de senha sem pré-autenticação', parties, steps: [...prefix.slice(0, 3), ...evaSteps] };
}
