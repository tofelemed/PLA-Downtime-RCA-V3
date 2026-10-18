import { ApprovalDecisionFields } from './approval-decision-fields';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useApprovalDecision } from '@/api/v2/queries/approvals';
import type { ApprovalAction, ApprovalItem } from '@/api/v2/types/approvals';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { ApprovalRecordDetails } from './approval-record-details';
import { approvalRecordChanged, useApprovalRecord } from './use-approval-record';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { ACTION_LABELS, needsReason } from './approval-command';

export function ApprovalDecisionDialog({ item, action }: { item: ApprovalItem; action: ApprovalAction }) {
  const [open, setOpen] = useState(false);
  const record = useApprovalRecord(item, open);
  const [reason, setReason] = useState('');
  const [supersede, setSupersede] = useState(false);
  const command = useApprovalDecision();
  const changed = approvalRecordChanged(item, record.data);
  const reasonRequired = needsReason(action) || item.resource === 'rules';
  const label = ACTION_LABELS[action];
  const canConfirm = !decisionBlocked({ reasonRequired, reason, changed, waiting: record.supported && !record.isSuccess });
  return (
    <ConfirmDialog title={`${label}: ${item.title}`} confirmLabel={label} destructive={['retire', 'reject', 'return'].includes(action)}
      trigger={<Button size="sm" variant={action === 'approve' || action === 'activate' ? 'default' : 'outline'}>{label}</Button>}
      description={action === 'retire' ? 'Retiring removes this draft from future use and keeps its history. It cannot be undone.' : 'Review the record and its effective dates before deciding. Existing approval and data checks still apply.'}
      busy={command.isPending} confirmDisabled={!canConfirm}
      onOpenChange={(next) => { setOpen(next); if (next) { command.reset(); setReason(''); setSupersede(false); } }}
      onConfirm={() => command.submit({ item, action, reason, supersede })}>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto px-1">
      <p className="break-words text-sm">{item.kindLabel} · {item.unitName ?? 'Plant-wide'} · {item.state}{item.version != null ? ` · version ${item.version}` : ''}</p>
      <p className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.summary}</p>
      <ApprovalRecordDetails record={record} />
      {changed && <p role="alert" className="text-sm text-destructive">This record changed. Close this dialog and refresh the inbox before deciding.</p>}
      <Link className="text-sm underline" to={item.reviewHref}>Open workspace</Link>
      <ApprovalDecisionFields item={item} action={action} reason={reason} supersede={supersede} setReason={setReason} setSupersede={setSupersede} />
      {command.isError && <FriendlyErrorAlert error={command.error} title="Decision could not be saved" />}
      </div>
    </ConfirmDialog>
  );
}

function decisionBlocked(input: { reasonRequired: boolean; reason: string; changed: boolean; waiting: boolean }): boolean {
  return input.changed || input.waiting || (input.reasonRequired && !input.reason.trim());
}
