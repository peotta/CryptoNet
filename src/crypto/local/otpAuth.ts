// Motor local de HOTP e TOTP (HMAC pela Web Crypto). Cada família fica em um módulo próprio.
import { checkRfcVectors, hotp, totp, verifyTotp } from '../otpAuth';
import type { EngineSet, OtpAuthEngine } from '../engines';

const otpAuth: OtpAuthEngine = {
  id: 'local-otp-auth',
  kind: 'webcrypto',
  hotp: async (key, counter, digits, algo) => hotp(key, counter, digits, algo),
  totp: async (key, unixSeconds, digits, algo) => totp(key, unixSeconds, digits, algo),
  verify: async (key, unixSeconds, code, options) => verifyTotp(key, unixSeconds, code, options),
  checkVectors: async () => checkRfcVectors(),
};

export const engines: Pick<EngineSet, 'otpAuth'> = { otpAuth };
