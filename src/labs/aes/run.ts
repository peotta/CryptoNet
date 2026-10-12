import { padWithSpaces, splitBlocks, BLOCK, type AesMode } from '../../crypto/aes';
import type { AesEngine } from '../../crypto/engines';
import { toHex, utf8Decode, utf8Encode } from '../../crypto/encoding';
import { bitDifference } from '../../crypto/hash';
import type { AesFlowData } from './flows';

export type BlockStatus = 'intacto' | 'um bit alterado' | 'corrompido' | 'rejeitado';

export interface AesRun {
  flow: AesFlowData;
  plainBlocks: string[];
  sentBlocks: string[];
  receivedBlocks: string[];
  /** Nulo quando o GCM rejeita a mensagem. */
  recoveredBlocks: string[] | null;
  status: BlockStatus[];
  tagHex: string;
}

const TAG = 16;

/** Descreve blocos cifrados repetidos: o que Eva consegue concluir olhando apenas a cifra. */
export function describePattern(blocks: string[]): string {
  const where = new Map<string, number[]>();
  blocks.forEach((b, i) => where.set(b, [...(where.get(b) ?? []), i + 1]));
  const dups = [...where.values()].filter((v) => v.length > 1);
  if (dups.length === 0) return 'nenhum bloco repetido: sem padrões visíveis';
  return dups.map((v) => `blocos ${v.join(', ')} idênticos (o texto claro também é igual)`).join('; ');
}

function verdict(mode: AesMode, tampered: boolean, k: number, n: number, ok: boolean, text: string): string {
  if (!tampered) return ok ? `Mensagem original recuperada: ${JSON.stringify(text.trimEnd())}.` : 'A mensagem recuperada difere da original.';
  switch (mode) {
    case 'ECB':
      return `O bloco ${k} foi decifrado como lixo e os demais permanecem íntegros. Bob não tem como perceber a adulteração: o ECB não autentica.`;
    case 'CBC':
      return k < n
        ? `O bloco ${k} virou lixo e o MESMO bit foi invertido no bloco ${k + 1}: Eva controla a alteração do bloco seguinte (manipulação de bits). Bob não percebe, pois o CBC não autentica.`
        : `O último bloco (${k}) foi decifrado como lixo. Em blocos intermediários, Eva ainda controlaria um bit do bloco seguinte. Bob não percebe, pois o CBC não autentica.`;
    case 'CTR':
      return 'Exatamente o bit invertido por Eva mudou no texto claro: o CTR é maleável, e Eva altera a mensagem de forma controlada sem conhecer a chave. Bob não percebe.';
    case 'GCM':
      return 'Etiqueta de autenticação inválida: Bob rejeita a mensagem inteira. O GCM detecta qualquer adulteração da cifra.';
  }
}

export async function runAes(
  engine: AesEngine,
  input: { mode: AesMode; key: Uint8Array; iv: Uint8Array | null; text: string; tamper: boolean; tamperBlock: number },
): Promise<AesRun> {
  const { mode, key, iv, text, tamper } = input;
  const plain = padWithSpaces(utf8Encode(text));
  const n = plain.length / BLOCK;
  const k = Math.min(Math.max(1, Math.round(input.tamperBlock)), n);

  const sealed = await engine.encrypt(mode, key, iv, plain);
  const ct = mode === 'GCM' ? sealed.slice(0, sealed.length - TAG) : sealed;
  const tag = mode === 'GCM' ? sealed.slice(sealed.length - TAG) : new Uint8Array(0);

  const received = new Uint8Array(ct);
  if (tamper) received[(k - 1) * BLOCK] ^= 0x01; // Eva inverte 1 bit do bloco k

  let recovered: Uint8Array | null = null;
  try {
    const wire = mode === 'GCM' ? Uint8Array.from([...received, ...tag]) : received;
    recovered = await engine.decrypt(mode, key, iv, wire);
  } catch {
    recovered = null; // GCM: etiqueta inválida
  }

  const plainBlocks = splitBlocks(plain).map(toHex);
  const sentBlocks = splitBlocks(ct).map(toHex);
  const receivedBlocks = splitBlocks(received).map(toHex);
  const recoveredBlocks = recovered ? splitBlocks(recovered).map(toHex) : null;
  const status: BlockStatus[] = plainBlocks.map((p, i) => {
    if (!recovered) return 'rejeitado';
    const d = bitDifference(Uint8Array.from(p.match(/../g)!, (h) => parseInt(h, 16)), splitBlocks(recovered)[i]).differing;
    return d === 0 ? 'intacto' : d === 1 ? 'um bit alterado' : 'corrompido';
  });

  const recoveredText = recovered ? utf8Decode(recovered) : null;
  const ok = recovered !== null && toHex(recovered) === toHex(plain);
  const authFailed = mode === 'GCM' && recovered === null;
  return {
    plainBlocks,
    sentBlocks,
    receivedBlocks,
    recoveredBlocks,
    status,
    tagHex: toHex(tag),
    flow: {
      mode,
      keyBits: key.length * 8,
      keyHex: toHex(key),
      ivHex: iv && mode !== 'ECB' ? toHex(iv) : '',
      message: text,
      nBlocks: n,
      ctHex: toHex(ct),
      receivedCtHex: toHex(received),
      tagHex: toHex(tag),
      tampered: tamper,
      tamperBlock: k,
      recovered: recoveredText,
      authFailed,
      ok,
      pattern: describePattern(sentBlocks),
      verdictText: verdict(mode, tamper, k, n, ok, recoveredText ?? ''),
    },
  };
}
