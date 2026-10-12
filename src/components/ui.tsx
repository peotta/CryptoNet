import type { ReactNode } from 'react';

type Variant = 'info' | 'warn' | 'danger' | 'ok';
const VARIANTS: Record<Variant, { box: string; title: string }> = {
  info: { box: 'border-k-public bg-k-public/10', title: 'Nota' },
  warn: { box: 'border-k-cipher bg-k-cipher/10', title: 'Atenção' },
  danger: { box: 'border-danger bg-danger/10', title: 'Inseguro' },
  ok: { box: 'border-k-secret bg-k-secret/10', title: 'Correto' },
};

export function Callout({ variant = 'info', title, children }: { variant?: Variant; title?: string; children: ReactNode }) {
  const v = VARIANTS[variant];
  return (
    <div role="note" className={`rounded-xl border-l-4 border-y border-r border-y-line border-r-line p-4 text-base ${v.box}`}>
      <p className="mb-1 font-bold">{title ?? v.title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function LabSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="border-b border-line pb-2 text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

interface FieldProps {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string | null;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
}

export function Field({ id, label, value, onChange, hint, error, inputMode = 'numeric', maxLength }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-semibold">
        {label}
      </label>
      <input
        id={id}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-11 w-full rounded-lg border bg-surface px-3 font-mono text-lg ${error ? 'border-danger' : 'border-line'}`}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-base text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-base font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const buttonClass =
  'min-h-11 rounded-lg border border-line bg-surface px-4 text-base font-semibold hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-50';
export const primaryButtonClass = 'min-h-11 rounded-lg bg-accent px-5 text-base font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50';

export interface ReviewQuestion {
  question: string;
  answer: string;
}

export function ReviewQuestions({ items }: { items: ReviewQuestion[] }) {
  return (
    <ol className="list-decimal space-y-3 pl-6">
      {items.map((q) => (
        <li key={q.question} className="text-lg">
          {q.question}
          <details className="mt-1 text-base">
            <summary className="cursor-pointer font-semibold text-accent">Ver resposta comentada</summary>
            <p className="mt-2 rounded-lg bg-surface2 p-3">{q.answer}</p>
          </details>
        </li>
      ))}
    </ol>
  );
}

export function Tabs<T extends string>({ label, value, onChange, tabs }: { label: string; value: T; onChange: (v: T) => void; tabs: { id: T; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={value === t.id}
          onClick={() => onChange(t.id)}
          className={`min-h-11 rounded-lg border px-4 text-base font-semibold ${
            value === t.id ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface hover:bg-surface2'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
