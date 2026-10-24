import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuditPage, useAuditSummary, type AuditFilters } from '@/api/v2/queries/administration-audit';
import type { AuditSummaryView } from '@/api/v2/types/administration';
import { DAY_MS, rollingWindow } from '@/api/v2/queries/time-window';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminCard } from '@/features/admin/shared/admin-card';
import { ALL, type FilterOption } from '@/features/admin/shared/filter-select';
import { PageGate } from '@/features/admin/shared/page-gate';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { useUrlFilters } from '@/features/admin/shared/use-url-filters';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DataTable } from '@/features/ux-kit/data-table';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { actionLabel, auditColumns, entityLabel } from './components/audit-columns';
import { AuditFilterBar } from './components/audit-filter-bar';
import { ExportAuditButton } from './components/export-audit-button';
import { toAuditFilters, type AuditUrlFilters } from './model/audit-filters';

/** Summary and chart modules load only when their tab/section is opened. */
const WorkSummary = lazy(() => import('./work-summary').then((module) => ({ default: module.WorkSummary })));
const AuditCharts = lazy(() => import('./components/audit-charts').then((module) => ({ default: module.AuditCharts })));

const ACTIVITY_INFO = 'Entries per day (UTC days), by action and by record type in the selected period. Search, action and record filters apply to the entries list and the export only.';

const optionsOf = (keys: readonly string[], label: (key: string) => string, allLabel: string): FilterOption[] => [
  { value: ALL, label: allLabel },
  ...keys.map((key) => ({ value: key, label: label(key) })),
];

/** The selected plant's audit trail (owner requirement "v2 only": replaces the 500-row v1 page). */
export function AuditPage() {
  const { canViewAuditLogs } = useCapabilities();
  return (
    <PageGate title="Audit log" allowed={canViewAuditLogs} deniedText="You don't have permission to read the audit log.">
      <AuditScreen />
    </PageGate>
  );
}

function useAuditView() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'work-summary' ? 'work-summary' : 'entries';
  const chooseView = (next: string) => setParams((current) => {
    const copy = new URLSearchParams(current);
    if (next === 'entries') copy.delete('view');
    else copy.set('view', next);
    return copy;
  });
  return [view, chooseView] as const;
}

function AuditScreen() {
  const dates = usePlantDates();
  const [defaults] = useState<AuditUrlFilters>(() => ({ ...rollingWindow(30 * DAY_MS), q: '', action: ALL, entity: ALL }));
  const [values, setValues] = useUrlFilters(defaults);
  const filters = toAuditFilters(values);
  const [view, chooseView] = useAuditView();
  return (
    <Page width="wide">
      <PageHeader title="Audit log" actions={view === 'entries' ? <ExportAuditButton filters={filters} timezone={dates.timezone} /> : undefined} />
      <Tabs value={view} onValueChange={chooseView}>
        <TabsList aria-label="Audit log views">
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="work-summary">Work summary</TabsTrigger>
        </TabsList>
        <TabsContent value="entries" className="mt-5 space-y-4">
          <AuditEntries filters={filters} values={values} setValues={setValues} />
        </TabsContent>
        <TabsContent value="work-summary" className="mt-5 space-y-4">
          <AuditFilterBar values={values} timezone={dates.timezone} entries={false} actions={[]} entities={[]} onChange={setValues} />
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <WorkSummary window={{ from: values.from || defaults.from, to: values.to || defaults.to }} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </Page>
  );
}

interface AuditEntriesProps {
  filters: AuditFilters;
  values: AuditUrlFilters;
  setValues: (patch: Partial<AuditUrlFilters>) => void;
}

/** Activity charts of the period: closed at first, so the chart module loads only when opened. */
function ActivityCard({ summary }: { summary: ReturnType<typeof useAuditSummary> }) {
  const [open, setOpen] = useState(false);
  const data: AuditSummaryView | undefined = summary.data;
  const toggle = (
    <Button variant="outline" className="h-9" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      {open ? 'Hide charts' : 'Show charts'}
    </Button>
  );
  return (
    <AdminCard title="Activity" info={ACTIVITY_INFO} count={data?.total} actions={toggle} testId="audit-activity">
      {open && (
        <DataState state={dataStateOf(summary, { isEmpty: data?.total === 0 })} error={summary.error} onRetry={() => void summary.refetch()} detail="Nothing was recorded in this period.">
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>{data && <AuditCharts summary={data} />}</Suspense>
        </DataState>
      )}
    </AdminCard>
  );
}

function AuditEntries({ filters, values, setValues }: AuditEntriesProps) {
  const navigate = useNavigate();
  const dates = usePlantDates();
  const entries = useAuditPage(filters);
  const summary = useAuditSummary({ from: filters.from, to: filters.to });
  const columns = useMemo(() => auditColumns(dates.dateTime), [dates]);
  const actions = optionsOf((summary.data?.byAction ?? []).map((row) => row.key), actionLabel, 'All actions');
  const entities = optionsOf((summary.data?.byEntityType ?? []).map((row) => row.key), entityLabel, 'All records');
  return (
    <>
      <AuditFilterBar values={values} timezone={dates.timezone} entries actions={actions} entities={entities} onChange={setValues} />
      <ActivityCard summary={summary} />
      <AdminCard title="Entries" testId="audit-entries">
        <DataTable
          caption="Audit entries"
          columns={columns}
          rows={entries.rows}
          getRowKey={(entry) => entry.id}
          pager={entries.pager}
          status={entries.status}
          density="compact"
          empty={{ title: 'No entries', text: 'Nothing was recorded for these filters.' }}
          onRowClick={(entry) => navigate(`/audit/${entry.id}`)}
          rowLabel={(entry) => `Open entry: ${actionLabel(entry.action)} ${entityLabel(entry.entityType)}`}
        />
      </AdminCard>
    </>
  );
}
