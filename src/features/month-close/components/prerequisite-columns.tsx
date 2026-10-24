import { Link } from 'react-router-dom';
import type { MonthCloseView, OpenProposalView, PendingPeriodView } from '@/api/v2/types/month-close';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { formatOperationalDate, type CalendarPreference } from '@/lib/dates';
import { PENDING_WORKFLOW_LABELS, PROPOSAL_TRIGGER_LABELS } from '../model/close-labels';
import { NoPlanLink } from './no-plan-notice';

export function pendingColumns(pref: CalendarPreference): DataTableColumn<PendingPeriodView>[] {
  return [
    { id: 'date', header: 'Date', cell: (p) => formatOperationalDate(p.localDate, pref), nowrap: true },
    { id: 'unit', header: 'Unit', cell: (p) => <span className="break-words">{p.unitName ?? 'Unit'}</span> },
    { id: 'shift', header: 'Shift', cell: (p) => p.shiftName ?? '—' },
    { id: 'workflow', header: 'Status', cell: (p) => PENDING_WORKFLOW_LABELS[p.workflow] ?? p.workflow },
    { id: 'period', header: 'Period', nowrap: true, cell: (p) => p.planId
      ? <Link className="underline underline-offset-2" to={`/plans/${p.planId}/periods/${p.periodId}`} data-testid="pending-open">Open period</Link>
      : <NoPlanLink /> },
  ];
}

export function dayColumns(pref: CalendarPreference): DataTableColumn<MonthCloseView['prerequisites']['uncertifiedDays'][number]>[] {
  return [
    { id: 'date', header: 'Date', cell: (d) => formatOperationalDate(d.localDate, pref), nowrap: true },
    { id: 'unit', header: 'Unit', cell: (d) => <span className="break-words">{d.unitName ?? 'Unit'}</span> },
  ];
}

export function proposalColumns(pref: CalendarPreference, timezone: string): DataTableColumn<OpenProposalView>[] {
  return [
    { id: 'date', header: 'Date', cell: (p) => formatOperationalDate(p.localDate, pref), nowrap: true },
    { id: 'trigger', header: 'Change', cell: (p) => <span className="block min-w-32">{PROPOSAL_TRIGGER_LABELS[p.trigger] ?? p.trigger}</span> },
    { id: 'reason', header: 'Reason', cell: (p) => <span className="block min-w-64 max-w-md [overflow-wrap:anywhere]">{p.manualReason ?? '—'}</span> },
    { id: 'created', header: 'Created', cell: (p) => <span className="block min-w-56"><PlantTime iso={p.createdAt} tz={timezone} withDate withZone={false} /></span> },
    { id: 'period', header: 'Period', nowrap: true, cell: (p) => p.planId
      ? <Link className="underline underline-offset-2" to={`/plans/${p.planId}/periods/${p.periodId}`}>Open period</Link>
      : <span className="text-muted-foreground">No plan link available</span> },
  ];
}
