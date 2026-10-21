import { useNavigate, useParams } from 'react-router-dom';
import { usePlan } from '@/api/v2/queries/period-overview';
import { usePlanVersion } from '@/api/v2/queries/plans';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import type { PlanFormMode } from '../hooks/use-plan-form';
import { usePlanningRefs, type PlanningRefs } from '../hooks/use-planning-refs';
import { PlanForm } from './plan-form';

const LIST = '/planning';

function Form({ mode, refs, back }: { mode: PlanFormMode; refs: PlanningRefs; back: string }) {
  const navigate = useNavigate();
  return <PlanForm mode={mode} refs={refs} cancelTo={back} onSaved={(planId) => navigate(`/planning/plans/${planId}`)} />;
}

/** `/planning/plans/new`: a new plan (draft version 1). */
export function NewPlanPage() {
  const refs = usePlanningRefs();
  return (
    <Page>
      <PageHeader title="New plan" description="Saved as draft version 1. Preview, generate and approve it on the plan's page." back={{ to: LIST, label: 'Plans' }} />
      <Form mode={{ kind: 'create' }} refs={refs} back={LIST} />
    </Page>
  );
}

/**
 * `/planning/plans/:planId/versions/:version/edit` (edit the open draft, If-Match) and
 * `/planning/plans/:planId/versions/new` (next version after an approval, prefilled from the current one).
 */
function PlanVersionFormPage({ kind }: { kind: 'edit' | 'new-version' }) {
  const params = useParams();
  const planId = params.planId ?? null;
  const plan = usePlan(planId);
  const number = kind === 'edit' ? Number(params.version) : (plan.data?.currentVersion ?? null);
  const version = usePlanVersion(planId, Number.isFinite(number) ? number : null);
  const refs = usePlanningRefs();
  const back = planId ? `/planning/plans/${planId}` : LIST;
  const title = kind === 'edit' ? `Edit draft version ${params.version ?? ''}` : 'Create new version';
  const current = plan.data;
  const shown = version.data;
  const state = current ? dataStateOf(version) : dataStateOf(plan);
  return (
    <Page>
      <PageHeader title={current ? `${title} · ${current.name}` : title} back={{ to: back, label: current?.name ?? 'Plan' }} />
      {state === 'ready' && current && shown && !refs.loading ? (
        <Form key={`${shown.id}-${shown.rowVersion}`} mode={{ kind, plan: current, version: shown }} refs={refs} back={back} />
      ) : (
        <DataState state={state === 'ready' ? 'loading' : state} error={plan.error ?? version.error} />
      )}
    </Page>
  );
}

/** `/planning/plans/:planId/versions/:version/edit` */
export function EditPlanVersionPage() {
  return <PlanVersionFormPage kind="edit" />;
}

/** `/planning/plans/:planId/versions/new` */
export function NewPlanVersionPage() {
  return <PlanVersionFormPage kind="new-version" />;
}
