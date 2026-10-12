import type { ReactNode } from 'react';

const TOKEN = /([_^])\{([^}]*)\}/g;

/** Converte "K_{A} = B^{a} mod p" em texto simples ("K_A = B^a mod p") para leitores de tela. */
export function plainFormula(tex: string): string {
  return tex.replace(TOKEN, (_m, op: string, body: string) => `${op}${body}`);
}

/** Renderiza fórmulas com subscritos (_{x}) e sobrescritos (^{x}) em fonte monoespaçada. */
export function Formula({ tex, className = '' }: { tex: string; className?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of tex.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(tex.slice(last, idx));
    parts.push(m[1] === '^' ? <sup key={i++}>{m[2]}</sup> : <sub key={i++}>{m[2]}</sub>);
    last = idx + m[0].length;
  }
  if (last < tex.length) parts.push(tex.slice(last));
  return (
    <span role="math" aria-label={plainFormula(tex)} className={`font-mono ${className}`}>
      {parts}
    </span>
  );
}
