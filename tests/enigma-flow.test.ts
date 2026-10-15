import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import type { EnigmaConfig } from '../src/crypto/enigma';
import { bigText, buildEnigmaProtocol, configText, MAX_LETTERS, runEnigmaFlow } from '../src/labs/enigma/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const TEXTO = 'Relatório do tempo sem novidades. Nada a reportar nesta madrugada. Mantenha a posição até nova ordem. Aguardamos a confirmação do comando no horário combinado';
const CONFIG: EnigmaConfig = { rotors: ['I', 'II', 'III'], reflector: 'B', positions: 'KLM', rings: 'AAA', plugs: 'AV BS CG DL FU HZ IN KM OW RX' };
const go = (over: Partial<{ config: EnigmaConfig; text: string; crib: string; tamper: boolean }> = {}) =>
  runEnigmaFlow(engines.classical, { config: CONFIG, text: TEXTO, crib: 'RELATORIO', tamper: false, ...over });

describe('fluxo da Enigma: Alice, Bob e Eva', () => {
  it('Bob recupera a mensagem digitando a cifra na mesma configuração (reciprocidade)', async () => {
    const r = await go();
    expect(r.flow.recovered.replace(/ /g, '')).toBe(r.plainLetters);
    for (let i = 0; i < r.plainLetters.length; i++) expect(r.cipherLetters[i]).not.toBe(r.plainLetters[i]); // nenhuma letra cifra em si mesma
  });
  it('o texto provável: a posição real é possível e várias outras são descartadas', async () => {
    const r = await go();
    expect(r.flow.cribTrueOffset).toBe(0);
    expect(r.offsets).toHaveLength(r.plainLetters.length - 'RELATORIO'.length + 1);
    expect(r.offsets[0].possible).toBe(true);
    expect(r.flow.offsetsImpossible).toBeGreaterThan(0);
    expect(r.flow.offsetsImpossible + r.flow.offsetsPossible).toBe(r.flow.offsetsTotal);
  });
  it('o IC da cifra fica perto do aleatório (polialfabética)', async () => {
    const r = await go();
    expect(r.flow.icCipher).toBeLessThan(0.05);
    expect(r.flow.icPlain).toBeGreaterThan(0.06);
  });
  it('as etapas seguem a ordem, com a etapa do texto provável', async () => {
    const def = buildEnigmaProtocol((await go()).flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'transit', 'eva-crib', 'receive', 'decrypt', 'result']);
  });
  it('Eva reduz as hipóteses, mas nunca obtém a configuração nem o texto claro', async () => {
    const def = buildEnigmaProtocol((await go()).flow);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.S.value).toMatch(/de \d+ possíveis/);
    expect(last.entries.eva.K).toBeUndefined();
    expect(Object.values(last.entries.eva).some((e) => e.kind === 'plain' || e.kind === 'secret')).toBe(false);
    expect(last.verdict?.ok).toBe(true);
    expect(last.verdict?.text).toMatch(/não inclui a Bombe/);
  });
  it('a configuração nunca atravessa o canal', async () => {
    const r = await go();
    const def = buildEnigmaProtocol(r.flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) {
      expect(m.summary).not.toContain(r.flow.configText);
      expect(m.summary).not.toContain('KLM');
    }
  });
  it('com adulteração, Eva intercepta e reenvia, e só a letra atingida sai errada', async () => {
    const r = await go({ tamper: true });
    const def = buildEnigmaProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'intercept', 'eva-crib', 'transit', 'receive', 'decrypt', 'result']);
    const log = ProtocolSimulationEngine.build(def).states[def.steps.length].log;
    expect(log.map((m) => `${m.from}>${m.to}${m.tampered ? '*' : ''}`)).toEqual(['alice>eva', 'eva>bob*']);
    const a = r.plainLetters;
    const b = r.flow.recovered.replace(/ /g, '');
    expect([...a].filter((ch, i) => ch !== b[i])).toHaveLength(1); // cada letra é cifrada de forma independente
    expect(r.flow.verdictText).toMatch(/Bob decifrou a mensagem alterada sem perceber/);
  });
  it('a configuração em texto resume rotores, refletor, posições, anéis e plugues', () => {
    expect(configText(CONFIG)).toBe('I-II-III · B · KLM · AAA · 10 plugues');
    expect(configText({ ...CONFIG, plugs: 'AB' })).toBe('I-II-III · B · KLM · AAA · 1 plugue');
    expect(configText({ ...CONFIG, plugs: '' })).toBe('I-II-III · B · KLM · AAA · 0 plugues');
  });
  it('formata o espaço de chaves com pontos de milhar', async () => {
    const r = await go();
    expect(bigText(r.space.withoutRings)).toBe('158.962.555.217.826.360.000');
    expect(bigText(150738274937250n)).toBe('150.738.274.937.250');
  });
  it('cada etapa executa no máximo uma operação de cálculo, e avançar e voltar é consistente', async () => {
    for (const tamper of [false, true]) {
      const def = buildEnigmaProtocol((await go({ tamper })).flow);
      for (const st of def.steps) expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
      const t = ProtocolSimulationEngine.build(def);
      for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
    }
  });
  it('Alice, Bob e Eva são os atores, e Eva é a adversária', async () => {
    const def = buildEnigmaProtocol((await go()).flow);
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    expect(def.parties.filter((p) => p.adversary).map((p) => p.name)).toEqual(['Eva']);
  });
  it('valida texto, texto provável e configuração', async () => {
    await expect(go({ text: '123' })).rejects.toThrow(/ao menos uma letra/);
    await expect(go({ text: 'A'.repeat(MAX_LETTERS + 1) })).rejects.toThrow(/no máximo/);
    await expect(go({ crib: 'AB' })).rejects.toThrow(/ao menos 3 letras/);
    await expect(go({ text: 'ABCDE', crib: 'ABCDEFG' })).rejects.toThrow(/não pode ser maior/);
    await expect(go({ config: { ...CONFIG, rotors: ['I', 'I', 'III'] } })).rejects.toThrow(/diferentes/);
    await expect(go({ config: { ...CONFIG, plugs: 'AB AC' } })).rejects.toThrow(/mais de um par/);
  });
  it('com a configuração de verificação, AAAAA vira BDZGO', async () => {
    const r = await go({ config: { rotors: ['I', 'II', 'III'], reflector: 'B', positions: 'AAA', rings: 'AAA', plugs: '' }, text: 'AAAAA', crib: 'AAA' });
    expect(r.cipherLetters).toBe('BDZGO');
    expect(r.flow.recovered.replace(/ /g, '')).toBe('AAAAA');
  });
});
