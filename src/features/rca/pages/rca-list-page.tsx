import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useRcaSummary } from '@/api/v2/queries/rca-cases';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { filtersFromParams, legacyRedirect, paramsFromFilters, type CaseListFilters } from '../model/case-filters';
import { CaseFiltersBar } from './case-filters-bar';
import { CaseTable } from './case-table';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** Counts of the scope (from the server): total, by status, overdue and open critical cases. */
function CaseSummary() {
  const { number } = useNumberFormat();
  const summary = useRcaSummary();
  if (!summary.data) return null;
  const { total, overdue, critical, byStatus } = summary.data;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="case-summary" aria-label="Case counts">
      <Badge variant="outline">{number(total)} case(s)</Badge>
      {byStatus.map((row) => (
        <Badge key={row.status ?? 'none'} variant="secondary">
          {row.status ?? 'No status'}: {number(row.count)}
        </Badge>
      ))}
      <Badge variant={overdue > 0 ? 'destructive' : 'outline'}>Overdue: {overdue}</Badge>
      <Badge variant={critical > 0 ? 'destructive' : 'outline'}>Open critical: {critical}</Badge>
    </div>
  );
}

function ListScreen() {
  const { canWriteRca } = useCapabilities();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const legacy = legacyRedirect(params);
  if (legacy) return <Navigate to={legacy} replace />;
  const setFilters = (next: CaseListFilters) => setParams(paramsFromFilters(next), { replace: true });
  const clear = () => setParams({}, { replace: true });
  const actions = canWriteRca ? (
    <Button asChild data-testid="new-case">
      <Link to="/rca/new">
        <ActionIcon.add aria-hidden="true" className="mr-1 h-4 w-4" />
        New case
      </Link>
    </Button>
  ) : (
    <ReadOnlyHint />
  );
  return (
    <div data-testid="rca-v2">
      <Page width="wide">
        <PageHeader
          title="Root cause analysis"
          description="Investigations of this plant. Triggers only recommend a case; a person opens and closes it."
          actions={actions}
          meta={<CaseSummary />}
        />
        <Section title="Cases">
          <div className="space-y-3">
            <CaseFiltersBar value={filters} onChange={setFilters} />
            <CaseTable
              filters={filters}
              empty={{
                title: 'No cases',
                text: 'No case matches these filters. Open one from an event in the Event Hub, or start a new case.',
                action: (
                  <Button variant="outline" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                ),
              }}
            />
          </div>
        </Section>
      </Page>
    </div>
  );
}

/** `/rca`: the case list (search, status, priority and target-date filters; 20 per page). */
export function RcaListPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its RCA cases." />;
  return <ListScreen />;
}
