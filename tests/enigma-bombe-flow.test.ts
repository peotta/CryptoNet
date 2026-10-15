import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import type { EnigmaConfig } from '../src/crypto/enigma';
import { buildBombeProtocol, runBombeLab } from '../src/labs/enigma-bombe/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const TEXT =
  'Relatório do tempo sem novidades. Nada a reportar nesta madrugada. Mantenha a posição até nova ordem. Aguardamos a confirmação do comando no horário combinado e seguiremos as instruções recebidas ontem à noite pelo rádio';
const config: EnigmaConfig = { rotors: ['I', 'II', 'III'], reflector: 'B', positions: 'QDV', rings: 'AAA', plugs: 'AV BS CG DL FU HZ IN KM OW RX' };

const go = (over: Partial<{ config: EnigmaConfig; text: string; crib: string; cribPosition: number }> = {}) =>
  runBombeLab(engines.classical, { config, text: TEXT, crib: 'RELATORIODOTEMPO', cribPosition: 1, ...over });

describe('Enigma e a Bombe: Alice, Bob e Eva', () => {
  it('com um menu de laços, Eva quebra a chave do dia e Bob recupera a mensagem', async () => {
    const r = await go();
    expect(r.flow.level).toBe('total');
    expect(r.flow.ok).toBe(false);
    expect(r.flow.stops).toBe(1);
    expect(r.flow.rejected).toBe(17575);
    expect(r.flow.chosenPositions).toBe('QDV');
    expect(r.flow.pct).toBe(100);
    expect(r.flow.menuLoops).toBeGreaterThanOrEqual(2);
    expect(r.flow.trueStopPresent).toBe(true);
    expect(r.flow.recovered.replace(/ /g, '')).toBe(r.plainLetters);
    expect(r.flow.verdictText).toMatch(/laços/);
  }, 60000);

  it('com um menu sem laços, há paradas falsas demais e Eva não consegue verificá-las', async () => {
    const r = await go({ config: { ...config, positions: 'KLM' }, crib: 'RELATORIO' });
    expect(r.flow.level).toBe('muitas-paradas');
    expect(r.flow.ok).toBe(true);
    expect(r.flow.tooMany).toBe(true);
    expect(r.flow.chosenPositions).toBe('');
    expect(r.flow.trueStopPresent).toBe(true);
    expect(r.flow.verdictText).toMatch(/paradas, quase todas falsas/);
  }, 60000);

  it('com a posição errada do texto provável, não sobra parada alguma ou nenhuma é a verdadeira', async () => {
    const r = await go({ cribPosition: 6 });
    expect(r.flow.level).not.toBe('total');
    expect(r.flow.trueStopPresent).toBe(false);
  }, 60000);

  it('as etapas seguem a ordem e Eva só aprende a chave depois de verificar as paradas', async () => {
    const r = await go();
    const def = buildBombeProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'transit', 'eva-menu', 'eva-bombe', 'eva-verify', 'receive', 'decrypt', 'result']);
    const states = ProtocolSimulationEngine.build(def).states;
    const before = states[def.steps.findIndex((s) => s.id === 'eva-verify')];
    expect(before.entries.eva.K).toBeUndefined();
    expect(before.entries.eva.B).toBeDefined();
    const last = states[def.steps.length];
    expect(last.entries.eva.K).toBeDefined();
    expect(last.entries.eva.P).toBeDefined();
    expect(last.verdict?.ok).toBe(false);
  }, 60000);

  it('a configuração do dia nunca atravessa o canal', async () => {
    const r = await go();
    const def = buildBombeProtocol(r.flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) {
      expect(m.summary).not.toContain('QDV');
      expect(m.summary).not.toContain('AV BS');
    }
  }, 60000);

  it('valida as entradas', async () => {
    await expect(go({ text: 'CURTA' })).rejects.toThrow(/pelo menos 20 letras/);
    await expect(go({ crib: 'AB' })).rejects.toThrow(/ao menos 3 letras/);
    await expect(go({ cribPosition: 0 })).rejects.toThrow(/a partir de 1/);
    await expect(go({ cribPosition: 500 })).rejects.toThrow(/não cabe/);
    await expect(go({ text: 'A'.repeat(401) })).rejects.toThrow(/no máximo/);
  });
});
