import { useEffect, useRef } from 'react';

/** What an inline decision form reports once the server confirmed the decision (toast title). */
export type OnDecided = (label: string) => void;

/**
 * For workspace components reused inline that do not report success themselves: fires `onDecided` once
 * when the record, seen pending on this page, is no longer pending in the refreshed read. A record that was
 * already decided when the page opened never fires (the page shows "No longer pending" instead).
 */
export function useDecidedWhen(pending: boolean | undefined, label: string, onDecided: OnDecided): void {
  const seenPending = useRef(false);
  const fired = useRef(false);
  useEffect(() => {
    if (pending === true) seenPending.current = true;
    if (pending !== false || !seenPending.current || fired.current) return;
    fired.current = true;
    onDecided(label);
  }, [pending, label, onDecided]);
}
