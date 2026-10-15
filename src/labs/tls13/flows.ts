import type { TlsEngine } from '../../crypto/engines';
import type { TlsHandshake, TlsInput } from '../../crypto/tls13';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, SimulationEvent, ProtocolStep } from '../../simulation/types';

export const MAX_MESSAGE = 200;

export interface TlsRun {
  hs: TlsHandshake;
  verdictText: string;
}

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
/** Abrevia um valor em hexadecimal para exibição. */
export const hex = (x: string, n = 12) => (x.length > n * 2 + 1 ? `${x.slice(0, n)}…${x.slice(-4)}` : x);

export async function runTls(engine: TlsEngine, input: TlsInput): Promise<TlsRun> {
  const hs = await engine.handshake(input);
  return { hs, verdictText: verdictOf(hs) };
}

function verdictOf(h: TlsHandshake): string {
  if (h.scenario === 'normal') {
    return 'Alice e Bob derivaram as mesmas chaves, e Eva, que viu as duas chaves públicas efêmeras e todos os registros, não consegue obter o segredo ECDHE: isso exigiria uma das chaves privadas (problema do logaritmo discreto em curvas elípticas). Como as chaves efêmeras são descartadas, um vazamento posterior da chave do servidor não decifra este tráfego (sigilo adiante).';
  }
  if (h.aborted) {
    return `Eva fez um handshake próprio com Alice, usando uma chave efêmera sua, e repetiu o certificado verdadeiro de Bob (que é público). Mas o CertificateVerify exige uma assinatura com a chave privada do servidor, que Eva não tem, e Alice interrompeu o handshake: ${h.abortReason}. Observe que o Finished de Eva estava correto: ele prova apenas que ela conhece as chaves da sessão, e não quem ela é. É a autenticação do servidor que impede o ataque, e não a troca de chaves.`;
  }
  return 'Alice não verificou o certificado nem o CertificateVerify, então aceitou o handshake com Eva: a troca de chaves ECDHE sozinha não autentica ninguém. Eva decifra tudo o que Alice envia (e poderia reenviar a Bob). É o mesmo ataque do homem do meio do Diffie-Hellman, que o TLS impede com certificados e assinaturas.';
}

const parties: PartyDef[] = [
  {
    id: 'alice',
    name: 'Alice',
    role: 'Cliente',
    position: 'left',
    slots: [
      { key: 'x', label: 'Chave efêmera privada', kind: 'secret' },
      { key: 'S', label: 'Segredo ECDHE', kind: 'secret' },
      { key: 'HS', label: 'Segredo do handshake', kind: 'secret' },
      { key: 'T', label: 'Chaves de tráfego do handshake', kind: 'secret' },
      { key: 'AP', label: 'Chaves da aplicação', kind: 'secret' },
      { key: 'm', label: 'Mensagem de aplicação', kind: 'plain' },
    ],
  },
  {
    id: 'bob',
    name: 'Bob',
    role: 'Servidor',
    position: 'right',
    slots: [
      { key: 'id', label: 'Chave de identidade (ECDSA)', kind: 'secret' },
      { key: 'x', label: 'Chave efêmera privada', kind: 'secret' },
      { key: 'S', label: 'Segredo ECDHE', kind: 'secret' },
      { key: 'HS', label: 'Segredo do handshake', kind: 'secret' },
      { key: 'AP', label: 'Chaves da aplicação', kind: 'secret' },
      { key: 'mrec', label: 'Mensagem recebida', kind: 'plain' },
    ],
  },
  {
    id: 'eva',
    name: 'Eva',
    role: 'Atacante (observa e, se puder, intercepta o canal)',
    position: 'center',
    adversary: true,
    slots: [
      { key: 'seen', label: 'Observado no canal', kind: 'cipher' },
      { key: 'x', label: 'Chave efêmera de Eva', kind: 'secret' },
      { key: 'S', label: 'Segredo ECDHE com Alice', kind: 'secret' },
      { key: 'forged', label: 'Voo falsificado', kind: 'cipher' },
      { key: 'P', label: 'Texto lido por Eva', kind: 'plain' },
    ],
  },
];

type Compute = Extract<SimulationEvent, { type: 'compute' }>;
const compute = (party: string, title: string, formula: string, substituted: string, result: string, kind: ItemKind, e?: Entry): Compute => ({
  type: 'compute',
  operation: { party, title, formula, substituted, result, kind },
  ...(e ? { entry: e } : {}),
});
const step = (id: string, title: string, description: string, operation: string, events: SimulationEvent[], info?: string[]): ProtocolStep => ({ id, title, description, operation, events, ...(info ? { info } : {}) });

export function buildTlsProtocol(h: TlsHandshake): ProtocolDefinition {
  const mitm = h.scenario === 'mitm';
  const skip = mitm && !h.clientVerifies; // Alice não verifica
  const responder = mitm ? 'eva' : 'bob';
  const steps: ProtocolStep[] = [];

  // ---- ClientHello ----
  steps.push(
    step('client-keygen', 'Alice gera o par efêmero (ECDHE)', 'Alice sorteia uma chave privada de curva elíptica P-256 e calcula a chave pública correspondente. O par é efêmero: existe só neste handshake.', 'Geração do par de chaves ECDHE P-256.', [
      compute('alice', 'Par ECDHE efêmero', 'A = a · G (a aleatório, G o gerador da curva P-256)', 'a: 256 bits aleatórios', `A = ${hex(h.clientPub)}`, 'public', entry('x', 'Chave efêmera privada', 'a (guardada em segredo)', 'secret')),
    ]),
  );
  steps.push(
    step(
      'client-hello',
      mitm ? 'Eva intercepta o ClientHello' : 'Alice envia o ClientHello',
      'O ClientHello leva um valor aleatório de 32 bytes e a chave pública efêmera (extensão key_share). Vai em claro: o canal ainda não tem chaves.',
      'Envio do ClientHello.',
      [
        mitm
          ? { type: 'send', message: { from: 'alice', to: 'eva', label: 'ClientHello', summary: `random + key_share ${hex(h.clientPub, 8)}`, kind: 'public' }, deliver: [entry('seen', 'ClientHello de Alice', `A = ${hex(h.clientPub, 8)}`, 'public')] }
          : { type: 'send', message: { from: 'alice', to: 'bob', label: 'ClientHello', summary: `random + key_share ${hex(h.clientPub, 8)}`, kind: 'public', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `ClientHello: A = ${hex(h.clientPub, 8)}`, 'public')] },
      ],
    ),
  );

  // ---- ServerHello ----
  if (mitm) {
    steps.push(
      step('eva-keygen', 'Eva gera o próprio par efêmero', 'Em vez de repassar o ClientHello a Bob, Eva faz de conta que é o servidor e gera um par ECDHE próprio.', 'Geração do par ECDHE de Eva.', [
        compute('eva', 'Par ECDHE de Eva', 'E = e · G', 'e: 256 bits aleatórios', `E = ${hex(h.responderPub)}`, 'public', entry('x', 'Chave efêmera de Eva', 'e (guardada por Eva)', 'secret')),
      ]),
    );
  } else {
    steps.push(
      step('server-keygen', 'Bob gera o par efêmero (ECDHE)', 'Bob faz o mesmo: sorteia uma chave privada e calcula a pública.', 'Geração do par de chaves ECDHE P-256.', [
        compute('bob', 'Par ECDHE efêmero', 'B = b · G', 'b: 256 bits aleatórios', `B = ${hex(h.responderPub)}`, 'public', entry('x', 'Chave efêmera privada', 'b (guardada em segredo)', 'secret')),
      ]),
    );
  }
  steps.push(
    step(
      'server-hello',
      mitm ? 'Eva responde a Alice com um ServerHello falso' : 'Bob envia o ServerHello',
      'O ServerHello leva o valor aleatório do servidor e a sua chave pública efêmera. Depois dele, todo o tráfego passa a ser cifrado.',
      'Envio do ServerHello.',
      [
        mitm
          ? { type: 'send', message: { from: 'eva', to: 'alice', label: 'ServerHello', summary: `random + key_share ${hex(h.responderPub, 8)} (de Eva)`, kind: 'public', tampered: true }, deliver: [] }
          : { type: 'send', message: { from: 'bob', to: 'alice', label: 'ServerHello', summary: `random + key_share ${hex(h.responderPub, 8)}`, kind: 'public', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `A = ${hex(h.clientPub, 6)}, B = ${hex(h.responderPub, 6)}`, 'public')] },
      ],
    ),
  );

  // ---- segredo ECDHE ----
  steps.push(
    step('alice-shared', 'Alice calcula o segredo ECDHE', 'Multiplicando a chave pública recebida pela sua chave privada, Alice obtém um ponto da curva; a coordenada x é o segredo compartilhado.', 'Cálculo ECDH: a · (chave pública recebida).', [
      compute('alice', 'Segredo ECDHE', 'S = x(a · B) (ou a · E, no ataque)', `a · ${hex(h.responderPub, 6)}`, `S = ${hex(h.sharedSecret)}`, 'secret', entry('S', 'Segredo ECDHE', hex(h.sharedSecret), 'secret')),
    ]),
  );
  steps.push(
    step(responder + '-shared', `${mitm ? 'Eva' : 'Bob'} calcula o segredo ECDHE`, 'Pela propriedade a · (b · G) = b · (a · G), o outro lado chega ao mesmo valor.', 'Cálculo ECDH com a chave pública de Alice.', [
      compute(responder, 'Segredo ECDHE', mitm ? 'S = x(e · A)' : 'S = x(b · A)', `${mitm ? 'e' : 'b'} · ${hex(h.clientPub, 6)}`, `S = ${hex(h.sharedSecret)}`, 'secret', entry('S', mitm ? 'Segredo ECDHE com Alice' : 'Segredo ECDHE', hex(h.sharedSecret), 'secret')),
    ]),
  );
  if (!mitm) {
    steps.push(
      step('eva-try', 'Eva tenta obter o segredo', 'Eva viu as duas chaves públicas A e B. Para chegar ao segredo precisaria de a ou de b, isto é, resolver o logaritmo discreto na curva P-256, inviável.', 'Nenhum cálculo viável: faltam as chaves privadas.', [], [
        'Eva conhece A, B, os valores aleatórios e todos os registros cifrados, mas não a nem b.',
      ]),
    );
  }

  // ---- cronograma de chaves: Alice ----
  const hsStep = (who: string, name: string) =>
    step(`${who}-hs`, `${name} deriva o segredo do handshake`, `O cronograma de chaves do TLS 1.3 (HKDF) mistura o segredo ECDHE ao "Early Secret" por meio de HKDF-Extract. Early Secret = ${hex(h.early, 6)}; derived = ${hex(h.derivedEarly, 6)}.`, 'HKDF-Extract(derived, segredo ECDHE).', [
      compute(who, 'Handshake Secret', 'HS = HKDF-Extract(salt = Derive-Secret(Early, "derived"), IKM = S)', `S = ${hex(h.sharedSecret, 6)}`, `HS = ${hex(h.handshakeSecret)}`, 'secret', entry('HS', 'Segredo do handshake', hex(h.handshakeSecret), 'secret')),
    ]);
  const trafficStep = (who: string, name: string) =>
    step(`${who}-traffic`, `${name} deriva as chaves de tráfego do handshake`, `Com a transcrição das mensagens até o ServerHello (hash ${hex(h.helloHash, 6)}), HKDF-Expand-Label produz os segredos "c hs traffic" e "s hs traffic" e deles a chave AES-128, o IV e a chave do Finished.`, 'Derive-Secret(HS, "c hs traffic" e "s hs traffic", Hash(ClientHello..ServerHello)).', [
      compute(who, 'Chaves de tráfego do handshake', 'Derive-Secret(HS, rótulo, H(CH..SH)); key, iv e finished por HKDF-Expand-Label', `H(CH..SH) = ${hex(h.helloHash, 6)}`, `chave do servidor = ${hex(h.serverHsKey)}`, 'secret', entry('T', 'Chaves de tráfego do handshake', `servidor ${hex(h.serverHs, 6)}`, 'secret')),
    ]);
  steps.push(hsStep('alice', 'Alice'), trafficStep('alice', 'Alice'));
  steps.push(hsStep(responder, mitm ? 'Eva' : 'Bob'), trafficStep(responder, mitm ? 'Eva' : 'Bob'));

  // ---- voo do servidor ----
  if (mitm) {
    steps.push(
      step('eva-cv', 'Eva tenta assinar o CertificateVerify', 'Para passar por servidor, Eva repete o certificado verdadeiro de Bob, que é público. Mas o CertificateVerify é uma assinatura ECDSA da transcrição feita com a chave privada do servidor. Eva só pode assinar com a sua própria chave.', 'Assinatura ECDSA da transcrição com a chave de Eva.', [
        compute('eva', 'CertificateVerify falsificado', 'Assinatura_ECDSA(chave de Eva, 64 espaços ‖ "TLS 1.3, server CertificateVerify" ‖ 0x00 ‖ H(CH..Certificate))', `H = ${hex(h.serverFlightHash, 6)}`, `assinatura = ${hex(h.certVerifySignature)}`, 'signature', entry('forged', 'Voo falsificado', `certificado de Bob + assinatura de Eva`, 'cipher')),
      ]),
      step('eva-fin', 'Eva calcula um Finished válido', 'O Finished é um HMAC da transcrição com a chave de Finished derivada do segredo do handshake. Eva conhece esse segredo (é dela o outro lado do ECDHE), então calcula um Finished correto. Mas isso só prova conhecimento das chaves, não identidade.', 'HMAC-SHA-256(chave do Finished, H(transcrição)).', [
        compute('eva', 'Finished', 'verify_data = HMAC(finished_key, H(CH..CertificateVerify))', `H = ${hex(h.certVerifyHash, 6)}`, `verify_data = ${hex(h.serverFinished)}`, 'signature'),
      ]),
      step('eva-flight', 'Eva envia o voo do "servidor" a Alice', 'EncryptedExtensions, Certificate, CertificateVerify e Finished seguem em um registro cifrado com a chave do handshake do servidor.', 'Envio do registro cifrado.', [
        { type: 'send', message: { from: 'eva', to: 'alice', label: 'Registro cifrado (voo do servidor)', summary: hex(h.flightRecord, 10), kind: 'cipher', tampered: true }, deliver: [] },
      ]),
    );
  } else {
    steps.push(
      step('server-cv', 'Bob assina o CertificateVerify', 'Bob prova que possui a chave privada do certificado assinando a transcrição do handshake até o certificado. A assinatura amarra a identidade às chaves desta sessão.', 'Assinatura ECDSA da transcrição com a chave de identidade de Bob.', [
        compute('bob', 'CertificateVerify', 'Assinatura_ECDSA(chave de Bob, 64 espaços ‖ "TLS 1.3, server CertificateVerify" ‖ 0x00 ‖ H(CH..Certificate))', `H = ${hex(h.serverFlightHash, 6)}`, `assinatura = ${hex(h.certVerifySignature)}`, 'signature', entry('id', 'Chave de identidade (ECDSA)', 'usada para assinar', 'secret')),
      ]),
      step('server-fin', 'Bob calcula o Finished', 'O Finished é um HMAC de toda a transcrição com a chave de Finished do servidor: confirma que ninguém alterou as mensagens do handshake.', 'HMAC-SHA-256(chave do Finished, H(transcrição)).', [
        compute('bob', 'Finished', 'verify_data = HMAC(finished_key, H(CH..CertificateVerify))', `H = ${hex(h.certVerifyHash, 6)}`, `verify_data = ${hex(h.serverFinished)}`, 'signature'),
      ]),
      step('server-flight', 'Bob envia o voo cifrado', 'EncryptedExtensions, Certificate, CertificateVerify e Finished seguem em um registro AES-128-GCM com a chave do handshake do servidor. Eva só vê bytes cifrados, inclusive o certificado (em TLS 1.2 ele ia em claro).', 'Envio do registro cifrado.', [
        { type: 'send', message: { from: 'bob', to: 'alice', label: 'Registro cifrado (voo do servidor)', summary: hex(h.flightRecord, 10), kind: 'cipher', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `registro cifrado ${hex(h.flightRecord, 6)}`, 'cipher')] },
      ]),
    );
  }

  // ---- verificações de Alice ----
  steps.push(
    step('alice-cert', skip ? 'Alice não verifica o certificado (erro)' : 'Alice verifica o certificado', skip ? 'Neste cenário Alice aceita qualquer certificado: é o erro de um cliente mal configurado.' : 'Alice decifra o voo e confere se a chave pública do certificado foi assinada por uma autoridade certificadora que ela conhece e se o nome é o do servidor desejado.', skip ? 'Nenhuma verificação.' : 'Verificação da assinatura da autoridade certificadora.', skip ? [] : [
      compute('alice', 'Verificação do certificado', 'ECDSA.verify(CA, nome ‖ chave pública do servidor, assinatura)', `nome = ${h.serverName}`, h.certificateValid ? 'certificado válido' : 'certificado inválido', 'signature'),
    ]),
  );
  steps.push(
    step('alice-cv', skip ? 'Alice não verifica o CertificateVerify (erro)' : 'Alice verifica o CertificateVerify', skip ? 'Sem esta verificação, qualquer um que conheça as chaves da sessão pode se passar pelo servidor.' : 'Alice confere a assinatura da transcrição com a chave pública do certificado. Só quem tem a chave privada do servidor consegue produzi-la.', skip ? 'Nenhuma verificação.' : 'Verificação da assinatura ECDSA da transcrição.', skip ? [] : [
      compute('alice', 'Verificação do CertificateVerify', 'ECDSA.verify(chave pública do certificado, conteúdo assinado, assinatura)', `H = ${hex(h.serverFlightHash, 6)}`, h.certVerifyValid ? 'assinatura válida' : 'assinatura INVÁLIDA', 'signature'),
    ], h.aborted ? [`Alice encerra o handshake: ${h.abortReason}.`] : undefined),
  );

  if (h.aborted) {
    steps.push(step('result', 'O handshake é interrompido: Eva não lê nada', verdictOf(h), 'Avaliação do resultado.', [{ type: 'verdict', verdict: { ok: true, text: verdictOf(h) } }]));
    return { id: `tls13-${h.scenario}`, title: 'Handshake do TLS 1.3: Alice, Bob e Eva', parties, steps };
  }

  steps.push(
    step('alice-fin', 'Alice verifica o Finished', 'Alice recalcula o HMAC da transcrição e compara com o Finished recebido.', 'Recálculo do HMAC e comparação.', [
      compute('alice', 'Verificação do Finished', 'HMAC(finished_key, H(CH..CertificateVerify)) = verify_data?', `H = ${hex(h.certVerifyHash, 6)}`, h.finishedValid ? 'confere' : 'NÃO confere', 'signature'),
    ]),
    step('alice-app', 'Alice deriva as chaves da aplicação', `Com o hash de toda a transcrição até o Finished do servidor (${hex(h.finishedHash, 6)}), o Master Secret gera os segredos "c ap traffic" e "s ap traffic". As chaves do handshake deixam de ser usadas.`, 'Derive-Secret(Master, "c ap traffic" e "s ap traffic", H(CH..Finished)).', [
      compute('alice', 'Chaves da aplicação', 'Master = Extract(Derive-Secret(HS, "derived"), 0); Derive-Secret(Master, "c ap traffic", H)', `H = ${hex(h.finishedHash, 6)}`, `chave do cliente = ${hex(h.clientApKey)}`, 'secret', entry('AP', 'Chaves da aplicação', `cliente ${hex(h.clientAp, 6)}`, 'secret')),
    ]),
    step('client-fin', 'Alice envia o seu Finished', `O Finished de Alice (${hex(h.clientFinished, 6)}) confirma a transcrição. A partir daqui, Alice envia dados da aplicação.`, 'Envio do Finished cifrado com a chave do handshake do cliente.', [
      mitm
        ? { type: 'send', message: { from: 'alice', to: 'eva', label: 'Finished (cifrado)', summary: hex(h.clientFinished, 10), kind: 'cipher' }, deliver: [] }
        : { type: 'send', message: { from: 'alice', to: 'bob', label: 'Finished (cifrado)', summary: hex(h.clientFinished, 10), kind: 'cipher', observers: ['eva'] }, deliver: [], observerEntries: [] },
    ]),
  );
  if (!mitm) {
    steps.push(
      step('bob-app', 'Bob deriva as chaves da aplicação', 'Bob confere o Finished de Alice e deriva as mesmas chaves da aplicação a partir do Master Secret.', 'Derive-Secret(Master, "c ap traffic" e "s ap traffic", H(CH..Finished)).', [
        compute('bob', 'Chaves da aplicação', 'Master = Extract(Derive-Secret(HS, "derived"), 0); Derive-Secret(Master, "c ap traffic", H)', `H = ${hex(h.finishedHash, 6)}`, `chave do cliente = ${hex(h.clientApKey)}`, 'secret', entry('AP', 'Chaves da aplicação', `cliente ${hex(h.clientAp, 6)}`, 'secret')),
      ]),
    );
  }
  steps.push(
    step('alice-seal', 'Alice protege a mensagem de aplicação', 'A mensagem é cifrada com AES-128-GCM, usando a chave da aplicação e o nonce (IV XOR número de sequência). O cabeçalho do registro é o dado associado autenticado.', 'Cifragem AES-128-GCM do registro.', [
      compute('alice', 'Registro de aplicação', 'AES-128-GCM(key, nonce = iv ⊕ seq, aad = cabeçalho, mensagem ‖ tipo)', `${h.received?.length ?? 0} caracteres`, `registro = ${hex(h.appRecord)}`, 'cipher', entry('m', 'Mensagem de aplicação', h.received ?? '', 'plain')),
    ]),
    step(
      'app-send',
      mitm ? 'O registro chega a Eva, e não a Bob' : 'O registro atravessa o canal',
      mitm ? 'Alice acredita que fala com Bob, mas as chaves são as dela com Eva.' : 'Eva vê o registro cifrado, o comprimento e o momento do envio, mas nada do conteúdo.',
      'Envio do registro de aplicação.',
      [
        mitm
          ? { type: 'send', message: { from: 'alice', to: 'eva', label: 'Registro de aplicação', summary: hex(h.appRecord, 10), kind: 'cipher' }, deliver: [entry('seen', 'Observado no canal', `registro ${hex(h.appRecord, 6)}`, 'cipher')] }
          : { type: 'send', message: { from: 'alice', to: 'bob', label: 'Registro de aplicação', summary: hex(h.appRecord, 10), kind: 'cipher', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `registro ${hex(h.appRecord, 6)}`, 'cipher')] },
      ],
    ),
    mitm
      ? step('eva-open', 'Eva decifra a mensagem de Alice', 'Eva derivou as mesmas chaves da aplicação e abre o registro. Poderia ler, alterar e reenviar a Bob.', 'Decifragem AES-128-GCM com a chave da aplicação.', [
          compute('eva', 'Decifragem', 'AES-128-GCM.open(key, nonce, aad, registro)', `registro = ${hex(h.appRecord, 6)}`, `"${h.received}"`, 'plain', entry('P', 'Texto lido por Eva', h.received ?? '', 'plain')),
        ])
      : step('bob-open', 'Bob decifra a mensagem', 'Bob abre o registro com as mesmas chaves e confere a etiqueta de autenticação.', 'Decifragem AES-128-GCM.', [
          compute('bob', 'Decifragem', 'AES-128-GCM.open(key, nonce, aad, registro)', `registro = ${hex(h.appRecord, 6)}`, `"${h.received}"`, 'plain', entry('mrec', 'Mensagem recebida', h.received ?? '', 'plain')),
        ]),
    step('result', h.ok ? 'Eva não lê nada' : 'Eva leu a mensagem de Alice', verdictOf(h), 'Avaliação do resultado.', [{ type: 'verdict', verdict: { ok: h.ok, text: verdictOf(h) } }]),
  );

  return { id: `tls13-${h.scenario}`, title: 'Handshake do TLS 1.3: Alice, Bob e Eva', parties, steps };
}
