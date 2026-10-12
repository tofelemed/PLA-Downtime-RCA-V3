import { Label } from '@/components/ui/label';
import { DateRangeInput, type InstantRange } from '@/features/ux-kit/date-inputs';
import { MultiCheckSelect } from '@/features/event-hub/components/multi-check-select';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import type { AnalyticsScope } from '../model/analytics-scope';
import { SELECT_CLASS } from '../components/analytics-filters';

export interface ReportsFiltersProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * Report filters (plan 3.6 step 4): named units (sent when the list closes), the plant dates the periods
 * start on (not when rows were created; Persian or Gregorian per the plant setting), and the revision
 * selector — approved only, or approved else the latest draft (provisional).
 */
export function ReportsFilters({ scope, onChange }: ReportsFiltersProps) {
  const env = useEventHubEnv();
  const setDates = (range: InstantRange) => {
    if (range.from && range.to) onChange({ from: range.from, to: range.to, windowLabel: 'Chosen dates' });
  };
  return (
    <div className="flex flex-wrap items-end gap-4" role="group" aria-label="Report filters" data-testid="reports-filters">
      <MultiCheckSelect
        label="Units"
        testId="report-units"
        options={env.units.map((unit) => ({ value: unit.id, label: unit.name }))}
        selected={scope.unitIds}
        onChange={(unitIds) => onChange({ unitIds: [...unitIds].sort() })}
        commitOnClose
      />
      <DateRangeInput label="Period dates" value={{ from: scope.from, to: scope.to }} timeZone={env.timezone} onChange={setDates} />
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
