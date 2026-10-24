import { useState } from 'react';
import { useUpdateRcaAction } from '@/api/v2/queries/rca-commands';
import type { RcaActionView } from '@/api/v2/types/rca';
import { RCA_ACTION_TYPES } from '@/api/v2/types/rca-workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { labelOf, useUserNames } from '@/features/ux-kit/labels';
import { RCA_ACTION_TYPE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { RcaErrorAlert } from '../components/rca-error-alert';
import type { ActionAccess } from '../model/action-access';
import { asActionType, buildCompletionPatch, buildOwnerEvidencePatch, completionFormOf, type CompletionForm } from '../model/action-form';
import { useRcaFormat } from '../use-rca-format';
import { CompletionFiles } from './completion-files';
import { NATIVE_SELECT_CLASS } from './native-select';

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
      <select id={id} className={NATIVE_SELECT_CLASS} value={value} onChange={(e) => onChange(asActionType(e.target.value))}>
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

const OWNER_REASON = 'You own this action, so someone else checks the evidence and marks it done (separation of duties).';

/**
 * CA4: the owner never marks their own action done, and a named verifier is the only one who does
 * (SuperAdmin excepted); the server refuses both with 403. Null when the user may mark it done.
 */
function useDoneBlockedReason(action: RcaActionView): string | null {
  const userId = useCurrentUserId();
  const { isSuperAdmin } = useCapabilities();
  const users = useUserNames(action.verifierId ? [action.verifierId] : []);
  if (isSuperAdmin) return null;
  if (action.ownerId && userId === action.ownerId) return OWNER_REASON;
  if (action.verifierId && userId !== action.verifierId) return `${users.nameOf(action.verifierId)} is the named verifier of this action and marks it done.`;
  return null;
}

function MarkDone({ action, onClick }: { action: RcaActionView; onClick: () => void }) {
  const blocked = useDoneBlockedReason(action);
  const reasonId = `action-${action.id}-done-reason`;
  if (action.status === 'done') return null;
  if (blocked) return <DisabledReason id={reasonId} reason={blocked} />;
  return (
    <Button size="sm" onClick={onClick} data-testid="mark-done">
      Mark done (evidence checked)
    </Button>
  );
}

interface FieldsProps {
  prefix: string;
  form: CompletionForm;
  set: (patch: Partial<CompletionForm>) => void;
  rcaId: string;
}

/** The evidence reference and its files (what the owner records too). */
function EvidenceFields({ prefix, form, set, rcaId }: FieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-evidence`}>Evidence reference</Label>
        <Input id={`${prefix}-evidence`} className="h-9" value={form.evidenceRef} maxLength={500} placeholder="Work order, document or record number" onChange={(e) => set({ evidenceRef: e.target.value })} />
      </div>
      <div className="md:col-span-3">
        <CompletionFiles rcaId={rcaId} value={form.attachments} onChange={(attachments) => set({ attachments })} />
      </div>
    </>
  );
}

/**
 * CA4 completion of an action: its type, the objective evidence the type needs (server text), the date and
 * optional files. "Mark done" is checked by the server: evidence present and someone other than the owner
 * (the named verifier when there is one). The owner who is not an RCA writer records the evidence only.
 */
export function ActionCompletion({ action, access }: { action: RcaActionView; access: ActionAccess }) {
  const update = useUpdateRcaAction();
  const { timezone } = useRcaFormat();
  const [form, setForm] = useState<CompletionForm>(() => completionFormOf(action, timezone));
  const set = (patch: Partial<CompletionForm>) => setForm((current) => ({ ...current, ...patch }));
  const save = (markDone: boolean) => {
    const body = access.ownerOnly ? buildOwnerEvidencePatch(form) : buildCompletionPatch(form, markDone, timezone);
    void update.submit({ action, body }).catch(() => null);
  };
  const prefix = `action-${action.id}`;
  return (
    <div className="space-y-2 rounded border p-2" data-testid="action-completion">
      <p className="text-xs text-muted-foreground" data-testid="evidence-expected">
        Evidence this action needs: {action.evidenceExpected}
      </p>
      <Recorded action={action} />
      {access.canWork ? (
        <fieldset className="grid gap-2 md:grid-cols-3" disabled={update.isPending}>
          {!access.ownerOnly && <TypeSelect id={`${prefix}-type`} value={form.actionType} onChange={(actionType) => set({ actionType })} />}
          {!access.ownerOnly && <DateInput id={`${prefix}-completed`} label="Completed on" compact value={form.completedAt} onChange={(completedAt) => set({ completedAt })} />}
          <EvidenceFields prefix={prefix} form={form} set={set} rcaId={action.rcaId} />
          <div className="flex flex-wrap gap-2 md:col-span-3">
            <Button size="sm" variant="outline" onClick={() => save(false)} data-testid="save-evidence">
              Save evidence
            </Button>
            <MarkDone action={action} onClick={() => save(true)} />
          </div>
        </fieldset>
      ) : (
        <CompletionFiles rcaId={action.rcaId} value={action.completionAttachments} onChange={null} />
      )}
      {update.error ? <RcaErrorAlert error={update.error} /> : null}
    </div>
  );
}
