import { useEffect, useReducer } from 'react';
import { initialPlayer, playerReducer } from '../simulation/player';

/** Tempo de permanência em cada etapa na execução automática, na velocidade 1x. */
export const BASE_STEP_MS = 4200;

/**
 * Único ponto do sistema que usa temporizador: agenda UM avanço por vez, dependente do
 * índice atual, e o cancela a cada mudança de estado (nada de temporizadores dispersos).
 */
export function useStepPlayer(total: number, speed: number, resetKey: string) {
  const [state, dispatch] = useReducer(playerReducer, total, initialPlayer);

  useEffect(() => {
    dispatch({ type: 'setTotal', total });
  }, [total, resetKey]);

  useEffect(() => {
    if (!state.playing) return;
    const id = window.setTimeout(() => dispatch({ type: 'tick' }), BASE_STEP_MS / speed);
    return () => window.clearTimeout(id);
  }, [state.playing, state.index, speed]);

  return { state, dispatch };
}
