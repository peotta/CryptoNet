// Motor local do Diffie-Hellman didático. Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { runDhSession, runMitmSession } from '../diffieHellman';
import type { DiffieHellmanEngine, EngineSet } from '../engines';

const diffieHellman: DiffieHellmanEngine = {
  id: 'local-dh-didactic',
  kind: 'educational',
  runSession: async (p, g, a, b) => runDhSession(p, g, a, b),
  runMitm: async (p, g, a, b, e) => runMitmSession(p, g, a, b, e),
};

export const engines: Pick<EngineSet, 'diffieHellman'> = { diffieHellman };
