import { useCallback, useState } from 'react';

interface IndexState {
  identity: string;
  index: number;
}

/**
 * A page index that returns to 0 whenever `identity` changes (derived-state pattern: the reset happens
 * during render, so the first render for a new list already shows page 0 and no effect loop runs).
 *
 * @example const [pageIndex, setPageIndex] = useResettableIndex(stableKeyOf(filters));
 */
export function useResettableIndex(identity: string): [number, (update: (index: number) => number) => void] {
  const [state, setState] = useState<IndexState>({ identity, index: 0 });
  if (state.identity !== identity) setState({ identity, index: 0 });
  const index = state.identity === identity ? state.index : 0;
  const setIndex = useCallback((update: (index: number) => number) => {
    setState((current) => ({ ...current, index: Math.max(0, update(current.index)) }));
  }, []);
  return [index, setIndex];
}
