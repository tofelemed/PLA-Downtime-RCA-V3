import { Link, useSearchParams } from 'react-router-dom';
import type { MonthCloseView } from '@/api/v2/types/month-close';
import type { ExceptionType, ReconciliationExceptionView } from '@/api/v2/types/reconciliation-exceptions';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { type CalendarPreference, formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { CloseCard } from '../components/close-card';
import { CloseEmpty } from '../components/close-empty';
import { NoPlanLink } from '../components/no-plan-notice';
import { exceptionHref, exceptionLinkText, isExceptionType, typeLabel, WORKFLOW_LABELS } from './exception-model';
import { ExceptionFilters } from './exception-filters';
import { useCloseExceptions } from './use-close-exceptions';

function FixLink({ row }: { row: ReconciliationExceptionView }) {
  const href = exceptionHref(row.target);
  if (!href) return <NoPlanLink />;
  return (
    <Link to={href} className="text-sm underline" data-testid="exception-link">
      {exceptionLinkText(row.target)}
    </Link>
  );
}

function columns(pref: CalendarPreference): DataTableColumn<ReconciliationExceptionView>[] {
  return [
    {
      id: 'type',
      header: 'Problem',
      cell: (row) => <StatusBadge tone="warning" data-testid="exception-type" data-type={row.type}>{typeLabel(row.type)}</StatusBadge>,
    },
    {
      id: 'period',
      header: 'Period',
      nowrap: true,
      cell: (row) => (
        <span data-testid="exception-row" data-period-id={row.periodId}>
          {row.unitName ?? 'Unit'} · {formatOperationalDate(row.localDate, pref)}
          {row.shiftName ? ` · ${row.shiftName}` : ''}
        </span>
      ),
    },
    { id: 'message', header: 'What is wrong', cell: (row) => <span data-testid="exception-message">{row.message}</span> },
    { id: 'workflow', header: 'Workflow', nowrap: true, cell: (row) => WORKFLOW_LABELS[row.workflowState] },
    { id: 'fix', header: '', headerLabel: 'Actions', align: 'right', cell: (row) => <FixLink row={row} /> },
  ];
}

/** Filters in the URL (`problem`, `unit`), so a shared link keeps them; unknown values read as "all". */
function useExceptionParams(): { type: ExceptionType | null; unitId: string | null; set: (key: 'problem' | 'unit', value: string) => void } {
  const [params, setParams] = useSearchParams();
  const raw = params.get('problem') ?? '';
  const set = (key: 'problem' | 'unit', value: string) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace: true });
  return { type: isExceptionType(raw) ? raw : null, unitId: params.get('unit') || null, set };
}

const EMPTY = { title: 'No open accounting problems', text: 'No period of this month that is not approved has a stored problem matching these filters.' };

/**
 * Month close → Exceptions (plan 2.4): every open accounting problem of the month's periods that are not
 * approved, as the server lists them (stored state only), with the screen that fixes each one.
 */
export function CloseExceptions({ view }: { view: Pick<MonthCloseView, 'firstDate' | 'endDate'> }) {
  const pref = useCalendarPreference();
  const filters = useExceptionParams();
  const list = useCloseExceptions({ fromDate: view.firstDate, toDate: view.endDate, type: filters.type, unitId: filters.unitId });
  const empty = list.rows.length === 0 && !list.status.isLoading && !list.status.isError;
  return (
    <CloseCard title="Exceptions" info="Open problems of this month's periods that are not approved yet, from the latest calculation and the recorded stops. Fix each one on the screen its link opens.">
      <div className="space-y-4" data-testid="close-exceptions">
        <ExceptionFilters type={filters.type} unitId={filters.unitId} onChange={filters.set} />
        {empty ? <CloseEmpty title={EMPTY.title} text={EMPTY.text} /> : (
          <DataTable
            caption="Accounting exceptions"
            columns={columns(pref)}
            rows={list.rows}
            pager={list.pager}
            status={list.status}
            empty={EMPTY}
            getRowKey={(row) => row.id}
            density="compact"
          />
        )}
      </div>
    </CloseCard>
  );
}
