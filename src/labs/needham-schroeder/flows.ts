import { cipherHex, hex, PRINCIPAL_NAME, type NsRun, type Principal, type RandomSource, type WireMessage } from '../../crypto/needhamSchroeder';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep } from '../../simulation/types';

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (h: string, keep = 12) => (h.length <= keep ? h : `${h.slice(0, keep)}…`);
const nonce = (b: Uint8Array) => hex(b);
const ct = (m: WireMessage) => short(cipherHex(m.cipher), 16);
const bytes = (b: Uint8Array) => hex(b);

/** Fonte determinística (xorshift32, não criptográfica): só para testes e documentação. */
export function fixedRandom(seed = 1): RandomSource {
  let x = (0x9e3779b9 ^ (seed * 0x85ebca6b)) >>> 0 || 1;
  return (n) =>
    Uint8Array.from({ length: n }, () => {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      return x & 0xff;
    });
}

function parties(): PartyDef[] {
  return [
    {
      id: 'alice',
      name: 'Alice',
      role: 'Inicia a sessão (iniciadora)',
      position: 'left',
      slots: [
        { key: 'kpub', label: 'K_{A}^{+} (chave pública)', kind: 'public' },
        { key: 'kpriv', label: 'K_{A}^{-} (chave privada)', kind: 'private' },
        { key: 'na', label: 'Na (nonce de Alice)', kind: 'secret' },
        { key: 'nb', label: 'Nb (recebido)', kind: 'secret' },
        { key: 'conclusao', label: 'Conclusão de Alice', kind: 'plain' },
      ],
    },
    {
      id: 'bob',
      name: 'Bob',
      role: 'Responde (respondente)',
      position: 'right',
      slots: [
        { key: 'kpub', label: 'K_{B}^{+} (chave pública)', kind: 'public' },
        { key: 'kpriv', label: 'K_{B}^{-} (chave privada)', kind: 'private' },
        { key: 'na', label: 'Na (recebido)', kind: 'secret' },
        { key: 'nb', label: 'Nb (nonce de Bob)', kind: 'secret' },
        { key: 'conclusao', label: 'Conclusão de Bob', kind: 'plain' },
      ],
    },
    {
      id: 'eva',
      name: 'Eva',
      role: 'Participante legítima, mas desonesta; controla o canal',
      position: 'center',
      adversary: true,
      slots: [
        { key: 'kpub', label: 'K_{E}^{+} (chave pública)', kind: 'public' },
        { key: 'kpriv', label: 'K_{E}^{-} (chave privada)', kind: 'private' },
        { key: 'na', label: 'Na (aprendido por Eva)', kind: 'secret' },
        { key: 'nb', label: 'Nb (aprendido por Eva)', kind: 'secret' },
        { key: 'conclusao', label: 'O que Eva alcançou', kind: 'plain' },
      ],
    },
  ];
}

const PARTY_ID: Record<Principal, string> = { A: 'alice', B: 'bob', E: 'eva' };
const KIND_CIPHER: ItemKind = 'cipher';

/** Mensagem do canal: o conteúdo cifrado, visível a Eva (que o canal expõe), mas legível só pelo destinatário da chave. */
function send(m: WireMessage, label: string, summary: string, _deliver: Entry[], tampered = false): ProtocolStep['events'][number] {
  return {
    type: 'send',
    message: { from: PARTY_ID[m.from], to: PARTY_ID[m.to], label, summary, kind: KIND_CIPHER, observers: m.to === 'E' || m.from === 'E' ? [] : ['eva'], tampered },
    deliver: [],
  };
}

export function buildNsProtocol(run: NsRun): ProtocolDefinition {
  const fixed = run.variant === 'corrigido';
  const attack = run.scenario === 'ataque';
  const peer = run.aliceTalksTo;
  const peerName = PRINCIPAL_NAME[peer];
  const id2 = fixed ? ', B' : '';
  const msgs = run.messages;
  const m1 = msgs.find((m) => m.step === 1 && m.from === 'A')!;
  const m1r = msgs.find((m) => m.step === 1 && m.from === 'E');
  const m2 = msgs.find((m) => m.step === 2 && m.from === 'B')!;
  const m2r = msgs.find((m) => m.step === 2 && m.from === 'E');
  const m3 = msgs.find((m) => m.step === 3 && m.from === 'A');
  const m3r = msgs.find((m) => m.step === 3 && m.from === 'E');
  const na = nonce(run.na);
  const nb = nonce(run.nb);
  const steps: ProtocolStep[] = [];

  steps.push({
    id: 'keys',
    title: 'Cada participante tem um par de chaves e publica a chave pública',
    description:
      'Alice, Bob e Eva geram um par RSA didático (módulo de 128 bits, sem padding). As chaves públicas são conhecidas de todos; cada chave privada fica apenas com o seu dono. Eva é um usuário legítimo do sistema, com par próprio: o protocolo supõe que qualquer participante pode iniciar sessões com qualquer outro.',
    operation: 'Geração dos pares (K+, K-) e publicação de K+.',
    events: (['A', 'B', 'E'] as Principal[]).flatMap((p) => [
      { type: 'set' as const, party: PARTY_ID[p], entry: entry('kpub', `K_{${p}}^{+} (chave pública)`, short(run.keys[p].n.toString(16), 16), 'public') },
      { type: 'set' as const, party: PARTY_ID[p], entry: entry('kpriv', `K_{${p}}^{-} (chave privada)`, 'guardada', 'private') },
    ]),
  });

  steps.push({
    id: 'na',
    title: 'Alice sorteia o nonce Na',
    description: `Um nonce (número usado uma vez) é um valor aleatório que prova atualidade: só quem recebeu a mensagem de Alice pode devolvê-lo. Aqui Alice quer iniciar uma sessão com ${peerName}.`,
    operation: 'Sorteio de Na (32 bits).',
    events: [{ type: 'set', party: 'alice', entry: entry('na', 'Na (nonce de Alice)', na, 'secret') }],
  });

  steps.push({
    id: 'enc1',
    title: `Alice cifra {Na, A} com a chave pública de ${peerName}`,
    description: `A mensagem 1 leva Na e a identidade de Alice, cifradas com K_${peer}+. Só ${peerName} consegue decifrar.`,
    operation: `Mensagem 1: A → ${peer}: {Na, A}_K${peer}+.`,
    events: [
      {
        type: 'compute',
        operation: { party: 'alice', title: 'Alice cifra a mensagem 1', formula: `C_{1} = E(K_{${peer}}^{+}, Na | A)`, substituted: `C_{1} = E(K_{${peer}}^{+}, ${na} | A)`, result: `C_{1} = ${ct(m1)}`, kind: 'cipher' },
      },
    ],
  });

  steps.push({
    id: 'send1',
    title: `Alice envia a mensagem 1 a ${peerName}`,
    description: attack
      ? 'Alice acredita estar falando com Eva, um participante legítimo com quem ela quer se comunicar. Nada de errado do ponto de vista dela.'
      : 'A mensagem atravessa o canal. Eva a vê, mas é texto cifrado com a chave de Bob: sem K_B- ela nada aprende.',
    operation: `A → ${peer}: {Na, A}_K${peer}+.`,
    events: [send(m1, `{Na, A}_K${peer}+`, `C₁ = ${ct(m1)}`, [entry('c1', 'Mensagem 1 recebida', ct(m1), KIND_CIPHER)])],
  });

  if (attack && m1r) {
    steps.push({
      id: 'eva-dec1',
      title: 'Eva decifra a mensagem 1, que era para ela',
      description: 'Eva recebe a mensagem 1 legitimamente, decifra com K_E- e aprende o nonce Na de Alice e a identidade dela.',
      operation: 'Eva calcula D(K_E-, C₁) = Na | A.',
      events: [
        {
          type: 'compute',
          operation: { party: 'eva', title: 'Eva decifra a mensagem 1', formula: 'Na | A = D(K_{E}^{-}, C_{1})', substituted: `Na | A = D(K_{E}^{-}, ${ct(m1)})`, result: `Na = ${na}, A`, kind: 'secret' },
          entry: entry('na', 'Na (aprendido por Eva)', na, 'secret'),
        },
      ],
    });
    steps.push({
      id: 'eva-enc1',
      title: 'Eva recifra Na com a chave pública de Bob, dizendo ser Alice',
      description: 'O ponto central do ataque: a mensagem 1 não prova de quem ela vem, apenas que quem a produziu conhece a chave pública de Bob. Eva monta {Na, A}_KB+ com o mesmo Na e a identidade de Alice.',
      operation: 'E(A) → B: {Na, A}_KB+.',
      events: [
        {
          type: 'compute',
          operation: { party: 'eva', title: 'Eva monta a mensagem 1 para Bob', formula: 'C_{1}\' = E(K_{B}^{+}, Na | A)', substituted: `C_{1}' = E(K_{B}^{+}, ${na} | A)`, result: `C_{1}' = ${ct(m1r)}`, kind: 'cipher' },
        },
      ],
    });
    steps.push({
      id: 'eva-send1',
      title: 'Eva envia a Bob a mensagem 1 como se fosse Alice',
      description: 'Bob decifra e acredita que Alice quer iniciar uma sessão com ele.',
      operation: 'E(A) → B: {Na, A}_KB+.',
      events: [send(m1r, '{Na, A}_KB+  (como Alice)', `C₁' = ${ct(m1r)}`, [entry('c1', 'Mensagem 1 recebida', ct(m1r), KIND_CIPHER)], true)],
    });
  }

  steps.push({
    id: 'bob-dec1',
    title: 'Bob decifra a mensagem 1 e sorteia o nonce Nb',
    description: `Bob decifra com K_B-, lê Na e a identidade (Alice) e escolhe Nb. Daqui em diante ele acredita estar falando com Alice.`,
    operation: 'Bob calcula Na | A = D(K_B-, C₁) e sorteia Nb.',
    events: [
      {
        type: 'compute',
        operation: { party: 'bob', title: 'Bob decifra e sorteia Nb', formula: 'Na | A = D(K_{B}^{-}, C_{1});  Nb = aleatório', substituted: `Na | A = D(K_{B}^{-}, ${ct(attack && m1r ? m1r : m1)});  Nb = ${nb}`, result: `Na = ${na}, Nb = ${nb}`, kind: 'secret' },
        entry: entry('na', 'Na (recebido)', na, 'secret'),
      },
      { type: 'set', party: 'bob', entry: entry('nb', 'Nb (nonce de Bob)', nb, 'secret') },
    ],
  });

  steps.push({
    id: 'enc2',
    title: `Bob cifra {Na, Nb${id2}} com a chave pública de Alice`,
    description: fixed
      ? 'Na correção de Lowe, Bob inclui a sua própria identidade (B) na mensagem 2. Isso amarra a resposta a quem a gerou.'
      : 'Na versão original, a mensagem 2 leva só os dois nonces. Nada na mensagem diz quem a gerou.',
    operation: `Mensagem 2: B → A: {Na, Nb${id2}}_KA+.`,
    events: [
      {
        type: 'compute',
        operation: { party: 'bob', title: 'Bob cifra a mensagem 2', formula: `C_{2} = E(K_{A}^{+}, Na | Nb${id2.replace(', ', ' | ')})`, substituted: `C_{2} = E(K_{A}^{+}, ${na} | ${nb}${fixed ? ' | B' : ''})`, result: `C_{2} = ${ct(m2)}`, kind: 'cipher' },
      },
    ],
  });

  steps.push({
    id: 'send2',
    title: attack ? 'Bob envia a mensagem 2 a quem lhe escreveu (Eva, no papel de Alice)' : 'Bob envia a mensagem 2 a Alice',
    description: attack
      ? 'Bob responde ao endereço de quem enviou a mensagem 1, que passa por Eva. Eva não consegue decifrar a mensagem 2, que está cifrada com K_A+.'
      : 'Eva vê o texto cifrado, mas não aprende Nb: ele está cifrado com K_A+.',
    operation: `B → ${attack ? 'E(A)' : 'A'}: {Na, Nb${id2}}_KA+.`,
    events: [send(m2, `{Na, Nb${id2}}_KA+`, `C₂ = ${ct(m2)}`, attack ? [entry('c2', 'Mensagem 2 retida', ct(m2), KIND_CIPHER)] : [entry('c2', 'Mensagem 2 recebida', ct(m2), KIND_CIPHER)])],
  });

  if (attack && m2r) {
    steps.push({
      id: 'eva-relay2',
      title: 'Eva repassa a mensagem 2 a Alice, sem alterar',
      description: 'Eva não precisa decifrar nada: a mensagem já está cifrada para Alice. Ela apenas a entrega, e Alice a recebe como se fosse resposta de Eva à mensagem 1.',
      operation: 'E → A: {Na, Nb' + id2 + '}_KA+ (repasse).',
      events: [send(m2r, `{Na, Nb${id2}}_KA+  (repasse)`, `C₂ = ${ct(m2r)}`, [entry('c2', 'Mensagem 2 recebida', ct(m2r), KIND_CIPHER)])],
    });
  }

  steps.push({
    id: 'alice-check',
    title: 'Alice decifra a mensagem 2 e confere',
    description: `${run.aliceCheck.reason}${fixed ? '' : attack ? ' Ela não tem como saber que o Nb veio de Bob e não de Eva.' : ''}`,
    operation: fixed ? `Alice confere Na e a identidade (esperada: ${peerName}).` : 'Alice confere Na.',
    events: [
      {
        type: 'compute',
        operation: {
          party: 'alice',
          title: 'Alice decifra e confere',
          formula: fixed ? 'Na | Nb | B = D(K_{A}^{-}, C_{2});  Na confere? B = peer?' : 'Na | Nb = D(K_{A}^{-}, C_{2});  Na confere?',
          substituted: `D(K_{A}^{-}, ${ct(m2r ?? m2)});  Na = ${na}`,
          result: run.aliceCheck.accepted ? 'sim' : 'não: aborta',
          kind: 'plain',
        },
        ...(run.aliceCheck.accepted ? { entry: entry('nb', 'Nb (recebido)', nb, 'secret') } : {}),
      },
      { type: 'set', party: 'alice', entry: entry('conclusao', 'Conclusão de Alice', run.aliceCheck.accepted ? `fala com ${peerName}` : 'aborta o protocolo', 'plain') },
      ...(run.aliceCheck.accepted
        ? []
        : [
            {
              type: 'verdict' as const,
              verdict: { ok: true, text: 'Ataque barrado: Alice viu que o respondente é Bob, e não Eva, com quem pretendia falar, e abortou antes de enviar a mensagem 3. Eva não aprendeu Nb.' },
            },
          ]),
    ],
  });

  if (m3) {
    steps.push({
      id: 'send3',
      title: `Alice cifra {Nb} com a chave de ${peerName} e envia a mensagem 3`,
      description: 'Alice devolve Nb para provar que decifrou a mensagem 2 (e, portanto, que possui K_A-).',
      operation: `A → ${peer}: {Nb}_K${peer}+.`,
      events: [
        {
          type: 'compute',
          operation: { party: 'alice', title: 'Alice cifra a mensagem 3', formula: `C_{3} = E(K_{${peer}}^{+}, Nb)`, substituted: `C_{3} = E(K_{${peer}}^{+}, ${nb})`, result: `C_{3} = ${ct(m3)}`, kind: 'cipher' },
        },
        send(m3, `{Nb}_K${peer}+`, `C₃ = ${ct(m3)}`, [entry('c3', 'Mensagem 3 recebida', ct(m3), KIND_CIPHER)]),
      ],
    });
  }

  if (attack && m3 && m3r) {
    steps.push({
      id: 'eva-dec3',
      title: 'Eva decifra a mensagem 3 e aprende Nb',
      description: 'Alice entregou a Eva o segredo que Bob havia gerado: Alice funcionou, sem saber, como um oráculo de decifragem.',
      operation: 'Eva calcula Nb = D(K_E-, C₃).',
      events: [
        {
          type: 'compute',
          operation: { party: 'eva', title: 'Eva decifra a mensagem 3', formula: 'Nb = D(K_{E}^{-}, C_{3})', substituted: `Nb = D(K_{E}^{-}, ${ct(m3)})`, result: `Nb = ${nb}`, kind: 'secret' },
          entry: entry('nb', 'Nb (aprendido por Eva)', nb, 'secret'),
        },
      ],
    });
    steps.push({
      id: 'eva-send3',
      title: 'Eva recifra Nb com a chave pública de Bob e envia, como Alice',
      description: 'Eva cifra Nb com K_B+ e entrega a Bob como a mensagem 3 de Alice.',
      operation: 'E(A) → B: {Nb}_KB+.',
      events: [
        {
          type: 'compute',
          operation: { party: 'eva', title: 'Eva monta a mensagem 3 para Bob', formula: 'C_{3}\' = E(K_{B}^{+}, Nb)', substituted: `C_{3}' = E(K_{B}^{+}, ${nb})`, result: `C_{3}' = ${ct(m3r)}`, kind: 'cipher' },
        },
        send(m3r, '{Nb}_KB+  (como Alice)', `C₃' = ${ct(m3r)}`, [entry('c3', 'Mensagem 3 recebida', ct(m3r), KIND_CIPHER)], true),
      ],
    });
  }

  if (m3) {
    steps.push({
      id: 'bob-check',
      title: 'Bob decifra a mensagem 3 e confere Nb',
      description: attack
        ? 'Nb confere, e Bob conclui que quem respondeu à mensagem 2 é Alice, que possui K_A-. Está enganado: foi Eva quem lhe entregou o Nb.'
        : 'Nb confere: apenas quem decifrou a mensagem 2 (portanto, quem possui K_A-) poderia devolvê-lo. Bob autentica Alice.',
      operation: 'Bob calcula Nb\' = D(K_B-, C₃) e compara com Nb.',
      events: [
        {
          type: 'compute',
          operation: { party: 'bob', title: 'Bob decifra e compara Nb', formula: "Nb' = D(K_{B}^{-}, C_{3});  Nb' = Nb?", substituted: `Nb' = D(K_{B}^{-}, ${ct(m3r ?? m3)});  Nb = ${nb}`, result: run.bobCheck.accepted ? 'sim' : 'não', kind: 'plain' },
        },
        { type: 'set', party: 'bob', entry: entry('conclusao', 'Conclusão de Bob', run.bobCheck.accepted ? 'autenticou Alice' : 'rejeitou', 'plain') },
        ...(attack
          ? [
              { type: 'set' as const, party: 'eva', entry: entry('conclusao', 'O que Eva alcançou', 'Bob a trata como Alice; Eva conhece Na e Nb', 'plain') },
              {
                type: 'verdict' as const,
                verdict: { ok: false, text: 'Ataque de Lowe bem-sucedido: Bob autenticou "Alice", mas quem estava do outro lado era Eva. Eva conhece Na e Nb e pode derivar a chave de sessão que Alice e Bob supostamente combinariam.' },
              },
            ]
          : [
              {
                type: 'verdict' as const,
                verdict: { ok: true, text: 'Autenticação mútua concluída: Alice sabe que Bob decifrou a mensagem 1 e Bob sabe que Alice decifrou a mensagem 2. Eva viu apenas texto cifrado e não conhece Na nem Nb.' },
              },
            ]),
      ],
    });
  }

  const title =
    (fixed ? 'Needham-Schroeder com a correção de Lowe' : 'Needham-Schroeder de chave pública') + (attack ? ': Eva se passa por Alice' : ': sessão entre Alice e Bob');
  return { id: `ns-${run.variant}-${run.scenario}`, title, parties: parties(), steps };
}

export { bytes };
