import { useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useMonthClose } from '@/api/v2/queries/month-close';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { CloseHistory } from './components/close-history';
import { ClosePrerequisites } from './components/close-prerequisites';
import { CloseOverview } from './components/close-overview';
import { CloseSectionNav } from './components/close-section-nav';
import { MonthNav } from './components/month-nav';
import { CloseExceptions } from './exceptions/close-exceptions';
import { CLOSE_LOOK } from './model/close-look';
import { closeSearch, closeSection } from './model/close-section';

function MonthCloseScreen() {
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? 'current';
  const section = closeSection(params.get('section'));
  const requestedSection = useRef(section);
  useLayoutEffect(() => { requestedSection.current = section; }, [section]);
  const query = useMonthClose(month);
  const view = query.data;
  const select = (key: string) => setParams((next) => closeSearch(next, 'month', key));
  const selectSection = (value: string) => {
    const nextSection = closeSection(value);
    // Radix can activate on both mouse-down and focus before the URL commit rerenders.
    if (requestedSection.current === nextSection) return;
    requestedSection.current = nextSection;
    setParams((next) => closeSearch(next, 'section', nextSection));
  };
  return (
    <Page width="wide">
      <ReportLookContext.Provider value={CLOSE_LOOK}>
      <div className="space-y-6" data-testid="month-close">
        <PageHeader
          title="Month close"
          meta={view ? <MonthNav view={view} onSelect={select} /> : null}
        />
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
          {view && (
            <Tabs value={section} onValueChange={selectSection} className="min-w-0 space-y-5">
              <CloseSectionNav />
              <TabsContent value="overview"><CloseOverview key={view.monthKey} view={view} params={params} /></TabsContent>
              {(['periods', 'days', 'proposals'] as const).map((part) => <TabsContent key={part} value={part}>
                <ClosePrerequisites view={view} section={part} />
              </TabsContent>)}
              <TabsContent value="exceptions"><CloseExceptions view={view} /></TabsContent>
              <TabsContent value="history"><CloseHistory view={view} /></TabsContent>
            </Tabs>
          )}
        </DataState>
      </div>
      </ReportLookContext.Provider>
    </Page>
  );
}

/**
 * Month close (SME R1 / R4, EXPERT_REVIEW phase R-B) at `/month-close?month=YYYY-MM`: deadlines, prerequisites,
 * sign-offs and history of the acting plant's financial month. Every rule — working days, roles, separation of
 * duties, prerequisites, the lock — is the server's.
 */
export function MonthClosePage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to close its month." />;
  return <MonthCloseScreen key={tenantId} />;
}
