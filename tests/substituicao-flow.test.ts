import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { buildSubstitutionProtocol } from '../src/labs/substituicao/flows';
import { MAX_LETTERS, runSubstitution } from '../src/labs/substituicao/run';
import { substitutionDecrypt } from '../src/crypto/substitution';
import { normalizeText } from '../src/crypto/classical';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const TEXTO =
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens. Ninguém deve acender fogueiras durante a noite, porque a fumaça denunciaria a posição de todo o grupo ao inimigo que vigia a estrada principal.';
const KEY = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const go = (tamper = false, text = TEXTO, key = KEY) => runSubstitution(engines.classical, { key, text, tamper });

describe('fluxo da substituição simples: Alice, Bob e Eva', () => {
  it('Bob recupera a mensagem e Eva a lê quase inteira sem conhecer a chave', async () => {
    const r = await go();
    expect(substitutionDecrypt(KEY, r.cipherLetters)).toBe(normalizeText(TEXTO));
    expect(r.flow.recovered.replace(/ /g, '')).toBe(normalizeText(TEXTO));
    expect(r.flow.level).toBe('total');
    expect(r.flow.finalPct).toBeGreaterThan(90);
    expect(r.flow.finalPct).toBeGreaterThan(r.flow.freqPct + 30);
    expect(r.flow.ok).toBe(false); // a cifra foi quebrada
    expect(r.flow.verdictText).toMatch(/Eva recuperou/);
  });
  it('as etapas seguem a ordem, com duas etapas de criptoanálise', async () => {
    const def = buildSubstitutionProtocol((await go()).flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'transit', 'eva-freq', 'eva-refine', 'receive', 'decrypt', 'result']);
  });
  it('Eva só obtém o palpite após a análise de frequência e a chave após o refinamento', async () => {
    const r = await go();
    const def = buildSubstitutionProtocol(r.flow);
    const t = ProtocolSimulationEngine.build(def);
    const i = (id: string) => def.steps.findIndex((s) => s.id === id);
    expect(t.states[i('eva-freq')].entries.eva.P0).toBeUndefined();
    expect(t.states[i('eva-freq') + 1].entries.eva.P0).toBeDefined();
    expect(t.states[i('eva-freq') + 1].entries.eva.K).toBeUndefined();
    expect(t.states[i('eva-refine') + 1].entries.eva.K.value).toBe(r.flow.evaKey);
    expect(t.states[i('eva-refine') + 1].entries.alice.K.value).toBe(KEY);
  });
  it('a chave real nunca atravessa o canal', async () => {
    const def = buildSubstitutionProtocol((await go()).flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) expect(m.summary).not.toContain(KEY.slice(0, 10));
  });
  it('com adulteração, Eva intercepta, criptoanalisa e reenvia uma letra alterada', async () => {
    const r = await go(true);
    const def = buildSubstitutionProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'intercept', 'eva-freq', 'eva-refine', 'transit', 'receive', 'decrypt', 'result']);
    const log = ProtocolSimulationEngine.build(def).states[def.steps.length].log;
    expect(log.map((m) => `${m.from}>${m.to}${m.tampered ? '*' : ''}`)).toEqual(['alice>eva', 'eva>bob*']);
    const a = r.flow.plain.replace(/ /g, '');
    const b = r.flow.recovered.replace(/ /g, '');
    expect([...a].filter((ch, i) => ch !== b[i])).toHaveLength(1);
    expect(r.flow.verdictText).toMatch(/Bob decifrou a mensagem alterada sem perceber/);
  });
  it('com texto curto Eva falha ou acerta pouco, e o veredito é coerente com o nível', async () => {
    const r = await go(false, 'Atacar ao amanhecer');
    expect(r.flow.level).not.toBe('total');
    expect(r.flow.ok).toBe(r.flow.level === 'falha');
    if (r.flow.level === 'falha') expect(r.flow.verdictText).toMatch(/limitação dela nesta mensagem, e não segurança/);
  });
  it('cada etapa executa no máximo uma operação de cálculo', async () => {
    for (const tamper of [false, true]) {
      for (const st of buildSubstitutionProtocol((await go(tamper)).flow).steps) {
        expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
      }
    }
  });
  it('avançar e voltar reconstrói o mesmo estado', async () => {
    const def = buildSubstitutionProtocol((await go(true)).flow);
    const t = ProtocolSimulationEngine.build(def);
    for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
  });
  it('Alice, Bob e Eva são os atores, e Eva é a adversária', async () => {
    const def = buildSubstitutionProtocol((await go()).flow);
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    expect(def.parties.filter((p) => p.adversary).map((p) => p.name)).toEqual(['Eva']);
  });
  it('valida chave e texto', async () => {
    await expect(go(false, TEXTO, 'ABC')).rejects.toThrow(/26 letras/);
    await expect(go(false, TEXTO, 'A'.repeat(26))).rejects.toThrow(/repetir/);
    await expect(go(false, '123 !!!')).rejects.toThrow(/ao menos uma letra/);
    await expect(go(false, 'A'.repeat(MAX_LETTERS + 1))).rejects.toThrow(/no máximo/);
  });
});
