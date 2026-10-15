import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import type { ClassicalCipher, ClassicalKey } from '../src/crypto/classical';
import { buildClassicalProtocol } from '../src/labs/classica/flows';
import { MAX_LETTERS, runClassical } from '../src/labs/classica/run';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const TEXTO = 'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma';
const go = (cipher: ClassicalCipher, key: ClassicalKey, tamper = false, text = TEXTO) => runClassical(engines.classical, { cipher, key, text, tamper });
const CESAR = { a: 1, b: 3 };
const AFIM = { a: 5, b: 8 };

describe('fluxo das cifras clássicas: Alice, Bob e Eva', () => {
  it('César: Bob recupera a mensagem e Eva deduz a chave sem conhecê-la', async () => {
    const r = await go('cesar', CESAR);
    const def = buildClassicalProtocol(r.flow);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(r.flow.evaSuccess).toBe(true);
    expect(last.entries.bob.mrec.value).toBe(last.entries.eva.P.value); // os dois leram a mesma mensagem
    expect(last.entries.eva.K.value).toBe('k = 3');
    expect(last.verdict?.ok).toBe(false); // a cifra foi quebrada
    expect(last.verdict?.text).toMatch(/Eva deduziu a chave \(k = 3\)/);
  });
  it('afim: Eva deduz a chave entre as 312 possíveis', async () => {
    const r = await go('afim', AFIM);
    expect(r.flow.keyCount).toBe(312);
    expect(r.flow.evaKeyText).toBe('a = 5, b = 8');
    expect(r.flow.inverseA).toBe(21);
    expect(r.candidates).toHaveLength(312);
  });
  it('as etapas seguem a ordem do protocolo, com uma etapa de criptoanálise', async () => {
    const def = buildClassicalProtocol((await go('cesar', CESAR)).flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'transit', 'eva-crack', 'receive', 'decrypt', 'result']);
  });
  it('com adulteração, Eva intercepta, criptoanalisa e reenvia uma letra alterada', async () => {
    const r = await go('cesar', CESAR, true);
    const def = buildClassicalProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'intercept', 'eva-crack', 'transit', 'receive', 'decrypt', 'result']);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.log.map((m) => `${m.from}>${m.to}${m.tampered ? '*' : ''}`)).toEqual(['alice>eva', 'eva>bob*']);
    expect(r.flow.recovered).not.toBe(r.flow.plain); // Bob não percebe: decifra uma mensagem diferente
    expect(r.flow.verdictText).toMatch(/Bob decifrou a mensagem alterada sem perceber/);
    // exatamente uma letra mudou
    const a = r.flow.plain.replace(/ /g, '');
    const b = r.flow.recovered.replace(/ /g, '');
    expect([...a].filter((ch, i) => ch !== b[i])).toHaveLength(1);
  });
  it('a chave real só aparece em Alice e Bob antes da etapa de criptoanálise', async () => {
    const def = buildClassicalProtocol((await go('cesar', CESAR)).flow);
    const t = ProtocolSimulationEngine.build(def);
    const antes = t.states[def.steps.findIndex((s) => s.id === 'eva-crack')]; // estado antes da etapa
    expect(antes.entries.alice.K.value).toBe('k = 3');
    expect(antes.entries.bob.K.value).toBe('k = 3');
    expect(antes.entries.eva.K).toBeUndefined();
    expect(t.states[def.steps.findIndex((s) => s.id === 'eva-crack') + 1].entries.eva.K.value).toBe('k = 3');
  });
  it('o texto cifrado enviado nunca contém a chave', async () => {
    const def = buildClassicalProtocol((await go('afim', AFIM)).flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) expect(m.summary).not.toMatch(/a = 5|b = 8|k = /);
  });
  it('texto muito curto: Eva pode errar, e o veredito diz que isso é sorte e não segurança', async () => {
    const r = await go('cesar', { a: 1, b: 17 }, false, 'ZZ');
    expect(r.flow.nLetters).toBe(2);
    if (!r.flow.evaSuccess) expect(r.flow.verdictText).toMatch(/sorte, e não segurança/);
    const def = buildClassicalProtocol(r.flow);
    expect(def.steps.find((s) => s.id === 'eva-crack')?.info?.[0]).toMatch(/texto é curto/);
  });
  it('cada etapa executa no máximo uma operação de cálculo', async () => {
    for (const cipher of ['cesar', 'afim'] as const) {
      for (const tamper of [false, true]) {
        const def = buildClassicalProtocol((await go(cipher, cipher === 'cesar' ? CESAR : AFIM, tamper)).flow);
        for (const st of def.steps) expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
      }
    }
  });
  it('avançar e voltar reconstrói o mesmo estado', async () => {
    const def = buildClassicalProtocol((await go('afim', AFIM, true)).flow);
    const t = ProtocolSimulationEngine.build(def);
    for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
  });
  it('Alice, Bob e Eva são os únicos atores, e Eva é a adversária', async () => {
    const def = buildClassicalProtocol((await go('cesar', CESAR)).flow);
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    expect(def.parties.filter((p) => p.adversary).map((p) => p.name)).toEqual(['Eva']);
  });
  it('valida entradas: texto vazio, sem letras e longo demais', async () => {
    await expect(go('cesar', CESAR, false, '')).rejects.toThrow(/ao menos uma letra/);
    await expect(go('cesar', CESAR, false, '123 !!!')).rejects.toThrow(/ao menos uma letra/);
    await expect(go('cesar', CESAR, false, 'A'.repeat(MAX_LETTERS + 1))).rejects.toThrow(/no máximo/);
    await expect(go('afim', { a: 2, b: 0 })).rejects.toThrow(/mdc\(a, 26\)/);
  });
});
