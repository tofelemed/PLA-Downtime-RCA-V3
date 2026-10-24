import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { PeriodGrid } from './components/period-grid';
import { PlanSummary } from './components/plan-summary';
import { usePlanContext } from './hooks/use-plan-context';
import { periodGridTitle } from './model/period-title';
import { planMetaText } from './model/plan-meta';

const BACK = { to: '/planning', label: 'Plans' };

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
    const detail = state === 'error' ? 'This plan has no versioned plan yet. Create it under Production › Plans to account its periods.' : undefined;
    return (
      <Page>
        <PageHeader title={periodGridTitle(null)} back={BACK} />
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
          title={periodGridTitle(plan.data.name)}
          back={BACK}
          meta={<span className="inline-flex flex-wrap items-center gap-2">{planMetaText(unitName, version.version)} <VersionStateBadge state={version.approvalState} /></span>}
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
