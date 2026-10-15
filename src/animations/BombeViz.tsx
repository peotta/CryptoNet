import type { MenuEdge } from '../crypto/bombe';

interface Props {
  edges: MenuEdge[];
  /** Letra de teste (destacada). */
  test: string;
  /** Letras com plugue já deduzido na propagação atual (destacadas). */
  known?: string[];
}

const SIZE = 320;
const C = SIZE / 2;
const R = 118;

/** O menu como grafo: letras em círculo, uma aresta por tecla do texto provável, rotulada com o número da tecla. */
export function MenuGraph({ edges, test, known = [] }: Props) {
  const letters = [...new Set(edges.flatMap((e) => [e.plain, e.cipher]))].sort();
  const pos = new Map(letters.map((l, i) => {
    const a = (2 * Math.PI * i) / letters.length - Math.PI / 2;
    return [l, { x: C + R * Math.cos(a), y: C + R * Math.sin(a) }] as const;
  }));
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Menu da Bombe com ${letters.length} letras e ${edges.length} ligações (uma por tecla do texto provável). A letra de teste é ${test}.`} className="mx-auto w-full max-w-sm rounded-xl border border-line bg-surface">
      {edges.map((e, i) => {
        const a = pos.get(e.plain)!;
        const b = pos.get(e.cipher)!;
        // desloca levemente os rótulos de arestas paralelas
        const dup = edges.slice(0, i).filter((o) => (o.plain === e.plain && o.cipher === e.cipher) || (o.plain === e.cipher && o.cipher === e.plain)).length;
        const mx = (a.x + b.x) / 2 + dup * 10;
        const my = (a.y + b.y) / 2 + dup * 10;
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-current text-muted" strokeWidth={1.5} />
            <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" className="fill-current text-[10px] text-k-cipher" stroke="var(--surface, #fff)" strokeWidth={3} paintOrder="stroke">
              {e.step}
            </text>
          </g>
        );
      })}
      {letters.map((l) => {
        const p = pos.get(l)!;
        const isTest = l === test;
        const isKnown = known.includes(l);
        return (
          <g key={l}>
            <circle cx={p.x} cy={p.y} r={14} className={`${isTest ? 'fill-accent' : isKnown ? 'fill-k-secret/30' : 'fill-surface2'} stroke-current text-ink`} strokeWidth={isTest ? 3 : 1.5} />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" className={`font-mono text-[14px] font-bold ${isTest ? 'fill-accent-ink' : 'fill-current text-ink'}`}>
              {l}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
