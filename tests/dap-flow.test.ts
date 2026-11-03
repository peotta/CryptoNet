import { describe, expect, it } from 'vitest';
import { engines } from '../src/crypto/engines';
import { buildProvisionProtocol, runProvision, type ProvisionInput } from '../src/labs/dap/provision';
import { fixedRandom, makeSeeds } from '../src/labs/dap/seeds';
import { amountToField, buildTransactionProtocol, normalizePayee, runTransaction, type TxInput } from '../src/labs/dap/transaction';
import { ProtocolSimulationEngine } from '../src/simulation/timeline';

const seeds = makeSeeds(fixedRandom(1));
const t0 = Date.UTC(2026, 10, 2, 13, 30, 0);
const prov = (o: Partial<ProvisionInput> = {}): ProvisionInput => ({ scenario: 'normal', seeds, t0, scanSec: 12, typeSec: 30, ...o });
const tx = (o: Partial<TxInput> = {}): TxInput => ({ scenario: 'normal', seeds, t0, scanSec: 20, typeSec: 45, mdOffset: 0, payee: 'Maria Silva', amount: '1500,00', ...o });
const last = (def: Parameters<typeof ProtocolSimulationEngine.build>[0]) => ProtocolSimulationEngine.build(def).states[def.steps.length];
const ids = (def: { steps: { id: string }[] }) => def.steps.map((s) => s.id);
const value = (st: ReturnType<typeof last>, party: string, key: string) => st.entries[party][key]?.value;

describe('DAP, fluxo completo de provisionamento e ativação', () => {
  it('fluxo normal: as chaves coincidem, Eva só vê k1 e o MD é habilitado', async () => {
    const f = await runProvision(engines.dap, prov());
    expect(f.activated).toBe(true);
    expect(f.parse1.ok && f.parse2.ok).toBe(true);
    expect(Buffer.from(f.alice.k).equals(Buffer.from(f.bob.k))).toBe(true);
    const def = buildProvisionProtocol(f);
    expect(ids(def)).toEqual([
      'request', 'bob-k1', 'bob-k2', 'send-k1', 'alice-check1', 'atm-auth', 'send-k2', 'alice-check2', 'alice-k', 'alice-split', 'bob-key',
      'act-transdata', 'act-r', 'act-enc', 'act-mac', 'act-pack', 'send-act', 'act-yprime', 'act-validate', 'act-show', 'act-reveal', 'type-rhat', 'bob-compare',
    ]);
    const st = last(def);
    expect(st.verdict?.ok).toBe(true);
    expect(value(st, 'alice', 'k')).toBe(value(st, 'bob', 'k'));
    expect(st.entries.eva.k1).toBeDefined();
    expect(st.entries.eva.k2).toBeUndefined();
    expect(st.entries.eva.k).toBeUndefined();
    expect(value(st, 'alice', 'k1')).toBe('zerada');
    expect(value(st, 'alice', 'tela')).toContain('Ativar o DAP');
    expect(value(st, 'bob', 'res')).toBe('MD habilitado');
  });

  it('cada etapa faz no máximo uma operação de cálculo (passo a passo)', async () => {
    for (const scenario of ['normal', 'substitui', 've-k2'] as const) {
      const def = buildProvisionProtocol(await runProvision(engines.dap, prov({ scenario })));
      for (const s of def.steps) expect(s.events.filter((e) => e.type === 'compute').length, `${scenario}:${s.id}`).toBeLessThanOrEqual(1);
    }
  });

  it('Eva troca k1: o QR é válido, as chaves divergem e a ativação falha na etiqueta', async () => {
    const f = await runProvision(engines.dap, prov({ scenario: 'substitui' }));
    expect(f.parse1.ok).toBe(true); // o Check não detecta a troca
    expect(Buffer.from(f.alice.k).equals(Buffer.from(f.bob.k))).toBe(false);
    expect(f.tag.equal).toBe(false);
    expect(f.activated).toBe(false);
    const def = buildProvisionProtocol(f);
    expect(ids(def).at(-1)).toBe('act-yprime');
    const st = last(def);
    expect(st.verdict?.ok).toBe(false);
    expect(st.verdict?.text).toContain('Eva trocou k1');
    expect(st.entries.eva.k1e).toBeDefined();
    expect(st.log.some((m) => m.tampered)).toBe(true);
    expect(st.entries.alice.rhat).toBeUndefined();
  });

  it('Eva vê k2 no ATM: ela calcula a mesma chave k e o veredito aponta a hipótese violada', async () => {
    const f = await runProvision(engines.dap, prov({ scenario: 've-k2' }));
    const def = buildProvisionProtocol(f);
    expect(ids(def)).toContain('eva-k');
    const st = last(def);
    expect(value(st, 'eva', 'k')).toBe(value(st, 'alice', 'k'));
    expect(st.verdict?.ok).toBe(false);
    expect(st.verdict?.text).toContain('independência');
  });

  it('código 001 e desafio 000: o QR de k1 traz 6 campos e o desafio usa o modelo de ativação', async () => {
    const f = await runProvision(engines.dap, prov());
    expect(f.qr1.split(';')).toHaveLength(6);
    expect(f.qr1.split(';')[1]).toBe('001');
    expect(f.act.transData.split(';')[2]).toBe('000');
    expect(f.qrs.map((q) => q.stepId)).toEqual(['send-k1', 'send-k2', 'send-act']);
  });

  it('ativação tardia: o código chega depois de 120 s e o e-Bank não habilita o MD', async () => {
    const f = await runProvision(engines.dap, prov({ typeSec: 130 }));
    expect(f.outcome).toBe('expired');
    expect(f.activated).toBe(false);
    expect(last(buildProvisionProtocol(f)).verdict?.ok).toBe(false);
  });

  it('valida os tempos informados', async () => {
    await expect(runProvision(engines.dap, prov({ scanSec: -1 }))).rejects.toThrow();
    await expect(runProvision(engines.dap, prov({ scanSec: 20, typeSec: 10 }))).rejects.toThrow();
    await expect(runProvision(engines.dap, prov({ scanSec: Number.NaN }))).rejects.toThrow();
  });
});

describe('DAP, Partes A e B: fases do provisionamento', () => {
  it('a fase da chave termina quando o MD guarda k e não tem desafio de ativação', async () => {
    const f = await runProvision(engines.dap, prov());
    const def = buildProvisionProtocol(f, 'chave');
    expect(ids(def)).toEqual(['request', 'bob-k1', 'bob-k2', 'send-k1', 'alice-check1', 'atm-auth', 'send-k2', 'alice-check2', 'alice-k', 'alice-split']);
    const st = last(def);
    expect(st.verdict?.ok).toBe(true);
    expect(value(st, 'alice', 'k1')).toBe('zerada');
    expect(st.entries.bob.k).toBeUndefined();
    for (const s of def.steps) expect(s.events.filter((e) => e.type === 'compute').length, s.id).toBeLessThanOrEqual(1);
  });

  it('a fase da chave: Eva trocou k1 (o MD não percebe) e Eva viu k2 (k comprometida)', async () => {
    const sub = last(buildProvisionProtocol(await runProvision(engines.dap, prov({ scenario: 'substitui' })), 'chave'));
    expect(sub.verdict?.ok).toBe(false);
    expect(sub.verdict?.text).toContain('sem perceber');
    const k2 = last(buildProvisionProtocol(await runProvision(engines.dap, prov({ scenario: 've-k2' })), 'chave'));
    expect(k2.verdict?.ok).toBe(false);
    expect(value(k2, 'eva', 'k')).toBe(value(k2, 'alice', 'k'));
  });

  it('a fase da ativação parte da chave já guardada e termina com o MD habilitado', async () => {
    const def = buildProvisionProtocol(await runProvision(engines.dap, prov()), 'ativacao');
    expect(ids(def)).toEqual(['setup', 'bob-key', 'act-transdata', 'act-r', 'act-enc', 'act-mac', 'act-pack', 'send-act', 'act-yprime', 'act-validate', 'act-show', 'act-reveal', 'type-rhat', 'bob-compare']);
    const st = ProtocolSimulationEngine.build(def);
    expect(value(st.states[1], 'alice', 'k')).toBeDefined(); // já no ponto de partida
    const end = last(def);
    expect(end.verdict?.ok).toBe(true);
    expect(value(end, 'alice', 'k')).toBe(value(end, 'bob', 'k'));
    expect(value(end, 'bob', 'res')).toBe('MD habilitado');
    for (const s of def.steps) expect(s.events.filter((e) => e.type === 'compute').length, s.id).toBeLessThanOrEqual(1);
  });

  it('a fase da ativação com a chave divergente para na etiqueta, com Eva já com k1 trocada', async () => {
    const def = buildProvisionProtocol(await runProvision(engines.dap, prov({ scenario: 'substitui' })), 'ativacao');
    expect(ids(def).at(-1)).toBe('act-yprime');
    const st = last(def);
    expect(st.verdict?.ok).toBe(false);
    expect(st.entries.eva.k1e).toBeDefined();
    expect(value(st, 'alice', 'k')).not.toBe(value(st, 'bob', 'k'));
  });

  it('a fase da ativação com Eva conhecendo k mostra a chave dela desde o início', async () => {
    const st = ProtocolSimulationEngine.build(buildProvisionProtocol(await runProvision(engines.dap, prov({ scenario: 've-k2' })), 'ativacao')).states[1];
    expect(value(st, 'eva', 'k')).toBe(value(st, 'alice', 'k'));
  });
});

describe('DAP, Parte C: transação', () => {
  it('fluxo normal: o MD confere y, mostra os dados, revela r_hat e o e-Bank executa', async () => {
    const f = await runTransaction(engines.dap, tx());
    expect(f.executed).toBe(true);
    expect(f.rHat).toBe(f.ch.r);
    const def = buildTransactionProtocol(f);
    expect(ids(def)).toEqual([
      'setup', 'request', 'bob-k', 'tx-transdata', 'tx-r', 'tx-enc', 'tx-mac', 'tx-pack', 'send-chal', 'tx-yprime', 'tx-validate', 'tx-show', 'tx-reveal', 'type-rhat', 'bob-compare',
    ]);
    const st = last(def);
    expect(st.verdict?.ok).toBe(true);
    expect(value(st, 'alice', 'tela')).toContain('MARIA SILVA');
    expect(value(st, 'alice', 'tela')).toContain('R$ 1.500,00');
    expect(value(st, 'alice', 'rhat')).toBe(f.ch.r);
    expect(value(st, 'bob', 'res')).toBe('executada; r invalidado');
    expect(value(st, 'eva', 'K')).toBe('desconhecida'); // Eva nunca obtém a chave
    expect(value(st, 'eva', 'rhat')).toBe(f.ch.r); // mas vê o código digitado no UC
    expect(st.log.map((m) => m.label)).toEqual(['pedido m', 'QR(desafio)', 'r_hat']);
  });

  it('cada etapa faz no máximo uma operação de cálculo (passo a passo)', async () => {
    for (const scenario of ['normal', 'altera', 'fraude', 'forca-bruta', 'replay'] as const) {
      const def = buildTransactionProtocol(await runTransaction(engines.dap, tx({ scenario })));
      for (const s of def.steps) expect(s.events.filter((e) => e.type === 'compute').length, `${scenario}:${s.id}`).toBeLessThanOrEqual(1);
    }
  });

  it('Eva altera os dados dentro do QR: a etiqueta falha e r\' não é decifrado', async () => {
    const f = await runTransaction(engines.dap, tx({ scenario: 'altera' }));
    expect(f.forged).toBe(true);
    expect(f.received).not.toBe(f.ch.base64);
    expect(f.tag?.equal).toBe(false);
    expect(f.rHat).toBeNull();
    const def = buildTransactionProtocol(f);
    expect(ids(def).at(-1)).toBe('tx-yprime');
    const st = last(def);
    expect(st.verdict?.ok).toBe(false);
    expect(st.entries.alice.rhat).toBeUndefined();
    expect(st.entries.alice.tela).toBeUndefined(); // nada chega à tela confiável
    expect(st.log.some((m) => m.tampered && m.from === 'eva' && m.to === 'alice')).toBe(true);
  });

  it('MITB: o QR repassado é autêntico, o MD mostra a conta de Eva e Alice cancela', async () => {
    const f = await runTransaction(engines.dap, tx({ scenario: 'fraude' }));
    expect(f.tag?.equal).toBe(true);
    expect(f.rHat).toBeNull(); // Alice cancelou: o código nunca foi decifrado
    const def = buildTransactionProtocol(f);
    expect(ids(def).slice(-3)).toEqual(['tx-show', 'alice-cancel', 'bob-timeout']);
    const st = last(def);
    expect(value(st, 'alice', 'tela')).toContain('CONTA DE EVA');
    expect(value(st, 'alice', 'tela')).toContain('R$ 9.000,00');
    expect(value(st, 'alice', 'rhat')).toContain('cancelado');
    expect(st.verdict?.ok).toBe(false);
    expect(st.verdict?.text).toContain('Ataque barrado');
    expect(st.log.some((m) => m.tampered && m.from === 'eva' && m.to === 'bob')).toBe(true);
  });

  it('força bruta: Eva faz 3 chutes errados e o e-Bank cancela a transação', async () => {
    const f = await runTransaction(engines.dap, tx({ scenario: 'forca-bruta' }));
    expect(f.guesses.map((g) => g.outcome)).toEqual(['wrong', 'wrong', 'locked']);
    expect(f.guesses.every((g) => g.code !== f.ch.r)).toBe(true);
    const def = buildTransactionProtocol(f);
    expect(ids(def).filter((i) => i.startsWith('guess-'))).toEqual(['guess-1', 'guess-2', 'guess-3']);
    const st = last(def);
    expect(st.verdict?.ok).toBe(false);
    expect(st.verdict?.text).toContain('3 × 10^-6');
    expect(value(st, 'bob', 'res')).toContain('cancelada');
    expect(st.entries.alice.tela).toBeUndefined(); // Alice não participa
  });

  it('repetição: o código capturado vale para uma transação só', async () => {
    const f = await runTransaction(engines.dap, tx({ scenario: 'replay' }));
    expect(f.executed).toBe(true);
    expect(f.replay).not.toBeNull();
    expect(f.replay!.outcome).toBe('wrong');
    const def = buildTransactionProtocol(f);
    expect(ids(def).slice(-4)).toEqual(['eva-tx2', 'bob-chal2', 'eva-replay', 'bob-compare2']);
    const st = last(def);
    expect(st.verdict?.ok).toBe(false);
    expect(value(st, 'bob', 'r')).toBe(f.replay!.r2);
  });

  it('QR velho: acima de 120 s o MD recusa o desafio e não mostra a transação nem o código', async () => {
    const f = await runTransaction(engines.dap, tx({ scanSec: 150, typeSec: 160 }));
    expect(f.fresh?.state).toBe('expired');
    expect(f.rHat).toBeNull();
    const def = buildTransactionProtocol(f);
    expect(ids(def).at(-1)).toBe('tx-validate');
    const st = last(def);
    expect(st.verdict?.ok).toBe(false);
    expect(st.verdict?.text).toContain('expirado');
    expect(st.entries.alice.tela).toBeUndefined();
  });

  it('relógio do MD atrasado em mais de 60 s: carimbo no futuro, o MD pede para conferir a hora', async () => {
    const f = await runTransaction(engines.dap, tx({ mdOffset: -100, scanSec: 10, typeSec: 30 }));
    expect(f.fresh?.state).toBe('future');
    expect(last(buildTransactionProtocol(f)).verdict?.text).toContain('data e a hora');
    const ok = await runTransaction(engines.dap, tx({ mdOffset: -50, scanSec: 0, typeSec: 30 }));
    expect(ok.fresh?.state).toBe('ok');
  });

  it('código digitado depois de 120 s: o e-Bank cancela, mesmo com o código certo', async () => {
    const f = await runTransaction(engines.dap, tx({ scanSec: 100, typeSec: 130 }));
    expect(f.outcome).toBe('expired');
    expect(f.executed).toBe(false);
    const st = last(buildTransactionProtocol(f));
    expect(st.verdict?.ok).toBe(false);
    expect(value(st, 'bob', 'res')).toBe('cancelada (prazo)');
  });

  it('o desafio vai em Base64 e o trans_data carrega o favorecido em maiúsculas ASCII', async () => {
    const f = await runTransaction(engines.dap, tx({ payee: 'José da Conceição' }));
    expect(f.ch.transData).toContain(';JOSE DA CONCEICAO;');
    expect(f.ch.transData).toContain(';0000000150000;');
    expect(f.qrs[0].text).toBe(f.ch.base64);
  });

  it('valida favorecido, valor e prazos', async () => {
    expect(normalizePayee('  Ana   Lúcia ')).toBe('ANA LUCIA');
    expect(() => normalizePayee('')).toThrow();
    expect(() => normalizePayee('A;B')).toThrow();
    expect(() => normalizePayee('x'.repeat(31))).toThrow();
    expect(amountToField('1.500,00')).toBe('0000000150000');
    expect(amountToField('0,05')).toBe('0000000000005');
    expect(amountToField('12')).toBe('0000000001200');
    expect(() => amountToField('0')).toThrow();
    expect(() => amountToField('abc')).toThrow();
    expect(() => amountToField('999999999999,99')).toThrow();
    await expect(runTransaction(engines.dap, tx({ mdOffset: 601 }))).rejects.toThrow();
    await expect(runTransaction(engines.dap, tx({ typeSec: 5, scanSec: 10 }))).rejects.toThrow();
  });
});
