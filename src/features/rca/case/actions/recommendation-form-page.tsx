import { useRcaFormat } from '../../use-rca-format';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { newItemId } from '../../model/rca-form';
import {
  EMPTY_RECOMMENDATION_FORM,
  isCostValid,
  recommendationFormOf,
  recommendationItemOf,
  storedRecommendations,
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_STATUSES,
  type RecommendationForm,
} from '../../model/recommendation-form';
import { useAssignableUsers } from '../../use-assignable-users';
import { useCaseWorkspace } from '../case-context';
import { AreaField, ChoiceField, optionsOf, TextField } from '../evidence/form-controls';
import { useCasePatch } from '../use-case-patch';

function Fields({ form, onChange }: { form: RecommendationForm; onChange: (patch: Partial<RecommendationForm>) => void }) {
  const { users } = useAssignableUsers();
  const owners = users.map((user) => ({ value: user.id, label: user.name }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField id="rec-title" label="Title" value={form.title} maxLength={255} required wide onChange={(title) => onChange({ title })} />
      <AreaField id="rec-description" label="Description" value={form.description} maxLength={4000} onChange={(description) => onChange({ description })} />
      <ChoiceField id="rec-priority" label="Priority" value={form.priority} options={optionsOf(RECOMMENDATION_PRIORITIES)} onChange={(priority) => onChange({ priority })} />
      <ChoiceField id="rec-status" label="Status" value={form.status} options={optionsOf(RECOMMENDATION_STATUSES)} onChange={(status) => onChange({ status })} />
      <ChoiceField id="rec-owner" label="Owner" value={form.ownerId} options={owners} allowNone="No owner" onChange={(ownerId) => onChange({ ownerId })} />
      <DateInput id="rec-due" label="Due date" value={form.dueDate} onChange={(dueDate) => onChange({ dueDate })} />
      <TextField id="rec-cost" label="Estimated cost" value={form.estimatedCost} placeholder="e.g. 1250.50" onChange={(estimatedCost) => onChange({ estimatedCost })} />
    </div>
  );
}

/** `/rca/:caseId/actions/recommendations/new` and `…/:recommendationId/edit`. */
export function RecommendationFormPage() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const { timezone } = useRcaFormat();
  const { recommendationId } = useParams();
  const navigate = useNavigate();
  const patch = useCasePatch();
  const existing = recommendationId ? rca.recommendations.find((row) => row.id === recommendationId) : undefined;
  const [initial] = useState<RecommendationForm>(() => (existing ? recommendationFormOf(existing, timezone) : EMPTY_RECOMMENDATION_FORM));
  const [form, setForm] = useState<RecommendationForm>(initial);
  useUnsavedChangesGuard(JSON.stringify(form) !== JSON.stringify(initial));
  const back = () => navigate(`${basePath}/actions`);
  if (readOnly || (recommendationId && !existing)) return <Navigate to={`${basePath}/actions`} replace />;
  const save = async () => {
    const item = recommendationItemOf(form, existing?.id ?? newItemId('rec', rca.recommendations), timezone);
    const recommendations = existing ? rca.recommendations.map((row) => (row.id === item.id ? item : row)) : [...rca.recommendations, item];
    if (await patch.save({ recommendations: storedRecommendations(recommendations) }).catch(() => null)) back();
  };
  const remove = async () => {
    await patch.save({ recommendations: storedRecommendations(rca.recommendations.filter((row) => row.id !== existing?.id)) });
    back();
  };
  const costOk = isCostValid(form.estimatedCost);
  return (
    <Section title={existing ? `Edit recommendation: ${existing.title}` : 'Add recommendation'}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Fields form={form} onChange={(next) => setForm((current) => ({ ...current, ...next }))} />
        {!costOk && <p className="text-sm text-destructive">Enter the estimated cost as a number, e.g. 1250.50.</p>}
        {patch.error ? <FriendlyErrorAlert error={patch.error} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.title.trim() === '' || !costOk || patch.isPending} data-testid="save-recommendation">
            {existing ? 'Save recommendation' : 'Add recommendation'}
          </Button>
          <Button type="button" variant="outline" onClick={back}>
            Cancel
          </Button>
          {existing && (
            <ConfirmDialog
              trigger={<Button type="button" variant="outline">Delete</Button>}
              title="Delete this recommendation?"
              description="It is removed from the investigation; tasks already created stay in Task Management."
              confirmLabel="Delete recommendation"
              destructive
              onConfirm={remove}
            />
          )}
        </div>
      </form>
    </Section>
  );
}
