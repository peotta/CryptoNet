import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { buildVigenereProtocol } from '../src/labs/vigenere/flows';
import { MAX_LETTERS, runVigenere } from '../src/labs/vigenere/run';
import { normalizeText } from '../src/crypto/classical';
import { vigenereDecrypt } from '../src/crypto/vigenere';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const TEXTO =
  'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma. Os soldados devem partir antes do nascer do sol, atravessar o vale em silêncio e esperar o sinal do comandante junto à ponte velha. Quem for visto pelos moradores deverá voltar imediatamente ao acampamento e aguardar novas ordens. Ninguém deve acender fogueiras durante a noite, porque a fumaça denunciaria a posição de todo o grupo ao inimigo que vigia a estrada principal.';
const go = (key = 'SEGREDO', tamper = false, text = TEXTO) => runVigenere(engines.classical, { key, text, tamper });

describe('fluxo da Vigenère: Alice, Bob e Eva', () => {
  it('Bob recupera a mensagem e Eva descobre o tamanho e a chave', async () => {
    const r = await go();
    expect(vigenereDecrypt('SEGREDO', r.cipherLetters)).toBe(normalizeText(TEXTO));
    expect(r.flow.recovered.replace(/ /g, '')).toBe(normalizeText(TEXTO));
    expect(r.flow.evaLength).toBe(7);
    expect(r.flow.evaKey).toBe('SEGREDO');
    expect(r.flow.level).toBe('total');
    expect(r.flow.finalPct).toBeGreaterThan(98);
    expect(r.flow.ok).toBe(false); // a cifra foi quebrada
    expect(r.flow.verdictText).toMatch(/Eva descobriu o tamanho da chave \(m = 7\)/);
    expect(r.flow.icCipher).toBeLessThan(r.flow.icPlain); // o IC global cai com a Vigenère
  });
  it('as etapas seguem a ordem, com o tamanho da chave e depois a chave', async () => {
    const def = buildVigenereProtocol((await go()).flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'transit', 'eva-length', 'eva-key', 'receive', 'decrypt', 'result']);
  });
  it('Eva só conhece o tamanho após o Kasiski e o IC, e a chave após as colunas', async () => {
    const r = await go();
    const def = buildVigenereProtocol(r.flow);
    const t = ProtocolSimulationEngine.build(def);
    const i = (id: string) => def.steps.findIndex((s) => s.id === id);
    expect(t.states[i('eva-length')].entries.eva.L).toBeUndefined();
    expect(t.states[i('eva-length') + 1].entries.eva.L.value).toBe('m = 7');
    expect(t.states[i('eva-length') + 1].entries.eva.K).toBeUndefined();
    expect(t.states[i('eva-key') + 1].entries.eva.K.value).toBe('SEGREDO');
    expect(t.states[def.steps.length].entries.alice.K.value).toBe('SEGREDO');
  });
  it('a chave nunca atravessa o canal', async () => {
    const def = buildVigenereProtocol((await go()).flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) expect(m.summary).not.toContain('SEGREDO');
  });
  it('com adulteração, Eva intercepta, criptoanalisa e reenvia uma letra alterada', async () => {
    const r = await go('SEGREDO', true);
    const def = buildVigenereProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'intercept', 'eva-length', 'eva-key', 'transit', 'receive', 'decrypt', 'result']);
    const log = ProtocolSimulationEngine.build(def).states[def.steps.length].log;
    expect(log.map((m) => `${m.from}>${m.to}${m.tampered ? '*' : ''}`)).toEqual(['alice>eva', 'eva>bob*']);
    const a = r.flow.plain.replace(/ /g, '');
    const b = r.flow.recovered.replace(/ /g, '');
    expect([...a].filter((ch, i) => ch !== b[i])).toHaveLength(1);
    expect(r.flow.verdictText).toMatch(/Bob decifrou a mensagem alterada sem perceber/);
  });
  it('uma chave com período menor é reconhecida como equivalente', async () => {
    const r = await go('ABAB');
    expect(r.flow.evaLength).toBe(2);
    expect(r.flow.evaKey).toBe('AB');
    expect(r.flow.verdictText).toMatch(/Sua chave ABAB se repete a cada 2 letras, e é equivalente a AB/);
  });
  it('chave longa com texto curto: Eva erra, e o veredito é coerente com o nível', async () => {
    const r = await go('CRIPTOGRAFIA', false, 'Atacar ao amanhecer');
    expect(r.flow.level).not.toBe('total');
    expect(r.flow.ok).toBe(r.flow.level === 'falha');
    if (r.flow.level === 'falha') expect(r.flow.verdictText).toMatch(/limitação dela nesta mensagem, e não segurança/);
  });
  it('cada etapa executa no máximo uma operação de cálculo', async () => {
    for (const tamper of [false, true]) {
      for (const st of buildVigenereProtocol((await go('SEGREDO', tamper)).flow).steps) {
        expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
      }
    }
  });
  it('avançar e voltar reconstrói o mesmo estado', async () => {
    const def = buildVigenereProtocol((await go('LIVRO', true)).flow);
    const t = ProtocolSimulationEngine.build(def);
    for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
  });
  it('Alice, Bob e Eva são os atores, e Eva é a adversária', async () => {
    const def = buildVigenereProtocol((await go()).flow);
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    expect(def.parties.filter((p) => p.adversary).map((p) => p.name)).toEqual(['Eva']);
  });
  it('valida chave e texto', async () => {
    await expect(go('')).rejects.toThrow(/ao menos uma letra/);
    await expect(go('123')).rejects.toThrow(/ao menos uma letra/);
    await expect(go('A'.repeat(21))).rejects.toThrow(/no máximo 20/);
    await expect(go('SEGREDO', false, '123 !!!')).rejects.toThrow(/ao menos uma letra/);
    await expect(go('SEGREDO', false, 'A'.repeat(MAX_LETTERS + 1))).rejects.toThrow(/no máximo/);
  });
});
