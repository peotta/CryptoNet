import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

const panel = 'flex flex-col rounded-xl border border-line bg-surface';
const panelTitle = 'border-b border-line px-3 py-2 text-lg font-bold';

/** Escalas tentadas, da maior para a menor, até o conteúdo caber na área disponível (sem barras de rolagem). */
const FIT_STEPS = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];

/**
 * Visualização completa de um protocolo, organizada para caber em uma única tela:
 * controles no topo; depois, em toda a largura, a etapa, a matemática, o cenário animado
 * e as mensagens. Não há rolagem interna: se o conteúdo for maior que a área, a escala
 * é reduzida (até 60%) para que tudo apareça de uma vez.
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
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  // Escolhe a maior escala em que todo o conteúdo cabe na área. Roda a cada renderização, antes da pintura.
  useLayoutEffect(() => {
    const vp = viewport.current;
    const ct = content.current;
    if (!vp || !ct) return;
    const fit = () => {
      // Em telas estreitas o conteúdo empilha e a página rola normalmente.
      if (!window.matchMedia?.('(min-width: 1024px)').matches) {
        ct.style.zoom = '';
        return;
      }
      let chosen = FIT_STEPS[FIT_STEPS.length - 1];
      for (const z of FIT_STEPS) {
        ct.style.zoom = String(z);
        if (ct.getBoundingClientRect().height <= vp.clientHeight + 1) {
          chosen = z;
          break;
        }
      }
      ct.style.zoom = String(chosen);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(vp);
    return () => ro.disconnect();
  });

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

        <div ref={viewport} className="flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div ref={content} className="flex flex-col gap-3">
            {/* Etapa atual: o que acontece agora. */}
            <div className="rounded-xl border border-line bg-surface p-3" aria-live="polite">
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

            {/* Logo abaixo da etapa: a conta, com as operações lado a lado. */}
            {showMath && (
              <section aria-labelledby="math-heading" className={`${panel} bg-surface2`}>
                <h3 id="math-heading" className={panelTitle}>
                  Explicação matemática da etapa
                </h3>
                <div className="p-3">
                  <MathPanel operations={sim.operations} />
                </div>
              </section>
            )}

            {sim.verdict && (
              <p
                role="status"
                className={`rounded-xl border-2 px-3 py-2 text-lg font-semibold ${sim.verdict.ok ? 'border-k-secret bg-k-secret/10 text-k-secret' : 'border-danger bg-danger/10 text-danger'}`}
              >
                {sim.verdict.ok ? '✓ ' : '✗ '}
                {sim.verdict.text}
              </p>
            )}

            <ProtocolStage timeline={timeline} index={index} speed={speed} />

            <section aria-labelledby="inspector-heading" className={panel}>
              <h3 id="inspector-heading" className={panelTitle}>
                Inspetor de mensagens
              </h3>
              <div className="p-3">
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
