import type { BlockStatus } from './run';

const hue = (hex: string) => parseInt(hex.slice(0, 4), 16) % 360;

interface RowProps {
  label: string;
  blocks: string[] | null;
  status?: BlockStatus[];
  /** Mostra os 4 primeiros bytes em ASCII quando legíveis (texto claro). */
  ascii?: boolean;
}

const asciiOf = (hex: string) =>
  (hex.match(/../g) ?? [])
    .slice(0, 6)
    .map((h) => parseInt(h, 16))
    .map((c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : '·'))
    .join('');

function Row({ label, blocks, status, ascii }: RowProps) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1 text-base font-semibold">{label}</p>
      {blocks ? (
        <ul className="flex flex-wrap gap-2">
          {blocks.map((b, i) => {
            const st = status?.[i];
            const bad = st === 'corrompido' || st === 'rejeitado';
            return (
              <li
                key={i}
                style={{ backgroundColor: `hsl(${hue(b)} 70% 50% / 0.22)`, borderColor: `hsl(${hue(b)} 70% 45%)` }}
                className={`w-32 rounded-lg border-2 px-2 py-1 font-mono text-base ${bad ? 'border-dashed' : ''}`}
              >
                <span className="block font-sans text-base font-semibold">Bloco {i + 1}</span>
                <span className="block">{b.slice(0, 8)}…</span>
                {ascii && <span className="block truncate text-muted">{asciiOf(b)}</span>}
                {st && (
                  <span className={`block font-sans text-base font-semibold ${st === 'intacto' ? 'text-k-secret' : st === 'um bit alterado' ? 'text-k-cipher' : 'text-danger'}`}>
                    {st}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border-2 border-dashed border-danger p-2 text-base font-semibold text-danger">Nenhum texto entregue: mensagem rejeitada.</p>
      )}
    </div>
  );
}

/** Blocos coloridos pelo conteúdo: blocos iguais têm a mesma cor e o mesmo valor, o que evidencia vazamento de padrões. */
export function BlockViz({ plain, sent, received, recovered, status, tampered }: { plain: string[]; sent: string[]; received: string[]; recovered: string[] | null; status: BlockStatus[]; tampered: boolean }) {
  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <Row label="Texto claro de Alice (blocos de 16 bytes)" blocks={plain} ascii />
      <Row label="Cifra enviada por Alice" blocks={sent} />
      {tampered && <Row label="Cifra recebida por Bob (alterada por Eva)" blocks={received} />}
      <Row label="Resultado da decifragem por Bob" blocks={recovered} status={status} ascii />
      <p className="text-base text-muted">A cor e o valor de cada bloco vêm do seu conteúdo: blocos idênticos aparecem com a mesma cor e o mesmo valor.</p>
    </div>
  );
}
