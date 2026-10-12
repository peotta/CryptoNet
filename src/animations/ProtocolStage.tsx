import type { Timeline } from '../simulation/types';
import { changedKeys } from '../simulation/timeline';
import { Channel } from './Channel';
import { PartyPanel } from './PartyPanel';

interface Props {
  timeline: Timeline;
  index: number;
  speed: number;
}

/** Cenário: participante à esquerda, canal (e adversário, se houver) ao centro, participante à direita. */
export function ProtocolStage({ timeline, index, speed }: Props) {
  const { definition, states } = timeline;
  const state = states[index];
  const changed = index > 0 ? changedKeys(states[index - 1], state) : new Set<string>();
  const activeParties = new Set([...state.operations.map((o) => o.party), ...state.transit.map((m) => m.from)]);
  const byPos = (pos: 'left' | 'center' | 'right') => definition.parties.find((p) => p.position === pos);
  const left = byPos('left');
  const center = byPos('center');
  const right = byPos('right');
  const panel = (p: typeof left) =>
    p && <PartyPanel party={p} entries={state.entries[p.id] ?? {}} changed={changed} active={activeParties.has(p.id)} speed={speed} />;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
      {panel(left)}
      <div className="space-y-4">
        <Channel parties={definition.parties} messages={state.transit} stepKey={`${definition.id}-${index}`} speed={speed} />
        {panel(center)}
      </div>
      {panel(right)}
    </div>
  );
}
