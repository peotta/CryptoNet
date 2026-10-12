import { useEffect, useReducer, useState } from 'react';
import { initialPlayer, playerReducer } from '../simulation/player';

/** Tempo de permanência em cada etapa na execução automática, na velocidade 1x. */
export const BASE_STEP_MS = 4200;

/**
 * Único ponto do sistema que usa temporizador: agenda UM avanço por vez, dependente do
 * índice atual, e o cancela a cada mudança de estado (nada de temporizadores dispersos).
 */
export function useStepPlayer(total: number, speed: number, resetKey: string) {
  const [state, dispatch] = useReducer(playerReducer, total, initialPlayer);

  // Reinicia quando o protocolo ou os parâmetros mudam (nunca na montagem). O reinício ocorre durante
  // a própria renderização, e não em um efeito: assim o total correto já vale no primeiro quadro exibido
  // e nenhuma interação do estudante é perdida entre a renderização e a execução do efeito.
  const key = `${total}|${resetKey}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    dispatch({ type: 'setTotal', total });
  }

  useEffect(() => {
    if (!state.playing) return;
    const id = window.setTimeout(() => dispatch({ type: 'tick' }), BASE_STEP_MS / speed);
    return () => window.clearTimeout(id);
  }, [state.playing, state.index, speed]);

  return { state, dispatch };
}
