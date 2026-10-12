import type { Operation } from '../simulation/types';
import { Formula } from './Formula';
import { KIND_META, KindIcon } from './kinds';

/** Operações matemáticas da etapa atual: fórmula, substituição pelos valores e resultado. */
export function MathPanel({ operations }: { operations: Operation[] }) {
  if (operations.length === 0) {
    return <p className="text-base text-muted">Esta etapa não executa cálculos. Avance para ver as operações.</p>;
  }
  return (
    <ul className="space-y-3">
      {operations.map((op) => (
        <li key={op.id} className={`rounded-lg border-l-4 border-y border-r border-y-line border-r-line bg-surface p-3 ${KIND_META[op.kind].border}`}>
          <p className="mb-1 flex items-center gap-2 text-base font-semibold">
            <KindIcon kind={op.kind} size={20} />
            {op.title}
          </p>
          <dl className="space-y-1 text-lg">
            <div className="flex flex-wrap gap-x-3">
              <dt className="text-base text-muted">Fórmula:</dt>
              <dd>
                <Formula tex={op.formula} />
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-3">
              <dt className="text-base text-muted">Substituição:</dt>
              <dd className="break-all">
                <Formula tex={op.substituted} />
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-3">
              <dt className="text-base text-muted">Resultado:</dt>
              <dd className="break-all font-bold">
                <Formula tex={op.result} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
