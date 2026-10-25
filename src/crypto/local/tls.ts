// Motor local do handshake do TLS 1.3. Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { simulateHandshake } from '../tls13';
import type { TlsEngine, EngineSet } from '../engines';

const tls: TlsEngine = {
  id: 'local-tls13',
  kind: 'webcrypto',
  handshake: async (input) => simulateHandshake(input),
};

export const engines: Pick<EngineSet, 'tls'> = { tls };
