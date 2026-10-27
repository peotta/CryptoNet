// Motor local do RC4. Cada família fica em um módulo próprio para que cada laboratório carregue só o que usa.
import { fmsRecoverVerified, ksaTrace, prgaTrace, rc4Crypt, rc4Stream, weakPackets, wepEncrypt } from '../rc4';
import type { EngineSet, Rc4Engine } from '../engines';

const rc4: Rc4Engine = {
  id: 'local-rc4',
  kind: 'educational',
  ksa: async (key) => ksaTrace(key),
  prga: async (state, count, skip) => prgaTrace(state, count, skip),
  stream: async (key, n, drop) => rc4Stream(key, n, drop),
  crypt: async (key, data, drop) => rc4Crypt(key, data, drop),
  wepCapture: async (root) => weakPackets(root, root.length),
  fms: async (rootLen, packets, iv, knownFrame, cipherFrame) =>
    fmsRecoverVerified(rootLen, packets, (k) => wepEncrypt(iv, k, knownFrame).every((b, i) => b === cipherFrame[i])),
};

export const engines: Pick<EngineSet, 'rc4'> = { rc4 };
