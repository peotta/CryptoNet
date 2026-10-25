import { curvePoints, samePoint, showPoint, type Curve, type Point } from '../crypto/ecc';

interface Mark {
  point: Point;
  label: string;
  tone: 'p' | 'q' | 'r';
}

interface Props {
  curve: Curve;
  marks?: Mark[];
}

const CELL = 22;
const PAD = 32;
const TONE: Record<Mark['tone'], string> = { p: 'fill-k-public', q: 'fill-k-secret', r: 'fill-accent' };

/** Os pontos da curva sobre o corpo finito Z_p × Z_p, como uma grade. Não há "linhas" contínuas: só pontos isolados. */
export function CurvePlot({ curve, marks = [] }: Props) {
  const p = Number(curve.p);
  const size = PAD + p * CELL + 10;
  const pts = curvePoints(curve).filter((x): x is { x: bigint; y: bigint } => x !== null);
  const px = (v: bigint | number) => PAD + Number(v) * CELL + CELL / 2;
  const py = (v: bigint | number) => 10 + (p - 1 - Number(v)) * CELL + CELL / 2;
  const marked = (pt: { x: bigint; y: bigint }) => marks.some((m) => samePoint(m.point, pt));
  return (
    <svg viewBox={`0 0 ${size} ${size - 4}`} role="img" aria-label={`Pontos da curva ${curve.name}: ${pts.length} pontos finitos mais o ponto no infinito.${marks.length ? ` Em destaque: ${marks.map((m) => `${m.label} = ${showPoint(m.point)}`).join('; ')}.` : ''}`} className="mx-auto w-full max-w-xl rounded-xl border border-line bg-surface">
      {Array.from({ length: p }, (_, i) => (
        <g key={i}>
          <text x={px(i)} y={size - 8} textAnchor="middle" className="fill-current text-[12px] text-muted">
            {i}
          </text>
          <text x={PAD - 6} y={py(i) + 4} textAnchor="end" className="fill-current text-[12px] text-muted">
            {i}
          </text>
          <line x1={px(i)} y1={10} x2={px(i)} y2={10 + p * CELL} className="stroke-current text-line" strokeWidth={0.5} />
          <line x1={PAD} y1={py(i)} x2={PAD + p * CELL} y2={py(i)} className="stroke-current text-line" strokeWidth={0.5} />
        </g>
      ))}
      {pts.map((pt) => (
        <circle key={`${pt.x},${pt.y}`} cx={px(pt.x)} cy={py(pt.y)} r={marked(pt) ? 0 : 4} className="fill-current text-muted" />
      ))}
      {marks.map((m) =>
        m.point === null ? null : (
          <g key={m.label}>
            <circle cx={px(m.point.x)} cy={py(m.point.y)} r={6} className={TONE[m.tone]} />
            <text x={px(m.point.x) + 9} y={py(m.point.y) - 8} className="fill-current text-[15px] font-bold text-ink">
              {m.label}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}
