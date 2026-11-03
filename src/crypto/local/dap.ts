// Motor local do DAP (Web Crypto: HMAC-SHA-512, HMAC-SHA-256, SHA-256 e AES-256-CBC).
import { checkTag, decryptCode, deriveK2, encodeKeyShare, parseKeyShare, sealChallenge } from '../dap';
import type { DapEngine, EngineSet } from '../engines';

const dap: DapEngine = {
  id: 'local-webcrypto-dap',
  kind: 'webcrypto',
  deriveK2,
  encodeShare: encodeKeyShare,
  parseShare: parseKeyShare,
  seal: sealChallenge,
  checkTag,
  reveal: decryptCode,
};

export const engines: Pick<EngineSet, 'dap'> = { dap };
