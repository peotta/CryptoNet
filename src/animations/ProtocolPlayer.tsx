import { useMemo, useState, type ReactNode } from 'react';
import { useStepPlayer } from '../hooks/useStepPlayer';
import { ProtocolSimulationEngine } from '../simulation/timeline';
import type { ProtocolDefinition } from '../simulation/types';
import { MathPanel } from './MathPanel';
import { MessageInspector } from './MessageInspector';
import { PlayerControls } from './PlayerControls';
import { ProtocolStage } from './ProtocolStage';
import { TimelineList } from './TimelineList';

interface Props {
  definition: ProtocolDefinition;
  /** Muda quando os parâmetros da simulação mudam; reinicia a reprodução. */
  resetKey: string;
  /** Conteúdo extra exibido ao final da etapa concluída (ex.: extensão AES-GCM). */
  footer?: (info: { index: number; total: number }) => ReactNode;
}

/** Visualização completa de um protocolo: controles, etapa, cenário animado, matemática, linha do tempo e inspetor. */
export function ProtocolPlayer({ definition, resetKey, footer }: Props) {
  const timeline = useMemo(() => ProtocolSimulationEngine.build(definition), [definition]);
  const total = definition.steps.length;
  const [speed, setSpeed] = useState(1);
  const [showMath, setShowMath] = useState(true);
  const { state, dispatch } = useStepPlayer(total, speed, resetKey);
  const index = Math.min(state.index, total);
  const current = index > 0 ? definition.steps[index - 1] : null;
  const sim = timeline.states[index];

  return (
    <div className="space-y-5">
      <PlayerControls state={{ ...state, index }} dispatch={dispatch} speed={speed} onSpeed={setSpeed} showMath={showMath} onShowMath={setShowMath} />

      <div className="rounded-xl border border-line bg-surface p-4" aria-live="polite">
        {current ? (
          <>
            <h3 className="text-xl font-bold">
              Etapa {index}: {current.title}
            </h3>
            <p className="mt-1 text-lg">{current.description}</p>
            <p className="mt-2 text-base text-muted">
              <span className="font-semibold text-ink">Operação executada:</span> {current.operation}
            </p>
            {current.info && (
              <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
                {current.info.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-lg">
            Estado inicial. Pressione <strong>Iniciar</strong> para ver a etapa 1. Em seguida, leia a explicação e use <strong>Próxima etapa</strong> quando estiver pronto: nada avança sozinho.
          </p>
        )}
      </div>

      <ProtocolStage timeline={timeline} index={index} speed={speed} />

      {sim.verdict && (
        <p
          role="status"
          className={`rounded-xl border-2 p-4 text-lg font-semibold ${sim.verdict.ok ? 'border-k-secret bg-k-secret/10 text-k-secret' : 'border-danger bg-danger/10 text-danger'}`}
        >
          {sim.verdict.ok ? '✓ ' : '✗ '}
          {sim.verdict.text}
        </p>
      )}

      {showMath && (
        <section aria-labelledby="math-heading" className="rounded-xl border border-line bg-surface2 p-4">
          <h3 id="math-heading" className="mb-3 text-xl font-bold">
            Explicação matemática da etapa
          </h3>
          <MathPanel operations={sim.operations} />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section aria-labelledby="timeline-heading">
          <h3 id="timeline-heading" className="mb-3 text-xl font-bold">
            Linha do tempo do protocolo
          </h3>
          <TimelineList steps={definition.steps} index={index} onSelect={(i) => dispatch({ type: 'goto', index: i })} />
        </section>
        <section aria-labelledby="inspector-heading">
          <h3 id="inspector-heading" className="mb-3 text-xl font-bold">
            Inspetor de mensagens
          </h3>
          <MessageInspector log={sim.log} parties={definition.parties} />
        </section>
      </div>

      {footer?.({ index, total })}
    </div>
  );
}
