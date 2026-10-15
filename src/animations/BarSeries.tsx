interface Props {
  /** Rótulo de cada barra (por exemplo, o tamanho de chave ou o fator). */
  labels: string[];
  values: number[];
  /** Índices de barras em destaque (preenchidas com a cor de realce e marcadas com ★). */
  highlight?: number[];
  ariaLabel: string;
  formatValue?: (v: number) => string;
  /** Legenda do destaque. */
  highlightLabel?: string;
  valueLabel: string;
  categoryLabel: string;
}

/** Gráfico de barras simples e acessível: o destaque tem cor e marca textual, e há tabela equivalente. */
export function BarSeries({ labels, values, highlight = [], ariaLabel, formatValue = (v) => String(v), highlightLabel, valueLabel, categoryLabel }: Props) {
  const max = Math.max(...values, Number.EPSILON);
  return (
    <figure className="space-y-2">
      <div role="img" aria-label={ariaLabel} className="flex h-44 items-end gap-1 rounded-xl border border-line bg-surface p-3">
        {values.map((v, i) => {
          const on = highlight.includes(i);
          return (
            <div key={labels[i]} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span aria-hidden="true" className="font-mono text-base leading-none">
                {on ? '★' : ''}
              </span>
              <div className={`w-full rounded-t-sm ${on ? 'bg-k-secret' : 'bg-k-public/60'}`} style={{ height: `${(v / max) * 80}%` }} title={`${labels[i]}: ${formatValue(v)}`} />
              <span aria-hidden="true" className="font-mono text-base leading-none">
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>
      {highlightLabel && (
        <figcaption className="text-base">
          <span aria-hidden="true">★ </span>
          {highlightLabel}
        </figcaption>
      )}
      <details>
        <summary className="cursor-pointer text-base font-semibold text-accent">Ver os valores em tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[24rem] text-left font-mono text-base">
            <caption className="sr-only">{ariaLabel}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-1 pr-3 font-sans">{categoryLabel}</th>
                <th scope="col" className="py-1 font-sans">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {values.map((v, i) => (
                <tr key={labels[i]} className={`border-b border-line ${highlight.includes(i) ? 'font-bold' : ''}`}>
                  <th scope="row" className="py-1 pr-3 font-normal">{labels[i]}</th>
                  <td className="py-1">
                    {formatValue(v)}
                    {highlight.includes(i) && ' (destaque)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
