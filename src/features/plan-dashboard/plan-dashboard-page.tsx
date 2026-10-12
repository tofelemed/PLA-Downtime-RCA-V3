import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { labelOf, VERSION_STATE_LABELS } from '@/features/ux-kit/labels';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { PeriodGrid } from './components/period-grid';
import { PlanSummary } from './components/plan-summary';
import { usePlanContext } from './hooks/use-plan-context';

const BACK = { to: '/planning?tab=plans', label: 'Plans' };

/**
 * `/plans/:planId` — the plan's period accounting: a paged grid of its production periods with the
 * server's figures (a row opens the period at `/plans/:planId/periods/:periodId`) and the plan summary
 * (`?tab=plan`). Opening it never writes; every command is a user action.
 */
export function PlanDashboardPage() {
  const { planId = null } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { tenantId, zone, plan, state, unitName } = usePlanContext(planId);
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to open its plans." />;
  if (state !== 'ready' || !plan.data) {
    const detail = state === 'error' ? 'This plan has no versioned plan yet. Create it under Plans, profiles & calendars to account its periods.' : undefined;
    return (
      <Page>
        <PageHeader title="Period accounting" back={BACK} />
        <DataState state={state} error={plan.error} detail={detail} />
      </Page>
    );
  }
  const version = plan.data.version;
  const tab = params.get('tab') === 'plan' ? 'plan' : 'periods';
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="plan-dashboard-v2">
        <PageHeader
          title={`${plan.data.name} · period accounting`}
          back={BACK}
          meta={<ScopeHeader scopeLabel={unitName} timezone={zone.timezone} timezoneIsFallback={zone.source === 'utc-fallback'} baseline={`Plan version ${version.version} (${labelOf(VERSION_STATE_LABELS, version.approvalState).toLowerCase()})`} />}
        />
        <Tabs value={tab} onValueChange={(next) => setParams(next === 'plan' ? { tab: next } : {}, { replace: true })}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="periods" data-testid="tab-periods">
              Periods
            </TabsTrigger>
            <TabsTrigger value="plan" data-testid="tab-plan">
              Plan
            </TabsTrigger>
          </TabsList>
          <TabsContent value="periods" className="pt-3">
            <PeriodGrid unitId={version.unitId} from={version.validFrom} to={version.validTo} timezone={zone.timezone} onOpen={(row) => navigate(`/plans/${planId}/periods/${row.periodId}`)} />
          </TabsContent>
          <TabsContent value="plan" className="pt-3">
            <PlanSummary plan={plan.data} timezone={zone.timezone} />
          </TabsContent>
        </Tabs>
      </div>
    </Page>
  );
}
