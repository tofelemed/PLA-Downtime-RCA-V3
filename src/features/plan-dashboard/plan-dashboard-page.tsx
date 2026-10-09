import { lazy, Suspense } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlan } from '@/api/v2/queries/period-overview';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { PeriodGrid } from './components/period-grid';
import { PlanSummary } from './components/plan-summary';

const PeriodDetail = lazy(() => import('./components/period-detail').then((m) => ({ default: m.PeriodDetail })));

/**
 * Plan Dashboard on v2 (plan 3.5) behind `v2.planDashboard`: the period accounting workspace of one plan —
 * a virtualized grid of its production periods with server figures, and the selected period's ledgers,
 * provenance, loss-line editor and workflow at the deep link `/plans/:planId/periods/:periodId`. Opening it
 * never writes (KPI03): every command is a user action.
 */
export function PlanDashboardPage() {
  const { planId = null, periodId = null } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tenantId = useV2TenantId();
  const zone = usePlantTimezone();
  const plan = usePlan(planId);
  const units = useUnits();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to open its Plan Dashboard." />;
  const state = dataStateOf(plan);
  if (state !== 'ready' || !plan.data) {
    const detail = state === 'error' ? 'This plan has no v2 version (v1-only plan). Create it under Plans, profiles & calendars to account its periods.' : undefined;
    return <DataState state={state} error={plan.error} detail={detail} />;
  }
  const version = plan.data.version;
  const unitName = flattenPages(units.data?.pages).find((u) => u.id === version.unitId)?.name ?? 'Unit';
  const tab = params.get('tab') === 'plan' ? 'plan' : 'periods';
  const openPeriod = (id: string | null) => navigate(id ? `/plans/${planId}/periods/${id}` : `/plans/${planId}`);
  return (
    <div className="space-y-4" data-testid="plan-dashboard-v2">
      <div className="space-y-1">
        <Link to="/production-plans" className="text-sm text-muted-foreground underline">
          ← Production Plans
        </Link>
        <h1 className="text-2xl font-semibold">Plan Dashboard · {plan.data.name}</h1>
        <ScopeHeader
          scopeLabel={unitName}
          timezone={zone.timezone}
          timezoneIsFallback={zone.source === 'utc-fallback'}
          baseline={`Plan v${version.version} (${version.approvalState})`}
        />
      </div>
      <Tabs value={tab} onValueChange={(next) => setParams(next === 'plan' ? { tab: next } : {}, { replace: true })}>
        <TabsList>
          <TabsTrigger value="periods" data-testid="tab-periods">
            Periods
          </TabsTrigger>
          <TabsTrigger value="plan" data-testid="tab-plan">
            Plan
          </TabsTrigger>
        </TabsList>
        <TabsContent value="periods" className="space-y-4">
          <PeriodGrid unitId={version.unitId} from={version.validFrom} to={version.validTo} timezone={zone.timezone} selectedId={periodId} onSelect={openPeriod} />
          {periodId && (
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <PeriodDetail key={periodId} periodId={periodId} unitName={unitName} planLabel={`Plan v${version.version}`} timezone={zone.timezone} />
            </Suspense>
          )}
        </TabsContent>
        <TabsContent value="plan">
          <PlanSummary plan={plan.data} timezone={zone.timezone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
