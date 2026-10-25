// Motor local de curvas elípticas, ECDSA e Ed25519. Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { discreteLogBruteForce, ecdh as eccDh, ecdsaSign as eccSign, ecdsaVerify as eccVerify, publicKey as eccPublic, realSignatureDemo, realSigSupported, recoverFromNonceReuse, TOY_CURVE } from '../ecc';
import type { EccEngine, EngineSet } from '../engines';

const ecc: EccEngine = {
  id: 'local-ecc',
  kind: 'educational',
  curve: TOY_CURVE,
  publicKey: async (d) => eccPublic(TOY_CURVE, d),
  ecdh: async (d, Q) => eccDh(TOY_CURVE, d, Q),
  discreteLog: async (Q) => discreteLogBruteForce(TOY_CURVE, Q),
  sign: async (d, z, k) => eccSign(TOY_CURVE, d, z, k),
  verify: async (Q, z, r, s) => eccVerify(TOY_CURVE, Q, z, r, s),
  recoverNonceReuse: async (z1, s1, z2, s2, r) => recoverFromNonceReuse(TOY_CURVE, z1, s1, z2, s2, r),
  realSupported: async (algo) => realSigSupported(algo),
  realSignature: async (algo, message, tamper) => realSignatureDemo(algo, message, tamper),
};

/** Motores ativos. Para usar uma API remota, substitua os valores por clientes que implementem as mesmas interfaces. */

export const engines: Pick<EngineSet, 'ecc'> = { ecc };
