import { useState, type Dispatch } from 'react';
import type { PlayerAction, PlayerState } from '../simulation/player';

export const SPEEDS = [0.5, 1, 1.5, 2] as const;

/** Tamanho do texto da animação: 'auto' reduz o conteúdo até caber na tela; os demais valores são fixos e a área rola. */
export type TextScale = 'auto' | number;
export const TEXT_SCALES: { value: TextScale; label: string }[] = [
  { value: 'auto', label: 'Automático (cabe na tela)' },
  { value: 1, label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 1.75, label: '175%' },
];

interface Props {
  state: PlayerState;
  dispatch: Dispatch<PlayerAction>;
  speed: number;
  onSpeed: (s: number) => void;
  showMath: boolean;
  onShowMath: (v: boolean) => void;
  fullscreen?: boolean;
  onFullscreen?: (v: boolean) => void;
  textScale?: TextScale;
  onTextScale?: (v: TextScale) => void;
}

const btn =
  'min-h-10 rounded-lg border border-line bg-surface px-3 text-base font-semibold hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-50';
const primary = 'min-h-10 rounded-lg bg-accent px-4 text-base font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50';

/** Barra única de controles: navegação à esquerda, opções à direita. */
export function PlayerControls({ state, dispatch, speed, onSpeed, showMath, onShowMath, fullscreen = false, onFullscreen, textScale = 'auto', onTextScale }: Props) {
  const { index, total, playing } = state;
  // O botão "Tela cheia" pula até o primeiro uso, para o estudante perceber a função.
  const [noticed, setNoticed] = useState(false);
  return (
    <div role="group" aria-label="Controles da animação" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2">
      {/* Passo a passo é o padrão: nada avança sem a confirmação explícita do estudante. */}
      {index === 0 ? (
        <button type="button" className={primary} onClick={() => dispatch({ type: 'next' })}>
          Iniciar
        </button>
      ) : (
        <button type="button" className={primary} onClick={() => dispatch({ type: 'next' })} disabled={index >= total}>
          Próxima etapa →
        </button>
      )}
      <button type="button" className={btn} onClick={() => dispatch({ type: 'prev' })} disabled={index === 0}>
        ← Etapa anterior
      </button>
      <button type="button" className={btn} onClick={() => dispatch({ type: 'reset' })} disabled={index === 0 && !playing}>
        Reiniciar
      </button>
      <p aria-live="polite" className="text-base text-muted">
        Etapa {index} de {total} · {playing ? 'execução automática' : 'passo a passo: avança só com a sua confirmação'}
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={showMath} onChange={(e) => onShowMath(e.target.checked)} />
          Mostrar explicações matemáticas
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={playing} disabled={index >= total} onChange={(e) => dispatch({ type: e.target.checked ? 'play' : 'pause' })} />
          Execução automática (opcional)
        </label>
        <label className="flex items-center gap-2">
          Velocidade
          <select className="min-h-10 rounded-lg border border-line bg-surface px-2 text-base" value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {String(s).replace('.', ',')}x
              </option>
            ))}
          </select>
        </label>
        {onTextScale && (
          <label className="flex items-center gap-2">
            Tamanho do texto
            <select
              className="min-h-10 rounded-lg border border-line bg-surface px-2 text-base"
              value={String(textScale)}
              onChange={(e) => onTextScale(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
            >
              {TEXT_SCALES.map((t) => (
                <option key={String(t.value)} value={String(t.value)}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {onFullscreen && (
          <button
            type="button"
            className={`${btn} ${fullscreen || noticed ? '' : 'animate-bounce border-2 border-accent! motion-reduce:animate-none'}`}
            aria-pressed={fullscreen}
            onClick={() => {
              setNoticed(true);
              onFullscreen(!fullscreen);
            }}
          >
            {fullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
          </button>
        )}
      </div>
    </div>
  );
}
