import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDataHoldCommand } from '@/api/v2/queries/period-sla';
import type { DataHoldKind, PeriodSlaDetailView } from '@/api/v2/types/period-sla';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { HOLD_KIND_LABELS } from '../model/sla-labels';

const KINDS: DataHoldKind[] = ['lab', 'source', 'other'];

/** Open a "waiting for data" hold with its reason (the clocks pause), or release it when the data arrived. */
export function HoldControls({ detail }: { detail: PeriodSlaDetailView }) {
  const command = useDataHoldCommand();
  const [kind, setKind] = useState<DataHoldKind>('lab');
  const [text, setText] = useState('');
  const id = useId();
  const onHold = detail.sla.onHold;
  const problem = command.error ? <FriendlyErrorAlert error={command.error} /> : null;
  const submit = () =>
    command
      .submit(onHold ? { periodId: detail.periodId, open: false, note: text.trim() || undefined } : { periodId: detail.periodId, open: true, kind, reason: text.trim() })
      .then(() => setText(''));
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline" data-testid={onHold ? 'hold-release' : 'hold-open'} disabled={command.isPending}>
          {onHold ? 'Data arrived…' : 'Waiting for data…'}
        </Button>
      }
      title={onHold ? 'The data arrived?' : 'Mark the period as waiting for data?'}
      description={onHold ? 'The deadlines run again from now.' : 'The submission and approval deadlines pause until the data arrives; the reason is shown to reviewers.'}
      confirmLabel={onHold ? 'Release the hold' : 'Start waiting'}
      confirmDisabled={!onHold && !text.trim()}
      onConfirm={submit}
    >
      {!onHold && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Waiting for</legend>
          {KINDS.map((k) => (
            <label key={k} className="mr-3 inline-flex items-center gap-1 text-sm">
              <input type="radio" name={`${id}-kind`} value={k} checked={kind === k} onChange={() => setKind(k)} data-testid={`hold-kind-${k}`} />
              {HOLD_KIND_LABELS[k]}
            </label>
          ))}
        </fieldset>
      )}
      <div className="space-y-1">
        <Label htmlFor={id}>{onHold ? 'What arrived (optional)' : 'Reason (required)'}</Label>
        <Textarea id={id} rows={3} data-testid="hold-text" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {problem}
    </ConfirmDialog>
  );
}
