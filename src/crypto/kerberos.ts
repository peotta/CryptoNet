// Kerberos 5 simplificado (RFC 4120): troca AS, troca TGS e troca AP, com o centro de distribuição de chaves (KDC).
// Cifras reais pela Web Crypto API, mas simplificadas em relação ao RFC: a chave de longo prazo de Alice vem de PBKDF2-HMAC-SHA-256
// com 4096 iterações (o RFC 3962 usa PBKDF2 com HMAC-SHA-1 e a cifra AES-CTS-HMAC-SHA1) e as mensagens usam AES-256-GCM.
// O objetivo é mostrar a lógica do protocolo (tíquetes, chaves de sessão, autenticadores, carimbos de tempo), não interoperar.
import { toHex } from './encoding';

export type KrbScenario = 'normal' | 'replay' | 'guess';

export const REALM = 'UNB.BR';
export const CLIENT = 'alice';
export const SERVICE = 'bob';
export const DEFAULT_ITERATIONS = 4096;
/** Tolerância de relógio padrão do Kerberos: 5 minutos (RFC 4120, seção 3.2.3). */
export const DEFAULT_SKEW = 300;
export const TICKET_LIFETIME = 36000;
export const REPLAY_DELAY = 60;
export const GUESS_DELAY = 10;
export const DEFAULT_DICTIONARY = ['123456', 'password', 'senha123', 'qwerty', 'letmein', 'brasil', 'unb2026', 'primavera', 'admin', 'welcome'];

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('A Web Crypto API não está disponível neste ambiente.');
  return s;
}

/** Chave de longo prazo derivada da senha (string-to-key): PBKDF2-HMAC-SHA-256 com o sal "REINO + principal". */
export async function stringToKey(password: string, realm = REALM, principal = CLIENT, iterations = DEFAULT_ITERATIONS): Promise<Uint8Array> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(password) as BufferSource, 'PBKDF2', false, ['deriveBits']);
  const salt = new TextEncoder().encode(`${realm}${principal}`);
  return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, 256));
}

async function aesKey(key: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey('raw', key as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Cifra um texto (AES-256-GCM). Resultado: IV de 12 bytes, texto cifrado e etiqueta de 16 bytes. */
export async function seal(key: Uint8Array, plaintext: string, iv: Uint8Array): Promise<Uint8Array> {
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await aesKey(key), new TextEncoder().encode(plaintext) as BufferSource));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

/** Decifra e autentica; devolve null quando a chave está errada ou a mensagem foi alterada. */
export async function open(key: Uint8Array, sealed: Uint8Array): Promise<string | null> {
  try {
    const iv = sealed.slice(0, 12);
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await aesKey(key), sealed.slice(12) as BufferSource);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export interface KrbOptions {
  scenario: KrbScenario;
  rand: (n: number) => Uint8Array;
  password: string;
  /** Instante Unix da primeira mensagem (AS-REQ). */
  now: number;
  /** Tolerância de relógio, em segundos. */
  skew: number;
  /** Bob guarda os autenticadores já vistos e recusa a repetição. */
  replayCache: boolean;
  /** O KDC só responde a quem prova conhecer a chave de Alice (RFC 4120, seção 5.2.7.2). */
  preauth: boolean;
  dictionary: string[];
  iterations?: number;
}

export interface KrbRun {
  scenario: KrbScenario;
  realm: string;
  now: number;
  skew: number;
  iterations: number;
  replayCache: boolean;
  preauth: boolean;
  // Chaves (hex), só para exibição abreviada
  kcHex: string;
  ktgsHex: string;
  kbHex: string;
  katHex: string;
  kabHex: string;
  // Troca AS
  n1: string;
  asReqPadataHex: string;
  tgtHex: string;
  asRepHex: string;
  // Troca TGS
  n2: string;
  tgsAuthHex: string;
  tktBHex: string;
  tgsRepHex: string;
  // Troca AP
  apTime: number;
  apAuthHex: string;
  apRepHex: string;
  aliceKnowsKab: boolean;
  bobAcceptsAlice: boolean;
  // Eva: repetição
  replayTime: number;
  replayWithinSkew: boolean;
  replayAccepted: boolean;
  replayReason: 'aceito' | 'repeticao' | 'relogio';
  // Eva: adivinhar a senha
  guessTime: number;
  kdcAnswered: boolean;
  guessCipherHex: string;
  dictionary: string[];
  tried: string[];
  found: string | null;
  ok: boolean;
  verdictText: string;
}

const j = (o: unknown): string => JSON.stringify(o);

export async function runKerberos(opts: KrbOptions): Promise<KrbRun> {
  const iterations = opts.iterations ?? DEFAULT_ITERATIONS;
  const iv = () => opts.rand(12);
  const now = opts.now;

  // Chaves de longo prazo: Alice (da senha), do serviço de tíquetes (TGS) e de Bob.
  const kc = await stringToKey(opts.password, REALM, CLIENT, iterations);
  const ktgs = opts.rand(32);
  const kb = opts.rand(32);

  // --- Troca AS: Alice pede um tíquete de concessão de tíquetes (TGT) -----------------------------------------
  const n1 = toHex(opts.rand(4));
  const kat = opts.rand(32);
  const padata = opts.preauth ? await seal(kc, j({ ts: now }), iv()) : new Uint8Array(0);
  const tgt = await seal(ktgs, j({ kat: toHex(kat), c: CLIENT, start: now, end: now + TICKET_LIFETIME }), iv());
  const asRep = await seal(kc, j({ kat: toHex(kat), n1, end: now + TICKET_LIFETIME }), iv());
  // Alice só abre a resposta se a sua chave for a mesma do KDC.
  const aliceKnowsKat = (await open(kc, asRep)) !== null;

  // --- Troca TGS: Alice pede um tíquete para o serviço de Bob -------------------------------------------------
  const n2 = toHex(opts.rand(4));
  const kab = opts.rand(32);
  const tgsTime = now + 2;
  const tgsAuth = await seal(kat, j({ c: CLIENT, ts: tgsTime }), iv());
  const tktB = await seal(kb, j({ kab: toHex(kab), c: CLIENT, start: tgsTime, end: now + TICKET_LIFETIME }), iv());
  const tgsRep = await seal(kat, j({ kab: toHex(kab), n2, s: SERVICE }), iv());
  const aliceKnowsKab = aliceKnowsKat && (await open(kat, tgsRep)) !== null;

  // --- Troca AP: Alice se apresenta a Bob ---------------------------------------------------------------------
  const apTime = now + 5;
  const apAuth = await seal(kab, j({ c: CLIENT, ts: apTime }), iv());
  const bobOpensTicket = (await open(kb, tktB)) !== null;
  const bobOpensAuth = (await open(kab, apAuth)) !== null;
  const bobAcceptsAlice = bobOpensTicket && bobOpensAuth && Math.abs(apTime - apTime) <= opts.skew;
  const apRep = await seal(kab, j({ ts: apTime }), iv());

  // --- Eva: repetição do autenticador capturado ---------------------------------------------------------------
  const replayTime = apTime + REPLAY_DELAY;
  const replayWithinSkew = Math.abs(replayTime - apTime) <= opts.skew;
  let replayReason: KrbRun['replayReason'] = 'aceito';
  if (!replayWithinSkew) replayReason = 'relogio';
  else if (opts.replayCache) replayReason = 'repeticao';
  const replayAccepted = bobOpensTicket && bobOpensAuth && replayReason === 'aceito';

  // --- Eva: adivinhar a senha a partir da resposta AS ---------------------------------------------------------
  const guessTime = now + GUESS_DELAY;
  const kdcAnswered = !opts.preauth;
  const tried: string[] = [];
  let found: string | null = null;
  if (kdcAnswered) {
    for (const word of opts.dictionary) {
      tried.push(word);
      const candidate = await stringToKey(word, REALM, CLIENT, iterations);
      if ((await open(candidate, asRep)) !== null) {
        found = word;
        break;
      }
    }
  }

  let ok: boolean;
  let verdictText: string;
  if (opts.scenario === 'normal') {
    ok = true;
    verdictText = 'Eva viu os tíquetes e os autenticadores no canal, mas todos estão cifrados com chaves que ela não tem (a de Alice, a do TGS, a de Bob e as chaves de sessão). A senha de Alice nunca trafegou, e Bob autenticou Alice sem falar com o KDC.';
  } else if (opts.scenario === 'replay') {
    ok = !replayAccepted;
    verdictText = replayAccepted
      ? `Eva reapresentou, ${REPLAY_DELAY} segundos depois, o tíquete e o autenticador que capturou. Como o carimbo de tempo ainda estava dentro da tolerância de ${opts.skew} s e Bob não guardava os autenticadores já vistos, ele aceitou a repetição e tratou Eva como Alice. Eva não sabe a chave de sessão e não lê o restante da conversa, mas passou pela autenticação.`
      : replayReason === 'repeticao'
        ? `Eva reapresentou o autenticador capturado dentro da tolerância de relógio, mas Bob guarda os autenticadores já vistos e recusou a repetição (KRB_AP_ERR_REPEAT). O carimbo de tempo limita a janela do ataque; o registro de repetições a fecha.`
        : 'O autenticador estava fora da tolerância de relógio e Bob o recusou.';
  } else if (!kdcAnswered) {
    ok = true;
    verdictText =
      'Com a pré-autenticação, o KDC só responde a quem prova conhecer a chave de Alice (um carimbo de tempo cifrado com ela). Eva não a tem, recebeu um erro e não obteve nenhum texto cifrado para atacar. Um pedido legítimo de Alice, se capturado no canal, ainda pode ser atacado offline: por isso a senha precisa ser forte, e o RFC 6113 (FAST) protege esse pedido.';
  } else if (found !== null) {
    ok = false;
    verdictText = `Sem pré-autenticação, qualquer pessoa pede ao KDC uma resposta AS para Alice. Eva recebeu um texto cifrado com a chave derivada da senha e testou as palavras do dicionário offline, sem tocar mais na rede: a senha "${found}" abriu a resposta na tentativa ${tried.length}. Senha fraca é o elo mais fraco do Kerberos.`;
  } else {
    ok = true;
    verdictText = `Sem pré-autenticação, Eva obteve a resposta AS de Alice e testou ${tried.length} palavras offline, mas a senha não está no dicionário. O ataque só falha por causa da senha forte: o KDC entregou o texto cifrado a quem pediu, e Eva pode continuar tentando com listas maiores.`;
  }

  return {
    scenario: opts.scenario,
    realm: REALM,
    now,
    skew: opts.skew,
    iterations,
    replayCache: opts.replayCache,
    preauth: opts.preauth,
    kcHex: toHex(kc),
    ktgsHex: toHex(ktgs),
    kbHex: toHex(kb),
    katHex: toHex(kat),
    kabHex: toHex(kab),
    n1,
    asReqPadataHex: toHex(padata),
    tgtHex: toHex(tgt),
    asRepHex: toHex(asRep),
    n2,
    tgsAuthHex: toHex(tgsAuth),
    tktBHex: toHex(tktB),
    tgsRepHex: toHex(tgsRep),
    apTime,
    apAuthHex: toHex(apAuth),
    apRepHex: toHex(apRep),
    aliceKnowsKab,
    bobAcceptsAlice,
    replayTime,
    replayWithinSkew,
    replayAccepted,
    replayReason,
    guessTime,
    kdcAnswered,
    guessCipherHex: kdcAnswered ? toHex(asRep) : '',
    dictionary: opts.dictionary,
    tried,
    found,
    ok,
    verdictText,
  };
}
