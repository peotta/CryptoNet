import { useEffect } from 'react';

const BASE = 'CryptoNet Lab';

/** Atualiza o título da aba a cada página (a aplicação é de página única e o título estático seria o mesmo em todas). */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE}` : BASE;
  }, [title]);
}
