import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { usePostingDecision } from '@/api/v2/queries/restatement';
import type { PostingTreatment, RestatementView } from '@/api/v2/types/restatement';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DateInput } from '@/features/ux-kit/date-inputs/date-input';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { POSTING_TREATMENT_LABELS, POSTING_TREATMENT_OPTIONS } from '../model/restatement-labels';

const TREATMENTS: PostingTreatment[] = ['correction', 'estimate_change', 'other_adjustment', 'no_posting'];
const SELECT = 'h-9 rounded-md border border-input bg-background px-2';

/** Finance's posting date and treatment of an undecided restatement (decided once: the server refuses a second decision). */
export function PostingForm({ data }: { data: RestatementView }) {
  const command = usePostingDecision();
  const id = useId();
  const [postingDate, setPostingDate] = useState('');
  const [treatment, setTreatment] = useState<PostingTreatment>('correction');
  const save = () => command.submit({ periodId: data.periodId, revision: data.revision, postingDate, treatment });
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm" data-testid="posting-form">
      <DateInput id={`${id}-date`} label="Posting date" value={postingDate} onChange={setPostingDate} required textEntry />
      <div className="space-y-1">
        <Label htmlFor={`${id}-treatment`}>Treatment</Label>
        <select id={`${id}-treatment`} className={SELECT} value={treatment} onChange={(e) => setTreatment(e.target.value as PostingTreatment)} data-testid="posting-treatment">
          {TREATMENTS.map((t) => (
            <option key={t} value={t}>
              {POSTING_TREATMENT_OPTIONS[t]}
            </option>
          ))}
        </select>
      </div>
      <ConfirmDialog
        trigger={
          <Button size="sm" disabled={!postingDate || command.isPending} aria-describedby={postingDate ? undefined : `${id}-reason`} data-testid="posting-save">
            Save posting…
          </Button>
        }
        title="Save this posting decision?"
        description={`Posting date ${postingDate}, treatment: ${POSTING_TREATMENT_LABELS[treatment]}. The decision is final: a later change needs a new restatement.`}
        confirmLabel="Save posting"
        onConfirm={save}
      />
      <DisabledReason id={`${id}-reason`} reason={postingDate ? null : 'Choose the posting date first.'} />
      {command.error ? <FriendlyErrorAlert error={command.error} /> : null}
    </div>
  );
}
