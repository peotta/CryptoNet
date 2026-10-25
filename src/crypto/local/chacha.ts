// Motor local do ChaCha20. Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { chachaBlock, chachaCrypt } from '../chacha20';
import type { ChaChaEngine, EngineSet } from '../engines';

const chacha: ChaChaEngine = {
  id: 'local-chacha20',
  kind: 'educational',
  crypt: async (key, nonce, counter, data) => chachaCrypt(key, nonce, counter, data),
  block: async (key, nonce, counter) => chachaBlock(key, nonce, counter),
};

export const engines: Pick<EngineSet, 'chacha'> = { chacha };
