import type { Timeline } from '../simulation/types';
import { changedKeys } from '../simulation/timeline';
import { Channel } from './Channel';
import { PartyPanel } from './PartyPanel';

interface Props {
  timeline: Timeline;
  index: number;
  speed: number;
}

/** Cenário: canal em faixa larga no alto e participantes lado a lado abaixo (o adversário, se houver, ao centro). */
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
    <div className="space-y-3">
      <Channel parties={definition.parties} messages={state.transit} stepKey={`${definition.id}-${index}`} speed={speed} />
      <div className={`grid gap-3 ${center ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {panel(left)}
        {panel(center)}
        {panel(right)}
      </div>
    </div>
  );
}
