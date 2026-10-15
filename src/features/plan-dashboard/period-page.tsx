import { Navigate, useLocation, useParams } from 'react-router-dom';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PeriodDetail } from './components/period-detail';
import { usePlanContext } from './hooks/use-plan-context';
import { isPeriodSection, periodPath } from './model/period-navigation';

/**
 * `/plans/:planId/periods/:periodId` — one period's accounting workspace as its own page (deep link,
 * Back returns to the plan's period grid).
 */
export function PeriodPage() {
  const { planId = null, periodId = null, '*': section = '' } = useParams();
  const location = useLocation();
  const { tenantId, zone, plan, state, unitName } = usePlanContext(planId);
  const back = { to: `/plans/${planId ?? ''}`, label: plan.data ? `${plan.data.name} · periods` : 'Periods' };
  if (!isPeriodSection(section)) return <Navigate to={`${periodPath(planId ?? '', periodId ?? '')}${location.search}`} replace />;
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to open its plans." />;
  if (state !== 'ready' || !plan.data || !planId || !periodId) {
    return (
      <Page>
        <PageHeader title="Period" back={back} />
        <DataState state={state === 'ready' ? 'empty' : state} error={plan.error} />
      </Page>
    );
  }
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="plan-dashboard-v2">
        <PageHeader title={`${plan.data.name} · period`} back={back} />
        <PeriodDetail key={periodId} planId={planId} periodId={periodId} section={section} unitName={unitName} planLabel={`Plan version ${plan.data.version.version}`} timezone={zone.timezone} />
      </div>
    </Page>
  );
}
