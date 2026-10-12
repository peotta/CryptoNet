import { motion, useReducedMotion } from 'motion/react';
import type { Message, PartyDef } from '../simulation/types';
import { Formula } from './Formula';
import { KIND_META, KindIcon } from './kinds';
import { motionDuration } from './motion';

const X: Record<PartyDef['position'], number> = { left: 0, center: 50, right: 100 };
const LANE_HEIGHT = 64;

interface Props {
  parties: PartyDef[];
  messages: Message[];
  /** Muda a cada etapa para reiniciar as animações das mensagens. */
  stepKey: string;
  speed: number;
}

/** Canal de rede público. Cada mensagem em trânsito percorre a trilha da origem ao destino. */
export function Channel({ parties, messages, stepKey, speed }: Props) {
  const reduced = useReducedMotion() ?? false;
  const pos = (id: string) => X[parties.find((p) => p.id === id)?.position ?? 'center'];
  const lanes = Math.max(messages.length, 1);
  const name = (id: string) => parties.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="rounded-xl border border-line bg-surface2 p-3">
      <p className="mb-1 text-center text-base font-semibold">Canal público (inseguro)</p>
      <p className="mb-2 text-center text-base text-muted">Qualquer nó do caminho pode ler o que passa por aqui.</p>
      <div className="relative mx-14" style={{ height: lanes * LANE_HEIGHT }}>
        {Array.from({ length: lanes }, (_, i) => (
          <div key={i} aria-hidden="true" className="absolute left-0 right-0 border-t-2 border-dashed border-line" style={{ top: i * LANE_HEIGHT + LANE_HEIGHT / 2 }} />
        ))}
        {messages.map((m, i) => {
          const meta = KIND_META[m.kind];
          const from = pos(m.from);
          const to = pos(m.to);
          return (
            <motion.div
              key={`${stepKey}-${m.id}`}
              data-testid="transit-message"
              initial={{ left: `${from}%`, opacity: 0.2 }}
              animate={{ left: `${to}%`, opacity: 1 }}
              transition={{ duration: motionDuration(1.6, speed, reduced), ease: 'easeInOut' }}
              style={{ top: i * LANE_HEIGHT + 4, x: '-50%' }}
              className={`absolute flex max-w-[14rem] items-center gap-2 rounded-lg border-2 bg-surface px-2 py-1 ${
                m.tampered ? 'border-dashed border-danger' : meta.border
              }`}
              title={m.summary}
            >
              <KindIcon kind={m.kind} size={20} />
              <span className="min-w-0 text-base leading-tight">
                <Formula tex={m.label} className="font-semibold" />
                <span className="block truncate font-mono text-base">{m.summary}</span>
                {m.tampered && <span className="block text-base font-semibold text-danger">adulterada</span>}
              </span>
            </motion.div>
          );
        })}
        {messages.length === 0 && <p className="absolute inset-x-0 top-5 text-center text-base text-muted">Nenhuma mensagem em trânsito nesta etapa.</p>}
      </div>
      <p className="sr-only" aria-live="polite">
        {messages.length === 0
          ? 'Nenhuma mensagem em trânsito.'
          : messages.map((m) => `${name(m.from)} envia ${m.label.replace(/[_^{}]/g, '')} para ${name(m.to)}.`).join(' ')}
      </p>
    </div>
  );
}
