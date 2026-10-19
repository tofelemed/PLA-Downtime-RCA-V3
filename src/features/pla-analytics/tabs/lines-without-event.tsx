import { Link } from 'react-router-dom';
import { useLinesWithoutEvent } from '@/api/v2/queries/pla-analytics';
import type { LineWithoutEventView } from '@/api/v2/types/pla-analytics';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { NoPlanLink } from '@/features/month-close/components/no-plan-notice';
import { periodPath } from '@/features/plan-dashboard/model/period-navigation';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { plural } from '@/features/ux-kit/format/plural';
import { humanize } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { useCalendarPreference, type CalendarPreference } from '@/lib/dates';
import type { AnalyticsScope } from '../model/analytics-scope';
import { lineEvidenceText, linesWithoutEventQuery } from '../model/lines-without-event';
import { periodLabel } from '../model/period-label';

function columnsOf(env: { timezone: string; unitName: (id: string) => string }, pref: CalendarPreference): Array<DataTableColumn<LineWithoutEventView>> {
  return [
    {
      id: 'period',
      header: 'Period',
      nowrap: true,
      cell: (line) => {
        const label = periodLabel({ localDate: line.localDate, shiftName: line.shiftName, utcStart: line.periodStart }, env.timezone, pref);
        if (!line.planId) return <NoPlanLink />;
        return (
          <Link className="underline underline-offset-2" to={periodPath(line.planId, line.periodId)} data-testid="line-without-event-period">
            {label}
          </Link>
        );
      },
    },
    { id: 'unit', header: 'Unit', cell: (line) => env.unitName(line.unitId) },
    { id: 'kind', header: 'Loss kind', cell: (line) => humanize(line.kind) },
    { id: 'quantity', header: 'Lost quantity', align: 'right', nowrap: true, cell: (line) => <Quantity value={line.quantity} uom={line.uom} /> },
    { id: 'reason', header: 'Reason', cell: (line) => line.reasonLabel ?? 'No reason code' },
    { id: 'evidence', header: 'Evidence', cell: (line) => <span className="break-words">{lineEvidenceText(line)}</span> },
  ];
}

/**
 * The loss lines of an OEE component that explain no event (QA PLA M3 re-test): the Performance drill of a
 * manual line opened "No loss events in this window". The server lists the lines with their reason and
 * evidence; each opens its period. Nothing is shown when every line has an event.
 */
export function LinesWithoutEvent({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  const query = useLinesWithoutEvent(linesWithoutEventQuery(scope), env.timezone);
  const data = query.data?.data;
  if (!data || data.total === 0) return null;
  const shown = data.items.length < data.total ? ` (the ${data.items.length} largest)` : '';
  return (
    <section className="space-y-2" data-testid="lines-without-event" aria-label="Loss lines with no event">
      <h3 className="text-sm font-semibold">Loss lines with no event</h3>
      <p className="text-xs text-muted-foreground">
        {plural(data.total, 'loss line', 'loss lines')}
        {shown} of this {scope.eventOee === 'all' ? 'scope' : `component (${humanize(scope.eventOee)})`} explain no stop or event: they were entered on the period with their reason and evidence.
      </p>
      <DataTable caption="Loss lines with no event" columns={columnsOf(env, pref)} rows={data.items} getRowKey={(line) => line.lineId} pager="none" density="compact" />
    </section>
  );
}
