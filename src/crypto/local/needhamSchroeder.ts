// Motor local do Needham-Schroeder (RSA didático com BigInt). Cada família fica em um módulo próprio.
import { runNeedhamSchroeder } from '../needhamSchroeder';
import type { EngineSet, NsEngine } from '../engines';

const ns: NsEngine = {
  id: 'local-needham-schroeder',
  kind: 'educational',
  run: async (options) => runNeedhamSchroeder(options),
};

export const engines: Pick<EngineSet, 'ns'> = { ns };
