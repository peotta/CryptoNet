const CHUNK = 40;

/** Compara o texto deduzido por Eva com o texto real, em blocos; letras erradas ficam sublinhadas e em destaque. */
export function TextDiff({ guess, truth, label }: { guess: string; truth: string; label: string }) {
  const rows = Math.ceil(truth.length / CHUNK);
  const wrong = [...truth].filter((ch, i) => guess[i] !== ch).length;
  return (
    <div className="space-y-1">
      <p className="text-base font-semibold">
        {label}: {wrong} {wrong === 1 ? 'letra errada' : 'letras erradas'} de {truth.length}
      </p>
      <div className="max-h-64 overflow-auto rounded-lg border border-line bg-surface p-3 font-mono text-base leading-7" role="group" aria-label={`${label}, comparação com o texto real`}>
        {Array.from({ length: rows }, (_, r) => {
          const from = r * CHUNK;
          const t = truth.slice(from, from + CHUNK);
          const g = guess.slice(from, from + CHUNK);
          return (
            <div key={r} className="mb-1">
              <div className="text-muted">
                <span className="mr-2 inline-block w-14 font-sans">real</span>
                {t}
              </div>
              <div>
                <span className="mr-2 inline-block w-14 font-sans text-muted">Eva</span>
                {[...g].map((ch, i) => (
                  <span key={i} className={ch === t[i] ? '' : 'font-bold text-danger underline decoration-2'}>
                    {ch}
                    {ch !== t[i] && <span className="sr-only"> (errada)</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
