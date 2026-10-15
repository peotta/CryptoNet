import { utf8Encode } from '../../crypto/encoding';
import { digest } from '../../crypto/hash';
import { hashToInt, showPoint, type Point, type RealSigAlgo, type RealSigRun } from '../../crypto/ecc';
import type { EccEngine } from '../../crypto/engines';
import type { Entry, ItemKind, PartyDef, ProtocolDefinition, ProtocolStep, SimulationEvent } from '../../simulation/types';

const entry = (key: string, label: string, value: string, kind: ItemKind): Entry => ({ key, label, value, kind });
const short = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n)}…` : t);
export const hex = (x: string, n = 12) => (x.length > n * 2 + 1 ? `${x.slice(0, n)}…${x.slice(-4)}` : x);

type Compute = Extract<SimulationEvent, { type: 'compute' }>;
const compute = (party: string, title: string, formula: string, substituted: string, result: string, kind: ItemKind, e?: Entry): Compute => ({
  type: 'compute',
  operation: { party, title, formula, substituted, result, kind },
  ...(e ? { entry: e } : {}),
});
const step = (id: string, title: string, description: string, operation: string, events: SimulationEvent[], info?: string[]): ProtocolStep => ({ id, title, description, operation, events, ...(info ? { info } : {}) });

// ---------------------------------------------------------------------------------------------
// ECDH na curva didática
// ---------------------------------------------------------------------------------------------
export interface EcdhFlow {
  a: bigint;
  b: bigint;
  A: Point;
  B: Point;
  S: Point;
  /** Chave privada de Alice encontrada por Eva e o número de somas que ela precisou. */
  evaA: bigint | null;
  tries: number;
  evaS: Point;
  broken: boolean;
  verdictText: string;
  curveName: string;
  n: bigint;
}

export async function runEcdh(engine: EccEngine, input: { a: bigint; b: bigint }): Promise<EcdhFlow> {
  const A = await engine.publicKey(input.a);
  const B = await engine.publicKey(input.b);
  const S = await engine.ecdh(input.a, B);
  const Sb = await engine.ecdh(input.b, A);
  if (showPoint(S) !== showPoint(Sb)) throw new Error('Falha interna: os pontos compartilhados não coincidem.');
  const found = await engine.discreteLog(A);
  const evaS = found.k === null ? null : await engine.ecdh(found.k, B);
  const broken = evaS !== null && showPoint(evaS) === showPoint(S);
  const n = engine.curve.n;
  return {
    a: input.a,
    b: input.b,
    A,
    B,
    S,
    evaA: found.k,
    tries: found.tries,
    evaS,
    broken,
    curveName: engine.curve.name,
    n,
    verdictText: `Eva viu A = ${showPoint(A)} e B = ${showPoint(B)} e testou os múltiplos de G até achar A: bastaram ${found.tries} somas (a ordem do grupo é só ${n}). Com a = ${found.k}, calculou a · B = ${showPoint(evaS)}, o mesmo ponto de Alice e Bob. Numa curva real como a P-256, a ordem é cerca de 2²⁵⁶: a mesma busca exigiria cerca de 2¹²⁸ operações pelo melhor ataque conhecido (rho de Pollard), inviável. O que protege o ECDH é o tamanho do grupo, e não o formato da conta.`,
  };
}

const ecdhParties: PartyDef[] = [
  { id: 'alice', name: 'Alice', role: 'Participante', position: 'left', slots: [{ key: 'd', label: 'Chave privada a', kind: 'secret' }, { key: 'Q', label: 'Chave pública A = a·G', kind: 'public' }, { key: 'S', label: 'Ponto compartilhado', kind: 'secret' }] },
  { id: 'bob', name: 'Bob', role: 'Participante', position: 'right', slots: [{ key: 'd', label: 'Chave privada b', kind: 'secret' }, { key: 'Q', label: 'Chave pública B = b·G', kind: 'public' }, { key: 'S', label: 'Ponto compartilhado', kind: 'secret' }] },
  {
    id: 'eva',
    name: 'Eva',
    role: 'Atacante (observa o canal)',
    position: 'center',
    adversary: true,
    slots: [{ key: 'seen', label: 'Observado no canal', kind: 'public' }, { key: 'd', label: 'Chave privada deduzida', kind: 'secret' }, { key: 'S', label: 'Ponto deduzido por Eva', kind: 'secret' }],
  },
];

export function buildEcdhProtocol(d: EcdhFlow): ProtocolDefinition {
  return {
    id: 'ecc-ecdh',
    title: 'ECDH em curva elíptica: Alice, Bob e Eva',
    parties: ecdhParties,
    steps: [
      step('params', 'Alice e Bob combinam a curva e o ponto G', `Os parâmetros são públicos: a curva ${d.curveName}, o gerador G = (5, 1) e a ordem n = ${d.n}.`, 'Nenhum cálculo: os parâmetros são públicos.', []),
      step('alice-keygen', 'Alice calcula a chave pública A = a · G', 'Alice escolhe a chave privada a e calcula A somando G a si mesmo a vezes (dobrar e somar).', 'Multiplicação escalar a · G.', [
        compute('alice', 'Chave pública', 'A = a · G', `a = ${d.a}`, `A = ${showPoint(d.A)}`, 'public', entry('Q', 'Chave pública A = a·G', showPoint(d.A), 'public')),
        { type: 'set', party: 'alice', entry: entry('d', 'Chave privada a', String(d.a), 'secret') },
      ]),
      step('bob-keygen', 'Bob calcula a chave pública B = b · G', 'Bob faz o mesmo com a sua chave privada b.', 'Multiplicação escalar b · G.', [
        compute('bob', 'Chave pública', 'B = b · G', `b = ${d.b}`, `B = ${showPoint(d.B)}`, 'public', entry('Q', 'Chave pública B = b·G', showPoint(d.B), 'public')),
        { type: 'set', party: 'bob', entry: entry('d', 'Chave privada b', String(d.b), 'secret') },
      ]),
      step('send-a', 'Alice envia A a Bob', 'A chave pública atravessa o canal; Eva a vê.', 'Envio da chave pública A.', [
        { type: 'send', message: { from: 'alice', to: 'bob', label: 'A', summary: showPoint(d.A), kind: 'public', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `A = ${showPoint(d.A)}`, 'public')] },
      ]),
      step('send-b', 'Bob envia B a Alice', 'O mesmo no sentido contrário.', 'Envio da chave pública B.', [
        { type: 'send', message: { from: 'bob', to: 'alice', label: 'B', summary: showPoint(d.B), kind: 'public', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `A = ${showPoint(d.A)}, B = ${showPoint(d.B)}`, 'public')] },
      ]),
      step('alice-shared', 'Alice calcula a · B', 'Alice multiplica a chave pública de Bob pela sua chave privada.', 'Multiplicação escalar a · B.', [
        compute('alice', 'Ponto compartilhado', 'S = a · B = a · (b · G)', `a = ${d.a}, B = ${showPoint(d.B)}`, `S = ${showPoint(d.S)}`, 'secret', entry('S', 'Ponto compartilhado', showPoint(d.S), 'secret')),
      ]),
      step('bob-shared', 'Bob calcula b · A', 'Bob multiplica a chave pública de Alice pela sua chave privada. Pela associatividade, b · (a · G) = a · (b · G).', 'Multiplicação escalar b · A.', [
        compute('bob', 'Ponto compartilhado', 'S = b · A = b · (a · G)', `b = ${d.b}, A = ${showPoint(d.A)}`, `S = ${showPoint(d.S)}`, 'secret', entry('S', 'Ponto compartilhado', showPoint(d.S), 'secret')),
      ]),
      step('eva-dlog', 'Eva procura a chave privada de Alice (força bruta)', 'Eva soma G repetidamente (G, 2G, 3G, ...) até encontrar A. Como o grupo tem só 19 elementos, termina rápido.', 'Cálculo de G, 2G, 3G, ... até obter A.', [
        compute('eva', 'Logaritmo discreto', 'encontrar k tal que k · G = A', `A = ${showPoint(d.A)}`, `k = ${d.evaA} (após ${d.tries} somas)`, 'secret', entry('d', 'Chave privada deduzida', String(d.evaA), 'secret')),
      ]),
      step('eva-shared', 'Eva calcula k · B', 'Com a chave privada de Alice em mãos, Eva repete o cálculo de Alice.', 'Multiplicação escalar k · B.', [
        compute('eva', 'Ponto deduzido', 'S = k · B', `k = ${d.evaA}, B = ${showPoint(d.B)}`, `S = ${showPoint(d.evaS)}`, 'secret', entry('S', 'Ponto deduzido por Eva', showPoint(d.evaS), 'secret')),
      ]),
      step('result', d.broken ? 'A curva didática foi quebrada' : 'Eva não obteve o ponto', d.verdictText, 'Avaliação do resultado.', [{ type: 'verdict', verdict: { ok: !d.broken, text: d.verdictText } }]),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// ECDSA na curva didática
// ---------------------------------------------------------------------------------------------
export interface EcdsaFlow {
  reuse: boolean;
  tamper: boolean;
  d: bigint;
  Q: Point;
  k: bigint;
  m1: string;
  m2: string;
  z1: bigint;
  z2: bigint;
  r: bigint;
  s1: bigint;
  s2: bigint;
  /** Mensagem que Bob recebe com a primeira assinatura (alterada por Eva, se for o caso). */
  received1: string;
  bobAccepts1: boolean;
  recovered: { k: bigint; d: bigint } | null;
  forgedMessage: string;
  zf: bigint;
  forged: { r: bigint; s: bigint } | null;
  bobAcceptsForged: boolean;
  ok: boolean;
  verdictText: string;
  n: bigint;
}

const FORGED = 'TRANSFERIR TUDO PARA EVA';
const zOf = async (engine: EccEngine, m: string) => hashToInt(await digest('SHA-256', utf8Encode(m)), engine.curve.n);

export async function runEcdsa(engine: EccEngine, input: { d: bigint; k: bigint; m1: string; m2: string; reuse: boolean; tamper: boolean }): Promise<EcdsaFlow> {
  const n = engine.curve.n;
  if (input.m1.trim() === '') throw new Error('Digite a mensagem 1.');
  if (input.reuse && input.m2.trim() === '') throw new Error('Digite a mensagem 2.');
  const Q = await engine.publicKey(input.d);
  const z1 = await zOf(engine, input.m1);
  const z2 = await zOf(engine, input.m2);
  if (input.reuse && z1 % n === z2 % n) throw new Error(`As mensagens 1 e 2 têm o mesmo hash reduzido (${z1 % n}) nesta curva minúscula (só ${n} valores possíveis); altere uma delas.`);
  const sig1 = await engine.sign(input.d, z1, input.k);
  const sig2 = input.reuse ? await engine.sign(input.d, z2, input.k) : null;

  // Eva inverte o bit menos significativo do primeiro caractere da mensagem
  const received1 = input.tamper && !input.reuse ? String.fromCharCode(input.m1.charCodeAt(0) ^ 1) + input.m1.slice(1) : input.m1;
  const zr = await zOf(engine, received1);
  const bobAccepts1 = (await engine.verify(Q, zr, sig1.r, sig1.s)).valid;

  let recovered: EcdsaFlow['recovered'] = null;
  let forged: EcdsaFlow['forged'] = null;
  let bobAcceptsForged = false;
  const zf = await zOf(engine, FORGED);
  if (sig2) {
    recovered = await engine.recoverNonceReuse(z1, sig1.s, z2, sig2.s, sig1.r);
    if (recovered) {
      const f = await engine.sign(recovered.d, zf, input.k === 1n ? 2n : 1n);
      forged = { r: f.r, s: f.s };
      bobAcceptsForged = (await engine.verify(Q, zf, f.r, f.s)).valid;
    }
  }
  const ok = !input.reuse;
  const verdictText = input.reuse
    ? `As duas assinaturas têm o mesmo r = ${sig1.r}, o que mostra a Eva que o mesmo k foi usado. De s₁ − s₂ = k⁻¹(z₁ − z₂) ela obtém k = ${recovered?.k} e, de d = (s₁·k − z₁)/r, a chave privada d = ${recovered?.d}, a mesma de Alice (${input.d}). Com ela, forjou uma assinatura de "${FORGED}" que Bob aceitou: ${bobAcceptsForged ? 'aceita' : 'rejeitada'}. Isso vale para qualquer curva, inclusive a P-256: foi assim que se extraiu a chave de assinatura do PlayStation 3 (2010). Por isso o ECDSA moderno deriva k de forma determinística (RFC 6979) e o Ed25519 não usa nonce aleatório.`
    : input.tamper
      ? `Eva alterou a mensagem em trânsito e manteve a assinatura de Alice. Bob recalculou o hash da mensagem recebida e a verificação ${bobAccepts1 ? 'passou por acaso (o hash reduzido a 5 bits colide nesta curva minúscula)' : 'falhou'}: a assinatura protege a integridade e a autoria. (Numa curva real o hash tem 256 bits e a colisão é inviável.) Eva não conseguiu forjar uma assinatura sem a chave privada. Nesta curva minúscula ela poderia achar d por força bruta, como na aba de ECDH; aqui Eva só usa ataques que valem em qualquer tamanho de curva.`
      : 'Bob verificou a assinatura com a chave pública de Alice e a aceitou. Eva, que viu a mensagem, a assinatura (r, s) e a chave pública, não consegue forjar outra assinatura sem conhecer d. Nesta curva minúscula ela poderia achar d por força bruta, como na aba de ECDH; aqui Eva só usa ataques que valem em qualquer tamanho de curva.';

  return {
    reuse: input.reuse,
    tamper: input.tamper,
    d: input.d,
    Q,
    k: input.k,
    m1: input.m1,
    m2: input.m2,
    z1: z1 % n,
    z2: z2 % n,
    r: sig1.r,
    s1: sig1.s,
    s2: sig2?.s ?? 0n,
    received1,
    bobAccepts1,
    recovered,
    forgedMessage: FORGED,
    zf: zf % n,
    forged,
    bobAcceptsForged,
    ok,
    verdictText,
    n,
  };
}

const ecdsaParties: PartyDef[] = [
  { id: 'alice', name: 'Alice', role: 'Signatária', position: 'left', slots: [{ key: 'd', label: 'Chave privada d', kind: 'secret' }, { key: 'k', label: 'Nonce k', kind: 'secret' }, { key: 'sig', label: 'Assinatura (r, s)', kind: 'signature' }] },
  { id: 'bob', name: 'Bob', role: 'Verificador', position: 'right', slots: [{ key: 'Q', label: 'Chave pública de Alice', kind: 'public' }, { key: 'ok', label: 'Resultado da verificação', kind: 'param' }] },
  {
    id: 'eva',
    name: 'Eva',
    role: 'Atacante (observa e, se puder, altera o canal)',
    position: 'center',
    adversary: true,
    slots: [{ key: 'seen', label: 'Observado no canal', kind: 'signature' }, { key: 'k', label: 'Nonce k deduzido', kind: 'secret' }, { key: 'd', label: 'Chave privada deduzida', kind: 'secret' }, { key: 'forged', label: 'Assinatura forjada', kind: 'signature' }],
  },
];

export function buildEcdsaProtocol(d: EcdsaFlow): ProtocolDefinition {
  const steps: ProtocolStep[] = [
    step('key', 'Alice tem o par de chaves e publica Q', `A chave privada d = ${d.d} fica com Alice; a pública Q = d · G = ${showPoint(d.Q)} é enviada a Bob (supondo que chegue autêntica).`, 'Envio da chave pública Q.', [
      { type: 'set', party: 'alice', entry: entry('d', 'Chave privada d', String(d.d), 'secret') },
      { type: 'send', message: { from: 'alice', to: 'bob', label: 'Q', summary: showPoint(d.Q), kind: 'public', observers: ['eva'] }, deliver: [entry('Q', 'Chave pública de Alice', showPoint(d.Q), 'public')], observerEntries: [] },
    ]),
    step('hash1', 'Alice calcula o hash da mensagem 1', `O hash SHA-256 de "${short(d.m1, 22)}" é reduzido aos ${d.n.toString(2).length} bits mais à esquerda, o tamanho de n: z₁ = ${d.z1} (módulo ${d.n}).`, 'SHA-256 e redução ao tamanho de n.', [
      compute('alice', 'Hash da mensagem', 'z = bits mais à esquerda de SHA-256(m)', `m = "${short(d.m1, 22)}"`, `z₁ = ${d.z1}`, 'param'),
    ]),
    step('sign1', 'Alice assina com o nonce k', `Alice escolhe k = ${d.k}, calcula (x, y) = k · G e r = x mod n, e s = k⁻¹ (z + r · d) mod n.`, 'Cálculo de r e s.', [
      compute('alice', 'Assinatura ECDSA', 'r = x(k·G) mod n;  s = k⁻¹ (z + r·d) mod n', `k = ${d.k}, z = ${d.z1}, d = ${d.d}`, `(r, s) = (${d.r}, ${d.s1})`, 'signature', entry('sig', 'Assinatura (r, s)', `(${d.r}, ${d.s1})`, 'signature')),
      { type: 'set', party: 'alice', entry: entry('k', 'Nonce k', String(d.k), 'secret') },
    ]),
  ];
  if (d.reuse) {
    steps.push(
      step('send1', 'Alice envia a mensagem 1 e a assinatura', 'A mensagem e a assinatura trafegam em claro; Eva as vê.', 'Envio de (m₁, r, s₁).', [
        { type: 'send', message: { from: 'alice', to: 'bob', label: 'm₁, (r, s₁)', summary: `"${short(d.m1, 18)}", (${d.r}, ${d.s1})`, kind: 'signature', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `(r, s₁) = (${d.r}, ${d.s1})`, 'signature')] },
      ]),
      step('sign2', 'Alice assina a mensagem 2 com o MESMO k (erro)', `Por descuido (ou um gerador de números aleatórios defeituoso), Alice reaproveita k = ${d.k}. O hash da mensagem 2 é z₂ = ${d.z2}.`, 'Cálculo de r e s₂ com o mesmo k.', [
        compute('alice', 'Segunda assinatura', 's₂ = k⁻¹ (z₂ + r·d) mod n', `k = ${d.k} (reutilizado), z₂ = ${d.z2}`, `(r, s₂) = (${d.r}, ${d.s2})`, 'signature'),
      ]),
      step('send2', 'Alice envia a mensagem 2 e a assinatura', 'Eva agora tem duas assinaturas com o mesmo r.', 'Envio de (m₂, r, s₂).', [
        { type: 'send', message: { from: 'alice', to: 'bob', label: 'm₂, (r, s₂)', summary: `"${short(d.m2, 18)}", (${d.r}, ${d.s2})`, kind: 'signature', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `r = ${d.r} repetido; s₁ = ${d.s1}, s₂ = ${d.s2}`, 'signature')] },
      ]),
      step('eva-k', 'Eva calcula o nonce k', 'Subtraindo as duas equações de assinatura, a chave privada se cancela: s₁ − s₂ = k⁻¹ (z₁ − z₂). Eva isola k.', 'Cálculo de k = (z₁ − z₂)/(s₁ − s₂) mod n.', [
        compute('eva', 'Recuperação do nonce', 'k = (z₁ − z₂) · (s₁ − s₂)⁻¹ mod n', `z₁ = ${d.z1}, z₂ = ${d.z2}, s₁ = ${d.s1}, s₂ = ${d.s2}`, `k = ${d.recovered?.k}`, 'secret', entry('k', 'Nonce k deduzido', String(d.recovered?.k), 'secret')),
      ]),
      step('eva-d', 'Eva calcula a chave privada d', 'Com k conhecido, a equação s = k⁻¹ (z + r·d) deixa d como única incógnita.', 'Cálculo de d = (s₁ · k − z₁)/r mod n.', [
        compute('eva', 'Recuperação da chave', 'd = (s₁·k − z₁) · r⁻¹ mod n', `s₁ = ${d.s1}, k = ${d.recovered?.k}, z₁ = ${d.z1}, r = ${d.r}`, `d = ${d.recovered?.d}`, 'secret', entry('d', 'Chave privada deduzida', String(d.recovered?.d), 'secret')),
      ]),
      step('eva-forge', 'Eva assina uma mensagem falsa', `Com a chave privada de Alice, Eva assina "${d.forgedMessage}" (z = ${d.zf}).`, 'Assinatura ECDSA com a chave roubada.', [
        compute('eva', 'Assinatura forjada', 'r = x(k′·G) mod n;  s = k′⁻¹ (z + r·d) mod n', `d = ${d.recovered?.d}, z = ${d.zf}`, `(r, s) = (${d.forged?.r}, ${d.forged?.s})`, 'signature', entry('forged', 'Assinatura forjada', `(${d.forged?.r}, ${d.forged?.s})`, 'signature')),
      ]),
      step('send-forged', 'Eva envia a mensagem falsa a Bob', 'Eva se passa por Alice.', 'Envio da mensagem falsa e da assinatura forjada.', [
        { type: 'send', message: { from: 'eva', to: 'bob', label: 'm′, (r, s)', summary: `"${short(d.forgedMessage, 18)}"`, kind: 'signature', tampered: true }, deliver: [] },
      ]),
      step('verify-forged', 'Bob verifica a assinatura forjada', 'Bob calcula w = s⁻¹, u₁ = z·w, u₂ = r·w e confere se x(u₁·G + u₂·Q) mod n = r.', 'Verificação ECDSA.', [
        compute('bob', 'Verificação', 'x(u₁·G + u₂·Q) mod n = r?', `z = ${d.zf}, (r, s) = (${d.forged?.r}, ${d.forged?.s})`, d.bobAcceptsForged ? 'assinatura VÁLIDA' : 'assinatura inválida', 'param', entry('ok', 'Resultado da verificação', d.bobAcceptsForged ? 'aceita (forjada!)' : 'rejeitada', 'param')),
      ]),
    );
  } else {
    steps.push(
      d.tamper
        ? step('intercept', 'Eva altera a mensagem em trânsito', 'Eva mantém a assinatura de Alice e troca a mensagem. Sem conhecer d, não pode gerar uma assinatura nova.', 'Alteração da mensagem.', [
            { type: 'send', message: { from: 'alice', to: 'eva', label: 'm, (r, s)', summary: `"${short(d.m1, 18)}", (${d.r}, ${d.s1})`, kind: 'signature' }, deliver: [entry('seen', 'Capturado no canal', `(r, s) = (${d.r}, ${d.s1})`, 'signature')] },
            { type: 'send', message: { from: 'eva', to: 'bob', label: "m', (r, s)", summary: `"${short(d.received1, 18)}"`, kind: 'signature', tampered: true }, deliver: [] },
          ])
        : step('send1', 'Alice envia a mensagem e a assinatura', 'A mensagem e a assinatura trafegam em claro; Eva as vê, mas isso não lhe permite assinar nada.', 'Envio de (m, r, s).', [
            { type: 'send', message: { from: 'alice', to: 'bob', label: 'm, (r, s)', summary: `"${short(d.m1, 18)}", (${d.r}, ${d.s1})`, kind: 'signature', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', `(r, s) = (${d.r}, ${d.s1})`, 'signature')] },
          ]),
      step('verify', 'Bob verifica a assinatura', 'Bob recalcula o hash da mensagem recebida, w = s⁻¹, u₁ = z·w, u₂ = r·w, e confere se x(u₁·G + u₂·Q) mod n = r.', 'Verificação ECDSA.', [
        compute('bob', 'Verificação', 'x(u₁·G + u₂·Q) mod n = r?', `mensagem recebida: "${short(d.received1, 22)}"`, d.bobAccepts1 ? 'assinatura VÁLIDA' : 'assinatura inválida', 'param', entry('ok', 'Resultado da verificação', d.bobAccepts1 ? 'aceita' : 'rejeitada', 'param')),
      ]),
    );
  }
  steps.push(step('result', d.reuse ? 'A reutilização de k revelou a chave privada' : d.tamper ? 'A alteração foi detectada' : 'Eva não forja a assinatura', d.verdictText, 'Avaliação do resultado.', [{ type: 'verdict', verdict: { ok: d.ok, text: d.verdictText } }]));
  return { id: `ecc-ecdsa-${d.reuse ? 'reuso' : 'normal'}`, title: 'ECDSA em curva elíptica: Alice, Bob e Eva', parties: ecdsaParties, steps };
}

// ---------------------------------------------------------------------------------------------
// Assinaturas reais: ECDSA P-256 e Ed25519
// ---------------------------------------------------------------------------------------------
export interface RealFlow {
  run: RealSigRun;
  message: string;
  tamper: boolean;
  ok: boolean;
  verdictText: string;
}

export async function runRealSignature(engine: EccEngine, input: { algo: RealSigAlgo; message: string; tamper: boolean }): Promise<RealFlow> {
  if (input.message.length === 0) throw new Error('Digite a mensagem a assinar.');
  if (utf8Encode(input.message).length > 200) throw new Error('Use no máximo 200 bytes.');
  if (!(await engine.realSupported(input.algo))) throw new Error(`Este navegador não oferece ${input.algo} na Web Crypto. Atualize o navegador ou escolha ECDSA P-256.`);
  const run = await engine.realSignature(input.algo, utf8Encode(input.message), input.tamper);
  const verdictText = input.tamper
    ? `Eva trocou um bit da mensagem e manteve a assinatura. Bob verificou com a chave pública de Alice e ${run.valid ? 'aceitou (inesperado)' : 'rejeitou'}: qualquer alteração invalida a assinatura. Eva não pode gerar outra sem a chave privada, e o problema do logaritmo discreto em ${input.algo === 'Ed25519' ? 'Curve25519 (cerca de 2²⁵² elementos)' : 'P-256 (cerca de 2²⁵⁶ elementos)'} impede que ela a derive da chave pública.`
    : `Bob verificou a assinatura com a chave pública de Alice e a aceitou. Eva viu a mensagem, a assinatura e a chave pública, e nada disso lhe permite assinar outra mensagem.`;
  return { run, message: input.message, tamper: input.tamper, ok: input.tamper ? !run.valid : run.valid, verdictText };
}

export function buildRealProtocol(f: RealFlow): ProtocolDefinition {
  const r = f.run;
  return {
    id: `ecc-real-${r.algo}`,
    title: `${r.algo === 'Ed25519' ? 'Ed25519' : 'ECDSA P-256'}: Alice, Bob e Eva`,
    parties: ecdsaParties.map((p) => (p.id === 'eva' ? { ...p, slots: [{ key: 'seen', label: 'Observado no canal', kind: 'signature' as const }, { key: 'forged', label: 'Mensagem alterada', kind: 'plain' as const }] } : p.id === 'alice' ? { ...p, slots: [{ key: 'd', label: 'Chave privada', kind: 'secret' as const }, { key: 'sig', label: 'Assinatura', kind: 'signature' as const }] } : p)),
    steps: [
      step('keygen', 'Alice gera o par de chaves', `A chave pública tem ${r.publicBytes} bytes. A privada nunca sai do dispositivo de Alice.`, `Geração do par ${r.algo}.`, [
        compute('alice', 'Par de chaves', r.algo === 'Ed25519' ? 'chave privada de 32 bytes; A = a · B na Curve25519 (forma de Edwards)' : 'd aleatório; Q = d · G na curva P-256', `${r.algo}`, `chave pública = ${hex(r.publicHex)}`, 'public', entry('d', 'Chave privada', 'guardada em segredo', 'secret')),
      ]),
      step('send-pub', 'Alice envia a chave pública a Bob', 'Supõe-se que a chave pública chegue autêntica (em geral, por certificado).', 'Envio da chave pública.', [
        { type: 'send', message: { from: 'alice', to: 'bob', label: 'Chave pública', summary: hex(r.publicHex, 8), kind: 'public', observers: ['eva'] }, deliver: [entry('Q', 'Chave pública de Alice', hex(r.publicHex, 8), 'public')], observerEntries: [] },
      ]),
      step('sign', 'Alice assina a mensagem', r.algo === 'Ed25519' ? 'O Ed25519 deriva o nonce de forma determinística (hash da chave privada e da mensagem): sem sorteio, sem risco de repetição.' : 'O ECDSA sorteia um nonce k novo para cada assinatura; o hash SHA-256 da mensagem entra no cálculo de s.', `Assinatura ${r.algo}.`, [
        compute('alice', 'Assinatura', r.algo === 'Ed25519' ? 'R = r·B;  S = r + H(R ‖ A ‖ m)·a  (r derivado de H(chave, m))' : 'r = x(k·G);  s = k⁻¹ (H(m) + r·d)', `${f.message.length} caracteres`, `assinatura de ${r.signatureBytes} bytes = ${hex(r.signatureHex)}`, 'signature', entry('sig', 'Assinatura', hex(r.signatureHex, 8), 'signature')),
      ]),
      f.tamper
        ? step('intercept', 'Eva altera um bit da mensagem', 'Eva mantém a assinatura e troca um bit do primeiro byte da mensagem.', 'Inversão de um bit da mensagem.', [
            { type: 'send', message: { from: 'alice', to: 'eva', label: 'm, assinatura', summary: hex(r.signatureHex, 8), kind: 'signature' }, deliver: [entry('seen', 'Capturado no canal', hex(r.signatureHex, 8), 'signature')] },
            { type: 'set', party: 'eva', entry: entry('forged', 'Mensagem alterada', hex(r.receivedHex, 8), 'plain') },
            { type: 'send', message: { from: 'eva', to: 'bob', label: "m', assinatura", summary: hex(r.signatureHex, 8), kind: 'signature', tampered: true }, deliver: [] },
          ])
        : step('send', 'Alice envia a mensagem e a assinatura', 'Ambas trafegam em claro; Eva as vê.', 'Envio de (m, assinatura).', [
            { type: 'send', message: { from: 'alice', to: 'bob', label: 'm, assinatura', summary: hex(r.signatureHex, 8), kind: 'signature', observers: ['eva'] }, deliver: [], observerEntries: [entry('seen', 'Observado no canal', hex(r.signatureHex, 8), 'signature')] },
          ]),
      step('verify', 'Bob verifica a assinatura', 'Bob usa a chave pública de Alice, a mensagem recebida e a assinatura.', `Verificação ${r.algo}.`, [
        compute('bob', 'Verificação', r.algo === 'Ed25519' ? 'S·B = R + H(R ‖ A ‖ m)·A ?' : 'x(u₁·G + u₂·Q) mod n = r ?', f.tamper ? 'mensagem alterada por Eva' : 'mensagem original', r.valid ? 'assinatura VÁLIDA' : 'assinatura inválida', 'param', entry('ok', 'Resultado da verificação', r.valid ? 'aceita' : 'rejeitada', 'param')),
      ]),
      step('result', f.tamper ? 'A alteração foi detectada' : 'Eva não forja a assinatura', f.verdictText, 'Avaliação do resultado.', [{ type: 'verdict', verdict: { ok: f.ok, text: f.verdictText } }]),
    ],
  };
}
