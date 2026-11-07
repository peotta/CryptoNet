import { describe, expect, it } from 'vitest';
import { runNeedhamSchroeder, type Scenario, type Variant } from '../src/crypto/needhamSchroeder';
import { buildNsProtocol, fixedRandom } from '../src/labs/needham-schroeder/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const def = (variant: Variant, scenario: Scenario) => buildNsProtocol(runNeedhamSchroeder({ variant, scenario, rand: fixedRandom(1) }));
const final = (variant: Variant, scenario: Scenario) => {
  const d = def(variant, scenario);
  return { d, state: ProtocolSimulationEngine.build(d).states[d.steps.length] };
};

describe('fluxo do Needham-Schroeder', () => {
  it('usa só Alice, Bob e Eva', () => {
    expect(def('original', 'normal').parties.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Eva']);
  });
  it('sessão normal: três mensagens e veredito positivo', () => {
    const { state } = final('original', 'normal');
    expect(state.log).toHaveLength(3);
    expect(state.verdict?.ok).toBe(true);
    expect(state.entries.alice.nb.value).toBe(state.entries.bob.nb.value);
    expect(state.entries.eva.na).toBeUndefined();
  });
  it('ataque de Lowe: seis mensagens, Eva aprende Na e Nb e o veredito é negativo', () => {
    const { state } = final('original', 'ataque');
    expect(state.log).toHaveLength(6);
    expect(state.log.filter((m) => m.tampered)).toHaveLength(2);
    expect(state.verdict?.ok).toBe(false);
    expect(state.entries.eva.na.value).toBe(state.entries.alice.na.value);
    expect(state.entries.eva.nb.value).toBe(state.entries.bob.nb.value);
  });
  it('correção sob ataque: Alice aborta, sem mensagem 3 e sem Nb em poder de Eva', () => {
    const { state } = final('corrigido', 'ataque');
    expect(state.log.some((m) => m.label.includes('{Nb}'))).toBe(false);
    expect(state.verdict?.ok).toBe(true);
    expect(state.verdict?.text).toMatch(/abortou/);
    expect(state.entries.eva.nb).toBeUndefined();
    expect(state.entries.alice.conclusao.value).toBe('aborta o protocolo');
  });
  it('correção em sessão normal: a mensagem 2 leva a identidade de Bob', () => {
    const { d, state } = final('corrigido', 'normal');
    expect(state.log).toHaveLength(3);
    expect(state.log[1].label).toContain(', B}');
    expect(d.steps.some((s) => /correção de Lowe|identidade de Bob/.test(s.description))).toBe(true);
  });
  it('cada etapa tem título, descrição e operação, e não usa travessão', () => {
    for (const v of ['original', 'corrigido'] as const)
      for (const sc of ['normal', 'ataque'] as const) {
        for (const s of def(v, sc).steps) {
          expect(s.title && s.description && s.operation).toBeTruthy();
          expect(/[—–]/.test(JSON.stringify(s))).toBe(false);
        }
      }
  });
});
