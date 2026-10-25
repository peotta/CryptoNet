// Motor local das funções hash e do HMAC. Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { avalancheStats, digest, hmacTrace, hmacWebCrypto, constantTimeEqual } from '../hash';
import type { HashEngine, EngineSet } from '../engines';

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

export const engines: Pick<EngineSet, 'hash'> = { hash };
