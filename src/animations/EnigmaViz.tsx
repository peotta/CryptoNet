import { KEYBOARD_ROWS, PATH_STAGES, type EnigmaConfig, type KeyTrace } from '../crypto/enigma';

interface Props {
  config: EnigmaConfig;
  /** Tecla atual; nulo antes da primeira tecla. */
  trace: KeyTrace | null;
}

const ROTOR_LABELS = ['Esquerdo', 'Meio', 'Direito'] as const;

/** Janela de um rotor: nome, letra visível e marca de avanço. */
function RotorWindow({ label, name, letter, previous, stepped }: { label: string; name: string; letter: string; previous: string; stepped: boolean }) {
  return (
    <div className={`min-w-28 rounded-xl border-2 p-3 text-center ${stepped ? 'border-accent bg-accent/10' : 'border-line bg-surface'}`}>
      <p className="text-base font-semibold">
        {label}: rotor {name}
      </p>
      <p className="font-mono text-4xl font-bold" aria-label={`janela mostra ${letter}`}>
        {letter}
      </p>
      <p className="text-base text-muted">
        {stepped ? `avançou de ${previous} para ${letter}` : 'não avançou'}
      </p>
    </div>
  );
}

function Board({ title, lit, tone }: { title: string; lit: string | null; tone: 'plain' | 'cipher' }) {
  return (
    <div className="space-y-1">
      <p className="text-base font-semibold">{title}</p>
      <div className="space-y-1" role="group" aria-label={title}>
        {KEYBOARD_ROWS.map((row, r) => (
          <div key={r} className="flex justify-center gap-1" style={{ paddingLeft: r === 1 ? '1rem' : r === 2 ? '0.4rem' : 0 }}>
            {[...row].map((ch) => {
              const on = lit === ch;
              return (
                <span
                  key={ch}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-lg ${
                    on ? (tone === 'plain' ? 'border-k-plain bg-k-plain/30 font-bold' : 'border-k-cipher bg-k-cipher/30 font-bold') : 'border-line text-muted'
                  }`}
                >
                  {ch}
                  {on && <span className="sr-only"> ({tone === 'plain' ? 'tecla pressionada' : 'lâmpada acesa'})</span>}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Esquema da Enigma: janelas dos rotores, teclado, lâmpadas e o caminho do sinal em dez estágios. */
export function EnigmaViz({ config, trace }: Props) {
  const before = trace?.before ?? config.positions;
  const after = trace?.after ?? config.positions;
  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-stretch gap-3">
        {ROTOR_LABELS.map((label, i) => (
          <RotorWindow key={label} label={label} name={config.rotors[i]} letter={after[i]} previous={before[i]} stepped={trace?.stepped[i] ?? false} />
        ))}
        <div className="rounded-xl border-2 border-line p-3 text-center">
          <p className="text-base font-semibold">Refletor {config.reflector}</p>
          <p className="text-base text-muted">devolve o sinal, sem nunca ligar uma letra a ela mesma</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Board title="Teclado" lit={trace?.input ?? null} tone="plain" />
        <Board title="Lâmpadas" lit={trace?.output ?? null} tone="cipher" />
      </div>

      {trace ? (
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3" aria-label={`Caminho do sinal da tecla ${trace.input}`}>
          {PATH_STAGES.map((stage, i) => {
            const back = i >= 6 && i < 9;
            const tone = i === 0 ? 'border-k-plain' : i === 5 ? 'border-accent' : i === 9 ? 'border-k-cipher' : back ? 'border-k-cipher/60' : 'border-k-public';
            return (
              <li key={stage} className="flex items-center gap-2">
                <div className={`min-w-24 rounded-lg border-2 px-2 py-1 text-center ${tone}`}>
                  <p className="text-base leading-tight">{stage}</p>
                  <p className="font-mono text-2xl font-bold">{trace.path[i]}</p>
                </div>
                {i < PATH_STAGES.length - 1 && (
                  <span aria-hidden="true" className="text-xl text-muted">
                    {i === 4 ? '⤵' : '→'}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-base text-muted">Pressione uma tecla (botão "Cifrar tecla a tecla") para ver o sinal atravessar os plugues, os três rotores, o refletor e voltar.</p>
      )}
    </div>
  );
}
