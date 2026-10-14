import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuditPage, useAuditSummary } from '@/api/v2/queries/administration-audit';
import { DAY_MS, rollingWindow } from '@/api/v2/queries/time-window';
import { Skeleton } from '@/components/ui/skeleton';
import { ALL, FilterSelect, type FilterOption } from '@/features/admin/shared/filter-select';
import { PageGate } from '@/features/admin/shared/page-gate';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { useUrlFilters } from '@/features/admin/shared/use-url-filters';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable } from '@/features/ux-kit/data-table';
import { DateRangeInput } from '@/features/ux-kit/date-inputs';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { actionLabel, auditColumns, entityLabel } from './components/audit-columns';
import { ExportAuditButton } from './components/export-audit-button';
import { toAuditFilters, type AuditUrlFilters } from './model/audit-filters';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** Charts pull in recharts: loaded only when the "Activity" section is opened. */
const AuditCharts = lazy(() => import('./components/audit-charts').then((module) => ({ default: module.AuditCharts })));

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

function AuditScreen() {
  const { number } = useNumberFormat();
  const navigate = useNavigate();
  const dates = usePlantDates();
  const [defaults] = useState<AuditUrlFilters>(() => ({ ...rollingWindow(30 * DAY_MS), q: '', action: ALL, entity: ALL }));
  const [values, setValues] = useUrlFilters(defaults);
  const filters = toAuditFilters(values);
  const entries = useAuditPage(filters);
  const summary = useAuditSummary({ from: filters.from, to: filters.to });
  const columns = useMemo(() => auditColumns(dates.dateTime), [dates]);
  const actions = optionsOf((summary.data?.byAction ?? []).map((row) => row.key), actionLabel, 'All actions');
  const entities = optionsOf((summary.data?.byEntityType ?? []).map((row) => row.key), entityLabel, 'All records');
  return (
    <Page width="wide">
      <PageHeader title="Audit log" description="Who changed what, and when, in the selected plant." actions={<ExportAuditButton filters={filters} timezone={dates.timezone} />} />
      <Section title="Filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <DateRangeInput
            label="Period"
            value={{ from: values.from || null, to: values.to || null }}
            timeZone={dates.timezone}
            onChange={(range) => setValues({ from: range.from ?? '', to: range.to ?? '' })}
          />
          <DebouncedSearchInput label="Search actions, records and details" value={values.q} onChange={(q) => setValues({ q })} />
          <FilterSelect label="Action filter" value={values.action} options={actions} onChange={(action) => setValues({ action })} />
          <FilterSelect label="Record type filter" value={values.entity} options={entities} onChange={(entity) => setValues({ entity })} />
        </div>
      </Section>
      <Section title="Activity" description={summary.data ? `${number(summary.data.total)} entries in the period` : undefined} collapsible defaultOpen={false}>
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>{summary.data && <AuditCharts summary={summary.data} />}</Suspense>
      </Section>
      <Section title="Entries">
        <DataTable
          caption="Audit entries"
          columns={columns}
          rows={entries.rows}
          getRowKey={(entry) => entry.id}
          pager={entries.pager}
          status={entries.status}
          empty={{ title: 'No entries', text: 'Nothing was recorded for these filters.' }}
          onRowClick={(entry) => navigate(`/audit/${entry.id}`)}
          rowLabel={(entry) => `Open entry: ${actionLabel(entry.action)} ${entityLabel(entry.entityType)}`}
        />
      </Section>
    </Page>
  );
}
