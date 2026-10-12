// Controlador de reprodução: máquina de estados pura (reducer). Um índice k significa
// "k etapas já executadas" (0 = estado inicial, total = protocolo concluído).

export interface PlayerState {
  index: number;
  total: number;
  playing: boolean;
}

export type PlayerAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'tick' }
  | { type: 'reset' }
  | { type: 'goto'; index: number }
  | { type: 'setTotal'; total: number };

export const initialPlayer = (total: number): PlayerState => ({ index: 0, total, playing: false });

const clamp = (i: number, total: number) => Math.max(0, Math.min(total, i));

export function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  switch (a.type) {
    case 'play':
      // Ao concluir, "Iniciar" recomeça do zero.
      return s.index >= s.total ? { ...s, index: s.total > 0 ? 1 : 0, playing: s.total > 0 } : { ...s, index: s.index === 0 ? 1 : s.index, playing: true };
    case 'pause':
      return { ...s, playing: false };
    case 'next': {
      const index = clamp(s.index + 1, s.total);
      return { ...s, index, playing: false };
    }
    case 'prev':
      return { ...s, index: clamp(s.index - 1, s.total), playing: false };
    case 'tick': {
      if (!s.playing) return s;
      const index = clamp(s.index + 1, s.total);
      return { ...s, index, playing: index < s.total };
    }
    case 'reset':
      return { ...s, index: 0, playing: false };
    case 'goto':
      return { ...s, index: clamp(a.index, s.total), playing: false };
    case 'setTotal':
      return { index: 0, total: a.total, playing: false };
  }
}
