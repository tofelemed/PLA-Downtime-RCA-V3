import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { failedLineChoices } from '../model/failed-lines';

export interface RejectDialogProps {
  view: ReconciliationView;
  disabled?: boolean;
  /** resolves when the rejection succeeded (closes the dialog); rejects to keep it open */
  onConfirm: (reason: string, failedLines: string[]) => Promise<unknown>;
  children?: ReactNode;
}

/**
 * Return a submitted revision to its preparer (SME R6): an actionable reason and, optionally, the lines that
 * failed. The server sets the new due time and escalates the configured n-th rejection.
 */
export function RejectDialog({ view, disabled, onConfirm, children }: RejectDialogProps) {
  const [reason, setReason] = useState('');
  const [failed, setFailed] = useState<string[]>([]);
  const id = useId();
  const choices = failedLineChoices(view);
  const toggle = (ref: string) => setFailed((current) => (current.includes(ref) ? current.filter((r) => r !== ref) : [...current, ref]));
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" data-testid="wf-reject" disabled={disabled}>
          Reject…
        </Button>
      }
      title="Return this revision to its preparer?"
      description="The revision goes back to draft; the preparer sees your reason and the failed lines, with a new due time for the corrected submission."
      confirmLabel="Return revision"
      destructive
      confirmDisabled={!reason.trim()}
      onConfirm={() =>
        onConfirm(reason.trim(), failed).then(() => {
          setReason('');
          setFailed([]);
        })
      }
    >
      <div className="space-y-1">
        <Label htmlFor={id}>What has to change (required)</Label>
        <Textarea id={id} rows={3} data-testid="wf-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {choices.length > 0 && (
        <fieldset className="max-h-40 space-y-1 overflow-y-auto" data-testid="wf-failed-lines">
          <legend className="text-sm font-medium">Failed lines (optional)</legend>
          {choices.map((choice) => (
            <label key={choice.ref} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={failed.includes(choice.ref)} onChange={() => toggle(choice.ref)} data-testid="wf-failed-line" data-ref={choice.ref} />
              {choice.label}
            </label>
          ))}
        </fieldset>
      )}
      {children}
    </ConfirmDialog>
  );
}
