import { useRcaFormat } from '../../use-rca-format';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { ActionIcon } from '@/lib/icons';
import { newItemId } from '../../model/rca-form';
import {
  EMPTY_RECOMMENDATION_FORM,
  isCostValid,
  recommendationFormOf,
  recommendationItemOf,
  storedRecommendations,
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_STATUS_OPTIONS,
  type RecommendationForm,
} from '../../model/recommendation-form';
import { useAssignableUsers } from '../../use-assignable-users';
import { useCaseWorkspace } from '../case-context';
import { CaseCard } from '../components/case-card';
import { AreaField, ChoiceField, FormFooter, optionsOf, TextField } from '../components/form-controls';
import { useCasePatch } from '../use-case-patch';

const COST_INVALID = 'Enter the estimated cost as a number, e.g. 1250.50.';

/** A title and a valid (or no) estimated cost: the form may be saved. */
const isComplete = (form: RecommendationForm) => form.title.trim() !== '' && isCostValid(form.estimatedCost);

function Fields({ form, onChange }: { form: RecommendationForm; onChange: (patch: Partial<RecommendationForm>) => void }) {
  const { users } = useAssignableUsers();
  const owners = users.map((user) => ({ value: user.id, label: user.name }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField id="rec-title" label="Title" value={form.title} maxLength={255} required wide onChange={(title) => onChange({ title })} />
      <AreaField id="rec-description" label="Description" value={form.description} maxLength={4000} onChange={(description) => onChange({ description })} />
      <ChoiceField id="rec-priority" label="Priority" value={form.priority} options={optionsOf(RECOMMENDATION_PRIORITIES)} onChange={(priority) => onChange({ priority })} />
      <ChoiceField id="rec-status" label="Status" value={form.status} options={RECOMMENDATION_STATUS_OPTIONS} onChange={(status) => onChange({ status })} />
      <ChoiceField id="rec-owner" label="Owner" value={form.ownerId} options={owners} allowNone="No owner" onChange={(ownerId) => onChange({ ownerId })} />
      <DateInput id="rec-due" label="Due date" compact value={form.dueDate} onChange={(dueDate) => onChange({ dueDate })} />
      <TextField
        id="rec-cost"
        label="Estimated cost"
        value={form.estimatedCost}
        placeholder="e.g. 1250.50"
        error={isCostValid(form.estimatedCost) ? null : COST_INVALID}
        onChange={(estimatedCost) => onChange({ estimatedCost })}
      />
    </div>
  );
}

function DeleteRecommendation({ onConfirm }: { onConfirm: () => Promise<void> }) {
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive">
          <ActionIcon.delete aria-hidden="true" className="mr-1 h-4 w-4" />
          Delete
        </Button>
      }
      title="Delete this recommendation?"
      description="Tasks already created stay in Task Management."
      confirmLabel="Delete recommendation"
      destructive
      onConfirm={onConfirm}
    />
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
  const ready = isComplete(form) && !patch.isPending;
  return (
    <CaseCard title={existing ? `Edit recommendation: ${existing.title}` : 'Add recommendation'}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Fields form={form} onChange={(next) => setForm((current) => ({ ...current, ...next }))} />
        {patch.error ? <FriendlyErrorAlert error={patch.error} /> : null}
        <FormFooter start={existing ? <DeleteRecommendation onConfirm={remove} /> : null}>
          <Button type="button" size="sm" variant="outline" onClick={back}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!ready} data-testid="save-recommendation">
            {existing ? 'Save recommendation' : 'Add recommendation'}
          </Button>
        </FormFooter>
      </form>
    </CaseCard>
  );
}
