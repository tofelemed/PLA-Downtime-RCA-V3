import { useCallback, useState, type ReactNode } from 'react';
import { useSaveResult, type SaveResult } from '../save-result';

export interface AddDialogHandle {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
  /**
   * A create saved: closes the form dialog and shows the result dialog, whose "Add another" opens an empty
   * form again (the form is unmounted while closed, so it always starts empty).
   */
  saved: (result: SaveResult) => void;
  /** the result dialog; render it once next to the `AddDialog` (outside it) */
  resultElement: ReactNode;
}

/**
 * State of one header "+ Add …" dialog and the result dialog its create ends in (DECISIONS 2026-10-22).
 *
 * @example
 * const add = useAddDialog();
 * <Button onClick={add.open}>Add …</Button>
 * <AddDialog open={add.isOpen} onOpenChange={add.setOpen} title="Register standby"><Form onSaved={add.saved} /></AddDialog>
 * {add.resultElement}
 */
export function useAddDialog(): AddDialogHandle {
  const [isOpen, setOpen] = useState(false);
  const result = useSaveResult();
  const showResult = result.open;
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const saved = useCallback(
    (next: SaveResult) => {
      setOpen(false);
      showResult({ ...next, onAddAnother: () => { next.onAddAnother?.(); setOpen(true); } });
    },
    [showResult],
  );
  return { isOpen, open, close, setOpen, saved, resultElement: result.element };
}
