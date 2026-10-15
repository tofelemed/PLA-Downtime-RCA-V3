import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePostingDecision } from '@/api/v2/queries/restatement';
import type { PostingTreatment, RestatementView } from '@/api/v2/types/restatement';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { POSTING_TREATMENT_LABELS } from '../model/restatement-labels';

const TREATMENTS: PostingTreatment[] = ['correction', 'estimate_change', 'other_adjustment', 'no_posting'];
const SELECT = 'h-9 rounded-md border border-input bg-background px-2';

/** Finance's posting date and treatment of the restatement (a later decision replaces the earlier one). */
export function PostingForm({ data }: { data: RestatementView }) {
  const command = usePostingDecision();
  const id = useId();
  const [postingDate, setPostingDate] = useState(data.posting?.postingDate ?? '');
  const [treatment, setTreatment] = useState<PostingTreatment>(data.posting?.treatment ?? 'correction');
  const save = () => void command.submit({ periodId: data.periodId, revision: data.revision, postingDate, treatment }).catch(() => undefined);
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm" data-testid="posting-form">
      <div className="space-y-1">
        <Label htmlFor={`${id}-date`}>Posting date</Label>
        <Input id={`${id}-date`} type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} data-testid="posting-date" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-treatment`}>Treatment</Label>
        <select id={`${id}-treatment`} className={SELECT} value={treatment} onChange={(e) => setTreatment(e.target.value as PostingTreatment)} data-testid="posting-treatment">
          {TREATMENTS.map((t) => (
            <option key={t} value={t}>
              {POSTING_TREATMENT_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <Button size="sm" disabled={!postingDate || command.isPending} onClick={save} data-testid="posting-save">
        Save posting
      </Button>
      {command.error ? <FriendlyErrorAlert error={command.error} /> : null}
    </div>
  );
}
