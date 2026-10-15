interface Pos {
  row: number;
  col: number;
}

interface Props {
  grid: string;
  /** Letras do digrafo de entrada (destacadas como texto claro). */
  from?: [Pos, Pos] | null;
  /** Letras de saída (destacadas como texto cifrado). */
  to?: [Pos, Pos] | null;
}

const same = (a: Pos, b: Pos) => a.row === b.row && a.col === b.col;

/** Grade 5 x 5 do Playfair: letras de entrada em roxo, letras de saída em laranja, com marcas textuais. */
export function PlayfairGrid({ grid, from = null, to = null }: Props) {
  return (
    <table className="border-separate border-spacing-1 font-mono text-xl" aria-label="Grade 5 por 5 do Playfair">
      <caption className="sr-only">
        Grade do Playfair, linha a linha: {Array.from({ length: 5 }, (_, r) => grid.slice(r * 5, r * 5 + 5)).join(', ')}.
        {from ? ` Digrafo de entrada nas posições ${from.map((p) => `linha ${p.row + 1}, coluna ${p.col + 1}`).join(' e ')}.` : ''}
        {to ? ` Digrafo de saída nas posições ${to.map((p) => `linha ${p.row + 1}, coluna ${p.col + 1}`).join(' e ')}.` : ''}
      </caption>
      <tbody>
        {Array.from({ length: 5 }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: 5 }, (_, c) => {
              const p = { row: r, col: c };
              const isIn = from?.some((x) => same(x, p)) ?? false;
              const isOut = to?.some((x) => same(x, p)) ?? false;
              return (
                <td
                  key={c}
                  className={`h-11 w-11 rounded-lg border-2 text-center ${
                    isIn && isOut ? 'border-accent bg-accent/20 font-bold' : isIn ? 'border-k-plain bg-k-plain/20 font-bold' : isOut ? 'border-k-cipher bg-k-cipher/20 font-bold' : 'border-line'
                  }`}
                >
                  {grid[r * 5 + c]}
                  {isIn && <span className="sr-only"> (entrada)</span>}
                  {isOut && <span className="sr-only"> (saída)</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
