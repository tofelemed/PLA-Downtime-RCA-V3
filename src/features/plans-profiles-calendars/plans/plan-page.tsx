import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePlan } from '@/api/v2/queries/period-overview';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { EntityIcon } from '@/lib/icons';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { PlanDetail } from './plan-detail';

const BACK = { to: '/planning', label: 'Plans' };

/** `/planning/plans/:planId`: one plan — current version, preview, generation, approval and history. */
export function PlanPage() {
  const { planId = null } = useParams();
  const plan = usePlan(planId);
  const refs = usePlanningRefs();
  const state = dataStateOf(plan);
  if (state !== 'ready' || !plan.data) {
    return (
      <Page>
        <PageHeader title="Plan" back={BACK} />
        <DataState state={state} error={plan.error} />
      </Page>
    );
  }
  return (
    <Page>
      <PageHeader
        title={plan.data.name}
        description={`${refs.unitName(plan.data.version.unitId)} · version ${plan.data.currentVersion ?? plan.data.version.version}`}
        back={BACK}
        actions={
          <Button asChild variant="outline" size="sm" data-testid="plan-open-periods">
            <Link to={`/plans/${plan.data.id}`}>
              <EntityIcon.plan className="h-4 w-4" aria-hidden="true" />
              Period accounting
            </Link>
          </Button>
        }
      />
      <PlanDetail plan={plan.data} refs={refs} />
    </Page>
  );
}
