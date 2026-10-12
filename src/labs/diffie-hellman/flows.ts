import type { DhSession, MitmSession } from '../../crypto/diffieHellman';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

const entry = (key: string, label: string, value: bigint | string, kind: ItemKind): Entry => ({ key, label, value: value.toString(), kind });

const EVE_SLOTS_PASSIVE = [
  { key: 'p', label: 'p (observado)', kind: 'param' as const },
  { key: 'g', label: 'g (observado)', kind: 'param' as const },
  { key: 'A', label: 'A (observado)', kind: 'public' as const },
  { key: 'B', label: 'B (observado)', kind: 'public' as const },
];

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
    { id: 'eve', name: 'Eve', role: 'Observadora passiva da rede', position: 'center', adversary: true, slots: EVE_SLOTS_PASSIVE },
  ];
}

export function buildDhProtocol(s: DhSession): ProtocolDefinition {
  const { p, g, a, b, A, B, kAlice, kBob } = s;
  const steps: ProtocolStep[] = [
    {
      id: 'params',
      title: 'Parâmetros públicos',
      description: 'Alice e Bob concordam, abertamente, em um primo p e em um gerador g. Esses valores não são secretos: Eve também os conhece.',
      operation: 'Acordo sobre o grupo (p, g).',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: '(p, g)', summary: `p = ${p}, g = ${g}`, kind: 'param', observers: ['eve'] },
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
      description: 'Alice envia A a Bob e Bob envia B a Alice, pelo canal público. Eve registra ambos, mas a e b nunca trafegam.',
      operation: 'Transmissão de A e de B pelo canal.',
      events: [
        { type: 'send', message: { from: 'alice', to: 'bob', label: 'A', summary: `A = ${A}`, kind: 'public', observers: ['eve'] }, deliver: [entry('Arec', 'A (valor público recebido)', A, 'public')], observerEntries: [entry('A', 'A (observado)', A, 'public')] },
        { type: 'send', message: { from: 'bob', to: 'alice', label: 'B', summary: `B = ${B}`, kind: 'public', observers: ['eve'] }, deliver: [entry('Brec', 'B (valor público recebido)', B, 'public')], observerEntries: [entry('B', 'B (observado)', B, 'public')] },
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
        ? 'K_A = K_B: os dois participantes obtiveram o mesmo segredo, e Eve, que conhece p, g, A e B, não o calculou.'
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
  return { id: 'dh-basic', title: 'Diffie-Hellman: troca de chaves', parties: partiesBasic(), steps };
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
      id: 'eve',
      name: 'Eve',
      role: 'Atacante ativa (homem do meio)',
      position: 'center',
      adversary: true,
      slots: [
        { key: 'A', label: 'A (capturado de Alice)', kind: 'public' },
        { key: 'B', label: 'B (capturado de Bob)', kind: 'public' },
        { key: 'E', label: 'E (valor falso enviado)', kind: 'public' },
        { key: 'KAE', label: 'K_{AE} (segredo com Alice)', kind: 'secret' },
        { key: 'KEB', label: 'K_{EB} (segredo com Bob)', kind: 'secret' },
        { key: 'e', label: 'e (segredo privado de Eve)', kind: 'private' },
      ],
    },
  ];
}

export function buildMitmProtocol(s: MitmSession): ProtocolDefinition {
  const { p, g, a, b, e, A, B, E, kAlice, kBob, kEveAlice, kEveBob } = s;
  const steps: ProtocolStep[] = [
    {
      id: 'params',
      title: 'Parâmetros públicos',
      description: 'Alice e Bob combinam (p, g) pelo canal. Eve, que controla o canal, repassa a mensagem sem alterá-la.',
      operation: 'Acordo sobre o grupo (p, g).',
      events: [
        {
          type: 'send',
          message: { from: 'alice', to: 'bob', label: '(p, g)', summary: `p = ${p}, g = ${g}`, kind: 'param', observers: ['eve'] },
          deliver: [entry('p', 'p (público)', p, 'param'), entry('g', 'g (público)', g, 'param')],
        },
        { type: 'set', party: 'alice', entry: entry('p', 'p (público)', p, 'param') },
        { type: 'set', party: 'alice', entry: entry('g', 'g (público)', g, 'param') },
      ],
    },
    {
      id: 'secrets',
      title: 'Escolha dos segredos',
      description: 'Alice, Bob e também Eve escolhem expoentes privados. Eve participa do protocolo como se fosse um terceiro participante legítimo.',
      operation: 'Escolha de a, b e e.',
      events: [
        { type: 'set', party: 'alice', entry: entry('a', 'a (segredo privado)', a, 'private') },
        { type: 'set', party: 'bob', entry: entry('b', 'b (segredo privado)', b, 'private') },
        { type: 'set', party: 'eve', entry: entry('e', 'e (segredo privado de Eve)', e, 'private') },
      ],
    },
    {
      id: 'publics',
      title: 'Cálculo dos valores públicos',
      description: 'Alice calcula A, Bob calcula B e Eve calcula o seu próprio valor público E, que usará para se passar por ambos.',
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
          operation: { party: 'eve', title: 'Eve calcula E', formula: 'E = g^{e} mod p', substituted: `E = ${g}^{${e}} mod ${p}`, result: `E = ${E}`, kind: 'public' },
          entry: entry('E', 'E (valor falso enviado)', E, 'public'),
        },
      ],
    },
    {
      id: 'intercept-a',
      title: 'Eve intercepta A e entrega E a Bob',
      description: 'Alice envia A, mas a mensagem chega a Eve. Eve guarda A e envia a Bob o seu valor E, como se fosse o A de Alice. Bob não tem como perceber a troca.',
      operation: 'Substituição de A por E no canal.',
      events: [
        { type: 'send', message: { from: 'alice', to: 'eve', label: 'A', summary: `A = ${A}`, kind: 'public' }, deliver: [entry('A', 'A (capturado de Alice)', A, 'public')] },
        { type: 'send', message: { from: 'eve', to: 'bob', label: "A' = E", summary: `E = ${E}`, kind: 'public', tampered: true }, deliver: [entry('Arec', 'Valor recebido (suposto A)', E, 'public')] },
      ],
    },
    {
      id: 'intercept-b',
      title: 'Eve intercepta B e entrega E a Alice',
      description: 'O mesmo ocorre no sentido contrário: Eve guarda B e entrega E a Alice no lugar de B.',
      operation: 'Substituição de B por E no canal.',
      events: [
        { type: 'send', message: { from: 'bob', to: 'eve', label: 'B', summary: `B = ${B}`, kind: 'public' }, deliver: [entry('B', 'B (capturado de Bob)', B, 'public')] },
        { type: 'send', message: { from: 'eve', to: 'alice', label: "B' = E", summary: `E = ${E}`, kind: 'public', tampered: true }, deliver: [entry('Brec', 'Valor recebido (suposto B)', E, 'public')] },
      ],
    },
    {
      id: 'shared',
      title: 'Cada lado calcula um segredo, mas com Eve',
      description: 'Alice e Bob aplicam a fórmula normalmente, sem suspeitar. Eve calcula os dois segredos correspondentes.',
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
          operation: { party: 'eve', title: 'Eve calcula K_{AE} (com Alice)', formula: 'K_{AE} = A^{e} mod p', substituted: `K_{AE} = ${A}^{${e}} mod ${p}`, result: `K_{AE} = ${kEveAlice}`, kind: 'secret' },
          entry: entry('KAE', 'K_{AE} (segredo com Alice)', kEveAlice, 'secret'),
        },
        {
          type: 'compute',
          operation: { party: 'eve', title: 'Eve calcula K_{EB} (com Bob)', formula: 'K_{EB} = B^{e} mod p', substituted: `K_{EB} = ${B}^{${e}} mod ${p}`, result: `K_{EB} = ${kEveBob}`, kind: 'secret' },
          entry: entry('KEB', 'K_{EB} (segredo com Bob)', kEveBob, 'secret'),
        },
      ],
    },
    {
      id: 'outcome',
      title: 'Resultado do ataque',
      description: s.aliceMatchesBob
        ? 'Neste caso os segredos coincidiram porque a = b (módulo a ordem do grupo). Escolha valores diferentes para ver o ataque completo.'
        : 'Alice compartilha K_AE com Eve; Bob compartilha K_EB com Eve; Alice e Bob não compartilham nada entre si. Eve decifra, lê, altera e recifra todo o tráfego, sem ser notada.',
      operation: 'Comparação: K_A = K_AE? K_B = K_EB? K_A = K_B?',
      events: [
        {
          type: 'compute',
          operation: {
            party: 'eve',
            title: 'Comparação dos segredos',
            formula: 'K_{A} = K_{AE},  K_{B} = K_{EB},  K_{A} = K_{B} ?',
            substituted: `${kAlice} = ${kEveAlice},  ${kBob} = ${kEveBob},  ${kAlice} = ${kBob} ?`,
            result: `${s.aliceMatchesEve ? 'sim' : 'não'},  ${s.bobMatchesEve ? 'sim' : 'não'},  ${s.aliceMatchesBob ? 'sim' : 'não'}`,
            kind: 'secret',
          },
        },
        {
          type: 'verdict',
          verdict: {
            ok: false,
            text: s.aliceMatchesBob
              ? 'Os segredos de Alice e Bob coincidiram por acaso (a = b); o ataque exige expoentes distintos.'
              : 'Ataque bem-sucedido: Alice e Bob estabeleceram segredos distintos, ambos conhecidos por Eve.',
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
  return { id: 'dh-mitm', title: 'Diffie-Hellman: ataque do homem do meio', parties: partiesMitm(), steps };
}
