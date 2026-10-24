import { useState } from 'react';
import { useUpdateRcaAction } from '@/api/v2/queries/rca-commands';
import type { RcaActionView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { FormField } from '@/features/ux-kit/form-field';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { RcaErrorAlert } from '../components/rca-error-alert';
import { actionEditFormOf, buildActionEditPatch, type ActionEditForm as Form } from '../model/action-edit';
import { verifierIsOwner } from '../model/action-form';
import { useRcaFormat } from '../use-rca-format';
import { useOptionalCaseWorkspace } from '../case/case-context';
import { OwnerSelect } from './owner-select';
import { RecommendationSelect } from './recommendation-select';
import { VerificationPlanFields } from './verification-plan-fields';
import { FormFooter } from '../case/evidence/form-controls';

const TITLE_REQUIRED = 'Enter the action.';
const WINDOW_LOCKED = 'The verification window is fixed once the action is done; reopen the action to change it.';

/** Verify from / until; read-only with the reason once the action is done (server 409 VERIFICATION_WINDOW_LOCKED). */
function WindowFields({ prefix, form, set, locked }: { prefix: string; form: Form; set: (patch: Partial<Form>) => void; locked: boolean }) {
  return (
    <>
      <DateInput id={`${prefix}-window-start`} label="Verify from" compact value={form.windowStart} disabled={locked} onChange={(windowStart) => set({ windowStart })} />
      <DateInput id={`${prefix}-window-end`} label="Verify until" compact value={form.windowEnd} disabled={locked} onChange={(windowEnd) => set({ windowEnd })} />
      {locked && (
        <p className="text-xs text-muted-foreground md:col-span-3" data-testid="window-locked">
          {WINDOW_LOCKED}
        </p>
      )}
    </>
  );
}

export interface ActionEditFormProps {
  action: RcaActionView;
  onDone: () => void;
}

/**
 * Edits the planning of an action (A-8): title, owner, implemented recommendation, due date, verification method and
 * verifier, and verification window (fixed once done) — the fields
 * the update DTO accepts. Only changed fields are sent, with If-Match = the version on screen.
 */
export function ActionEditForm({ action, onDone }: ActionEditFormProps) {
  const { timezone } = useRcaFormat();
  const update = useUpdateRcaAction();
  const recommendations = useOptionalCaseWorkspace()?.rca.recommendations ?? [];
  const [form, setForm] = useState<Form>(() => actionEditFormOf(action, timezone));
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const body = buildActionEditPatch(form, action, timezone);
  const changed = Object.keys(body).length > 0;
  useUnsavedChangesGuard(changed);
  const prefix = `action-edit-${action.id}`;
  const save = async () => {
    const saved = await update.submit({ action, body }).catch(() => null);
    if (saved) onDone();
  };
  return (
    <fieldset className="grid gap-4 rounded-md border p-3 md:grid-cols-3" disabled={update.isPending} data-testid="action-edit-form">
      <legend className="px-1 text-sm font-semibold text-heading">Edit action</legend>
      <FormField id={`${prefix}-title`} label="Action" required error={form.title.trim() === '' ? TITLE_REQUIRED : null}>
        <Input id={`${prefix}-title`} className="h-9" value={form.title} maxLength={255} onChange={(e) => set({ title: e.target.value })} />
      </FormField>
      <OwnerSelect id={`${prefix}-owner`} value={form.ownerId} onChange={(ownerId) => set({ ownerId })} />
      {(recommendations.length > 0 || form.recommendationId) && (
        <RecommendationSelect id={`${prefix}-recommendation`} value={form.recommendationId} recommendations={recommendations} onChange={(recommendationId) => set({ recommendationId })} />
      )}
      <DateInput id={`${prefix}-due`} label="Due" compact value={form.dueDate} onChange={(dueDate) => set({ dueDate })} />
      <VerificationPlanFields idPrefix={prefix} value={form} onChange={set} />
      <WindowFields prefix={prefix} form={form} set={set} locked={action.verificationWindowLocked} />
      <div className="space-y-2 md:col-span-3">
        {update.error ? <RcaErrorAlert error={update.error} /> : null}
        <FormFooter>
          <Button size="sm" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button size="sm" disabled={!changed || form.title.trim() === '' || verifierIsOwner(form)} onClick={() => void save()} data-testid="save-action-edit">
            Save changes
          </Button>
        </FormFooter>
      </div>
    </fieldset>
  );
}
