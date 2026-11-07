import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/local/otpAuth';
import { RFC_SECRET } from '../src/crypto/otpAuth';
import { buildAlgoProtocol, buildScenarioProtocol, DEFAULT_TIME, runAlgo, runScenario, type Scenario } from '../src/labs/totp-hotp/flows';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const KEY = new TextEncoder().encode(RFC_SECRET);
const final = (d: ReturnType<typeof buildScenarioProtocol>) => ProtocolSimulationEngine.build(d).states[d.steps.length];
const scenario = async (s: Scenario, extra: { rejectUsed?: boolean; limit?: number } = {}) =>
  runScenario(engines.otpAuth, { scenario: s, key: KEY, time: DEFAULT_TIME, rejectUsed: extra.rejectUsed ?? false, limit: extra.limit ?? 5 });

describe('Parte A: o algoritmo', () => {
  it('HOTP com o contador 0 chega ao código 755224 da RFC 4226 e Bob concorda', async () => {
    const d = await runAlgo(engines.otpAuth, { mode: 'hotp', secret: RFC_SECRET, counter: 0, time: 0, digits: 6, algo: 'SHA-1' });
    expect(d.code).toBe('755224');
    expect(d.bobCode).toBe(d.code);
    expect(d.hmacHex).toBe('cc93cf18508d94934c64b65d8ba7667fb7cde4b0');
    expect(d.offset).toBe(0);
    expect(d.maskedHex).toBe('4c93cf18');
    const def = buildAlgoProtocol(d);
    expect(def.parties.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    const state = ProtocolSimulationEngine.build(def).states[def.steps.length];
    expect(state.verdict?.ok).toBe(true);
    expect(state.entries.alice.code.value).toBe('755224');
  });
  it('TOTP no instante 59 s com 8 dígitos chega a 94287082 da RFC 6238', async () => {
    const d = await runAlgo(engines.otpAuth, { mode: 'totp', secret: RFC_SECRET, counter: 0, time: 59, digits: 8, algo: 'SHA-1' });
    expect(d.code).toBe('94287082');
    expect(d.counterValue).toBe('1');
    expect(d.counterHex).toBe('0000000000000001');
  });
  it('recusa segredo vazio ou longo demais', async () => {
    await expect(runAlgo(engines.otpAuth, { mode: 'hotp', secret: '', counter: 0, time: 0, digits: 6, algo: 'SHA-1' })).rejects.toThrow();
    await expect(runAlgo(engines.otpAuth, { mode: 'hotp', secret: 'x'.repeat(65), counter: 0, time: 0, digits: 6, algo: 'SHA-1' })).rejects.toThrow();
  });
});

describe('Parte B: Alice, Bob e Eva', () => {
  it('usa só Alice, Bob e Eva', async () => {
    expect(buildScenarioProtocol(await scenario('normal')).parties.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Eva']);
  });
  it('código vencido: Eva lê o código mas o servidor o recusa 90 s depois', async () => {
    const d = await scenario('normal');
    expect(d.evaAccepted).toBe(false);
    expect(d.evaReason).toBe('fora-da-janela');
    const s = final(buildScenarioProtocol(d));
    expect(s.verdict?.ok).toBe(true);
    expect(s.entries.eva.cap.value).toBe(d.code);
  });
  it('repetição: sem o registro do contador o servidor aceita de novo; com ele, recusa', async () => {
    const sem = await scenario('replay', { rejectUsed: false });
    expect(sem.evaAccepted).toBe(true);
    expect(final(buildScenarioProtocol(sem)).verdict?.ok).toBe(false);
    const com = await scenario('replay', { rejectUsed: true });
    expect(com.evaAccepted).toBe(false);
    expect(com.evaReason).toBe('ja-usado');
    expect(final(buildScenarioProtocol(com)).verdict?.ok).toBe(true);
  });
  it('phishing em tempo real: o servidor aceita o código retransmitido por Eva', async () => {
    const d = await scenario('phishing');
    expect(d.evaAccepted).toBe(true);
    const s = final(buildScenarioProtocol(d));
    expect(s.verdict?.ok).toBe(false);
    expect(s.log.map((m) => `${m.from}>${m.to}`)).toEqual(['alice>eva', 'eva>bob']);
  });
  it('força bruta: os palpites erram e a probabilidade acompanha o limite de tentativas', async () => {
    const d = await scenario('forca-bruta', { limit: 5 });
    expect(d.guesses).toHaveLength(5);
    expect(d.hit).toBe(false);
    expect(d.probability).toBeCloseTo(1 - (1 - 3 / 1e6) ** 5, 12);
    expect(final(buildScenarioProtocol(d)).verdict?.ok).toBe(true);
    expect((await scenario('forca-bruta', { limit: 20 })).probability).toBeGreaterThan(d.probability);
  });
  it('o resultado é reproduzível com a mesma chave e o mesmo instante', async () => {
    const a = await scenario('normal');
    const b = await scenario('normal');
    expect(a.code).toBe(b.code);
    expect(JSON.stringify(buildScenarioProtocol(a))).toBe(JSON.stringify(buildScenarioProtocol(b)));
  });
});
