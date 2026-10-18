import { useId, useState, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import type { ApprovalAccess } from '@/features/auth/approval-gate';
import { ApproveButton } from '@/features/ux-kit/approve-button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { Quantity } from '@/features/ux-kit/quantity';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ResidualStateBadge } from '../components/residual-state-badge';

export interface ApproveRevisionDialogProps {
  view: ReconciliationView;
  access: ApprovalAccess;
  disabled: boolean;
  describedBy?: string;
  /** resolves when approved (closes the dialog); rejects to keep it open with the problem shown */
  onConfirm: (comment: string | undefined) => Promise<unknown>;
  children?: ReactNode;
}

/** What the approver signs: per slice the server's attributed total and Unaccounted with its state. */
function ApprovalSummary({ view }: { view: ReconciliationView }) {
  return (
    <ul className="space-y-1 text-sm" data-testid="approve-summary">
      {view.slices.map((slice) => (
        <li key={slice.sliceId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Attributed <Quantity value={slice.attributed} uom={slice.uom} />
          </span>
          <span>
            Unaccounted <Quantity value={slice.residual} uom={slice.uom} />
          </span>
          <ResidualStateBadge flags={slice.flags} />
        </li>
      ))}
    </ul>
  );
}

/** Approve of a revision in review behind a confirmation with its summary and an optional comment. */
export function ApproveRevisionDialog({ view, access, disabled, describedBy, onConfirm, children }: ApproveRevisionDialogProps) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const { number } = useNumberFormat();
  const id = useId();
  return (
    <>
      <ApproveButton access={access} size="sm" data-testid="wf-approve" disabled={disabled} onClick={() => setOpen(true)} aria-describedby={describedBy}>
        Approve…
      </ApproveButton>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Approve revision ${number(view.revision.revision)}?`}
        description="The approved figures become the period's figures of record."
        confirmLabel="Approve revision"
        onConfirm={() => onConfirm(comment.trim() || undefined).then(() => setComment(''))}
      >
        <ApprovalSummary view={view} />
        <div className="space-y-1">
          <Label htmlFor={id}>Comment (optional)</Label>
          <Textarea id={id} rows={3} data-testid="wf-approve-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        {children}
      </ConfirmDialog>
    </>
  );
}
