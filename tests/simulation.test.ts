import { describe, expect, it } from 'vitest';
import { runDhSession, runMitmSession } from '../src/crypto/diffieHellman';
import { buildDhProtocol, buildMitmProtocol } from '../src/labs/diffie-hellman/flows';
import { buildRsaProtocol } from '../src/labs/rsa/flows';
import { runDidactic } from '../src/labs/rsa/run';
import { engines } from '../src/crypto/engines';
import { initialPlayer, playerReducer, type PlayerAction, type PlayerState } from '../src/simulation/player';
import { changedKeys, ProtocolSimulationEngine } from '../src/simulation/timeline';
import { motionDuration } from '../src/animations/motion';

const dh = () => buildDhProtocol(runDhSession(23n, 5n, 6n, 15n));
const mitm = () => buildMitmProtocol(runMitmSession(23n, 5n, 6n, 15n, 13n));

describe('linha do tempo determinística', () => {
  it('o Diffie-Hellman tem as 7 etapas obrigatórias, na ordem', () => {
    expect(dh().steps.map((s) => s.id)).toEqual(['params', 'secrets', 'publics', 'exchange', 'shared', 'compare', 'apply']);
  });
  it('toda etapa tem identificador, título, descrição e operação', () => {
    for (const def of [dh(), mitm()]) {
      for (const s of def.steps) {
        expect(s.id && s.title && s.description && s.operation).toBeTruthy();
      }
    }
  });
  it('gera um estado inicial e um estado após cada etapa', () => {
    const def = dh();
    const t = ProtocolSimulationEngine.build(def);
    expect(t.states).toHaveLength(def.steps.length + 1);
    expect(t.states[0].log).toHaveLength(0);
  });
  it('avançar e retroceder reconstrói exatamente o mesmo estado (replay)', () => {
    for (const def of [dh(), mitm()]) {
      const t = ProtocolSimulationEngine.build(def);
      for (let i = 0; i <= def.steps.length; i++) expect(ProtocolSimulationEngine.replay(def, i)).toEqual(t.states[i]);
      // percurso "ida e volta": estados indexados nunca dependem do caminho
      for (let i = def.steps.length; i >= 0; i--) expect(t.states[i]).toEqual(ProtocolSimulationEngine.replay(def, i));
    }
  });
  it('estados anteriores não são modificados pelas etapas seguintes (imutabilidade)', () => {
    const t = ProtocolSimulationEngine.build(dh());
    const snapshot = JSON.stringify(t.states[3]);
    ProtocolSimulationEngine.build(dh());
    expect(JSON.stringify(t.states[3])).toBe(snapshot);
  });
  it('a etapa 3 produz A = 8 e B = 19; a etapa 5 produz K = 2 nos dois lados', () => {
    const t = ProtocolSimulationEngine.build(dh());
    expect(t.states[3].entries.alice.A.value).toBe('8');
    expect(t.states[3].entries.bob.B.value).toBe('19');
    expect(t.states[5].entries.alice.K.value).toBe('2');
    expect(t.states[5].entries.bob.K.value).toBe('2');
  });
  it('o veredito de sucesso só aparece na etapa de comparação', () => {
    const t = ProtocolSimulationEngine.build(dh());
    expect(t.states[5].verdict).toBeNull();
    expect(t.states[6].verdict).toEqual({ ok: true, text: 'Segredo compartilhado estabelecido com sucesso.' });
  });
  it('destaca o que mudou em cada etapa', () => {
    const t = ProtocolSimulationEngine.build(dh());
    expect(changedKeys(t.states[2], t.states[3])).toEqual(new Set(['alice:A', 'bob:B']));
  });
});

describe('segredos privados nunca atravessam o canal', () => {
  it('nenhuma mensagem do DH contém a nem b, e o inspetor não os registra', () => {
    const def = dh();
    const t = ProtocolSimulationEngine.build(def);
    const log = t.states[def.steps.length].log;
    expect(log.length).toBeGreaterThan(0);
    for (const m of log) {
      expect(m.kind).not.toBe('private');
      expect(m.summary).not.toMatch(/\ba\s*=\s*6\b|\bb\s*=\s*15\b/);
    }
  });
  it('Eve observa p, g, A e B, mas nunca a, b nem K (cenário passivo)', () => {
    const t = ProtocolSimulationEngine.build(dh());
    const eve = t.states[t.states.length - 1].entries.eve;
    expect(Object.keys(eve).sort()).toEqual(['A', 'B', 'g', 'p']);
  });
  it('as entradas privadas só existem no dono', () => {
    const t = ProtocolSimulationEngine.build(dh());
    const last = t.states[t.states.length - 1];
    expect(last.entries.alice.a.kind).toBe('private');
    expect(last.entries.bob.a).toBeUndefined();
    expect(last.entries.eve.a).toBeUndefined();
    expect(last.entries.eve.b).toBeUndefined();
  });
});

describe('cenário MITM', () => {
  it('Eve substitui os valores e Alice e Bob recebem E', () => {
    const t = ProtocolSimulationEngine.build(mitm());
    const last = t.states[t.states.length - 1];
    expect(last.entries.alice.Brec.value).toBe(last.entries.eve.E.value);
    expect(last.entries.bob.Arec.value).toBe(last.entries.eve.E.value);
    expect(last.entries.alice.K.value).toBe(last.entries.eve.KAE.value);
    expect(last.entries.bob.K.value).toBe(last.entries.eve.KEB.value);
    expect(last.entries.alice.K.value).not.toBe(last.entries.bob.K.value);
    expect(last.verdict?.ok).toBe(false);
  });
  it('as mensagens substituídas são marcadas como adulteradas', () => {
    const t = ProtocolSimulationEngine.build(mitm());
    const log = t.states[t.states.length - 1].log;
    expect(log.filter((m) => m.tampered)).toHaveLength(2);
  });
});

describe('protocolo RSA animado', () => {
  it('a cifragem tem as 9 etapas do roteiro e recupera a mensagem', async () => {
    const run = await runDidactic(engines.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 65n, scenario: 'cifragem', tamper: false });
    const def = buildRsaProtocol(run.flow);
    expect(def.steps).toHaveLength(9);
    const t = ProtocolSimulationEngine.build(def);
    const last = t.states[9];
    expect(last.entries.bob.mrec.value).toBe('65');
    expect(last.verdict?.ok).toBe(true);
    // a chave privada nunca é enviada
    expect(last.log.some((m) => m.kind === 'private')).toBe(false);
    expect(last.entries.alice.priv).toBeUndefined();
  });
  it('voltar uma etapa descarta o resultado posterior (sem dados inconsistentes)', async () => {
    const run = await runDidactic(engines.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 65n, scenario: 'cifragem', tamper: false });
    const t = ProtocolSimulationEngine.build(buildRsaProtocol(run.flow));
    expect(t.states[7].entries.bob.mrec).toBeUndefined();
    expect(t.states[8].entries.bob.mrec.value).toBe('65');
  });
  it('a assinatura adulterada resulta em veredito negativo', async () => {
    const run = await runDidactic(engines.rsaDidactic, { p: 61n, q: 53n, e: 17n, m: 65n, scenario: 'assinatura', tamper: true });
    const def = buildRsaProtocol(run.flow);
    const t = ProtocolSimulationEngine.build(def);
    expect(t.states[def.steps.length].verdict?.ok).toBe(false);
  });
});

describe('máquina de estados do reprodutor', () => {
  const run = (s: PlayerState, ...actions: PlayerAction[]) => actions.reduce(playerReducer, s);
  const start = initialPlayer(7);

  it('começa parado no estado inicial', () => {
    expect(start).toEqual({ index: 0, total: 7, playing: false });
  });
  it('iniciar vai para a etapa 1 e ativa a execução automática', () => {
    expect(run(start, { type: 'play' })).toEqual({ index: 1, total: 7, playing: true });
  });
  it('pausar e continuar preservam o índice', () => {
    const s = run(start, { type: 'play' }, { type: 'tick' }, { type: 'tick' }, { type: 'pause' });
    expect(s).toEqual({ index: 3, total: 7, playing: false });
    expect(run(s, { type: 'play' })).toEqual({ index: 3, total: 7, playing: true });
  });
  it('próxima e anterior respeitam os limites', () => {
    expect(run(start, { type: 'prev' }).index).toBe(0);
    expect(run(start, ...Array(20).fill({ type: 'next' })).index).toBe(7);
  });
  it('avançar manualmente interrompe a execução automática', () => {
    expect(run(start, { type: 'play' }, { type: 'next' }).playing).toBe(false);
  });
  it('a execução automática termina sozinha na última etapa', () => {
    const s = run(start, { type: 'play' }, ...Array(10).fill({ type: 'tick' }));
    expect(s).toEqual({ index: 7, total: 7, playing: false });
  });
  it('tick ignorado quando pausado', () => {
    expect(run(start, { type: 'tick' })).toEqual(start);
  });
  it('reiniciar volta ao zero e para', () => {
    expect(run(start, { type: 'play' }, { type: 'tick' }, { type: 'reset' })).toEqual(start);
  });
  it('iniciar após o fim recomeça a partir da etapa 1', () => {
    const end = run(start, { type: 'goto', index: 7 });
    expect(run(end, { type: 'play' })).toEqual({ index: 1, total: 7, playing: true });
  });
  it('salta para uma etapa da linha do tempo, com índice limitado', () => {
    expect(run(start, { type: 'goto', index: 4 }).index).toBe(4);
    expect(run(start, { type: 'goto', index: 99 }).index).toBe(7);
    expect(run(start, { type: 'goto', index: -3 }).index).toBe(0);
  });
  it('trocar o total reinicia', () => {
    expect(run(start, { type: 'goto', index: 4 }, { type: 'setTotal', total: 9 })).toEqual({ index: 0, total: 9, playing: false });
  });
});

describe('movimento reduzido e velocidade', () => {
  it('duração zero quando o usuário prefere movimento reduzido', () => {
    expect(motionDuration(1.6, 1, true)).toBe(0);
  });
  it('a velocidade escala a duração', () => {
    expect(motionDuration(2, 2, false)).toBe(1);
    expect(motionDuration(2, 0.5, false)).toBe(4);
  });
});
