import { useSearchParams } from 'react-router-dom';
import { useMonthClose } from '@/api/v2/queries/month-close';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { CloseDeadlines } from './components/close-deadlines';
import { CloseHistory } from './components/close-history';
import { ClosePrerequisites } from './components/close-prerequisites';
import { CloseSignOffs } from './components/close-sign-offs';
import { MonthNav } from './components/month-nav';

function MonthCloseScreen() {
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? 'current';
  const query = useMonthClose(month);
  const view = query.data;
  const select = (key: string) => setParams((next) => {
    next.set('month', key);
    return next;
  });
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="month-close">
        <PageHeader
          title="Month close"
          description="Close the plant's financial month: every period approved, quantities closed by plant management, finance sign-off, then the lock."
          meta={view ? <MonthNav view={view} onSelect={select} /> : null}
        />
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
          {view && (
            <>
              <CloseDeadlines view={view} />
              <ClosePrerequisites view={view} />
              <CloseSignOffs view={view} />
              <CloseHistory view={view} />
            </>
          )}
        </DataState>
      </div>
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
  return <MonthCloseScreen />;
}
