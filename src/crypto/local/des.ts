// Motor local do DES e do Triple DES. Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { cbcDecrypt, cbcEncryptBlocks, desBlock, desTrace, keySchedule, searchKey, tdesStages } from '../des';
import type { DesEngine, EngineSet } from '../engines';

const des: DesEngine = {
  id: 'local-des',
  kind: 'educational',
  keySchedule: async (key) => keySchedule(key),
  trace: async (key, block, decrypt) => desTrace(key, block, decrypt),
  block: async (key, block, decrypt) => desBlock(key, block, decrypt),
  cbcEncrypt: async (keys, iv, data) => cbcEncryptBlocks(keys, iv, data),
  cbcDecrypt: async (keys, iv, data) => cbcDecrypt(keys, iv, data),
  tdesStages: async (k1, k2, k3, block) => tdesStages(k1, k2, k3, block),
  search: (plain, cipher, base, n) => searchKey(plain, cipher, base, n),
};

export const engines: Pick<EngineSet, 'des'> = { des };
