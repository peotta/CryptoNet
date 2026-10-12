import type { ReactElement } from 'react';
import type { ItemKind } from '../simulation/types';

interface KindMeta {
  label: string;
  text: string;
  border: string;
  soft: string;
}

// Classes escritas por extenso para o Tailwind detectá-las em tempo de build.
export const KIND_META: Record<ItemKind, KindMeta> = {
  param: { label: 'Parâmetro público', text: 'text-k-param', border: 'border-k-param', soft: 'bg-k-param/10' },
  public: { label: 'Valor ou chave pública', text: 'text-k-public', border: 'border-k-public', soft: 'bg-k-public/10' },
  private: { label: 'Valor ou chave privada', text: 'text-k-private', border: 'border-k-private', soft: 'bg-k-private/10' },
  secret: { label: 'Segredo compartilhado', text: 'text-k-secret', border: 'border-k-secret', soft: 'bg-k-secret/10' },
  plain: { label: 'Texto claro', text: 'text-k-plain', border: 'border-k-plain', soft: 'bg-k-plain/10' },
  cipher: { label: 'Texto cifrado', text: 'text-k-cipher', border: 'border-k-cipher', soft: 'bg-k-cipher/10' },
  signature: { label: 'Assinatura', text: 'text-k-signature', border: 'border-k-signature', soft: 'bg-k-signature/10' },
};

const PATHS: Record<ItemKind, ReactElement> = {
  // chave vazada (pública)
  public: (
    <>
      <circle cx="8" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 12h9M18 12v4M21 12v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  // chave preenchida (privada)
  private: (
    <>
      <circle cx="8" cy="12" r="4.5" fill="currentColor" />
      <path d="M12 12h9M18 12v4M21 12v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  // escudo (segredo compartilhado)
  secret: <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" fill="currentColor" />,
  // documento (texto claro)
  plain: (
    <>
      <path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // cadeado (cifra)
  cipher: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
      <path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  // caneta (assinatura)
  signature: (
    <>
      <path d="M4 20l1-4L16 5l3 3L8 19z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M13 20h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // marcador de parâmetro
  param: <path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />,
};

/** Ícone por tipo de item. Cor e forma distintas: a informação não depende só da cor. */
export function KindIcon({ kind, size = 22, className = '' }: { kind: ItemKind; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`${KIND_META[kind].text} shrink-0 ${className}`}>
      {PATHS[kind]}
    </svg>
  );
}

export function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="shrink-0">
      <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
      <path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
