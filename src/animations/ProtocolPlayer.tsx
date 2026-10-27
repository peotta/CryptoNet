import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

const panel = 'flex min-h-0 flex-col rounded-xl border border-line bg-surface';
const panelTitle = 'shrink-0 border-b border-line px-3 py-2 text-lg font-bold';

/**
 * Visualização completa de um protocolo, organizada para caber em uma única tela:
 * controles no topo; explicação e cenário animado à esquerda;
 * matemática e mensagens à direita. Cada região rola por conta própria.
 */
export function ProtocolPlayer({ definition, resetKey, footer }: Props) {
  const timeline = useMemo(() => ProtocolSimulationEngine.build(definition), [definition]);
  const total = definition.steps.length;
  const [speed, setSpeed] = useState(1);
  const [showMath, setShowMath] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const { state, dispatch } = useStepPlayer(total, speed, resetKey);
  const index = Math.min(state.index, total);
  const current = index > 0 ? definition.steps[index - 1] : null;
  const sim = timeline.states[index];
  const root = useRef<HTMLDivElement>(null);

  // Esc sai da tela cheia.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    // Trava a rolagem da página por trás da tela cheia.
    const { body, documentElement: html } = document;
    const previous = [body.style.overflow, html.style.overflow];
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      [body.style.overflow, html.style.overflow] = previous;
    };
  }, [fullscreen]);

  // Ao iniciar, leva o painel inteiro para o topo da janela, de modo que tudo caiba na vista.
  const prevIndex = useRef(index);
  useEffect(() => {
    if (prevIndex.current === 0 && index === 1 && !fullscreen) root.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    prevIndex.current = index;
  }, [index, fullscreen]);

  return (
    <div className="space-y-5">
      <div
        ref={root}
        className={
          fullscreen
            ? 'fixed inset-0 z-40 flex flex-col gap-3 bg-bg p-3'
            : 'flex scroll-mt-2 flex-col gap-3 lg:h-[calc(100dvh-1rem)] lg:min-h-[38rem]'
        }
      >
        <PlayerControls
          state={{ ...state, index }}
          dispatch={dispatch}
          speed={speed}
          onSpeed={setSpeed}
          showMath={showMath}
          onShowMath={setShowMath}
          fullscreen={fullscreen}
          onFullscreen={setFullscreen}
        />

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_21rem] lg:grid-rows-1">
          {/* Esquerda: o que acontece agora e o cenário animado. */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="max-h-[38%] shrink-0 overflow-y-auto rounded-xl border border-line bg-surface p-3 max-lg:max-h-none" aria-live="polite">
              {current ? (
                <>
                  <h3 className="text-xl font-bold">
                    Etapa {index}: {current.title}
                  </h3>
                  <p className="mt-1 text-lg">{current.description}</p>
                  <p className="mt-1 text-base text-muted">
                    <span className="font-semibold text-ink">Operação executada:</span> {current.operation}
                  </p>
                  {current.info && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-6 text-base">
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

            {sim.verdict && (
              <p
                role="status"
                className={`shrink-0 rounded-xl border-2 px-3 py-2 text-lg font-semibold ${sim.verdict.ok ? 'border-k-secret bg-k-secret/10 text-k-secret' : 'border-danger bg-danger/10 text-danger'}`}
              >
                {sim.verdict.ok ? '✓ ' : '✗ '}
                {sim.verdict.text}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              <ProtocolStage timeline={timeline} index={index} speed={speed} />
            </div>
          </div>

          {/* Direita: a conta da etapa e o que trafegou pelo canal. */}
          <div className="flex min-h-0 flex-col gap-3">
            {showMath && (
              <section aria-labelledby="math-heading" className={`${panel} max-h-[60%] bg-surface2 max-lg:max-h-96`}>
                <h3 id="math-heading" className={panelTitle}>
                  Explicação matemática da etapa
                </h3>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <MathPanel operations={sim.operations} />
                </div>
              </section>
            )}
            <section aria-labelledby="inspector-heading" className={`${panel} flex-1 max-lg:max-h-72`}>
              <h3 id="inspector-heading" className={panelTitle}>
                Inspetor de mensagens
              </h3>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                <MessageInspector log={sim.log} parties={definition.parties} />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Fora da área de tela única: a lista de etapas fica no local original, abaixo da animação. */}
      <section aria-labelledby="timeline-heading">
        <h3 id="timeline-heading" className="mb-3 text-xl font-bold">
          Linha do tempo do protocolo
        </h3>
        <TimelineList steps={definition.steps} index={index} onSelect={(i) => dispatch({ type: 'goto', index: i })} />
      </section>

      {footer?.({ index, total })}
    </div>
  );
}
