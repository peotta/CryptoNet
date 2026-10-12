// Produz os dados do fluxo animado chamando os motores (didático ou Web Crypto).
// Nenhum segredo é registrado em console ou em armazenamento persistente.
import { modPow } from '../../crypto/bigmath';
import type { RealKeyPair, RsaDidacticEngine, RsaRealEngine } from '../../crypto/engines';
import { abbreviateHex, toHex, utf8Decode, utf8Encode } from '../../crypto/encoding';
import type { RsaDidacticKeys } from '../../crypto/rsaDidactic';
import { flipBit, oaepMaxMessageBytes } from '../../crypto/rsaWebCrypto';
import type { RsaFlowData, RsaScenario } from './flows';

export interface DidacticRun {
  keys: RsaDidacticKeys;
  flow: RsaFlowData;
  c?: bigint;
  s?: bigint;
  recovered?: bigint;
}

export async function runDidactic(
  engine: RsaDidacticEngine,
  input: { p: bigint; q: bigint; e: bigint; m: bigint; scenario: RsaScenario; tamper: boolean },
): Promise<DidacticRun> {
  const { p, q, e, m, scenario, tamper } = input;
  const keys = await engine.generateKeys(p, q, e);
  const { n, d, phi } = keys;
  const common = {
    mode: 'didatico' as const,
    scenario,
    tampered: tamper,
    message: m.toString(),
    publicKey: `(n = ${n}, e = ${e})`,
    privateKey: `(n = ${n}, d = ${d})`,
    keygen: {
      formula: 'n = p × q;  φ(n) = (p - 1)(q - 1);  d = e^{-1} mod φ(n)',
      substituted: `n = ${p} × ${q};  φ(n) = ${p - 1n} × ${q - 1n};  d = ${e}^{-1} mod ${phi}`,
      result: `n = ${n}, φ(n) = ${phi}, e = ${e}, d = ${d}`,
    },
  };

  if (scenario === 'cifragem') {
    const c = await engine.encrypt(m, keys.publicKey);
    const received = tamper ? (c + 1n) % n : c;
    const recovered = await engine.decrypt(received, keys.privateKey);
    const ok = recovered === m;
    return {
      keys,
      c,
      recovered,
      flow: {
        ...common,
        receivedMessage: m.toString(),
        forward: { formula: 'c = m^{e} mod n', substituted: `c = ${m}^{${e}} mod ${n}`, result: `c = ${c}` },
        payload: c.toString(),
        receivedPayload: received.toString(),
        backward: { formula: 'm = c^{d} mod n', substituted: `m = ${received}^{${d}} mod ${n}`, result: `m = ${recovered}` },
        outcome: recovered.toString(),
        ok,
        verdictText: ok
          ? `Mensagem original recuperada: m = ${recovered}.`
          : `Obtido m = ${recovered}, diferente de ${m}. Sem padding não existe verificação de integridade: a adulteração não gera erro, apenas um resultado sem sentido.`,
      },
    };
  }

  const s = await engine.sign(m, keys.privateKey);
  const receivedM = tamper ? (m + 1n) % n : m;
  const ok = await engine.verify(receivedM, s, keys.publicKey);
  const check = modPow(s, e, n);
  return {
    keys,
    s,
    flow: {
      ...common,
      receivedMessage: receivedM.toString(),
      forward: { formula: 's = m^{d} mod n', substituted: `s = ${m}^{${d}} mod ${n}`, result: `s = ${s}` },
      payload: s.toString(),
      receivedPayload: s.toString(),
      backward: {
        formula: "s^{e} mod n  =?  m'",
        substituted: `${s}^{${e}} mod ${n} = ${check}  =?  ${receivedM}`,
        result: ok ? 'iguais: assinatura válida' : 'diferentes: assinatura inválida',
      },
      outcome: ok ? 'válida' : 'inválida',
      ok,
      verdictText: ok
        ? `Assinatura válida: s^e mod n = ${check} = m. Somente quem possui a chave privada poderia produzir s.`
        : `Assinatura inválida: s^e mod n = ${check}, mas a mensagem recebida é ${receivedM}. A mensagem ou a assinatura foi alterada.`,
    },
  };
}

export interface RealRun {
  flow: RsaFlowData;
  payloadHex: string;
  receivedHex: string;
  messageBytes: number;
}

const short = (text: string, max = 40) => (text.length > max ? `${text.slice(0, max)}…` : text);

export async function runReal(
  engine: RsaRealEngine,
  keys: RealKeyPair,
  input: { text: string; scenario: RsaScenario; tamper: boolean },
): Promise<RealRun> {
  const { text, scenario, tamper } = input;
  const bytes = utf8Encode(text);
  if (bytes.length === 0) throw new Error('Digite uma mensagem.');
  const alg = scenario === 'cifragem' ? 'RSA-OAEP' : 'RSA-PSS';
  const { info, size } = keys;
  const common = {
    mode: 'real' as const,
    scenario,
    tampered: tamper,
    publicKey: `n = ${abbreviateHex(info.modulusHex, 10)} (${info.modulusBits} bits), e = ${info.exponent}`,
    privateKey: 'não extraível: permanece no módulo criptográfico do navegador',
    keygen: {
      formula: `par de chaves ${alg}`,
      substituted: `generateKey({ name: "${alg}", modulusLength: ${size}, publicExponent: ${info.exponent}, hash: "SHA-256" })`,
      result: `n com ${info.modulusBits} bits, e = ${info.exponent}, d não extraível`,
    },
  };

  if (scenario === 'cifragem') {
    const max = oaepMaxMessageBytes(size);
    if (bytes.length > max) throw new Error(`A mensagem tem ${bytes.length} bytes; o máximo para RSA-OAEP com SHA-256 e chave de ${size} bits é ${max} bytes.`);
    const ct = await engine.encrypt(keys, bytes);
    const received = tamper ? flipBit(ct, ct.length - 1) : ct;
    let recovered: string | null = null;
    try {
      recovered = utf8Decode(await engine.decrypt(keys, received));
    } catch {
      recovered = null;
    }
    const ok = recovered === text;
    return {
      payloadHex: toHex(ct),
      receivedHex: toHex(received),
      messageBytes: bytes.length,
      flow: {
        ...common,
        message: short(text),
        receivedMessage: short(text),
        forward: { formula: 'c = OAEP-Encrypt(chave pública, m)', substituted: `SHA-256 + MGF1; m com ${bytes.length} bytes`, result: `c com ${ct.length} bytes: ${abbreviateHex(toHex(ct), 10)}` },
        payload: abbreviateHex(toHex(ct), 10),
        receivedPayload: abbreviateHex(toHex(received), 10),
        backward: {
          formula: 'm = OAEP-Decrypt(chave privada, c)',
          substituted: `c com ${received.length} bytes`,
          result: recovered === null ? 'OperationError: decifragem rejeitada' : `m = "${short(recovered)}"`,
        },
        outcome: recovered === null ? 'falha: decifragem rejeitada' : short(recovered),
        ok,
        verdictText: ok
          ? `Mensagem original recuperada: "${short(text)}".`
          : 'A decifragem foi rejeitada: o OAEP detectou que a cifra não é válida. Ao contrário do RSA sem padding, a adulteração produz um erro explícito.',
      },
    };
  }

  const sig = await engine.sign(keys, bytes);
  const receivedText = tamper ? `${text}!` : text;
  const ok = await engine.verify(keys, sig, utf8Encode(receivedText));
  return {
    payloadHex: toHex(sig),
    receivedHex: toHex(sig),
    messageBytes: bytes.length,
    flow: {
      ...common,
      message: short(text),
      receivedMessage: short(receivedText),
      forward: { formula: 'σ = PSS-Sign(chave privada, SHA-256(m))', substituted: `sal de 32 bytes; m com ${bytes.length} bytes`, result: `σ com ${sig.length} bytes: ${abbreviateHex(toHex(sig), 10)}` },
      payload: abbreviateHex(toHex(sig), 10),
      receivedPayload: abbreviateHex(toHex(sig), 10),
      backward: {
        formula: 'PSS-Verify(chave pública, σ, m)',
        substituted: `σ com ${sig.length} bytes; m recebida com ${utf8Encode(receivedText).length} bytes`,
        result: ok ? 'verdadeiro' : 'falso',
      },
      outcome: ok ? 'válida' : 'inválida',
      ok,
      verdictText: ok
        ? 'Assinatura válida: a mensagem é íntegra e foi assinada pela chave privada correspondente.'
        : 'Assinatura inválida: a mensagem recebida difere da assinada (basta um único bit). A verificação RSA-PSS rejeita a adulteração.',
    },
  };
}
