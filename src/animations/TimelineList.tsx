import type { ProtocolStep } from '../simulation/types';

interface Props {
  steps: ProtocolStep[];
  index: number;
  onSelect: (index: number) => void;
}

/** Linha do tempo do protocolo: clique em uma etapa para saltar até ela. */
export function TimelineList({ steps, index, onSelect }: Props) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < index ? 'done' : n === index ? 'current' : 'todo';
        return (
          <li key={s.id}>
            <button
              type="button"
              aria-current={state === 'current' ? 'step' : undefined}
              onClick={() => onSelect(n)}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-base hover:bg-surface2 ${
                state === 'current' ? 'border-accent bg-accent/10 font-semibold' : 'border-line'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-base ${
                  state === 'done' ? 'border-k-secret bg-k-secret/15 text-k-secret' : state === 'current' ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'
                }`}
              >
                {state === 'done' ? '✓' : n}
              </span>
              <span>
                {s.title}
                <span className="sr-only">{state === 'done' ? ' (concluída)' : state === 'current' ? ' (etapa atual)' : ' (pendente)'}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
