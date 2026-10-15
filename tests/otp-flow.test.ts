import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { keyForTarget, letterDifference, otpDecrypt, randomPad } from '../src/crypto/otp';
import { buildOtpProtocol, buildReuseProtocol, defaultDecoy, MAX_LETTERS, runOtp, runReuse } from '../src/labs/otp/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const TEXTO = 'Atacar a ponte ao amanhecer sem avisar ninguém';
const T1 = 'Nós atacaremos a fortaleza ao amanhecer, sem avisar ninguém, pois a surpresa é a nossa melhor arma e a nossa melhor defesa';
const T2 = 'O diretor da escola reuniu os professores na sala principal para discutir o calendário das provas do próximo semestre com todos';

const otp = (over: Partial<{ text: string; key: string; tamper: boolean; decoy: string | null }> = {}) => {
  const text = over.text ?? TEXTO;
  return runOtp(engines.classical, { text, key: over.key ?? randomPad(300), tamper: false, decoy: null, ...over });
};
const reuse = (over: Partial<{ text1: string; text2: string; key: string; crib: string; cribIn: 1 | 2 }> = {}) =>
  runReuse(engines.classical, { text1: T1, text2: T2, key: randomPad(300), crib: 'AMANHECER', cribIn: 1, ...over });

describe('one-time pad, uso correto: Alice, Bob e Eva', () => {
  it('Bob recupera a mensagem e Eva só aprende o tamanho', async () => {
    const r = await otp();
    expect(r.flow.recovered.replace(/ /g, '')).toBe(r.plainLetters);
    expect(r.flow.nLetters).toBe(r.plainLetters.length);
    expect(r.flow.ok).toBe(true);
    expect(r.flow.verdictText).toMatch(/sigilo perfeito/);
    expect(r.flow.possible).toMatch(/^\d{1,3}(\.\d{3})+$/); // 26^n com pontos de milhar
  });
  it('para o candidato de Eva existe uma chave compatível, e a verdadeira também volta ao texto verdadeiro', async () => {
    const r = await otp();
    expect(otpDecrypt(r.decoyKey, r.cipherLetters)).toBe(r.decoyLetters);
    expect(keyForTarget(r.cipherLetters, r.plainLetters)).toBe(r.keyLetters.slice(0, r.plainLetters.length));
    expect(r.decoyLetters).toBe(defaultDecoy(r.plainLetters.length));
  });
  it('usa um candidato escolhido pelo usuário e exige o mesmo tamanho', async () => {
    const base = await otp();
    const r = await otp({ decoy: 'A'.repeat(base.plainLetters.length) });
    expect(r.decoyLetters).toBe('A'.repeat(base.plainLetters.length));
    expect(r.decoyKey).toBe(keyForTarget(r.cipherLetters, r.decoyLetters));
    await expect(otp({ decoy: 'ABC' })).rejects.toThrow(/exatamente \d+ letras/);
  });
  it('as etapas seguem a ordem, com a hipótese de Eva', async () => {
    const def = buildOtpProtocol((await otp()).flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'transit', 'eva-try', 'receive', 'decrypt', 'result']);
  });
  it('Eva testa uma hipótese, mas nunca possui a chave verdadeira nem o texto claro verdadeiro', async () => {
    const r = await otp();
    const def = buildOtpProtocol(r.flow);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.entries.eva.T.value.replace(/ /g, '')).toContain(r.decoyLetters.slice(0, 10));
    expect(last.entries.eva.K).toBeUndefined();
    expect(JSON.stringify(last.entries.eva)).not.toContain(r.keyLetters.slice(0, 10));
    expect(last.verdict?.ok).toBe(true);
  });
  it('a chave nunca atravessa o canal', async () => {
    const r = await otp();
    const def = buildOtpProtocol(r.flow);
    for (const m of ProtocolSimulationEngine.build(def).states[def.steps.length].log) expect(m.summary).not.toContain(r.keyLetters.slice(0, 8));
  });
  it('com adulteração, Eva soma 1 a uma letra e Bob decifra exatamente a letra escolhida (maleabilidade)', async () => {
    const r = await otp({ tamper: true });
    const def = buildOtpProtocol(r.flow);
    expect(def.steps.map((s) => s.id)).toEqual(['key', 'write', 'encrypt', 'intercept', 'eva-try', 'transit', 'receive', 'decrypt', 'result']);
    const log = ProtocolSimulationEngine.build(def).states[def.steps.length].log;
    expect(log.map((m) => `${m.from}>${m.to}${m.tampered ? '*' : ''}`)).toEqual(['alice>eva', 'eva>bob*']);
    const a = r.plainLetters;
    const b = r.flow.recovered.replace(/ /g, '');
    expect([...a].filter((ch, i) => ch !== b[i])).toHaveLength(1);
    expect(b[r.flow.tamperPosition - 1]).toBe(r.flow.tamperNew);
    expect(r.flow.verdictText).toMatch(/maleabilidade/);
  });
  it('cada etapa executa no máximo uma operação de cálculo, e avançar e voltar é consistente', async () => {
    for (const tamper of [false, true]) {
      const def = buildOtpProtocol((await otp({ tamper })).flow);
      for (const st of def.steps) expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
      const t = ProtocolSimulationEngine.build(def);
      for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
    }
  });
  it('Alice, Bob e Eva são os atores, e Eva é a adversária', async () => {
    const def = buildOtpProtocol((await otp()).flow);
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    expect(def.parties.filter((p) => p.adversary).map((p) => p.name)).toEqual(['Eva']);
  });
  it('valida chave curta, texto vazio e texto longo demais', async () => {
    await expect(otp({ key: 'ABC' })).rejects.toThrow(/tão longa quanto a mensagem/);
    await expect(otp({ text: '123' })).rejects.toThrow(/ao menos uma letra/);
    await expect(otp({ text: 'A'.repeat(MAX_LETTERS + 1) })).rejects.toThrow(/no máximo/);
    await expect(otp({ key: 'AB1' + 'A'.repeat(100) })).rejects.toThrow(/somente letras/);
  });
});

describe('one-time pad, reutilização da chave: Alice, Bob e Eva', () => {
  it('Eva alinha o texto provável, e o trecho da outra mensagem e o da chave saem exatos', async () => {
    const key = randomPad(300);
    const r = await reuse({ key });
    expect(r.flow.success).toBe(true);
    expect(r.flow.rank).toBe(1);
    expect(r.flow.bestOffset).toBe(r.flow.trueOffset);
    expect(r.flow.bestFragment).toBe(r.plain2.slice(r.flow.trueOffset, r.flow.trueOffset + 'AMANHECER'.length));
    expect(r.flow.bestKeyFragment).toBe(key.slice(r.flow.trueOffset, r.flow.trueOffset + 'AMANHECER'.length));
    expect(r.flow.ok).toBe(false); // o sigilo foi quebrado
    expect(r.flow.verdictText).toMatch(/Venona/);
  });
  it('a diferença das cifras é a diferença dos textos claros, e Bob decifra as duas', async () => {
    const r = await reuse();
    const L = Math.min(r.plain1.length, r.plain2.length);
    const expected = [...r.plain1.slice(0, L)].map((ch, i) => String.fromCharCode(65 + ((r.plain2.charCodeAt(i) - ch.charCodeAt(0) + 26) % 26))).join('');
    expect(r.diff).toBe(expected);
    expect(r.diff).toBe(letterDifference(r.cipher1, r.cipher2));
    expect(r.flow.recovered1.replace(/ /g, '')).toBe(r.plain1);
    expect(r.flow.recovered2.replace(/ /g, '')).toBe(r.plain2);
  });
  it('funciona com o texto provável na mensagem 2', async () => {
    const r = await reuse({ crib: 'PROFESSORES', cribIn: 2 });
    expect(r.flow.success).toBe(true);
    expect(r.flow.bestFragment).toBe(r.plain1.slice(r.flow.trueOffset, r.flow.trueOffset + 'PROFESSORES'.length));
  });
  it('um texto provável ausente não produz alinhamento legível, e o veredito explica', async () => {
    const r = await reuse({ crib: 'ZZZZZZ' });
    expect(r.flow.trueOffset).toBe(-1);
    expect(r.flow.rank).toBe(0);
    expect(r.flow.success).toBe(false);
    expect(r.flow.ok).toBe(true);
    expect(r.flow.verdictText).toMatch(/não está na mensagem 1/);
  });
  it('as etapas seguem a ordem, com o cancelamento da chave e o arrasto', async () => {
    const def = buildReuseProtocol((await reuse()).flow);
    expect(def.steps.map((s) => s.id)).toEqual([
      'key', 'write', 'encrypt-1', 'encrypt-2', 'transit-1', 'transit-2', 'eva-diff', 'eva-drag', 'receive', 'decrypt-1', 'decrypt-2', 'result',
    ]);
  });
  it('Eva só tem D após subtrair as cifras, e o fragmento de chave só após o arrasto; nunca a chave inteira', async () => {
    const r = await reuse();
    const def = buildReuseProtocol(r.flow);
    const t = ProtocolSimulationEngine.build(def);
    const i = (id: string) => def.steps.findIndex((s) => s.id === id);
    expect(t.states[i('eva-diff')].entries.eva.D).toBeUndefined();
    expect(t.states[i('eva-diff') + 1].entries.eva.D).toBeDefined();
    expect(t.states[i('eva-drag')].entries.eva.kfrag).toBeUndefined();
    const last = t.states[def.steps.length];
    expect(last.entries.eva.kfrag.value).toBe(r.flow.bestKeyFragment);
    expect(last.entries.eva.kfrag.value.length).toBeLessThan(r.key.length);
    expect(last.entries.eva.K).toBeUndefined();
  });
  it('Eva observa as duas cifras no canal, e a chave nunca passa por ele', async () => {
    const r = await reuse();
    const def = buildReuseProtocol(r.flow);
    const last = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(last.log).toHaveLength(2);
    expect(last.log.every((m) => m.observers.includes('eva'))).toBe(true);
    for (const m of last.log) expect(m.summary).not.toContain(r.key.slice(0, 8));
  });
  it('cada etapa executa no máximo uma operação de cálculo, e avançar e voltar é consistente', async () => {
    const def = buildReuseProtocol((await reuse()).flow);
    for (const st of def.steps) expect(st.events.filter((e) => e.type === 'compute').length).toBeLessThanOrEqual(1);
    const t = ProtocolSimulationEngine.build(def);
    for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
  });
  it('Alice, Bob e Eva são os atores, e Eva é a adversária', async () => {
    const def = buildReuseProtocol((await reuse()).flow);
    expect(def.parties.map((p) => p.id)).toEqual(['alice', 'bob', 'eva']);
    expect(def.parties.filter((p) => p.adversary).map((p) => p.name)).toEqual(['Eva']);
  });
  it('valida chave, texto provável e textos', async () => {
    await expect(reuse({ key: 'ABC' })).rejects.toThrow(/tão longa quanto a mensagem/);
    await expect(reuse({ crib: 'QUE' })).rejects.toThrow(/ao menos 4 letras/);
    await expect(reuse({ text1: '123' })).rejects.toThrow(/ao menos uma letra/);
    await expect(reuse({ text2: 'ABCDEFGH', crib: 'ABCDEFGHIJ' })).rejects.toThrow(/não pode ser maior/);
    await expect(reuse({ text1: 'A'.repeat(MAX_LETTERS + 1) })).rejects.toThrow(/no máximo/);
  });
});
