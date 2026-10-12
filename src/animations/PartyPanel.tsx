import { motion, useReducedMotion } from 'motion/react';
import type { Entry, PartyDef, SlotDef } from '../simulation/types';
import { motionDuration } from './motion';
import { Formula } from './Formula';
import { KIND_META, KindIcon, LockIcon } from './kinds';

interface Props {
  party: PartyDef;
  entries: Record<string, Entry>;
  /** Chaves "participante:chave" alteradas na etapa atual. */
  changed: Set<string>;
  active: boolean;
  speed: number;
}

function SlotRow({ slot, entry, highlighted, speed, partyId }: { slot: SlotDef; entry?: Entry; highlighted: boolean; speed: number; partyId: string }) {
  const reduced = useReducedMotion() ?? false;
  const meta = KIND_META[slot.kind];
  return (
    <li
      data-testid={`slot-${partyId}-${slot.key}`}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${meta.border} ${entry ? meta.soft : 'border-dashed bg-transparent'} ${
        highlighted ? 'ring-2 ring-accent' : ''
      }`}
    >
      <KindIcon kind={slot.kind} />
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold">
          <Formula tex={entry?.label ?? slot.label} />
          <span className="sr-only"> ({meta.label})</span>
        </div>
        {entry ? (
          <motion.div
            key={entry.value}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: motionDuration(0.5, speed, reduced) }}
            className="break-all font-mono text-lg"
          >
            {entry.value}
          </motion.div>
        ) : (
          <div className="text-base text-muted">ainda não definido</div>
        )}
      </div>
    </li>
  );
}

export function PartyPanel({ party, entries, changed, active, speed }: Props) {
  const privateSlots = party.slots.filter((s) => s.kind === 'private');
  const openSlots = party.slots.filter((s) => s.kind !== 'private');
  const render = (slot: SlotDef) => (
    <SlotRow key={slot.key} slot={slot} entry={entries[slot.key]} highlighted={changed.has(`${party.id}:${slot.key}`)} speed={speed} partyId={party.id} />
  );
  return (
    <section
      aria-label={`Painel de ${party.name}`}
      className={`rounded-xl border bg-surface p-4 ${active ? 'border-accent ring-2 ring-accent/40' : 'border-line'} ${
        party.adversary ? 'border-dashed' : ''
      }`}
    >
      <header className="mb-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
            party.adversary ? 'bg-danger text-bg' : 'bg-accent text-accent-ink'
          }`}
        >
          {party.name[0]}
        </span>
        <div>
          <h3 className="text-xl font-bold leading-tight">{party.name}</h3>
          <p className="text-base text-muted">{party.role}</p>
        </div>
      </header>
      <ul className="space-y-2">{openSlots.map(render)}</ul>
      {privateSlots.length > 0 && (
        <div className="mt-3 rounded-lg border-2 border-dashed border-k-private p-3" role="group" aria-label={`Área protegida de ${party.name}`}>
          <p className="mb-2 flex items-center gap-2 text-base font-semibold text-k-private">
            <LockIcon />
            Área protegida: nunca sai deste participante
          </p>
          <ul className="space-y-2">{privateSlots.map(render)}</ul>
        </div>
      )}
    </section>
  );
}
