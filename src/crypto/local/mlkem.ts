// Motor local do ML-KEM e do LWE didático (funções puras em TypeScript, sem Web Crypto).
import type { EngineSet, LweEngine, MlKemEngine } from '../engines';
import { attackBruteForce, attackGauss, lweDecrypt, lweEncrypt, lweKeyGen } from '../lwe';
import { decapsDetailed, encapsDetailed, keyGenDetailed } from '../mlkem';

const mlkem: MlKemEngine = {
  id: 'local-mlkem',
  kind: 'educational',
  keyGen: async (p, d, z) => keyGenDetailed(d, z, p),
  encaps: async (p, ek, m) => encapsDetailed(ek, m, p),
  decaps: async (p, dk, c) => decapsDetailed(dk, c, p),
};

const lwe: LweEngine = {
  id: 'local-lwe',
  kind: 'educational',
  keyGen: async (params, seed) => lweKeyGen(params, seed),
  encrypt: async (keys, bit, seed) => lweEncrypt(keys, bit, seed),
  decrypt: async (params, s, u, v) => lweDecrypt(params, s, u, v),
  attackGauss: async (keys) => attackGauss(keys),
  attackBruteForce: async (keys) => attackBruteForce(keys),
};

/** Motores ativos. Para usar uma API remota, substitua os valores por clientes que implementem as mesmas interfaces. */
export const engines: Pick<EngineSet, 'mlkem' | 'lwe'> = { mlkem, lwe };
