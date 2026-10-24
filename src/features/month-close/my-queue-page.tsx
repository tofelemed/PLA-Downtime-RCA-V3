import { useSearchParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { MyRcaActionsList } from '@/features/rca/actions/my-rca-actions-list';
import { DataState } from '@/features/ux-kit/data-state';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { MyPeriodsTab } from './my-periods-tab';
import { MyWorkCard } from './my-work-card';
import { MY_WORK_LOOK } from './my-work-look';
import { MyTasksTab } from './my-tasks-tab';
import { MY_WORK_TABS, myWorkSearchOf, myWorkTabOf } from './my-work-tabs';

/** Rows per page of the RCA actions tab (a full page, not the compact embed's default). */
const RCA_ACTIONS_PAGE_SIZE = 20;

function MyWorkScreen() {
  const { canViewAnalysis } = useCapabilities();
  const [params, setParams] = useSearchParams();
  // operators have no period work: their RCA actions and tasks only (Marun E2E owner rule)
  const tabs = canViewAnalysis ? MY_WORK_TABS : MY_WORK_TABS.filter((entry) => entry.key !== 'periods');
  const asked = myWorkTabOf(params.get('tab'));
  const tab = tabs.some((entry) => entry.key === asked) ? asked : 'rca-actions';
  return (
    <Page width="wide">
      <div className="space-y-4" data-testid="my-queue">
        <PageHeader title="My work" />
        <Tabs value={tab} onValueChange={(next) => setParams(myWorkSearchOf(myWorkTabOf(next)), { replace: true })}>
          <TabsList className="h-auto flex-wrap justify-start">
            {tabs.map((entry) => (
              <TabsTrigger key={entry.key} value={entry.key} data-testid={`my-work-tab-${entry.key}`}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {canViewAnalysis && (
            <TabsContent value="periods">
              <MyPeriodsTab />
            </TabsContent>
          )}
          <TabsContent value="rca-actions">
            <ReportLookContext.Provider value={MY_WORK_LOOK}>
              <MyWorkCard title="My RCA actions">
                <MyRcaActionsList mine statusFilter limit={RCA_ACTIONS_PAGE_SIZE} />
              </MyWorkCard>
            </ReportLookContext.Provider>
          </TabsContent>
          <TabsContent value="tasks">
            <MyTasksTab />
          </TabsContent>
        </Tabs>
      </div>
    </Page>
  );
}

/**
 * "My work" (UX audit §5.7) at `/my-queue`: tabs Periods (the reconciliation queue, SME R3 / R6) ·
 * RCA actions (the user's corrective actions) · Tasks (the user's open tasks), chosen with `?tab=`.
 * Each tab reads only its own list from the server.
 */
export function MyQueuePage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see your work." />;
  return <MyWorkScreen />;
}
