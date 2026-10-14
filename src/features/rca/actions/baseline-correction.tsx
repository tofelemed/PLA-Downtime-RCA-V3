import { useState } from 'react';
import { useDecideBaselineCorrection, useProposeBaselineCorrection } from '@/api/v2/queries/rca-commands';
import type { RcaActionView } from '@/api/v2/types/rca';
import type { RcaActionBaseline, RcaBaselineCorrection } from '@/api/v2/types/rca-workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_CORRECTION_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { RcaErrorAlert } from '../components/rca-error-alert';
import { useRcaApprover } from '../use-rca-approver';

const MIN_REASON = 10;

function CorrectionState({ correction }: { correction: RcaBaselineCorrection }) {
  const users = useUserNames();
  return (
    <p className="text-xs" data-testid="baseline-correction">
      Correction to {correction.value} ({labelOf(RCA_CORRECTION_STATUS_LABELS, correction.status).toLowerCase()}): {correction.reason}
      {correction.proposedBy ? ` · proposed by ${users.nameOf(correction.proposedBy)}` : ''}
      {correction.decidedBy ? ` · decided by ${users.nameOf(correction.decidedBy)}` : ''}
      {correction.note ? ` · ${correction.note}` : ''}
    </p>
  );
}

function ProposeForm({ action }: { action: RcaActionView }) {
  const propose = useProposeBaselineCorrection();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const ready = value.trim() !== '' && reason.trim().length >= MIN_REASON && !propose.isPending;
  const submit = () => void propose.submit({ action, body: { value: value.trim(), reason: reason.trim() } }).catch(() => null);
  const prefix = `correction-${action.id}`;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground">Propose a correction of the baseline</summary>
      <div className="mt-2 grid gap-2 md:grid-cols-[10rem_1fr_auto] md:items-end">
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-value`}>Corrected value</Label>
          <Input id={`${prefix}-value`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-reason`}>Reason (at least {MIN_REASON} characters)</Label>
          <Input id={`${prefix}-reason`} value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button size="sm" disabled={!ready} onClick={submit} data-testid="propose-correction">
          Propose
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Another person (a manager approver) approves it before it counts.</p>
      {propose.error ? <RcaErrorAlert error={propose.error} /> : null}
    </details>
  );
}

function DecideButtons({ action }: { action: RcaActionView }) {
  const decide = useDecideBaselineCorrection();
  const [note, setNote] = useState('');
  const run = (approve: boolean) => void decide.submit({ action, body: { approve, ...(note.trim() ? { note: note.trim() } : {}) } }).catch(() => null);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`decision-${action.id}`}>Decision note (optional)</Label>
          <Input id={`decision-${action.id}`} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button size="sm" disabled={decide.isPending} onClick={() => run(true)} data-testid="approve-correction">
          Approve correction
        </Button>
        <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => run(false)} data-testid="reject-correction">
          Reject correction
        </Button>
      </div>
      {decide.error ? <RcaErrorAlert error={decide.error} /> : null}
    </div>
  );
}

/** CA3: the counted baseline is corrected only by a proposal (with a reason) that someone else approves. */
export function BaselineCorrection({ action, baseline }: { action: RcaActionView; baseline: RcaActionBaseline }) {
  const { canWriteRca } = useCapabilities();
  const approver = useRcaApprover();
  const { session } = useAuth();
  const correction = baseline.correction ?? null;
  const pending = correction?.status === 'pending';
  const canDecide = pending && approver && correction?.proposedBy !== session?.user.id;
  return (
    <div className="space-y-1">
      {correction && <CorrectionState correction={correction} />}
      {canDecide && <DecideButtons action={action} />}
      {canWriteRca && !pending && !baseline.declared && <ProposeForm action={action} />}
    </div>
  );
}
