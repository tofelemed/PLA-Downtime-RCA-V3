import { useState } from 'react';
import { useUpdateRcaAction } from '@/api/v2/queries/rca-commands';
import type { RcaActionView } from '@/api/v2/types/rca';
import { RCA_ACTION_TYPES } from '@/api/v2/types/rca-workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_ACTION_TYPE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { RcaErrorAlert } from '../components/rca-error-alert';
import { asActionType, buildCompletionPatch, completionFormOf, type CompletionForm } from '../model/action-form';
import { useRcaFormat } from '../use-rca-format';
import { CompletionFiles } from './completion-files';

function Recorded({ action }: { action: RcaActionView }) {
  const users = useUserNames();
  const { day } = useRcaFormat();
  if (action.status !== 'done') return null;
  return (
    <p className="text-sm" data-testid="action-completed">
      Done{action.completedAt ? ` on ${day(action.completedAt)}` : ''}
      {action.completionVerifiedBy ? `, evidence checked by ${users.nameOf(action.completionVerifiedBy)}` : ''}
      {action.completionEvidenceRef ? ` · ${action.completionEvidenceRef}` : ''}
    </p>
  );
}

function TypeSelect({ id, value, onChange }: { id: string; value: CompletionForm['actionType']; onChange: (value: CompletionForm['actionType']) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Type of action</Label>
      <select id={id} className="h-10 w-full rounded border bg-background px-2 text-sm" value={value} onChange={(e) => onChange(asActionType(e.target.value))}>
        <option value="">Not chosen yet</option>
        {RCA_ACTION_TYPES.map((type) => (
          <option key={type} value={type}>
            {labelOf(RCA_ACTION_TYPE_LABELS, type)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * CA4 completion of an action: its type, the objective evidence the type needs (server text), the date and
 * optional files. "Mark done" is checked by the server: evidence present and someone other than the owner.
 */
export function ActionCompletion({ action, canWrite }: { action: RcaActionView; canWrite: boolean }) {
  const update = useUpdateRcaAction();
  const { timezone } = useRcaFormat();
  const [form, setForm] = useState<CompletionForm>(() => completionFormOf(action, timezone));
  const set = (patch: Partial<CompletionForm>) => setForm((current) => ({ ...current, ...patch }));
  const editable = canWrite && action.status !== 'cancelled';
  const save = (markDone: boolean) => void update.submit({ action, body: buildCompletionPatch(form, markDone, timezone) }).catch(() => null);
  const prefix = `action-${action.id}`;
  return (
    <div className="space-y-2 rounded border p-2" data-testid="action-completion">
      <p className="text-xs text-muted-foreground" data-testid="evidence-expected">
        Evidence this action needs: {action.evidenceExpected}
      </p>
      <Recorded action={action} />
      {editable ? (
        <fieldset className="grid gap-2 md:grid-cols-3" disabled={update.isPending}>
          <TypeSelect id={`${prefix}-type`} value={form.actionType} onChange={(actionType) => set({ actionType })} />
          <div className="space-y-1">
            <Label htmlFor={`${prefix}-evidence`}>Evidence reference</Label>
            <Input id={`${prefix}-evidence`} value={form.evidenceRef} maxLength={500} placeholder="Work order, document or record number" onChange={(e) => set({ evidenceRef: e.target.value })} />
          </div>
          <DateInput id={`${prefix}-completed`} label="Completed on" value={form.completedAt} onChange={(completedAt) => set({ completedAt })} />
          <div className="md:col-span-3">
            <CompletionFiles rcaId={action.rcaId} value={form.attachments} onChange={(attachments) => set({ attachments })} />
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-3">
            <Button size="sm" variant="outline" onClick={() => save(false)} data-testid="save-evidence">
              Save evidence
            </Button>
            {action.status !== 'done' && (
              <Button size="sm" onClick={() => save(true)} data-testid="mark-done">
                Mark done (evidence checked)
              </Button>
            )}
          </div>
        </fieldset>
      ) : (
        <CompletionFiles rcaId={action.rcaId} value={action.completionAttachments} onChange={null} />
      )}
      {update.error ? <RcaErrorAlert error={update.error} /> : null}
    </div>
  );
}
