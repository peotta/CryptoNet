import type {
  Message,
  Operation,
  PartyId,
  ProtocolDefinition,
  ProtocolStep,
  SimulationEvent,
  SimulationState,
  Timeline,
  Entry,
} from './types';

export function initialState(def: ProtocolDefinition): SimulationState {
  return {
    entries: Object.fromEntries(def.parties.map((p) => [p.id, {}])),
    operations: [],
    transit: [],
    log: [],
    verdict: null,
  };
}

function putEntry(entries: SimulationState['entries'], party: PartyId, entry: Entry): SimulationState['entries'] {
  return { ...entries, [party]: { ...(entries[party] ?? {}), [entry.key]: entry } };
}

/** Função pura: aplica um evento e devolve um novo estado. O parâmetro seq numera operações e mensagens. */
export function applyEvent(state: SimulationState, event: SimulationEvent, stepId: string, seq: number): SimulationState {
  switch (event.type) {
    case 'set':
      return { ...state, entries: putEntry(state.entries, event.party, event.entry) };
    case 'compute': {
      const op: Operation = { ...event.operation, id: `${stepId}-op${seq}` };
      return {
        ...state,
        operations: [...state.operations, op],
        entries: event.entry ? putEntry(state.entries, op.party, event.entry) : state.entries,
      };
    }
    case 'send': {
      const m = event.message;
      const msg: Message = { ...m, id: `${stepId}-msg${seq}`, observers: m.observers ?? [], tampered: m.tampered ?? false };
      let entries = state.entries;
      for (const entry of event.deliver) entries = putEntry(entries, m.to, entry);
      for (const obs of msg.observers) {
        if (obs === m.to) continue;
        for (const entry of event.observerEntries ?? event.deliver) entries = putEntry(entries, obs, entry);
      }
      return { ...state, entries, transit: [...state.transit, msg], log: [...state.log, msg] };
    }
    case 'verdict':
      return { ...state, verdict: event.verdict };
  }
}

export function applyStep(state: SimulationState, step: ProtocolStep): SimulationState {
  // Cada etapa começa sem operações nem mensagens em trânsito.
  let next: SimulationState = { ...state, operations: [], transit: [] };
  step.events.forEach((ev, i) => {
    next = applyEvent(next, ev, step.id, i);
  });
  return next;
}

/**
 * Motor de simulação de protocolos. Constrói todos os estados antecipadamente a partir da
 * sequência determinística de eventos; avançar, retroceder ou saltar apenas escolhe um índice,
 * portanto o estado exibido é sempre consistente, qualquer que seja o caminho de navegação.
 */
export class ProtocolSimulationEngine {
  static build(definition: ProtocolDefinition): Timeline {
    const states: SimulationState[] = [initialState(definition)];
    for (const step of definition.steps) states.push(applyStep(states[states.length - 1], step));
    return { definition, states };
  }

  /** Reconstrói o estado do índice k aplicando as k primeiras etapas a partir do zero. */
  static replay(definition: ProtocolDefinition, index: number): SimulationState {
    let s = initialState(definition);
    for (const step of definition.steps.slice(0, index)) s = applyStep(s, step);
    return s;
  }
}

/** Chaves "participante:chave" cujos valores mudaram entre dois estados (para realçar na interface). */
export function changedKeys(prev: SimulationState, next: SimulationState): Set<string> {
  const out = new Set<string>();
  for (const [party, entries] of Object.entries(next.entries)) {
    for (const [key, entry] of Object.entries(entries)) {
      if (prev.entries[party]?.[key]?.value !== entry.value) out.add(`${party}:${key}`);
    }
  }
  return out;
}
