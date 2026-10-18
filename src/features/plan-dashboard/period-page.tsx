import { Navigate, useLocation, useParams } from 'react-router-dom';
import { eventBackTarget } from '@/features/event-hub/hooks/use-back-target';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PeriodDetail } from './components/period-detail';
import { usePlanContext } from './hooks/use-plan-context';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { isPeriodSection, periodPath, QUALITY_ONLY_SECTION } from './model/period-navigation';

/** Back to the event the period was opened from (its "Periods" tab sends `listSearch`), else null. */
function eventOrigin(state: unknown): { to: string; label: string } | null {
  const listSearch = (state as { listSearch?: unknown } | null)?.listSearch;
  const target = eventBackTarget(listSearch);
  return target.label === 'Event' ? { to: target.to, label: 'Back to the event' } : null;
}

/** Back without an event origin: the plan's period grid, or the events for an operator (no grid access). */
function gridBack(canViewAnalysis: boolean, planId: string | null, planName: string | undefined): { to: string; label: string } {
  if (!canViewAnalysis) return { to: '/events', label: 'Events' };
  return { to: `/plans/${planId ?? ''}`, label: planName ? `${planName} · periods` : 'Periods' };
}

/**
 * `/plans/:planId/periods/:periodId` — one period's accounting workspace as its own page (deep link,
 * Back returns to the event it was opened from, else to the plan's period grid). A disposition writer
 * without the analysis screens (an operator) is sent to Actuals & quality, the one section they reach.
 */
export function PeriodPage() {
  const { planId = null, periodId = null, '*': section = '' } = useParams();
  const location = useLocation();
  const { canViewAnalysis } = useCapabilities();
  const { tenantId, zone, plan, state, unitName } = usePlanContext(planId);
  const back = eventOrigin(location.state) ?? gridBack(canViewAnalysis, planId, plan.data?.name);
  if (!isPeriodSection(section)) return <Navigate to={`${periodPath(planId ?? '', periodId ?? '')}${location.search}`} replace />;
  if (!canViewAnalysis && section !== QUALITY_ONLY_SECTION) return <Navigate to={`${periodPath(planId ?? '', periodId ?? '', QUALITY_ONLY_SECTION)}${location.search}`} replace />;
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
        <PeriodDetail key={periodId} planId={planId} periodId={periodId} section={section} unitName={unitName} planLabel={`Plan version ${plan.data.version.version}`} planWindow={{ from: plan.data.version.validFrom, to: plan.data.version.validTo }} timezone={zone.timezone} />
      </div>
    </Page>
  );
}
