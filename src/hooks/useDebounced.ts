import { useEffect, useState } from 'react';

/** Devolve o valor somente depois de ele ficar parado por `ms`; o primeiro valor é imediato. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
