// Contrato local do RSA: didático (BigInt) e real (Web Crypto). Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { decryptDidactic, encryptDidactic, generateDidacticKeys, signDidactic, verifyDidactic } from '../rsaDidactic';
import { decryptOaep, describePublicKey, encryptOaep, generateOaepKeyPair, generatePssKeyPair, signPss, verifyPss, type RsaKeySize } from '../rsaWebCrypto';
import type { RealKeyPair, RsaDidacticEngine, RsaRealEngine, EngineSet } from '../engines';

const rsaDidactic: RsaDidacticEngine = {
  id: 'local-rsa-didactic',
  kind: 'educational',
  generateKeys: async (p, q, e) => generateDidacticKeys(p, q, e),
  encrypt: async (m, key) => encryptDidactic(m, key),
  decrypt: async (c, key) => decryptDidactic(c, key),
  sign: async (m, key) => signDidactic(m, key),
  verify: async (m, s, key) => verifyDidactic(m, s, key),
};

async function wrap(size: RsaKeySize, handle: CryptoKeyPair): Promise<RealKeyPair> {
  return { size, handle, info: await describePublicKey(handle.publicKey) };
}

const rsaReal: RsaRealEngine = {
  id: 'local-webcrypto-rsa',
  kind: 'webcrypto',
  generateEncryptionKeys: async (size) => wrap(size, await generateOaepKeyPair(size)),
  generateSigningKeys: async (size) => wrap(size, await generatePssKeyPair(size)),
  encrypt: (keys, data) => encryptOaep(keys.handle.publicKey, data),
  decrypt: (keys, data) => decryptOaep(keys.handle.privateKey, data),
  sign: (keys, data) => signPss(keys.handle.privateKey, data),
  verify: (keys, sig, data) => verifyPss(keys.handle.publicKey, sig, data),
};

export const engines: Pick<EngineSet, 'rsaDidactic' | 'rsaReal'> = { rsaDidactic, rsaReal };
