interface Props {
  matrix: number[][];
  label: string;
  /** Destaca a linha indicada (para acompanhar a multiplicação). */
  highlightRow?: number | null;
}

/** Matriz entre colchetes, com cada elemento em módulo 26. */
export function MatrixView({ matrix, label, highlightRow = null }: Props) {
  return (
    <table aria-label={label} className="border-separate border-spacing-1 rounded-lg border-x-4 border-line px-1 font-mono text-xl">
      <tbody>
        {matrix.map((row, r) => (
          <tr key={r}>
            {row.map((v, c) => (
              <td key={c} className={`min-w-11 rounded-md border px-2 py-1 text-center ${highlightRow === r ? 'border-accent bg-accent/15 font-bold' : 'border-line'}`}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
