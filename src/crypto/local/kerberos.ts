// Motor local de Kerberos (Web Crypto: PBKDF2 e AES-GCM).
import { runKerberos } from '../kerberos';
import type { EngineSet, KerberosEngine } from '../engines';

const kerberos: KerberosEngine = {
  id: 'local-kerberos',
  kind: 'webcrypto',
  run: (options) => runKerberos(options),
};

export const engines: Pick<EngineSet, 'kerberos'> = { kerberos };
