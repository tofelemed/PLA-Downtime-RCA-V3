import { useRef, type RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusIcon } from '@/lib/icons';
import { saveResultActions, type SaveAction, type SaveResult } from './save-result';

export interface SaveResultDialogProps {
  /** what was saved; null = closed */
  result: SaveResult | null;
  /** the dialog closed: after any action, and after a dismissal (which also runs `result.onDismiss`) */
  onClose: () => void;
}

interface ActionButtonProps {
  action: SaveAction;
  onClose: () => void;
  primaryRef: RefObject<HTMLButtonElement>;
}

function ActionButton({ action, onClose, primaryRef }: ActionButtonProps) {
  const choose = () => {
    action.onSelect?.();
    onClose();
  };
  const common = {
    variant: action.primary ? ('default' as const) : ('outline' as const),
    ref: action.primary ? primaryRef : undefined,
    'data-action': action.id,
  };
  if (!action.path) {
    return <Button type="button" {...common} onClick={choose}>{action.label}</Button>;
  }
  return (
    <Button asChild {...common}>
      <Link to={action.path} onClick={choose}>{action.label}</Link>
    </Button>
  );
}

/**
 * The success dialog of a create, new version or import (DECISIONS 2026-10-22): title, record name, one
 * line of what happened, and View · Add another · Back to list · Next ("Back to …" only when the list is not
 * the page already shown). Focus starts on the primary action;
 * Esc, the close button or the overlay keep the user where they are (`onDismiss`). Usually rendered by
 * `useSaveResult` / `useSaveFeedback` rather than directly.
 *
 * @example
 * <SaveResultDialog result={{ title: 'Unit created', recordLabel: 'Extruder 3 (EXT-3)', viewPath: '/master-data/units/u1',
 *   viewLabel: 'View unit', listPath: '/master-data/units', listLabel: 'Production units',
 *   next: nextSetupLink('/master-data/units') }} onClose={() => setResult(null)} />
 */
export function SaveResultDialog({ result, onClose }: SaveResultDialogProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const dismiss = () => {
    result?.onDismiss?.();
    onClose();
  };
  const described = Boolean(result?.recordLabel || result?.message);
  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && dismiss()}>
      {result && (
        <DialogContent
          data-testid="save-result-dialog"
          onOpenAutoFocus={(event) => {
            if (!primaryRef.current) return;
            event.preventDefault();
            primaryRef.current.focus();
          }}
          {...(described ? {} : { 'aria-describedby': undefined })}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StatusIcon.success className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              {result.title}
            </DialogTitle>
            {described && (
              <DialogDescription asChild>
                <div className="space-y-1">
                  {result.recordLabel && <p className="font-medium text-foreground">{result.recordLabel}</p>}
                  {result.message && <p>{result.message}</p>}
                </div>
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-2 sm:space-x-0">
            {saveResultActions(result, `${location.pathname}${location.search}`).map((action) => (
              <ActionButton key={action.id} action={action} onClose={onClose} primaryRef={primaryRef} />
            ))}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
