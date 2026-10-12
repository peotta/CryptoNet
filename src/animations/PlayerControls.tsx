import type { Dispatch } from 'react';
import type { PlayerAction, PlayerState } from '../simulation/player';

export const SPEEDS = [0.5, 1, 1.5, 2] as const;

interface Props {
  state: PlayerState;
  dispatch: Dispatch<PlayerAction>;
  speed: number;
  onSpeed: (s: number) => void;
  showMath: boolean;
  onShowMath: (v: boolean) => void;
}

const btn =
  'min-h-11 rounded-lg border border-line bg-surface px-4 text-base font-semibold hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-50';
const primary = 'min-h-11 rounded-lg bg-accent px-5 text-base font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50';

export function PlayerControls({ state, dispatch, speed, onSpeed, showMath, onShowMath }: Props) {
  const { index, total, playing } = state;
  return (
    <div role="group" aria-label="Controles da animação" className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
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
        <label className="ml-auto flex items-center gap-2 text-base">
          Velocidade
          <select
            className="min-h-11 rounded-lg border border-line bg-surface px-2 text-base"
            value={speed}
            onChange={(e) => onSpeed(Number(e.target.value))}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {String(s).replace('.', ',')}x
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-base">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={showMath} onChange={(e) => onShowMath(e.target.checked)} />
            Mostrar explicações matemáticas
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={playing} disabled={index >= total} onChange={(e) => dispatch({ type: e.target.checked ? 'play' : 'pause' })} />
            Execução automática (opcional)
          </label>
        </div>
        <p aria-live="polite" className="text-muted">
          Etapa {index} de {total} · {playing ? 'execução automática (desmarque para retomar o controle)' : 'passo a passo: cada etapa avança só com a sua confirmação'}
        </p>
      </div>
    </div>
  );
}
