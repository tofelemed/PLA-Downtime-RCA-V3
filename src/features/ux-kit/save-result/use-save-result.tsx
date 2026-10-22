import { useCallback, useState, type ReactNode } from 'react';
import type { SaveResult } from './save-result';
import { SaveResultDialog } from './save-result-dialog';

export interface SaveResultHandle {
  /** shows the dialog for a successful save */
  open: (result: SaveResult) => void;
  close: () => void;
  isOpen: boolean;
  /** the dialog; render it once anywhere in the component (it portals) */
  element: ReactNode;
}

/**
 * State of one `SaveResultDialog`.
 *
 * @example
 * const saved = useSaveResult();
 * const created = await create.submit(body);
 * saved.open({ title: 'Unit created', recordLabel: created.name, listPath: '/master-data/units', listLabel: 'Production units' });
 * return <>{form}{saved.element}</>;
 */
export function useSaveResult(): SaveResultHandle {
  const [result, setResult] = useState<SaveResult | null>(null);
  const open = useCallback((next: SaveResult) => setResult(next), []);
  const close = useCallback(() => setResult(null), []);
  return { open, close, isOpen: result !== null, element: <SaveResultDialog result={result} onClose={close} /> };
}
