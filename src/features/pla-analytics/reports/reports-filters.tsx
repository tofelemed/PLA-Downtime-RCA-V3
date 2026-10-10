import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { plantLocalToUtc } from '@/features/event-hub/model/plant-local-time';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { plantTimeParts } from '@/features/ux-kit/format/plant-time';
import type { AnalyticsScope } from '../model/analytics-scope';
import { SELECT_CLASS } from '../components/analytics-filters';

export interface ReportsFiltersProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

const plantDate = (iso: string, tz: string) => plantTimeParts(iso, tz)?.date ?? iso.slice(0, 10);

/** The day after a `YYYY-MM-DD` calendar date (date arithmetic for the input only). */
function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function previousDate(date: string): string {
  const previous = new Date(`${date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

/**
 * Report filters (plan 3.6 step 4): named units, the plant dates the periods start on (not when rows were
 * created), and the revision selector — approved only, or approved else the latest draft (provisional).
 */
export function ReportsFilters({ scope, onChange }: ReportsFiltersProps) {
  const env = useEventHubEnv();
  const fromDate = plantDate(scope.from, env.timezone);
  const toDate = previousDate(plantDate(scope.to, env.timezone));
  const setDates = (from: string, to: string) => {
    const fromUtc = plantLocalToUtc(`${from}T00:00`, env.timezone);
    const toUtc = plantLocalToUtc(`${nextDate(to)}T00:00`, env.timezone);
    if (fromUtc && toUtc && fromUtc < toUtc) onChange({ from: fromUtc, to: toUtc, windowLabel: `${from} – ${to}` });
  };
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Report filters" data-testid="reports-filters">
      <MultiCheckSelect
        label="Units"
        testId="report-units"
        options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
        selected={scope.unitIds}
        onChange={(unitIds) => onChange({ unitIds: [...unitIds].sort() })}
      />
      <div className="space-y-1">
        <Label htmlFor="report-from">Period dates from</Label>
        <Input id="report-from" type="date" value={fromDate} onChange={(e) => e.target.value && setDates(e.target.value, toDate)} data-testid="report-from" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="report-to">to (inclusive)</Label>
        <Input id="report-to" type="date" value={toDate} onChange={(e) => e.target.value && setDates(fromDate, e.target.value)} data-testid="report-to" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="report-revision">Revisions</Label>
        <select
          id="report-revision"
          data-testid="report-revision"
          className={SELECT_CLASS}
          value={scope.approvedOnly ? 'approved' : 'shown'}
          onChange={(e) => onChange({ approvedOnly: e.target.value === 'approved' })}
        >
          <option value="shown">Approved, else latest draft (provisional)</option>
          <option value="approved">Approved only</option>
        </select>
      </div>
    </div>
  );
}
