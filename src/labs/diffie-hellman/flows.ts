import type { DhSession, MitmSession } from '../../crypto/diffieHellman';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

const entry = (key: string, label: string, value: bigint | string, kind: ItemKind): Entry => ({ key, label, value: value.toString(), kind });

const EVA_SLOTS_PASSIVE = [
  { key: 'p', label: 'p (observado)', kind: 'param' as const },
  { key: 'g', label: 'g (observado)', kind: 'param' as const },
  { key: 'A', label: 'A (observado)', kind: 'public' as const },
  { key: 'B', label: 'B (observado)', kind: 'public' as const },
];

interface Part {
  id: string;
  title: string;
  description: string;
  operation: string;
  /** Quantidade de eventos da etapa original que pertencem a esta parte. */
  take: number;
}

/**
 * Divide uma etapa em partes menores, uma por cálculo ou mensagem, para que o estudante
 * confirme cada operação separadamente (o padrão da interface é passo a passo).
 */
function split(step: ProtocolStep, parts: Part[]): ProtocolStep[] {
  let at = 0;
  return parts.map((part, i) => {
    const events = step.events.slice(at, at + part.take);
    at += part.take;
    return {
      id: part.id,
      title: part.title,
      description: part.description,
      operation: part.operation,
      events,
      info: i === parts.length - 1 ? step.info : undefined,
    };
  });
}

function refine(steps: ProtocolStep[], plan: Record<string, Part[]>): ProtocolStep[] {
  return steps.flatMap((st) => (plan[st.id] ? split(st, plan[st.id]) : [st]));
}

function partiesBasic(): PartyDef[] {
  return [
    {
      id: 'alice',
      name: 'Alice',
      role: 'Participante',
      position: 'left',
      slots: [
        { key: 'p', label: 'p (público)', kind: 'param' },
        { key: 'g', label: 'g (público)', kind: 'param' },
        { key: 'A', label: 'A (valor público enviado)', kind: 'public' },
        { key: 'Brec', label: 'B (valor público recebido)', kind: 'public' },
        { key: 'K', label: 'K_{A} (segredo compartilhado)', kind: 'secret' },
        { key: 'a', label: 'a (segredo privado)', kind: 'private' },
      ],
    },
    {
      id: 'bob',
      name: 'Bob',
      role: 'Participante',
      position: 'right',
      slots: [
        { key: 'p', label: 'p (público)', kind: 'param' },
        { key: 'g', label: 'g (público)', kind: 'param' },
        { key: 'B', label: 'B (valor público enviado)', kind: 'public' },
        { key: 'Arec', label: 'A (valor público recebido)', kind: 'public' },
        { key: 'K', label: 'K_{B} (segredo compartilhado)', kind: 'secret' },
        { key: 'b', label: 'b (segredo privado)', kind: 'private' },
      ],
    },
    { id: 'eva', name: 'Eva', role: 'Observadora passiva da rede', position: 'center', adversary: true, slots: EVA_SLOTS_PASSIVE },
  ];
}

export function buildDhProtocol(s: DhSession): ProtocolDefinition {
  const { p, g, a, b, A, B, kAlice, kBob } = s;
  const steps: ProtocolStep[] = [
    {
      id: 'params',
      title: 'Parâmetros públicos',
      description: 'Alice e Bob concordam, abertamente, em um primo p e em um gerador g. Esses valores não são secretos: Eva também os conhece.',
      operation: 'Acordo sobre o grupo (p, g).',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: '(p, g)', summary: `p = ${p}, g = ${g}`, kind: 'param', observers: ['eva'] },
          deliver: [entry('p', 'p (público)', p, 'param'), entry('g', 'g (público)', g, 'param')],
          observerEntries: [entry('p', 'p (observado)', p, 'param'), entry('g', 'g (observado)', g, 'param')],
        },
        { type: 'set', party: 'alice', entry: entry('p', 'p (público)', p, 'param') },
        { type: 'set', party: 'alice', entry: entry('g', 'g (público)', g, 'param') },
      ],
      info: ['Em protocolos reais (como o TLS 1.3), o grupo vem de uma lista padronizada, por exemplo os grupos ffdhe da RFC 7919.'],
    },
    {
      id: 'secrets',
      title: 'Escolha dos segredos',
      description: 'Alice escolhe um expoente secreto a e Bob escolhe b. Cada um guarda o seu valor na área protegida, sem enviá-lo a ninguém.',
      operation: 'Escolha de a e b em [2, p - 2].',
      events: [
        { type: 'set', party: 'alice', entry: entry('a', 'a (segredo privado)', a, 'private') },
        { type: 'set', party: 'bob', entry: entry('b', 'b (segredo privado)', b, 'private') },
      ],
      info: ['Em uma implementação real, a e b são sorteados por um gerador de números aleatórios criptograficamente seguro.'],
    },
    {
      id: 'publics',
      title: 'Cálculo dos valores públicos',
      description: 'Cada participante eleva g ao seu segredo, módulo p. A exponenciação é fácil de calcular, mas difícil de inverter em grupos adequados.',
      operation: 'A = g^a mod p (Alice) e B = g^b mod p (Bob).',
      events: [
        {
          type: 'compute',
          operation: { party: 'alice', title: 'Alice calcula A', formula: 'A = g^{a} mod p', substituted: `A = ${g}^{${a}} mod ${p}`, result: `A = ${A}`, kind: 'public' },
          entry: entry('A', 'A (valor público enviado)', A, 'public'),
        },
        {
          type: 'compute',
          operation: { party: 'bob', title: 'Bob calcula B', formula: 'B = g^{b} mod p', substituted: `B = ${g}^{${b}} mod ${p}`, result: `B = ${B}`, kind: 'public' },
          entry: entry('B', 'B (valor público enviado)', B, 'public'),
        },
      ],
    },
    {
      id: 'exchange',
      title: 'Troca dos valores públicos',
      description: 'Alice envia A a Bob e Bob envia B a Alice, pelo canal público. Eva registra ambos, mas a e b nunca trafegam.',
      operation: 'Transmissão de A e de B pelo canal.',
      events: [
        { type: 'send', message: { from: 'alice', to: 'bob', label: 'A', summary: `A = ${A}`, kind: 'public', observers: ['eva'] }, deliver: [entry('Arec', 'A (valor público recebido)', A, 'public')], observerEntries: [entry('A', 'A (observado)', A, 'public')] },
        { type: 'send', message: { from: 'bob', to: 'alice', label: 'B', summary: `B = ${B}`, kind: 'public', observers: ['eva'] }, deliver: [entry('Brec', 'B (valor público recebido)', B, 'public')], observerEntries: [entry('B', 'B (observado)', B, 'public')] },
      ],
    },
    {
      id: 'shared',
      title: 'Cálculo do segredo compartilhado',
      description: 'Alice eleva o B recebido ao seu segredo a. Bob eleva o A recebido ao seu segredo b. Os dois chegam ao mesmo número, sem que ele tenha passado pelo canal.',
      operation: 'K_A = B^a mod p (Alice) e K_B = A^b mod p (Bob).',
      events: [
        {
          type: 'compute',
          operation: { party: 'alice', title: 'Alice calcula K_{A}', formula: 'K_{A} = B^{a} mod p', substituted: `K_{A} = ${B}^{${a}} mod ${p}`, result: `K_{A} = ${kAlice}`, kind: 'secret' },
          entry: entry('K', 'K_{A} (segredo compartilhado)', kAlice, 'secret'),
        },
        {
          type: 'compute',
          operation: { party: 'bob', title: 'Bob calcula K_{B}', formula: 'K_{B} = A^{b} mod p', substituted: `K_{B} = ${A}^{${b}} mod ${p}`, result: `K_{B} = ${kBob}`, kind: 'secret' },
          entry: entry('K', 'K_{B} (segredo compartilhado)', kBob, 'secret'),
        },
      ],
      info: ['Por que funciona: (g^b)^a = g^(a·b) = (g^a)^b (mod p).'],
    },
    {
      id: 'compare',
      title: 'Comparação dos segredos',
      description: s.match
        ? 'K_A = K_B: os dois participantes obtiveram o mesmo segredo, e Eva, que conhece p, g, A e B, não o calculou.'
        : 'Os segredos diferem. Isso não deveria ocorrer com parâmetros válidos.',
      operation: 'Verificação de K_A = K_B.',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'alice',
            title: 'Comparação',
            formula: 'K_{A} = K_{B} ?',
            substituted: `${kAlice} = ${kBob} ?`,
            result: s.match ? 'iguais' : 'diferentes',
            kind: 'secret',
          },
        },
        { type: 'verdict', verdict: { ok: s.match, text: s.match ? 'Segredo compartilhado estabelecido com sucesso.' : 'Os segredos calculados são diferentes.' } },
      ],
    },
    {
      id: 'apply',
      title: 'Aplicação do segredo',
      description:
        'O número K não é usado diretamente como chave. Ele alimenta uma função de derivação de chaves (por exemplo, HKDF, RFC 5869), que produz chaves simétricas uniformes para algoritmos como AES-GCM.',
      operation: 'chave = HKDF-SHA-256(K, sal, contexto).',
      events: [],
      info: [
        'Este laboratório usa grupos minúsculos para visualização: o segredo K tem poucos bits e NÃO constitui uma chave segura.',
        'Em produção, usa-se DH com grupos de 2048 bits ou mais (RFC 7919) ou ECDH, como X25519 (RFC 7748).',
        'Mais abaixo, a extensão de cifragem demonstra HKDF-SHA-256 e AES-256-GCM reais sobre o K calculado.',
      ],
    },
  ];
  const plan: Record<string, Part[]> = {
    secrets: [
      { id: 'secret-a', title: 'Alice escolhe o segredo a', description: 'Alice sorteia um expoente secreto a e o guarda na área protegida. Ele nunca será enviado a ninguém.', operation: 'Escolha de a em [2, p - 2].', take: 1 },
      { id: 'secret-b', title: 'Bob escolhe o segredo b', description: 'Bob faz o mesmo, de forma independente: escolhe b e o guarda na sua área protegida. Alice não conhece b.', operation: 'Escolha de b em [2, p - 2].', take: 1 },
    ],
    publics: [
      { id: 'public-a', title: 'Alice calcula A', description: 'Alice eleva g ao seu segredo, módulo p. A exponenciação é fácil de calcular, mas difícil de inverter em grupos adequados.', operation: 'A = g^a mod p.', take: 1 },
      { id: 'public-b', title: 'Bob calcula B', description: 'Bob faz o cálculo equivalente com o seu próprio segredo.', operation: 'B = g^b mod p.', take: 1 },
    ],
    exchange: [
      { id: 'send-a', title: 'Alice envia A a Bob', description: 'O valor público A atravessa o canal. Eva o registra, mas a continua secreto.', operation: 'Transmissão de A pelo canal público.', take: 1 },
      { id: 'send-b', title: 'Bob envia B a Alice', description: 'Agora B percorre o caminho inverso. Eva também o registra; b nunca trafega.', operation: 'Transmissão de B pelo canal público.', take: 1 },
    ],
    shared: [
      { id: 'shared-a', title: 'Alice calcula o segredo compartilhado K_A', description: 'Alice eleva o B recebido ao seu segredo a. O resultado é g^(ab) mod p.', operation: 'K_A = B^a mod p.', take: 1 },
      { id: 'shared-b', title: 'Bob calcula o segredo compartilhado K_B', description: 'Bob eleva o A recebido ao seu segredo b e obtém o mesmo número, sem que ele tenha passado pelo canal.', operation: 'K_B = A^b mod p.', take: 1 },
    ],
  };
  return { id: 'dh-basic', title: 'Diffie-Hellman: troca de chaves', parties: partiesBasic(), steps: refine(steps, plan) };
}

function partiesMitm(): PartyDef[] {
  return [
    {
      id: 'alice',
      name: 'Alice',
      role: 'Acredita falar com Bob',
      position: 'left',
      slots: [
        { key: 'p', label: 'p (público)', kind: 'param' },
        { key: 'g', label: 'g (público)', kind: 'param' },
        { key: 'A', label: 'A (enviado)', kind: 'public' },
        { key: 'Brec', label: 'Valor recebido (suposto B)', kind: 'public' },
        { key: 'K', label: 'K_{A} (com quem este segredo é compartilhado?)', kind: 'secret' },
        { key: 'a', label: 'a (segredo privado)', kind: 'private' },
      ],
    },
    {
      id: 'bob',
      name: 'Bob',
      role: 'Acredita falar com Alice',
      position: 'right',
      slots: [
        { key: 'p', label: 'p (público)', kind: 'param' },
        { key: 'g', label: 'g (público)', kind: 'param' },
        { key: 'B', label: 'B (enviado)', kind: 'public' },
        { key: 'Arec', label: 'Valor recebido (suposto A)', kind: 'public' },
        { key: 'K', label: 'K_{B} (com quem este segredo é compartilhado?)', kind: 'secret' },
        { key: 'b', label: 'b (segredo privado)', kind: 'private' },
      ],
    },
    {
      id: 'eva',
      name: 'Eva',
      role: 'Atacante ativa (homem do meio)',
      position: 'center',
      adversary: true,
      slots: [
        { key: 'A', label: 'A (capturado de Alice)', kind: 'public' },
        { key: 'B', label: 'B (capturado de Bob)', kind: 'public' },
        { key: 'E', label: 'E (valor falso enviado)', kind: 'public' },
        { key: 'KAE', label: 'K_{AE} (segredo com Alice)', kind: 'secret' },
        { key: 'KEB', label: 'K_{EB} (segredo com Bob)', kind: 'secret' },
        { key: 'e', label: 'e (segredo privado de Eva)', kind: 'private' },
      ],
    },
  ];
}

export function buildMitmProtocol(s: MitmSession): ProtocolDefinition {
  const { p, g, a, b, e, A, B, E, kAlice, kBob, kEvaAlice, kEvaBob } = s;
  const steps: ProtocolStep[] = [
    {
      id: 'params',
      title: 'Parâmetros públicos',
      description: 'Alice e Bob combinam (p, g) pelo canal. Eva, que controla o canal, repassa a mensagem sem alterá-la.',
      operation: 'Acordo sobre o grupo (p, g).',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: '(p, g)', summary: `p = ${p}, g = ${g}`, kind: 'param', observers: ['eva'] },
          deliver: [entry('p', 'p (público)', p, 'param'), entry('g', 'g (público)', g, 'param')],
        },
        { type: 'set', party: 'alice', entry: entry('p', 'p (público)', p, 'param') },
        { type: 'set', party: 'alice', entry: entry('g', 'g (público)', g, 'param') },
      ],
    },
    {
      id: 'secrets',
      title: 'Escolha dos segredos',
      description: 'Alice, Bob e também Eva escolhem expoentes privados. Eva participa do protocolo como se fosse um terceiro participante legítimo.',
      operation: 'Escolha de a, b e e.',
      events: [
        { type: 'set', party: 'alice', entry: entry('a', 'a (segredo privado)', a, 'private') },
        { type: 'set', party: 'bob', entry: entry('b', 'b (segredo privado)', b, 'private') },
        { type: 'set', party: 'eva', entry: entry('e', 'e (segredo privado de Eva)', e, 'private') },
      ],
    },
    {
      id: 'publics',
      title: 'Cálculo dos valores públicos',
      description: 'Alice calcula A, Bob calcula B e Eva calcula o seu próprio valor público E, que usará para se passar por ambos.',
      operation: 'A = g^a, B = g^b e E = g^e (mod p).',
      events: [
        {
          type: 'compute',
          operation: { party: 'alice', title: 'Alice calcula A', formula: 'A = g^{a} mod p', substituted: `A = ${g}^{${a}} mod ${p}`, result: `A = ${A}`, kind: 'public' },
          entry: entry('A', 'A (enviado)', A, 'public'),
        },
        {
          type: 'compute',
          operation: { party: 'bob', title: 'Bob calcula B', formula: 'B = g^{b} mod p', substituted: `B = ${g}^{${b}} mod ${p}`, result: `B = ${B}`, kind: 'public' },
          entry: entry('B', 'B (enviado)', B, 'public'),
        },
        {
          type: 'compute',
          operation: { party: 'eva', title: 'Eva calcula E', formula: 'E = g^{e} mod p', substituted: `E = ${g}^{${e}} mod ${p}`, result: `E = ${E}`, kind: 'public' },
          entry: entry('E', 'E (valor falso enviado)', E, 'public'),
        },
      ],
    },
    {
      id: 'intercept-a',
      title: 'Eva intercepta A e entrega E a Bob',
      description: 'Alice envia A, mas a mensagem chega a Eva. Eva guarda A e envia a Bob o seu valor E, como se fosse o A de Alice. Bob não tem como perceber a troca.',
      operation: 'Substituição de A por E no canal.',
      events: [
        { type: 'send', message: { from: 'alice', to: 'eva', label: 'A', summary: `A = ${A}`, kind: 'public' }, deliver: [entry('A', 'A (capturado de Alice)', A, 'public')] },
        { type: 'send', message: { from: 'eva', to: 'bob', label: "A' = E", summary: `E = ${E}`, kind: 'public', tampered: true }, deliver: [entry('Arec', 'Valor recebido (suposto A)', E, 'public')] },
      ],
    },
    {
      id: 'intercept-b',
      title: 'Eva intercepta B e entrega E a Alice',
      description: 'O mesmo ocorre no sentido contrário: Eva guarda B e entrega E a Alice no lugar de B.',
      operation: 'Substituição de B por E no canal.',
      events: [
        { type: 'send', message: { from: 'bob', to: 'eva', label: 'B', summary: `B = ${B}`, kind: 'public' }, deliver: [entry('B', 'B (capturado de Bob)', B, 'public')] },
        { type: 'send', message: { from: 'eva', to: 'alice', label: "B' = E", summary: `E = ${E}`, kind: 'public', tampered: true }, deliver: [entry('Brec', 'Valor recebido (suposto B)', E, 'public')] },
      ],
    },
    {
      id: 'shared',
      title: 'Cada lado calcula um segredo, mas com Eva',
      description: 'Alice e Bob aplicam a fórmula normalmente, sem suspeitar. Eva calcula os dois segredos correspondentes.',
      operation: 'K_A = E^a, K_B = E^b, K_AE = A^e, K_EB = B^e (mod p).',
      events: [
        {
          type: 'compute',
          operation: { party: 'alice', title: 'Alice calcula K_{A}', formula: "K_{A} = (B')^{a} mod p", substituted: `K_{A} = ${E}^{${a}} mod ${p}`, result: `K_{A} = ${kAlice}`, kind: 'secret' },
          entry: entry('K', 'K_{A} (com quem este segredo é compartilhado?)', kAlice, 'secret'),
        },
        {
          type: 'compute',
          operation: { party: 'bob', title: 'Bob calcula K_{B}', formula: "K_{B} = (A')^{b} mod p", substituted: `K_{B} = ${E}^{${b}} mod ${p}`, result: `K_{B} = ${kBob}`, kind: 'secret' },
          entry: entry('K', 'K_{B} (com quem este segredo é compartilhado?)', kBob, 'secret'),
        },
        {
          type: 'compute',
          operation: { party: 'eva', title: 'Eva calcula K_{AE} (com Alice)', formula: 'K_{AE} = A^{e} mod p', substituted: `K_{AE} = ${A}^{${e}} mod ${p}`, result: `K_{AE} = ${kEvaAlice}`, kind: 'secret' },
          entry: entry('KAE', 'K_{AE} (segredo com Alice)', kEvaAlice, 'secret'),
        },
        {
          type: 'compute',
          operation: { party: 'eva', title: 'Eva calcula K_{EB} (com Bob)', formula: 'K_{EB} = B^{e} mod p', substituted: `K_{EB} = ${B}^{${e}} mod ${p}`, result: `K_{EB} = ${kEvaBob}`, kind: 'secret' },
          entry: entry('KEB', 'K_{EB} (segredo com Bob)', kEvaBob, 'secret'),
        },
      ],
    },
    {
      id: 'outcome',
      title: 'Resultado do ataque',
      description: s.aliceMatchesBob
        ? 'Neste caso os segredos coincidiram porque a = b (módulo a ordem do grupo). Escolha valores diferentes para ver o ataque completo.'
        : 'Alice compartilha K_AE com Eva; Bob compartilha K_EB com Eva; Alice e Bob não compartilham nada entre si. Eva decifra, lê, altera e recifra todo o tráfego, sem ser notada.',
      operation: 'Comparação: K_A = K_AE? K_B = K_EB? K_A = K_B?',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'eva',
            title: 'Comparação dos segredos',
            formula: 'K_{A} = K_{AE},  K_{B} = K_{EB},  K_{A} = K_{B} ?',
            substituted: `${kAlice} = ${kEvaAlice},  ${kBob} = ${kEvaBob},  ${kAlice} = ${kBob} ?`,
            result: `${s.aliceMatchesEva ? 'sim' : 'não'},  ${s.bobMatchesEva ? 'sim' : 'não'},  ${s.aliceMatchesBob ? 'sim' : 'não'}`,
            kind: 'secret',
          },
        },
        {
          type: 'verdict',
          verdict: {
            ok: false,
            text: s.aliceMatchesBob
              ? 'Os segredos de Alice e Bob coincidiram por acaso (a = b); o ataque exige expoentes distintos.'
              : 'Ataque bem-sucedido: Alice e Bob estabeleceram segredos distintos, ambos conhecidos por Eva.',
          },
        },
      ],
    },
    {
      id: 'mitigation',
      title: 'Mitigação: acordo de chaves não é autenticação',
      description:
        'O Diffie-Hellman garante que o segredo é compartilhado entre quem trocou os valores, mas não prova QUEM são esses participantes. A defesa é autenticar a troca: assinaturas digitais e certificados (como no TLS 1.3) ou segredo pré-compartilhado.',
      operation: 'Nenhum cálculo: discussão da contramedida.',
      events: [],
      info: [
        'No TLS 1.3, o servidor assina o transcrito do handshake com sua chave privada, e o cliente verifica a assinatura usando o certificado.',
        'Autenticar significa vincular o valor público (A ou B) a uma identidade verificável.',
      ],
    },
  ];
  const plan: Record<string, Part[]> = {
    secrets: [
      { id: 'secret-a', title: 'Alice escolhe o segredo a', description: 'Alice guarda a na área protegida. Ela acredita estar falando apenas com Bob.', operation: 'Escolha de a.', take: 1 },
      { id: 'secret-b', title: 'Bob escolhe o segredo b', description: 'Bob guarda b na sua área protegida.', operation: 'Escolha de b.', take: 1 },
      { id: 'secret-e', title: 'Eva escolhe o segredo e', description: 'Eva participa do protocolo como se fosse um terceiro participante legítimo, com o seu próprio segredo e.', operation: 'Escolha de e.', take: 1 },
    ],
    publics: [
      { id: 'public-a', title: 'Alice calcula A', description: 'Alice calcula o seu valor público normalmente.', operation: 'A = g^a mod p.', take: 1 },
      { id: 'public-b', title: 'Bob calcula B', description: 'Bob calcula o seu valor público normalmente.', operation: 'B = g^b mod p.', take: 1 },
      { id: 'public-e', title: 'Eva calcula E', description: 'Eva calcula o valor E, que usará para se passar por Alice e por Bob.', operation: 'E = g^e mod p.', take: 1 },
    ],
    shared: [
      { id: 'shared-a', title: 'Alice calcula K_A sem suspeitar', description: 'Alice aplica a fórmula ao valor que recebeu, que é o E de Eva, e não o B de Bob.', operation: "K_A = (B')^a mod p, com B' = E.", take: 1 },
      { id: 'shared-b', title: 'Bob calcula K_B sem suspeitar', description: 'Bob também usa o valor recebido, que é o E de Eva, e não o A de Alice.', operation: "K_B = (A')^b mod p, com A' = E.", take: 1 },
      { id: 'shared-ae', title: 'Eva calcula K_AE, o segredo que divide com Alice', description: 'Eva combina o A capturado com o seu segredo e: obtém exatamente o mesmo número que Alice.', operation: 'K_AE = A^e mod p.', take: 1 },
      { id: 'shared-eb', title: 'Eva calcula K_EB, o segredo que divide com Bob', description: 'Eva combina o B capturado com e: obtém o mesmo número que Bob.', operation: 'K_EB = B^e mod p.', take: 1 },
    ],
  };
  return { id: 'dh-mitm', title: 'Diffie-Hellman: ataque do homem do meio', parties: partiesMitm(), steps: refine(steps, plan) };
}
