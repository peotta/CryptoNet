// Motor local do AES e dos modos de operação. Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { aesBlockWebCrypto, cbcDecrypt, cbcEncrypt, ctrXor, ecbDecrypt, ecbEncrypt, expandKey, gcmDecrypt, gcmEncrypt, traceEncrypt, type AesMode } from '../aes';
import type { AesEngine, EngineSet } from '../engines';

function need(iv: Uint8Array | null, length: number, mode: AesMode): Uint8Array {
  if (!iv || iv.length !== length) throw new Error(`O ${mode === 'CBC' ? 'IV' : 'nonce'} do ${mode} deve ter ${length} bytes.`);
  return iv;
}

const aes: AesEngine = {
  id: 'local-aes',
  kind: 'educational',
  encrypt: async (mode, key, iv, pt) => {
    switch (mode) {
      case 'ECB':
        return ecbEncrypt(key, pt);
      case 'CBC':
        return cbcEncrypt(key, need(iv, 16, mode), pt);
      case 'CTR':
        return ctrXor(key, need(iv, 12, mode), pt);
      case 'GCM':
        return gcmEncrypt(key, need(iv, 12, mode), pt);
    }
  },
  decrypt: async (mode, key, iv, data) => {
    switch (mode) {
      case 'ECB':
        return ecbDecrypt(key, data);
      case 'CBC':
        return cbcDecrypt(key, need(iv, 16, mode), data);
      case 'CTR':
        return ctrXor(key, need(iv, 12, mode), data);
      case 'GCM':
        return gcmDecrypt(key, need(iv, 12, mode), data);
    }
  },
  traceBlock: async (key, block) => {
    const roundKeys = expandKey(key);
    const steps = traceEncrypt(roundKeys, block);
    const reference = await aesBlockWebCrypto(key, block);
    const last = steps[steps.length - 1].state;
    return { steps, roundKeys, matchesReference: reference.every((b, i) => b === last[i]) };
  },
};

export const engines: Pick<EngineSet, 'aes'> = { aes };
