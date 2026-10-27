import type { CSSProperties } from 'react';

/** Matizes bem separados; letras diferentes podem repartir a mesma cor, o par entrada/saída continua visível. */
const HUES = [215, 25, 150, 320, 50, 270, 185, 0];

/** Define `--lc-h` para as classes `lc-text` e `lc-fill` (index.css), que ajustam o brilho ao tema claro ou escuro. */
export const letterColorVars = (index: number): CSSProperties => ({ '--lc-h': HUES[index % HUES.length] }) as CSSProperties;
