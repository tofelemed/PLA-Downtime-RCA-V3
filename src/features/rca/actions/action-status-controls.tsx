import { useEffect, useRef, useState } from 'react';
import { useUpdateRcaAction, useVerifyRcaAction } from '@/api/v2/queries/rca-commands';
import type { RcaActionView } from '@/api/v2/types/rca';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FormField } from '@/features/ux-kit/form-field';
import { RCA_ACTION_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { RcaErrorAlert } from '../components/rca-error-alert';
import { ACTION_STATUSES, asActionStatus, type ActionStatus } from '../model/action-queue-filters';
import { statusChoices } from '../model/action-access';
import { verificationLabel } from '../model/rca-labels';
import { useActionAccess } from './use-action-access';
import { useCanWriteRca } from './use-can-write-rca';

export const CANCEL_REASON_MAX = 2000;

interface CancelDialogProps {
  action: RcaActionView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<unknown>;
  error: unknown;
}

/** F-9: cancelling asks why (required here, sent as `cancelReason`; the server records who and when). */
function CancelActionDialog({ action, open, onOpenChange, onConfirm, error }: CancelDialogProps) {
  const [reason, setReason] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const id = `cancel-reason-${action.id}`;
  const trimmed = reason.trim();
  useEffect(() => {
    if (!open) return undefined;
    // after the alert dialog's own focus move (to Cancel): the reason is the first thing to fill in
    const timer = window.setTimeout(() => field.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
      title={`Cancel "${action.title}"?`}
      description="It counts as finished for closure and leaves the effectiveness verdict; set it back to open to resume it."
      confirmLabel="Cancel action"
      cancelLabel="Keep action"
      destructive
      confirmDisabled={trimmed === ''}
      confirmDisabledReason="Say why the action is cancelled."
      onConfirm={() => onConfirm(trimmed)}
    >
      <FormField id={id} label="Reason for cancelling" required hint="Kept with the action, with who cancelled it and when.">
        <Textarea ref={field} id={id} rows={3} value={reason} maxLength={CANCEL_REASON_MAX} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      {error ? <RcaErrorAlert error={error} /> : null}
    </ConfirmDialog>
  );
}

/**
 * Status select (cancel asks for a reason first), verification badge and "Verify now" of one action. The
 * owner who is not an RCA writer moves it between open and in progress only (the server checks it).
 */
export function ActionStatusControls({ action }: { action: RcaActionView }) {
  const canWriteRca = useCanWriteRca();
  const access = useActionAccess(action);
  const update = useUpdateRcaAction();
  const verify = useVerifyRcaAction();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const submit = (status: ActionStatus) => void update.submit({ action, body: { status } }).catch(() => null);
  const setStatus = (status: ActionStatus) => (status === 'cancelled' ? setConfirmCancel(true) : submit(status));
  const cancel = (cancelReason: string) => update.submit({ action, body: { status: 'cancelled', cancelReason } });
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label={`Status of ${action.title}`}
          value={action.status}
          disabled={!access.canWork && !canWriteRca}
          onChange={(e) => setStatus(asActionStatus(e.target.value) ?? 'open')}
        >
          {statusChoices(ACTION_STATUSES, access, action.status).map((status) => (
            <option key={status} value={status}>
              {RCA_ACTION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <Badge variant="outline" className="whitespace-nowrap font-normal" data-testid="verification-status">
          {verificationLabel(action)}
        </Badge>
        {action.verificationStatus === 'due' && canWriteRca && (
          <Button size="sm" disabled={verify.isPending} onClick={() => void verify.submit(action).catch(() => null)} data-testid="verify-action">
            Verify now
          </Button>
        )}
      </div>
      {update.error || verify.error ? <RcaErrorAlert error={update.error ?? verify.error} /> : null}
      <CancelActionDialog action={action} open={confirmCancel} onOpenChange={setConfirmCancel} onConfirm={cancel} error={update.error} />
    </div>
  );
}
