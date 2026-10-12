// Contratos dos motores criptográficos. A interface React depende SOMENTE destes tipos.
// Todos os métodos são assíncronos de propósito: a implementação local (navegador) pode ser
// substituída ou complementada por um cliente REST/WebSocket para uma API Python/FastAPI
// (ver docs/arquitetura.md) sem alterar nenhum componente.
import {
  decryptDidactic,
  encryptDidactic,
  generateDidacticKeys,
  signDidactic,
  verifyDidactic,
  type RsaDidacticKeys,
  type RsaPrivateKey,
  type RsaPublicKey,
} from './rsaDidactic';
import { avalancheStats, digest, hmacTrace, hmacWebCrypto, constantTimeEqual, type AvalancheStats, type HashAlgo, type HmacTrace } from './hash';
import { runDhSession, runMitmSession, type DhSession, type MitmSession } from './diffieHellman';
import {
  decryptOaep,
  describePublicKey,
  encryptOaep,
  generateOaepKeyPair,
  generatePssKeyPair,
  signPss,
  verifyPss,
  type PublicKeyInfo,
  type RsaKeySize,
} from './rsaWebCrypto';

export type EngineKind = 'educational' | 'webcrypto' | 'remote';

export interface CryptoEngine {
  readonly id: string;
  readonly kind: EngineKind;
}

/** Simulação matemática educacional do RSA (BigInt, sem padding). */
export interface RsaDidacticEngine extends CryptoEngine {
  generateKeys(p: bigint, q: bigint, e: bigint): Promise<RsaDidacticKeys>;
  encrypt(m: bigint, key: RsaPublicKey): Promise<bigint>;
  decrypt(c: bigint, key: RsaPrivateKey): Promise<bigint>;
  sign(m: bigint, key: RsaPrivateKey): Promise<bigint>;
  verify(m: bigint, s: bigint, key: RsaPublicKey): Promise<boolean>;
}

/** Referência opaca a um par de chaves; a implementação decide o que ela contém. */
export interface RealKeyPair {
  readonly size: RsaKeySize;
  readonly info: PublicKeyInfo;
  readonly handle: CryptoKeyPair;
}

/** RSA real (OAEP e PSS). */
export interface RsaRealEngine extends CryptoEngine {
  generateEncryptionKeys(size: RsaKeySize): Promise<RealKeyPair>;
  generateSigningKeys(size: RsaKeySize): Promise<RealKeyPair>;
  encrypt(keys: RealKeyPair, data: Uint8Array): Promise<Uint8Array>;
  decrypt(keys: RealKeyPair, data: Uint8Array): Promise<Uint8Array>;
  sign(keys: RealKeyPair, data: Uint8Array): Promise<Uint8Array>;
  verify(keys: RealKeyPair, signature: Uint8Array, data: Uint8Array): Promise<boolean>;
}

export interface DiffieHellmanEngine extends CryptoEngine {
  runSession(p: bigint, g: bigint, a: bigint, b: bigint): Promise<DhSession>;
  runMitm(p: bigint, g: bigint, a: bigint, b: bigint, e: bigint): Promise<MitmSession>;
}

/** Funções hash e HMAC (operações reais). */
export interface HashEngine extends CryptoEngine {
  digest(algo: HashAlgo, data: Uint8Array): Promise<Uint8Array>;
  /** HMAC com valores intermediários e conferência contra a implementação nativa. */
  hmac(algo: HashAlgo, key: Uint8Array, message: Uint8Array): Promise<{ trace: HmacTrace; matchesReference: boolean }>;
  avalanche(algo: HashAlgo, trials: number): Promise<AvalancheStats>;
}

export interface EngineSet {
  rsaDidactic: RsaDidacticEngine;
  rsaReal: RsaRealEngine;
  diffieHellman: DiffieHellmanEngine;
  hash: HashEngine;
}

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

const diffieHellman: DiffieHellmanEngine = {
  id: 'local-dh-didactic',
  kind: 'educational',
  runSession: async (p, g, a, b) => runDhSession(p, g, a, b),
  runMitm: async (p, g, a, b, e) => runMitmSession(p, g, a, b, e),
};

const hash: HashEngine = {
  id: 'local-webcrypto-hash',
  kind: 'webcrypto',
  digest,
  hmac: async (algo, key, message) => {
    const trace = await hmacTrace(algo, key, message);
    return { trace, matchesReference: constantTimeEqual(trace.tag, await hmacWebCrypto(algo, key, message)) };
  },
  avalanche: avalancheStats,
};

/** Motores ativos. Para usar uma API remota, substitua os valores por clientes que implementem as mesmas interfaces. */
export const engines: EngineSet = { rsaDidactic, rsaReal, diffieHellman, hash };
